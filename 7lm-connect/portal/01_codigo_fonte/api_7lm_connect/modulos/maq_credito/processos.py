import asyncio
import base64
import binascii
from datetime import datetime, timezone
from io import BytesIO
import json
import logging
import re
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response, StreamingResponse
from pypdf import PdfReader, PdfWriter
from starlette.datastructures import UploadFile

from configuracoes import ESQUEMA_COMERCIAL
from modulos.maq_credito.db import execute, fetch_all, fetch_one
from modulos.maq_credito.checklist_rules import build_documentary_payload

from modulos.maq_credito.models import (
    ChecklistMessageCreate,
    ChecklistMessageResponse,
    CredituDadosPayload,
    DiagnosticoProcessoResponse,
    DocumentoUpdate,
    KitDownloadPayload,
    PendenciaUpdate,
    PerfilDocumentalPayload,
    ProcessoResponse,
    ProcessoUpdate,
    RelacionamentoUpdate,
    SlaResponse,
    UploadJsonPayload,
)
from modulos.maq_credito.normalizers import (
    AGEHAB_STATUS,
    CAIXA_STATUS,
    DOCUMENTO_STATUS,
    RELACIONAMENTO_STATUS,
    normalize,
)
from modulos.maq_credito.storage import (
    LOCAL_UPLOAD_ROOT,
    MERGED_UPLOAD_ROOT,
    fallback_upload_url,
    local_upload_path,
    remove_from_storage,
    save_local_upload,
    upload_bytes,
    
)

router = APIRouter(prefix="/processos", tags=["processos"])
logger = logging.getLogger(__name__)
ANALYST_ROLE = "analista"
AUTO_PENDING_ANALYST_STATUS = "Pendente Validacao Analista"
VALID_ACTOR_ROLES = {"corretor", "analista", "cca", "gestor", "sistema"}


def nome_sql_seguro(nome: str) -> str:
    texto = str(nome or "").strip()
    if not texto.replace("_", "").isalnum() or texto[0:1].isdigit():
        raise RuntimeError(f"Nome de schema invalido: {texto!r}")
    return texto


COMERCIAL_SCHEMA = nome_sql_seguro(ESQUEMA_COMERCIAL)


def prazo_no_passado(valor: str | None) -> bool:
    if not valor:
        return False
    try:
        prazo = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError:
        return False
    agora = datetime.now(prazo.tzinfo or timezone.utc) if prazo.tzinfo else datetime.now()
    return prazo < agora


def normalize_actor_role(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in VALID_ACTOR_ROLES else "corretor"


def require_analyst_role(actor_role: str) -> None:
    if actor_role != ANALYST_ROLE:
        raise HTTPException(
            status_code=403,
            detail="A validacao documental e exclusiva do analista de credito.",
        )

DOCUMENT_ORDER = [
    "documentos-do-proponente-identidade-e-cpf",
    "documentos-do-proponente-comp-de-estado-civil",
    "documentos-do-proponente-comprovante-de-residencia",
    "documentos-do-proponente-extrato-fgts",
    "documentos-do-proponente-ctps-carteira",
    "conjuge-identidade-e-cpf",
    "conjuge-comp-de-estado-civil",
    "conjuge-comprovante-de-renda",
    "conjuge-extrato-fgts",
    "conjuge-ctps-carteira",
    "uniao-estavel-termo",
    "socio-",
    "dependente-",
    "renda-formal",
    "renda-informal",
    "aposentados",
    "documentos-creditu",
    "documentos-caixa",
    "documentos-agehab",
]


def safe_segment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-") or "arquivo"


def parse_data_url(data: str) -> tuple[bytes, str]:
    content_type = "application/octet-stream"
    encoded = data
    if data.startswith("data:"):
        header, encoded = data.split(",", 1)
        content_type = header[5:].split(";")[0] or content_type
    try:
        return base64.b64decode(encoded), content_type
    except binascii.Error as exc:
        raise HTTPException(status_code=400, detail="Upload em base64 invalido.") from exc


def upsert_processo(reserva: str, values: dict[str, Any] | None = None) -> None:
    values = values or {}
    columns = ["reserva", *values.keys()]
    placeholders = ", ".join(["%s"] * len(columns))
    update_parts = [f"{column} = excluded.{column}" for column in values]
    if values:
        update_parts.append("updated_at = now()")
    updates = ", ".join(update_parts)
    conflict = f"do update set {updates}" if updates else "do nothing"
    execute(
        f"""
        insert into maq_credito.processos ({", ".join(columns)})
        values ({placeholders})
        on conflict (reserva) {conflict}
        """,
        [reserva, *values.values()],
    )


def start_sla(reserva: str) -> None:
    upsert_processo(reserva)
    execute(
        """
        insert into maq_credito.sla_processos (reserva, started_at, updated_at)
        values (%s, now(), now())
        on conflict (reserva) do update set updated_at = now()
        """,
        [reserva],
    )


def stop_sla(reserva: str, reason: str = "envio_conformidade") -> None:
    upsert_processo(reserva)
    execute(
        """
        insert into maq_credito.sla_processos (reserva, started_at, stopped_at, stop_reason, updated_at)
        values (%s, now(), now(), %s, now())
        on conflict (reserva) do update set
          stopped_at = coalesce(maq_credito.sla_processos.stopped_at, now()),
          stop_reason = coalesce(maq_credito.sla_processos.stop_reason, excluded.stop_reason),
          updated_at = now()
        """,
        [reserva, reason],
    )


EVENT_LABELS = {
    "reserva": "Reserva",
    "em_analise_credito": "Em Analise Credito",
    "emitindo_formularios": "Emitindo Formularios",
    "formularios_em_assinatura": "Formulários Em Assinatura",
    "formularios_assinados": "Formularios Assinados",
    "envio_conformidade": "Enviado para Conformidade",
    "ficha_emitida": "Ficha emitida",
    "ficha_recebida": "Ficha Recebida",
    "em_validacao_agehab": "Em Validacao Agehab",
    "agehab_validada": "Agehab Validada",
}


def registrar_evento(reserva: str, status: str, id_corretor: str | None = None) -> None:
    execute(
        """
        insert into maq_credito.log_eventos (id_cliente, status, timestamp, id_corretor)
        values (%s, %s, now(), %s)
        """,
        [reserva, status, id_corretor],
    )


def registrar_historico_pendencia(
    reserva: str,
    documento_key: str,
    descricao: str = "",
    prazo: str | None = None,
    origem: str | None = None,
    evento: str = "criada",
    status_documento: str | None = None,
) -> None:
    execute(
        """
        insert into maq_credito.pendencias_historico
          (reserva, documento_key, descricao, prazo, origem, evento, status_documento)
        values (%s, %s, %s, %s, %s, %s, %s)
        """,
        [reserva, documento_key, descricao, prazo, origem, evento, status_documento],
    )


def format_elapsed(seconds: int) -> str:
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours:
        return f"{hours}h {minutes:02d}m"
    return f"{minutes}m"


def get_sla(reserva: str) -> SlaResponse:
    row = fetch_one(
        """
        select
          reserva,
          started_at,
          stopped_at,
          stop_reason,
          extract(epoch from (coalesce(stopped_at, now()) - started_at))::int as elapsed_seconds
        from maq_credito.sla_processos
        where reserva = %s
        """,
        [reserva],
    )
    if not row:
        return SlaResponse()
    elapsed = max(int(row.get("elapsed_seconds") or 0), 0)
    return SlaResponse(
        status="parado" if row.get("stopped_at") else "rodando",
        started_at=row["started_at"].isoformat() if row.get("started_at") else None,
        stopped_at=row["stopped_at"].isoformat() if row.get("stopped_at") else None,
        elapsed_seconds=elapsed,
        elapsed_label=format_elapsed(elapsed),
        stop_reason=row.get("stop_reason"),
    )


def table_rows(table: str, reserva: str) -> list[dict[str, Any]]:
    table_map = {
        "documentos_status": "documentos_status",
        "relacionamento_status": "relacionamento_status",
        "documentos_pendencias": "documentos_pendencias",
        "pendencias_historico": "pendencias_historico",
        "uploads": "uploads",
    }
    physical_table = table_map.get(table)
    if not physical_table:
        raise ValueError("Tabela nao permitida.")
    return fetch_all(f"select * from maq_credito.{physical_table} where reserva = %s", [reserva])


def family_rows(cliente_id: str | None) -> list[dict[str, Any]]:
    if not cliente_id:
        return []
    return fetch_all(
        f"""
        select
          identificador_membro::text as identificador_membro,
          identificador_cliente_principal::text as identificador_cliente_principal,
          nome_completo,
          cpf,
          rg,
          data_nascimento,
          estado_civil,
          parentesco,
          renda_mensal,
          renda_total,
          renda_formal,
          renda_informal,
          tempo_emprego_anos,
          tipo_contrato,
          empresa_atual,
          cargo,
          profissao,
          compoe_renda,
          incluir_na_analise,
          principal_comprador,
          responsavel_documentacao,
          ativo
        from {COMERCIAL_SCHEMA}.composicao_familiar_cliente
        where identificador_cliente_principal = %s::uuid
          and ativo = true
        order by data_hora_criacao asc
        """,
        [cliente_id],
    )


def ensure_perfil_documental_table() -> None:
    execute(
        """
        create extension if not exists pgcrypto;

        create table if not exists maq_credito.perfil_documental (
          reserva text primary key references maq_credito.processos(reserva) on delete cascade,
          dados jsonb not null default '{}'::jsonb,
          updated_by text,
          updated_role text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )


def perfil_documental_row(reserva: str) -> dict[str, Any]:
    if not reserva:
        return {}
    ensure_perfil_documental_table()
    row = fetch_one(
        """
        select dados, updated_by, updated_role, updated_at
        from maq_credito.perfil_documental
        where reserva = %s
        """,
        [reserva],
    )
    if not row:
        return {}
    dados = row.get("dados") or {}
    if isinstance(dados, str):
        try:
            dados = json.loads(dados)
        except json.JSONDecodeError:
            dados = {}
    if not isinstance(dados, dict):
        dados = {}
    return {
        **dados,
        "_metadata": {
            "updated_by": row.get("updated_by"),
            "updated_role": row.get("updated_role"),
            "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
        },
    }


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def clean_money(value: Any) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def normalize_profile_member(item: dict[str, Any], *, fallback_relation: str, fallback_id: str) -> dict[str, Any]:
    name = clean_text(item.get("nome") or item.get("nome_completo"))
    relation = clean_text(item.get("parentesco") or fallback_relation)
    return {
        "identificador_membro": clean_text(item.get("identificador_membro") or item.get("id") or fallback_id),
        "nome_completo": name,
        "cpf": clean_text(item.get("cpf")),
        "rg": clean_text(item.get("rg")),
        "data_nascimento": clean_text(item.get("data_nascimento")),
        "estado_civil": clean_text(item.get("estado_civil")),
        "parentesco": relation,
        "renda_mensal": clean_money(item.get("renda_mensal") or item.get("renda_total") or item.get("renda")),
        "renda_total": clean_money(item.get("renda_total") or item.get("renda_mensal") or item.get("renda")),
        "renda_formal": clean_money(item.get("renda_formal")),
        "renda_informal": clean_money(item.get("renda_informal")),
        "tempo_emprego_anos": item.get("tempo_emprego_anos") if item.get("tempo_emprego_anos") not in ("", None) else None,
        "tipo_contrato": clean_text(item.get("tipo_contrato")),
        "empresa_atual": clean_text(item.get("empresa_atual") or item.get("empresa")),
        "cargo": clean_text(item.get("cargo")),
        "profissao": clean_text(item.get("profissao")),
        "compoe_renda": bool(item.get("compoe_renda", True)),
        "incluir_na_analise": bool(item.get("incluir_na_analise", True)),
        "ativo": True,
    }


def estado_civil_tem_conjuge(value: Any) -> bool:
    texto = clean_text(value).lower()
    return "casad" in texto or "uni" in texto and "est" in texto


def aplicar_perfil_documental_override(
    processo: dict[str, Any],
    composicao_familiar: list[dict[str, Any]],
    perfil_override: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not perfil_override:
        return processo, composicao_familiar

    dados = {key: value for key, value in perfil_override.items() if key != "_metadata"}
    cliente_cadastro = dict(processo.get("cliente_cadastro") or {})
    estado_civil = clean_text(dados.get("estado_civil"))
    if estado_civil:
        cliente_cadastro["estado_civil"] = estado_civil
    if "renda_conjuge" in dados:
        cliente_cadastro["renda_conjuge"] = clean_money(dados.get("renda_conjuge"))

    membros: list[dict[str, Any]] = []
    if estado_civil_tem_conjuge(cliente_cadastro.get("estado_civil")):
        conjuge = dados.get("conjuge") if isinstance(dados.get("conjuge"), dict) else {}
        if conjuge or clean_money(dados.get("renda_conjuge")) > 0:
            membros.append(
                normalize_profile_member(
                    {
                        **conjuge,
                        "parentesco": conjuge.get("parentesco") or "Conjuge",
                        "estado_civil": conjuge.get("estado_civil") or cliente_cadastro.get("estado_civil"),
                        "renda_total": conjuge.get("renda_total") or dados.get("renda_conjuge"),
                    },
                    fallback_relation="Conjuge",
                    fallback_id="perfil-conjuge",
                )
            )

    dependentes = dados.get("dependentes") if isinstance(dados.get("dependentes"), list) else []
    for index, dependente in enumerate(dependentes, start=1):
        if not isinstance(dependente, dict):
            continue
        if not any(clean_text(dependente.get(key)) for key in ("nome", "nome_completo", "parentesco", "data_nascimento", "estado_civil")):
            continue
        membros.append(
            normalize_profile_member(
                dependente,
                fallback_relation="Dependente",
                fallback_id=f"perfil-dependente-{index}",
            )
        )

    return {**processo, "cliente_cadastro": cliente_cadastro}, membros


def carteira_sql(include_payloads: bool = False) -> str:
    payload_campos_clientes = """
            jsonb_strip_nulls(
              jsonb_build_object(
                'identificador_cliente', c.identificador_cliente::text,
                'nome_completo', c.nome_completo,
                'cpf', c.cpf,
                'rg', c.rg,
                'estado_civil', c.estado_civil,
                'regime_casamento', c.regime_casamento,
                'email', c.email,
                'telefone', c.telefone,
                'celular', c.celular,
                'cidade', c.cidade,
                'estado', c.estado,
                'renda_principal', c.renda_principal,
                'renda_conjuge', c.renda_conjuge,
                'renda_total', c.renda_total,
                'renda_formal', c.renda_formal,
                'renda_informal', c.renda_informal,
                'outras_rendas', c.outras_rendas,
                'dependentes', c.dependentes,
                'filhos', c.filhos,
                'tempo_emprego_anos', c.tempo_emprego_anos,
                'tipo_contrato', c.tipo_contrato,
                'empresa', c.empresa,
                'cargo', c.cargo,
                'profissao', c.profissao,
                'usuario_cadastro_nome', c.usuario_cadastro_nome,
                'usuario_cadastro_email', c.usuario_cadastro_email,
                'parametros_simulacao', coalesce(c.parametros_simulacao, '{}'::jsonb)
              )
            ) as cliente_cadastro,
            jsonb_strip_nulls(
              jsonb_build_object(
                'identificador_reserva', r.identificador_reserva::text,
                'identificador_cliente', r.identificador_cliente::text,
                'identificador_imovel', r.identificador_imovel::text,
                'identificador_simulacao', r.identificador_simulacao::text,
                'status', r.status,
                'observacoes', r.observacoes,
                'reservado_em', r.reservado_em
              )
            ) as reserva_comercial,
            jsonb_strip_nulls(
              jsonb_build_object(
                'identificador_imovel', i.identificador_imovel::text,
                'titulo', i.titulo,
                'descricao', i.descricao,
                'tipo_imovel', i.tipo_imovel,
                'endereco', i.endereco,
                'cidade', i.cidade,
                'bairro', i.bairro,
                'estado', i.estado,
                'valor', i.valor,
                'status', i.status
              )
            ) as imovel_detalhes,
            jsonb_strip_nulls(
              jsonb_build_object(
                'identificador_simulacao', s.identificador_simulacao::text,
                'status_simulacao', s.status_simulacao,
                'payload_snapshot', jsonb_strip_nulls(
                  jsonb_build_object(
                    'calculo', jsonb_strip_nulls(
                      jsonb_build_object(
                        'cliente', coalesce(s.payload_snapshot -> 'calculo' -> 'cliente', '{}'::jsonb),
                        'imovel', coalesce(s.payload_snapshot -> 'calculo' -> 'imovel', '{}'::jsonb)
                      )
                    ),
                    'extra', coalesce(s.payload_snapshot -> 'extra', '{}'::jsonb),
                    'resumo_operacao', coalesce(s.payload_snapshot -> 'resumo_operacao', '{}'::jsonb),
                    'aprovacao_excecao', coalesce(s.payload_snapshot -> 'aprovacao_excecao', '{}'::jsonb)
                  )
                )
              )
            ) as simulacao_detalhes,
            coalesce(c.parametros_simulacao, '{}'::jsonb) as simulacao_fechada
    """
    if include_payloads:
        payload_campos_clientes = """
            coalesce(to_jsonb(c), '{}'::jsonb) as cliente_cadastro,
            coalesce(to_jsonb(r), '{}'::jsonb) as reserva_comercial,
            coalesce(to_jsonb(i), '{}'::jsonb) as imovel_detalhes,
            coalesce(to_jsonb(s), '{}'::jsonb) as simulacao_detalhes,
            coalesce(c.parametros_simulacao, '{}'::jsonb) as simulacao_fechada
        """

    payload_campos_manuais = """
            '{}'::jsonb as cliente_cadastro,
            '{}'::jsonb as reserva_comercial,
            '{}'::jsonb as imovel_detalhes,
            '{}'::jsonb as simulacao_detalhes,
            '{}'::jsonb as simulacao_fechada
    """

    return f"""
        with clientes_comerciais as (
          select
            coalesce(p.reserva, c.identificador_cliente::text) as reserva,
            nullif(trim(coalesce(p.cliente, c.nome_completo)), '') as cliente,
            c.identificador_cliente::text as cliente_id,
            c.cpf as cliente_cpf,
            c.email as cliente_email,
            coalesce(nullif(trim(c.celular), ''), nullif(trim(c.telefone), '')) as cliente_telefone,
            c.cidade as cliente_cidade,
            c.estado as cliente_estado,
            coalesce(p.caixa_status, 'reserva') as caixa_status,
            coalesce(p.agehab_status, 'reserva') as agehab_status,
            coalesce(nullif(trim(p.produto), ''), nullif(trim(i.tipo_imovel), ''), 'Cadastro comercial') as produto,
            p.sinal,
            p.fiador,
            coalesce(
              nullif(trim(p.corretor), ''),
              nullif(trim(c.usuario_cadastro_nome), ''),
              nullif(trim(c.usuario_cadastro_email), '')
            ) as corretor,
            coalesce(
              nullif(trim(p.empreendimento), ''),
              nullif(trim(s.empreendimento), ''),
              nullif(trim(s.payload_snapshot #>> '{{calculo,imovel,empreendimento}}'), ''),
              nullif(trim(substring(i.descricao from '(?i)Localidade\\s*:\\s*([^\\.\\n\\r]+)')), ''),
              nullif(trim(i.bairro), ''),
              nullif(trim(i.cidade), ''),
              nullif(trim(c.cidade), '')
            ) as empreendimento,
            r.identificador_reserva::text as reserva_comercial_id,
            r.status as reserva_comercial_status,
            i.identificador_imovel::text as imovel_id,
            coalesce(
              nullif(trim(i.titulo), ''),
              nullif(trim(s.payload_snapshot #>> '{{calculo,imovel,titulo}}'), ''),
              nullif(trim(s.payload_snapshot #>> '{{extra,imovel_titulo}}'), '')
            ) as imovel_titulo,
            i.endereco as imovel_endereco,
            i.cidade as imovel_cidade,
            i.bairro as imovel_bairro,
            i.estado as imovel_estado,
            i.status as imovel_status,
            s.identificador_simulacao::text as simulacao_id,
            coalesce(
              nullif(trim(s.status_simulacao), ''),
              nullif(trim(c.parametros_simulacao ->> 'status_simulacao'), ''),
              nullif(trim(c.parametros_simulacao ->> 'status_comercial'), '')
            ) as simulacao_status,
            coalesce(s.valor_imovel, i.valor) as simulacao_valor_imovel,
            s.valor_total_operacao as simulacao_valor_total_operacao,
            coalesce(s.financiamento_caixa, nullif(c.parametros_simulacao ->> 'financiamento_caixa', '')::numeric) as simulacao_financiamento_caixa,
            coalesce(s.fgts, nullif(c.parametros_simulacao ->> 'fgts', '')::numeric) as simulacao_fgts,
            coalesce(s.subsidio, nullif(c.parametros_simulacao ->> 'subsidio', '')::numeric) as simulacao_subsidio,
            coalesce(s.entrada, nullif(c.parametros_simulacao ->> 'entrada', '')::numeric) as simulacao_entrada,
            p.cca_vinculado,
            p.observacao_analista,
            coalesce(p.encaminhado_analista, false) as encaminhado_analista,
            coalesce(p.created_at, r.data_hora_criacao, c.data_hora_criacao) as created_at,
            coalesce(p.updated_at, r.data_hora_atualizado_em, c.data_hora_atualizado_em, c.data_hora_criacao) as updated_at,
            case when p.reserva is null then 'cliente_comercial' else 'processo_cliente' end as origem,
            (p.reserva is not null) as tem_processo,
            {payload_campos_clientes}
          from {COMERCIAL_SCHEMA}.cliente c
          left join lateral (
            select r.*
            from {COMERCIAL_SCHEMA}.imovel_reserva r
            where r.identificador_cliente = c.identificador_cliente
            order by coalesce(r.reservado_em, r.data_hora_criacao) desc nulls last, r.data_hora_criacao desc
            limit 1
          ) r on true
          left join {COMERCIAL_SCHEMA}.imovel i
            on i.identificador_imovel = r.identificador_imovel
          left join {COMERCIAL_SCHEMA}.simulacao s
            on s.identificador_simulacao = r.identificador_simulacao
          left join lateral (
            select p.*
            from maq_credito.processos p
            where p.reserva = c.identificador_cliente::text
               or (r.identificador_reserva is not null and p.reserva = r.identificador_reserva::text)
               or lower(trim(p.cliente)) = lower(trim(c.nome_completo))
            order by
              case
                when p.reserva = c.identificador_cliente::text then 0
                when r.identificador_reserva is not null and p.reserva = r.identificador_reserva::text then 1
                else 2
              end,
              p.updated_at desc,
              p.created_at desc
            limit 1
          ) p on true
        ),
        processos_avulsos as (
          select
            p.reserva,
            nullif(trim(p.cliente), '') as cliente,
            null::text as cliente_id,
            null::text as cliente_cpf,
            null::text as cliente_email,
            null::text as cliente_telefone,
            null::text as cliente_cidade,
            null::text as cliente_estado,
            p.caixa_status,
            p.agehab_status,
            p.produto,
            p.sinal,
            p.fiador,
            p.corretor,
            p.empreendimento,
            null::text as reserva_comercial_id,
            null::text as reserva_comercial_status,
            null::text as imovel_id,
            null::text as imovel_titulo,
            null::text as imovel_endereco,
            null::text as imovel_cidade,
            null::text as imovel_bairro,
            null::text as imovel_estado,
            null::text as imovel_status,
            null::text as simulacao_id,
            null::text as simulacao_status,
            null::numeric as simulacao_valor_imovel,
            null::numeric as simulacao_valor_total_operacao,
            null::numeric as simulacao_financiamento_caixa,
            null::numeric as simulacao_fgts,
            null::numeric as simulacao_subsidio,
            null::numeric as simulacao_entrada,
            p.cca_vinculado,
            p.observacao_analista,
            p.encaminhado_analista,
            p.created_at,
            p.updated_at,
            'processo_manual'::text as origem,
            true as tem_processo,
            {payload_campos_manuais}
          from maq_credito.processos p
          where nullif(trim(p.cliente), '') is not null
            and lower(trim(p.cliente)) not in ('cliente nao informado', 'cliente não informado')
            and not exists (
              select 1
              from {COMERCIAL_SCHEMA}.cliente c
              where p.reserva = c.identificador_cliente::text
                 or lower(trim(p.cliente)) = lower(trim(c.nome_completo))
            )
        ),
        carteira as (
          select * from clientes_comerciais
          union all
          select * from processos_avulsos
        )
    """


def processo_to_response(
    processo: dict[str, Any],
    include_details: bool = True,
    *,
    include_family: bool = False,
) -> ProcessoResponse:
    reserva = processo.get("reserva") or ""
    documentos: dict[str, str] = {}
    relacionamento: dict[str, str] = {}
    pendencias: dict[str, dict[str, Any]] = {}
    pendencias_historico: list[dict[str, Any]] = []
    uploads_cca: dict[str, dict[str, str]] = {}
    uploads_enviados: dict[str, bool] = {}
    uploads: list[dict[str, Any]] = []
    creditu: dict[str, str] = {}
    composicao_familiar: list[dict[str, Any]] = processo.get("composicao_familiar") or []
    perfil_override: dict[str, Any] = {}

    if include_details and bool(processo.get("tem_processo", True)):
        documentos = {row["documento_key"]: row["status"] for row in table_rows("documentos_status", reserva)}
        relacionamento = {row["relacionamento_key"]: row["status"] for row in table_rows("relacionamento_status", reserva)}
        pendencias = {row["documento_key"]: row for row in table_rows("documentos_pendencias", reserva)}
        pendencias_historico = table_rows("pendencias_historico", reserva)
        uploads = table_rows("uploads", reserva)
        uploads_cca = {
            row["documento_key"]: {"name": row["file_name"], "data": row["url"]}
            for row in uploads
            if row.get("documento_key") and row.get("grupo") in {"corretor", "gestor", "caixa", "cca"}
        }
        uploads_enviados = {row["documento_key"]: True for row in uploads if row.get("documento_key")}
        ensure_creditu_table()
        creditu_row = fetch_one(
            "select email_segundo_proponente, telefone_segundo_proponente from maq_credito.creditu_dados where reserva = %s",
            [reserva],
        )
        if creditu_row:
            creditu = {
                "email_segundo_proponente": creditu_row.get("email_segundo_proponente") or "",
                "telefone_segundo_proponente": creditu_row.get("telefone_segundo_proponente") or "",
            }
        if include_family and processo.get("cliente_id"):
            composicao_familiar = family_rows(processo.get("cliente_id"))
        perfil_override = perfil_documental_row(reserva)

    processo_calculo, composicao_calculo = aplicar_perfil_documental_override(
        processo,
        composicao_familiar,
        perfil_override,
    )

    perfil_documental, checklist_documental, kits_documentais = build_documentary_payload(
        {**processo_calculo, "composicao_familiar": composicao_calculo},
        documentos,
        pendencias,
        uploads,
        creditu=creditu,
    )

    return ProcessoResponse(
        reserva=reserva,
        cliente=processo.get("cliente"),
        cliente_id=processo.get("cliente_id"),
        cliente_cpf=processo.get("cliente_cpf"),
        cliente_email=processo.get("cliente_email"),
        cliente_telefone=processo.get("cliente_telefone"),
        cliente_cidade=processo.get("cliente_cidade"),
        cliente_estado=processo.get("cliente_estado"),
        origem=processo.get("origem"),
        tem_processo=bool(processo.get("tem_processo", True)),
        caixa=processo.get("caixa_status") or "reserva",
        agehab=processo.get("agehab_status") or "reserva",
        produto=processo.get("produto"),
        sinal=processo.get("sinal"),
        fiador=processo.get("fiador"),
        corretor=processo.get("corretor"),
        empreendimento=processo.get("empreendimento"),
        reserva_comercial_id=processo.get("reserva_comercial_id"),
        reserva_comercial_status=processo.get("reserva_comercial_status"),
        imovel_id=processo.get("imovel_id"),
        imovel_titulo=processo.get("imovel_titulo"),
        imovel_endereco=processo.get("imovel_endereco"),
        imovel_cidade=processo.get("imovel_cidade"),
        imovel_bairro=processo.get("imovel_bairro"),
        imovel_estado=processo.get("imovel_estado"),
        imovel_status=processo.get("imovel_status"),
        simulacao_id=processo.get("simulacao_id"),
        simulacao_status=processo.get("simulacao_status"),
        simulacao_valor_imovel=processo.get("simulacao_valor_imovel"),
        simulacao_valor_total_operacao=processo.get("simulacao_valor_total_operacao"),
        simulacao_financiamento_caixa=processo.get("simulacao_financiamento_caixa"),
        simulacao_fgts=processo.get("simulacao_fgts"),
        simulacao_subsidio=processo.get("simulacao_subsidio"),
        simulacao_entrada=processo.get("simulacao_entrada"),
        cca_vinculado=processo.get("cca_vinculado"),
        observacao_analista=processo.get("observacao_analista"),
        encaminhado_analista=bool(processo.get("encaminhado_analista")),
        cliente_cadastro=processo_calculo.get("cliente_cadastro") or {},
        reserva_comercial=processo.get("reserva_comercial") or {},
        imovel_detalhes=processo.get("imovel_detalhes") or {},
        simulacao_detalhes=processo.get("simulacao_detalhes") or {},
        simulacao_fechada=processo.get("simulacao_fechada") or {},
        composicao_familiar=composicao_calculo,
        perfil_documental=perfil_documental,
        perfil_documental_config=perfil_override,
        checklist_documental=checklist_documental,
        kits_documentais=kits_documentais,
        documentos=documentos,
        relacionamento=relacionamento,
        creditu=creditu,
        pendencias=pendencias,
        pendenciasHistorico=pendencias_historico,
        uploadsCca=uploads_cca,
        uploadsEnviados=uploads_enviados,
        temDocumentoEnviado=bool(uploads),
        sla=get_sla(reserva) if bool(processo.get("tem_processo", True)) else SlaResponse(),
    )


def ensure_creditu_table() -> None:
    execute(
        """
        create extension if not exists pgcrypto;

        create table if not exists maq_credito.creditu_dados (
          id uuid primary key default gen_random_uuid(),
          reserva text not null references maq_credito.processos(reserva) on delete cascade,
          email_segundo_proponente text,
          telefone_segundo_proponente text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (reserva)
        )
        """
    )


def documento_sort_key(row: dict[str, Any]) -> tuple[int, str, str]:
    key = row.get("documento_key") or ""
    group = row.get("grupo") or ""
    order = next((index for index, prefix in enumerate(DOCUMENT_ORDER) if key.startswith(prefix)), len(DOCUMENT_ORDER))
    return (order, key, group)


def upload_pdf_bytes(row: dict[str, Any]) -> bytes:
    return upload_bytes(row)


def merge_pdf_uploads(reserva: str, rows: list[dict[str, Any]]) -> FileResponse:
    pdf_uploads = sorted(
        [row for row in rows if (row.get("content_type") or "").lower() == "application/pdf"],
        key=documento_sort_key,
    )
    if not pdf_uploads:
        raise HTTPException(status_code=404, detail="Nenhum PDF encontrado para esta reserva.")

    writer = PdfWriter()
    for row in pdf_uploads:
        try:
            reader = PdfReader(BytesIO(upload_pdf_bytes(row)))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Nao foi possivel juntar o PDF: {row.get('file_name')}") from exc

    MERGED_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = MERGED_UPLOAD_ROOT / f"kit-documental-{safe_segment(reserva)}.pdf"
    with output_path.open("wb") as output:
        writer.write(output)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"KIT_DOCUMENTAL_RESERVA_{safe_segment(reserva)}.pdf",
    )


def merge_creditu_uploads(reserva: str, rows: list[dict[str, Any]]) -> FileResponse:
    creditu_order = [
        "documentos-creditu-tela-score-cliente",
        "documentos-creditu-rg-cpf-ou-cnh",
        "documentos-creditu-tela-score-segundo-proponente",
        "documentos-creditu-tela-aprovacao-creditu",
        "documentos-creditu-tela-sicaq-cliente",
    ]
    basic_order = [
        "documentos-do-proponente-identidade-e-cpf",
        "renda-formal-clt-vinculo-holerites",
        "renda-formal-clt-vinculo-renda-variavel",
        "renda-informal-autonomo-liberal-extrato-bancario",
        "aposentados-pensionistas-extrato-do-beneficio",
        "domesticos-contratacao-por-cpf-esocial",
        "documentos-do-proponente-comprovante-de-residencia",
        "documentos-do-proponente-comp-de-estado-civil",
    ]

    def select_by_prefixes(prefixes: list[str]) -> list[dict[str, Any]]:
        selected: list[dict[str, Any]] = []
        for prefix in prefixes:
            match = next(
                (
                    row
                    for row in rows
                    if (row.get("content_type") or "").lower() == "application/pdf"
                    and (row.get("documento_key") or "").startswith(prefix)
                    and row not in selected
                ),
                None,
            )
            if match:
                selected.append(match)
        return selected

    selected = select_by_prefixes(creditu_order)
    filename_prefix = "CREDITU"
    if not selected:
        selected = select_by_prefixes(basic_order)
        filename_prefix = "DOCUMENTOS_BASICOS_CREDITU"
    if not selected:
        raise HTTPException(status_code=404, detail="Não existem documentos disponíveis para download.")

    writer = PdfWriter()
    for row in selected:
        try:
            reader = PdfReader(BytesIO(upload_pdf_bytes(row)))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Nao foi possivel juntar o PDF: {row.get('file_name')}") from exc

    MERGED_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = MERGED_UPLOAD_ROOT / f"creditu-{safe_segment(reserva)}.pdf"
    with output_path.open("wb") as output:
        writer.write(output)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"{filename_prefix}_RESERVA_{safe_segment(reserva)}.pdf",
    )


def merge_kit_caixa_uploads(reserva: str, rows: list[dict[str, Any]]) -> FileResponse:
    kit_caixa_order = [
        ["documentos-do-proponente-identidade-e-cpf"],
        ["documentos-do-proponente-comp-de-estado-civil"],
        ["conjuge", "cônjuge", "conjuge-identidade", "conjuge-rg", "conjuge-cpf"],
        ["dependente-filhos-menores", "dependente-filhos-maiores"],
        ["documentos-do-proponente-comprovante-de-residencia"],
        ["renda-formal"],
        ["documentos-caixa-damp"],
        ["documentos-caixa-ficha-de-cadastro-caixa"],
        ["documentos-caixa-abertura-de-conta"],
        ["documentos-caixa-mo"],
        ["documentos-caixa-formulario-cartao", "documentos-caixa-proposta-cartao"],
        ["documentos-caixa-formulario-cheque-azul"],
    ]

    latest_by_key: dict[str, dict[str, Any]] = {}
    for row in rows:
        if (row.get("content_type") or "").lower() != "application/pdf":
            continue
        key = row.get("documento_key") or ""
        if not key:
            continue
        current = latest_by_key.get(key)
        if not current or str(row.get("created_at") or "") > str(current.get("created_at") or ""):
            latest_by_key[key] = row

    selected: list[dict[str, Any]] = []
    selected_keys: set[str] = set()
    for prefixes in kit_caixa_order:
        matches = sorted(
            [
                row
                for key, row in latest_by_key.items()
                if key not in selected_keys and any(key.startswith(prefix) for prefix in prefixes)
            ],
            key=lambda item: item.get("documento_key") or "",
        )
        for row in matches:
            selected.append(row)
            selected_keys.add(row.get("documento_key") or "")

    if not selected:
        raise HTTPException(status_code=404, detail="Não existem documentos do Kit Caixa disponíveis para download.")

    writer = PdfWriter()
    for row in selected:
        try:
            reader = PdfReader(BytesIO(upload_pdf_bytes(row)))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Nao foi possivel juntar o PDF: {row.get('file_name')}") from exc

    MERGED_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = MERGED_UPLOAD_ROOT / f"kit-caixa-{safe_segment(reserva)}.pdf"
    with output_path.open("wb") as output:
        writer.write(output)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"KIT_CAIXA_RESERVA_{safe_segment(reserva)}.pdf",
    )


def merge_kit_agehab_uploads(reserva: str, rows: list[dict[str, Any]]) -> FileResponse:
    kit_agehab_order = [
        "documentos-agehab-declaracao-de-endereco",
        "documentos-agehab-declaracao-renda-informal",
        "documentos-agehab-declaracao-de-nao-renda",
        "documentos-agehab-vinculo-3-anos",
        "documentos-agehab-checklist-agehab",
        "documentos-agehab-ficha-agehab",
    ]

    latest_by_key: dict[str, dict[str, Any]] = {}
    for row in rows:
        if (row.get("content_type") or "").lower() != "application/pdf":
            continue
        key = row.get("documento_key") or ""
        if not key or not any(key.startswith(prefix) for prefix in kit_agehab_order):
            continue
        current = latest_by_key.get(key)
        if not current or str(row.get("created_at") or "") > str(current.get("created_at") or ""):
            latest_by_key[key] = row

    selected: list[dict[str, Any]] = []
    selected_keys: set[str] = set()
    for prefix in kit_agehab_order:
        matches = sorted(
            [
                row
                for key, row in latest_by_key.items()
                if key not in selected_keys and key.startswith(prefix)
            ],
            key=lambda item: item.get("documento_key") or "",
        )
        for row in matches:
            selected.append(row)
            selected_keys.add(row.get("documento_key") or "")

    if not selected:
        raise HTTPException(status_code=404, detail="Não existem documentos do Kit AGEHAB disponíveis para download.")

    writer = PdfWriter()
    for row in selected:
        try:
            reader = PdfReader(BytesIO(upload_pdf_bytes(row)))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Nao foi possivel juntar o PDF: {row.get('file_name')}") from exc

    MERGED_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = MERGED_UPLOAD_ROOT / f"kit-agehab-{safe_segment(reserva)}.pdf"
    with output_path.open("wb") as output:
        writer.write(output)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"KIT_AGEHAB_RESERVA_{safe_segment(reserva)}.pdf",
    )


def row_matches_document_keys(row: dict[str, Any], documento_keys: list[str]) -> bool:
    key = str(row.get("documento_key") or "")
    if not key:
        return False
    normalized_keys = [str(item or "").strip() for item in documento_keys if str(item or "").strip()]
    return any(key.startswith(prefix) for prefix in normalized_keys)


def selected_upload_rows(rows: list[dict[str, Any]], documento_keys: list[str]) -> list[dict[str, Any]]:
    normalized_keys = [str(item or "").strip() for item in documento_keys if str(item or "").strip()]
    if not normalized_keys:
        return []
    return [row for row in rows if row_matches_document_keys(row, normalized_keys)]


def selected_upload_rows_for_kit(reserva: str, kit_id: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    processo = obter_processo(reserva)
    kits = processo.kits_documentais or {}
    documento_keys = ((kits.get(kit_id) or {}).get("documento_keys")) or []
    return selected_upload_rows(rows, documento_keys)


def merge_selected_uploads_pdf(reserva: str, kit_name: str, rows: list[dict[str, Any]]) -> FileResponse:
    pdf_uploads = sorted(
        [row for row in rows if (row.get("content_type") or "").lower() == "application/pdf"],
        key=documento_sort_key,
    )
    if not pdf_uploads:
        raise HTTPException(
            status_code=422,
            detail="O kit selecionado nao possui anexos em PDF. Baixe o pacote ZIP para levar todos os anexos.",
        )

    writer = PdfWriter()
    for row in pdf_uploads:
        try:
            reader = PdfReader(BytesIO(upload_pdf_bytes(row)))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Nao foi possivel juntar o PDF: {row.get('file_name')}",
            ) from exc

    MERGED_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = MERGED_UPLOAD_ROOT / f"kit-personalizado-{safe_segment(reserva)}-{safe_segment(kit_name)}.pdf"
    with output_path.open("wb") as output:
        writer.write(output)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"KIT_{safe_segment(kit_name).upper()}_{safe_segment(reserva)}.pdf",
    )


def zip_selected_uploads(reserva: str, kit_name: str, rows: list[dict[str, Any]]) -> FileResponse:
    if not rows:
        raise HTTPException(status_code=404, detail="Nao existem anexos para os documentos selecionados.")

    MERGED_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = MERGED_UPLOAD_ROOT / f"kit-personalizado-{safe_segment(reserva)}-{safe_segment(kit_name)}.zip"
    with ZipFile(output_path, "w", compression=ZIP_DEFLATED) as archive:
        for index, row in enumerate(sorted(rows, key=documento_sort_key), start=1):
            data = upload_bytes(row)
            doc_key = str(row.get("documento_key") or "documento")
            file_name = str(row.get("file_name") or f"arquivo-{index}")
            archive_name = f"{index:02d}-{safe_segment(doc_key)}-{safe_segment(file_name)}"
            archive.writestr(archive_name, data)

    return FileResponse(
        output_path,
        media_type="application/zip",
        filename=f"KIT_{safe_segment(kit_name).upper()}_{safe_segment(reserva)}.zip",
    )


def processos_event_signature(reserva: str | None = None) -> str:
    where = "where reserva = %s" if reserva else ""
    params = [reserva] if reserva else []
    row = fetch_one(
        f"""
        select concat_ws('|',
          coalesce((select max(updated_at)::text from maq_credito.processos {where}), ''),
          coalesce((select max(updated_at)::text from maq_credito.documentos_status {where}), ''),
          coalesce((select max(updated_at)::text from maq_credito.documentos_pendencias {where}), ''),
          coalesce((select max(created_at)::text from maq_credito.uploads {where}), ''),
          coalesce((select max(updated_at)::text from maq_credito.relacionamento_status {where}), ''),
          coalesce((select max(coalesce(data_hora_atualizado_em, data_hora_criacao))::text from {COMERCIAL_SCHEMA}.cliente), '')
        ) as signature
        """,
        params * 5,
    )
    return str(row.get("signature") if row else "")


@router.get("", response_model=list[ProcessoResponse])
def listar_processos(destino: str | None = None) -> list[ProcessoResponse]:
    where = ""
    params: list[Any] = []
    if destino == "analista":
        where = "where encaminhado_analista = true"
    elif destino == "cca":
        where = "where encaminhado_analista = true and caixa_status in (%s, %s, %s, %s)"
        params.extend(["emitindo_formularios", "formularios_em_assinatura", "formularios_assinados", "envio_conformidade"])

    rows = fetch_all(
        f"""
        {carteira_sql(include_payloads=False)}
        select * from carteira
        {where}
        order by updated_at desc nulls last, created_at desc nulls last, cliente
        """,
        params,
    )
    return [processo_to_response(row, include_details=True) for row in rows]


@router.get("/diagnosticos/gargalos", response_model=list[DiagnosticoProcessoResponse])
def diagnosticar_gargalos(sla_meta: int = 7, retrabalho_corte: int = 0) -> list[DiagnosticoProcessoResponse]:
    rows = fetch_all(
        """
        with eventos as (
          select
            id_cliente,
            status,
            lower(status) as status_norm,
            "timestamp" as evento_em,
            id_corretor
          from maq_credito.log_eventos
        ),
        marcos as (
          select
            id_cliente,
            min(evento_em) filter (where status = 'Reserva') as reserva_em,
            min(evento_em) filter (where status = 'Enviado para Conformidade') as conformidade_em
          from eventos
          group by id_cliente
        ),
        corretores as (
          select distinct on (id_cliente)
            id_cliente,
            id_corretor
          from eventos
          where id_corretor is not null
          order by id_cliente, evento_em desc
        ),
        retrabalhos as (
          select
            e.id_cliente,
            count(*)::int as qtd_retrabalho
          from eventos e
          where e.status in ('Formulários Em Assinatura', 'Ficha emitida')
            and exists (
              select 1
              from eventos inval
              where inval.id_cliente = e.id_cliente
                and inval.evento_em < e.evento_em
                and (
                  inval.status_norm like '%%invalid%%'
                  or inval.status_norm like '%%pendenc%%'
                  or inval.status_norm like '%%reprov%%'
                )
            )
          group by e.id_cliente
        )
        select
          m.id_cliente,
          c.id_corretor,
          round((extract(epoch from (m.conformidade_em - m.reserva_em)) / 86400)::numeric, 2)::float as "Lead_Time_Total",
          coalesce(r.qtd_retrabalho, 0) as "Qtd_Retrabalho",
          case
            when extract(epoch from (m.conformidade_em - m.reserva_em)) / 86400 > %s
             and coalesce(r.qtd_retrabalho, 0) > %s then 'Problema Documental'
            when extract(epoch from (m.conformidade_em - m.reserva_em)) / 86400 > %s
             and coalesce(r.qtd_retrabalho, 0) <= %s then 'Problema de Processo'
            else 'Processo Eficiente'
          end as "Diagnostico"
        from marcos m
        left join retrabalhos r on r.id_cliente = m.id_cliente
        left join corretores c on c.id_cliente = m.id_cliente
        where m.reserva_em is not null
          and m.conformidade_em is not null
        order by "Lead_Time_Total" desc, m.id_cliente
        """,
        [sla_meta, retrabalho_corte, sla_meta, retrabalho_corte],
    )
    return [DiagnosticoProcessoResponse(**row) for row in rows]


@router.get("/events")
async def processo_events(reserva: str | None = None) -> StreamingResponse:
    async def stream():
        last_signature = processos_event_signature(reserva)
        yield "event: ready\ndata: ok\n\n"
        while True:
            await asyncio.sleep(12)
            signature = processos_event_signature(reserva)
            if signature != last_signature:
                last_signature = signature
                yield "event: change\ndata: updated\n\n"
            else:
                yield "event: ping\ndata: ok\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/{reserva}", response_model=ProcessoResponse)
def obter_processo(reserva: str) -> ProcessoResponse:
    processo = fetch_one(
        f"""
        {carteira_sql(include_payloads=True)}
        select * from carteira
        where reserva = %s
           or cliente_id = %s
           or reserva_comercial_id = %s
        order by
          case
            when reserva = %s then 0
            when cliente_id = %s then 1
            when reserva_comercial_id = %s then 2
            else 3
          end,
          updated_at desc nulls last,
          created_at desc nulls last
        limit 1
        """,
        [reserva, reserva, reserva, reserva, reserva, reserva],
    )
    if processo:
        return processo_to_response(processo, include_family=True)

    processo_manual = fetch_one("select * from maq_credito.processos where reserva = %s", [reserva])
    if processo_manual:
        return processo_to_response({"tem_processo": True, **processo_manual}, include_family=True)

    return processo_to_response({"reserva": reserva, "tem_processo": False}, include_details=False)


@router.put("/{reserva}")
def atualizar_processo(reserva: str, payload: ProcessoUpdate) -> dict[str, Any]:
    values = payload.model_dump(exclude_none=True)
    if "caixa" in values:
        values["caixa_status"] = normalize(values.pop("caixa"), CAIXA_STATUS, "caixa")
    if "agehab" in values:
        values["agehab_status"] = normalize(values.pop("agehab"), AGEHAB_STATUS, "agehab")
    upsert_processo(reserva, values)
    start_sla(reserva)
    corretor = values.get("corretor")
    if values.get("encaminhado_analista"):
        registrar_evento(reserva, "Reserva", corretor)
    if values.get("caixa_status"):
        registrar_evento(reserva, EVENT_LABELS.get(values["caixa_status"], values["caixa_status"]), corretor)
    if values.get("agehab_status"):
        registrar_evento(reserva, EVENT_LABELS.get(values["agehab_status"], values["agehab_status"]), corretor)
    if values.get("caixa_status") == "envio_conformidade":
        stop_sla(reserva, "envio_conformidade")
    return {"ok": True, "reserva": reserva, "sla": get_sla(reserva).model_dump()}


@router.put("/{reserva}/perfil-documental")
def salvar_perfil_documental(reserva: str, payload: PerfilDocumentalPayload) -> dict[str, Any]:
    upsert_processo(reserva)
    ensure_perfil_documental_table()
    dados = {
        "estado_civil": clean_text(payload.estado_civil),
        "renda_conjuge": clean_money(payload.renda_conjuge),
        "conjuge": payload.conjuge if isinstance(payload.conjuge, dict) else {},
        "dependentes": payload.dependentes if isinstance(payload.dependentes, list) else [],
    }
    execute(
        """
        insert into maq_credito.perfil_documental (reserva, dados, updated_by, updated_role)
        values (%s, %s::jsonb, %s, %s)
        on conflict (reserva)
        do update set
          dados = excluded.dados,
          updated_by = excluded.updated_by,
          updated_role = excluded.updated_role,
          updated_at = now()
        """,
        [
            reserva,
            json.dumps(dados, ensure_ascii=False),
            payload.updated_by or "Usuario 7LM",
            normalize_actor_role(payload.updated_role),
        ],
    )
    registrar_evento(reserva, "Perfil documental atualizado", payload.updated_by)
    processo = obter_processo(reserva)
    return {"ok": True, "reserva": reserva, "processo": processo.model_dump()}


@router.post("/{reserva}/sla/start")
def iniciar_sla(reserva: str) -> dict[str, Any]:
    start_sla(reserva)
    return {"ok": True, "reserva": reserva, "sla": get_sla(reserva).model_dump()}


@router.post("/{reserva}/sla/stop")
def parar_sla(reserva: str) -> dict[str, Any]:
    stop_sla(reserva, "manual")
    return {"ok": True, "reserva": reserva, "sla": get_sla(reserva).model_dump()}


@router.put("/{reserva}/documentos/{documento_key}/pendencia")
def salvar_pendencia(reserva: str, documento_key: str, payload: PendenciaUpdate) -> dict[str, Any]:
    if prazo_no_passado(payload.prazo):
        raise HTTPException(status_code=400, detail="O prazo da pendencia nao pode ser anterior ao horario atual.")
    actor_role = normalize_actor_role(payload.actor_role)
    require_analyst_role(actor_role)
    upsert_processo(reserva)
    registrar_evento(reserva, "Pendencia documental", payload.origem)
    documento = payload.documento or documento_key
    registrar_historico_pendencia(
        reserva=reserva,
        documento_key=documento,
        descricao=payload.descricao,
        prazo=payload.prazo,
        origem=payload.origem,
        evento="criada",
    )
    execute(
        """
        insert into maq_credito.documentos_pendencias (reserva, documento_key, descricao, prazo, origem, destino_card)
        values (%s, %s, %s, %s, %s, %s)
        on conflict (reserva, documento_key)
        do update set
          descricao = excluded.descricao,
          prazo = excluded.prazo,
          origem = excluded.origem,
          destino_card = excluded.destino_card
        """,
        [reserva, documento, payload.descricao, payload.prazo, payload.origem, payload.destinoCard or "card1"],
    )
    execute(
        """
        insert into maq_credito.documentos_status (reserva, documento_key, status, updated_by)
        values (%s, %s, %s, %s)
        on conflict (reserva, documento_key)
        do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
        """,
        [reserva, documento, "Rejeitado", payload.origem or ANALYST_ROLE],
    )
    return {"ok": True, "reserva": reserva, "documento": documento_key, "card1Atualizado": True}


@router.put("/{reserva}/documentos/{documento_key}/nao-se-aplica")
def solicitar_nao_se_aplica(reserva: str, documento_key: str, payload: DocumentoUpdate) -> dict[str, Any]:
    actor_role = normalize_actor_role(getattr(payload, "updated_role", None))
    if actor_role != "corretor":
        raise HTTPException(
            status_code=403,
            detail="A solicitacao de nao se aplica deve ser feita pelo corretor.",
        )
    origem = payload.updated_by or actor_role
    descricao = "Corretor informou que este documento nao se aplica ao cliente. Analista deve validar."
    upsert_processo(reserva)
    registrar_evento(reserva, "Solicitacao de nao se aplica", origem)
    registrar_historico_pendencia(
        reserva=reserva,
        documento_key=documento_key,
        descricao=descricao,
        prazo=None,
        origem=origem,
        evento="nao_se_aplica_solicitado",
        status_documento=AUTO_PENDING_ANALYST_STATUS,
    )
    execute(
        """
        insert into maq_credito.documentos_pendencias (reserva, documento_key, descricao, prazo, origem, destino_card)
        values (%s, %s, %s, null, %s, %s)
        on conflict (reserva, documento_key)
        do update set
          descricao = excluded.descricao,
          prazo = excluded.prazo,
          origem = excluded.origem,
          destino_card = excluded.destino_card
        """,
        [reserva, documento_key, descricao, origem, "analista"],
    )
    execute(
        """
        insert into maq_credito.documentos_status (reserva, documento_key, status, updated_by)
        values (%s, %s, %s, %s)
        on conflict (reserva, documento_key)
        do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
        """,
        [reserva, documento_key, AUTO_PENDING_ANALYST_STATUS, origem],
    )
    return {
        "ok": True,
        "reserva": reserva,
        "documento": documento_key,
        "status": AUTO_PENDING_ANALYST_STATUS,
        "analistaValidar": True,
    }


@router.get("/{reserva}/messages", response_model=list[ChecklistMessageResponse])
def listar_mensagens_processo(reserva: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        select id::text, reserva, documento_key, author_name, author_role,
               coalesce(target_role, 'todos') as target_role, message,
               created_at::text, read_at::text
        from maq_credito.checklist_messages
        where reserva = %s
        order by created_at asc
        """,
        [reserva],
    )
    labels = {"analista": "Analista", "corretor": "Corretor", "gestor": "Gestor", "cca": "CCA", "todos": "Todos"}
    for row in rows:
        target_role = row.get("target_role") or "todos"
        row["targetRole"] = target_role
        row["targetLabel"] = labels.get(target_role, target_role.title())
    return rows


@router.get("/{reserva}/creditu")
def obter_creditu(reserva: str) -> dict[str, str]:
    if not reserva:
        raise HTTPException(status_code=400, detail="Reserva nao informada.")
    try:
        ensure_creditu_table()
        row = fetch_one(
            "select email_segundo_proponente, telefone_segundo_proponente from maq_credito.creditu_dados where reserva = %s",
            [reserva],
        )
    except Exception as exc:
        logger.exception("Erro ao buscar dados Creditú da reserva %s", reserva)
        raise HTTPException(status_code=500, detail=f"Erro ao buscar dados Creditú: {type(exc).__name__}: {exc}") from exc
    return {
        "email_segundo_proponente": (row or {}).get("email_segundo_proponente") or "",
        "telefone_segundo_proponente": (row or {}).get("telefone_segundo_proponente") or "",
    }


@router.put("/{reserva}/creditu")
def salvar_creditu(reserva: str, payload: CredituDadosPayload) -> dict[str, str]:
    if not reserva:
        raise HTTPException(status_code=400, detail="Reserva nao informada.")
    try:
        ensure_creditu_table()
        upsert_processo(reserva)
        atual = obter_creditu(reserva)
        email = payload.email_segundo_proponente if payload.email_segundo_proponente is not None else atual["email_segundo_proponente"]
        telefone = payload.telefone_segundo_proponente if payload.telefone_segundo_proponente is not None else atual["telefone_segundo_proponente"]
        row = fetch_one(
            """
            insert into maq_credito.creditu_dados (reserva, email_segundo_proponente, telefone_segundo_proponente)
            values (%s, %s, %s)
            on conflict (reserva)
            do update set
              email_segundo_proponente = excluded.email_segundo_proponente,
              telefone_segundo_proponente = excluded.telefone_segundo_proponente,
              updated_at = now()
            returning email_segundo_proponente, telefone_segundo_proponente
            """,
            [reserva, email, telefone],
        )
    except Exception as exc:
        logger.exception("Erro ao salvar dados Creditú da reserva %s", reserva)
        raise HTTPException(status_code=500, detail=f"Erro ao salvar dados Creditú: {type(exc).__name__}: {exc}") from exc
    return {
        "email_segundo_proponente": (row or {}).get("email_segundo_proponente") or "",
        "telefone_segundo_proponente": (row or {}).get("telefone_segundo_proponente") or "",
    }


@router.post("/{reserva}/messages", response_model=ChecklistMessageResponse)
def criar_mensagem_processo(
    reserva: str,
    payload: ChecklistMessageCreate,
) -> dict[str, Any]:
    mensagem = payload.message.strip()
    if not mensagem:
        raise HTTPException(status_code=400, detail="Mensagem obrigatoria.")
    target_role = (payload.targetRole or payload.target_role or "todos").strip().lower()
    if target_role not in {"analista", "corretor", "gestor", "cca", "todos"}:
        raise HTTPException(status_code=400, detail="Destinatario invalido.")
    upsert_processo(reserva)
    row = fetch_one(
        """
        insert into maq_credito.checklist_messages
          (reserva, documento_key, author_name, author_role, target_role, message)
        values (%s, %s, %s, %s, %s, %s)
        returning id::text, reserva, documento_key, author_name, author_role,
                  target_role, message,
                  created_at::text, read_at::text
        """,
        [reserva, payload.documento_key, payload.author_name.strip() or payload.author_role, payload.author_role, target_role, mensagem],
    )
    if not row:
        raise HTTPException(status_code=500, detail="Nao foi possivel salvar a mensagem.")
    labels = {"analista": "Analista", "corretor": "Corretor", "gestor": "Gestor", "cca": "CCA", "todos": "Todos"}
    row["targetRole"] = row.get("target_role") or "todos"
    row["targetLabel"] = labels.get(row["targetRole"], row["targetRole"].title())
    return row


@router.put("/{reserva}/documentos/{documento_key}")
def atualizar_documento(reserva: str, documento_key: str, payload: DocumentoUpdate) -> dict[str, Any]:
    status = normalize(payload.status, DOCUMENTO_STATUS, "status")
    actor_role = normalize_actor_role(payload.updated_role)
    require_analyst_role(actor_role)
    upsert_processo(reserva)
    registrar_evento(reserva, status, payload.updated_by)
    execute(
        """
        insert into maq_credito.documentos_status (reserva, documento_key, status, updated_by)
        values (%s, %s, %s, %s)
        on conflict (reserva, documento_key)
        do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
        """,
        [reserva, documento_key, status, payload.updated_by],
    )
    if status not in {"Pendente", "Rejeitado", AUTO_PENDING_ANALYST_STATUS}:
        pendencia = fetch_one(
            "select * from maq_credito.documentos_pendencias where reserva = %s and documento_key = %s",
            [reserva, documento_key],
        )
        if pendencia:
            registrar_historico_pendencia(
                reserva=reserva,
                documento_key=documento_key,
                descricao=pendencia.get("descricao") or "",
                prazo=pendencia.get("prazo"),
                origem=payload.updated_by,
                evento="tratada",
                status_documento=status,
            )
        execute(
            "delete from maq_credito.documentos_pendencias where reserva = %s and documento_key = %s",
            [reserva, documento_key],
        )
    return {"ok": True, "reserva": reserva, "documento": documento_key, "status": status}


@router.put("/{reserva}/relacionamento/{relacionamento_key}")
def atualizar_relacionamento(
    reserva: str,
    relacionamento_key: str,
    payload: RelacionamentoUpdate,
) -> dict[str, Any]:
    status = normalize(payload.status, RELACIONAMENTO_STATUS, "status")
    upsert_processo(reserva)
    execute(
        """
        insert into maq_credito.relacionamento_status (reserva, relacionamento_key, status, updated_by)
        values (%s, %s, %s, %s)
        on conflict (reserva, relacionamento_key)
        do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
        """,
        [reserva, relacionamento_key, status, payload.updated_by],
    )
    return {"ok": True, "reserva": reserva, "relacionamento": relacionamento_key, "status": status}


@router.get("/{reserva}/uploads", response_model=None)
def listar_uploads(reserva: str, grupo: str | None = None, merge: str | None = None) -> Any:
    params: list[Any] = [reserva]
    where = "where reserva = %s"
    if grupo:
        where += " and grupo = %s"
        params.append(grupo)
    rows = fetch_all(f"select * from maq_credito.uploads {where} order by created_at desc", params)
    if merge == "1":
        return merge_pdf_uploads(reserva, rows)

    uploads = [{"key": row["documento_key"], "name": row["file_name"], "url": row["url"]} for row in rows]
    return {
        "temAnexoCaixa": bool(uploads),
        "temDocumentoEnviado": bool(uploads),
        "uploads": uploads,
    }


@router.get("/{reserva}/creditu/download", response_model=None)
def baixar_creditu(reserva: str) -> FileResponse:
    rows = fetch_all(
        "select * from maq_credito.uploads where reserva = %s order by created_at desc",
        [reserva],
    )
    selected_rows = selected_upload_rows_for_kit(reserva, "creditu", rows)
    if not selected_rows:
        raise HTTPException(status_code=404, detail="Nao existem documentos do Kit Creditu disponiveis para download.")
    return merge_selected_uploads_pdf(reserva, "kit-creditu", selected_rows)


@router.get("/{reserva}/kit-caixa/download", response_model=None)
def baixar_kit_caixa(reserva: str) -> FileResponse:
    rows = fetch_all(
        "select * from maq_credito.uploads where reserva = %s order by created_at desc",
        [reserva],
    )
    selected_rows = selected_upload_rows_for_kit(reserva, "caixa", rows)
    if not selected_rows:
        raise HTTPException(status_code=404, detail="Nao existem documentos do Kit Caixa disponiveis para download.")
    return merge_selected_uploads_pdf(reserva, "kit-caixa", selected_rows)


@router.get("/{reserva}/kit-agehab/download", response_model=None)
def baixar_kit_agehab(reserva: str) -> FileResponse:
    rows = fetch_all(
        "select * from maq_credito.uploads where reserva = %s order by created_at desc",
        [reserva],
    )
    selected_rows = selected_upload_rows_for_kit(reserva, "agehab", rows)
    if not selected_rows:
        raise HTTPException(status_code=404, detail="Nao existem documentos do Kit Agehab disponiveis para download.")
    return merge_selected_uploads_pdf(reserva, "kit-agehab", selected_rows)


@router.post("/{reserva}/kits/download", response_model=None)
def baixar_kit_personalizado(reserva: str, payload: KitDownloadPayload) -> FileResponse:
    documento_keys = [str(item or "").strip() for item in payload.documento_keys if str(item or "").strip()]
    if not documento_keys:
        raise HTTPException(status_code=400, detail="Selecione pelo menos um documento para gerar o kit.")

    rows = fetch_all(
        "select * from maq_credito.uploads where reserva = %s order by created_at desc",
        [reserva],
    )
    selected_rows = selected_upload_rows(rows, documento_keys)
    if not selected_rows:
        raise HTTPException(status_code=404, detail="Nao existem anexos para os documentos selecionados.")

    kit_name = str(payload.nome or "kit-personalizado").strip() or "kit-personalizado"
    formato = str(payload.formato or "pdf").strip().lower()
    if formato == "zip":
        return zip_selected_uploads(reserva, kit_name, selected_rows)
    return merge_selected_uploads_pdf(reserva, kit_name, selected_rows)


@router.post("/{reserva}/uploads")
async def criar_upload(reserva: str, request: Request) -> dict[str, Any]:
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise HTTPException(status_code=400, detail="Arquivo nao enviado.")
        grupo = str(form.get("grupo") or "corretor")
        documento_key = str(form.get("key") or form.get("documento_key") or file.filename)
        file_name = str(form.get("name") or file.filename)
        content = await file.read()
        file_content_type = file.content_type or "application/octet-stream"
        created_by = str(form.get("created_by") or "") or None
        actor_role = normalize_actor_role(str(form.get("actor_role") or grupo))
    else:
        payload = UploadJsonPayload.model_validate(await request.json())
        grupo = payload.grupo
        documento_key = payload.key
        file_name = payload.name
        content, file_content_type = parse_data_url(payload.data)
        created_by = payload.created_by
        actor_role = normalize_actor_role(grupo)

    safe_name = safe_segment(file_name)
    storage_path = f"{safe_segment(reserva)}/{safe_segment(grupo)}/{safe_segment(documento_key)}-{safe_name}"
    storage_backend = "local"
    save_local_upload(storage_path, content)
    url = fallback_upload_url(reserva, storage_path)

    upsert_processo(reserva)
    start_sla(reserva)
    execute(
        """
        insert into maq_credito.uploads
          (reserva, grupo, documento_key, file_name, storage_path, url, content_type, created_by)
        values (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        [reserva, grupo, documento_key, file_name, storage_path, url, file_content_type, created_by],
    )
    execute(
        """
        insert into maq_credito.documentos_status (reserva, documento_key, status, updated_by)
        values (%s, %s, %s, %s)
        on conflict (reserva, documento_key)
        do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
        """,
        [
            reserva,
            documento_key,
            AUTO_PENDING_ANALYST_STATUS,
            created_by or actor_role,
        ],
    )
    execute(
        "delete from maq_credito.documentos_pendencias where reserva = %s and documento_key = %s",
        [reserva, documento_key],
    )

    return {"ok": True, "key": documento_key, "name": file_name, "url": url, "storage": storage_backend, "temDocumentoEnviado": True}


@router.get("/{reserva}/uploads/{storage_name:path}", response_model=None)
def abrir_upload_local(reserva: str, storage_name: str) -> FileResponse:
    row = fetch_one(
        """
        select file_name, storage_path, content_type
        from maq_credito.uploads
        where reserva = %s and storage_path = %s
        order by created_at desc
        limit 1
        """,
        [reserva, storage_name],
    )
    if not row:
        row = fetch_one(
            """
            select file_name, storage_path, content_type
            from maq_credito.uploads
            where reserva = %s and replace(storage_path, '/', '-') = %s
            order by created_at desc
            limit 1
            """,
            [reserva, storage_name],
        )
    if not row:
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    path = local_upload_path(row["storage_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Arquivo local nao encontrado.")

    return FileResponse(
        path,
        media_type=row.get("content_type") or "application/octet-stream",
        filename=row.get("file_name") or path.name,
    )


@router.delete("/{reserva}/uploads")
def remover_uploads(
    reserva: str,
    grupo: str | None = None,
    documento_key: str | None = None,
    url: str | None = None,
    storage_path: str | None = None,
) -> Response:
    params: list[Any] = [reserva]
    where = "where reserva = %s"
    if grupo:
        where += " and grupo = %s"
        params.append(grupo)
    if documento_key:
        where += " and documento_key = %s"
        params.append(documento_key)
    if url:
        where += " and url = %s"
        params.append(url)
    if storage_path:
        where += " and storage_path = %s"
        params.append(storage_path)
    rows = fetch_all(f"select * from maq_credito.uploads {where}", params)
    if not rows:
        raise HTTPException(status_code=404, detail="Anexo nao encontrado para exclusao.")

    paths = [row["storage_path"] for row in rows if row.get("storage_path")]
    affected_keys = sorted({row["documento_key"] for row in rows if row.get("documento_key")})
    remove_from_storage(paths)

    execute(f"delete from maq_credito.uploads {where}", params)
    for key in affected_keys:
        remaining = fetch_one(
            """
            select 1
            from maq_credito.uploads
            where reserva = %s and documento_key = %s
            limit 1
            """,
            [reserva, key],
        )
        if not remaining:
            execute(
                """
                insert into maq_credito.documentos_status (reserva, documento_key, status, updated_by)
                values (%s, %s, %s, %s)
                on conflict (reserva, documento_key)
                do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
                """,
                [reserva, key, "Aguardando", ANALYST_ROLE],
            )
    return Response(status_code=204)

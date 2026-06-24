"""
Rotas do modulo de comissionamento.
"""

from __future__ import annotations

from typing import Any, Iterable

from decimal import Decimal
from datetime import date
import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field

from configuracoes import ESQUEMA_BANCO, ESQUEMA_COMISSIONAMENTO
from dependencias import obter_usuario_autenticado
from repositorios.comissionamento import (
    atualizar_status_resultado,
    buscar_preview_ciclo,
    buscar_resposta_idempotente,
    buscar_resultado_por_id,
    buscar_resultado_linha,
    obter_configuracao_ciclo,
    registrar_evento_comissionamento,
    salvar_documento_nf,
    salvar_configuracao_ciclo,
    salvar_resposta_idempotente,
    serializar_linha_resultado,
    listar_ciclos,
    listar_eventos_auditoria_comissionamento,
    gerar_snapshot_hierarquia_ciclo,
    salvar_publicacao_regra,
)
from repositorios.notificacoes_comissionamento import (
    listar_historico_envios,
    listar_notificacoes_usuario,
    listar_regras_escalonamento,
    marcar_destinatario_lido,
)
from servicos.comissionamento_preview import INDICADORES_CONFIGURAVEIS, listar_regras_rascunho
from servicos.notificacoes_comissionamento import (
    criar_notificacao_de_acao,
    criar_notificacao_manual,
    listar_templates_ou_erro,
    montar_anexo_pdf_transiente,
    preparar_reenvio,
    processar_fila,
    processar_filas_especificas,
    renderizar_template,
    salvar_template_configurado,
    testar_provider_seguro,
)
from utilitarios.auditoria import registrar_evento
from utilitarios.autorizacao import exigir_permissao_portal, usuario_possui_permissao


rotas_de_comissionamento = APIRouter()


class CorpoAcaoComissionamento(BaseModel):
    motivo: str | None = Field(default=None, max_length=500)
    observacao: str | None = Field(default=None, max_length=1000)
    comentario: str | None = Field(default=None, max_length=1000)
    idempotency_key: str | None = Field(default=None, max_length=120)


class CorpoRascunhoRegra(BaseModel):
    regra_01: dict[str, Any] = Field(default_factory=dict)
    regra_02: dict[str, Any] = Field(default_factory=dict)
    observacao: str | None = Field(default=None, max_length=1000)
    idempotency_key: str | None = Field(default=None, max_length=120)


class CorpoPublicacaoRegra(BaseModel):
    motivo: str | None = Field(default=None, max_length=500)
    comentario: str | None = Field(default=None, max_length=1000)
    ciclo_id: str | None = Field(default=None, max_length=20)
    comissionado_id: str | None = Field(default=None, max_length=120)
    comissionado_nome: str | None = Field(default=None, max_length=200)
    regra_tipo: str | None = Field(default=None, max_length=40)
    regra_01: dict[str, Any] = Field(default_factory=dict)
    regra_02: dict[str, Any] = Field(default_factory=dict)
    regra_02_ips: list[dict[str, Any]] = Field(default_factory=list)
    regra_02_ips_removidos: list[str] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=120)


class CorpoPreviewNotificacao(BaseModel):
    template_codigo: str = Field(max_length=120)
    template_versao: int | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class DestinatarioNotificacao(BaseModel):
    email: str = Field(max_length=255)
    nome: str | None = Field(default=None, max_length=200)
    perfil: str | None = Field(default="allowlist_teste", max_length=80)


class CorpoManualNotificacao(BaseModel):
    template_codigo: str = Field(max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)
    destinatarios: list[DestinatarioNotificacao] = Field(default_factory=list)
    comentario: str | None = Field(default=None, max_length=1000)
    idempotency_key: str | None = Field(default=None, max_length=120)


class CorpoTemplateNotificacao(BaseModel):
    codigo: str = Field(max_length=120)
    versao: int = 1
    canal: str = Field(default="email", max_length=40)
    assunto: str = Field(max_length=255)
    titulo: str = Field(max_length=255)
    corpo_html: str
    corpo_texto: str
    cta_label: str | None = Field(default=None, max_length=120)
    cta_url_template: str | None = Field(default=None, max_length=500)
    variaveis_obrigatorias: list[str] = Field(default_factory=list)
    politica_mascaramento: dict[str, Any] = Field(default_factory=dict)
    ativo: bool = True


class CorpoConfiguracaoCiclo(BaseModel):
    objetivo_repasse_geral: float = Field(default=0, ge=0)
    payload: dict[str, Any] = Field(default_factory=dict)


class CorpoProcessarFila(BaseModel):
    limite: int = Field(default=25, ge=1, le=100)


class CorpoRegrasNotificacao(BaseModel):
    regras: list[dict[str, Any]] = Field(default_factory=list)


TIPOS_COMISSAO_VALIDOS = {"numero", "percentual", "decimal", "moeda"}

CONFIG_COMISSIONAMENTO = {
    "status": {
        "calculado": {"label": "Calculada", "tone": "warning"},
        "pendente_secretaria": {"label": "Em revisão pela Secretaria", "tone": "warning"},
        "aprovado_secretaria": {"label": "Aguardando aprovação comercial", "tone": "info"},
        "pendente_marcelo": {"label": "Aguardando aprovação comercial", "tone": "info"},
        "aprovado_marcelo": {"label": "Aprovada pela Diretoria Comercial", "tone": "ok"},
        "pendente_nf": {"label": "Aguardando NF", "tone": "warning"},
        "nf_recebida": {"label": "NF recebida", "tone": "ok"},
        "nao_aplicavel": {"label": "Não se aplica", "tone": "neutral"},
        "pronto_financeiro": {"label": "Pagamento", "tone": "info"},
        "enviado_financeiro": {"label": "Enviada para pagamento", "tone": "info"},
        "nao_pago": {"label": "Aguardando pagamento", "tone": "neutral"},
        "pago": {"label": "Paga", "tone": "ok"},
    },
    "stages": {
        "secretaria": {"label": "Calculada/Revisão"},
        "head": {"label": "Aprovação Comercial"},
        "nf": {"label": "Aguardando NF"},
        "pagamento": {"label": "Pagamento"},
    },
    "types": {
        "PJ_AUTONOMO": {"label": "PJ/autônomo", "exige_nf": True, "destino": "Financeiro"},
        "AUTONOMO": {"label": "Autônomo", "exige_nf": True, "destino": "Financeiro"},
        "PJ": {"label": "PJ", "exige_nf": True, "destino": "Financeiro"},
        "CLT": {"label": "CLT", "exige_nf": False, "destino": "RH e Financeiro"},
    },
    "indicators": list(INDICADORES_CONFIGURAVEIS),
}


def _obter_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponível.")
    return pool


async def _exigir_qualquer_permissao(
    conexao,
    identificador_usuario: str,
    permissoes: Iterable[str],
    detalhe: str,
) -> None:
    for permissao in permissoes:
        if await usuario_possui_permissao(conexao, identificador_usuario, permissao):
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detalhe)


PERMISSOES_COMISSIONAMENTO_BASICO = (
    "comissionamento.view.own",
    "comissionamento.view.all",
    "comissionamento.secretaria",
    "comissionamento.aprovar.head",
)

PERMISSOES_COMISSIONAMENTO_GERAL = (
    "comissionamento.view.all",
    "comissionamento.secretaria",
    "comissionamento.aprovar.head",
)

PERMISSOES_COMISSIONAMENTO_SECRETARIA = (
    "comissionamento.secretaria",
    "comissionamento.regras.manage",
)

PERMISSOES_COMISSIONAMENTO_HISTORICO = (
    "comissionamento.historico.view",
    "comissionamento.secretaria",
)


def _idempotency_key(request: Request, corpo: CorpoAcaoComissionamento | None = None) -> str | None:
    return request.headers.get("Idempotency-Key") or request.headers.get("idempotency-key") or getattr(corpo, "idempotency_key", None)


def _comentario(corpo: CorpoAcaoComissionamento | None) -> str | None:
    return (corpo.comentario or corpo.observacao or corpo.motivo) if corpo else None


def _nome_usuario_autenticado(usuario, email: str | None = None) -> str:
    return (
        usuario.get("nome")
        or usuario.get("nome_completo")
        or usuario.get("nome_usuario")
        or usuario.get("login")
        or (email or "").split("@", 1)[0].replace(".", " ").title()
        or "Usuário do portal"
    )


def _perfil_usuario_autenticado(usuario) -> str:
    perfis = usuario.get("perfis") or usuario.get("perfis_portal") or usuario.get("perfil") or usuario.get("perfil_nome")
    if isinstance(perfis, list):
        return ", ".join(str(item) for item in perfis if item) or "Portal"
    return str(perfis or "Portal")


def _cliente_ip(request: Request) -> str:
    return request.client.host if request.client else ""


def _agente_usuario(request: Request) -> str:
    return request.headers.get("user-agent", "")


async def _email_usuario_autenticado(conexao, usuario) -> str | None:
    linha = await conexao.fetchrow(
        f"""
        select correio_eletronico::text as email
        from {ESQUEMA_BANCO}.usuario
        where identificador_usuario = $1::uuid
        """,
        usuario.get("identificador_usuario"),
    )
    return str((linha or {}).get("email") or "").strip().lower() or None


async def _validar_resultado_proprio(conexao, usuario, resultado: dict[str, Any]) -> None:
    linha = await conexao.fetchrow(
        f"""
        select
            nome_completo,
            correio_eletronico::text as correio_eletronico
        from {ESQUEMA_BANCO}.usuario
        where identificador_usuario = $1::uuid
        """,
        usuario.get("identificador_usuario"),
    )
    nome_usuario = " ".join(str((linha or {}).get("nome_completo") or "").strip().lower().split())
    email_usuario = str((linha or {}).get("correio_eletronico") or "").strip().lower()
    nome_resultado = " ".join(str(resultado.get("nome") or "").strip().lower().split())
    email_resultado = str(resultado.get("email") or resultado.get("correio_eletronico") or "").strip().lower()
    if nome_usuario and nome_usuario == nome_resultado:
        return
    if email_usuario and email_resultado and email_usuario == email_resultado:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você só pode acessar a sua própria comissão.")


def _validar_transicao(condicao: bool, mensagem: str) -> None:
    if not condicao:
        raise HTTPException(status_code=409, detail=mensagem)


def _eh_clt(resultado: dict[str, Any]) -> bool:
    texto = f"{resultado.get('tipo_comissionado') or ''} {resultado.get('funcao') or ''}".upper()
    return "CLT" in texto or "CTL" in texto or not bool(resultado.get("exige_nf", True))


SECRETARIA_STATUSES = {"calculado_seed", "calculado", "pendente_secretaria", "calculada", "em_revisao_secretaria", "revisao_necessaria", "rejeitada"}

FAIXAS_REGRA_01_REPASSE = (
    {"rotulo": "0% a 39,99%", "minimo": Decimal("0"), "maximo": Decimal("39.99")},
    {"rotulo": "40% a 59,99%", "minimo": Decimal("40"), "maximo": Decimal("59.99")},
    {"rotulo": "60% a 79,99%", "minimo": Decimal("60"), "maximo": Decimal("79.99")},
    {"rotulo": "80% a 94,99%", "minimo": Decimal("80"), "maximo": Decimal("94.99")},
    {"rotulo": "95% a 104,99%", "minimo": Decimal("95"), "maximo": Decimal("104.99")},
    {"rotulo": "105% a 109,99%", "minimo": Decimal("105"), "maximo": Decimal("109.99")},
    {"rotulo": "110% a 114,99%", "minimo": Decimal("110"), "maximo": Decimal("114.99")},
    {"rotulo": "115% a 119,99%", "minimo": Decimal("115"), "maximo": Decimal("119.99")},
    {"rotulo": "120% a 129,99%", "minimo": Decimal("120"), "maximo": Decimal("129.99")},
    {"rotulo": "130% a 139,99%", "minimo": Decimal("130"), "maximo": Decimal("139.99")},
    {"rotulo": "+ que 140%", "minimo": Decimal("140"), "maximo": None},
)


def _formatar_valor_regra(valor: Any) -> str:
    if valor is None or valor == "":
        return "-"
    if isinstance(valor, bool):
        return "sim" if valor else "não"
    if isinstance(valor, Decimal):
        return str(valor)
    if isinstance(valor, (int, float, str)):
        return str(valor)
    return json.dumps(valor, ensure_ascii=False, sort_keys=True)


def _formatar_moeda_regra(valor: Any) -> str:
    if valor is None or valor == "":
        return "-"
    try:
        if isinstance(valor, (int, float, Decimal)):
            numero = Decimal(str(valor))
        else:
            texto_valor = str(valor).replace("R$", "").strip()
            if "," in texto_valor:
                texto_valor = texto_valor.replace(".", "").replace(",", ".")
            numero = Decimal(texto_valor)
    except Exception:
        return _formatar_valor_regra(valor)
    texto = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def _formatar_percentual_regra(valor: Any) -> str:
    if valor is None or valor == "":
        return "-"
    try:
        numero = Decimal(str(valor).replace("%", "").replace(",", ".").strip())
    except Exception:
        return _formatar_valor_regra(valor)
    texto = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".").rstrip("0").rstrip(",")
    return f"{texto}%"


def _decimal_regra(valor: Any) -> Decimal:
    if valor in (None, ""):
        return Decimal("0")
    try:
        if isinstance(valor, (int, float, Decimal)):
            return Decimal(str(valor))
        texto = str(valor).replace("R$", "").strip()
        if "," in texto:
            texto = texto.replace(".", "").replace(",", ".")
        return Decimal(texto)
    except Exception:
        return Decimal("0")


def _numero_json(valor: Decimal) -> float:
    return float(valor.quantize(Decimal("0.01")))


def _faixa_aplicada_repasse(percentual: Decimal) -> str:
    for faixa in FAIXAS_REGRA_01_REPASSE:
        maximo = faixa["maximo"]
        if percentual >= faixa["minimo"] and (maximo is None or percentual <= maximo):
            return str(faixa["rotulo"])
    return str(FAIXAS_REGRA_01_REPASSE[0]["rotulo"])


def _faixas_recalculadas_repasse(
    faixas_atuais: list[dict[str, Any]] | None,
    *,
    objetivo: Decimal,
    realizado: Decimal,
    faixa_aplicada: str,
) -> list[dict[str, Any]]:
    faixas_por_rotulo = {
        str(faixa.get("rotulo") or faixa.get("label") or faixa.get("id") or ""): faixa
        for faixa in (faixas_atuais or [])
        if isinstance(faixa, dict)
    }
    recalculadas = []
    for posicao, faixa_base in enumerate(FAIXAS_REGRA_01_REPASSE, start=1):
        rotulo = str(faixa_base["rotulo"])
        atual = dict(faixas_por_rotulo.get(rotulo) or {})
        minimo = faixa_base["minimo"]
        maximo = faixa_base["maximo"]
        necessario_minimo = objetivo * minimo / Decimal("100") if objetivo > 0 else Decimal("0")
        necessario_maximo = objetivo * maximo / Decimal("100") if objetivo > 0 and maximo is not None else None
        atual.update({
            "id": atual.get("id") or f"faixa_{posicao}",
            "rotulo": rotulo,
            "percentual_minimo": _numero_json(minimo),
            "percentual_maximo": _numero_json(maximo) if maximo is not None else 999,
            "realizado_atual": _numero_json(realizado),
            "objetivo_base": _numero_json(objetivo),
            "necessario_minimo": _numero_json(necessario_minimo),
            "necessario_maximo": None if necessario_maximo is None else _numero_json(necessario_maximo),
            "faltam_para_minimo": _numero_json(max(necessario_minimo - realizado, Decimal("0"))),
            "valor_bonus": atual.get("valor_bonus", atual.get("valor_faixa", 0)) or 0,
            "valor_faixa": atual.get("valor_faixa", atual.get("valor_bonus", 0)) or 0,
            "ativa": rotulo == faixa_aplicada,
        })
        recalculadas.append(atual)
    return recalculadas


def _recalcular_regra_01_objetivo(regra: Any, objetivo_repasse_geral: Any) -> dict[str, Any]:
    if isinstance(regra, str):
        try:
            regra = json.loads(regra)
        except Exception:
            regra = {}
    regra = dict(regra or {})
    objetivo = _decimal_regra(objetivo_repasse_geral)
    realizado = _decimal_regra(regra.get("realizado"))
    percentual = ((realizado / objetivo) * Decimal("100")).quantize(Decimal("0.01")) if objetivo > 0 else Decimal("0")
    faixa_aplicada = _faixa_aplicada_repasse(percentual)
    regra.update({
        "indicador": regra.get("indicador") or "repasses",
        "objetivo": _numero_json(objetivo),
        "realizado": _numero_json(realizado),
        "percentual_atingimento": _numero_json(percentual),
        "faixa_aplicada": faixa_aplicada,
        "faixas": _faixas_recalculadas_repasse(
            regra.get("faixas") if isinstance(regra.get("faixas"), list) else [],
            objetivo=objetivo,
            realizado=realizado,
            faixa_aplicada=faixa_aplicada,
        ),
    })
    return regra


async def _recalcular_regras_01_ciclo(conexao, ciclo_id: str, objetivo_repasse_geral: Any) -> int:
    linhas = await conexao.fetch(
        f"""
        select regra_publicada_id, regra_01, payload
        from {ESQUEMA_COMISSIONAMENTO}.regras_publicadas
        where ciclo_id = $1
          and regra_tipo = 'regra_01'
          and ativo is true
        """,
        ciclo_id,
    )
    for linha in linhas:
        regra_01 = _recalcular_regra_01_objetivo(linha["regra_01"], objetivo_repasse_geral)
        payload = linha["payload"] or {}
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        payload = dict(payload or {})
        payload["regra_01"] = regra_01
        await conexao.execute(
            f"""
            update {ESQUEMA_COMISSIONAMENTO}.regras_publicadas
            set regra_01 = $2::jsonb,
                payload = $3::jsonb
            where regra_publicada_id = $1
            """,
            linha["regra_publicada_id"],
            json.dumps(regra_01),
            json.dumps(payload),
        )
    return len(linhas)


def _valor_bonus_faixa(faixa: dict[str, Any] | None) -> Any:
    if not isinstance(faixa, dict):
        return None
    for chave in ("valor_bonus", "bonus", "valor", "valor_calculado"):
        if faixa.get(chave) not in (None, ""):
            return faixa.get(chave)
    return None


def _regra_01_dados(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    regra = payload.get("regra_01") if isinstance(payload.get("regra_01"), dict) else payload
    if isinstance(regra.get("regra_01"), dict):
        regra = regra["regra_01"]
    if isinstance(payload.get("regra_01"), list) and payload["regra_01"]:
        regra = payload["regra_01"][0]
    faixas = regra.get("faixas") if isinstance(regra, dict) else []
    faixas = faixas if isinstance(faixas, list) else []
    faixa_aplicada = regra.get("faixa_aplicada") or regra.get("faixa") or regra.get("rotulo")
    faixa_ativa = None
    if faixa_aplicada:
        faixa_ativa = next((
            faixa for faixa in faixas
            if isinstance(faixa, dict)
            and str(faixa.get("rotulo") or faixa.get("label") or faixa.get("id") or "").strip() == str(faixa_aplicada).strip()
        ), None)
    if not faixa_ativa:
        faixa_ativa = next((faixa for faixa in faixas if isinstance(faixa, dict) and faixa.get("ativa")), None)
    if not faixa_aplicada and faixa_ativa:
        faixa_aplicada = faixa_ativa.get("rotulo") or faixa_ativa.get("label") or faixa_ativa.get("id")
    return {
        "faixa": faixa_aplicada,
        "valor": _valor_bonus_faixa(faixa_ativa) or regra.get("valor_bonus") or regra.get("valor_calculado"),
        "objetivo": regra.get("objetivo"),
        "realizado": regra.get("realizado"),
        "percentual": regra.get("percentual_atingimento") or regra.get("percentual"),
    }


def _bonus_ips_total(payload: dict[str, Any] | None) -> Any:
    payload = payload or {}
    valores = payload.get("valores") if isinstance(payload.get("valores"), dict) else {}
    if valores.get("bonus_ips") not in (None, ""):
        return valores.get("bonus_ips")
    ips = payload.get("regra_02_ips") or payload.get("ips") or []
    if not isinstance(ips, list):
        return None
    total = Decimal("0")
    encontrou = False
    for ip in ips:
        if not isinstance(ip, dict):
            continue
        if ip.get("valor_bonus") in (None, ""):
            continue
        try:
            total += Decimal(str(ip.get("valor_bonus")))
            encontrou = True
        except Exception:
            continue
    return total if encontrou else None


def _resumo_valores_comissao(depois: dict[str, Any]) -> list[str]:
    linhas = []
    if depois.get("valor_bruto") not in (None, ""):
        linhas.append(f"- Bruto agora: {_formatar_moeda_regra(depois.get('valor_bruto'))}")
    bonus_ips = _bonus_ips_total(depois)
    if bonus_ips not in (None, ""):
        linhas.append(f"- Bônus IPs agora: {_formatar_moeda_regra(bonus_ips)}")
    if depois.get("valor_liquido") not in (None, ""):
        linhas.append(f"- Líquido agora: {_formatar_moeda_regra(depois.get('valor_liquido'))}")
    return linhas


def _resumo_regra_01_email(antes: dict[str, Any], depois: dict[str, Any], regra_01: dict[str, Any]) -> list[str]:
    anterior = _regra_01_dados(antes)
    atual = _regra_01_dados(depois or regra_01)
    if not atual.get("faixa") and regra_01:
        atual = _regra_01_dados(regra_01)
    linhas = ["- Regra alterada: Regra 01 - escada de atingimento"]
    if atual.get("faixa"):
        linhas.append(f"- Faixa atual: {atual['faixa']}")
    if atual.get("percentual") not in (None, ""):
        linhas.append(f"- Atingimento atual: {_formatar_percentual_regra(atual.get('percentual'))}")
    if atual.get("objetivo") not in (None, "") or atual.get("realizado") not in (None, ""):
        linhas.append(f"- Realizado/objetivo: {_formatar_valor_regra(atual.get('realizado'))} de {_formatar_valor_regra(atual.get('objetivo'))}")
    if atual.get("valor") not in (None, ""):
        if anterior.get("valor") not in (None, "") and _formatar_valor_regra(anterior.get("valor")) != _formatar_valor_regra(atual.get("valor")):
            linhas.append(f"- Valor da faixa: {_formatar_moeda_regra(anterior.get('valor'))} -> {_formatar_moeda_regra(atual.get('valor'))}")
        else:
            linhas.append(f"- Valor da faixa agora: {_formatar_moeda_regra(atual.get('valor'))}")
    linhas.extend(_resumo_valores_comissao(depois))
    return linhas


def _ips_por_id(ips: list[dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    mapa = {}
    for indice, ip in enumerate(ips or [], start=1):
        if not isinstance(ip, dict):
            continue
        chave = str(ip.get("ip_id") or ip.get("id") or ip.get("nome") or indice)
        mapa[chave] = ip
    return mapa


def _resumo_regra_02_email(
    antes: dict[str, Any],
    depois: dict[str, Any],
    regra_02_ips: list[dict[str, Any]],
    regra_02_ips_removidos: list[str],
) -> list[str]:
    linhas = ["- Regra alterada: Regra 02 - bônus por IP"]
    anteriores = _ips_por_id(antes.get("regra_02_ips") or antes.get("ips") or [])
    atuais = _ips_por_id(regra_02_ips or depois.get("regra_02_ips") or depois.get("ips") or [])
    alterados = []
    for chave, ip_atual in atuais.items():
        ip_anterior = anteriores.get(chave, {})
        nome = ip_atual.get("nome") or ip_anterior.get("nome") or chave
        antes_bonus = ip_anterior.get("valor_bonus")
        depois_bonus = ip_atual.get("valor_bonus")
        if antes_bonus in (None, ""):
            alterados.append(f"- IP {nome}: bônus agora {_formatar_moeda_regra(depois_bonus)}")
        elif _formatar_valor_regra(antes_bonus) != _formatar_valor_regra(depois_bonus):
            alterados.append(f"- IP {nome}: bônus {_formatar_moeda_regra(antes_bonus)} -> {_formatar_moeda_regra(depois_bonus)}")
    for ip_id in regra_02_ips_removidos or []:
        nome = anteriores.get(str(ip_id), {}).get("nome") or ip_id
        alterados.append(f"- IP removido: {nome}")
    linhas.extend(alterados[:8])
    if len(alterados) > 8:
        linhas.append("- Outros IPs alterados estão disponíveis no portal.")
    linhas.extend(_resumo_valores_comissao(depois))
    return linhas


def _achatar_campos_regra(valor: Any, prefixo: str = "") -> dict[str, Any]:
    if isinstance(valor, dict):
        campos: dict[str, Any] = {}
        for chave, item in sorted(valor.items(), key=lambda par: str(par[0])):
            caminho = f"{prefixo}.{chave}" if prefixo else str(chave)
            campos.update(_achatar_campos_regra(item, caminho))
        return campos
    if isinstance(valor, list):
        campos = {}
        for indice, item in enumerate(valor, start=1):
            caminho = f"{prefixo}[{indice}]" if prefixo else f"[{indice}]"
            campos.update(_achatar_campos_regra(item, caminho))
        return campos
    return {prefixo: valor} if prefixo else {}


def _resumo_alteracoes_regra(
    *,
    regra_nome: str,
    antes: dict[str, Any],
    depois: dict[str, Any],
    regra_01: dict[str, Any],
    regra_02: dict[str, Any],
    regra_02_ips: list[dict[str, Any]],
    regra_02_ips_removidos: list[str],
) -> str:
    if regra_nome == "Regra 01":
        linhas_regra_01 = _resumo_regra_01_email(antes, depois, regra_01)
        if len(linhas_regra_01) > 1:
            return "\n".join(linhas_regra_01)
    if regra_nome == "Regra 02":
        linhas_regra_02 = _resumo_regra_02_email(antes, depois, regra_02_ips, regra_02_ips_removidos)
        if len(linhas_regra_02) > 1:
            return "\n".join(linhas_regra_02)

    antes_campos = _achatar_campos_regra(antes)
    depois_campos = _achatar_campos_regra(depois)
    campos_tecnicos = ("comissionado_id", "resultado_id", "id", "regra_01.faixas", "regra_02_ips")
    linhas = []
    for campo in sorted(set(antes_campos) | set(depois_campos)):
        if campo.startswith(campos_tecnicos) or ".id" in campo:
            continue
        valor_antes = antes_campos.get(campo)
        valor_depois = depois_campos.get(campo)
        if _formatar_valor_regra(valor_antes) != _formatar_valor_regra(valor_depois):
            linhas.append(f"- {campo}: {_formatar_valor_regra(valor_antes)} -> {_formatar_valor_regra(valor_depois)}")
        if len(linhas) >= 30:
            linhas.append("- ... outras alterações disponíveis no portal.")
            break
    if linhas:
        return "\n".join(linhas)

    estado_atual = regra_01 if regra_nome == "Regra 01" else {
        **(regra_02 or {}),
        "ips": regra_02_ips or [],
        "ips_removidos": regra_02_ips_removidos or [],
    }
    estado_campos = _achatar_campos_regra(estado_atual)
    if not estado_campos:
        return "A regra foi publicada, mas nenhum campo detalhado foi informado no payload."
    linhas = [f"- {campo}: {_formatar_valor_regra(valor)}" for campo, valor in sorted(estado_campos.items())[:30]]
    if len(estado_campos) > 30:
        linhas.append("- ... demais campos disponíveis no portal.")
    return "\n".join(linhas)


HEAD_STATUSES = {"aprovado_secretaria", "aguardando_head_comercial"}
NF_STATUSES = {"aprovado_marcelo", "aprovada_head_comercial", "aguardando_nf", "nf_em_validacao"}
READY_STATUSES = {"pronto_financeiro", "pronta_para_envio_pagamento"}
PAYMENT_STATUSES = {"enviado_financeiro", "enviada_pagamento"}
REGRA_EDITAVEL_STATUS_APROVACAO = {
    "calculado_seed",
    "calculado",
    "calculada",
    "pendente_secretaria",
    "em_revisao_secretaria",
    "revisao_necessaria",
    "rejeitada",
}


def _estado_retorno_revisao(exige_nf: bool) -> dict[str, str]:
    return {
        "status": "revisao_necessaria",
        "status_nf": "pendente_nf" if exige_nf else "nao_aplicavel",
        "status_financeiro": "nao_enviado",
        "status_pagamento": "nao_enviado",
    }


def _regra_bloqueada_para_edicao(resultado: dict[str, Any] | None) -> bool:
    if not resultado:
        return True
    status = str(resultado.get("status") or "").strip().lower()
    return status not in REGRA_EDITAVEL_STATUS_APROVACAO


async def _registrar_acao_auditavel(
    conexao,
    *,
    request: Request,
    usuario,
    tipo_evento: str,
    antes: dict[str, Any],
    depois: dict[str, Any],
    comentario: str | None,
    idempotency_key: str | None,
    documento_id: str | None = None,
) -> dict[str, Any]:
    evento = await registrar_evento_comissionamento(
        conexao,
        ESQUEMA_COMISSIONAMENTO,
        tipo_evento=tipo_evento,
        usuario_id=usuario.get("identificador_usuario"),
        sessao_id=usuario.get("identificador_sessao"),
        endereco_ip=_cliente_ip(request),
        agente_do_usuario=_agente_usuario(request),
        antes=antes,
        depois=depois,
        comentario=comentario,
        documento_id=documento_id,
        idempotency_key=idempotency_key,
    )
    await registrar_evento(
        conexao,
        f"comissionamento.{tipo_evento}",
        usuario.get("identificador_usuario"),
        usuario.get("identificador_sessao"),
        f"Ação de comissionamento: {tipo_evento}.",
        {
            "tipo_evento_ui": tipo_evento,
            "ciclo_id": depois.get("ciclo_id") or antes.get("ciclo_id"),
            "resultado_id": depois.get("id") or antes.get("id"),
            "comissionado_nome": depois.get("nome") or antes.get("nome"),
            "comentario": comentario,
            "documento_id": documento_id,
            "payload": {"antes": antes, "depois": depois},
            "idempotency_key": idempotency_key,
        },
        _cliente_ip(request),
        _agente_usuario(request),
    )
    return evento


def _plano_notificacao_automatica(acao: str, antes: dict[str, Any], depois: dict[str, Any], exige_nf: bool) -> dict[str, Any] | None:
    destino = "Financeiro" if exige_nf else "RH e Financeiro"
    planos = {
        "enviar_head": {
            "template": "enviado_para_head",
            "destinatarios": ["diretoria_comercial"],
            "assunto": "Comissão aguardando aprovação comercial",
            "mensagem": "A comissão foi enviada para aprovação da Diretoria Comercial.",
        },
        "rejeitar": {
            "template": "rejeitado_head",
            "destinatarios": ["secretaria", "comissionado"],
            "assunto": "Comissão devolvida pela Diretoria Comercial",
            "mensagem": "A comissão foi devolvida pela Diretoria Comercial. Secretaria e comissionado foram avisados para acompanhar a revisão.",
        },
        "solicitar_ajuste": {
            "template": "ajuste_solicitado",
            "destinatarios": ["secretaria"],
            "assunto": "Revisão de comissão solicitada",
            "mensagem": "Um pedido de revisão/recalculo foi registrado e a comissão voltou para a Secretaria.",
        },
        "registrar_nf_recebida": {
            "template": "nf_enviada",
            "destinatarios": ["secretaria"],
            "assunto": "Nota Fiscal recebida para validação",
            "mensagem": "A Nota Fiscal foi recebida e aguarda validação.",
        },
        "validar_nf": {
            "template": "nf_validada",
            "destinatarios": ["secretaria"],
            "assunto": "Nota Fiscal enviada para pagamento",
            "mensagem": "A Nota Fiscal foi recebida e a comissão seguiu para Pagamento.",
        },
        "solicitar_correcao_nf": {
            "template": "nf_rejeitada",
            "destinatarios": ["comissionado", "secretaria"],
            "assunto": "Correção necessária na Nota Fiscal",
            "mensagem": "A Nota Fiscal precisa de correção antes do pagamento.",
        },
        "enviar_pacote_pagamento": {
            "template": "pacote_pagamento_enviado",
            "destinatarios": ["secretaria", destino.lower().replace(" e ", "_")],
            "assunto": "Pacote de comissão enviado para pagamento",
            "mensagem": f"A comissão está na etapa Pagamento com destino operacional {destino}.",
        },
        "enviar_nf_financeiro": {
            "template": "nf_enviada_financeiro",
            "destinatarios": ["financeiro", "secretaria"],
            "assunto": "Nota Fiscal enviada ao Financeiro",
            "mensagem": "A Nota Fiscal foi recebida e enviada ao Financeiro para processamento.",
        },
    }
    if acao == "aprovar_head":
        if exige_nf:
            return {
                "template": "nf_solicitada",
                "destinatarios": ["comissionado", "secretaria"],
                "assunto": "Envio de Nota Fiscal solicitado",
                "mensagem": "A comissão foi aprovada e a solicitação de NF foi enviada automaticamente.",
            }
        return {
            "template": "clt_enviado_rh_financeiro",
            "destinatarios": ["secretaria", "rh", "financeiro"],
            "assunto": "Comissão CLT enviada para RH/Financeiro",
            "mensagem": f"A comissão foi aprovada e enviada ao {destino}.",
        }
    return planos.get(acao)


async def _registrar_notificacao_automatica(
    conexao,
    *,
    request: Request,
    usuario,
    acao: str,
    antes: dict[str, Any],
    depois: dict[str, Any],
    exige_nf: bool,
    comentario: str | None,
    idempotency_key: str | None,
    documento_id: str | None = None,
    quantidade_itens: int = 1,
    destino_pacote: str | None = None,
    extra_payload: dict[str, Any] | None = None,
    anexos_transientes: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    if acao == "registrar_pagamento":
        return None
    plano = _plano_notificacao_automatica(acao, antes, depois, exige_nf)
    if not plano:
        return None

    notificacao = {
        **plano,
        "canais": ["email", "interna", "dashboard"],
        "status_envio": "pendente_integracao_email",
        "automatico": True,
        "gatilho": acao,
    }
    try:
        async with conexao.transaction():
            acoes_notificacao = [acao, "rejeitar_comissionado"] if acao == "rejeitar" else [acao]
            notificacoes_reais = []
            for indice, acao_notificacao in enumerate(acoes_notificacao, start=1):
                sufixo = f":auto-notificacao:{indice}" if len(acoes_notificacao) > 1 else ":auto-notificacao"
                item = await criar_notificacao_de_acao(
                    conexao,
                    ESQUEMA_COMISSIONAMENTO,
                    acao=acao_notificacao,
                    evento_negocio_id=None,
                    antes=antes,
                    depois=depois,
                    exige_nf=exige_nf,
                    comentario=comentario,
                    idempotency_key=f"{idempotency_key}{sufixo}" if idempotency_key else None,
                    usuario_id=usuario.get("identificador_usuario"),
                    quantidade_itens=quantidade_itens,
                    destino_pacote=destino_pacote,
                    extra_payload=extra_payload,
                )
                if item:
                    notificacoes_reais.append(item)
            notificacao_real = notificacoes_reais[0] if len(notificacoes_reais) == 1 else {
                "id": None,
                "status": "multiplas_notificacoes",
                "notificacoes": notificacoes_reais,
                "filas": [fila for item in notificacoes_reais for fila in (item.get("filas") or [])],
            }
        if notificacao_real:
            filas_ids = [fila["id"] for fila in notificacao_real.get("filas") or [] if fila.get("id")]
            anexos_por_fila = {}
            if anexos_transientes:
                for fila in notificacao_real.get("filas") or []:
                    if fila.get("template_codigo") == "financeiro_pacote_pj_enviado":
                        anexos_por_fila[fila["id"]] = anexos_transientes
            envio = await processar_filas_especificas(conexao, ESQUEMA_COMISSIONAMENTO, filas_ids, anexos_por_fila)
            status_envio = "processada" if envio.get("quantidade") else "enfileirada"
            notificacao = {**notificacao, **notificacao_real, "status_envio": status_envio, "envio": envio}
    except Exception as erro:
        notificacao = {
            **notificacao,
            "status_envio": "pendente_integracao_email",
            "erro_integracao": type(erro).__name__,
        }

    payload_depois = {**depois, "notificacao": notificacao}
    evento = await registrar_evento_comissionamento(
        conexao,
        ESQUEMA_COMISSIONAMENTO,
        tipo_evento="notificacao_automatica_disparada",
        usuario_id=usuario.get("identificador_usuario"),
        sessao_id=usuario.get("identificador_sessao"),
        endereco_ip=_cliente_ip(request),
        agente_do_usuario=_agente_usuario(request),
        antes=antes,
        depois=payload_depois,
        comentario=comentario or plano["mensagem"],
        documento_id=documento_id,
        idempotency_key=f"{idempotency_key}:auto-notificacao" if idempotency_key else None,
    )
    await registrar_evento(
        conexao,
        "comissionamento.notificacao_automatica_disparada",
        usuario.get("identificador_usuario"),
        usuario.get("identificador_sessao"),
        notificacao.get("mensagem") or "Notificação de comissionamento registrada em modo seguro.",
        {
            "tipo_evento_ui": "notificacao_automatica_disparada",
            "ciclo_id": depois.get("ciclo_id") or antes.get("ciclo_id"),
            "resultado_id": depois.get("id") or antes.get("id"),
            "comissionado_nome": depois.get("nome") or antes.get("nome"),
            "acao": acao,
            "notificacao": notificacao,
            "canais": ["email", "interna", "dashboard"],
            "status_envio": notificacao.get("status_envio"),
            "documento_id": documento_id,
            "idempotency_key": idempotency_key,
        },
        _cliente_ip(request),
        _agente_usuario(request),
    )
    return evento


async def _executar_acao_resultado(
    *,
    resultado_id: str,
    acao: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario,
):
    chave = _idempotency_key(request, corpo)
    rota = f"{request.method}:{request.url.path}:{acao}"
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        if acao in {"aprovar_head", "rejeitar"}:
            await exigir_permissao_portal(
                conexao,
                usuario["identificador_usuario"],
                "comissionamento.aprovar.head",
                "Você não tem permissão para executar ações da Aprovação Comercial.",
            )
        elif acao == "solicitar_ajuste":
            await _exigir_qualquer_permissao(
                conexao,
                usuario["identificador_usuario"],
                ("comissionamento.secretaria", "comissionamento.aprovar.head", "comissionamento.view.own"),
                "Você não tem permissão para solicitar ajuste de comissionamento.",
            )
        else:
            await exigir_permissao_portal(
                conexao,
                usuario["identificador_usuario"],
                "comissionamento.secretaria",
                "Você não tem permissão para executar esta ação de comissionamento.",
            )
        async with conexao.transaction():
            resposta_existente = await buscar_resposta_idempotente(conexao, ESQUEMA_COMISSIONAMENTO, chave, rota)
            if resposta_existente:
                return resposta_existente
            linha = await buscar_resultado_linha(conexao, ESQUEMA_COMISSIONAMENTO, resultado_id)
            if not linha:
                raise HTTPException(status_code=404, detail="Resultado de comissionamento não encontrado.")
            antes = serializar_linha_resultado(linha)
            if acao == "solicitar_ajuste":
                pode_fluxo_geral = (
                    await usuario_possui_permissao(conexao, usuario["identificador_usuario"], "comissionamento.secretaria")
                    or await usuario_possui_permissao(conexao, usuario["identificador_usuario"], "comissionamento.aprovar.head")
                )
                if not pode_fluxo_geral:
                    await _validar_resultado_proprio(conexao, usuario, antes)
            status = str(antes.get("status") or "")
            status_nf = str(antes.get("status_nf") or "")
            exige_nf = not _eh_clt(antes)
            novo = {
                "status": None,
                "status_nf": None,
                "status_financeiro": None,
                "status_pagamento": None,
            }

            if acao == "enviar_head":
                _validar_transicao(status in SECRETARIA_STATUSES, "A comissão não está em etapa da Secretaria.")
                novo["status"] = "aguardando_head_comercial"
            elif acao == "aprovar_head":
                _validar_transicao(status in HEAD_STATUSES, "A comissão não está aguardando aprovação comercial.")
                if exige_nf:
                    novo["status"] = "aguardando_nf"
                    novo["status_nf"] = "solicitada"
                else:
                    novo["status"] = "enviada_pagamento"
                    novo["status_nf"] = "nao_aplicavel"
                    novo["status_financeiro"] = "pacote_enviado"
                    novo["status_pagamento"] = "aguardando_pagamento"
            elif acao == "rejeitar":
                _validar_transicao(bool(_comentario(corpo)), "Informe o motivo da reprovação/devolução para revisão.")
                _validar_transicao(status in HEAD_STATUSES, "A comissão não está aguardando aprovação comercial.")
                _validar_transicao(status not in {"paga", "pago", "cancelada"}, "Comissão paga ou cancelada não pode ser reprovada.")
                novo.update(_estado_retorno_revisao(exige_nf))
            elif acao == "solicitar_ajuste":
                _validar_transicao(bool(_comentario(corpo)), "Informe o motivo do pedido de revisão/recalculo.")
                _validar_transicao(
                    status not in {"paga", "pago", "cancelada"},
                    "Comissão paga ou cancelada não pode iniciar nova revisão.",
                )
                _validar_transicao(
                    status not in {"enviada_pagamento", "pronta_para_envio_pagamento"}
                    and antes.get("status_pagamento") not in {"aguardando_pagamento", "paga", "pago"}
                    and antes.get("status_financeiro") not in {"pacote_enviado", "pronta_para_envio_pagamento"},
                    "Comissão em Pagamento não pode iniciar nova revisão/recalculo.",
                )
                novo.update(_estado_retorno_revisao(exige_nf))
            elif acao == "solicitar_nf":
                _validar_transicao(exige_nf, "Comissionado CLT não possui etapa de Nota Fiscal.")
                _validar_transicao(status in NF_STATUSES, "A comissão ainda não está na etapa de NF.")
                novo["status"] = "aguardando_nf"
                novo["status_nf"] = "solicitada"
            elif acao == "reenviar_lembrete_nf":
                _validar_transicao(
                    exige_nf
                    and (
                        status in NF_STATUSES
                        or status_nf in {"solicitada", "nf_solicitada", "pendente_nf", "bloqueada", "nf_correcao_solicitada"}
                    ),
                    "Não há NF pendente para reenviar lembrete.",
                )
            elif acao == "registrar_nf_recebida":
                _validar_transicao(exige_nf and status in NF_STATUSES, "A comissão não está apta para receber NF.")
                novo["status"] = "nf_em_validacao"
                novo["status_nf"] = "recebida"
            elif acao == "validar_nf":
                _validar_transicao(exige_nf and status in NF_STATUSES and status_nf in {"recebida", "nf_recebida"}, "A NF precisa estar recebida para validação.")
                novo["status"] = "pronta_para_envio_pagamento"
                novo["status_nf"] = "validada"
                novo["status_financeiro"] = "pronta_para_envio_pagamento"
            elif acao == "solicitar_correcao_nf":
                _validar_transicao(exige_nf and status in NF_STATUSES, "Não há NF em validação para solicitar correção.")
                novo["status"] = "aguardando_nf"
                novo["status_nf"] = "solicitada"
            elif acao == "registrar_pagamento":
                _validar_transicao(status in PAYMENT_STATUSES or antes.get("status_pagamento") == "aguardando_pagamento", "A comissão não está aguardando pagamento.")
                novo["status"] = "paga"
                novo["status_pagamento"] = "paga"
            else:
                raise HTTPException(status_code=404, detail="Ação de comissionamento não encontrada.")

            if not exige_nf and not novo["status_nf"]:
                novo["status_nf"] = "nao_aplicavel"
            elif exige_nf and not novo["status_nf"] and status_nf in {
                "nao_solicitada",
                "pendente_nf",
                "bloqueada",
                "nf_correcao_solicitada",
            }:
                novo["status_nf"] = "solicitada"

            resultado = await atualizar_status_resultado(conexao, ESQUEMA_COMISSIONAMENTO, resultado_id, **novo)
            depois = {
                **antes,
                "status": novo["status"] or antes.get("status"),
                "status_nf": novo["status_nf"] or antes.get("status_nf"),
                "status_financeiro": novo["status_financeiro"] or antes.get("status_financeiro"),
                "status_pagamento": novo["status_pagamento"] or antes.get("status_pagamento"),
            }
            evento = await _registrar_acao_auditavel(
                conexao,
                request=request,
                usuario=usuario,
                tipo_evento={
                    "enviar_head": "comissao_enviada_head",
                    "aprovar_head": "comissao_aprovada_head",
                    "rejeitar": "comissao_rejeitada_head",
                    "solicitar_ajuste": "recalculo_solicitado",
                    "solicitar_nf": "nf_solicitada",
                    "reenviar_lembrete_nf": "notificacao_manual_disparada",
                    "registrar_nf_recebida": "nf_recebida",
                    "validar_nf": "nf_validada",
                    "solicitar_correcao_nf": "nf_rejeitada",
                    "registrar_pagamento": "pagamento_registrado",
                }[acao],
                antes=antes,
                depois=depois,
                comentario=_comentario(corpo),
                idempotency_key=chave,
            )
            email_ator = await _email_usuario_autenticado(conexao, usuario)
            extra_payload_acao = {
                "codigo_comissao": depois.get("codigo_comissao") or antes.get("codigo_comissao") or resultado_id,
                "acao_executada_por_nome": _nome_usuario_autenticado(usuario, email_ator),
                "acao_executada_por_email": email_ator or "",
                "acao_executada_por_perfil": _perfil_usuario_autenticado(usuario),
                "acao_executada_em": evento.get("criado_em"),
            }
            notificacao = await _registrar_notificacao_automatica(
                conexao,
                request=request,
                usuario=usuario,
                acao=acao,
                antes=antes,
                depois=depois,
                exige_nf=exige_nf,
                comentario=_comentario(corpo),
                idempotency_key=chave,
                extra_payload=extra_payload_acao,
            )
            resultado_atualizado = await buscar_resultado_por_id(conexao, ESQUEMA_COMISSIONAMENTO, resultado_id)
            resposta = {
                "status": "ok",
                "acao": acao,
                "resultado": resultado_atualizado or resultado,
                "evento": evento,
                "notificacao": notificacao,
            }
            await salvar_resposta_idempotente(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                chave=chave,
                rota=rota,
                usuario_id=usuario.get("identificador_usuario"),
                resposta=resposta,
            )
            return resposta


def _validar_rascunho_regra(corpo: CorpoRascunhoRegra) -> None:
    indicadores_validos = set(INDICADORES_CONFIGURAVEIS)
    for bloco_nome, bloco in (("regra_01", corpo.regra_01), ("regra_02", corpo.regra_02)):
        indicador = bloco.get("indicador")
        if indicador and indicador not in indicadores_validos:
            raise HTTPException(
                status_code=422,
                detail=f"Indicador inválido em {bloco_nome}. Use apenas indicadores preconfigurados.",
            )

    tipo_comissao = corpo.regra_02.get("tipo_comissao")
    if tipo_comissao and tipo_comissao not in TIPOS_COMISSAO_VALIDOS:
        raise HTTPException(
            status_code=422,
            detail="Tipo de comissão inválido. Use numero, percentual, decimal ou moeda.",
        )


def _validar_publicacao_regra(corpo: CorpoPublicacaoRegra) -> None:
    indicadores_validos = set(INDICADORES_CONFIGURAVEIS)
    for ip in corpo.regra_02_ips:
        indicador = ip.get("indicador")
        if indicador and indicador not in indicadores_validos:
            raise HTTPException(status_code=422, detail=f"Indicador inválido na Regra 02: {indicador}.")
        tipo_comissao = ip.get("tipo_comissao")
        if tipo_comissao and tipo_comissao not in TIPOS_COMISSAO_VALIDOS:
            raise HTTPException(status_code=422, detail="Tipo de comissão inválido na Regra 02.")
        data_inicial = ip.get("data_inicial")
        data_fim = ip.get("data_fim")
        if data_inicial and data_fim and str(data_inicial) > str(data_fim):
            raise HTTPException(status_code=422, detail="Data inicial não pode ser maior que data fim na Regra 02.")


@rotas_de_comissionamento.get("/comissionamento/config")
async def obter_config_comissionamento(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_BASICO,
            "Você não tem permissão para visualizar configuração de comissionamento.",
        )
    return CONFIG_COMISSIONAMENTO


@rotas_de_comissionamento.get("/comissionamento/ciclos/2026-05/preview")
async def obter_preview_comissionamento_maio_2026(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_GERAL,
            "Você não tem permissão para visualizar comissionamento.",
        )

        preview = await buscar_preview_ciclo(conexao, ESQUEMA_COMISSIONAMENTO, "2026-05")

    if not preview:
        raise HTTPException(status_code=404, detail="Ciclo de comissionamento não encontrado.")
    return preview


@rotas_de_comissionamento.get("/comissionamento/ciclos")
async def listar_ciclos_comissionamento(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_BASICO,
            "Você não tem permissão para visualizar comissionamento.",
        )
        ciclos = await listar_ciclos(conexao, ESQUEMA_COMISSIONAMENTO)

    return {"ciclos": ciclos}


@rotas_de_comissionamento.get("/comissionamento/ciclos/{ciclo_id}/resultados")
async def listar_resultados_ciclo_comissionamento(
    ciclo_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_GERAL,
            "Você não tem permissão para visualizar comissionamento.",
        )
        preview = await buscar_preview_ciclo(conexao, ESQUEMA_COMISSIONAMENTO, ciclo_id)

    if not preview:
        raise HTTPException(status_code=404, detail="Ciclo de comissionamento não encontrado.")
    return {
        "ciclo": preview["ciclo"],
        "resumo": preview["resumo"],
        "registros": preview["registros"],
    }


@rotas_de_comissionamento.post("/comissionamento/ciclos/{ciclo_id}/hierarquia/snapshot")
async def gerar_snapshot_hierarquia_comissionamento(
    ciclo_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    chave = _idempotency_key(request, corpo)
    rota = f"{request.method}:{request.url.path}:hierarquia_snapshot"
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para gerar snapshot de hierarquia.",
        )
        async with conexao.transaction():
            resposta_existente = await buscar_resposta_idempotente(conexao, ESQUEMA_COMISSIONAMENTO, chave, rota)
            if resposta_existente:
                return resposta_existente
            snapshot = await gerar_snapshot_hierarquia_ciclo(conexao, ESQUEMA_COMISSIONAMENTO, ciclo_id)
            await registrar_evento(
                conexao,
                "comissionamento.hierarquia.snapshot_gerado",
                usuario.get("identificador_usuario"),
                usuario.get("identificador_sessao"),
                "Snapshot de hierarquia do ciclo gerado pela Secretaria.",
                {
                    **snapshot,
                    "motivo": corpo.motivo,
                    "comentario": _comentario(corpo),
                    "idempotency_key": chave,
                },
                _cliente_ip(request),
                _agente_usuario(request),
            )
            resposta = {"snapshot": snapshot, "idempotency_key": chave}
            await salvar_resposta_idempotente(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                chave=chave,
                rota=rota,
                usuario_id=usuario.get("identificador_usuario"),
                resposta=resposta,
            )
            return resposta


@rotas_de_comissionamento.get("/comissionamento/minha-comissao")
async def obter_minha_comissao(
    request: Request,
    ciclo_id: str = "2026-06",
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            ("comissionamento.view.own", "comissionamento.view"),
            "Você não tem permissão para visualizar sua comissão.",
        )
        usuario_linha = await conexao.fetchrow(
            f"""
            select nome_completo, correio_eletronico::text as correio_eletronico
            from {ESQUEMA_BANCO}.usuario
            where identificador_usuario = $1::uuid
            """,
            usuario["identificador_usuario"],
        )
        preview = await buscar_preview_ciclo(conexao, ESQUEMA_COMISSIONAMENTO, ciclo_id)

    if not preview:
        raise HTTPException(status_code=404, detail="Ciclo de comissionamento não encontrado.")

    nome_usuario = str((usuario_linha or {}).get("nome_completo") or "").strip().lower()
    email_usuario = str((usuario_linha or {}).get("correio_eletronico") or "").strip().lower()

    resultado = None
    for item in preview.get("registros", []):
        nome_comissionado = str(item.get("nome") or "").strip().lower()
        email_comissionado = str(item.get("email") or item.get("correio_eletronico") or "").strip().lower()
        if nome_usuario and nome_usuario == nome_comissionado:
            resultado = item
            break
        if email_usuario and email_comissionado and email_usuario == email_comissionado:
            resultado = item
            break

    return {
        "ciclo": preview.get("ciclo"),
        "encontrado": bool(resultado),
        "resultado": resultado,
        "mensagem": None if resultado else "Nenhuma comissão vinculada ao usuário autenticado neste ciclo.",
    }


@rotas_de_comissionamento.get("/comissionamento/resultados/{resultado_id}")
async def obter_resultado_comissionamento(
    resultado_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_BASICO,
            "Você não tem permissão para visualizar comissionamento.",
        )
        resultado = await buscar_resultado_por_id(conexao, ESQUEMA_COMISSIONAMENTO, resultado_id)

    if not resultado:
        raise HTTPException(status_code=404, detail="Resultado de comissionamento não encontrado.")
    async with pool.acquire() as conexao:
        pode_ver_geral = (
            await usuario_possui_permissao(conexao, usuario["identificador_usuario"], "comissionamento.view.all")
            or await usuario_possui_permissao(conexao, usuario["identificador_usuario"], "comissionamento.secretaria")
            or await usuario_possui_permissao(conexao, usuario["identificador_usuario"], "comissionamento.aprovar.head")
        )
        if not pode_ver_geral:
            await _validar_resultado_proprio(conexao, usuario, resultado)
    return resultado


@rotas_de_comissionamento.get("/comissionamento/regras")
async def listar_regras_comissionamento(
    request: Request,
    vigencia: str | None = None,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_SECRETARIA,
            "Você não tem permissão para visualizar regras de comissionamento.",
        )
    return listar_regras_rascunho(vigencia)


@rotas_de_comissionamento.get("/comissionamento/ciclos/{ciclo_id}/configuracao")
async def obter_configuracao_ciclo_comissionamento(
    ciclo_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_SECRETARIA,
            "Você não tem permissão para visualizar configuração do ciclo.",
        )
        configuracao = await obter_configuracao_ciclo(conexao, ESQUEMA_COMISSIONAMENTO, ciclo_id)
    return {"configuracao": configuracao}


@rotas_de_comissionamento.put("/comissionamento/ciclos/{ciclo_id}/configuracao")
async def salvar_configuracao_ciclo_comissionamento(
    ciclo_id: str,
    corpo: CorpoConfiguracaoCiclo,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para configurar objetivo do ciclo.",
        )
        async with conexao.transaction():
            configuracao = await salvar_configuracao_ciclo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                ciclo_id=ciclo_id,
                objetivo_repasse_geral=corpo.objetivo_repasse_geral,
                payload={**(corpo.payload or {}), "origem": "aba_regras"},
                usuario_id=usuario.get("identificador_usuario"),
            )
            regras_recalculadas = await _recalcular_regras_01_ciclo(
                conexao,
                ciclo_id,
                corpo.objetivo_repasse_geral,
            )
            await registrar_evento(
                conexao,
                "comissionamento.ciclo.configuracao_atualizada",
                usuario.get("identificador_usuario"),
                usuario.get("identificador_sessao"),
                "Objetivo geral de repasse do ciclo atualizado pela Secretaria.",
                {
                    "ciclo_id": ciclo_id,
                    "configuracao": configuracao,
                    "regras_01_recalculadas": regras_recalculadas,
                },
                _cliente_ip(request),
                _agente_usuario(request),
            )
    return {
        "status": "ok",
        "configuracao": configuracao,
        "regras_01_recalculadas": regras_recalculadas,
        "mensagem": "Objetivo geral de repasse atualizado.",
    }


@rotas_de_comissionamento.get("/comissionamento/ciclos/{ciclo_id}/eventos")
async def listar_eventos_ciclo_comissionamento(
    ciclo_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_HISTORICO,
            "Você não tem permissão para visualizar histórico de comissionamento.",
        )
        eventos = await listar_eventos_auditoria_comissionamento(conexao, ciclo_id=ciclo_id)
    return {"eventos": eventos}


@rotas_de_comissionamento.get("/comissionamento/resultados/{resultado_id}/eventos")
async def listar_eventos_resultado_comissionamento(
    resultado_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            PERMISSOES_COMISSIONAMENTO_HISTORICO,
            "Você não tem permissão para visualizar histórico de comissionamento.",
        )
        eventos = await listar_eventos_auditoria_comissionamento(conexao, resultado_id=resultado_id)
    return {"eventos": eventos}


@rotas_de_comissionamento.get("/comissionamento/notificacoes")
async def listar_notificacoes_comissionamento(
    request: Request,
    ciclo_id: str | None = None,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            ("comissionamento.view.own", "comissionamento.view"),
            "Você não tem permissão para visualizar notificações de comissionamento.",
        )
        pode_ver_tudo = await usuario_possui_permissao(conexao, usuario["identificador_usuario"], "comissionamento.secretaria")
        email = await _email_usuario_autenticado(conexao, usuario)
        notificacoes = await listar_notificacoes_usuario(
            conexao,
            ESQUEMA_COMISSIONAMENTO,
            usuario_id=usuario.get("identificador_usuario"),
            email=email,
            pode_ver_tudo=pode_ver_tudo,
            ciclo_id=ciclo_id,
        )
    return {"notificacoes": notificacoes}


@rotas_de_comissionamento.get("/comissionamento/notificacoes/historico")
async def listar_historico_notificacoes_comissionamento(
    request: Request,
    ciclo_id: str | None = None,
    status_envio: str | None = None,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para visualizar histórico de notificações.",
        )
        historico = await listar_historico_envios(conexao, ESQUEMA_COMISSIONAMENTO, ciclo_id, status_envio)
    return {"envios": historico}


@rotas_de_comissionamento.post("/comissionamento/notificacoes/preview")
async def preview_notificacao_comissionamento(
    corpo: CorpoPreviewNotificacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para gerar preview de notificações.",
        )
        preview = await renderizar_template(
            conexao,
            ESQUEMA_COMISSIONAMENTO,
            corpo.template_codigo,
            corpo.payload,
            corpo.template_versao,
        )
        await registrar_evento(
            conexao,
            "comissionamento.notificacao.preview",
            usuario.get("identificador_usuario"),
            usuario.get("identificador_sessao"),
            "Preview de template de notificação renderizado.",
            {
                "template_codigo": corpo.template_codigo,
                "template_versao": corpo.template_versao,
                "correlation_id": preview["variaveis"].get("correlation_id"),
            },
            _cliente_ip(request),
            _agente_usuario(request),
        )
    return {"preview": {chave: valor for chave, valor in preview.items() if chave != "template"}}


@rotas_de_comissionamento.get("/comissionamento/notificacoes/templates")
async def listar_templates_notificacoes_comissionamento(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para listar templates de notificações.",
        )
        templates = await listar_templates_ou_erro(conexao, ESQUEMA_COMISSIONAMENTO)
    return {"templates": templates}


@rotas_de_comissionamento.post("/comissionamento/notificacoes/templates")
async def salvar_template_notificacao_comissionamento(
    corpo: CorpoTemplateNotificacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para configurar templates de notificações.",
        )
        template = await salvar_template_configurado(
            conexao,
            ESQUEMA_COMISSIONAMENTO,
            corpo.dict(),
            usuario.get("identificador_usuario"),
        )
    return {"template": template}


@rotas_de_comissionamento.put("/comissionamento/notificacoes/templates/{template_codigo}")
async def atualizar_template_notificacao_comissionamento(
    template_codigo: str,
    corpo: CorpoTemplateNotificacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    payload = corpo.dict()
    payload["codigo"] = template_codigo
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para atualizar templates de notificações.",
        )
        template = await salvar_template_configurado(
            conexao,
            ESQUEMA_COMISSIONAMENTO,
            payload,
            usuario.get("identificador_usuario"),
        )
    return {"template": template}


@rotas_de_comissionamento.get("/comissionamento/notificacoes/regras")
async def listar_regras_notificacoes_comissionamento(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para listar regras de notificações.",
        )
        regras = await listar_regras_escalonamento(conexao, ESQUEMA_COMISSIONAMENTO)
    return {"regras": regras}


@rotas_de_comissionamento.put("/comissionamento/notificacoes/regras")
async def atualizar_regras_notificacoes_comissionamento(
    corpo: CorpoRegrasNotificacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para configurar regras de notificações.",
        )
        await registrar_evento(
            conexao,
            "comissionamento.notificacao.regras_configuradas",
            usuario.get("identificador_usuario"),
            usuario.get("identificador_sessao"),
            "Configuração de prazos e lembretes de notificações registrada.",
            {"regras": corpo.regras},
            _cliente_ip(request),
            _agente_usuario(request),
        )
    return {"status": "registrado", "quantidade": len(corpo.regras), "mensagem": "Configuração auditada. Persistência detalhada fica na próxima rodada de parametrização."}


@rotas_de_comissionamento.post("/comissionamento/notificacoes/manual")
async def disparar_notificacao_manual_comissionamento(
    corpo: CorpoManualNotificacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    chave = _idempotency_key(request) or corpo.idempotency_key
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para disparar notificações manuais.",
        )
        destinatarios = [item.dict() for item in corpo.destinatarios]
        notificacao = await criar_notificacao_manual(
            conexao,
            ESQUEMA_COMISSIONAMENTO,
            template_codigo=corpo.template_codigo,
            payload={**corpo.payload, "comentario": corpo.comentario},
            destinatarios=destinatarios,
            usuario_id=usuario.get("identificador_usuario"),
            idempotency_key=chave,
        )
    return {"notificacao": notificacao}


@rotas_de_comissionamento.post("/comissionamento/notificacoes/processar-fila")
async def processar_fila_notificacoes_comissionamento(
    corpo: CorpoProcessarFila,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para processar fila de notificações.",
        )
        resultado = await processar_fila(conexao, ESQUEMA_COMISSIONAMENTO, corpo.limite)
    return resultado


@rotas_de_comissionamento.post("/comissionamento/notificacoes/testar-provider")
async def testar_provider_notificacoes_comissionamento(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para testar provider de e-mail.",
        )
        resultado = await testar_provider_seguro(conexao, ESQUEMA_COMISSIONAMENTO)
    return resultado


@rotas_de_comissionamento.post("/comissionamento/notificacoes/{notificacao_id}/marcar-lida")
async def marcar_notificacao_lida_comissionamento(
    notificacao_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            ("comissionamento.view.own", "comissionamento.view"),
            "Você não tem permissão para marcar notificação como lida.",
        )
        pode_ver_tudo = await usuario_possui_permissao(conexao, usuario["identificador_usuario"], "comissionamento.secretaria")
        marcada = await marcar_destinatario_lido(
            conexao,
            ESQUEMA_COMISSIONAMENTO,
            notificacao_id,
            usuario.get("identificador_usuario"),
            pode_ver_tudo,
        )
    if not marcada:
        raise HTTPException(status_code=404, detail="Notificação não encontrada para o usuário.")
    return {"notificacao": marcada}


@rotas_de_comissionamento.post("/comissionamento/notificacoes/{notificacao_id}/reenviar")
async def reenviar_notificacao_comissionamento(
    notificacao_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    chave = _idempotency_key(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para reenviar notificações.",
        )
        fila = await preparar_reenvio(conexao, ESQUEMA_COMISSIONAMENTO, notificacao_id, chave)
        await registrar_evento(
            conexao,
            "comissionamento.notificacao.reenvio_manual",
            usuario.get("identificador_usuario"),
            usuario.get("identificador_sessao"),
            "Reenvio manual de notificação registrado.",
            {"fila_envio_id": notificacao_id, "idempotency_key": chave},
            _cliente_ip(request),
            _agente_usuario(request),
        )
    return {"fila": fila}


@rotas_de_comissionamento.post("/comissionamento/regras")
async def salvar_rascunho_regra_comissionamento(
    corpo: CorpoRascunhoRegra,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    _validar_rascunho_regra(corpo)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para salvar rascunho de regras de comissionamento.",
        )
        await registrar_evento(
            conexao,
            "comissionamento.regra.rascunho_salvo",
            usuario.get("identificador_usuario"),
            usuario.get("identificador_sessao"),
            "Rascunho de regra de comissionamento salvo pela Secretaria.",
            {
                "regra_01": corpo.regra_01,
                "regra_02": corpo.regra_02,
                "observacao": corpo.observacao,
                "idempotency_key": corpo.idempotency_key,
            },
            request.client.host if request.client else "",
            request.headers.get("user-agent", ""),
        )

    return {
        "status": "rascunho_validado",
        "idempotency_key": corpo.idempotency_key,
        "regra_01": corpo.regra_01,
        "regra_02": corpo.regra_02,
        "mensagem": "Rascunho validado pela API. Persistência definitiva será ativada com versionamento auditável.",
    }


@rotas_de_comissionamento.post("/comissionamento/ciclos/{ciclo_id}/simular")
async def simular_ciclo_comissionamento(
    ciclo_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para simular comissionamento.",
        )
        preview = await buscar_preview_ciclo(conexao, ESQUEMA_COMISSIONAMENTO, ciclo_id)

    if not preview:
        raise HTTPException(status_code=404, detail="Ciclo de comissionamento não encontrado.")
    return {
        "status": "simulado",
        "ciclo_id": ciclo_id,
        "observacao": corpo.observacao,
        "idempotency_key": corpo.idempotency_key,
        "resumo": preview["resumo"],
        "mensagem": "Simulação concluída. Nenhum valor definitivo foi gravado.",
    }


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/enviar-head")
async def enviar_resultado_para_head(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="enviar_head", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/aprovar-secretaria")
async def aprovar_secretaria_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="enviar_head", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/aprovar-head")
async def aprovar_head_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="aprovar_head", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/rejeitar")
async def rejeitar_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="rejeitar", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/solicitar-ajuste")
async def solicitar_ajuste_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="solicitar_ajuste", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/solicitar-nf")
async def solicitar_nf_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="solicitar_nf", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/reenviar-lembrete-nf")
async def reenviar_lembrete_nf_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="reenviar_lembrete_nf", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/registrar-nf-recebida")
async def registrar_nf_recebida_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="registrar_nf_recebida", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/validar-nf")
async def validar_nf_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="validar_nf", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/solicitar-correcao-nf")
async def solicitar_correcao_nf_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="solicitar_correcao_nf", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/registrar-pagamento")
async def registrar_pagamento_resultado(
    resultado_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    return await _executar_acao_resultado(resultado_id=resultado_id, acao="registrar_pagamento", corpo=corpo, request=request, usuario=usuario)


@rotas_de_comissionamento.post("/comissionamento/resultados/{resultado_id}/nf")
async def enviar_nf_resultado(
    resultado_id: str,
    request: Request,
    arquivo: UploadFile = File(...),
    numero_nf: str = Form(...),
    data_emissao: date = Form(...),
    valor_nf: Decimal = Form(...),
    observacao: str | None = Form(default=None),
    usuario=Depends(obter_usuario_autenticado),
):
    chave = _idempotency_key(request)
    rota = f"{request.method}:{request.url.path}:upload_nf"
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            usuario["identificador_usuario"],
            ("comissionamento.view.own", "comissionamento.view", "comissionamento.secretaria"),
            "Você não tem permissão para enviar Nota Fiscal.",
        )
        async with conexao.transaction():
            resposta_existente = await buscar_resposta_idempotente(conexao, ESQUEMA_COMISSIONAMENTO, chave, rota)
            if resposta_existente:
                return resposta_existente
            linha = await buscar_resultado_linha(conexao, ESQUEMA_COMISSIONAMENTO, resultado_id)
            if not linha:
                raise HTTPException(status_code=404, detail="Resultado de comissionamento não encontrado.")
            antes = serializar_linha_resultado(linha)
            pode_operar_nf_geral = await usuario_possui_permissao(
                conexao,
                usuario["identificador_usuario"],
                "comissionamento.secretaria",
            )
            if not pode_operar_nf_geral:
                await _validar_resultado_proprio(conexao, usuario, antes)
            _validar_transicao(not _eh_clt(antes), "Comissionado CLT não possui etapa de Nota Fiscal.")
            conteudo = await arquivo.read()
            _validar_transicao(bool(conteudo), "Arquivo de Nota Fiscal vazio.")
            nome_arquivo = arquivo.filename or "nota-fiscal.pdf"
            content_type = arquivo.content_type or "application/octet-stream"
            _validar_transicao(nome_arquivo.lower().endswith(".pdf"), "Envie a Nota Fiscal somente em PDF.")
            _validar_transicao(content_type in {"application/pdf", "application/octet-stream"}, "O arquivo da Nota Fiscal deve ser PDF.")
            _validar_transicao(conteudo.startswith(b"%PDF"), "O arquivo enviado não parece ser um PDF válido.")
            documento = await salvar_documento_nf(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                resultado=antes,
                nome_arquivo=nome_arquivo,
                content_type="application/pdf",
                conteudo=None,
                tamanho_bytes=len(conteudo),
                numero_nf=numero_nf,
                data_emissao=data_emissao,
                valor_nf=valor_nf,
                observacao=observacao,
                usuario_id=usuario.get("identificador_usuario"),
            )
            resultado = await atualizar_status_resultado(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                resultado_id,
                status="enviada_pagamento",
                status_nf="recebida",
                status_financeiro="pacote_enviado",
                status_pagamento="aguardando_pagamento",
            )
            depois = {
                **antes,
                "status": "enviada_pagamento",
                "status_nf": "recebida",
                "status_financeiro": "pacote_enviado",
                "status_pagamento": "aguardando_pagamento",
            }
            evento = await _registrar_acao_auditavel(
                conexao,
                request=request,
                usuario=usuario,
                tipo_evento="nf_recebida",
                antes=antes,
                depois=depois,
                comentario=observacao,
                documento_id=documento["documento_id"],
                idempotency_key=chave,
            )
            email_usuario = await _email_usuario_autenticado(conexao, usuario)
            nome_usuario = _nome_usuario_autenticado(usuario, email_usuario)
            dados_nf_email = {
                "nf_enviada_por_nome": nome_usuario,
                "nf_enviada_por_email": email_usuario or "-",
                "nf_numero": numero_nf,
                "nf_data_emissao": data_emissao.strftime("%d/%m/%Y"),
                "nf_nome_arquivo": nome_arquivo,
                "nf_arquivo_armazenado": "Não. Nesta fase o portal guarda apenas os metadados da Nota Fiscal.",
                "nf_anexo_email": "PDF anexado ao e-mail do Financeiro no momento do envio.",
                "nf_observacao": observacao or "Sem observacao informada.",
                "codigo_comissao": depois.get("codigo_comissao") or antes.get("codigo_comissao") or resultado_id,
                "acao_executada_por_nome": nome_usuario,
                "acao_executada_por_email": email_usuario or "",
                "acao_executada_por_perfil": _perfil_usuario_autenticado(usuario),
                "acao_executada_em": evento.get("criado_em"),
                "status_usuario": "Nota Fiscal enviada ao Financeiro",
                "proxima_acao": "Financeiro deve usar os dados e o PDF anexado no e-mail para dar andamento ao processamento.",
            }
            notificacao = await _registrar_notificacao_automatica(
                conexao,
                request=request,
                usuario=usuario,
                acao="enviar_nf_financeiro",
                antes=antes,
                depois=depois,
                exige_nf=True,
                comentario=observacao,
                documento_id=documento["documento_id"],
                idempotency_key=chave,
                quantidade_itens=1,
                destino_pacote="Financeiro",
                extra_payload=dados_nf_email,
                anexos_transientes=[montar_anexo_pdf_transiente(nome_arquivo, conteudo)],
            )
            resposta = {
                "status": "ok",
                "documento_id": documento["documento_id"],
                "status_nf": "recebida",
                "status_financeiro": "pacote_enviado",
                "status_pagamento": "aguardando_pagamento",
                "evento_id": evento["id"],
                "notificacao": notificacao,
                "resultado": resultado,
                "mensagem": "Nota Fiscal enviada ao Financeiro para processamento.",
            }
            await salvar_resposta_idempotente(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                chave=chave,
                rota=rota,
                usuario_id=usuario.get("identificador_usuario"),
                resposta=resposta,
            )
            return resposta


@rotas_de_comissionamento.post("/comissionamento/ciclos/{ciclo_id}/enviar-pacote-pagamento")
async def enviar_pacote_pagamento_ciclo(
    ciclo_id: str,
    corpo: CorpoAcaoComissionamento,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    chave = _idempotency_key(request, corpo)
    rota = f"{request.method}:{request.url.path}:enviar_pacote_pagamento"
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para enviar pacote de pagamento.",
        )
        async with conexao.transaction():
            resposta_existente = await buscar_resposta_idempotente(conexao, ESQUEMA_COMISSIONAMENTO, chave, rota)
            if resposta_existente:
                return resposta_existente
            linhas = await conexao.fetch(
                f"""
                select
                    resultado_id as id,
                    ciclo_id,
                    funcao,
                    cidade,
                    nome,
                    tipo_comissionado,
                    valor_bruto,
                    desconto_distrato,
                    valor_liquido,
                    status,
                    status_nf,
                    status_financeiro,
                    status_pagamento,
                    exige_nf,
                    origem
                from {ESQUEMA_COMISSIONAMENTO}.resultados
                where ciclo_id = $1
                  and (
                    status in ('pronto_financeiro', 'pronta_para_envio_pagamento')
                    or (exige_nf = false and status in ('aprovado_marcelo', 'aprovada_head_comercial'))
                  )
                order by resultado_id
                """,
                ciclo_id,
            )
            _validar_transicao(bool(linhas), "Nenhuma comissão pronta para envio ao pagamento.")
            resultados = []
            eventos = []
            quantidade_pj = 0
            quantidade_clt = 0
            for linha in linhas:
                antes = serializar_linha_resultado(linha)
                if _eh_clt(antes):
                    quantidade_clt += 1
                else:
                    quantidade_pj += 1
                resultado = await atualizar_status_resultado(
                    conexao,
                    ESQUEMA_COMISSIONAMENTO,
                    antes["id"],
                    status="enviada_pagamento",
                    status_financeiro="pacote_enviado",
                    status_pagamento="aguardando_pagamento",
                    status_nf="nao_aplicavel" if _eh_clt(antes) else None,
                )
                depois = {
                    **antes,
                    "status": "enviada_pagamento",
                    "status_financeiro": "pacote_enviado",
                    "status_pagamento": "aguardando_pagamento",
                    "status_nf": "nao_aplicavel" if _eh_clt(antes) else antes.get("status_nf"),
                }
                evento = await _registrar_acao_auditavel(
                    conexao,
                    request=request,
                    usuario=usuario,
                    tipo_evento="pacote_enviado",
                    antes=antes,
                    depois=depois,
                    comentario=_comentario(corpo),
                    idempotency_key=chave,
                )
                resultados.append(resultado)
                eventos.append({"evento": evento})
            notificacoes_consolidadas = []
            if quantidade_pj:
                pacote_antes = {"id": f"pacote-{ciclo_id}-pj", "ciclo_id": ciclo_id, "status": "pronta_para_envio_pagamento"}
                pacote_depois = {"id": f"pacote-{ciclo_id}-pj", "ciclo_id": ciclo_id, "status": "enviada_pagamento"}
                notificacoes_consolidadas.append(await criar_notificacao_de_acao(
                    conexao,
                    ESQUEMA_COMISSIONAMENTO,
                    acao="enviar_pacote_pagamento",
                    evento_negocio_id=None,
                    antes=pacote_antes,
                    depois=pacote_depois,
                    exige_nf=True,
                    comentario=_comentario(corpo),
                    idempotency_key=f"{chave}:pacote-pj" if chave else None,
                    usuario_id=usuario.get("identificador_usuario"),
                    quantidade_itens=quantidade_pj,
                    destino_pacote="Financeiro",
                ))
            if quantidade_clt:
                pacote_antes = {"id": f"pacote-{ciclo_id}-clt", "ciclo_id": ciclo_id, "status": "pronta_para_envio_pagamento"}
                pacote_depois = {"id": f"pacote-{ciclo_id}-clt", "ciclo_id": ciclo_id, "status": "enviada_pagamento"}
                notificacoes_consolidadas.append(await criar_notificacao_de_acao(
                    conexao,
                    ESQUEMA_COMISSIONAMENTO,
                    acao="enviar_pacote_pagamento",
                    evento_negocio_id=None,
                    antes=pacote_antes,
                    depois=pacote_depois,
                    exige_nf=False,
                    comentario=_comentario(corpo),
                    idempotency_key=f"{chave}:pacote-clt" if chave else None,
                    usuario_id=usuario.get("identificador_usuario"),
                    quantidade_itens=quantidade_clt,
                    destino_pacote="RH e Financeiro",
                ))
            resposta = {
                "status": "ok",
                "acao": "enviar_pacote_pagamento",
                "ciclo_id": ciclo_id,
                "resultados": resultados,
                "eventos": eventos,
                "notificacoes": notificacoes_consolidadas,
            }
            await salvar_resposta_idempotente(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                chave=chave,
                rota=rota,
                usuario_id=usuario.get("identificador_usuario"),
                resposta=resposta,
            )
            return resposta


@rotas_de_comissionamento.post("/comissionamento/regras/{regra_id}/publicar")
async def publicar_regra_comissionamento(
    regra_id: str,
    corpo: CorpoPublicacaoRegra,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    _validar_publicacao_regra(corpo)
    chave = _idempotency_key(request)
    rota = f"{request.method}:{request.url.path}:publicar_regra"
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "comissionamento.secretaria",
            "Você não tem permissão para publicar regras de comissionamento.",
        )
        async with conexao.transaction():
            resposta_existente = await buscar_resposta_idempotente(conexao, ESQUEMA_COMISSIONAMENTO, chave, rota)
            if resposta_existente:
                return resposta_existente
            payload = {
                "ciclo_id": corpo.ciclo_id,
                "comissionado_id": corpo.comissionado_id,
                "comissionado_nome": corpo.comissionado_nome,
                "regra_tipo": corpo.regra_tipo,
                "regra_01": corpo.regra_01,
                "regra_02": corpo.regra_02,
                "regra_02_ips": corpo.regra_02_ips,
                "regra_02_ips_removidos": corpo.regra_02_ips_removidos,
                **(corpo.payload or {}),
            }
            if not corpo.ciclo_id or not corpo.comissionado_id:
                raise HTTPException(status_code=422, detail="Ciclo e comissionado são obrigatórios para publicar regras.")
            resultado_base = await buscar_resultado_por_id(conexao, ESQUEMA_COMISSIONAMENTO, corpo.comissionado_id)
            if _regra_bloqueada_para_edicao(resultado_base):
                raise HTTPException(
                    status_code=409,
                    detail="A regra só pode ser editada quando a comissão estiver na etapa Calculada/Revisão.",
                )
            regra_tipo_publicada = corpo.regra_tipo or ("regra_02" if "regra_02" in regra_id else "regra_01")
            regra_nome = "Regra 01" if regra_tipo_publicada == "regra_01" else "Regra 02"
            campo_regra = "escada" if regra_tipo_publicada == "regra_01" else "ips"
            regra_publicada = await salvar_publicacao_regra(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                ciclo_id=corpo.ciclo_id,
                comissionado_id=corpo.comissionado_id,
                comissionado_nome=corpo.comissionado_nome,
                regra_tipo=regra_tipo_publicada,
                regra_01=corpo.regra_01,
                regra_02=corpo.regra_02,
                regra_02_ips=corpo.regra_02_ips,
                regra_02_ips_removidos=corpo.regra_02_ips_removidos,
                payload=payload,
                motivo=corpo.motivo,
                comentario=corpo.comentario,
                usuario_id=usuario.get("identificador_usuario"),
            )
            resultado_atualizado = await buscar_resultado_por_id(conexao, ESQUEMA_COMISSIONAMENTO, corpo.comissionado_id)
            antes = {
                **(payload.get("antes") or {}),
                "id": corpo.comissionado_id,
                "resultado_id": corpo.comissionado_id,
                "ciclo_id": corpo.ciclo_id,
                "nome": corpo.comissionado_nome,
                "status": "regra_anterior",
                "regra": regra_nome,
                "valor_bruto": resultado_base.get("valor_bruto") if resultado_base else None,
                "valor_liquido": resultado_base.get("valor_liquido") if resultado_base else None,
                "valores": (resultado_base or {}).get("valores"),
            }
            depois = {
                **(payload.get("depois") or {}),
                "id": corpo.comissionado_id,
                "resultado_id": corpo.comissionado_id,
                "ciclo_id": corpo.ciclo_id,
                "nome": corpo.comissionado_nome,
                "status": "regra_publicada",
                "regra": regra_nome,
                "valor_bruto": (resultado_atualizado or {}).get("valor_bruto"),
                "valor_liquido": (resultado_atualizado or {}).get("valor_liquido"),
                "valores": (resultado_atualizado or {}).get("valores"),
            }
            evento = await registrar_evento_comissionamento(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                tipo_evento="regra_01_publicada" if regra_tipo_publicada == "regra_01" else "regra_02_publicada",
                usuario_id=usuario.get("identificador_usuario"),
                sessao_id=usuario.get("identificador_sessao"),
                endereco_ip=_cliente_ip(request),
                agente_do_usuario=_agente_usuario(request),
                antes=antes,
                depois=depois,
                comentario=corpo.comentario or corpo.motivo,
                regra=regra_nome,
                campo=campo_regra,
                idempotency_key=chave,
            )
            await registrar_evento(
                conexao,
                "comissionamento.regra.publicada",
                usuario.get("identificador_usuario"),
                usuario.get("identificador_sessao"),
                "Publicação de regra de comissionamento registrada pela Secretaria.",
                {
                    "regra_id": regra_id,
                    "regra_publicada": regra_publicada,
                    "tipo_evento_ui": "regra_01_publicada" if regra_tipo_publicada == "regra_01" else "regra_02_publicada",
                    "motivo": corpo.motivo,
                    "comentario": corpo.comentario,
                    "ciclo_id": corpo.ciclo_id,
                    "comissionado_id": corpo.comissionado_id,
                    "resultado_id": corpo.comissionado_id,
                    "comissionado_nome": corpo.comissionado_nome,
                    "regra": regra_nome,
                    "campo": campo_regra,
                    "payload": payload,
                    "idempotency_key": chave,
                },
                _cliente_ip(request),
                _agente_usuario(request),
            )
            depois_notificacao = {
                **depois,
                **(resultado_atualizado or {}),
                "status": "regra_publicada",
                "regra": regra_nome,
            }
            antes_notificacao = {
                **antes,
                "email": depois_notificacao.get("email") or antes.get("email"),
                "codigo_comissao": depois_notificacao.get("codigo_comissao") or antes.get("codigo_comissao"),
            }
            alteracoes_texto = _resumo_alteracoes_regra(
                regra_nome=regra_nome,
                antes=antes_notificacao,
                depois=depois_notificacao,
                regra_01=corpo.regra_01,
                regra_02=corpo.regra_02,
                regra_02_ips=corpo.regra_02_ips,
                regra_02_ips_removidos=corpo.regra_02_ips_removidos,
            )
            notificacao_regra = await criar_notificacao_de_acao(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                acao="publicar_regra",
                evento_negocio_id=evento.get("id"),
                antes=antes_notificacao,
                depois=depois_notificacao,
                exige_nf=bool(depois_notificacao.get("exige_nf", True)),
                comentario=corpo.comentario or corpo.motivo,
                idempotency_key=f"{chave}:regra-publicada-comissionado" if chave else None,
                usuario_id=usuario.get("identificador_usuario"),
                origem="publicacao_regra",
                extra_payload={
                    "nome_destinatario": depois_notificacao.get("nome") or corpo.comissionado_nome,
                    "regra": regra_nome,
                    "campo": campo_regra,
                    "alteracoes_texto": alteracoes_texto,
                    "estado_atual_regra": "Disponível no portal em sua comissão.",
                    "acao_executada_por_nome": _nome_usuario_autenticado(usuario),
                    "acao_executada_por_email": await _email_usuario_autenticado(conexao, usuario),
                    "acao_executada_por_perfil": _perfil_usuario_autenticado(usuario),
                },
            )
            if notificacao_regra and notificacao_regra.get("filas"):
                filas_ids = [fila["id"] for fila in notificacao_regra.get("filas") or [] if fila.get("id")]
                envio_notificacao = await processar_filas_especificas(conexao, ESQUEMA_COMISSIONAMENTO, filas_ids)
                notificacao_regra = {**notificacao_regra, "envio": envio_notificacao}
            resposta = {
                "status": "publicacao_registrada",
                "regra_id": regra_id,
                "regra_publicada": regra_publicada,
                "motivo": corpo.motivo,
                "comissionado_id": corpo.comissionado_id,
                "resultado": resultado_atualizado,
                "evento": evento,
                "notificacao": notificacao_regra,
                "idempotency_key": chave,
                "mensagem": "Publicação salva e registrada no histórico.",
            }
            await salvar_resposta_idempotente(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                chave=chave,
                rota=rota,
                usuario_id=usuario.get("identificador_usuario"),
                resposta=resposta,
            )
            return resposta

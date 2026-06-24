"""
Persistencia do modulo de clientes (comercial).
"""

from __future__ import annotations

import json


CAMPOS_CLIENTE_SQL = """
    identificador_cliente::text as identificador_cliente,
    nome_completo,
    data_nascimento,
    sexo,
    cpf,
    cpf_normalizado,
    rg,
    estado_civil,
    regime_casamento,
    nacionalidade,
    nome_mae,
    nome_pai,
    email,
    telefone,
    celular,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    tempo_residencia_anos,
    renda_principal,
    renda_conjuge,
    outras_rendas,
    renda_total,
    moradores,
    dependentes,
    filhos,
    profissao,
    empresa,
    cargo,
    tempo_emprego_anos,
    tipo_contrato,
    escolaridade,
    situacao_moradia,
    imovel_proprio,
    veiculo,
    financiamentos,
    renda_formal,
    renda_informal,
    cartao_credito,
    aluguel_financiamento,
    despesas_fixas,
    despesas_variaveis,
    documentacao_pendente,
    status_documental,
    observacoes,
    coalesce(parametros_simulacao, '{}'::jsonb) as parametros_simulacao,
    identificador_usuario_cadastro::text as identificador_usuario_cadastro,
    usuario_cadastro_nome,
    usuario_cadastro_email,
    data_hora_criacao,
    data_hora_atualizado_em
"""

CAMPOS_CLIENTE_SQL_COM_ALIAS = """
    c.identificador_cliente::text as identificador_cliente,
    c.nome_completo,
    c.data_nascimento,
    nullif(trim(coalesce(to_jsonb(c)->>'sexo', '')), '') as sexo,
    c.cpf,
    nullif(trim(coalesce(to_jsonb(c)->>'cpf_normalizado', '')), '') as cpf_normalizado,
    c.rg,
    c.estado_civil,
    nullif(trim(coalesce(to_jsonb(c)->>'regime_casamento', '')), '') as regime_casamento,
    c.nacionalidade,
    nullif(trim(coalesce(to_jsonb(c)->>'nome_mae', '')), '') as nome_mae,
    nullif(trim(coalesce(to_jsonb(c)->>'nome_pai', '')), '') as nome_pai,
    c.email,
    c.telefone,
    c.celular,
    c.cep,
    c.logradouro,
    c.numero,
    c.complemento,
    c.bairro,
    c.cidade,
    c.estado,
    c.tempo_residencia_anos,
    c.renda_principal,
    c.renda_conjuge,
    c.outras_rendas,
    c.renda_total,
    c.moradores,
    c.dependentes,
    c.filhos,
    c.profissao,
    c.empresa,
    c.cargo,
    c.tempo_emprego_anos,
    c.tipo_contrato,
    nullif(trim(coalesce(to_jsonb(c)->>'escolaridade', '')), '') as escolaridade,
    nullif(trim(coalesce(to_jsonb(c)->>'situacao_moradia', '')), '') as situacao_moradia,
    c.imovel_proprio,
    c.veiculo,
    c.financiamentos,
    nullif(trim(coalesce(to_jsonb(c)->>'renda_formal', '')), '')::numeric as renda_formal,
    nullif(trim(coalesce(to_jsonb(c)->>'renda_informal', '')), '')::numeric as renda_informal,
    c.cartao_credito,
    c.aluguel_financiamento,
    c.despesas_fixas,
    c.despesas_variaveis,
    nullif(trim(coalesce(to_jsonb(c)->>'documentacao_pendente', '')), '') as documentacao_pendente,
    nullif(trim(coalesce(to_jsonb(c)->>'status_documental', '')), '') as status_documental,
    c.observacoes,
    coalesce(to_jsonb(c)->'parametros_simulacao', '{}'::jsonb) as parametros_simulacao,
    (to_jsonb(c)->>'identificador_usuario_cadastro') as identificador_usuario_cadastro,
    nullif(trim(coalesce(to_jsonb(c)->>'usuario_cadastro_nome', '')), '') as usuario_cadastro_nome,
    nullif(trim(coalesce(to_jsonb(c)->>'usuario_cadastro_email', '')), '') as usuario_cadastro_email,
    c.data_hora_criacao,
    c.data_hora_atualizado_em
"""

CAMPOS_CLIENTE_MIDIA_SQL_COM_ALIAS = """
    foto_principal.identificador_midia::text as foto_principal_id,
    foto_principal.caminho_arquivo as foto_principal,
    foto_principal.nome_arquivo as foto_principal_nome,
    coalesce(documentos.quantidade_documentos, 0) as quantidade_documentos
"""


async def criar_cliente(conexao, esquema: str, payload: dict):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.cliente (
            nome_completo,
            data_nascimento,
            sexo,
            cpf,
            cpf_normalizado,
            rg,
            estado_civil,
            regime_casamento,
            nacionalidade,
            nome_mae,
            nome_pai,
            email,
            telefone,
            celular,
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            tempo_residencia_anos,
            renda_principal,
            renda_conjuge,
            outras_rendas,
            renda_total,
            moradores,
            dependentes,
            filhos,
            profissao,
            empresa,
            cargo,
            tempo_emprego_anos,
            tipo_contrato,
            escolaridade,
            situacao_moradia,
            imovel_proprio,
            veiculo,
            financiamentos,
            renda_formal,
            renda_informal,
            cartao_credito,
            aluguel_financiamento,
            despesas_fixas,
            despesas_variaveis,
            documentacao_pendente,
            status_documental,
            observacoes,
            parametros_simulacao,
            identificador_usuario_cadastro,
            usuario_cadastro_nome,
            usuario_cadastro_email
        )
        values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
            $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,
            $38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49::jsonb,$50::uuid,$51,$52
        )
        returning {CAMPOS_CLIENTE_SQL}
        """,
        payload["nome_completo"],
        payload["data_nascimento"],
        payload["sexo"],
        payload["cpf"],
        payload["cpf_normalizado"],
        payload["rg"],
        payload["estado_civil"],
        payload["regime_casamento"],
        payload["nacionalidade"],
        payload["nome_mae"],
        payload["nome_pai"],
        payload["email"],
        payload["telefone"],
        payload["celular"],
        payload["cep"],
        payload["logradouro"],
        payload["numero"],
        payload["complemento"],
        payload["bairro"],
        payload["cidade"],
        payload["estado"],
        payload["tempo_residencia_anos"],
        payload["renda_principal"],
        payload["renda_conjuge"],
        payload["outras_rendas"],
        payload["renda_total"],
        payload["moradores"],
        payload["dependentes"],
        payload["filhos"],
        payload["profissao"],
        payload["empresa"],
        payload["cargo"],
        payload["tempo_emprego_anos"],
        payload["tipo_contrato"],
        payload["escolaridade"],
        payload["situacao_moradia"],
        payload["imovel_proprio"],
        payload["veiculo"],
        payload["financiamentos"],
        payload["renda_formal"],
        payload["renda_informal"],
        payload["cartao_credito"],
        payload["aluguel_financiamento"],
        payload["despesas_fixas"],
        payload["despesas_variaveis"],
        payload["documentacao_pendente"],
        payload["status_documental"],
        payload["observacoes"],
        json.dumps(payload.get("parametros_simulacao") or {}),
        payload.get("identificador_usuario_cadastro"),
        payload.get("usuario_cadastro_nome"),
        payload.get("usuario_cadastro_email"),
    )


async def atualizar_cliente(conexao, esquema: str, identificador_cliente: str, payload: dict):
    return await conexao.fetchrow(
        f"""
        update {esquema}.cliente c
           set nome_completo = $2,
               data_nascimento = $3,
               sexo = $4,
               cpf = $5,
               cpf_normalizado = $6,
               rg = $7,
               estado_civil = $8,
               regime_casamento = $9,
               nacionalidade = $10,
               nome_mae = $11,
               nome_pai = $12,
               email = $13,
               telefone = $14,
               celular = $15,
               cep = $16,
               logradouro = $17,
               numero = $18,
               complemento = $19,
               bairro = $20,
               cidade = $21,
               estado = $22,
               tempo_residencia_anos = $23,
               renda_principal = $24,
               renda_conjuge = $25,
               outras_rendas = $26,
               renda_total = $27,
               moradores = $28,
               dependentes = $29,
               filhos = $30,
               profissao = $31,
               empresa = $32,
               cargo = $33,
               tempo_emprego_anos = $34,
               tipo_contrato = $35,
               escolaridade = $36,
               situacao_moradia = $37,
               imovel_proprio = $38,
               veiculo = $39,
               financiamentos = $40,
               renda_formal = $41,
               renda_informal = $42,
               cartao_credito = $43,
               aluguel_financiamento = $44,
               despesas_fixas = $45,
               despesas_variaveis = $46,
               documentacao_pendente = $47,
               status_documental = $48,
               observacoes = $49,
               parametros_simulacao = $50::jsonb
         where c.identificador_cliente = $1::uuid
         returning {CAMPOS_CLIENTE_SQL}
        """,
        identificador_cliente,
        payload["nome_completo"],
        payload["data_nascimento"],
        payload["sexo"],
        payload["cpf"],
        payload["cpf_normalizado"],
        payload["rg"],
        payload["estado_civil"],
        payload["regime_casamento"],
        payload["nacionalidade"],
        payload["nome_mae"],
        payload["nome_pai"],
        payload["email"],
        payload["telefone"],
        payload["celular"],
        payload["cep"],
        payload["logradouro"],
        payload["numero"],
        payload["complemento"],
        payload["bairro"],
        payload["cidade"],
        payload["estado"],
        payload["tempo_residencia_anos"],
        payload["renda_principal"],
        payload["renda_conjuge"],
        payload["outras_rendas"],
        payload["renda_total"],
        payload["moradores"],
        payload["dependentes"],
        payload["filhos"],
        payload["profissao"],
        payload["empresa"],
        payload["cargo"],
        payload["tempo_emprego_anos"],
        payload["tipo_contrato"],
        payload["escolaridade"],
        payload["situacao_moradia"],
        payload["imovel_proprio"],
        payload["veiculo"],
        payload["financiamentos"],
        payload["renda_formal"],
        payload["renda_informal"],
        payload["cartao_credito"],
        payload["aluguel_financiamento"],
        payload["despesas_fixas"],
        payload["despesas_variaveis"],
        payload["documentacao_pendente"],
        payload["status_documental"],
        payload["observacoes"],
        json.dumps(payload.get("parametros_simulacao") or {}),
    )


async def atualizar_renda_total(conexao, esquema: str, identificador_cliente: str, renda_total):
    return await conexao.fetchrow(
        f"""
        update {esquema}.cliente c
           set renda_total = $2
         where c.identificador_cliente = $1::uuid
         returning {CAMPOS_CLIENTE_SQL}
        """,
        identificador_cliente,
        renda_total,
    )


async def buscar_cliente_por_id(
    conexao,
    esquema: str,
    identificador_cliente: str,
    *,
    identificador_usuario_visibilidade: str | None = None,
    pode_ver_todos: bool = True,
):
    return await conexao.fetchrow(
        f"""
        select
            {CAMPOS_CLIENTE_SQL_COM_ALIAS},
            {CAMPOS_CLIENTE_MIDIA_SQL_COM_ALIAS}
        from {esquema}.cliente c
        left join lateral (
            select
                cm.identificador_midia,
                cm.caminho_arquivo,
                cm.nome_arquivo
            from {esquema}.cliente_midia cm
            where cm.identificador_cliente = c.identificador_cliente
              and cm.tipo_arquivo = 'foto'
            order by cm.data_hora_criacao desc, cm.identificador_midia desc
            limit 1
        ) foto_principal on true
        left join lateral (
            select count(*)::int as quantidade_documentos
            from {esquema}.cliente_midia cm
            where cm.identificador_cliente = c.identificador_cliente
              and cm.tipo_arquivo = 'documento'
        ) documentos on true
        where c.identificador_cliente = $1::uuid
          and ($2::boolean = true or c.identificador_usuario_cadastro = $3::uuid)
        limit 1
        """,
        identificador_cliente,
        bool(pode_ver_todos),
        identificador_usuario_visibilidade,
    )


async def buscar_cliente_por_cpf_normalizado(
    conexao,
    esquema: str,
    cpf_normalizado: str,
    *,
    ignorar_identificador_cliente: str | None = None,
):
    if ignorar_identificador_cliente:
        return await conexao.fetchrow(
            f"""
            select {CAMPOS_CLIENTE_SQL_COM_ALIAS}
            from {esquema}.cliente c
            where coalesce(
                    nullif(to_jsonb(c)->>'cpf_normalizado', ''),
                    nullif(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g'), '')
                  ) = $1
              and c.identificador_cliente <> $2::uuid
            limit 1
            """,
            cpf_normalizado,
            ignorar_identificador_cliente,
        )

    return await conexao.fetchrow(
        f"""
        select {CAMPOS_CLIENTE_SQL_COM_ALIAS}
        from {esquema}.cliente c
        where coalesce(
                nullif(to_jsonb(c)->>'cpf_normalizado', ''),
                nullif(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g'), '')
              ) = $1
        limit 1
        """,
        cpf_normalizado,
    )


async def listar_clientes(
    conexao,
    esquema: str,
    *,
    busca: str,
    limite: int,
    deslocamento: int,
    identificador_usuario_visibilidade: str | None = None,
    pode_ver_todos: bool = True,
):
    return await conexao.fetch(
        f"""
        select
            {CAMPOS_CLIENTE_SQL_COM_ALIAS},
            {CAMPOS_CLIENTE_MIDIA_SQL_COM_ALIAS}
        from {esquema}.cliente c
        left join lateral (
            select
                cm.identificador_midia,
                cm.caminho_arquivo,
                cm.nome_arquivo
            from {esquema}.cliente_midia cm
            where cm.identificador_cliente = c.identificador_cliente
              and cm.tipo_arquivo = 'foto'
            order by cm.data_hora_criacao desc, cm.identificador_midia desc
            limit 1
        ) foto_principal on true
        left join lateral (
            select count(*)::int as quantidade_documentos
            from {esquema}.cliente_midia cm
            where cm.identificador_cliente = c.identificador_cliente
              and cm.tipo_arquivo = 'documento'
        ) documentos on true
        where (
              $1 = '%%'
              or c.nome_completo ilike $1
              or c.cpf ilike $1
              or coalesce(to_jsonb(c)->>'cpf_normalizado', '') ilike $1
              or c.email ilike $1
              or c.cidade ilike $1
        )
          and ($4::boolean = true or c.identificador_usuario_cadastro = $5::uuid)
        order by c.data_hora_criacao desc
        offset $2
        limit $3
        """,
        busca,
        deslocamento,
        limite,
        bool(pode_ver_todos),
        identificador_usuario_visibilidade,
    )


async def contar_clientes(
    conexao,
    esquema: str,
    *,
    busca: str,
    identificador_usuario_visibilidade: str | None = None,
    pode_ver_todos: bool = True,
):
    return int(
        await conexao.fetchval(
            f"""
            select count(*)::int
            from {esquema}.cliente c
            where (
                  $1 = '%%'
                  or c.nome_completo ilike $1
                  or c.cpf ilike $1
                  or coalesce(to_jsonb(c)->>'cpf_normalizado', '') ilike $1
                  or c.email ilike $1
                  or c.cidade ilike $1
            )
              and ($2::boolean = true or c.identificador_usuario_cadastro = $3::uuid)
            """,
            busca,
            bool(pode_ver_todos),
            identificador_usuario_visibilidade,
        )
        or 0
    )


async def excluir_cliente(conexao, esquema: str, identificador_cliente: str):
    return await conexao.fetchrow(
        f"""
        delete from {esquema}.cliente
        where identificador_cliente = $1::uuid
        returning identificador_cliente::text as identificador_cliente
        """,
        identificador_cliente,
    )


async def listar_midias_cliente(
    conexao,
    esquema: str,
    identificador_cliente: str,
    *,
    tipo_arquivo: str | None = None,
):
    return await conexao.fetch(
        f"""
        select
            identificador_midia::text as identificador_midia,
            identificador_cliente::text as identificador_cliente,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        from {esquema}.cliente_midia
        where identificador_cliente = $1::uuid
          and ($2::text is null or tipo_arquivo = $2)
        order by
            case when tipo_arquivo = 'foto' then 0 else 1 end,
            data_hora_criacao desc,
            identificador_midia desc
        """,
        identificador_cliente,
        tipo_arquivo,
    )


async def inserir_midia_cliente(
    conexao,
    esquema: str,
    *,
    identificador_cliente: str,
    tipo_arquivo: str,
    nome_arquivo: str,
    caminho_arquivo: str,
    mime_type: str,
    tamanho_bytes: int,
):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.cliente_midia (
            identificador_cliente,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes
        )
        values ($1::uuid, $2, $3, $4, $5, $6)
        returning
            identificador_midia::text as identificador_midia,
            identificador_cliente::text as identificador_cliente,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        """,
        identificador_cliente,
        tipo_arquivo,
        nome_arquivo,
        caminho_arquivo,
        mime_type,
        tamanho_bytes,
    )


async def buscar_midia_cliente(
    conexao,
    esquema: str,
    *,
    identificador_cliente: str,
    identificador_midia: str,
    tipo_arquivo: str | None = None,
):
    return await conexao.fetchrow(
        f"""
        select
            identificador_midia::text as identificador_midia,
            identificador_cliente::text as identificador_cliente,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        from {esquema}.cliente_midia
        where identificador_cliente = $1::uuid
          and identificador_midia = $2::uuid
          and ($3::text is null or tipo_arquivo = $3)
        limit 1
        """,
        identificador_cliente,
        identificador_midia,
        tipo_arquivo,
    )


async def excluir_midia_cliente(
    conexao,
    esquema: str,
    *,
    identificador_cliente: str,
    identificador_midia: str,
    tipo_arquivo: str | None = None,
):
    return await conexao.fetchrow(
        f"""
        delete from {esquema}.cliente_midia
        where identificador_cliente = $1::uuid
          and identificador_midia = $2::uuid
          and ($3::text is null or tipo_arquivo = $3)
        returning
            identificador_midia::text as identificador_midia,
            identificador_cliente::text as identificador_cliente,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        """,
        identificador_cliente,
        identificador_midia,
        tipo_arquivo,
    )


async def excluir_midias_cliente_por_tipo(
    conexao,
    esquema: str,
    *,
    identificador_cliente: str,
    tipo_arquivo: str,
):
    return await conexao.fetch(
        f"""
        delete from {esquema}.cliente_midia
        where identificador_cliente = $1::uuid
          and tipo_arquivo = $2
        returning
            identificador_midia::text as identificador_midia,
            identificador_cliente::text as identificador_cliente,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        """,
        identificador_cliente,
        tipo_arquivo,
    )

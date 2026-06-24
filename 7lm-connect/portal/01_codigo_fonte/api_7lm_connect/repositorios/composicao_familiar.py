"""
Persistencia da composição familiar vinculada ao cliente principal.
"""

from __future__ import annotations


CAMPOS_MEMBRO_SQL = """
    identificador_membro::text as identificador_membro,
    identificador_cliente_principal::text as identificador_cliente_principal,
    nome_completo,
    cpf,
    cpf_normalizado,
    rg,
    data_nascimento,
    sexo,
    estado_civil,
    regime_casamento,
    nacionalidade,
    nome_mae,
    nome_pai,
    parentesco,
    telefone,
    celular,
    email,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    mora_com_cliente_principal,
    usar_endereco_cliente_principal,
    renda_mensal,
    outras_rendas,
    renda_total,
    renda_formal,
    renda_informal,
    despesas_fixas,
    despesas_variaveis,
    financiamentos,
    profissao,
    ocupacao,
    empresa_atual,
    cargo,
    tempo_emprego_anos,
    tipo_contrato,
    escolaridade,
    situacao_moradia,
    compoe_renda,
    incluir_na_analise,
    incluir_na_composicao_financeira,
    incluir_na_confissao_divida,
    responsavel_documentacao,
    principal_comprador,
    documentacao_pendente,
    status_documental,
    observacoes,
    ativo,
    data_hora_desativacao,
    data_hora_criacao,
    data_hora_atualizado_em
"""

CAMPOS_MEMBRO_SQL_COM_ALIAS = """
    cf.identificador_membro::text as identificador_membro,
    cf.identificador_cliente_principal::text as identificador_cliente_principal,
    cf.nome_completo,
    cf.cpf,
    cf.cpf_normalizado,
    cf.rg,
    cf.data_nascimento,
    cf.sexo,
    cf.estado_civil,
    cf.regime_casamento,
    cf.nacionalidade,
    cf.nome_mae,
    cf.nome_pai,
    cf.parentesco,
    cf.telefone,
    cf.celular,
    cf.email,
    cf.cep,
    cf.logradouro,
    cf.numero,
    cf.complemento,
    cf.bairro,
    cf.cidade,
    cf.estado,
    cf.mora_com_cliente_principal,
    cf.usar_endereco_cliente_principal,
    cf.renda_mensal,
    cf.outras_rendas,
    cf.renda_total,
    cf.renda_formal,
    cf.renda_informal,
    cf.despesas_fixas,
    cf.despesas_variaveis,
    cf.financiamentos,
    cf.profissao,
    cf.ocupacao,
    cf.empresa_atual,
    cf.cargo,
    cf.tempo_emprego_anos,
    cf.tipo_contrato,
    cf.escolaridade,
    cf.situacao_moradia,
    cf.compoe_renda,
    cf.incluir_na_analise,
    cf.incluir_na_composicao_financeira,
    cf.incluir_na_confissao_divida,
    cf.responsavel_documentacao,
    cf.principal_comprador,
    cf.documentacao_pendente,
    cf.status_documental,
    cf.observacoes,
    cf.ativo,
    cf.data_hora_desativacao,
    cf.data_hora_criacao,
    cf.data_hora_atualizado_em
"""

COLUNAS_PERSISTENCIA_MEMBRO = [
    "nome_completo",
    "cpf",
    "cpf_normalizado",
    "rg",
    "data_nascimento",
    "sexo",
    "estado_civil",
    "regime_casamento",
    "nacionalidade",
    "nome_mae",
    "nome_pai",
    "parentesco",
    "telefone",
    "celular",
    "email",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "mora_com_cliente_principal",
    "usar_endereco_cliente_principal",
    "renda_mensal",
    "outras_rendas",
    "renda_total",
    "renda_formal",
    "renda_informal",
    "despesas_fixas",
    "despesas_variaveis",
    "financiamentos",
    "profissao",
    "ocupacao",
    "empresa_atual",
    "cargo",
    "tempo_emprego_anos",
    "tipo_contrato",
    "escolaridade",
    "situacao_moradia",
    "compoe_renda",
    "incluir_na_analise",
    "incluir_na_composicao_financeira",
    "incluir_na_confissao_divida",
    "responsavel_documentacao",
    "principal_comprador",
    "documentacao_pendente",
    "status_documental",
    "observacoes",
    "ativo",
]


def _valores_payload(payload: dict) -> list:
    return [payload.get(coluna) for coluna in COLUNAS_PERSISTENCIA_MEMBRO]


async def listar_membros_cliente(
    conexao,
    esquema: str,
    identificador_cliente_principal: str,
    *,
    incluir_inativos: bool = True,
):
    if incluir_inativos:
        return await conexao.fetch(
            f"""
            select {CAMPOS_MEMBRO_SQL_COM_ALIAS}
            from {esquema}.composicao_familiar_cliente cf
            where cf.identificador_cliente_principal = $1::uuid
            order by cf.data_hora_criacao asc
            """,
            identificador_cliente_principal,
        )

    return await conexao.fetch(
        f"""
        select {CAMPOS_MEMBRO_SQL_COM_ALIAS}
        from {esquema}.composicao_familiar_cliente cf
        where cf.identificador_cliente_principal = $1::uuid
          and cf.ativo = true
        order by cf.data_hora_criacao asc
        """,
        identificador_cliente_principal,
    )


async def buscar_membro_por_id(
    conexao,
    esquema: str,
    identificador_cliente_principal: str,
    identificador_membro: str,
):
    return await conexao.fetchrow(
        f"""
        select {CAMPOS_MEMBRO_SQL_COM_ALIAS}
        from {esquema}.composicao_familiar_cliente cf
        where cf.identificador_cliente_principal = $1::uuid
          and cf.identificador_membro = $2::uuid
        limit 1
        """,
        identificador_cliente_principal,
        identificador_membro,
    )


async def buscar_membro_ativo_por_cpf_normalizado(
    conexao,
    esquema: str,
    cpf_normalizado: str,
    *,
    ignorar_identificador_membro: str | None = None,
):
    if ignorar_identificador_membro:
        return await conexao.fetchrow(
            f"""
            select {CAMPOS_MEMBRO_SQL_COM_ALIAS}
            from {esquema}.composicao_familiar_cliente cf
            where cf.cpf_normalizado = $1
              and cf.ativo = true
              and cf.identificador_membro <> $2::uuid
            limit 1
            """,
            cpf_normalizado,
            ignorar_identificador_membro,
        )

    return await conexao.fetchrow(
        f"""
        select {CAMPOS_MEMBRO_SQL_COM_ALIAS}
        from {esquema}.composicao_familiar_cliente cf
        where cf.cpf_normalizado = $1
          and cf.ativo = true
        limit 1
        """,
        cpf_normalizado,
    )


async def criar_membro(conexao, esquema: str, payload: dict):
    colunas = ",\n            ".join(["identificador_cliente_principal", *COLUNAS_PERSISTENCIA_MEMBRO])
    placeholders = ", ".join(f"${indice}" for indice in range(1, len(COLUNAS_PERSISTENCIA_MEMBRO) + 2))
    valores = [payload["identificador_cliente_principal"], *_valores_payload(payload)]

    return await conexao.fetchrow(
        f"""
        insert into {esquema}.composicao_familiar_cliente (
            {colunas}
        )
        values ({placeholders})
        returning {CAMPOS_MEMBRO_SQL}
        """,
        *valores,
    )


async def atualizar_membro(
    conexao,
    esquema: str,
    identificador_cliente_principal: str,
    identificador_membro: str,
    payload: dict,
):
    set_sql = ",\n               ".join(
        f"{coluna} = ${indice}"
        for indice, coluna in enumerate(COLUNAS_PERSISTENCIA_MEMBRO, start=3)
    )
    valores = [identificador_cliente_principal, identificador_membro, *_valores_payload(payload)]

    return await conexao.fetchrow(
        f"""
        update {esquema}.composicao_familiar_cliente
           set {set_sql},
               data_hora_desativacao = case
                 when $52 = true then null
                 else coalesce(data_hora_desativacao, now())
               end
         where identificador_cliente_principal = $1::uuid
           and identificador_membro = $2::uuid
         returning {CAMPOS_MEMBRO_SQL}
        """,
        *valores,
    )


async def atualizar_flags_membro(
    conexao,
    esquema: str,
    identificador_cliente_principal: str,
    identificador_membro: str,
    payload: dict,
):
    return await conexao.fetchrow(
        f"""
        update {esquema}.composicao_familiar_cliente
           set compoe_renda = coalesce($3, compoe_renda),
               incluir_na_analise = coalesce($4, incluir_na_analise),
               incluir_na_composicao_financeira = coalesce($5, incluir_na_composicao_financeira),
               incluir_na_confissao_divida = coalesce($6, incluir_na_confissao_divida),
               responsavel_documentacao = coalesce($7, responsavel_documentacao),
               principal_comprador = coalesce($8, principal_comprador)
         where identificador_cliente_principal = $1::uuid
           and identificador_membro = $2::uuid
         returning {CAMPOS_MEMBRO_SQL}
        """,
        identificador_cliente_principal,
        identificador_membro,
        payload.get("compoe_renda"),
        payload.get("incluir_na_analise"),
        payload.get("incluir_na_composicao_financeira"),
        payload.get("incluir_na_confissao_divida"),
        payload.get("responsavel_documentacao"),
        payload.get("principal_comprador"),
    )


async def atualizar_status_membro(
    conexao,
    esquema: str,
    identificador_cliente_principal: str,
    identificador_membro: str,
    ativo: bool,
):
    return await conexao.fetchrow(
        f"""
        update {esquema}.composicao_familiar_cliente
           set ativo = $3,
               data_hora_desativacao = case when $3 then null else now() end
         where identificador_cliente_principal = $1::uuid
           and identificador_membro = $2::uuid
         returning {CAMPOS_MEMBRO_SQL}
        """,
        identificador_cliente_principal,
        identificador_membro,
        ativo,
    )

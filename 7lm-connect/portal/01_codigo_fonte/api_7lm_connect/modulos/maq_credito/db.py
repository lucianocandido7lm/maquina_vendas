from collections.abc import Iterable
from typing import Any

import psycopg
from psycopg.rows import dict_row

from configuracoes import (
    ESQUEMA_MAQ_CREDITO,
    NOME_BANCO,
    PORTA_BANCO,
    SENHA_BANCO,
    SERVIDOR_BANCO,
    USUARIO_BANCO,
)


def _nome_sql_seguro(nome: str) -> str:
    texto = str(nome or "").strip()
    if not texto.replace("_", "").isalnum() or texto[0:1].isdigit():
        raise RuntimeError(f"Nome de schema invalido para MaqCredito: {texto!r}")
    return texto


SCHEMA = _nome_sql_seguro(ESQUEMA_MAQ_CREDITO)


def get_database_url() -> str:
    partes = {
        "host": SERVIDOR_BANCO,
        "port": str(PORTA_BANCO),
        "dbname": NOME_BANCO,
        "user": USUARIO_BANCO,
        "password": SENHA_BANCO,
    }
    return " ".join(f"{chave}={valor}" for chave, valor in partes.items())


def fetch_all(query: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    with psycopg.connect(get_database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            return list(cur.fetchall())


def fetch_one(query: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
    with psycopg.connect(get_database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            return cur.fetchone()


def execute(query: str, params: Iterable[Any] = ()) -> None:
    with psycopg.connect(get_database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
        conn.commit()


def init_db() -> None:
    schema = f"""
    create extension if not exists pgcrypto;
    create schema if not exists {SCHEMA};

    create table if not exists {SCHEMA}.processos (
      reserva text primary key,
      cliente text,
      caixa_status text not null default 'reserva',
      agehab_status text not null default 'reserva',
      produto text,
      sinal text,
      fiador text,
      corretor text,
      empreendimento text,
      cca_vinculado text,
      observacao_analista text,
      encaminhado_analista boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table {SCHEMA}.processos
      add column if not exists encaminhado_analista boolean not null default false;
    alter table {SCHEMA}.processos
      add column if not exists observacao_analista text;
    alter table {SCHEMA}.processos
      add column if not exists cca_vinculado text;

    create table if not exists {SCHEMA}.documentos_status (
      id uuid primary key default gen_random_uuid(),
      reserva text not null references {SCHEMA}.processos(reserva) on delete cascade,
      documento_key text not null,
      status text not null default 'Aguardando',
      updated_by text,
      updated_at timestamptz not null default now(),
      unique (reserva, documento_key)
    );

    create table if not exists {SCHEMA}.relacionamento_status (
      id uuid primary key default gen_random_uuid(),
      reserva text not null references {SCHEMA}.processos(reserva) on delete cascade,
      relacionamento_key text not null,
      status text not null default 'nao',
      updated_by text,
      updated_at timestamptz not null default now(),
      unique (reserva, relacionamento_key)
    );

    create table if not exists {SCHEMA}.creditu_dados (
      id uuid primary key default gen_random_uuid(),
      reserva text not null references {SCHEMA}.processos(reserva) on delete cascade,
      email_segundo_proponente text,
      telefone_segundo_proponente text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (reserva)
    );

    create table if not exists {SCHEMA}.perfil_documental (
      reserva text primary key references {SCHEMA}.processos(reserva) on delete cascade,
      dados jsonb not null default '{{}}'::jsonb,
      updated_by text,
      updated_role text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists {SCHEMA}.documentos_pendencias (
      id uuid primary key default gen_random_uuid(),
      reserva text not null references {SCHEMA}.processos(reserva) on delete cascade,
      documento_key text not null,
      descricao text not null default '',
      prazo text,
      origem text,
      destino_card text not null default 'card1',
      updated_at timestamptz not null default now(),
      unique (reserva, documento_key)
    );

    create table if not exists {SCHEMA}.pendencias_historico (
      id uuid primary key default gen_random_uuid(),
      reserva text not null references {SCHEMA}.processos(reserva) on delete cascade,
      documento_key text not null,
      descricao text not null default '',
      prazo text,
      origem text,
      evento text not null default 'criada',
      status_documento text,
      created_at timestamptz not null default now()
    );

    create table if not exists {SCHEMA}.checklist_messages (
      id uuid primary key default gen_random_uuid(),
      reserva text not null references {SCHEMA}.processos(reserva) on delete cascade,
      documento_key text,
      author_name text not null,
      author_role text not null,
      target_role text not null default 'todos',
      message text not null,
      created_at timestamptz not null default now(),
      read_at timestamptz
    );

    create index if not exists idx_maq_credito_checklist_messages_doc
      on {SCHEMA}.checklist_messages (reserva, documento_key, created_at);
    create index if not exists idx_maq_credito_checklist_messages_reserva
      on {SCHEMA}.checklist_messages (reserva, created_at);

    create table if not exists {SCHEMA}.uploads (
      id uuid primary key default gen_random_uuid(),
      reserva text not null references {SCHEMA}.processos(reserva) on delete cascade,
      grupo text not null default 'geral',
      documento_key text not null,
      file_name text not null,
      storage_path text not null,
      url text not null,
      content_type text,
      created_by text,
      created_at timestamptz not null default now()
    );

    create table if not exists {SCHEMA}.sla_processos (
      reserva text primary key references {SCHEMA}.processos(reserva) on delete cascade,
      started_at timestamptz not null default now(),
      stopped_at timestamptz,
      stop_reason text,
      updated_at timestamptz not null default now()
    );

    create table if not exists {SCHEMA}.contextos (
      id uuid primary key default gen_random_uuid(),
      contexto text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists {SCHEMA}.log_eventos (
      id_cliente text not null,
      status text not null,
      timestamp timestamptz not null,
      id_corretor text
    );

    create index if not exists idx_maq_credito_log_eventos_cliente_timestamp
      on {SCHEMA}.log_eventos (id_cliente, timestamp);
    create index if not exists idx_maq_credito_log_eventos_status
      on {SCHEMA}.log_eventos (status);
    """
    execute(schema)

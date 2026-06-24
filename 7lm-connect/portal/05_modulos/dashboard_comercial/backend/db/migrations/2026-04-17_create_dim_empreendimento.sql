CREATE TABLE IF NOT EXISTS public.dim_empreendimento (
    dim_empreendimento_key TEXT PRIMARY KEY,
    idempreendimento BIGINT,
    idunidade_origem BIGINT,
    idtipo_empreendimento BIGINT,
    tipo_empreendimento TEXT,
    empreendimento TEXT,
    empreendimento_reduzido TEXT,
    cidade TEXT,
    regiao TEXT,
    qt_unidades_empreendimento BIGINT,
    dt_entrega_empreendimento TIMESTAMP,
    dt_referencia_empreendimento TIMESTAMP,
    dt_ultima_referencia_empreendimento TIMESTAMP,
    dt_ultima_ingestao_empreendimento TIMESTAMP,
    gold_process_ts TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dim_empreendimento_id ON public.dim_empreendimento(idempreendimento);
CREATE INDEX IF NOT EXISTS idx_dim_empreendimento_nome ON public.dim_empreendimento(empreendimento);
CREATE INDEX IF NOT EXISTS idx_dim_empreendimento_reduzido ON public.dim_empreendimento(empreendimento_reduzido);
CREATE INDEX IF NOT EXISTS idx_dim_empreendimento_regiao ON public.dim_empreendimento(regiao);
CREATE INDEX IF NOT EXISTS idx_dim_empreendimento_cidade ON public.dim_empreendimento(cidade);

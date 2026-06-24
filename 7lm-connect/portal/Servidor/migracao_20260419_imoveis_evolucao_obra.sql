CREATE TABLE IF NOT EXISTS connect_comercial.imovel_evolucao_obra (
  identificador_evolucao_obra uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_imovel uuid NOT NULL REFERENCES connect_comercial.imovel(identificador_imovel) ON DELETE CASCADE,
  percentual_conclusao_obra numeric(5,2) NOT NULL,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  registrado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_imovel_evolucao_obra_percentual CHECK (percentual_conclusao_obra BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_imovel_evolucao_obra_atual
  ON connect_comercial.imovel_evolucao_obra (
    identificador_imovel,
    data_referencia DESC,
    data_hora_criacao DESC,
    identificador_evolucao_obra DESC
  );

INSERT INTO connect_comercial.imovel_evolucao_obra (
  identificador_imovel,
  percentual_conclusao_obra,
  data_referencia,
  observacoes
)
SELECT
  i.identificador_imovel,
  i.percentual_conclusao_obra,
  CURRENT_DATE,
  'Registro inicial criado a partir do percentual atual.'
FROM connect_comercial.imovel i
WHERE NOT EXISTS (
  SELECT 1
  FROM connect_comercial.imovel_evolucao_obra h
  WHERE h.identificador_imovel = i.identificador_imovel
);

WITH atual AS (
  SELECT DISTINCT ON (identificador_imovel)
    identificador_imovel,
    percentual_conclusao_obra
  FROM connect_comercial.imovel_evolucao_obra
  ORDER BY identificador_imovel, data_referencia DESC, data_hora_criacao DESC, identificador_evolucao_obra DESC
)
UPDATE connect_comercial.imovel i
   SET percentual_conclusao_obra = atual.percentual_conclusao_obra
  FROM atual
 WHERE atual.identificador_imovel = i.identificador_imovel;

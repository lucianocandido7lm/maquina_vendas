UPDATE connect_comercial.simulacao
   SET meses_pos_entrega = LEAST(GREATEST(COALESCE(meses_pos_entrega, 0), 0), 80)
 WHERE meses_pos_entrega IS NULL
    OR meses_pos_entrega < 0
    OR meses_pos_entrega > 80;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_simulacao_meses_pos_entrega'
  ) THEN
    ALTER TABLE connect_comercial.simulacao
      DROP CONSTRAINT ck_simulacao_meses_pos_entrega;
  END IF;
END
$$;

ALTER TABLE connect_comercial.simulacao
  ADD CONSTRAINT ck_simulacao_meses_pos_entrega
  CHECK (meses_pos_entrega BETWEEN 0 AND 80);

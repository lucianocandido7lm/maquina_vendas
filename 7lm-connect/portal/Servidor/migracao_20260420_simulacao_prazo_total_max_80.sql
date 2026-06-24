BEGIN;

UPDATE connect_comercial.simulacao
   SET meses_pre_entrega = CASE
         WHEN COALESCE(meses_pre_entrega, 0) < 0 THEN 0
         WHEN COALESCE(meses_pre_entrega, 0) > 80 THEN 80
         ELSE COALESCE(meses_pre_entrega, 0)
       END,
       meses_pos_entrega = CASE
         WHEN COALESCE(meses_pre_entrega, 0) >= 80 THEN 0
         ELSE LEAST(
           GREATEST(COALESCE(meses_pos_entrega, 0), 0),
           GREATEST(80 - GREATEST(COALESCE(meses_pre_entrega, 0), 0), 0)
         )
       END
 WHERE COALESCE(meses_pre_entrega, 0) < 0
    OR COALESCE(meses_pre_entrega, 0) > 80
    OR COALESCE(meses_pos_entrega, 0) < 0
    OR COALESCE(meses_pos_entrega, 0) > 80
    OR (COALESCE(meses_pre_entrega, 0) + COALESCE(meses_pos_entrega, 0)) > 80;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_simulacao_prazo_total_max_80'
  ) THEN
    ALTER TABLE connect_comercial.simulacao
      DROP CONSTRAINT ck_simulacao_prazo_total_max_80;
  END IF;
END
$$;

ALTER TABLE connect_comercial.simulacao
  ADD CONSTRAINT ck_simulacao_prazo_total_max_80
  CHECK (
    meses_pre_entrega BETWEEN 0 AND 80
    AND meses_pos_entrega BETWEEN 0 AND 80
    AND (meses_pre_entrega + meses_pos_entrega) <= 80
  );

COMMIT;

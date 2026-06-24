ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  ADD COLUMN IF NOT EXISTS status_vaga text;

UPDATE sevenlm_connect.dashboard_gc_vaga_manual
   SET status_vaga = CASE
         WHEN data_fechamento IS NOT NULL AND data_fechamento <= CURRENT_DATE THEN 'FECHADA'
         ELSE 'EM_ANDAMENTO'
       END
 WHERE status_vaga IS NULL
    OR status_vaga NOT IN ('EM_ANDAMENTO', 'FECHADA', 'CANCELADA', 'CONGELADA');

ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  ALTER COLUMN status_vaga SET DEFAULT 'EM_ANDAMENTO';

ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  ALTER COLUMN status_vaga SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_dashboard_gc_vaga_manual_status'
       AND conrelid = 'sevenlm_connect.dashboard_gc_vaga_manual'::regclass
  ) THEN
    ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
      ADD CONSTRAINT ck_dashboard_gc_vaga_manual_status
      CHECK (status_vaga IN ('EM_ANDAMENTO', 'FECHADA', 'CANCELADA', 'CONGELADA'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_vaga_manual_status_vaga
  ON sevenlm_connect.dashboard_gc_vaga_manual (status_vaga, data_abertura DESC);

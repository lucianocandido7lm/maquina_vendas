BEGIN;

ALTER TABLE connect_comercial.cliente
  ADD COLUMN IF NOT EXISTS cpf_normalizado varchar(11);

UPDATE connect_comercial.cliente
   SET cpf_normalizado = nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '')
 WHERE cpf IS NOT NULL
   AND trim(coalesce(cpf, '')) <> ''
   AND (
     cpf_normalizado IS NULL
     OR cpf_normalizado = ''
   );

DO $$
DECLARE
  v_total_duplicados integer;
BEGIN
  SELECT count(*)
    INTO v_total_duplicados
    FROM (
      SELECT cpf_normalizado
        FROM connect_comercial.cliente
       WHERE cpf_normalizado IS NOT NULL
         AND cpf_normalizado <> ''
       GROUP BY cpf_normalizado
      HAVING count(*) > 1
    ) duplicados;

  IF coalesce(v_total_duplicados, 0) > 0 THEN
    RAISE EXCEPTION 'Existem % CPF(s) duplicados na base de clientes. Resolva os cadastros repetidos antes de aplicar a trava exclusiva.', v_total_duplicados;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_cpf_normalizado
  ON connect_comercial.cliente (cpf_normalizado)
  WHERE cpf_normalizado IS NOT NULL;

COMMIT;

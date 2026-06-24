ALTER TABLE connect_comercial.imovel
  ADD COLUMN IF NOT EXISTS valor_garantido_pre_obra_planejado numeric(14,2),
  ADD COLUMN IF NOT EXISTS percentual_captacao_ate_entrega numeric(5,4);

UPDATE connect_comercial.imovel
   SET percentual_captacao_ate_entrega = CASE
       WHEN valor IS NOT NULL AND valor > 0 AND valor_garantido_pre_obra_planejado IS NOT NULL AND valor_garantido_pre_obra_planejado > 0
         THEN ROUND((valor_garantido_pre_obra_planejado / valor)::numeric, 4)
       ELSE percentual_captacao_ate_entrega
   END
 WHERE percentual_captacao_ate_entrega IS NULL;

UPDATE connect_comercial.imovel
   SET valor_garantido_pre_obra_planejado = CASE
       WHEN valor IS NOT NULL AND valor > 0 AND percentual_captacao_ate_entrega IS NOT NULL AND percentual_captacao_ate_entrega > 0
         THEN ROUND((valor * percentual_captacao_ate_entrega)::numeric, 2)
       ELSE valor_garantido_pre_obra_planejado
   END
 WHERE valor_garantido_pre_obra_planejado IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_valor_garantido_pre_obra_planejado'
       AND conrelid = 'connect_comercial.imovel'::regclass
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_valor_garantido_pre_obra_planejado
      CHECK (valor_garantido_pre_obra_planejado IS NULL OR valor_garantido_pre_obra_planejado >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_percentual_captacao_ate_entrega'
       AND conrelid = 'connect_comercial.imovel'::regclass
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_percentual_captacao_ate_entrega
      CHECK (percentual_captacao_ate_entrega IS NULL OR percentual_captacao_ate_entrega BETWEEN 0.01 AND 1.00);
  END IF;
END $$;

-- Corrige a função polimórfica anterior: registros NEW/OLD de Product e
-- PlanoConta possuem formatos diferentes e não devem compartilhar acesso a
-- campos específicos da outra tabela.

DROP TRIGGER IF EXISTS "Product_requires_plano_conta" ON "Product";
DROP TRIGGER IF EXISTS "PlanoConta_preserves_product_node" ON "PlanoConta";
DROP FUNCTION IF EXISTS ensure_product_plano_conta_exists();

CREATE OR REPLACE FUNCTION ensure_product_has_plano_conta()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE id = NEW.id)
     AND NOT EXISTS (
       SELECT 1 FROM "PlanoConta"
       WHERE "produtoId" = NEW.id AND "tipo" = 'PRODUTO'
     ) THEN
    RAISE EXCEPTION 'Produto % não possui nó no Plano de Contas.', NEW.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION preserve_product_plano_conta()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."produtoId" IS NOT NULL
     AND EXISTS (SELECT 1 FROM "Product" WHERE id = OLD."produtoId")
     AND NOT EXISTS (
       SELECT 1 FROM "PlanoConta"
       WHERE "produtoId" = OLD."produtoId" AND "tipo" = 'PRODUTO'
     ) THEN
    RAISE EXCEPTION 'Produto % não possui nó no Plano de Contas.', OLD."produtoId";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Product_requires_plano_conta"
AFTER INSERT OR UPDATE ON "Product"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_product_has_plano_conta();

CREATE CONSTRAINT TRIGGER "PlanoConta_preserves_product_node"
AFTER DELETE OR UPDATE OF "produtoId", "tipo" ON "PlanoConta"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION preserve_product_plano_conta();

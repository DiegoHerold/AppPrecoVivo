-- Eventos são snapshots derivados e reconstruíveis. Compras permanecem a
-- fonte histórica imutável; nenhuma coluna de Purchase/PurchaseItem é alterada.
CREATE TABLE "InferenceEventLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purchaseItemId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InferenceEventLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InferenceEventLog_userId_productId_eventKey_key"
ON "InferenceEventLog"("userId", "productId", "eventKey");
CREATE INDEX "InferenceEventLog_userId_occurredAt_idx"
ON "InferenceEventLog"("userId", "occurredAt");
CREATE INDEX "InferenceEventLog_productId_occurredAt_idx"
ON "InferenceEventLog"("productId", "occurredAt");

ALTER TABLE "InferenceEventLog"
ADD CONSTRAINT "InferenceEventLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InferenceEventLog"
ADD CONSTRAINT "InferenceEventLog_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Um grupo nunca aponta para produto; um produto sempre possui pai e produtoId.
ALTER TABLE "PlanoConta" ADD CONSTRAINT "PlanoConta_kind_shape"
CHECK (
  ("tipo" = 'GRUPO' AND "produtoId" IS NULL)
  OR
  ("tipo" = 'PRODUTO' AND "produtoId" IS NOT NULL AND "parentId" IS NOT NULL)
);

-- Valida dono e tipo do pai em qualquer escrita, inclusive fora da aplicação.
CREATE OR REPLACE FUNCTION validate_plano_conta_node()
RETURNS TRIGGER AS $$
DECLARE
  parent_row "PlanoConta"%ROWTYPE;
  product_user_id TEXT;
BEGIN
  IF NEW."tipo" = 'PRODUTO' THEN
    SELECT "userId" INTO product_user_id FROM "Product" WHERE id = NEW."produtoId";
    IF product_user_id IS NULL OR product_user_id <> NEW."userId" THEN
      RAISE EXCEPTION 'Produto e nó do plano de contas precisam pertencer ao mesmo usuário.';
    END IF;
  END IF;

  IF NEW."parentId" IS NOT NULL THEN
    SELECT * INTO parent_row FROM "PlanoConta" WHERE id = NEW."parentId";
    IF NOT FOUND OR parent_row."tipo" <> 'GRUPO' OR parent_row."userId" <> NEW."userId" THEN
      RAISE EXCEPTION 'O pai precisa ser um grupo do mesmo usuário.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlanoConta_validate_node"
BEFORE INSERT OR UPDATE ON "PlanoConta"
FOR EACH ROW EXECUTE FUNCTION validate_plano_conta_node();

-- Constraint deferida: permite criar Product e seu nó na mesma transação,
-- mas impede que a transação termine com um produto sem classificação.
CREATE OR REPLACE FUNCTION ensure_product_plano_conta_exists()
RETURNS TRIGGER AS $$
DECLARE
  checked_product_id TEXT;
BEGIN
  checked_product_id := CASE
    WHEN TG_TABLE_NAME = 'Product' THEN NEW.id
    ELSE OLD."produtoId"
  END;

  IF checked_product_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM "Product" WHERE id = checked_product_id)
     AND NOT EXISTS (
       SELECT 1 FROM "PlanoConta"
       WHERE "produtoId" = checked_product_id AND "tipo" = 'PRODUTO'
     ) THEN
    RAISE EXCEPTION 'Produto % não possui nó no Plano de Contas.', checked_product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Product_requires_plano_conta"
AFTER INSERT OR UPDATE ON "Product"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_product_plano_conta_exists();

CREATE CONSTRAINT TRIGGER "PlanoConta_preserves_product_node"
AFTER DELETE OR UPDATE OF "produtoId", "tipo" ON "PlanoConta"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_product_plano_conta_exists();

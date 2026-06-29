CREATE TYPE "AccountPlanType" AS ENUM ('PRODUTO');

CREATE TABLE "ProductAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountPlanType" NOT NULL DEFAULT 'PRODUTO',
    "categoryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductAccount_productId_key" ON "ProductAccount"("productId");
CREATE UNIQUE INDEX "ProductAccount_id_productId_key" ON "ProductAccount"("id", "productId");
CREATE INDEX "ProductAccount_userId_categoryId_active_idx" ON "ProductAccount"("userId", "categoryId", "active");

ALTER TABLE "ProductAccount"
ADD CONSTRAINT "ProductAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductAccount"
ADD CONSTRAINT "ProductAccount_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductAccount"
ADD CONSTRAINT "ProductAccount_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ProductAccount" (
    "id", "userId", "productId", "name", "type", "categoryId", "active", "createdAt", "updatedAt"
)
SELECT
    'pa_' || md5(product.id || clock_timestamp()::text || random()::text),
    product."userId",
    product.id,
    product."standardName",
    'PRODUTO'::"AccountPlanType",
    product."categoryId",
    product.active,
    product."createdAt",
    CURRENT_TIMESTAMP
FROM "Product" product;

ALTER TABLE "PurchaseItem" ADD COLUMN "productAccountId" TEXT;

UPDATE "PurchaseItem" item
SET "productAccountId" = account.id
FROM "ProductAccount" account
WHERE item."productId" = account."productId";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Product" product
        LEFT JOIN "ProductAccount" account ON account."productId" = product.id
        WHERE account.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Não foi possível criar uma conta para cada produto.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "PurchaseItem"
        WHERE "productId" IS NOT NULL AND "productAccountId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Existem movimentações de produto sem conta correspondente.';
    END IF;
END $$;

CREATE INDEX "PurchaseItem_productAccountId_idx" ON "PurchaseItem"("productAccountId");

ALTER TABLE "PurchaseItem"
ADD CONSTRAINT "PurchaseItem_productAccountId_productId_fkey"
FOREIGN KEY ("productAccountId", "productId")
REFERENCES "ProductAccount"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseItem"
ADD CONSTRAINT "PurchaseItem_product_account_required"
CHECK (
    ("productId" IS NULL AND "productAccountId" IS NULL)
    OR ("productId" IS NOT NULL AND "productAccountId" IS NOT NULL)
);

CREATE OR REPLACE FUNCTION normalize_product_account()
RETURNS TRIGGER AS $$
DECLARE
    product_row "Product"%ROWTYPE;
BEGIN
    SELECT * INTO product_row FROM "Product" WHERE id = NEW."productId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto % não encontrado para a conta.', NEW."productId";
    END IF;

    NEW."userId" := product_row."userId";
    NEW.name := product_row."standardName";
    NEW."categoryId" := product_row."categoryId";
    NEW.active := product_row.active;
    NEW.type := 'PRODUTO'::"AccountPlanType";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProductAccount_normalize"
BEFORE INSERT OR UPDATE ON "ProductAccount"
FOR EACH ROW EXECUTE FUNCTION normalize_product_account();

CREATE OR REPLACE FUNCTION sync_product_account_from_product()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "ProductAccount"
    SET
        name = NEW."standardName",
        "categoryId" = NEW."categoryId",
        active = NEW.active,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "productId" = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Product_sync_account"
AFTER UPDATE OF "standardName", "categoryId", active ON "Product"
FOR EACH ROW EXECUTE FUNCTION sync_product_account_from_product();

CREATE OR REPLACE FUNCTION ensure_product_account_exists()
RETURNS TRIGGER AS $$
DECLARE
    checked_product_id TEXT;
BEGIN
    checked_product_id := CASE
        WHEN TG_TABLE_NAME = 'Product' THEN NEW.id
        ELSE OLD."productId"
    END;

    IF EXISTS (SELECT 1 FROM "Product" WHERE id = checked_product_id)
       AND NOT EXISTS (SELECT 1 FROM "ProductAccount" WHERE "productId" = checked_product_id) THEN
        RAISE EXCEPTION 'Produto % não possui conta no plano de contas.', checked_product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Product_requires_account"
AFTER INSERT OR UPDATE ON "Product"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_product_account_exists();

CREATE CONSTRAINT TRIGGER "ProductAccount_preserves_product_account"
AFTER DELETE OR UPDATE OF "productId" ON "ProductAccount"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_product_account_exists();

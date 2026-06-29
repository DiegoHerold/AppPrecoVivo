ALTER TABLE "Product"
ADD COLUMN "classificationConfirmed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Product" product
SET "classificationConfirmed" = true
WHERE EXISTS (
  SELECT 1
  FROM "ProductAlias" alias
  WHERE alias."productId" = product.id
    AND alias.source = 'revisao_usuario'
)
OR EXISTS (
  SELECT 1
  FROM "PurchaseItem" item
  WHERE item."productId" = product.id
    AND item."needsReview" = false
);

ALTER TABLE "ImportJob"
ALTER COLUMN "purchaseId" DROP NOT NULL;

CREATE UNIQUE INDEX "Purchase_userId_accessKey_key"
ON "Purchase"("userId", "accessKey");

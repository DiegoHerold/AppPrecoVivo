-- Keep one canonical category for each user/name pair before tightening the
-- constraint. This also makes the migration safe for databases where an older
-- seed was executed more than once.
CREATE TEMP TABLE "_category_duplicates" AS
SELECT id AS "duplicateId", FIRST_VALUE(id) OVER (
  PARTITION BY "userId", name
  ORDER BY "createdAt", id
) AS "canonicalId"
FROM "Category";

DELETE FROM "_category_duplicates" WHERE "duplicateId" = "canonicalId";

UPDATE "Product" AS product
SET "categoryId" = duplicate."canonicalId"
FROM "_category_duplicates" AS duplicate
WHERE product."categoryId" = duplicate."duplicateId";

UPDATE "PurchaseItem" AS item
SET "categoryId" = duplicate."canonicalId"
FROM "_category_duplicates" AS duplicate
WHERE item."categoryId" = duplicate."duplicateId";

UPDATE "Category" AS category
SET "parentId" = duplicate."canonicalId"
FROM "_category_duplicates" AS duplicate
WHERE category."parentId" = duplicate."duplicateId";

DELETE FROM "Category" AS category
USING "_category_duplicates" AS duplicate
WHERE category.id = duplicate."duplicateId";

DROP INDEX "Category_userId_name_parentId_key";
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

DROP TABLE "_category_duplicates";

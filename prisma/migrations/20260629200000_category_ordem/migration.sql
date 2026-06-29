-- Adiciona campo `ordem` na tabela Category
ALTER TABLE "Category" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- Inicializa ordem pela posição alfabética dentro de cada pai
UPDATE "Category" c
SET "ordem" = sub.row_num - 1
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", COALESCE("parentId", '___root___')
      ORDER BY name
    ) AS row_num
  FROM "Category"
) sub
WHERE c.id = sub.id;

-- Adiciona campo `ordem` na tabela ProductAccount
ALTER TABLE "ProductAccount" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- Inicializa ordem pela posição alfabética dentro de cada categoria
UPDATE "ProductAccount" pa
SET "ordem" = sub.row_num - 1
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "categoryId"
      ORDER BY name
    ) AS row_num
  FROM "ProductAccount"
) sub
WHERE pa.id = sub.id;

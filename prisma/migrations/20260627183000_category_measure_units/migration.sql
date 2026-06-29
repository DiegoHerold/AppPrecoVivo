ALTER TABLE "Category"
ADD COLUMN "allowedUnits" TEXT[] NOT NULL DEFAULT ARRAY['un', 'pct', 'cx']::TEXT[];

UPDATE "Category"
SET "allowedUnits" = ARRAY['kg', 'g', 'un', 'pct']::TEXT[]
WHERE "name" IN ('Arroz', 'Feijão', 'Macarrão', 'Carnes', 'Bovina', 'Aves', 'Suína', 'Hortifruti', 'Frutas', 'Verduras', 'Legumes', 'Queijos', 'Padaria');

UPDATE "Category"
SET "allowedUnits" = ARRAY['L', 'ml', 'un', 'pct']::TEXT[]
WHERE "name" IN ('Bebidas', 'Leite', 'Óleo / Azeite');

UPDATE "Category"
SET "allowedUnits" = ARRAY['kg', 'g', 'L', 'ml', 'un', 'pct', 'cx']::TEXT[]
WHERE "name" IN ('Alimentação', 'Básicos', 'Laticínios');

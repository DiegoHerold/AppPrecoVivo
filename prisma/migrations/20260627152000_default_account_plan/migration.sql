-- Add an editable default hierarchy for every existing account. These rows are
-- classifications only; no purchases or products are created.
WITH roots(name, icon, color) AS (
  VALUES
    ('Alimentação', '🍽️', '#635BFF'),
    ('Limpeza', '🧹', '#22C7D6'),
    ('Higiene pessoal', '🧴', '#EC4899'),
    ('Farmácia', '💊', '#EF4444'),
    ('Pet', '🐾', '#F97316'),
    ('Casa', '🏠', '#8B5CF6'),
    ('Transporte', '🚌', '#64748B'),
    ('Outros', '📦', '#9CA3AF')
)
INSERT INTO "Category" ("id", "userId", "parentId", "name", "icon", "color", "active", "createdAt", "updatedAt")
SELECT 'plan_' || md5(u.id || ':' || r.name), u.id, NULL, r.name, r.icon, r.color, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u CROSS JOIN roots r
ON CONFLICT ("userId", "name") DO NOTHING;

WITH children(name, icon, color, parent_name) AS (
  VALUES
    ('Básicos', '🌾', '#6366F1', 'Alimentação'),
    ('Carnes', '🥩', '#EC4899', 'Alimentação'),
    ('Laticínios', '🥛', '#F472B6', 'Alimentação'),
    ('Bebidas', '🥤', '#F97316', 'Alimentação'),
    ('Hortifruti', '🥬', '#14B8A6', 'Alimentação'),
    ('Padaria', '🥖', '#F59E0B', 'Alimentação'),
    ('Ambientes', '🧽', '#06B6D4', 'Limpeza'),
    ('Roupas', '👕', '#0EA5E9', 'Limpeza'),
    ('Louças', '🍽', '#0891B2', 'Limpeza'),
    ('Corpo', '🧼', '#F472B6', 'Higiene pessoal'),
    ('Cabelo', '🧴', '#D946EF', 'Higiene pessoal'),
    ('Bucal', '🪥', '#A855F7', 'Higiene pessoal')
)
INSERT INTO "Category" ("id", "userId", "parentId", "name", "icon", "color", "active", "createdAt", "updatedAt")
SELECT 'plan_' || md5(u.id || ':' || c.name), u.id, p.id, c.name, c.icon, c.color, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u CROSS JOIN children c
JOIN "Category" p ON p."userId" = u.id AND p.name = c.parent_name
ON CONFLICT ("userId", "name") DO NOTHING;

-- Categories that already existed as roots keep their IDs and history, but are
-- moved under Alimentação to match the default hierarchy.
UPDATE "Category" child
SET "parentId" = parent.id, "updatedAt" = CURRENT_TIMESTAMP
FROM "Category" parent
WHERE child."userId" = parent."userId"
  AND child.name IN ('Bebidas', 'Padaria')
  AND parent.name = 'Alimentação'
  AND child.id <> parent.id;

WITH leaves(name, icon, color, parent_name) AS (
  VALUES
    ('Arroz', '🍚', '#6366F1', 'Básicos'),
    ('Feijão', '🫘', '#8B5CF6', 'Básicos'),
    ('Macarrão', '🍝', '#F97316', 'Básicos'),
    ('Óleo / Azeite', '🫙', '#EAB308', 'Básicos'),
    ('Bovina', '🥩', '#E11D48', 'Carnes'),
    ('Aves', '🍗', '#F43F5E', 'Carnes'),
    ('Suína', '🥓', '#FB7185', 'Carnes'),
    ('Leite', '🥛', '#38BDF8', 'Laticínios'),
    ('Queijos', '🧀', '#FBBF24', 'Laticínios'),
    ('Iogurtes', '🥣', '#F9A8D4', 'Laticínios'),
    ('Frutas', '🍎', '#10B981', 'Hortifruti'),
    ('Verduras', '🥬', '#22C55E', 'Hortifruti'),
    ('Legumes', '🥕', '#F97316', 'Hortifruti')
)
INSERT INTO "Category" ("id", "userId", "parentId", "name", "icon", "color", "active", "createdAt", "updatedAt")
SELECT 'plan_' || md5(u.id || ':' || l.name), u.id, p.id, l.name, l.icon, l.color, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u CROSS JOIN leaves l
JOIN "Category" p ON p."userId" = u.id AND p.name = l.parent_name
ON CONFLICT ("userId", "name") DO NOTHING;

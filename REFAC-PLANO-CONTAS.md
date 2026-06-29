# Refatoração — Plano de Contas como base de tudo

O Plano de Contas virou a **espinha dorsal** do sistema: uma única árvore (`PlanoConta`)
de onde derivam classificação, dashboard, fluxo mensal, consumo e estoque.

## O que mudou

### Modelo de dados (`prisma/schema.prisma`)
- **Removidos:** `Category`, `ProductAccount`, enum `AccountPlanType`.
- **Novo `PlanoConta`** (árvore única): `id, nome, tipo (GRUPO|PRODUTO), parentId,
  produtoId (unique), ativo, ordem, icone, cor, allowedUnits, createdAt, updatedAt`.
  Self-relation por `parentId` → níveis ilimitados.
- **`Product`** perdeu `categoryId` — o grupo do produto é o `parentId` do seu nó PRODUTO.
- **`PurchaseItem`**: `categoryId`/`productAccountId` → `planoContaId` (FK composta
  `[planoContaId, productId] → PlanoConta[id, produtoId]`, garantindo que o nó é o do produto).

### Invariantes garantidas no servidor
Criar produto cria `Product` + nó PRODUTO atomicamente · `produtoId` unique impede conta
duplicada · produto sempre sob um GRUPO · sem ciclos (validação de ancestrais no move) ·
inativar em vez de excluir (exclusão só se vazio) · **reorganizar a árvore reclassifica todo
o histórico automaticamente** (o grupo é derivado da árvore, não copiado no item).

### Backend
- Novo `src/lib/plano-contas.ts` (CRUD, `moveNode`, `listTree`, busca) + `plano-contas-tree.ts` (helpers puros).
- Refatorados: `monthly-flow`, `classification-report`, `queries`, `products`, `purchases`, `validation`, seed.
- Endpoints novos:
  - `GET /api/plano-contas` (aceita `?q=` para busca) — árvore completa
  - `POST /api/plano-contas` — novo grupo
  - `POST /api/plano-contas/produto` — novo produto (Product + nó, transacional)
  - `PATCH /api/plano-contas/[id]` — renomear / cor / ícone / unidades / ativar
  - `POST /api/plano-contas/[id]/move` — mover (`{ parentId, ordem }`)
  - `DELETE /api/plano-contas/[id]` — inativar (`?hard=1` exclui se vazio)
  - `/api/account-plan` mantido como alias de compatibilidade.

### Frontend
- Nova `src/components/plano-contas-screen.tsx` (mobile-first): árvore com expandir/recolher,
  busca, filtros (todos/grupos/produtos/inativos), breadcrumb, ícones distintos, alvos ≥44px,
  botões **Novo grupo**/**Novo produto**, mover com modal de destino, renomear, inativar com
  confirmação e estados vazios.
- `client-types`, `purchase-flow-app` atualizados. As telas de produto/compra manual/revisão
  seguem usando a lista de grupos do dashboard (sem mudança de contrato).

## Passos para rodar (na sua máquina Windows)

> O sandbox não consegue baixar os engines do Prisma nem rodar o toolchain (node_modules é
> nativo do Windows), então estes passos precisam ser executados localmente.

```bash
npm run db:generate                       # regenera o Prisma Client com o novo schema
npx prisma migrate dev --name plano_contas_unificado   # cria/aplica a migração (pode pedir reset — ok, dev)
npm run db:seed                           # popula a árvore inicial (editável)
npm run typecheck                         # tsc --noEmit
npm run test                              # testes (inclui invariantes da árvore)
npm run build                             # next build
npm run dev                               # sobe em http://localhost:5174
```

Observação: instalei temporariamente `node_modules/@esbuild/linux-x64` para rodar checagens no
Linux. É inofensivo no Windows; um `npm install`/`npm ci` o ignora.

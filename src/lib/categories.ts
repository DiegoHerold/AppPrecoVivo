import type { Prisma } from '@/generated/prisma/client'

export type InitialCategory = {
  name: string
  icon: string
  color: string
  parent?: string
  allowedUnits?: string[]
}

const WEIGHT_UNITS = ['kg', 'g', 'un', 'pct']
const LIQUID_UNITS = ['L', 'ml', 'un', 'pct']
const FOOD_UNITS = ['kg', 'g', 'L', 'ml', 'un', 'pct', 'cx']
const GENERAL_UNITS = ['un', 'pct', 'cx', 'dz']

export function initialUnitsFor(name: string) {
  if (['Arroz', 'Feijão', 'Macarrão', 'Carnes', 'Bovina', 'Aves', 'Suína', 'Hortifruti', 'Frutas', 'Verduras', 'Legumes', 'Queijos', 'Padaria'].includes(name)) return WEIGHT_UNITS
  if (['Bebidas', 'Leite', 'Óleo / Azeite'].includes(name)) return LIQUID_UNITS
  if (['Alimentação', 'Básicos', 'Laticínios'].includes(name)) return FOOD_UNITS
  return GENERAL_UNITS
}

export const INITIAL_CATEGORIES: InitialCategory[] = [
  { name: 'Alimentação', icon: '🍽️', color: '#635BFF' },
  { name: 'Limpeza', icon: '🧹', color: '#22C7D6' },
  { name: 'Higiene pessoal', icon: '🧴', color: '#EC4899' },
  { name: 'Farmácia', icon: '💊', color: '#EF4444' },
  { name: 'Pet', icon: '🐾', color: '#F97316' },
  { name: 'Casa', icon: '🏠', color: '#8B5CF6' },
  { name: 'Transporte', icon: '🚌', color: '#64748B' },
  { name: 'Outros', icon: '📦', color: '#9CA3AF' },

  { name: 'Básicos', icon: '🌾', color: '#6366F1', parent: 'Alimentação' },
  { name: 'Carnes', icon: '🥩', color: '#EC4899', parent: 'Alimentação' },
  { name: 'Laticínios', icon: '🥛', color: '#F472B6', parent: 'Alimentação' },
  { name: 'Bebidas', icon: '🥤', color: '#F97316', parent: 'Alimentação' },
  { name: 'Hortifruti', icon: '🥬', color: '#14B8A6', parent: 'Alimentação' },
  { name: 'Padaria', icon: '🥖', color: '#F59E0B', parent: 'Alimentação' },
  { name: 'Ambientes', icon: '🧽', color: '#06B6D4', parent: 'Limpeza' },
  { name: 'Roupas', icon: '👕', color: '#0EA5E9', parent: 'Limpeza' },
  { name: 'Louças', icon: '🍽', color: '#0891B2', parent: 'Limpeza' },
  { name: 'Corpo', icon: '🧼', color: '#F472B6', parent: 'Higiene pessoal' },
  { name: 'Cabelo', icon: '🧴', color: '#D946EF', parent: 'Higiene pessoal' },
  { name: 'Bucal', icon: '🪥', color: '#A855F7', parent: 'Higiene pessoal' },

  { name: 'Arroz', icon: '🍚', color: '#6366F1', parent: 'Básicos' },
  { name: 'Feijão', icon: '🫘', color: '#8B5CF6', parent: 'Básicos' },
  { name: 'Macarrão', icon: '🍝', color: '#F97316', parent: 'Básicos' },
  { name: 'Óleo / Azeite', icon: '🫙', color: '#EAB308', parent: 'Básicos' },
  { name: 'Bovina', icon: '🥩', color: '#E11D48', parent: 'Carnes' },
  { name: 'Aves', icon: '🍗', color: '#F43F5E', parent: 'Carnes' },
  { name: 'Suína', icon: '🥓', color: '#FB7185', parent: 'Carnes' },
  { name: 'Leite', icon: '🥛', color: '#38BDF8', parent: 'Laticínios' },
  { name: 'Queijos', icon: '🧀', color: '#FBBF24', parent: 'Laticínios' },
  { name: 'Iogurtes', icon: '🥣', color: '#F9A8D4', parent: 'Laticínios' },
  { name: 'Frutas', icon: '🍎', color: '#10B981', parent: 'Hortifruti' },
  { name: 'Verduras', icon: '🥬', color: '#22C55E', parent: 'Hortifruti' },
  { name: 'Legumes', icon: '🥕', color: '#F97316', parent: 'Hortifruti' },
]

export async function createInitialCategories(tx: Prisma.TransactionClient, userId: string) {
  const pending = [...INITIAL_CATEGORIES]
  const ids = new Map<string, string>()
  while (pending.length) {
    const ready = pending.filter((category) => !category.parent || ids.has(category.parent))
    if (!ready.length) throw new Error('Plano de contas inicial contém uma referência circular.')
    for (const category of ready) {
      const row = await tx.category.upsert({
        where: { userId_name: { userId, name: category.name } },
        update: {},
        create: {
          userId,
          name: category.name,
          icon: category.icon,
          color: category.color,
          allowedUnits: category.allowedUnits ?? initialUnitsFor(category.name),
          parentId: category.parent ? ids.get(category.parent) : null,
        },
        select: { id: true },
      })
      ids.set(category.name, row.id)
      pending.splice(pending.indexOf(category), 1)
    }
  }
}

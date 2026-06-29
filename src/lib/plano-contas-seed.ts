import type { Prisma } from '@/generated/prisma/client'

export type InitialGroup = {
  nome: string
  icone: string
  cor: string
  parent?: string
  allowedUnits?: string[]
}

const WEIGHT_UNITS = ['kg', 'g', 'un', 'pct']
const LIQUID_UNITS = ['L', 'ml', 'un', 'pct']
const FOOD_UNITS = ['kg', 'g', 'L', 'ml', 'un', 'pct', 'cx']
const GENERAL_UNITS = ['un', 'pct', 'cx', 'dz']

export function initialUnitsFor(name: string) {
  if (['Arroz', 'Feijão', 'Aveia', 'Carnes', 'Bovinos', 'Aves', 'Frango', 'Suínos', 'Hortifruti', 'Frutas', 'Verduras', 'Legumes', 'Queijo', 'Padaria'].includes(name)) return WEIGHT_UNITS
  if (['Bebidas', 'Leite'].includes(name)) return LIQUID_UNITS
  if (['Alimentação', 'Grãos e Cereais', 'Laticínios'].includes(name)) return FOOD_UNITS
  return GENERAL_UNITS
}

// Estrutura inicial 100% editável depois pelo usuário.
export const INITIAL_GROUPS: InitialGroup[] = [
  // Nível 1
  { nome: 'Alimentação', icone: '🍽️', cor: '#635BFF' },
  { nome: 'Casa', icone: '🏠', cor: '#8B5CF6' },
  { nome: 'Farmácia', icone: '💊', cor: '#EF4444' },
  { nome: 'Assinaturas', icone: '🔁', cor: '#0EA5E9' },
  { nome: 'Transporte', icone: '🚌', cor: '#64748B' },
  { nome: 'Lazer', icone: '🎉', cor: '#F59E0B' },
  { nome: 'Outros', icone: '📦', cor: '#9CA3AF' },

  // Alimentação
  { nome: 'Carnes', icone: '🥩', cor: '#EC4899', parent: 'Alimentação' },
  { nome: 'Grãos e Cereais', icone: '🌾', cor: '#6366F1', parent: 'Alimentação' },
  { nome: 'Laticínios', icone: '🥛', cor: '#F472B6', parent: 'Alimentação' },
  { nome: 'Hortifruti', icone: '🥬', cor: '#14B8A6', parent: 'Alimentação' },
  { nome: 'Padaria', icone: '🥖', cor: '#F59E0B', parent: 'Alimentação' },
  { nome: 'Bebidas', icone: '🥤', cor: '#F97316', parent: 'Alimentação' },
  { nome: 'Temperos e Condimentos', icone: '🧂', cor: '#A855F7', parent: 'Alimentação' },
  { nome: 'Doces e Snacks', icone: '🍫', cor: '#D946EF', parent: 'Alimentação' },

  // Carnes
  { nome: 'Aves', icone: '🍗', cor: '#F43F5E', parent: 'Carnes' },
  { nome: 'Bovinos', icone: '🐄', cor: '#E11D48', parent: 'Carnes' },
  { nome: 'Suínos', icone: '🥓', cor: '#FB7185', parent: 'Carnes' },
  { nome: 'Frango', icone: '🐔', cor: '#FB7185', parent: 'Aves' },

  // Grãos e Cereais
  { nome: 'Arroz', icone: '🍚', cor: '#6366F1', parent: 'Grãos e Cereais' },
  { nome: 'Feijão', icone: '🫘', cor: '#8B5CF6', parent: 'Grãos e Cereais' },
  { nome: 'Aveia', icone: '🥣', cor: '#F59E0B', parent: 'Grãos e Cereais' },

  // Laticínios
  { nome: 'Leite', icone: '🥛', cor: '#38BDF8', parent: 'Laticínios' },
  { nome: 'Queijo', icone: '🧀', cor: '#FBBF24', parent: 'Laticínios' },
  { nome: 'Iogurte', icone: '🍶', cor: '#F9A8D4', parent: 'Laticínios' },

  // Hortifruti
  { nome: 'Frutas', icone: '🍎', cor: '#10B981', parent: 'Hortifruti' },
  { nome: 'Verduras', icone: '🥬', cor: '#22C55E', parent: 'Hortifruti' },
  { nome: 'Legumes', icone: '🥕', cor: '#F97316', parent: 'Hortifruti' },

  // Casa
  { nome: 'Limpeza', icone: '🧹', cor: '#22C7D6', parent: 'Casa' },
  { nome: 'Higiene', icone: '🧴', cor: '#EC4899', parent: 'Casa' },
  { nome: 'Manutenção', icone: '🔧', cor: '#0891B2', parent: 'Casa' },
  { nome: 'Utensílios', icone: '🍴', cor: '#06B6D4', parent: 'Casa' },

  // Farmácia
  { nome: 'Medicamentos', icone: '💊', cor: '#EF4444', parent: 'Farmácia' },
  { nome: 'Suplementos', icone: '💪', cor: '#F97316', parent: 'Farmácia' },
  { nome: 'Cuidados pessoais', icone: '🧼', cor: '#F472B6', parent: 'Farmácia' },
]

export async function createInitialPlanoContas(tx: Prisma.TransactionClient, userId: string) {
  const pending = [...INITIAL_GROUPS]
  const ids = new Map<string, string>()
  const orderByParent = new Map<string | null, number>()
  while (pending.length) {
    const ready = pending.filter((group) => !group.parent || ids.has(group.parent))
    if (!ready.length) throw new Error('Plano de contas inicial contém uma referência circular.')
    for (const group of ready) {
      const parentId = group.parent ? ids.get(group.parent) ?? null : null
      const ordem = orderByParent.get(parentId) ?? 0
      orderByParent.set(parentId, ordem + 1)
      const row = await tx.planoConta.create({
        data: {
          userId,
          nome: group.nome,
          tipo: 'GRUPO',
          parentId,
          ordem,
          icone: group.icone,
          cor: group.cor,
          allowedUnits: group.allowedUnits ?? initialUnitsFor(group.nome),
        },
        select: { id: true },
      })
      ids.set(group.nome, row.id)
      pending.splice(pending.indexOf(group), 1)
    }
  }
}

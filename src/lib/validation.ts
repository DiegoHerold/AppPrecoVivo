import { z } from 'zod'

export const behaviorValues = [
  'recorrente_semanal',
  'recorrente_mensal',
  'estoque',
  'pontual',
  'sazonal',
  'emergencia',
  'fora_do_padrao',
] as const

export const measureUnitValues = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz'] as const

export const storeTypeValues = [
  'mercado',
  'farmacia',
  'pet_shop',
  'padaria',
  'atacado',
  'conveniencia',
  'loja',
  'outro',
] as const

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.email('Informe um e-mail válido.').trim().toLowerCase(),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'),
})

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.').trim().toLowerCase(),
  password: z.string().min(1, 'Informe sua senha.'),
})

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80, 'Use no máximo 80 caracteres.'),
  email: z.email('Informe um e-mail válido.').trim().toLowerCase(),
  phone: z.string().trim().max(24, 'Telefone muito longo.').optional().or(z.literal('')),
  city: z.string().trim().max(80, 'Cidade muito longa.').optional().or(z.literal('')),
  state: z.string().trim().toUpperCase().length(2, 'Use a sigla do estado.').optional().or(z.literal('')),
  settings: z.object({
    theme: z.enum(['system', 'light', 'dark']),
    cameraFacingMode: z.enum(['environment', 'user']),
    notificationsEnabled: z.boolean(),
    monthlySummaryEnabled: z.boolean(),
    priceAlertsEnabled: z.boolean(),
    compactMode: z.boolean(),
  }),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Informe sua senha atual.'),
  newPassword: z.string().min(8, 'A nova senha precisa ter ao menos 8 caracteres.'),
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: 'A nova senha precisa ser diferente da atual.',
  path: ['newPassword'],
})

export const planoGrupoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do grupo.').max(60, 'Use no máximo 60 caracteres.'),
  icone: z.string().trim().min(1, 'Escolha um ícone.').max(8, 'Use apenas um ícone curto.'),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Escolha uma cor válida.'),
  parentId: z.string().trim().nullable().optional(),
  allowedUnits: z.array(z.enum(measureUnitValues)).min(1, 'Escolha ao menos uma unidade de medida.'),
  ativo: z.boolean().optional(),
})

export const planoGrupoUpdateSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(60, 'Use no máximo 60 caracteres.').optional(),
  icone: z.string().trim().min(1).max(8).optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Escolha uma cor válida.').optional(),
  allowedUnits: z.array(z.enum(measureUnitValues)).min(1).optional(),
  ativo: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos uma alteração.' })

export const planoProdutoSchema = z.object({
  standardName: z.string().trim().min(2, 'Informe o nome do produto.').max(120, 'Use no máximo 120 caracteres.'),
  groupId: z.string().min(1, 'Escolha um grupo.'),
  behaviorType: z.enum(behaviorValues),
  estimatedDurationMonths: z.coerce.number().min(1).max(24).default(1),
  defaultUnit: z.enum(measureUnitValues),
  brand: z.string().trim().max(80).optional().or(z.literal('')),
  packageSize: z.string().trim().max(40).optional().or(z.literal('')),
})

export const planoMoveSchema = z.object({
  parentId: z.string().trim().min(1).nullable(),
  ordem: z.coerce.number().int().min(0).optional(),
})

export const purchaseItemSchema = z.object({
  rawName: z.string().trim().min(2, 'Informe o nome do item.'),
  quantity: z.coerce.number().positive('A quantidade deve ser maior que zero.'),
  unit: z.string().trim().min(1, 'Informe a unidade.'),
  unitPrice: z.coerce.number().positive('Informe um preço válido.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  behaviorType: z.enum(behaviorValues),
  estimatedDurationMonths: z.coerce.number().min(1).max(24),
})

export const manualPurchaseSchema = z.object({
  storeName: z.string().trim().min(2, 'Informe o estabelecimento.'),
  storeType: z.enum(storeTypeValues),
  storeDocument: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2).optional(),
  purchaseDate: z.iso.date('Informe uma data válida.'),
  totalAmount: z.coerce.number().positive('O total precisa ser maior que zero.'),
  accessKey: z.string().trim().max(44).optional(),
  nfceUrl: z.string().trim().url('Informe uma URL válida.').optional().or(z.literal('')),
  items: z.array(purchaseItemSchema).min(1, 'Adicione ao menos um item.'),
})

export const rawTextImportSchema = z.object({
  storeName: z.string().trim().min(2),
  storeType: z.enum(storeTypeValues),
  purchaseDate: z.iso.date(),
  rawText: z.string().trim().min(3, 'Cole ao menos um item.'),
})

export const pendingImportSchema = z.object({
  inputType: z.enum(['image', 'pdf', 'access_key', 'nfce_url', 'qr_code_url']),
  inputValue: z.string().trim().optional(),
  fileUrl: z.string().trim().optional(),
  purchaseDate: z.iso.date(),
  accessKey: z.string().trim().optional(),
  nfceUrl: z.string().trim().optional(),
})

export const reviewSchema = z.object({
  // Omitidos por padrão: revisar nome/categoria não deve sobrescrever a
  // recorrência já cadastrada. Só chegam quando o usuário edita esse bloco.
  behaviorType: z.enum(behaviorValues).optional(),
  estimatedDurationMonths: z.coerce.number().min(1).max(24).optional(),
  categoryId: z.string().min(1),
  standardName: z.string().trim().min(2),
})

export const productUpdateSchema = z.object({
  standardName: z.string().trim().min(2, 'Informe o nome do produto.').max(120, 'Use no máximo 120 caracteres.'),
  brand: z.string().trim().max(80, 'Use no máximo 80 caracteres.').optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Escolha uma classificação.'),
  behaviorType: z.enum(behaviorValues),
  estimatedDurationMonths: z.coerce.number().min(1, 'A duração mínima é de um mês.').max(24, 'A duração máxima é de 24 meses.'),
  defaultUnit: z.enum(measureUnitValues),
  packageSize: z.string().trim().max(40, 'Use no máximo 40 caracteres.').optional().or(z.literal('')),
  applyToHistory: z.boolean().default(true),
})

export type BehaviorType = 'recorrente_semanal' | 'recorrente_mensal' | 'estoque' | 'pontual' | 'sazonal' | 'emergencia' | 'fora_do_padrao'
export type MeasureUnit = 'un' | 'kg' | 'g' | 'L' | 'ml' | 'pct' | 'cx' | 'dz'
export type UserSettingsDto = {
  theme: 'system' | 'light' | 'dark'
  themePreset: import('./themes').ThemePresetId
  favoriteThemes: [import('./themes').ThemePresetId, import('./themes').ThemePresetId]
  cameraFacingMode: 'environment' | 'user'
  notificationsEnabled: boolean
  monthlySummaryEnabled: boolean
  priceAlertsEnabled: boolean
  compactMode: boolean
}
export type UserDto = {
  id: string; name: string; email: string; phone: string | null; city: string | null; state: string | null; createdAt: string
  settings: UserSettingsDto
}
export type CategoryDto = {
  id: string; parentId: string | null; name: string; icon: string; color: string; active: boolean; level: number; path: string[]
  allowedUnits: MeasureUnit[]
  totalSpent: number; previousTotalSpent: number; estimatedConsumption: number; stockAmount: number; variation: number
  variationPercentage: number | null; shareOfTotal: number; contributionToChange: number; productCount: number
}
export type PlanoContaNode = {
  id: string; nome: string; tipo: 'GRUPO' | 'PRODUTO'; parentId: string | null; produtoId: string | null
  ativo: boolean; ordem: number; icone: string; cor: string; allowedUnits: MeasureUnit[]
  level: number; path: string[]; childrenCount: number; productCount: number; itemCount: number
  defaultUnit?: MeasureUnit; brand?: string | null; packageSize?: string | null
  behaviorType?: BehaviorType; estimatedDurationMonths?: number; productActive?: boolean
}
export type InsightDto = { id: string; type: string; title: string; description: string; amount: number }
export type ConfidenceLevel = 'muito_baixa' | 'baixa' | 'media' | 'alta' | 'instavel'
export type StockStatus = 'sem_dados' | 'recem_abastecido' | 'saudavel' | 'proximo_do_fim' | 'possivel_falta'
export type TrendDirection = 'aumentando' | 'diminuindo' | 'estavel'
export type InferenceProductSummaryDto = {
  productId: string; name: string; category: string | null; status: StockStatus
  daysRemaining: number | null; confidence: ConfidenceLevel
}
export type InferenceDashboardDto = {
  generatedAt: string; productsWithStockEstimate: number
  nearEnd: InferenceProductSummaryDto[]; recentlyRefilled: InferenceProductSummaryDto[]
  staleProducts: InferenceProductSummaryDto[]; earlyPurchases: InferenceProductSummaryDto[]
  possibleShortages: InferenceProductSummaryDto[]
  topConsumingCategories: { category: string; estimatedMonthlyCost: number; productCount: number }[]
  consumptionByMonth: { month: string; label: string; total: number }[]
  spendByMonth: { month: string; label: string; total: number }[]
  currentMonth: { totalSpent: number; productsPurchased: number; purchaseCount: number }
  topStores: { store: string; purchaseCount: number }[]
}
export type ProductInferenceEventDto = {
  type: string; title: string; description: string; impact: string; date: string
  confidence: ConfidenceLevel; details: Record<string, number | string | null>
}
export type ProductInferenceDto = {
  productId: string; name: string; category: string | null; unit: string
  estimatedStock: number; estimatedStockLabel: string; daysRemaining: number | null
  projectedDepletionDate: string | null; dailyConsumption: number | null
  monthlyConsumption: number | null; estimatedMonthlyCost: number | null
  lastPurchaseDate: string | null; averagePrice: number | null; minPrice: number | null
  maxPrice: number | null; quantityPurchasedLastYear: number; purchaseCount: number
  usablePurchaseCount: number; refillCount: number; averagePurchaseIntervalDays: number | null
  purchaseFrequencyPerMonth: number | null; trend: TrendDirection; status: StockStatus
  confidence: ConfidenceLevel; confidenceLabel: string; recentEvents: ProductInferenceEventDto[]
}
export type DashboardDto = {
  year: number; month: number; monthLabel: string; previousMonthLabel: string; totalSpent: number; previousTotalSpent: number
  difference: number; estimatedConsumption: number; stockAmount: number; recurringAmount: number; punctualAmount: number
  priceIncreaseAmount: number; quantityIncreaseAmount: number; purchaseCount: number; categories: CategoryDto[]
  comparison: {
    kind: 'same_days_previous_month' | 'full_previous_month'; isPartial: boolean; throughDay: number
    referenceThroughDay: number; label: string; differencePercentage: number | null
  }
  variation: {
    components: { type: 'price' | 'quantity' | 'new_products' | 'removed_products' | 'mix'; label: string; description: string; amount: number }[]
    principalMessage: string; reconciledTotal: number
  }
  productImpacts: {
    id: string; name: string; behaviorType: BehaviorType; status: 'new' | 'removed' | 'changed' | 'out_of_pattern' | 'unit_incompatible'
    currentAmount: number; referenceAmount: number; variation: number; variationPercentage: number | null
    priceEffect: number; quantityEffect: number; mixEffect: number; currentUnitPrice: number | null
    referenceUnitPrice: number | null; currentQuantity: number | null; referenceQuantity: number | null
    unit: string | null; unitComparable: boolean
  }[]
  attention: {
    id: string; type: string; title: string; description: string; amount: number | null
    confidence: ConfidenceLevel | string | null; productId: string | null
  }[]
  history: { label: string; month: number; year: number; totalSpent: number; estimatedConsumption: number; partial: boolean }[]
  insights: InsightDto[]; outOfPattern: { name: string; amount: number; behaviorType: BehaviorType }[]
  classification: {
    selected: CategoryDto | null
    breadcrumbs: { id: string; name: string; icon: string; color: string }[]
    children: CategoryDto[]
    directTotalSpent: number; directPreviousTotalSpent: number
    products: { id: string; name: string; amount: number; previousAmount: number; variation: number; variationPercentage: number | null; purchaseCount: number; averageUnitPrice: number; unit: string }[]
  }
}
export type ProductDto = {
  id: string; accountPlanId: string; accountName: string; accountActive: boolean
  standardName: string; brand?: string | null; behaviorType: BehaviorType; estimatedDurationMonths: number
  defaultUnit: string; packageSize?: string | null; categoryName: string; categoryIcon: string; categoryColor: string
  lastPrice: number; lastPurchaseDate: string | null; purchaseCount: number
}
export type ProductDetailDto = ProductDto & {
  categoryId: string; allowedUnits: MeasureUnit[]
  minimumPrice: number; maximumPrice: number; averagePrice: number; averageQuantity: number; frequencyDays: number | null; monthlyCost: number
  history: { id: string; purchaseDate: string; storeName: string; quantity: number; unit: string; unitPrice: number; totalPrice: number }[]
}
export type ReviewDto = {
  id: string; rawName: string; productId: string | null; productName: string; categoryId: string; categoryName: string
  behaviorType: BehaviorType; estimatedDurationMonths: number; matchConfidence: number; quantity: number; unit: string; unitPrice: number; totalPrice: number; purchaseDate: string
}
export type PurchaseDto = {
  id: string; storeName: string; storeType: string; purchaseDate: string; totalAmount: number; importStatus: string; reviewStatus: string
  estimatedConsumption: number; stockAmount: number; job: { status: string; message: string | null } | null
  items: { id: string; rawName: string; productName: string; categoryName: string; behaviorType: BehaviorType; estimatedDurationMonths: number; quantity: number; unit: string; unitPrice: number; totalPrice: number; needsReview: boolean }[]
}
export type AppScreen = 'home' | 'profile' | 'add' | 'manual' | 'text' | 'processing' | 'summary' | 'reviews' | 'flow' | 'products' | 'product' | 'categories'

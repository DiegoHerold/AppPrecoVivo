export type BehaviorType = 'recorrente_semanal' | 'recorrente_mensal' | 'estoque' | 'pontual' | 'sazonal' | 'emergencia' | 'fora_do_padrao'
export type MeasureUnit = 'un' | 'kg' | 'g' | 'L' | 'ml' | 'pct' | 'cx' | 'dz'
export type UserSettingsDto = {
  theme: 'system' | 'light' | 'dark'
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
  totalSpent: number; estimatedConsumption: number; stockAmount: number; variation: number; productCount: number
}
export type PlanoContaNode = {
  id: string; nome: string; tipo: 'GRUPO' | 'PRODUTO'; parentId: string | null; produtoId: string | null
  ativo: boolean; ordem: number; icone: string; cor: string; allowedUnits: MeasureUnit[]
  level: number; path: string[]; childrenCount: number; productCount: number; itemCount: number
  defaultUnit?: MeasureUnit; brand?: string | null; packageSize?: string | null
  behaviorType?: BehaviorType; estimatedDurationMonths?: number; productActive?: boolean
}
export type InsightDto = { id: string; type: string; title: string; description: string; amount: number }
export type DashboardDto = {
  year: number; month: number; monthLabel: string; previousMonthLabel: string; totalSpent: number; previousTotalSpent: number
  difference: number; estimatedConsumption: number; stockAmount: number; recurringAmount: number; punctualAmount: number
  priceIncreaseAmount: number; quantityIncreaseAmount: number; purchaseCount: number; categories: CategoryDto[]
  history: { label: string; month: number; year: number; totalSpent: number; estimatedConsumption: number }[]
  insights: InsightDto[]; outOfPattern: { name: string; amount: number; behaviorType: BehaviorType }[]
  classification: {
    selected: CategoryDto | null
    breadcrumbs: { id: string; name: string; icon: string; color: string }[]
    children: CategoryDto[]
    products: { id: string; name: string; amount: number; purchaseCount: number; averageUnitPrice: number; unit: string }[]
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

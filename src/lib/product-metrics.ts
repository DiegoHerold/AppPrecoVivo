import { toStandardUnit } from '@/domain/value-objects/quantity'

export function normalizeProductPurchaseMetrics(input: {
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  defaultUnit: string
}) {
  const standard = toStandardUnit({ amount: input.quantity, unit: input.unit }, input.defaultUnit)
  if (!standard.converted || standard.amount <= 0) {
    return { quantity: input.quantity, unitPrice: input.unitPrice, comparable: false }
  }
  return {
    quantity: standard.amount,
    unitPrice: input.totalPrice / standard.amount,
    comparable: true,
  }
}

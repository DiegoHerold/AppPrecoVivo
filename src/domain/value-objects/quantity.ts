/**
 * Value-object Quantity: uma quantidade física com unidade.
 *
 * O motor acumula estoque sempre na UNIDADE PADRÃO do produto. Quando uma
 * compra chega em unidade diferente (ex.: 500 g de um produto cuja unidade
 * padrão é kg), convertemos para a unidade padrão antes de somar ao estoque.
 *
 * A tabela de conversão é deliberadamente simples e genérica — serve para
 * supermercado, farmácia, pet shop, limpeza, etc. — e NÃO contém regras
 * hardcoded por produto específico (arroz, leite...). Unidades desconhecidas
 * ou incompatíveis são tratadas como "não conversíveis": nesse caso o motor
 * mantém a quantidade como está e sinaliza menor confiança a montante.
 */

export type UnitFamily = 'mass' | 'volume' | 'count'

/** Fatores para a unidade base de cada família (g, ml, un). */
const UNIT_TO_BASE: Record<string, { family: UnitFamily; factor: number }> = {
  // massa -> base: grama
  mg: { family: 'mass', factor: 0.001 },
  g: { family: 'mass', factor: 1 },
  grama: { family: 'mass', factor: 1 },
  gramas: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  // volume -> base: mililitro
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  lt: { family: 'volume', factor: 1000 },
  litro: { family: 'volume', factor: 1000 },
  litros: { family: 'volume', factor: 1000 },
  // contagem -> base: unidade
  un: { family: 'count', factor: 1 },
  und: { family: 'count', factor: 1 },
  unidade: { family: 'count', factor: 1 },
  pct: { family: 'count', factor: 1 },
  pacote: { family: 'count', factor: 1 },
  cx: { family: 'count', factor: 1 },
  caixa: { family: 'count', factor: 1 },
  fardo: { family: 'count', factor: 1 },
  rolo: { family: 'count', factor: 1 },
  dz: { family: 'count', factor: 12 },
  duzia: { family: 'count', factor: 12 },
}

export function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function lookup(unit: string) {
  return UNIT_TO_BASE[normalizeUnit(unit)] ?? null
}

export function unitFamily(unit: string): UnitFamily | null {
  return lookup(unit)?.family ?? null
}

/**
 * Tenta converter `amount` da unidade `from` para a unidade `to`.
 * Retorna null quando as unidades pertencem a famílias diferentes ou quando
 * alguma delas é desconhecida — o chamador decide como degradar.
 */
export function convertQuantity(
  amount: number,
  from: string,
  to: string,
): number | null {
  const source = lookup(from)
  const target = lookup(to)
  if (!source || !target) return null
  if (source.family !== target.family) return null
  const inBase = amount * source.factor
  return inBase / target.factor
}

export interface Quantity {
  amount: number
  unit: string
}

/**
 * Converte uma Quantity para a unidade padrão do produto.
 * Quando a conversão é impossível, devolve a quantidade original e
 * `converted: false` para que o motor possa reduzir a confiança.
 */
export function toStandardUnit(
  quantity: Quantity,
  standardUnit: string,
): { amount: number; unit: string; converted: boolean } {
  if (normalizeUnit(quantity.unit) === normalizeUnit(standardUnit)) {
    return { amount: quantity.amount, unit: standardUnit, converted: true }
  }
  const converted = convertQuantity(quantity.amount, quantity.unit, standardUnit)
  if (converted === null) {
    return { amount: quantity.amount, unit: quantity.unit, converted: false }
  }
  return { amount: converted, unit: standardUnit, converted: true }
}

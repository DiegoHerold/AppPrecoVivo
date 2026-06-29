/**
 * Engine de confiança — traduz "quantidade e qualidade dos dados" em um nível
 * de confiança honesto. A interface NUNCA deve apresentar estimativas como
 * verdades absolutas; estes níveis existem para suavizar a linguagem.
 *
 * Regras (por nº de ciclos de reposição = compras - 1):
 * - muito_baixa: menos de 2 compras registradas;
 * - baixa: 2 ou 3 ciclos;
 * - media: 4 a 8 ciclos;
 * - alta: mais de 10 ciclos;
 * - instavel: sobrepõe qualquer nível quando a variação é alta
 *   (coeficiente de variação acima do limiar), pois muitos dados ruidosos não
 *   produzem uma previsão confiável.
 */

import type { ConfidenceLevel } from '../../domain/types'

/** Acima deste coeficiente de variação consideramos a série instável. */
export const INSTABILITY_CV_THRESHOLD = 0.6

export interface ConfidenceInput {
  /** Número de compras registradas do produto. */
  purchaseCount: number
  /** Coeficiente de variação dos intervalos entre compras (ou null). */
  intervalCoefficientOfVariation: number | null
}

export function classifyConfidence(input: ConfidenceInput): ConfidenceLevel {
  const cycles = input.purchaseCount - 1

  if (input.purchaseCount < 2) return 'muito_baixa'

  // Variação alta domina: mesmo com muitos dados, a previsão é instável.
  if (
    input.intervalCoefficientOfVariation !== null &&
    input.intervalCoefficientOfVariation > INSTABILITY_CV_THRESHOLD &&
    cycles >= 2
  ) {
    return 'instavel'
  }

  if (cycles <= 3) return 'baixa'
  if (cycles <= 8) return 'media'
  if (cycles <= 10) return 'media'
  return 'alta'
}

const LABELS: Record<ConfidenceLevel, string> = {
  muito_baixa: 'Previsão com confiança muito baixa',
  baixa: 'Previsão com baixa confiança',
  media: 'Previsão com confiança média',
  alta: 'Previsão com alta confiança',
  instavel: 'Previsão instável (consumo irregular)',
}

export function confidenceLabel(level: ConfidenceLevel): string {
  return LABELS[level]
}

/**
 * Formata um número como estimativa textual honesta para a interface, ex.:
 * formatEstimate(2.34, 'kg') => "aproximadamente 2,3 kg".
 */
export function formatEstimate(
  value: number,
  unit: string,
  fractionDigits = 1,
): string {
  const rounded = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
  return `aproximadamente ${rounded} ${unit}`.trim()
}

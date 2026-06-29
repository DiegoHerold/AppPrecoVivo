/**
 * Tipos centrais do Motor de Inferência de Consumo.
 *
 * Princípio fundamental: NADA aqui é tratado como verdade absoluta. Toda
 * estimativa carrega um nível de confiança e é claramente separada entre
 * REPOSIÇÃO (compra registrada) e CONSUMO (uso estimado ao longo do tempo).
 *
 * Esta camada não conhece Prisma, React ou qualquer infraestrutura. São apenas
 * contratos puros usados pelo engine, repositories, services e presentation.
 */

/**
 * Nível de confiança de uma estimativa.
 * - muito_baixa: menos de 2 compras registradas (praticamente sem base);
 * - baixa: 2 ou 3 ciclos de reposição;
 * - media: 4 a 8 ciclos;
 * - alta: mais de 10 ciclos com regularidade;
 * - instavel: dados suficientes, mas com variação/desvio padrão alto.
 */
export type ConfidenceLevel =
  | 'muito_baixa'
  | 'baixa'
  | 'media'
  | 'alta'
  | 'instavel'

/**
 * Tendência detectada por regras estatísticas (nunca por IA).
 */
export type TrendDirection = 'aumentando' | 'diminuindo' | 'estavel'

/**
 * Status do estoque estimado de um produto.
 */
export type StockStatus =
  | 'sem_dados' // não há base suficiente para estimar
  | 'recem_abastecido' // compra recente, estoque alto
  | 'saudavel' // dentro do esperado
  | 'proximo_do_fim' // dias restantes baixos
  | 'possivel_falta' // estoque estimado <= 0 há algum tempo

/**
 * Tipos de evento de inferência calculados pelo motor.
 * O histórico original das compras NUNCA é sobrescrito; estes eventos são
 * uma camada derivada e reconstruível.
 */
export type InferenceEventType =
  | 'compra_normal'
  | 'compra_antecipada'
  | 'compra_tardia'
  | 'possivel_periodo_sem_produto'
  | 'compra_grande_volume'
  | 'compra_emergencia'
  | 'compra_sazonal'
  | 'consumo_aumentando'
  | 'consumo_diminuindo'

/**
 * Resultado genérico de uma estimativa: o valor e o quão confiável ele é.
 */
export interface Estimate<T> {
  value: T
  confidence: ConfidenceLevel
  /** Texto curto e honesto para a interface, ex.: "aproximadamente 2,3 kg". */
  label: string
}

/**
 * Conjunto de métricas estatísticas de uma série numérica.
 * Campos podem ser null quando não há dados suficientes.
 */
export interface SeriesStats {
  count: number
  mean: number | null
  median: number | null
  stdDev: number | null
  /** Coeficiente de variação = stdDev / mean. Mede instabilidade relativa. */
  coefficientOfVariation: number | null
  min: number | null
  max: number | null
  /** Média móvel das últimas N observações (mais recentes). */
  movingAverage: number | null
}

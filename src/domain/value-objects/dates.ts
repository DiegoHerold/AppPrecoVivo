/**
 * Utilidades puras de data usadas pelo motor. Trabalham em milissegundos /
 * dias inteiros e são determinísticas (sem dependência de fuso local além do
 * que é passado). Nenhuma regra de negócio mora aqui — só aritmética de tempo.
 */

export const MS_PER_DAY = 86_400_000

/** Diferença em dias (float) entre duas datas, sempre >= 0. */
export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY
}

/** Adiciona `days` (pode ser fracionário) a uma data. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

/** Chave de mês no formato YYYY-MM (UTC). */
export function monthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/** Índice do mês (1-12) em UTC. Útil para sazonalidade. */
export function monthIndex(date: Date): number {
  return date.getUTCMonth() + 1
}

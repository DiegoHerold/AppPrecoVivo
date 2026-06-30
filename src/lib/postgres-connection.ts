const legacySecureAliases = new Set(['prefer', 'require', 'verify-ca'])

/**
 * O pg atual trata estes modos como verify-full, mas o pg 9 adotará a semântica
 * mais permissiva do libpq. Tornamos explícito o comportamento seguro atual.
 */
export function normalizePostgresConnectionString(value: string | undefined) {
  if (!value) return value
  try {
    const url = new URL(value)
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return value
    const sslMode = url.searchParams.get('sslmode')?.toLowerCase()
    const useLibpqCompat = url.searchParams.get('uselibpqcompat')?.toLowerCase() === 'true'
    if (sslMode && legacySecureAliases.has(sslMode) && !useLibpqCompat) {
      url.searchParams.set('sslmode', 'verify-full')
    }
    return url.toString()
  } catch {
    return value
  }
}

export function resolveRuntimeDatabaseConnectionString(environment: Record<string, string | undefined>) {
  return normalizePostgresConnectionString(
    environment.DATABASE_URL ??
    environment.POSTGRES_PRISMA_URL ??
    environment.POSTGRES_URL ??
    environment.DATABASE_URL_UNPOOLED ??
    environment.POSTGRES_URL_NON_POOLING,
  )
}

export function resolveMigrationDatabaseConnectionString(environment: Record<string, string | undefined>) {
  return normalizePostgresConnectionString(
    environment.DIRECT_URL ??
    environment.DATABASE_URL_UNPOOLED ??
    environment.POSTGRES_URL_NON_POOLING ??
    environment.DATABASE_URL ??
    environment.POSTGRES_PRISMA_URL ??
    environment.POSTGRES_URL,
  )
}

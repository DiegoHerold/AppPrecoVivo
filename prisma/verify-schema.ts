import { Client } from 'pg'
import { resolveRuntimeDatabaseConnectionString } from '../src/lib/postgres-connection'

// Verifica a URL efetivamente usada pelas funções, não apenas a URL da migration.
const connectionString = resolveRuntimeDatabaseConnectionString(process.env)

if (!connectionString) {
  throw new Error('DATABASE_URL não foi configurada para verificar o schema.')
}

const client = new Client({ connectionString })

try {
  await client.connect()
  const result = await client.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns " +
    "WHERE table_schema = current_schema() " +
    "AND table_name = 'UserSettings' " +
    "AND column_name IN ('themePreset', 'favoriteThemes')",
  )
  const columns = new Set(result.rows.map((row) => row.column_name))
  const missing = ['themePreset', 'favoriteThemes'].filter((column) => !columns.has(column))
  if (missing.length) {
    throw new Error('Migration incompleta: colunas ausentes em UserSettings: ' + missing.join(', '))
  }
  console.log('Schema de produção verificado: preferências de tema disponíveis.')
} finally {
  await client.end()
}

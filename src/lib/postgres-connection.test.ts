import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePostgresConnectionString } from './postgres-connection'

test('torna explícita a validação completa usada pelo pg atual', () => {
  for (const sslMode of ['prefer', 'require', 'verify-ca']) {
    const normalized = normalizePostgresConnectionString(`postgresql://user:secret@db.example.com/app?schema=public&sslmode=${sslMode}`)
    const url = new URL(normalized as string)
    assert.equal(url.searchParams.get('sslmode'), 'verify-full')
    assert.equal(url.searchParams.get('schema'), 'public')
  }
})

test('respeita modos explícitos e a opção de compatibilidade com libpq', () => {
  const disabled = 'postgresql://user:secret@localhost/app?sslmode=disable'
  const compatible = 'postgresql://user:secret@db.example.com/app?uselibpqcompat=true&sslmode=require'
  assert.equal(normalizePostgresConnectionString(disabled), disabled)
  assert.equal(normalizePostgresConnectionString(compatible), compatible)
})

test('mantém URLs locais sem configuração SSL', () => {
  const local = 'postgresql://postgres:secret@localhost:5432/app?schema=public'
  assert.equal(normalizePostgresConnectionString(local), local)
})

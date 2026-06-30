import assert from 'node:assert/strict'
import test from 'node:test'
import { passwordChangeSchema, profileSchema } from './validation'

const validProfile = {
  name: 'Diego Silva',
  email: 'diego@example.com',
  phone: '(11) 99999-9999',
  city: 'São Paulo',
  state: 'sp',
  settings: {
    theme: 'system' as const,
    themePreset: 'claro_vivo' as const,
    favoriteThemes: ['claro_vivo', 'escuro_aurora'] as const,
    cameraFacingMode: 'environment' as const,
    notificationsEnabled: true,
    monthlySummaryEnabled: true,
    priceAlertsEnabled: true,
    compactMode: false,
  },
}

test('normaliza e valida dados de perfil e configurações', () => {
  const result = profileSchema.parse(validProfile)
  assert.equal(result.email, 'diego@example.com')
  assert.equal(result.state, 'SP')
  assert.equal(result.settings.cameraFacingMode, 'environment')
  assert.deepEqual(result.settings.favoriteThemes, ['claro_vivo', 'escuro_aurora'])
})

test('aceita somente dois temas favoritos diferentes e pré-validados', () => {
  assert.equal(profileSchema.safeParse({ ...validProfile, settings: { ...validProfile.settings, favoriteThemes: ['claro_vivo', 'claro_vivo'] } }).success, false)
  assert.equal(profileSchema.safeParse({ ...validProfile, settings: { ...validProfile.settings, themePreset: 'tema_inseguro' } }).success, false)
})

test('rejeita UF inválida e senha nova igual à atual', () => {
  assert.equal(profileSchema.safeParse({ ...validProfile, state: 'SÃO PAULO' }).success, false)
  assert.equal(passwordChangeSchema.safeParse({ currentPassword: '12345678', newPassword: '12345678' }).success, false)
})

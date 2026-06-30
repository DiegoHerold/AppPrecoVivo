import { getThemePreset } from '@/lib/themes'

export type DevicePreferences = {
  largeText: boolean
  highContrast: boolean
  reduceMotion: boolean
}

export const defaultDevicePreferences: DevicePreferences = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
}

const storageKey = 'preco-vivo-device-preferences'

export function readDevicePreferences(): DevicePreferences {
  if (typeof window === 'undefined') return defaultDevicePreferences
  try {
    return { ...defaultDevicePreferences, ...JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') }
  } catch {
    return defaultDevicePreferences
  }
}

export function applyDevicePreferences(preferences: DevicePreferences) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.fontScale = preferences.largeText ? 'large' : 'normal'
  document.documentElement.dataset.contrast = preferences.highContrast ? 'high' : 'normal'
  document.documentElement.dataset.reduceMotion = preferences.reduceMotion ? 'true' : 'false'
}

export function saveDevicePreferences(preferences: DevicePreferences) {
  window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  applyDevicePreferences(preferences)
}

export function applyThemePreference(theme: 'system' | 'light' | 'dark', presetId?: string) {
  if (typeof document === 'undefined') return
  const preset = getThemePreset(presetId ?? (theme === 'dark' ? 'escuro_aurora' : 'claro_vivo'))
  document.documentElement.dataset.theme = preset.mode
  document.documentElement.dataset.themePreset = preset.id
}

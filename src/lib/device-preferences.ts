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

export function applyThemePreference(theme: 'system' | 'light' | 'dark') {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light'
}

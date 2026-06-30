export const themePresetValues = [
  'claro_vivo',
  'areia_solar',
  'menta_serena',
  'ceu_limpo',
  'escuro_aurora',
  'noite_oceano',
  'grafite_rose',
  'floresta_noturna',
] as const

export type ThemePresetId = typeof themePresetValues[number]
export type ThemeMode = 'light' | 'dark'

export type ThemePreset = {
  id: ThemePresetId
  name: string
  description: string
  mode: ThemeMode
  colors: [string, string, string]
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'claro_vivo', name: 'Claro Vivo', description: 'Lavanda leve e luminoso', mode: 'light', colors: ['#F6F7FC', '#FFFFFF', '#635BFF'] },
  { id: 'areia_solar', name: 'Areia Solar', description: 'Creme quente e terracota', mode: 'light', colors: ['#F7F2EA', '#FFFAF3', '#C2642D'] },
  { id: 'menta_serena', name: 'Menta Serena', description: 'Verde calmo e natural', mode: 'light', colors: ['#EDF5F0', '#FBFFFC', '#168568'] },
  { id: 'ceu_limpo', name: 'Céu Limpo', description: 'Azul leve e organizado', mode: 'light', colors: ['#EEF5FA', '#FBFDFF', '#2577B8'] },
  { id: 'escuro_aurora', name: 'Escuro Aurora', description: 'Azul profundo e violeta', mode: 'dark', colors: ['#070B14', '#121B2E', '#8B83FF'] },
  { id: 'noite_oceano', name: 'Noite Oceano', description: 'Azul noturno e celeste', mode: 'dark', colors: ['#06101A', '#102538', '#51A7E8'] },
  { id: 'grafite_rose', name: 'Grafite Rosé', description: 'Grafite suave e rosé', mode: 'dark', colors: ['#100C12', '#241B28', '#E083AE'] },
  { id: 'floresta_noturna', name: 'Floresta Noturna', description: 'Verde escuro e equilibrado', mode: 'dark', colors: ['#07110F', '#132821', '#4EC69A'] },
]

export const DEFAULT_THEME_PRESET: ThemePresetId = 'claro_vivo'
export const DEFAULT_FAVORITE_THEMES: [ThemePresetId, ThemePresetId] = ['claro_vivo', 'escuro_aurora']

export function getThemePreset(id: string | null | undefined) {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0]
}

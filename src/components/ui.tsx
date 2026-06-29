'use client'

import type { ReactNode } from 'react'
import { BarChart3, Camera, CheckCircle2, ChevronLeft, Home, Package, RefreshCw } from 'lucide-react'
import type { AppScreen, BehaviorType } from '@/lib/client-types'

export const BEHAVIORS: Record<BehaviorType, { label: string; icon: string; color: string; bg: string }> = {
  recorrente_semanal: { label: 'Recorrente semanal', icon: '▣', color: '#4F46E5', bg: '#EEF2FF' },
  recorrente_mensal: { label: 'Recorrente mensal', icon: '▦', color: '#0891B2', bg: '#ECFEFF' },
  estoque: { label: 'Estoque', icon: '◉', color: '#059669', bg: '#ECFDF5' },
  pontual: { label: 'Pontual', icon: 'ϟ', color: '#F97316', bg: '#FFF7ED' },
  sazonal: { label: 'Sazonal', icon: '⌁', color: '#65A30D', bg: '#F7FEE7' },
  emergencia: { label: 'Emergência', icon: '▲', color: '#E11D48', bg: '#FFF1F2' },
  fora_do_padrao: { label: 'Fora do padrão', icon: '▲', color: '#D97706', bg: '#FFFBEB' },
}

export function BehaviorBadge({ behavior }: { behavior: BehaviorType }) {
  const item = BEHAVIORS[behavior]
  return <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold" style={{ color: item.color, background: item.bg }}>{item.icon} {item.label}</span>
}

export function PageHeader({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack?: () => void; action?: ReactNode }) {
  return <header className="sticky top-0 z-30 -mx-4 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
    <div className="flex items-center gap-2">
      {onBack && <button aria-label="Voltar" onClick={onBack} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><ChevronLeft size={18} /></button>}
      <div className="min-w-0 flex-1"><h1 className="truncate text-[15px] font-bold tracking-tight text-slate-950">{title}</h1>{subtitle && <p className="truncate text-[9px] text-slate-400">{subtitle}</p>}</div>
      {action}
    </div>
  </header>
}

export function LoadingState({ label = 'Organizando seus dados…' }: { label?: string }) {
  return <div className="grid min-h-72 place-content-center gap-3 text-center text-xs text-slate-400"><span className="mx-auto h-7 w-7 animate-spin rounded-full border-3 border-indigo-100 border-t-indigo-500" />{label}</div>
}

export function EmptyState({ icon = <Package />, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="mx-auto grid min-h-72 max-w-64 place-content-center justify-items-center gap-3 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-500">{icon}</span><strong className="text-sm text-slate-800">{title}</strong><p className="text-[11px] leading-5 text-slate-400">{description}</p>{action}</div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="mx-auto grid min-h-60 max-w-64 place-content-center justify-items-center gap-3 text-center"><RefreshCw className="text-rose-500" /><strong className="text-sm">Algo não saiu como esperado</strong><p className="text-[11px] text-slate-500">{message}</p>{retry && <button onClick={retry} className="text-xs font-semibold text-indigo-600">Tentar novamente</button>}</div>
}

const tabs: { screen: AppScreen; label: string; icon: typeof Home }[] = [
  { screen: 'home', label: 'Início', icon: Home },
  { screen: 'reviews', label: 'Revisar', icon: CheckCircle2 },
  { screen: 'add', label: 'Adicionar nota', icon: Camera },
  { screen: 'products', label: 'Produtos', icon: Package },
  { screen: 'flow', label: 'Fluxo', icon: BarChart3 },
]

export function BottomNav({ screen, navigate }: { screen: AppScreen; navigate: (screen: AppScreen) => void }) {
  return <nav aria-label="Navegação principal" className="absolute inset-x-0 bottom-0 z-50 grid h-[74px] grid-cols-5 border-t border-slate-200 bg-white px-2 pb-4 pt-2 shadow-[0_-6px_20px_rgba(15,23,42,.04)]">
    {tabs.map((tab) => { const Icon = tab.icon; const center = tab.screen === 'add'; const active = screen === tab.screen || (tab.screen === 'products' && (screen === 'product' || screen === 'categories')); return <button key={tab.screen} aria-label={tab.label} onClick={() => navigate(tab.screen)} className={`flex flex-col items-center gap-0.5 text-[8px] ${active ? 'text-indigo-600' : 'text-slate-400'} ${center ? '-translate-y-6' : ''}`}>
      <span className={center ? 'grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-indigo-600 text-white shadow-[0_6px_20px_rgba(79,70,229,.4)]' : `grid h-7 w-8 place-items-center rounded-lg ${active ? 'bg-indigo-50' : ''}`}><Icon size={center ? 24 : 18} /></span>
      {!center && <span>{tab.label}</span>}
    </button> })}
  </nav>
}

export function MetricCard({ label, value, detail, tone = 'plain' }: { label: string; value: string; detail: string; tone?: 'plain' | 'green' | 'cyan' | 'violet' | 'rose' }) {
  const tones = { plain: 'border-slate-200 bg-white text-slate-950', green: 'border-emerald-100 bg-emerald-50 text-emerald-700', cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700', violet: 'border-indigo-100 bg-indigo-50 text-indigo-700', rose: 'border-rose-100 bg-rose-50 text-rose-600' }
  return <article className={`min-w-0 rounded-xl border p-3 ${tones[tone]}`}><span className="block truncate text-[8px] text-slate-400">{label}</span><strong className="my-1 block text-[15px] tracking-tight">{value}</strong><small className="block text-[8px] leading-3 text-slate-400">{detail}</small></article>
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-[0_7px_18px_rgba(79,70,229,.25)] disabled:opacity-50 ${props.className ?? ''}`}>{children}</button>
}

export function StatusBar() {
  return <div className="absolute inset-x-0 top-0 z-[80] flex h-12 items-end justify-between bg-white px-6 pb-2 text-[10px] font-bold text-slate-950"><span>9:41</span><span className="absolute left-1/2 top-2 h-7 w-24 -translate-x-1/2 rounded-full bg-black" /><span className="tracking-[-2px]">▮▮▮ ◉ ▰</span></div>
}


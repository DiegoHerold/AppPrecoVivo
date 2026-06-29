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
  return <span className="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold" style={{ color: item.color, background: item.bg }}>{item.icon} {item.label}</span>
}

export function PageHeader({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack?: () => void; action?: ReactNode }) {
  return <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200/80 bg-white/95 px-4 py-3.5 backdrop-blur md:-mx-6 md:px-6">
    <div className="flex min-h-11 items-center gap-3">
      {onBack && <button aria-label="Voltar" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"><ChevronLeft size={21} /></button>}
      <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-bold tracking-tight text-slate-950">{title}</h1>{subtitle && <p className="truncate text-sm text-slate-600">{subtitle}</p>}</div>
      {action}
    </div>
  </header>
}

export function LoadingState({ label = 'Organizando seus dados…' }: { label?: string }) {
  return <div className="grid min-h-72 place-content-center gap-4 text-center text-sm text-slate-600"><span className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-100 border-t-indigo-500" />{label}</div>
}

export function EmptyState({ icon = <Package />, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="mx-auto grid min-h-72 max-w-sm place-content-center justify-items-center gap-4 px-4 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-500">{icon}</span><strong className="text-lg text-slate-900">{title}</strong><p className="text-sm leading-6 text-slate-600">{description}</p>{action}</div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="mx-auto grid min-h-60 max-w-sm place-content-center justify-items-center gap-4 px-4 text-center"><RefreshCw className="text-rose-500" /><strong className="text-lg">Algo não saiu como esperado</strong><p className="text-sm leading-6 text-slate-600">{message}</p>{retry && <button onClick={retry} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-indigo-600">Tentar novamente</button>}</div>
}

const tabs: { screen: AppScreen; label: string; icon: typeof Home }[] = [
  { screen: 'home', label: 'Início', icon: Home },
  { screen: 'reviews', label: 'Revisar', icon: CheckCircle2 },
  { screen: 'add', label: 'Adicionar nota', icon: Camera },
  { screen: 'products', label: 'Produtos', icon: Package },
  { screen: 'flow', label: 'Fluxo', icon: BarChart3 },
]

export function BottomNav({ screen, navigate }: { screen: AppScreen; navigate: (screen: AppScreen) => void }) {
  return <nav aria-label="Navegação principal" className="bottom-navigation grid grid-cols-5 border-t border-slate-200 bg-white px-2 pt-2 shadow-[0_-8px_28px_rgba(15,23,42,.08)]">
    {tabs.map((tab) => { const Icon = tab.icon; const center = tab.screen === 'add'; const active = screen === tab.screen || (tab.screen === 'products' && (screen === 'product' || screen === 'categories')); return <button key={tab.screen} aria-label={tab.label} onClick={() => navigate(tab.screen)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-medium transition ${active ? 'text-indigo-600' : 'text-slate-500'} ${center ? '-translate-y-4' : ''}`}>
      <span className={center ? 'grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-indigo-600 text-white shadow-[0_8px_24px_rgba(79,70,229,.38)]' : `grid h-8 w-10 place-items-center rounded-xl ${active ? 'bg-indigo-50' : ''}`}><Icon size={center ? 27 : 21} /></span>
      {!center && <span>{tab.label}</span>}
    </button> })}
  </nav>
}

export function MetricCard({ label, value, detail, tone = 'plain' }: { label: string; value: string; detail: string; tone?: 'plain' | 'green' | 'cyan' | 'violet' | 'rose' }) {
  const tones = { plain: 'border-slate-200 bg-white text-slate-950', green: 'border-emerald-100 bg-emerald-50 text-emerald-700', cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700', violet: 'border-indigo-100 bg-indigo-50 text-indigo-700', rose: 'border-rose-100 bg-rose-50 text-rose-600' }
  return <article className={`flex min-h-32 min-w-0 flex-col rounded-2xl border p-4 ${tones[tone]}`}><span className="block text-sm font-medium leading-5 text-slate-600">{label}</span><strong className="my-2 block text-xl tracking-tight">{value}</strong><small className="mt-auto block text-[13px] leading-5 text-slate-600">{detail}</small></article>
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-base font-bold text-white shadow-[0_8px_22px_rgba(79,70,229,.24)] transition active:scale-[.985] disabled:opacity-50 ${props.className ?? ''}`}>{children}</button>
}

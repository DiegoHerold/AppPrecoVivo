'use client'

import { useState } from 'react'
import { Check, CheckCircle2, Edit3, Plus } from 'lucide-react'
import { clientApi, brl } from '@/lib/client-api'
import type { BehaviorType, CategoryDto, ReviewDto } from '@/lib/client-types'
import { BEHAVIORS, EmptyState, PageHeader, PrimaryButton } from './ui'

function ReviewEditor({ item, reviewsCount, categories, confirmed }: { item: ReviewDto; reviewsCount: number; categories: CategoryDto[]; confirmed: () => Promise<void> }) {
  const [behavior, setBehavior] = useState<BehaviorType>(item?.behaviorType ?? 'pontual')
  const [duration, setDuration] = useState(item?.estimatedDurationMonths ?? 1)
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '')
  const [standardName, setStandardName] = useState(item?.productName ?? '')
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  async function confirm() { setSaving(true); try { await clientApi(`/api/reviews/${item.id}`, { method: 'PATCH', body: JSON.stringify({ behaviorType: behavior, estimatedDurationMonths: duration, categoryId, standardName }) }); setLeaving(true); window.setTimeout(async () => { setLeaving(false); await confirmed() }, 240) } finally { setSaving(false) } }
  return <><div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-indigo-500" style={{ width: `${100 / Math.max(1, reviewsCount)}%` }} /></div><article className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all ${leaving ? 'translate-x-full rotate-3 opacity-0' : ''}`}><div className="rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[7px] text-slate-500"><span className="mr-2 rounded bg-slate-200 px-1">NOTA</span>{item.rawName}</div><p className="mt-3 text-[8px] text-slate-400">Produto identificado</p><input value={standardName} onChange={(event) => setStandardName(event.target.value)} className="mt-1 w-full border-0 bg-transparent text-sm font-black outline-none" /><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-[9px]">{categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}</select><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-50 p-2"><span className="text-[7px] text-slate-400">Preço nesta nota</span><strong className="block text-sm">{brl(item.unitPrice)}</strong></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-[7px] text-slate-400">Quantidade</span><strong className="block text-sm">{item.quantity} {item.unit}</strong></div></div><div className="mt-2 rounded-lg bg-indigo-50 p-2 text-[8px] text-indigo-700">O sistema encontrou <b>{Math.round(item.matchConfidence * 100)}% de confiança</b>. Sua confirmação salvará o alias.</div></article>
      <section className="mt-2 rounded-2xl border border-slate-200 bg-white p-3"><h2 className="mb-2 text-[10px] font-bold">Como esse produto se comporta?</h2><div className="flex flex-wrap gap-1.5">{(Object.keys(BEHAVIORS) as BehaviorType[]).map((type) => { const config = BEHAVIORS[type]; return <button key={type} onClick={() => setBehavior(type)} className="rounded-full border px-2 py-1.5 text-[8px]" style={behavior === type ? { borderColor: config.color, color: config.color, background: config.bg } : { borderColor: '#E5E7EB', color: '#64748B' }}>{config.icon} {config.label}</button> })}</div></section>
      {behavior === 'estoque' && <section className="mt-2 rounded-2xl border border-slate-200 bg-white p-3"><h2 className="mb-2 text-[10px] font-bold">Quanto tempo dura?</h2><div className="grid grid-cols-4 gap-2">{[1, 2, 3, 6].map((value) => <button key={value} onClick={() => setDuration(value)} className={`rounded-lg p-2 text-[8px] ${duration === value ? 'bg-emerald-100 font-bold text-emerald-700 ring-1 ring-emerald-400' : 'bg-slate-100 text-slate-500'}`}>{value}<small className="block text-[6px]">{value === 1 ? 'mês' : 'meses'}</small></button>)}</div><p className="mt-2 text-center text-[7px] text-emerald-600">Custo mensal estimado: {brl(item.totalPrice / Math.max(1, duration))}</p></section>}
      <div className="sticky bottom-0 -mx-4 mt-3 border-t border-slate-200 bg-white/95 px-4 py-3"><PrimaryButton onClick={confirm} disabled={saving}>{saving ? 'Salvando…' : <><Check size={17} /> Confirmar</>}</PrimaryButton><div className="mt-2 grid grid-cols-2 gap-2"><button className="rounded-lg bg-slate-100 py-2 text-[8px] text-slate-600"><Edit3 size={13} className="mr-1 inline" />Editar</button><button className="rounded-lg bg-slate-100 py-2 text-[8px] text-slate-600"><Plus size={13} className="mr-1 inline" />Criar novo</button></div></div></>
}

export function ReviewsScreen({ reviews, categories, onBack, confirmed }: { reviews: ReviewDto[]; categories: CategoryDto[]; onBack: () => void; confirmed: () => Promise<void> }) {
  const item = reviews[0]
  return <div className="px-4 pb-8"><PageHeader title={reviews.length ? `Confirmar ${reviews.length} ${reviews.length === 1 ? 'produto' : 'produtos'}` : 'Revisar produtos'} subtitle="Só perguntamos quando há dúvida" onBack={onBack} />
    {!item ? <EmptyState icon={<CheckCircle2 />} title="Tudo revisado" description="Não há produtos novos ou duvidosos esperando sua confirmação." /> : <ReviewEditor key={item.id} item={item} reviewsCount={reviews.length} categories={categories} confirmed={confirmed} />}
  </div>
}

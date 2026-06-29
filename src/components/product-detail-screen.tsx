'use client'

import { useState } from 'react'
import { CalendarDays, Check, Clock3, Package, Pencil, X } from 'lucide-react'
import { brl, clientApi, dateLabel } from '@/lib/client-api'
import type { BehaviorType, CategoryDto, MeasureUnit, ProductDetailDto } from '@/lib/client-types'
import { BEHAVIORS, BehaviorBadge, EmptyState, PageHeader, PrimaryButton } from './ui'

type ProductDraft = {
  standardName: string
  brand: string
  categoryId: string
  behaviorType: BehaviorType
  estimatedDurationMonths: number
  defaultUnit: MeasureUnit
  packageSize: string
  applyToHistory: boolean
}

function draftFrom(product: ProductDetailDto): ProductDraft {
  return {
    standardName: product.standardName,
    brand: product.brand ?? '',
    categoryId: product.categoryId,
    behaviorType: product.behaviorType,
    estimatedDurationMonths: product.estimatedDurationMonths,
    defaultUnit: product.defaultUnit as MeasureUnit,
    packageSize: product.packageSize ?? '',
    applyToHistory: true,
  }
}

const behaviorHelp: Record<BehaviorType, string> = {
  recorrente_semanal: 'Compra que costuma se repetir toda semana.',
  recorrente_mensal: 'Compra que costuma se repetir todo mês.',
  estoque: 'Compra que dura mais de um mês e deve ser diluída no consumo mensal.',
  pontual: 'Compra isolada, sem recorrência esperada.',
  sazonal: 'Compra ligada a uma época específica do ano.',
  emergencia: 'Compra inesperada e necessária.',
  fora_do_padrao: 'Compra que não representa seu comportamento normal.',
}

export function ProductDetailScreen({ product, categories, onBack, updated }: {
  product: ProductDetailDto | null
  categories: CategoryDto[]
  onBack: () => void
  updated: (product: ProductDetailDto) => void | Promise<void>
}) {
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  if (!product) return <div className="px-4"><PageHeader title="Produto" onBack={onBack} /><EmptyState title="Produto não encontrado" description="Este produto não está disponível na sua conta." /></div>

  const productId = product.id
  const points = [...product.history].reverse().slice(-6)
  const min = Math.min(...points.map((item) => item.unitPrice), 0)
  const max = Math.max(...points.map((item) => item.unitPrice), 1)
  const coordinates = points.map((item, index) => String(20 + index * (250 / Math.max(1, points.length - 1))) + ',' + String(82 - ((item.unitPrice - min) / Math.max(1, max - min)) * 54)).join(' ')
  const selectedCategory = draft ? categories.find((category) => category.id === draft.categoryId) : null
  const allowedUnits = selectedCategory?.allowedUnits?.length ? selectedCategory.allowedUnits : product.allowedUnits?.length ? product.allowedUnits : ['un'] as MeasureUnit[]

  async function save() {
    if (!draft) return
    setSaving(true)
    setMessage('')
    try {
      const next = await clientApi<ProductDetailDto>('/api/products/' + productId, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      })
      await updated(next)
      setDraft(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="px-4 pb-8"><PageHeader title={product.standardName} subtitle={product.categoryName + ' · histórico pessoal'} onBack={onBack} action={<button aria-label="Editar produto" onClick={() => { setMessage(''); setDraft(draftFrom(product)) }} className="flex h-9 items-center gap-1 rounded-full bg-indigo-50 px-3 text-[9px] font-bold text-indigo-600"><Pencil size={13} /> Editar</button>} />
    <section className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: product.categoryColor + '15', color: product.categoryColor }}><Package size={20} /></span><div className="min-w-0 flex-1"><h1 className="text-sm font-black leading-4">{product.standardName}</h1><p className="mt-1 text-[8px] text-slate-400">{product.brand || 'Sem marca'} · {product.packageSize || 'Medida padrão'} · {product.defaultUnit}</p><div className="mt-2"><BehaviorBadge behavior={product.behaviorType} /></div></div><div className="text-right"><strong className="block text-xl font-black">{brl(product.lastPrice)}</strong><small className="text-[7px] text-slate-400">última compra</small></div></section>
    <div className="mt-3 flex gap-2 rounded-xl bg-emerald-50 p-3 text-[9px] leading-4 text-emerald-700"><Clock3 size={15} className="shrink-0" /><p>{product.behaviorType === 'estoque' ? <>Esse produto costuma durar cerca de <b>{product.estimatedDurationMonths} {product.estimatedDurationMonths === 1 ? 'mês' : 'meses'}</b>. O custo mensal estimado é <b>{brl(product.monthlyCost)}</b>.</> : <><b>{BEHAVIORS[product.behaviorType].label}.</b> {behaviorHelp[product.behaviorType]}</>}</p></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><article className="rounded-xl bg-emerald-50 p-3"><span className="text-[7px] text-slate-400">Menor preço pago</span><strong className="block text-sm text-emerald-600">{brl(product.minimumPrice)}</strong></article><article className="rounded-xl bg-rose-50 p-3"><span className="text-[7px] text-slate-400">Maior preço pago</span><strong className="block text-sm text-rose-500">{brl(product.maximumPrice)}</strong></article><article className="rounded-xl bg-indigo-50 p-3"><span className="text-[7px] text-slate-400">Custo mensal est.</span><strong className="block text-sm text-indigo-600">{brl(product.monthlyCost)}</strong></article><article className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-[7px] text-slate-400">Média histórica</span><strong className="block text-sm">{brl(product.averagePrice)}</strong></article></div>
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3"><div className="flex justify-between"><h2 className="text-[10px] font-bold">Preço nas suas compras</h2><span className="rounded bg-slate-100 px-2 py-1 text-[7px] text-slate-400">do seu histórico</span></div>{points.length > 1 ? <svg viewBox="0 0 290 105" className="mt-2 h-28 w-full" aria-label="Histórico de preços"><polyline fill="none" stroke="#635BFF" strokeWidth="2" points={coordinates} />{points.map((item, index) => <g key={item.id}><circle cx={20 + index * (250 / Math.max(1, points.length - 1))} cy={82 - ((item.unitPrice - min) / Math.max(1, max - min)) * 54} r="3" fill="#635BFF" /><text x={20 + index * (250 / Math.max(1, points.length - 1))} y="100" textAnchor="middle" fontSize="7" fill="#94A3B8">{dateLabel(item.purchaseDate).slice(0, 6)}</text></g>)}</svg> : <p className="py-10 text-center text-[9px] text-slate-400">O gráfico aparecerá após a segunda compra.</p>}<p className="text-center text-[7px] text-slate-400">Apenas preços das suas próprias compras</p></section>
    <section className="mt-4"><h2 className="mb-2 text-[10px] font-bold">Compras anteriores</h2><div className="grid gap-1">{product.history.map((item) => <article key={item.id} className="flex items-center gap-2 border-b border-slate-200 py-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-500"><CalendarDays size={13} /></span><div className="flex-1"><strong className="block text-[9px]">{item.storeName}</strong><small className="text-[7px] text-slate-400">{dateLabel(item.purchaseDate)} · {item.quantity} {item.unit}</small></div><b className="text-[9px]">{brl(item.unitPrice)}</b></article>)}</div></section>

    {draft && <div className="absolute inset-0 z-[90] flex items-end bg-slate-950/40 p-3 backdrop-blur-[1px]" role="dialog" aria-label="Editar produto">
      <section className="max-h-[91%] w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
        <header className="mb-4 flex items-start justify-between"><div><h2 className="text-sm font-black">Editar produto</h2><p className="mt-1 text-[8px] leading-3 text-slate-400">Ajuste manualmente a medida, periodicidade e o comportamento.</p></div><button aria-label="Fechar editor" onClick={() => setDraft(null)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100"><X size={15} /></button></header>

        <div className="grid gap-3"><label className="form-label">Nome do produto<input value={draft.standardName} onChange={(event) => setDraft({ ...draft, standardName: event.target.value })} className="form-input" /></label><div className="grid grid-cols-2 gap-2"><label className="form-label">Marca<input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} className="form-input" placeholder="Opcional" /></label><label className="form-label">Apresentação/tamanho<input value={draft.packageSize} onChange={(event) => setDraft({ ...draft, packageSize: event.target.value })} className="form-input" placeholder="Ex.: pacote 5 kg" /></label></div>
          <label className="form-label">Classificação<select value={draft.categoryId} onChange={(event) => { const category = categories.find((item) => item.id === event.target.value); const units = category?.allowedUnits?.length ? category.allowedUnits : ['un'] as MeasureUnit[]; setDraft({ ...draft, categoryId: event.target.value, defaultUnit: units.includes(draft.defaultUnit) ? draft.defaultUnit : units[0] }) }} className="form-input">{categories.map((category) => <option key={category.id} value={category.id}>{category.path.join(' › ')}</option>)}</select></label>
        </div>

        <fieldset className="mt-4"><legend className="text-[10px] font-bold">Unidade de medida padrão</legend><div className="mt-2 flex flex-wrap gap-1.5">{allowedUnits.map((unit) => <button key={unit} type="button" aria-pressed={draft.defaultUnit === unit} onClick={() => setDraft({ ...draft, defaultUnit: unit })} className={'min-w-11 rounded-full border px-3 py-2 text-[9px] font-bold ' + (draft.defaultUnit === unit ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500')}>{unit}</button>)}</div><p className="mt-1.5 text-[7px] text-slate-400">As opções vêm do plano de contas da classificação escolhida.</p></fieldset>

        <fieldset className="mt-4"><legend className="text-[10px] font-bold">Como este produto se comporta / periodicidade</legend><div className="mt-2 flex flex-wrap gap-1.5">{(Object.keys(BEHAVIORS) as BehaviorType[]).map((type) => { const config = BEHAVIORS[type]; const active = draft.behaviorType === type; return <button key={type} type="button" aria-pressed={active} onClick={() => setDraft({ ...draft, behaviorType: type })} className="rounded-full border px-2.5 py-2 text-[8px]" style={active ? { borderColor: config.color, color: config.color, background: config.bg } : { borderColor: '#E5E7EB', color: '#64748B' }}>{config.icon} {config.label}</button> })}</div><p className="mt-2 rounded-lg bg-slate-50 p-2 text-[8px] leading-3 text-slate-500">{behaviorHelp[draft.behaviorType]}</p></fieldset>

        {draft.behaviorType === 'estoque' && <fieldset className="mt-4"><legend className="text-[10px] font-bold">Quanto tempo dura?</legend><div className="mt-2 grid grid-cols-4 gap-2">{[1, 2, 3, 6].map((value) => <button key={value} type="button" onClick={() => setDraft({ ...draft, estimatedDurationMonths: value })} className={'rounded-xl p-2 text-[9px] ' + (draft.estimatedDurationMonths === value ? 'bg-emerald-100 font-bold text-emerald-700 ring-1 ring-emerald-400' : 'bg-slate-100 text-slate-500')}>{value}<small className="block text-[6px]">{value === 1 ? 'mês' : 'meses'}</small></button>)}</div><label className="form-label mt-2">Outra duração (meses)<input type="number" min="1" max="24" step="0.5" value={draft.estimatedDurationMonths} onChange={(event) => setDraft({ ...draft, estimatedDurationMonths: Number(event.target.value) })} className="form-input" /></label><p className="mt-2 text-center text-[8px] text-emerald-600">Custo mensal estimado: {brl(product.lastPrice / Math.max(1, draft.estimatedDurationMonths))}</p></fieldset>}

        <label className="mt-4 flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-[8px] leading-3 text-indigo-700"><input className="mt-0.5" type="checkbox" checked={draft.applyToHistory} onChange={(event) => setDraft({ ...draft, applyToHistory: event.target.checked })} /><span><b>Atualizar também as compras anteriores</b><br />Reclassifica o histórico deste produto e recalcula os relatórios mensais.</span></label>
        {message && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-[9px] text-rose-600">{message}</p>}
        <PrimaryButton className="mt-4" onClick={() => void save()} disabled={saving || draft.standardName.trim().length < 2 || draft.estimatedDurationMonths < 1}>{saving ? 'Salvando…' : <><Check size={16} /> Salvar produto</>}</PrimaryButton>
      </section>
    </div>}
  </div>
}

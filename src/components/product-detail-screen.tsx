'use client'

import { useState } from 'react'
import {
  Activity,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  HelpCircle,
  Package,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { brl, clientApi, dateLabel } from '@/lib/client-api'
import type {
  BehaviorType,
  CategoryDto,
  ConfidenceLevel,
  MeasureUnit,
  ProductDetailDto,
  ProductInferenceDto,
} from '@/lib/client-types'
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

const confidenceTone: Record<ConfidenceLevel, string> = {
  muito_baixa: 'bg-amber-100 text-amber-900',
  baixa: 'bg-amber-100 text-amber-900',
  media: 'bg-cyan-100 text-cyan-900',
  alta: 'bg-emerald-100 text-emerald-900',
  instavel: 'bg-rose-100 text-rose-900',
}

const behaviorHelp: Record<BehaviorType, string> = {
  recorrente_semanal: 'Compra que costuma se repetir semanalmente.',
  recorrente_mensal: 'Compra que costuma se repetir mensalmente.',
  estoque: 'Compra feita para formar estoque por mais tempo.',
  pontual: 'Compra isolada, sem recorrência esperada.',
  sazonal: 'Compra ligada a uma época específica do ano.',
  emergencia: 'Compra inesperada e necessária.',
  fora_do_padrao: 'Compra que não representa o comportamento habitual.',
}

function formatQuantity(value: number | null, unit: string, digits = 2) {
  if (value === null) return 'Ainda indisponível'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })} ${unit}`
}

function EstimateCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <strong className="mt-2 block text-xl tracking-tight text-slate-950">{value}</strong>
      <small className="mt-2 block text-sm leading-5 text-slate-600">{detail}</small>
    </article>
  )
}

function EventIcon({ type }: { type: string }) {
  if (type.includes('aumentando')) return <TrendingUp size={20} />
  if (type.includes('diminuindo')) return <TrendingDown size={20} />
  if (type.includes('falta') || type.includes('tardia')) return <CircleAlert size={20} />
  return <ReceiptText size={20} />
}

export function ProductDetailScreen({
  product,
  inference,
  categories,
  onBack,
  updated,
  removed,
}: {
  product: ProductDetailDto | null
  inference: ProductInferenceDto
  categories: CategoryDto[]
  onBack: () => void
  updated: (product: ProductDetailDto) => void | Promise<void>
  removed: () => void | Promise<void>
}) {
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  if (!product) return <div className="px-4"><PageHeader title="Produto" onBack={onBack} /><EmptyState title="Produto não encontrado" description="Este produto não está disponível na sua conta." /></div>

  const productId = product.id
  const selectedCategory = draft ? categories.find((category) => category.id === draft.categoryId) : null
  const allowedUnits = selectedCategory?.allowedUnits?.length
    ? selectedCategory.allowedUnits
    : product.allowedUnits?.length
      ? product.allowedUnits
      : ['un'] as MeasureUnit[]
  const hasEnoughHistory = inference.usablePurchaseCount >= 2
  const trend = inference.trend === 'aumentando'
    ? 'Consumo estimado aumentando'
    : inference.trend === 'diminuindo'
      ? 'Consumo estimado diminuindo'
      : 'Consumo estimado estável'

  async function save() {
    if (!draft) return
    setSaving(true)
    setMessage('')
    try {
      const next = await clientApi<ProductDetailDto>(`/api/products/${productId}`, {
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

  async function deactivate() {
    if (!window.confirm('Desativar este produto? O histórico de compras será preservado.')) return
    setDeleting(true)
    setMessage('')
    try {
      await clientApi(`/api/products/${productId}`, { method: 'DELETE' })
      await removed()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível desativar o produto.')
      setDeleting(false)
    }
  }

  return (
    <div className="px-4 pb-8 md:px-6">
      <PageHeader
        title={product.standardName}
        subtitle={`${product.categoryName} · Plano de Contas`}
        onBack={onBack}
        action={<button aria-label="Editar produto" onClick={() => { setMessage(''); setDraft(draftFrom(product)) }} className="flex min-h-11 items-center gap-2 rounded-full bg-indigo-50 px-4 text-sm font-bold text-indigo-700"><Pencil size={17} /> Editar</button>}
      />

      <section className="mt-5 flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: `${product.categoryColor}15`, color: product.categoryColor }}><Package size={25} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black leading-tight text-slate-950">{product.standardName}</h1>
          <p className="mt-1 text-base leading-6 text-slate-600">{product.brand || 'Sem marca informada'} · {product.packageSize || product.defaultUnit}</p>
          <div className="mt-3"><BehaviorBadge behavior={product.behaviorType} /></div>
        </div>
      </section>

      <section className="accent-gradient mt-5 overflow-hidden rounded-3xl p-5 text-white shadow-[0_12px_30px_rgba(67,56,202,.22)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-sm text-white/75">Estoque estimado atual</span>
            <strong className="mt-2 block text-3xl font-black tracking-tight">{inference.estimatedStockLabel}</strong>
          </div>
          <span className={`rounded-full px-3 py-2 text-sm font-bold ${confidenceTone[inference.confidence]}`}>{inference.confidenceLabel}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-5">
          <div><span className="text-sm text-white/70">Dias restantes estimados</span><strong className="mt-1 block text-xl">{inference.daysRemaining === null ? 'Sem base suficiente' : `≈ ${inference.daysRemaining} dias`}</strong></div>
          <div><span className="text-sm text-white/70">Possível término</span><strong className="mt-1 block text-xl">{inference.projectedDepletionDate ? dateLabel(inference.projectedDepletionDate) : 'Ainda incerto'}</strong></div>
        </div>
      </section>

      {!hasEnoughHistory && (
        <section className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <CircleAlert className="mt-0.5 shrink-0" size={22} />
          <div><strong className="text-base">Histórico ainda pequeno</strong><p className="mt-1 text-sm leading-6">Com mais compras registradas, a previsão de consumo e estoque ficará mais confiável.</p></div>
        </section>
      )}

      {inference.usablePurchaseCount < inference.purchaseCount && (
        <section className="mt-4 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
          <CircleAlert className="mt-0.5 shrink-0" size={22} />
          <div><strong className="text-base">Algumas unidades não são comparáveis</strong><p className="mt-1 text-sm leading-6">{inference.usablePurchaseCount} de {inference.purchaseCount} compras puderam ser usadas nos cálculos físicos. O histórico original foi preservado.</p></div>
        </section>
      )}

      <section className="mt-7">
        <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-950">Consumo e reposição</h2>
        <div className="grid grid-cols-2 gap-3">
          <EstimateCard label="Consumo diário estimado" value={formatQuantity(inference.dailyConsumption, inference.unit, 3)} detail="Taxa robusta entre ciclos." />
          <EstimateCard label="Consumo mensal estimado" value={formatQuantity(inference.monthlyConsumption, inference.unit)} detail={inference.estimatedMonthlyCost === null ? 'Custo ainda indisponível.' : `Custo aproximado de ${brl(inference.estimatedMonthlyCost)}.`} />
          <EstimateCard label="Última compra registrada" value={inference.lastPurchaseDate ? dateLabel(inference.lastPurchaseDate) : 'Nenhuma compra'} detail="Reposição registrada, não consumo." />
          <EstimateCard label="Frequência média" value={inference.averagePurchaseIntervalDays === null ? 'Ainda indisponível' : `≈ ${inference.averagePurchaseIntervalDays} dias`} detail={`${inference.refillCount} ciclos observados.`} />
          <EstimateCard label="Comprado no último ano" value={formatQuantity(inference.quantityPurchasedLastYear, inference.unit)} detail="Soma de compras com unidade compatível." />
          <EstimateCard label="Tendência" value={trend} detail="Derivada das taxas entre ciclos, não de uma compra isolada." />
        </div>
      </section>

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Activity size={21} /></span><div><h2 className="text-xl font-bold text-slate-950">Histórico de preços</h2><p className="text-sm text-slate-600">Somente suas compras registradas.</p></div></div>
        <div className="mt-4 grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 [&>*:last-child]:col-span-2 min-[520px]:[&>*:last-child]:col-span-1">
          <EstimateCard label="Preço médio" value={inference.averagePrice === null ? '—' : brl(inference.averagePrice)} detail={`por ${inference.unit}`} />
          <EstimateCard label="Menor preço" value={inference.minPrice === null ? '—' : brl(inference.minPrice)} detail="menor registro" />
          <EstimateCard label="Maior preço" value={inference.maxPrice === null ? '—' : brl(inference.maxPrice)} detail="maior registro" />
        </div>
      </section>

      <details className="mt-7 rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 text-lg font-bold text-indigo-950"><HelpCircle size={22} /> Como calculamos isso?<ChevronDown className="ml-auto" size={20} /></summary>
        <ul className="mt-4 grid gap-3 text-base leading-6 text-slate-700">
          <li>O estoque soma todas as compras compatíveis e reduz conforme o consumo médio estimado.</li>
          <li>O consumo usa taxas entre ciclos, mediana e controle de variações extremas.</li>
          <li>Uma nova compra aumenta o estoque; não significa que o produto acabou.</li>
          <li>Compras antecipadas e grandes volumes não redefinem sozinhos o consumo.</li>
          <li>A previsão muda quando novas compras entram no histórico.</li>
        </ul>
      </details>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold tracking-tight text-slate-950">Eventos de inferência</h2><p className="mt-1 text-sm text-slate-600">Sinais explicáveis; nenhum deles é uma certeza isolada.</p></div><ShieldCheck className="text-indigo-600" size={24} /></div>
        {inference.recentEvents.length ? <div className="grid gap-3">{inference.recentEvents.map((event, index) => (
          <article key={`${event.type}-${event.date}-${index}`} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><EventIcon type={event.type} /></span>
            <div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-base text-slate-950">{event.title}</strong><time className="text-sm text-slate-600">{dateLabel(event.date)}</time></div><p className="mt-2 text-sm leading-6 text-slate-700">{event.description}</p><p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700"><b>Impacto:</b> {event.impact}</p><span className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-sm font-bold ${confidenceTone[event.confidence]}`}>Confiança {event.confidence.replace('_', ' ')}</span></div>
          </article>
        ))}</div> : <EmptyState icon={<Activity size={25} />} title="Nenhum evento detectado" description="O histórico atual não apresenta sinais estatísticos relevantes." />}
      </section>

      <section className="mt-7">
        <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-950">Compras registradas</h2>
        {product.history.length ? <div className="grid gap-3">{product.history.map((item) => (
          <article key={item.id} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><CalendarDays size={20} /></span>
            <div className="min-w-0 flex-1"><strong className="block truncate text-base text-slate-900">{item.storeName}</strong><small className="mt-1 block text-sm text-slate-600">{dateLabel(item.purchaseDate)} · {item.quantity} {item.unit}</small></div>
            <strong className="whitespace-nowrap text-base text-slate-900">{brl(item.unitPrice)}</strong>
          </article>
        ))}</div> : <EmptyState title="Produto recém-criado" description="Quando uma compra for registrada, ela aparecerá aqui sem substituir o histórico anterior." />}
      </section>

      {message && !draft && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-base text-rose-700">{message}</p>}
      <button onClick={() => void deactivate()} disabled={deleting} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 text-base font-bold text-rose-700 disabled:opacity-50"><Trash2 size={18} /> {deleting ? 'Desativando…' : 'Desativar produto'}</button>
      <p className="mt-2 text-center text-sm leading-5 text-slate-600">A conta será inativada; compras e relatórios anteriores serão preservados.</p>

      {draft && (
        <div className="absolute inset-0 z-[90] flex items-end bg-slate-950/45 p-3 backdrop-blur-[1px]" role="dialog" aria-label="Editar produto">
          <section className="max-h-[92%] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <header className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Editar produto</h2><p className="mt-1 text-sm leading-5 text-slate-600">Ajuste classificação, medida e comportamento.</p></div><button aria-label="Fechar editor" onClick={() => setDraft(null)} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100"><X size={19} /></button></header>

            <div className="grid gap-4">
              <label className="form-label">Nome do produto<input value={draft.standardName} onChange={(event) => setDraft({ ...draft, standardName: event.target.value })} className="form-input" /></label>
              <label className="form-label">Marca<input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} className="form-input" placeholder="Opcional" /></label>
              <label className="form-label">Apresentação/tamanho<input value={draft.packageSize} onChange={(event) => setDraft({ ...draft, packageSize: event.target.value })} className="form-input" placeholder="Ex.: pacote 5 kg" /></label>
              <label className="form-label">Classificação<select value={draft.categoryId} onChange={(event) => { const category = categories.find((item) => item.id === event.target.value); const units = category?.allowedUnits?.length ? category.allowedUnits : ['un'] as MeasureUnit[]; setDraft({ ...draft, categoryId: event.target.value, defaultUnit: units.includes(draft.defaultUnit) ? draft.defaultUnit : units[0] }) }} className="form-input">{categories.map((category) => <option key={category.id} value={category.id}>{category.path.join(' › ')}</option>)}</select></label>
            </div>

            <fieldset className="mt-5"><legend className="text-base font-bold">Unidade padrão</legend><div className="mt-3 flex flex-wrap gap-2">{allowedUnits.map((unit) => <button key={unit} type="button" aria-pressed={draft.defaultUnit === unit} onClick={() => setDraft({ ...draft, defaultUnit: unit })} className={`min-h-11 min-w-14 rounded-full border px-4 text-base font-bold ${draft.defaultUnit === unit ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>{unit}</button>)}</div></fieldset>

            <fieldset className="mt-5"><legend className="text-base font-bold">Comportamento</legend><div className="mt-3 grid grid-cols-2 gap-2">{(Object.keys(BEHAVIORS) as BehaviorType[]).map((type) => { const config = BEHAVIORS[type]; const active = draft.behaviorType === type; return <button key={type} type="button" aria-pressed={active} onClick={() => setDraft({ ...draft, behaviorType: type })} className="min-h-12 rounded-2xl border px-3 text-sm font-semibold" style={active ? { borderColor: config.color, color: config.color, background: config.bg } : { borderColor: '#E2E8F0', color: '#475569' }}>{config.label}</button> })}</div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{behaviorHelp[draft.behaviorType]}</p></fieldset>

            {draft.behaviorType === 'estoque' && <label className="form-label mt-5">Duração aproximada cadastrada (meses)<input type="number" min="1" max="24" step="0.5" value={draft.estimatedDurationMonths} onChange={(event) => setDraft({ ...draft, estimatedDurationMonths: Number(event.target.value) })} className="form-input" /></label>}

            <label className="mt-5 flex items-start gap-3 rounded-2xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-900"><input className="mt-1 h-5 w-5" type="checkbox" checked={draft.applyToHistory} onChange={(event) => setDraft({ ...draft, applyToHistory: event.target.checked })} /><span><b>Atualizar classificações anteriores</b><br />Valores, datas e quantidades originais das compras serão preservados.</span></label>
            {message && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-base text-rose-700">{message}</p>}
            <PrimaryButton className="mt-5" onClick={() => void save()} disabled={saving || draft.standardName.trim().length < 2 || draft.estimatedDurationMonths < 1}>{saving ? 'Salvando…' : <><Check size={18} /> Salvar produto</>}</PrimaryButton>
          </section>
        </div>
      )}
    </div>
  )
}

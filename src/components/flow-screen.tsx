'use client'

import { useState } from 'react'
import {
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Home,
  Info,
  Layers3,
  Package,
  PackageSearch,
  Tags,
} from 'lucide-react'
import { brl } from '@/lib/client-api'
import type { DashboardDto } from '@/lib/client-types'
import { EmptyState, MetricCard, PageHeader } from './ui'

type FlowView = 'summary' | 'categories' | 'prices' | 'stock'
type MonthPeriod = { year: number; month: number }

const views: { id: FlowView; label: string; icon: React.ReactNode }[] = [
  { id: 'summary', label: 'Resumo', icon: <BarChart3 size={17} /> },
  { id: 'categories', label: 'Categorias', icon: <Layers3 size={17} /> },
  { id: 'prices', label: 'Preços', icon: <Tags size={17} /> },
  { id: 'stock', label: 'Estoque', icon: <PackageSearch size={17} /> },
]

const signedBrl = (value: number) => `${value > 0 ? '+' : ''}${brl(value, 0)}`

function periodKey(period: MonthPeriod) {
  return `${period.year}-${String(period.month).padStart(2, '0')}`
}

function shiftPeriod(period: MonthPeriod, delta: number): MonthPeriod {
  const date = new Date(period.year, period.month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

function periodLabel(period: MonthPeriod) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(period.year, period.month - 1, 1))
    .replace(/^./, (letter) => letter.toUpperCase())
}

function availablePeriods(selected: MonthPeriod, comparison: MonthPeriod) {
  const now = new Date()
  const periods = Array.from({ length: 24 }, (_value, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    return { year: date.getFullYear(), month: date.getMonth() + 1 }
  })
  for (const period of [selected, comparison]) {
    if (!periods.some((item) => periodKey(item) === periodKey(period))) periods.push(period)
  }
  return periods.sort((left, right) => right.year - left.year || right.month - left.month)
}

function MonthComparisonControls({ data, selected, comparison, selectPeriod, selectComparison, swapPeriods }: {
  data: DashboardDto
  selected: MonthPeriod
  comparison: MonthPeriod
  selectPeriod: (period: MonthPeriod) => void
  selectComparison: (period: MonthPeriod) => void
  swapPeriods: () => void
}) {
  const options = availablePeriods(selected, comparison)
  const selectedKey = periodKey(selected)
  const comparisonKey = periodKey(comparison)
  const now = new Date()
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const next = shiftPeriod(selected, 1)
  const nextDisabled = next.year > current.year || (next.year === current.year && next.month > current.month)
  const parse = (value: string) => {
    const [year, month] = value.split('-').map(Number)
    return { year, month }
  }

  return <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><CalendarDays size={20} /></span><div><h2 className="font-bold text-slate-950">Períodos da análise</h2><p className="mt-0.5 text-sm text-slate-600">Escolha os dois meses que deseja comparar.</p></div></div>
      <button onClick={swapPeriods} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"><ArrowLeftRight size={17} /><span className="hidden sm:inline">Trocar</span></button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Mês analisado<select aria-label="Mês analisado" value={selectedKey} onChange={(event) => selectPeriod(parse(event.target.value))} className="min-h-12 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-base font-bold text-indigo-950 outline-none focus:border-indigo-500">{options.map((option) => <option key={periodKey(option)} value={periodKey(option)} disabled={periodKey(option) === comparisonKey}>{periodLabel(option)}</option>)}</select></label>
      <span className="pb-3 text-center text-sm font-bold text-slate-400">versus</span>
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Comparar com<select aria-label="Comparar com" value={comparisonKey} onChange={(event) => selectComparison(parse(event.target.value))} className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-900 outline-none focus:border-indigo-500">{options.map((option) => <option key={periodKey(option)} value={periodKey(option)} disabled={periodKey(option) === selectedKey}>{periodLabel(option)}</option>)}</select></label>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button onClick={() => selectPeriod(shiftPeriod(selected, -1))} className="min-h-9 rounded-full bg-slate-100 px-3 text-sm font-semibold text-slate-700">← Anterior</button>
      <button onClick={() => selectPeriod(current)} disabled={selectedKey === periodKey(current)} className="min-h-9 rounded-full bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 disabled:opacity-40">Mês atual</button>
      <button onClick={() => selectPeriod(next)} disabled={nextDisabled} className="min-h-9 rounded-full bg-slate-100 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40">Próximo →</button>
    </div>
    <p className="mt-3 text-sm leading-5 text-slate-500">{data.comparison.isPartial ? `Comparação proporcional: até o dia ${data.comparison.throughDay} nos dois meses.` : 'Comparação entre os meses completos selecionados.'}</p>
  </section>
}

function Change({ value, percentage }: { value: number; percentage?: number | null }) {
  const positive = value > 0
  const neutral = Math.abs(value) < 0.01
  return <span className={`inline-flex items-center gap-1 text-sm font-bold ${neutral ? 'text-slate-500' : positive ? 'text-rose-700' : 'text-emerald-700'}`}>
    {neutral ? null : positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
    {signedBrl(value)}{percentage === null || percentage === undefined ? '' : ` · ${percentage > 0 ? '+' : ''}${percentage}%`}
  </span>
}

function HistoryChart({ data, color }: { data: DashboardDto; color: string }) {
  const maximum = Math.max(
    1,
    ...data.history.map((item) => item.totalSpent),
    ...data.history.map((item) => item.estimatedConsumption),
  )
  const completeMonths = data.history.filter((item) => !item.partial && item.totalSpent > 0)
  const monthlyAverage = completeMonths.length
    ? completeMonths.reduce((sum, item) => sum + item.totalSpent, 0) / completeMonths.length
    : 0
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-950">Evolução em 12 meses</h2><p className="mt-1 text-sm leading-6 text-slate-600">Desembolso real e parcela mensal das compras registradas.</p>{monthlyAverage > 0 && <p className="mt-2 text-sm font-semibold text-slate-800">Média dos meses completos: {brl(monthlyAverage, 0)}</p>}</div>
      <div className="flex flex-wrap gap-3 text-sm text-slate-600"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded" style={{ background: color }} />Desembolso</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-cyan-400" />Parcela mensal</span></div>
    </div>
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="grid h-52 min-w-[760px] items-end gap-2" style={{ gridTemplateColumns: `repeat(${data.history.length}, minmax(44px, 1fr))` }} aria-label="Evolução de desembolso e parcela mensal">
        {data.history.map((item) => <div key={`${item.year}-${item.month}`} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
          <div className="flex h-36 w-full items-end justify-center gap-1">
            <span className={`w-[38%] min-w-2 rounded-t-md ${item.partial ? 'opacity-60' : ''}`} style={{ height: `${Math.max(item.totalSpent ? 4 : 1, item.totalSpent / maximum * 100)}%`, background: color }} title={`Desembolso: ${brl(item.totalSpent)}`} />
            <span className={`w-[38%] min-w-2 rounded-t-md bg-cyan-400 ${item.partial ? 'opacity-60' : ''}`} style={{ height: `${Math.max(item.estimatedConsumption ? 4 : 1, item.estimatedConsumption / maximum * 100)}%` }} title={`Parcela mensal: ${brl(item.estimatedConsumption)}`} />
          </div>
          <small className="truncate text-sm font-medium capitalize text-slate-600">{item.label}{item.partial ? '*' : ''}</small>
        </div>)}
      </div>
    </div>
    {data.comparison.isPartial && <p className="mt-3 text-sm text-slate-500">* Mês em andamento, contabilizado até o dia {data.comparison.throughDay}.</p>}
  </section>
}

function ProductImpactList({ data, limit }: { data: DashboardDto; limit?: number }) {
  const products = limit ? data.productImpacts.slice(0, limit) : data.productImpacts
  if (!products.length) return <EmptyState title="Ainda não há comparação disponível" description="Registre compras em dois períodos para identificar quais produtos mudaram o seu desembolso." />
  return <div className="grid gap-3">{products.map((product) => <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Package size={20} /></span><span className="min-w-0 flex-1"><strong className="block text-base text-slate-950">{product.name}</strong><small className="mt-1 block text-sm text-slate-600">{product.status === 'new' ? 'Novo no período' : product.status === 'removed' ? 'Não se repetiu' : product.status === 'unit_incompatible' ? 'Unidade não comparável' : product.status === 'out_of_pattern' ? 'Fora do padrão' : 'Comprado nos dois períodos'}</small></span><Change value={product.variation} percentage={product.variationPercentage} /></div>
    {product.unitComparable && product.currentUnitPrice !== null && product.referenceUnitPrice !== null && <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-800">Preço atual <b className="mt-1 block text-indigo-950">{brl(product.currentUnitPrice)}/{product.unit}</b></span><span className="rounded-xl bg-slate-50 p-3 text-slate-600">Referência <b className="mt-1 block text-slate-900">{brl(product.referenceUnitPrice)}/{product.unit}</b></span></div>}
    {(product.priceEffect !== 0 || product.quantityEffect !== 0) && <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span className="rounded-xl bg-slate-50 p-3 text-slate-600">Preço <b className="mt-1 block text-slate-900">{signedBrl(product.priceEffect)}</b></span><span className="rounded-xl bg-slate-50 p-3 text-slate-600">Quantidade <b className="mt-1 block text-slate-900">{signedBrl(product.quantityEffect)}</b></span></div>}
  </article>)}</div>
}

function SummaryView({ data, color }: { data: DashboardDto; color: string }) {
  const completeMonths = data.history.filter((item) => !item.partial && item.totalSpent > 0)
  const monthlyAverage = completeMonths.length
    ? completeMonths.reduce((sum, item) => sum + item.totalSpent, 0) / completeMonths.length
    : 0
  return <div className="grid gap-5">
    <section className="overflow-hidden rounded-3xl p-6 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, #312e81)` }}>
      <p className="text-sm font-medium text-white/75">{data.comparison.isPartial ? `Desembolso até o dia ${data.comparison.throughDay}` : 'Desembolso no período'}</p>
      <strong className="mt-2 block text-4xl font-black tracking-tight">{brl(data.totalSpent, 0)}</strong>
      <div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-2 text-sm font-bold text-white"><span>{signedBrl(data.difference)}{data.comparison.differencePercentage === null ? '' : ` · ${data.comparison.differencePercentage > 0 ? '+' : ''}${data.comparison.differencePercentage}%`}</span></div>
      <p className="mt-4 max-w-xl text-sm leading-6 text-white/85">{data.comparison.label}. {data.variation.principalMessage}</p>
    </section>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Mês comparado" value={brl(data.previousTotalSpent, 0)} detail={data.comparison.isPartial ? `${data.previousMonthLabel} até o dia ${data.comparison.referenceThroughDay}` : data.previousMonthLabel} />
      <MetricCard label="Média mensal" value={brl(monthlyAverage, 0)} detail={`${completeMonths.length} meses completos`} tone="violet" />
      <MetricCard label="Parcela mensal" value={brl(data.estimatedConsumption, 0)} detail="amortização das compras" tone="cyan" />
      <MetricCard label="Compras registradas" value={String(data.purchaseCount)} detail="notas ou registros" tone="violet" />
    </div>

    <HistoryChart data={data} color={color} />

    <section><div className="mb-3"><h2 className="text-xl font-bold text-slate-950">Por que meu gasto mudou?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Cada valor entra uma única vez e a soma fecha com a variação de {signedBrl(data.difference)}.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{data.variation.components.filter((component) => Math.abs(component.amount) > 0.009).map((component) => <article key={component.type} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><strong className="text-base text-slate-900">{component.label}</strong><Change value={component.amount} /></div><p className="mt-2 text-sm leading-6 text-slate-600">{component.description}</p></article>)}</div>
      {!data.variation.components.some((component) => Math.abs(component.amount) > 0.009) && <EmptyState title="Fluxo estável" description="Não houve mudança relevante no período comparável." />}
    </section>

    <section><div className="mb-3"><h2 className="text-xl font-bold text-slate-950">Produtos que mais impactaram</h2><p className="mt-1 text-sm text-slate-600">Ordenados pela maior mudança em reais.</p></div><ProductImpactList data={data} limit={5} /></section>

    {data.attention.length > 0 && <section><div className="mb-3"><h2 className="text-xl font-bold text-slate-950">Merece atenção</h2><p className="mt-1 text-sm text-slate-600">Sinais priorizados por impacto, nunca tratados como certeza.</p></div><div className="grid gap-3">{data.attention.slice(0, 5).map((item) => <article key={item.id} className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><CircleAlert className="mt-0.5 shrink-0 text-amber-700" size={21} /><div><strong className="text-base text-amber-950">{item.title}</strong><p className="mt-1 text-sm leading-6 text-amber-900/80">{item.description}</p>{item.confidence && <small className="mt-2 block text-sm font-semibold text-amber-800">Confiança: {String(item.confidence).replaceAll('_', ' ')}</small>}</div></article>)}</div></section>}
  </div>
}

function CategoriesView({ data, selectCategory, color }: { data: DashboardDto; selectCategory: (id: string | null) => void; color: string }) {
  const title = data.classification.selected?.name ?? 'Tudo'
  const composition = data.classification.children
  const products = data.classification.products
  const directShare = data.totalSpent ? data.classification.directTotalSpent / data.totalSpent * 100 : 0
  return <div>
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold text-slate-950">Composição de {title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">Navegue pela árvore e veja participação e contribuição para a mudança.</p>{data.totalSpent > 0 && <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">{composition.map((category) => <span key={category.id} style={{ width: `${category.shareOfTotal}%`, background: category.color }} />)}{directShare > 0 && <span style={{ width: `${directShare}%`, background: color }} />}</div>}</div>

    {data.totalSpent === 0 && data.previousTotalSpent === 0 && <EmptyState title="Ainda não há composição para comparar" description="Registre uma compra neste nível. Depois, as categorias mostrarão participação, variação e contribuição para a mudança." />}

    {(data.totalSpent !== 0 || data.previousTotalSpent !== 0) && (composition.length ? <div className="grid gap-3">{composition.map((category) => <button key={category.id} onClick={() => selectCategory(category.id)} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl" style={{ background: `${category.color}15` }}>{category.icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-base text-slate-950">{category.name}</strong><small className="mt-1 block text-sm text-slate-600">{category.shareOfTotal}% do período · {category.productCount} {category.productCount === 1 ? 'produto' : 'produtos'}</small><span className="mt-1 block"><Change value={category.variation} percentage={category.variationPercentage} /></span></span><span className="text-right"><b className="block text-base text-slate-900">{brl(category.totalSpent)}</b><ChevronRight className="ml-auto mt-2 text-slate-400" size={19} /></span></button>)}</div> : !products.length ? <EmptyState title="Nenhum item nesta classificação" description="Quando uma compra for classificada aqui, sua participação e variação aparecerão nesta visão." /> : null)}

    {products.length > 0 && <section className="mt-6"><h2 className="mb-3 text-lg font-bold text-slate-950">Produtos diretamente em {title}</h2><div className="grid gap-3">{products.map((product) => <article key={product.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${color}15`, color }}><Package size={19} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-base text-slate-950">{product.name}</strong><small className="mt-1 block text-sm text-slate-600">{brl(product.averageUnitPrice)}/{product.unit} · {product.purchaseCount} {product.purchaseCount === 1 ? 'compra' : 'compras'}</small></span><span className="text-right"><b className="block text-base">{brl(product.amount)}</b><Change value={product.variation} percentage={product.variationPercentage} /></span></article>)}</div></section>}
  </div>
}

function PricesView({ data }: { data: DashboardDto }) {
  const [filter, setFilter] = useState<'all' | 'price' | 'quantity' | 'changes'>('all')
  const priceEffect = data.variation.components.find((item) => item.type === 'price')?.amount ?? 0
  const quantityEffect = data.variation.components.find((item) => item.type === 'quantity')?.amount ?? 0
  const filtered = data.productImpacts.filter((product) => {
    if (filter === 'price') return Math.abs(product.priceEffect) >= Math.abs(product.quantityEffect) && Math.abs(product.priceEffect) > 0.009
    if (filter === 'quantity') return Math.abs(product.quantityEffect) > Math.abs(product.priceEffect) && Math.abs(product.quantityEffect) > 0.009
    if (filter === 'changes') return product.status !== 'changed'
    return true
  })
  const filteredData = { ...data, productImpacts: filtered }
  const filters = [
    { id: 'all' as const, label: 'Todos' },
    { id: 'price' as const, label: 'Preço' },
    { id: 'quantity' as const, label: 'Quantidade' },
    { id: 'changes' as const, label: 'Novos e ausentes' },
  ]
  return <div>
    <div className="mb-4"><h2 className="text-xl font-bold text-slate-950">Impacto de preços e quantidades</h2><p className="mt-1 text-sm leading-6 text-slate-600">Preços são normalizados somente quando massa, volume ou contagem são compatíveis.</p></div>
    <div className="mb-4 grid grid-cols-2 gap-3"><MetricCard label="Efeito de preço" value={signedBrl(priceEffect)} detail="mantendo a quantidade" /><MetricCard label="Efeito de quantidade" value={signedBrl(quantityEffect)} detail="ao preço de referência" tone="cyan" /></div>
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">{filters.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${filter === item.id ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{item.label}</button>)}</div>
    <ProductImpactList data={filteredData} />
  </div>
}

function StockView({ data }: { data: DashboardDto }) {
  const stockSignals = data.attention.filter((item) => item.type !== 'price_increase')
  return <div><div className="mb-4 rounded-2xl bg-cyan-50 p-4 text-cyan-950"><div className="flex gap-3"><Info className="mt-0.5 shrink-0" size={21} /><div><h2 className="text-lg font-bold">Sinais de estoque</h2><p className="mt-1 text-sm leading-6 text-cyan-900/80">São inferências baseadas no histórico. Quanto mais regular o consumo, maior a confiança.</p></div></div></div>{stockSignals.length ? <div className="grid gap-3">{stockSignals.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex gap-3"><PackageSearch className="mt-0.5 shrink-0 text-cyan-700" size={22} /><div><strong className="text-base text-slate-950">{item.title}</strong><p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>{item.confidence && <small className="mt-2 block text-sm font-semibold text-cyan-800">Confiança: {String(item.confidence).replaceAll('_', ' ')}</small>}</div></div></article>)}</div> : <EmptyState title="Nenhum sinal relevante no período" description="Isso não confirma que todo estoque está cheio; significa apenas que o histórico atual não gerou um alerta confiável nesta seleção." />}</div>
}

export function FlowScreen({ data, analysisPeriod, comparisonPeriod, selectPeriod, selectComparison, swapPeriods, selectCategory, loading }: {
  data: DashboardDto
  analysisPeriod: MonthPeriod
  comparisonPeriod: MonthPeriod
  selectPeriod: (period: MonthPeriod) => void
  selectComparison: (period: MonthPeriod) => void
  swapPeriods: () => void
  selectCategory: (id: string | null) => void
  loading: boolean
}) {
  const [view, setView] = useState<FlowView>('summary')
  const selected = data.classification.selected
  const color = selected?.color ?? '#635BFF'

  return <div className="relative px-4 pb-8 md:px-6">
    <PageHeader title="Análise de fluxo" subtitle="Entenda o que mudou e onde agir" />
    <MonthComparisonControls data={data} selected={analysisPeriod} comparison={comparisonPeriod} selectPeriod={selectPeriod} selectComparison={selectComparison} swapPeriods={swapPeriods} />

    <nav aria-label="Classificação do relatório" className="-mx-4 mb-3 flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 scrollbar-none md:-mx-6 md:px-6"><button onClick={() => selectCategory(null)} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${!selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Home size={15} /> Tudo</button>{data.classification.breadcrumbs.map((item, index) => <button key={item.id} onClick={() => selectCategory(item.id)} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${index === data.classification.breadcrumbs.length - 1 ? 'text-white' : 'bg-slate-100 text-slate-600'}`} style={index === data.classification.breadcrumbs.length - 1 ? { background: item.color } : undefined}><span>{item.icon}</span>{item.name}</button>)}</nav>

    <div className="-mx-4 mb-5 grid grid-cols-4 gap-2 px-4 py-2 md:-mx-6 md:px-6" role="tablist">{views.map((item) => <button key={item.id} role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-xs font-bold min-[430px]:text-sm ${view === item.id ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}><span className="hidden min-[430px]:inline-flex">{item.icon}</span>{item.label}</button>)}</div>

    {view === 'summary' && <SummaryView data={data} color={color} />}
    {view === 'categories' && <CategoriesView data={data} selectCategory={selectCategory} color={color} />}
    {view === 'prices' && <PricesView data={data} />}
    {view === 'stock' && <StockView data={data} />}

    {loading && <div className="absolute inset-0 z-40 grid place-content-center bg-slate-50/70 backdrop-blur-[1px]"><span className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>}
  </div>
}

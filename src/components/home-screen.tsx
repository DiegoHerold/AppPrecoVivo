'use client'

import {
  Bell,
  CalendarClock,
  Camera,
  ChevronRight,
  CircleAlert,
  HelpCircle,
  PackageCheck,
  PackageMinus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TimerOff,
  TrendingUp,
} from 'lucide-react'
import { brl } from '@/lib/client-api'
import type {
  AppScreen,
  InferenceDashboardDto,
  InferenceProductSummaryDto,
  UserDto,
} from '@/lib/client-types'
import { EmptyState, MetricCard, PrimaryButton } from './ui'

function StatusCard({
  icon,
  count,
  label,
  detail,
  tone,
}: {
  icon: React.ReactNode
  count: number
  label: string
  detail: string
  tone: string
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <strong className="mt-4 block text-2xl tracking-tight text-slate-950">{count}</strong>
      <span className="mt-1 block text-base font-bold text-slate-800">{label}</span>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
  )
}

function ProductRow({
  product,
  label,
  openProduct,
}: {
  product: InferenceProductSummaryDto
  label: string
  openProduct: (id: string) => void
}) {
  return (
    <button
      onClick={() => openProduct(product.productId)}
      className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[.99]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
        <PackageMinus size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-base text-slate-900">{product.name}</strong>
        <small className="mt-1 block text-sm leading-5 text-slate-600">
          {product.category ?? 'Plano de contas'} · {label}
        </small>
      </span>
      <ChevronRight className="shrink-0 text-slate-400" size={20} />
    </button>
  )
}

function HistoryChart({ data }: { data: InferenceDashboardDto }) {
  const maximum = Math.max(
    1,
    ...data.spendByMonth.map((item) => item.total),
    ...data.consumptionByMonth.map((item) => item.total),
  )
  return (
    <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Evolução mensal</h2>
          <p className="mt-1 text-sm text-slate-600">Desembolso real versus custo do consumo estimado.</p>
        </div>
        <div className="flex gap-3 text-sm text-slate-600">
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-indigo-500" />Gasto</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-emerald-400" />Estimativa</span>
        </div>
      </div>
      <div className="mt-6 grid h-52 grid-cols-6 items-end gap-2" aria-label="Evolução de gasto e consumo estimado">
        {data.spendByMonth.map((item, index) => {
          const consumption = data.consumptionByMonth[index]?.total ?? 0
          return (
            <div key={item.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <div className="flex h-36 w-full items-end justify-center gap-1">
                <span className="w-[38%] min-w-2 rounded-t-lg bg-indigo-500" style={{ height: `${Math.max(3, item.total / maximum * 100)}%` }} title={`Gasto: ${brl(item.total)}`} />
                <span className="w-[38%] min-w-2 rounded-t-lg bg-emerald-400" style={{ height: `${Math.max(3, consumption / maximum * 100)}%` }} title={`Consumo estimado: ${brl(consumption)}`} />
              </div>
              <small className="truncate text-sm font-medium capitalize text-slate-600">{item.label}</small>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function HomeScreen({
  user,
  data,
  reviewCount,
  navigate,
  openProduct,
}: {
  user: UserDto
  data: InferenceDashboardDto
  reviewCount: number
  navigate: (screen: AppScreen) => void
  openProduct: (id: string) => void
}) {
  const hasCurrentMonth = data.currentMonth.purchaseCount > 0

  return (
    <div className="px-4 pb-8 pt-5 min-[390px]:px-5 md:px-8 md:pt-7">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-base text-slate-600">Olá, {user.name.split(' ')[0]}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Visão do seu consumo</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button aria-label="Revisões pendentes" onClick={() => navigate('reviews')} className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-slate-600 shadow-sm">
            <Bell size={21} />
            {reviewCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[11px] font-bold text-white">{reviewCount}</span>}
          </button>
          <button aria-label="Abrir perfil" onClick={() => navigate('profile')} className="grid h-11 w-11 place-items-center rounded-full bg-indigo-600 text-base font-black text-white">{user.name.charAt(0).toUpperCase()}</button>
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_100%_0,rgba(255,255,255,.22),transparent_28%),linear-gradient(145deg,#312E81,#5B50E6)] p-6 text-white shadow-[0_12px_32px_rgba(67,56,202,.24)]">
        <span className="text-sm text-white/75">Neste mês · compras registradas</span>
        <strong className="mt-3 block text-4xl font-black tracking-tight">{brl(data.currentMonth.totalSpent, 0)}</strong>
        <p className="mt-3 max-w-lg text-base leading-7 text-white/85">
          Valor efetivamente gasto. Estoque e consumo aparecem abaixo como estimativas separadas.
        </p>
        {!hasCurrentMonth && <button onClick={() => navigate('add')} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 text-base font-bold text-indigo-700"><Camera size={20} /> Registrar compra</button>}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 min-[460px]:grid-cols-3 [&>*:last-child]:col-span-2 min-[460px]:[&>*:last-child]:col-span-1">
        <MetricCard label="Total gasto" value={brl(data.currentMonth.totalSpent, 0)} detail="compras deste mês" />
        <MetricCard label="Produtos diferentes" value={String(data.currentMonth.productsPurchased)} detail="comprados no mês" tone="green" />
        <MetricCard label="Compras/importações" value={String(data.currentMonth.purchaseCount)} detail="notas ou registros" tone="violet" />
      </div>

      <section className="mt-7">
        <div className="mb-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Sinais do estoque</h2>
          <p className="mt-1 text-sm text-slate-600">Baseados no consumo estimado e no histórico registrado.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatusCard icon={<PackageMinus size={21} />} count={data.nearEnd.length} label="Próximos do fim" detail="Dias restantes estimados." tone="bg-amber-50 text-amber-700" />
          <StatusCard icon={<PackageCheck size={21} />} count={data.recentlyRefilled.length} label="Recém abastecidos" detail="Compra registrada nos últimos 7 dias." tone="bg-emerald-50 text-emerald-700" />
          <StatusCard icon={<TimerOff size={21} />} count={data.staleProducts.length} label="Sem compra recente" detail="Mais de 90 dias sem reposição." tone="bg-slate-100 text-slate-700" />
          <StatusCard icon={<CircleAlert size={21} />} count={data.possibleShortages.length} label="Possível falta" detail="Indício, não confirmação de término." tone="bg-rose-50 text-rose-700" />
          <StatusCard icon={<CalendarClock size={21} />} count={data.earlyPurchases.length} label="Comprados antes" detail="Possível compra antecipada." tone="bg-cyan-50 text-cyan-700" />
          <StatusCard icon={<RefreshCw size={21} />} count={data.productsWithStockEstimate} label="Com previsão" detail="Produtos com base para estimar estoque." tone="bg-indigo-50 text-indigo-700" />
        </div>
      </section>

      {(data.possibleShortages.length > 0 || data.nearEnd.length > 0) ? (
        <section className="mt-7">
          <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-950">Merecem atenção</h2>
          <div className="grid gap-3">
            {data.possibleShortages.slice(0, 3).map((product) => <ProductRow key={`shortage-${product.productId}`} product={product} label="possível período sem produto" openProduct={openProduct} />)}
            {data.nearEnd.slice(0, 3).map((product) => <ProductRow key={`near-${product.productId}`} product={product} label={product.daysRemaining === null ? 'previsão indisponível' : `aproximadamente ${product.daysRemaining} dias restantes`} openProduct={openProduct} />)}
          </div>
        </section>
      ) : (
        <EmptyState icon={<PackageCheck size={26} />} title="Nenhum produto próximo do fim" description="Com os dados atuais, não há sinal confiável de estoque baixo. As previsões mudam quando novas compras são registradas." />
      )}

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><TrendingUp size={21} /></span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Categorias com maior consumo estimado</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Comparação pelo custo mensal estimado, porque kg, litros e unidades não podem ser somados diretamente.</p>
          </div>
        </div>
        {data.topConsumingCategories.length ? <div className="mt-4 grid gap-3">{data.topConsumingCategories.slice(0, 5).map((category) => (
          <div key={category.category} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
            <span className="min-w-0"><strong className="block truncate text-base text-slate-900">{category.category}</strong><small className="mt-1 block text-sm text-slate-600">{category.productCount} {category.productCount === 1 ? 'produto com estimativa' : 'produtos com estimativa'}</small></span>
            <strong className="whitespace-nowrap text-base text-indigo-700">≈ {brl(category.estimatedMonthlyCost, 0)}/mês</strong>
          </div>
        ))}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-base leading-6 text-slate-600">Histórico ainda pequeno. Com pelo menos duas compras por produto, esta comparação começará a aparecer.</p>}
      </section>

      <HistoryChart data={data} />

      <details className="mt-7 rounded-3xl border border-indigo-100 bg-indigo-50 p-5 text-slate-800">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 text-lg font-bold text-indigo-950"><HelpCircle size={22} /> Como calculamos isso?</summary>
        <ul className="mt-4 grid gap-3 text-base leading-6 text-slate-700">
          <li>O estoque é estimado com base nas compras registradas.</li>
          <li>O consumo usa histórico, média robusta, mediana e variações entre ciclos.</li>
          <li>Uma nova compra não significa necessariamente que o produto acabou.</li>
          <li>A previsão pode mudar quando novas compras forem importadas.</li>
          <li>Quanto mais histórico regular, maior tende a ser a confiança.</li>
        </ul>
      </details>

      <PrimaryButton className="mt-7" onClick={() => navigate('add')}><ReceiptText size={21} /> Adicionar compra <Sparkles size={17} /></PrimaryButton>
    </div>
  )
}

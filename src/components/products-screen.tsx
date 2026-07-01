'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Package, Search } from 'lucide-react'
import { brl } from '@/lib/client-api'
import type { BehaviorType, ProductDto } from '@/lib/client-types'
import { BehaviorBadge, EmptyState, PageHeader } from './ui'

const filters: { value: 'all' | BehaviorType; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'recorrente_semanal', label: 'Semanal' }, { value: 'recorrente_mensal', label: 'Mensal' }, { value: 'estoque', label: 'Estoque' }, { value: 'pontual', label: 'Pontual' },
]

export function ProductsScreen({ products, openProduct, openCategories }: { products: ProductDto[]; openProduct: (id: string) => void; openCategories: () => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | BehaviorType>('all')
  const visible = useMemo(() => products.filter((product) => (filter === 'all' || product.behaviorType === filter) && `${product.standardName} ${product.categoryName}`.toLowerCase().includes(query.toLowerCase())), [products, query, filter])
  return <div className="px-4 pb-8 md:px-6"><PageHeader title="Produtos" subtitle="Cadastro e plano de contas" />
    <div className="mb-4 grid grid-cols-2 border-b border-slate-200"><button className="min-h-12 border-b-2 border-indigo-500 py-2 text-sm font-bold text-indigo-600">Meus produtos</button><button onClick={openCategories} className="min-h-12 py-2 text-sm text-slate-600">Plano de contas</button></div>
    <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-200/70 px-4 text-slate-500"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none" placeholder="Buscar produto…" /></label>
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none md:-mx-6 md:px-6">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${filter === item.value ? 'bg-indigo-600 text-white' : 'bg-slate-200/70 text-slate-600'}`}>{item.label}</button>)}</div>
    {!visible.length ? <EmptyState title="Nenhum produto cadastrado" description="Produtos aparecem aqui depois que você registra itens reais de uma compra." /> : <><p className="my-3 text-sm text-slate-600">{visible.length} {visible.length === 1 ? 'produto' : 'produtos'}</p><div className="grid gap-3">{visible.map((product) => <button key={product.id} onClick={() => openProduct(product.id)} className="grid min-h-24 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[.99]"><span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: `${product.categoryColor}12`, color: product.categoryColor }}><Package size={21} /></span><span className="min-w-0"><strong className="block text-base leading-5 text-slate-900">{product.standardName}</strong><small className="my-1.5 block text-sm leading-5 text-slate-600">{product.categoryName} · {product.packageSize || product.defaultUnit}</small><span className="flex flex-wrap items-center gap-2"><BehaviorBadge behavior={product.behaviorType} /><small className="text-[13px] font-semibold text-emerald-700">● Conta no plano</small></span></span><span className="flex min-w-20 flex-col items-end gap-1 text-right"><strong className="whitespace-nowrap text-base">{brl(product.lastPrice)}/{product.defaultUnit}</strong><small className="text-[13px] leading-4 text-emerald-700">{product.behaviorType === 'estoque' ? `${brl(product.monthlyCost)}/mês` : `${product.purchaseCount} ${product.purchaseCount === 1 ? 'compra' : 'compras'}`}</small><ChevronRight size={18} className="mt-1 text-slate-400" /></span></button>)}</div></>}
  </div>
}

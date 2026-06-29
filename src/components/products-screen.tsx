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
  return <div className="px-4 pb-8"><PageHeader title="Produtos" subtitle="Cadastro e plano de contas" />
    <div className="mb-3 grid grid-cols-2 border-b border-slate-200"><button className="border-b-2 border-indigo-500 py-2 text-[10px] font-bold text-indigo-600">Meus produtos</button><button onClick={openCategories} className="py-2 text-[10px] text-slate-400">Plano de contas</button></div>
    <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-200/70 px-3 text-slate-400"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-700 outline-none" placeholder="Buscar produto…" /></label>
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-none">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[8px] font-semibold ${filter === item.value ? 'bg-indigo-600 text-white' : 'bg-slate-200/70 text-slate-500'}`}>{item.label}</button>)}</div>
    {!visible.length ? <EmptyState title="Nenhum produto cadastrado" description="Produtos aparecem aqui depois que você registra itens reais de uma compra." /> : <><p className="my-2 text-[8px] text-slate-400">{visible.length} {visible.length === 1 ? 'produto' : 'produtos'}</p><div className="grid gap-2">{visible.map((product) => <button key={product.id} onClick={() => openProduct(product.id)} className="grid min-h-[72px] grid-cols-[40px_1fr_auto_12px] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${product.categoryColor}12`, color: product.categoryColor }}><Package size={18} /></span><span className="min-w-0"><strong className="block truncate text-[10px]">{product.standardName}</strong><small className="my-1 block truncate text-[7px] text-slate-400">{product.categoryName} · {product.packageSize || product.defaultUnit}</small><BehaviorBadge behavior={product.behaviorType} /></span><span className="text-right"><strong className="block whitespace-nowrap text-[10px]">{brl(product.lastPrice)}</strong><small className="text-[7px] text-emerald-600">{product.behaviorType === 'estoque' ? `${brl(product.lastPrice / Math.max(1, product.estimatedDurationMonths))}/mês` : `${product.purchaseCount} ${product.purchaseCount === 1 ? 'compra' : 'compras'}`}</small></span><ChevronRight size={14} className="text-slate-300" /></button>)}</div></>}
  </div>
}


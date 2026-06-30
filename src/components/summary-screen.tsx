'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Package, RefreshCw, ShoppingBasket, Trash2 } from 'lucide-react'
import { brl, clientApi, dateLabel } from '@/lib/client-api'
import type { AppScreen, PurchaseDto } from '@/lib/client-types'
import { BEHAVIORS, EmptyState, PageHeader, PrimaryButton } from './ui'

export function SummaryScreen({ purchase, onBack, navigate, deleted }: { purchase: PurchaseDto | null; onBack: () => void; navigate: (screen: AppScreen) => void; deleted: () => void | Promise<void> }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function removeImport() {
    if (!purchase) return
    setDeleting(true)
    setDeleteError('')
    try {
      await clientApi(`/api/purchases/${purchase.id}`, { method: 'DELETE' })
      await deleted()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir esta importação.')
    } finally {
      setDeleting(false)
    }
  }

  if (!purchase) return <div className="px-4"><PageHeader title="Resumo da compra" onBack={onBack} /><EmptyState title="Compra não encontrada" description="Não foi possível carregar esta compra." /></div>
  if (!purchase.items.length) return <div className="px-4 pb-8"><PageHeader title="Importação pendente" subtitle="Nenhum item foi criado automaticamente" onBack={onBack} /><section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><strong className="text-sm text-amber-900">Ação manual necessária</strong><p className="mt-2 text-[10px] leading-5 text-amber-800">{purchase.job?.message ?? 'Cadastre os itens manualmente para concluir a compra.'}</p></section><PrimaryButton className="mt-4" onClick={() => navigate('manual')}>Cadastrar compra manualmente</PrimaryButton></div>
  const groups = purchase.items.reduce<Record<string, { count: number; total: number }>>((result, item) => { const group = result[item.behaviorType] ?? { count: 0, total: 0 }; group.count += 1; group.total += item.totalPrice; result[item.behaviorType] = group; return result }, {})
  const consumptionPercent = purchase.totalAmount ? Math.round(purchase.estimatedConsumption / purchase.totalAmount * 100) : 0
  const pending = purchase.items.filter((item) => item.needsReview).length
  return <div className="px-4 pb-8"><PageHeader title="Compra analisada" subtitle="Tudo salvo no banco" onBack={onBack} />
    <section className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><ShoppingBasket size={19} /></span><div className="min-w-0 flex-1"><strong className="block truncate text-[10px]">{purchase.storeName}</strong><small className="text-[7px] text-slate-400">{purchase.storeType.replace('_', ' ')} · {dateLabel(purchase.purchaseDate)} · {purchase.items.length} itens</small></div><b className="text-sm">{brl(purchase.totalAmount)}</b></section>
    <section className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-center"><span className="text-[8px] text-slate-400">Parcela mensal aproximada</span><strong className="my-2 block text-2xl font-black">{brl(purchase.estimatedConsumption, 0)}</strong><small className="text-[7px] text-slate-400">estimativa inicial dos {brl(purchase.totalAmount, 0)} desembolsados</small><div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="bg-indigo-500" style={{ width: `${consumptionPercent}%` }} /><i className="bg-emerald-400" style={{ width: `${100 - consumptionPercent}%` }} /></div><div className="mt-1 flex justify-between text-[7px] text-slate-400"><span>Uso mensal estimado · {consumptionPercent}%</span><span>Pode permanecer em estoque · {brl(purchase.stockAmount, 0)}</span></div><p className="mt-3 text-[8px] leading-5 text-slate-500">Esta primeira leitura usa a classificação cadastrada. O motor estatístico refina consumo, estoque e confiança quando houver mais compras.</p></section>
    <div className="mt-2 grid gap-2">{Object.entries(groups).map(([behavior, group]) => { const config = BEHAVIORS[behavior as keyof typeof BEHAVIORS]; return <article key={behavior} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: config.bg, color: config.color }}>{config.icon}</span><div className="flex-1"><strong className="block text-[9px]">{config.label}</strong><small className="text-[7px] text-slate-400">{group.count} {group.count === 1 ? 'produto' : 'produtos'}</small></div><b className="text-[10px]" style={{ color: config.color }}>{brl(group.total)}</b></article> })}</div>
    {pending > 0 ? <section className="mt-3 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-indigo-600"><RefreshCw size={15} /></span><div className="flex-1"><strong className="block text-[9px]">{pending} {pending === 1 ? 'produto precisa' : 'produtos precisam'} de confirmação</strong><small className="text-[7px] text-slate-400">Isso melhora as próximas análises.</small></div><button onClick={() => navigate('reviews')} className="flex items-center gap-1 text-[8px] font-bold text-indigo-600">Revisar <ArrowRight size={13} /></button></section> : <section className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 size={18} /><div><strong className="block text-[9px]">Compra concluída</strong><small className="text-[7px]">Nenhuma revisão pendente.</small></div></section>}
    <section className="mt-4"><h2 className="mb-2 text-[10px] font-bold">Itens da compra</h2>{purchase.items.map((item) => <article key={item.id} className="flex items-center gap-2 border-b border-slate-200 py-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-500"><Package size={13} /></span><div className="min-w-0 flex-1"><strong className="block truncate text-[9px]">{item.productName}</strong><small className="text-[7px] text-slate-400">{item.quantity} {item.unit} · {item.categoryName}</small></div><b className="text-[9px]">{brl(item.totalPrice)}</b></article>)}</section>
    <PrimaryButton className="mt-4" onClick={() => navigate(pending ? 'reviews' : 'home')}>{pending ? 'Confirmar produtos' : 'Voltar ao início'}</PrimaryButton>
    {confirmDelete ? <section className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-rose-600" size={22} /><div><strong className="block text-sm text-rose-950">Excluir esta importação?</strong><p className="mt-1 text-xs leading-5 text-rose-700">A compra e seus itens sairão dos relatórios. Esta ação não pode ser desfeita.</p></div></div>{deleteError && <p className="mt-3 rounded-xl bg-white p-3 text-xs text-rose-700">{deleteError}</p>}<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setConfirmDelete(false)} disabled={deleting} className="min-h-11 rounded-xl bg-white text-sm font-bold text-slate-700 disabled:opacity-40">Manter compra</button><button onClick={() => void removeImport()} disabled={deleting} className="min-h-11 rounded-xl bg-rose-600 text-sm font-bold text-white disabled:opacity-40">{deleting ? 'Excluindo…' : 'Excluir de vez'}</button></div></section> : <button onClick={() => setConfirmDelete(true)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-rose-600"><Trash2 size={17} />Excluir esta importação</button>}
  </div>
}

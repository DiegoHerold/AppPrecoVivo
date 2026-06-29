'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { clientApi, localDate } from '@/lib/client-api'
import type { CategoryDto } from '@/lib/client-types'
import { behaviorValues, manualPurchaseSchema, measureUnitValues, storeTypeValues } from '@/lib/validation'
import { BEHAVIORS, PageHeader, PrimaryButton } from './ui'

type Input = z.input<typeof manualPurchaseSchema>
type Output = z.output<typeof manualPurchaseSchema>

export function ManualPurchaseScreen({ categories, onBack, created }: { categories: CategoryDto[]; onBack: () => void; created: (id: string) => void }) {
  const defaultCategory = categories[0]?.id ?? ''
  const { register, control, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(manualPurchaseSchema),
    defaultValues: { storeName: '', storeType: 'mercado', purchaseDate: localDate(), totalAmount: 0, accessKey: '', nfceUrl: '', items: [{ rawName: '', quantity: 1, unit: 'un', unitPrice: 0, categoryId: defaultCategory, behaviorType: 'pontual', estimatedDurationMonths: 1 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' }) ?? []
  function unitOptions(index: number) {
    const item = watchedItems[index]
    const category = categories.find((entry) => entry.id === item?.categoryId)
    return Array.from(new Set([...(item?.unit ? [item.unit] : []), ...(category?.allowedUnits?.length ? category.allowedUnits : measureUnitValues)]))
  }
  const total = watchedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0)
  useEffect(() => { setValue('totalAmount', Math.round(total * 100) / 100, { shouldValidate: total > 0 }) }, [total, setValue])
  const submit = handleSubmit(async (values) => { const result = await clientApi<{ id: string }>('/api/purchases/manual', { method: 'POST', body: JSON.stringify(values) }); created(result.id) })
  return <div className="px-4 pb-8"><PageHeader title="Cadastrar compra" subtitle="Tudo será salvo no PostgreSQL" onBack={onBack} />
    <form onSubmit={submit} className="grid gap-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-3"><h2 className="mb-3 text-[11px] font-bold">Dados da compra</h2><div className="grid gap-3"><label className="form-label">Estabelecimento<input {...register('storeName')} className="form-input" placeholder="Ex.: Mercado do bairro" /></label><div className="grid grid-cols-2 gap-2"><label className="form-label">Tipo<select {...register('storeType')} className="form-input">{storeTypeValues.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></label><label className="form-label">Data<input {...register('purchaseDate')} type="date" className="form-input" /></label></div><div className="grid grid-cols-2 gap-2"><label className="form-label">Total<input {...register('totalAmount')} type="number" step="0.01" className="form-input" readOnly /></label><label className="form-label">Chave opcional<input {...register('accessKey')} className="form-input" maxLength={44} placeholder="Opcional" /></label></div></div></section>
      <div className="flex items-center justify-between"><h2 className="text-[11px] font-bold">Itens da compra</h2><button type="button" onClick={() => append({ rawName: '', quantity: 1, unit: 'un', unitPrice: 0, categoryId: defaultCategory, behaviorType: 'pontual', estimatedDurationMonths: 1 })} className="flex items-center gap-1 text-[9px] font-bold text-indigo-600"><Plus size={14} /> Adicionar item</button></div>
      {fields.map((field, index) => <section key={field.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between"><strong className="text-[10px]">Item {index + 1}</strong>{fields.length > 1 && <button type="button" aria-label={`Remover item ${index + 1}`} onClick={() => remove(index)} className="text-rose-400"><Trash2 size={15} /></button>}</div><div className="grid gap-2"><label className="form-label">Nome do item<input {...register(`items.${index}.rawName`)} className="form-input" placeholder="Nome como está na nota" /></label><div className="grid grid-cols-3 gap-2"><label className="form-label">Quantidade<input {...register(`items.${index}.quantity`)} type="number" step="0.001" className="form-input" /></label><label className="form-label">Unidade<select {...register(`items.${index}.unit`)} className="form-input">{unitOptions(index).map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label><label className="form-label">Preço un.<input {...register(`items.${index}.unitPrice`)} type="number" step="0.01" className="form-input" /></label></div><label className="form-label">Categoria<select {...register(`items.${index}.categoryId`)} className="form-input">{categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}</select></label><label className="form-label">Comportamento<select {...register(`items.${index}.behaviorType`)} className="form-input">{behaviorValues.map((behavior) => <option key={behavior} value={behavior}>{BEHAVIORS[behavior].label}</option>)}</select></label>{watchedItems[index]?.behaviorType === 'estoque' && <label className="form-label">Duração estimada (meses)<input {...register(`items.${index}.estimatedDurationMonths`)} type="number" step="0.5" min="1" max="24" className="form-input" /></label>}</div></section>)}
      {(errors.root || errors.items || errors.storeName || errors.totalAmount) && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-[9px] text-rose-600">Revise os campos obrigatórios e os valores dos itens.</p>}
      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"><div className="mb-2 flex justify-between text-[10px]"><span>Total calculado</span><strong>R$ {total.toFixed(2).replace('.', ',')}</strong></div><PrimaryButton disabled={isSubmitting || !categories.length}>{isSubmitting ? 'Salvando compra…' : 'Salvar e analisar'}</PrimaryButton></div>
    </form>
  </div>
}

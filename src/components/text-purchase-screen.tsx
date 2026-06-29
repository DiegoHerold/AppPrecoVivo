'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { clientApi, localDate } from '@/lib/client-api'
import { rawTextImportSchema, storeTypeValues } from '@/lib/validation'
import { PageHeader, PrimaryButton } from './ui'

type Form = z.infer<typeof rawTextImportSchema>

export function TextPurchaseScreen({ onBack, created }: { onBack: () => void; created: (id: string) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(rawTextImportSchema), defaultValues: { storeName: '', storeType: 'mercado', purchaseDate: localDate(), rawText: '' } })
  const submit = handleSubmit(async (values) => { const result = await clientApi<{ id: string }>('/api/purchases/text', { method: 'POST', body: JSON.stringify(values) }); created(result.id) })
  return <div className="px-4 pb-8"><PageHeader title="Colar texto da nota" subtitle="Uma linha vira um item real" onBack={onBack} /><form onSubmit={submit} className="grid gap-3"><section className="rounded-2xl border border-slate-200 bg-white p-3"><div className="grid gap-3"><label className="form-label">Estabelecimento<input {...register('storeName')} className="form-input" placeholder="Ex.: Supermercado União" /></label><div className="grid grid-cols-2 gap-2"><label className="form-label">Tipo<select {...register('storeType')} className="form-input">{storeTypeValues.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></label><label className="form-label">Data<input {...register('purchaseDate')} type="date" className="form-input" /></label></div><label className="form-label">Itens<textarea {...register('rawText')} rows={9} className="form-input resize-none leading-5" placeholder={'Arroz branco 5kg | 1 | 24,90 | pct\nLeite integral 1L | 6 | 4,89 | un'} /></label></div></section><div className="rounded-xl bg-indigo-50 p-3 text-[9px] text-indigo-700"><strong>Formato:</strong> Produto | quantidade | preço unitário | unidade</div>{Object.keys(errors).length > 0 && <p className="rounded-lg bg-rose-50 p-2 text-[9px] text-rose-600">{errors.rawText?.message ?? 'Revise os campos.'}</p>}<PrimaryButton disabled={isSubmitting}>{isSubmitting ? 'Importando texto…' : 'Criar compra com estes itens'}</PrimaryButton></form></div>
}


'use client'

import { Fragment, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Package, Pencil, Plus, Trash2, X } from 'lucide-react'
import { clientApi } from '@/lib/client-api'
import type { AccountPlanCategoryDto, MeasureUnit } from '@/lib/client-types'
import { PageHeader, PrimaryButton } from './ui'

type Editor = {
  id?: string
  name: string
  icon: string
  color: string
  parentId: string | null
  allowedUnits: MeasureUnit[]
  active: boolean
}

const measureUnits: MeasureUnit[] = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz']

const emptyEditor = (parentId: string | null = null): Editor => ({
  name: '',
  icon: '📁',
  color: '#635BFF',
  parentId,
  allowedUnits: ['un'],
  active: true,
})

function flattenVisible(categories: AccountPlanCategoryDto[], expanded: Set<string>) {
  const byParent = new Map<string | null, AccountPlanCategoryDto[]>()
  for (const category of categories) {
    const children = byParent.get(category.parentId) ?? []
    children.push(category)
    byParent.set(category.parentId, children)
  }
  for (const children of byParent.values()) children.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const result: AccountPlanCategoryDto[] = []
  function visit(parentId: string | null) {
    for (const category of byParent.get(parentId) ?? []) {
      result.push(category)
      if (expanded.has(category.id)) visit(category.id)
    }
  }
  visit(null)
  return result
}

export function CategoriesScreen({ categories, onBack, changed, openProduct }: {
  categories: AccountPlanCategoryDto[]
  onBack: () => void
  changed: () => Promise<void>
  openProduct: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Editor | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const rows = useMemo(() => flattenVisible(categories, expanded), [categories, expanded])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    if (!editor) return
    setSaving(true)
    setMessage('')
    try {
      const path = editor.id ? '/api/account-plan/' + editor.id : '/api/account-plan'
      await clientApi(path, {
        method: editor.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: editor.name,
          icon: editor.icon,
          color: editor.color,
          parentId: editor.parentId,
          allowedUnits: editor.allowedUnits,
          active: editor.active,
        }),
      })
      if (editor.parentId) setExpanded((current) => new Set(current).add(editor.parentId as string))
      setEditor(null)
      await changed()
      setMessage('Plano de contas atualizado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a classificação.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(category: AccountPlanCategoryDto) {
    if (!window.confirm('Excluir “' + category.name + '”? Classificações com histórico não podem ser apagadas.')) return
    setMessage('')
    try {
      await clientApi('/api/account-plan/' + category.id, { method: 'DELETE' })
      await changed()
      setMessage('Classificação excluída.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir.')
    }
  }

  return <div className="px-4 pb-8">
    <PageHeader title="Produtos" subtitle="Cadastro e plano de contas" />
    <div className="mb-3 grid grid-cols-2 border-b border-slate-200"><button onClick={onBack} className="py-2 text-[10px] text-slate-400">Meus produtos</button><button className="border-b-2 border-indigo-500 py-2 text-[10px] font-bold text-indigo-600">Plano de contas</button></div>
    <div className="mb-3 rounded-xl bg-indigo-50 p-3 text-[9px] leading-4 text-indigo-700">O plano de contas define como os produtos são classificados, quais medidas aceitam e como você navega pelos relatórios.</div>
    <div className="grid gap-1.5">
      {rows.map((category) => {
        const accounts = category.accounts ?? []
        const expandable = category.childrenCount > 0 || accounts.length > 0
        return <Fragment key={category.id}>
          <article className={'relative flex min-h-12 items-center gap-2 rounded-xl border bg-white px-2.5 shadow-sm ' + (category.active ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-55')} style={{ marginLeft: category.level * 11 }}>
            {category.level > 0 && <span className="absolute -left-2.5 top-1/2 h-px w-2.5 bg-indigo-200" />}
            <button aria-label={(expanded.has(category.id) ? 'Recolher ' : 'Expandir ') + category.name} onClick={() => toggle(category.id)} disabled={!expandable} className="grid h-7 w-6 place-items-center text-indigo-400 disabled:text-slate-200">{expandable ? expanded.has(category.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span className="h-1 w-1 rounded-full bg-current" />}</button>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: category.color + '15' }}>{category.icon}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[10px]">{category.name}</strong><small className="block truncate text-[7px] text-slate-400">{(category.allowedUnits ?? ['un']).join(', ')} · {accounts.length ? String(accounts.length) + (accounts.length === 1 ? ' conta de produto' : ' contas de produto') : category.childrenCount ? String(category.childrenCount) + (category.childrenCount === 1 ? ' subnível' : ' subníveis') : category.active ? 'Sem produtos' : 'Desativada'}</small></span>
            <button aria-label={'Criar subcategoria em ' + category.name} onClick={() => setEditor(emptyEditor(category.id))} className="grid h-7 w-7 place-items-center text-indigo-500"><Plus size={14} /></button>
            <button aria-label={'Editar ' + category.name} onClick={() => setEditor({ id: category.id, name: category.name, icon: category.icon, color: category.color, parentId: category.parentId, allowedUnits: category.allowedUnits ?? ['un'], active: category.active })} className="grid h-7 w-7 place-items-center text-slate-400"><Pencil size={13} /></button>
            <button aria-label={'Excluir ' + category.name} onClick={() => void remove(category)} className="grid h-7 w-7 place-items-center text-rose-400"><Trash2 size={13} /></button>
          </article>
          {expanded.has(category.id) && accounts.map((account) => <article key={account.id} className={'relative flex min-h-14 items-center gap-2 rounded-xl border px-3 shadow-sm ' + (account.active ? 'border-emerald-100 bg-emerald-50/60' : 'border-dashed border-slate-200 bg-slate-50 opacity-65')} style={{ marginLeft: (category.level + 1) * 11 }}>
            <span className="absolute -left-2.5 top-1/2 h-px w-2.5 bg-emerald-200" />
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600"><Package size={17} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[10px]">{account.name}</strong><small className="block truncate text-[7px] text-slate-500">Conta de produto · {account.defaultUnit} · {account.itemCount} {account.itemCount === 1 ? 'movimentação' : 'movimentações'} · {account.active ? 'ativa' : 'inativa'}</small></span>
            {account.productActive && <button aria-label={'Abrir produto ' + account.name} onClick={() => openProduct(account.productId)} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-indigo-600"><ChevronRight size={16} /></button>}
          </article>)}
        </Fragment>
      })}
    </div>
    <button onClick={() => setEditor(emptyEditor())} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-indigo-300 py-3 text-[9px] font-semibold text-indigo-600"><Plus size={14} /> Nova categoria principal</button>
    {message && <p role="status" className={'mt-3 rounded-xl p-3 text-[9px] ' + (message.includes('atualizado') || message.includes('excluída') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>{message}</p>}

    {editor && <div className="absolute inset-0 z-[90] flex items-end bg-slate-950/35 p-3 backdrop-blur-[1px]" role="dialog" aria-label={editor.id ? 'Editar classificação' : 'Nova classificação'}>
      <section className="max-h-[86%] w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
        <header className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-black">{editor.id ? 'Editar classificação' : 'Nova classificação'}</h2><p className="text-[8px] text-slate-400">O histórico permanece ligado ao mesmo código.</p></div><button aria-label="Fechar editor" onClick={() => setEditor(null)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100"><X size={15} /></button></header>
        <div className="grid grid-cols-[64px_1fr] gap-2"><label className="form-label">Ícone<input aria-label="Ícone" value={editor.icon} onChange={(event) => setEditor({ ...editor, icon: event.target.value })} className="form-input text-center text-lg" maxLength={8} /></label><label className="form-label">Nome<input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} className="form-input" placeholder="Ex.: Básicos" /></label></div>
        <div className="mt-3 grid grid-cols-[1fr_72px] gap-2"><label className="form-label">Classificação superior<select value={editor.parentId ?? ''} onChange={(event) => setEditor({ ...editor, parentId: event.target.value || null })} className="form-input"><option value="">Categoria principal</option>{categories.filter((category) => category.id !== editor.id).map((category) => <option key={category.id} value={category.id}>{category.path.join(' › ')}</option>)}</select></label><label className="form-label">Cor<input aria-label="Cor" type="color" value={editor.color} onChange={(event) => setEditor({ ...editor, color: event.target.value.toUpperCase() })} className="form-input h-10 p-1" /></label></div>
        <fieldset className="mt-3"><legend className="form-label">Unidades aceitas nesta classificação</legend><div className="mt-1 flex flex-wrap gap-1.5">{measureUnits.map((unit) => { const selected = editor.allowedUnits.includes(unit); return <button key={unit} type="button" aria-pressed={selected} onClick={() => setEditor({ ...editor, allowedUnits: selected ? editor.allowedUnits.filter((value) => value !== unit) : [...editor.allowedUnits, unit] })} className={'min-w-10 rounded-full border px-3 py-2 text-[9px] font-bold ' + (selected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-500')}>{unit}</button> })}</div><p className="mt-1.5 text-[7px] text-slate-400">Essas opções aparecem ao cadastrar e editar produtos desta classificação.</p></fieldset>
        {editor.id && <label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[9px]"><input type="checkbox" checked={editor.active} onChange={(event) => setEditor({ ...editor, active: event.target.checked })} /> Classificação ativa para novos produtos</label>}
        <PrimaryButton className="mt-4" onClick={() => void save()} disabled={saving || editor.name.trim().length < 2 || editor.allowedUnits.length === 0}>{saving ? 'Salvando…' : <><Check size={16} /> Salvar classificação</>}</PrimaryButton>
      </section>
    </div>}
  </div>
}

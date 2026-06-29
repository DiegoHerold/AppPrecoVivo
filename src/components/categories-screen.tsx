'use client'

import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import {
  Check, ChevronDown, ChevronRight, FolderOpen, GripVertical,
  Package, Pencil, Plus, Trash2, X, MoveRight, EyeOff,
} from 'lucide-react'
import { clientApi } from '@/lib/client-api'
import type { AccountPlanCategoryDto, MeasureUnit, ProductAccountDto } from '@/lib/client-types'
import { PageHeader, PrimaryButton } from './ui'

// ─── types ────────────────────────────────────────────────────────────────────

type Editor = {
  id?: string
  name: string
  icon: string
  color: string
  parentId: string | null
  allowedUnits: MeasureUnit[]
  active: boolean
}

type DragState = {
  sourceId: string
  sourceType: 'cat' | 'acc'
  targetId: string | null
  targetType: 'cat' | 'acc' | null
  position: 'before' | 'after'
} | null

// ─── constants ────────────────────────────────────────────────────────────────

const measureUnits: MeasureUnit[] = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz']

const emptyEditor = (parentId: string | null = null): Editor => ({
  name: '', icon: '📁', color: '#635BFF', parentId, allowedUnits: ['un'], active: true,
})

// ─── tree helpers ─────────────────────────────────────────────────────────────

type RowItem =
  | { kind: 'cat'; data: AccountPlanCategoryDto }
  | { kind: 'acc'; data: ProductAccountDto; parentLevel: number }

function buildRows(categories: AccountPlanCategoryDto[], expanded: Set<string>): RowItem[] {
  const byParent = new Map<string | null, AccountPlanCategoryDto[]>()
  for (const cat of categories) {
    const siblings = byParent.get(cat.parentId) ?? []
    siblings.push(cat)
    byParent.set(cat.parentId, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.ordem - b.ordem || a.name.localeCompare(b.name, 'pt-BR'))
  }

  const result: RowItem[] = []
  function visit(parentId: string | null) {
    for (const cat of byParent.get(parentId) ?? []) {
      result.push({ kind: 'cat', data: cat })
      if (expanded.has(cat.id)) {
        visit(cat.id)
        // Accounts shown after children? No – show accounts at the end of expanded cat
        const sortedAccounts = [...(cat.accounts ?? [])].sort(
          (a, b) => a.ordem - b.ordem || a.name.localeCompare(b.name, 'pt-BR')
        )
        for (const acc of sortedAccounts) {
          result.push({ kind: 'acc', data: acc, parentLevel: cat.level })
        }
      }
    }
  }
  visit(null)
  return result
}

function siblings(categories: AccountPlanCategoryDto[], parentId: string | null): AccountPlanCategoryDto[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.ordem - b.ordem || a.name.localeCompare(b.name, 'pt-BR'))
}

function accountSiblings(categories: AccountPlanCategoryDto[], categoryId: string): ProductAccountDto[] {
  const cat = categories.find((c) => c.id === categoryId)
  return [...(cat?.accounts ?? [])].sort((a, b) => a.ordem - b.ordem || a.name.localeCompare(b.name, 'pt-BR'))
}

// ─── sub-components ───────────────────────────────────────────────────────────

function EditorModal({ editor, categories, onClose, onSave, saving }: {
  editor: Editor
  categories: AccountPlanCategoryDto[]
  onClose: () => void
  onSave: (e: Editor) => void
  saving: boolean
}) {
  const [e, setE] = useState(editor)
  return (
    <div className="absolute inset-0 z-[90] flex items-end bg-slate-950/35 p-3 backdrop-blur-[1px]"
      role="dialog" aria-label={e.id ? 'Editar classificação' : 'Nova classificação'}>
      <section className="max-h-[86%] w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black">{e.id ? 'Editar classificação' : 'Nova classificação'}</h2>
            <p className="text-[8px] text-slate-400">O histórico permanece ligado ao mesmo código.</p>
          </div>
          <button aria-label="Fechar editor" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100"><X size={15} /></button>
        </header>
        <div className="grid grid-cols-[64px_1fr] gap-2">
          <label className="form-label">Ícone<input aria-label="Ícone" value={e.icon} onChange={(ev) => setE({ ...e, icon: ev.target.value })} className="form-input text-center text-lg" maxLength={8} /></label>
          <label className="form-label">Nome<input value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} className="form-input" placeholder="Ex.: Básicos" /></label>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_72px] gap-2">
          <label className="form-label">Classificação superior
            <select value={e.parentId ?? ''} onChange={(ev) => setE({ ...e, parentId: ev.target.value || null })} className="form-input">
              <option value="">Categoria principal</option>
              {categories.filter((c) => c.id !== e.id).map((c) => (
                <option key={c.id} value={c.id}>{c.path.join(' › ')}</option>
              ))}
            </select>
          </label>
          <label className="form-label">Cor<input aria-label="Cor" type="color" value={e.color} onChange={(ev) => setE({ ...e, color: ev.target.value.toUpperCase() })} className="form-input h-10 p-1" /></label>
        </div>
        <fieldset className="mt-3">
          <legend className="form-label">Unidades aceitas nesta classificação</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {measureUnits.map((unit) => {
              const selected = e.allowedUnits.includes(unit)
              return (
                <button key={unit} type="button" aria-pressed={selected}
                  onClick={() => setE({ ...e, allowedUnits: selected ? e.allowedUnits.filter((u) => u !== unit) : [...e.allowedUnits, unit] })}
                  className={'min-w-10 rounded-full border px-3 py-2 text-[9px] font-bold ' + (selected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-500')}>
                  {unit}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[7px] text-slate-400">Essas opções aparecem ao cadastrar produtos desta classificação.</p>
        </fieldset>
        {e.id && (
          <label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[9px]">
            <input type="checkbox" checked={e.active} onChange={(ev) => setE({ ...e, active: ev.target.checked })} />
            Classificação ativa para novos produtos
          </label>
        )}
        <PrimaryButton className="mt-4" onClick={() => onSave(e)}
          disabled={saving || e.name.trim().length < 2 || e.allowedUnits.length === 0}>
          {saving ? 'Salvando…' : <><Check size={16} /> Salvar classificação</>}
        </PrimaryButton>
      </section>
    </div>
  )
}

function MoveCategoryModal({ categoryId, categories, onClose, onMove, saving }: {
  categoryId: string
  categories: AccountPlanCategoryDto[]
  onClose: () => void
  onMove: (parentId: string | null) => void
  saving: boolean
}) {
  const current = categories.find((c) => c.id === categoryId)
  const [selected, setSelected] = useState<string | null>(current?.parentId ?? null)

  // Build ancestors of current to prevent cycles
  function isAncestor(id: string): boolean {
    let c = categories.find((x) => x.id === categoryId)
    while (c) {
      if (c.id === id) return true
      c = c.parentId ? categories.find((x) => x.id === c!.parentId) : undefined
    }
    return false
  }

  const options = categories.filter((c) => c.id !== categoryId && !isAncestor(c.id))

  return (
    <div className="absolute inset-0 z-[90] flex items-end bg-slate-950/35 p-3 backdrop-blur-[1px]" role="dialog" aria-label="Mover classificação">
      <section className="max-h-[80%] w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black">Mover "{current?.name}"</h2>
            <p className="text-[8px] text-slate-400">Escolha onde esta classificação ficará na árvore.</p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100"><X size={15} /></button>
        </header>
        <div className="grid gap-1">
          <button onClick={() => setSelected(null)}
            className={'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] ' + (selected === null ? 'border-indigo-400 bg-indigo-50 font-bold text-indigo-700' : 'border-slate-200 text-slate-600')}>
            <FolderOpen size={14} className="shrink-0 text-slate-400" />
            <span>Raiz (sem pai)</span>
            {selected === null && <Check size={13} className="ml-auto text-indigo-500" />}
          </button>
          {options.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className={'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] ' + (selected === c.id ? 'border-indigo-400 bg-indigo-50 font-bold text-indigo-700' : 'border-slate-200 text-slate-600')}>
              <span className="shrink-0">{c.icon}</span>
              <span className="truncate">{c.path.join(' › ')}</span>
              {selected === c.id && <Check size={13} className="ml-auto shrink-0 text-indigo-500" />}
            </button>
          ))}
        </div>
        <PrimaryButton className="mt-4" onClick={() => onMove(selected)} disabled={saving}>
          {saving ? 'Movendo…' : <><MoveRight size={16} /> Mover para cá</>}
        </PrimaryButton>
      </section>
    </div>
  )
}

function MoveAccountModal({ account, categories, onClose, onMove, saving }: {
  account: ProductAccountDto
  categories: AccountPlanCategoryDto[]
  onClose: () => void
  onMove: (categoryId: string) => void
  saving: boolean
}) {
  const [selected, setSelected] = useState(account.categoryId)
  const options = categories.filter((c) => c.id !== account.categoryId && c.active)
  return (
    <div className="absolute inset-0 z-[90] flex items-end bg-slate-950/35 p-3 backdrop-blur-[1px]" role="dialog" aria-label="Mover produto">
      <section className="max-h-[80%] w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black">Mover "{account.name}"</h2>
            <p className="text-[8px] text-slate-400">Escolha a classificação de destino. O histórico é preservado.</p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100"><X size={15} /></button>
        </header>
        <div className="grid gap-1">
          {options.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className={'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] ' + (selected === c.id ? 'border-indigo-400 bg-indigo-50 font-bold text-indigo-700' : 'border-slate-200 text-slate-600')}>
              <span className="shrink-0">{c.icon}</span>
              <span className="truncate">{c.path.join(' › ')}</span>
              {selected === c.id && <Check size={13} className="ml-auto shrink-0 text-indigo-500" />}
            </button>
          ))}
        </div>
        <PrimaryButton className="mt-4" onClick={() => onMove(selected)}
          disabled={saving || selected === account.categoryId}>
          {saving ? 'Movendo…' : <><MoveRight size={16} /> Mover para cá</>}
        </PrimaryButton>
      </section>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function CategoriesScreen({ categories, onBack, changed, openProduct }: {
  categories: AccountPlanCategoryDto[]
  onBack: () => void
  changed: () => Promise<void>
  openProduct: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Editor | null>(null)
  const [moveCategory, setMoveCategory] = useState<string | null>(null) // category id to move
  const [moveAccount, setMoveAccount] = useState<ProductAccountDto | null>(null) // account to move
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // ── drag state ──
  const [drag, setDrag] = useState<DragState>(null)
  const pointerCaptureRef = useRef<{ el: Element; pointerId: number } | null>(null)

  const rows = useMemo(() => buildRows(categories, expanded), [categories, expanded])

  // ── tree actions ──

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 4000)
  }

  // ── save editor ──

  async function saveEditor(e: Editor) {
    setSaving(true)
    setMessage('')
    try {
      const path = e.id ? '/api/account-plan/' + e.id : '/api/account-plan'
      await clientApi(path, {
        method: e.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: e.name, icon: e.icon, color: e.color,
          parentId: e.parentId, allowedUnits: e.allowedUnits, active: e.active,
        }),
      })
      if (e.parentId) setExpanded((cur) => new Set(cur).add(e.parentId as string))
      setEditor(null)
      await changed()
      showMessage('Plano de contas atualizado.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  // ── delete ──

  async function remove(category: AccountPlanCategoryDto) {
    if (!window.confirm(`Excluir "${category.name}"? Classificações com histórico não podem ser apagadas.`)) return
    setMessage('')
    try {
      await clientApi('/api/account-plan/' + category.id, { method: 'DELETE' })
      await changed()
      showMessage('Classificação excluída.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível excluir.')
    }
  }

  // ── move category ──

  async function confirmMoveCategory(parentId: string | null) {
    if (!moveCategory) return
    setSaving(true)
    try {
      await clientApi('/api/account-plan/' + moveCategory, {
        method: 'PATCH',
        body: JSON.stringify({ parentId }),
      })
      setMoveCategory(null)
      await changed()
      showMessage('Classificação movida.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível mover.')
    } finally {
      setSaving(false)
    }
  }

  // ── move account ──

  async function confirmMoveAccount(categoryId: string) {
    if (!moveAccount) return
    setSaving(true)
    try {
      await clientApi('/api/account-plan/account/' + moveAccount.id, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId }),
      })
      setMoveAccount(null)
      await changed()
      showMessage('Produto movido para nova classificação.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível mover o produto.')
    } finally {
      setSaving(false)
    }
  }

  // ── reorder helpers ──

  async function reorderCategories(updatedSiblings: AccountPlanCategoryDto[], parentId: string | null) {
    try {
      await clientApi('/api/account-plan/reorder', {
        method: 'POST',
        body: JSON.stringify({
          categories: updatedSiblings.map((c, i) => ({ id: c.id, ordem: i })),
        }),
      })
      await changed()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível reordenar.')
    }
  }

  async function reorderAccounts(updatedAccounts: ProductAccountDto[]) {
    try {
      await clientApi('/api/account-plan/reorder', {
        method: 'POST',
        body: JSON.stringify({
          accounts: updatedAccounts.map((a, i) => ({ id: a.id, ordem: i })),
        }),
      })
      await changed()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível reordenar.')
    }
  }

  // ── drag & drop ──

  function startDrag(e: React.PointerEvent, sourceId: string, sourceType: 'cat' | 'acc') {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureRef.current = { el, pointerId: e.pointerId }
    setDrag({ sourceId, sourceType, targetId: null, targetType: null, position: 'after' })
  }

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    // Find the element at this point (ignoring capture)
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const article = el?.closest('[data-row-id]') as HTMLElement | null
    if (!article) {
      setDrag((d) => d ? { ...d, targetId: null, targetType: null } : null)
      return
    }
    const targetId = article.dataset.rowId!
    const targetType = article.dataset.rowType as 'cat' | 'acc'
    if (targetId === drag.sourceId) return
    const rect = article.getBoundingClientRect()
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDrag((d) => d ? { ...d, targetId, targetType, position } : null)
  }, [drag])

  async function finishDrag() {
    const d = drag
    setDrag(null)
    if (!d?.targetId) return

    if (d.sourceType === 'cat' && d.targetType === 'cat') {
      const source = categories.find((c) => c.id === d.sourceId)
      const target = categories.find((c) => c.id === d.targetId)
      if (!source || !target) return
      if (source.parentId !== target.parentId) {
        showMessage('Use "Mover para" para mover entre níveis diferentes. O arraste só reordena dentro do mesmo grupo.')
        return
      }
      const sibs = siblings(categories, source.parentId)
      const without = sibs.filter((c) => c.id !== d.sourceId)
      const targetIdx = without.findIndex((c) => c.id === d.targetId)
      if (targetIdx === -1) return
      const insertIdx = d.position === 'before' ? targetIdx : targetIdx + 1
      without.splice(insertIdx, 0, source)
      await reorderCategories(without, source.parentId)
    } else if (d.sourceType === 'acc' && d.targetType === 'acc') {
      // Find which category the accounts belong to
      let sourceCat: AccountPlanCategoryDto | undefined
      let targetCat: AccountPlanCategoryDto | undefined
      for (const cat of categories) {
        if (cat.accounts?.some((a) => a.id === d.sourceId)) sourceCat = cat
        if (cat.accounts?.some((a) => a.id === d.targetId)) targetCat = cat
      }
      if (!sourceCat || !targetCat || sourceCat.id !== targetCat.id) {
        showMessage('Use "Mover produto" para mover entre classificações diferentes.')
        return
      }
      const accs = accountSiblings(categories, sourceCat.id)
      const source = accs.find((a) => a.id === d.sourceId)
      if (!source) return
      const without = accs.filter((a) => a.id !== d.sourceId)
      const targetIdx = without.findIndex((a) => a.id === d.targetId)
      if (targetIdx === -1) return
      const insertIdx = d.position === 'before' ? targetIdx : targetIdx + 1
      without.splice(insertIdx, 0, source)
      await reorderAccounts(without)
    } else if (d.sourceType === 'cat' && d.targetType === 'acc') {
      showMessage('Arraste classificações sobre outras classificações para reordenar.')
    }
  }

  // ── render ──

  const isSuccess = message.includes('atualizado') || message.includes('excluída') || message.includes('movida') || message.includes('Movido') || message.includes('movido')

  return (
    <div className="px-4 pb-8" onPointerMove={handlePointerMove} onPointerUp={() => void finishDrag()}>
      <PageHeader title="Produtos" subtitle="Cadastro e plano de contas" />
      <div className="mb-3 grid grid-cols-2 border-b border-slate-200">
        <button onClick={onBack} className="py-2 text-[10px] text-slate-400">Meus produtos</button>
        <button className="border-b-2 border-indigo-500 py-2 text-[10px] font-bold text-indigo-600">Plano de contas</button>
      </div>
      <div className="mb-3 rounded-xl bg-indigo-50 p-3 text-[9px] leading-4 text-indigo-700">
        Arraste o ícone <GripVertical size={10} className="inline" /> para reordenar dentro do mesmo nível. Use <MoveRight size={10} className="inline" /> para mover entre níveis.
      </div>

      {/* ── tree ── */}
      <div className="grid gap-1">
        {rows.map((row, rowIdx) => {
          if (row.kind === 'cat') {
            const cat = row.data
            const isDragging = drag?.sourceId === cat.id
            const isDropTarget = drag?.targetId === cat.id
            const showLineBefore = isDropTarget && drag?.position === 'before'
            const showLineAfter = isDropTarget && drag?.position === 'after'
            const expandable = cat.childrenCount > 0 || (cat.accounts?.length ?? 0) > 0

            return (
              <Fragment key={cat.id}>
                {showLineBefore && <div className="h-0.5 rounded-full bg-indigo-400" style={{ marginLeft: cat.level * 11 }} />}
                <article
                  data-row-id={cat.id}
                  data-row-type="cat"
                  className={
                    'relative flex min-h-12 items-center gap-1.5 rounded-xl border bg-white px-2 shadow-sm transition-opacity ' +
                    (cat.active ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-55') +
                    (isDragging ? ' opacity-40' : '')
                  }
                  style={{ marginLeft: cat.level * 11 }}
                >
                  {cat.level > 0 && <span className="absolute -left-2.5 top-1/2 h-px w-2.5 bg-indigo-200" />}

                  {/* drag handle */}
                  <button
                    aria-label={'Arrastar ' + cat.name}
                    className="grid h-8 w-5 shrink-0 cursor-grab place-items-center touch-none text-slate-300 active:cursor-grabbing"
                    onPointerDown={(e) => startDrag(e, cat.id, 'cat')}
                  >
                    <GripVertical size={13} />
                  </button>

                  {/* expand */}
                  <button aria-label={(expanded.has(cat.id) ? 'Recolher ' : 'Expandir ') + cat.name}
                    onClick={() => toggle(cat.id)} disabled={!expandable}
                    className="grid h-7 w-5 shrink-0 place-items-center text-indigo-400 disabled:text-slate-200">
                    {expandable ? expanded.has(cat.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : <span className="h-1 w-1 rounded-full bg-current" />}
                  </button>

                  {/* icon */}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base" style={{ background: cat.color + '18' }}>
                    {cat.icon}
                  </span>

                  {/* name + meta */}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[10px]">{cat.name}</strong>
                    <small className="block truncate text-[7px] text-slate-400">
                      {(cat.allowedUnits ?? ['un']).join(', ')} ·{' '}
                      {cat.accounts?.length
                        ? `${cat.accounts.length} ${cat.accounts.length === 1 ? 'produto' : 'produtos'}`
                        : cat.childrenCount
                          ? `${cat.childrenCount} ${cat.childrenCount === 1 ? 'subnível' : 'subníveis'}`
                          : cat.active ? 'Vazio' : 'Desativado'}
                    </small>
                  </span>

                  {/* actions */}
                  <button aria-label={'Criar subcategoria em ' + cat.name}
                    onClick={() => setEditor(emptyEditor(cat.id))}
                    className="grid h-7 w-7 shrink-0 place-items-center text-indigo-500">
                    <Plus size={13} />
                  </button>
                  <button aria-label={'Mover ' + cat.name}
                    onClick={() => setMoveCategory(cat.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center text-slate-400">
                    <MoveRight size={13} />
                  </button>
                  <button aria-label={'Editar ' + cat.name}
                    onClick={() => setEditor({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, parentId: cat.parentId, allowedUnits: cat.allowedUnits ?? ['un'], active: cat.active })}
                    className="grid h-7 w-7 shrink-0 place-items-center text-slate-400">
                    <Pencil size={12} />
                  </button>
                  <button aria-label={'Excluir ' + cat.name}
                    onClick={() => void remove(cat)}
                    className="grid h-7 w-7 shrink-0 place-items-center text-rose-400">
                    <Trash2 size={12} />
                  </button>
                </article>
                {showLineAfter && <div className="h-0.5 rounded-full bg-indigo-400" style={{ marginLeft: cat.level * 11 }} />}
              </Fragment>
            )
          }

          // account row
          const acc = row.data
          const accParentLevel = row.parentLevel
          const isDragging = drag?.sourceId === acc.id
          const isDropTarget = drag?.targetId === acc.id
          const showLineBefore = isDropTarget && drag?.position === 'before'
          const showLineAfter = isDropTarget && drag?.position === 'after'

          return (
            <Fragment key={acc.id}>
              {showLineBefore && <div className="h-0.5 rounded-full bg-emerald-400" style={{ marginLeft: (accParentLevel + 1) * 11 }} />}
              <article
                data-row-id={acc.id}
                data-row-type="acc"
                className={
                  'relative flex min-h-14 items-center gap-2 rounded-xl border px-2.5 shadow-sm transition-opacity ' +
                  (acc.active ? 'border-emerald-100 bg-emerald-50/60' : 'border-dashed border-slate-200 bg-slate-50 opacity-65') +
                  (isDragging ? ' opacity-40' : '')
                }
                style={{ marginLeft: (accParentLevel + 1) * 11 }}
              >
                <span className="absolute -left-2.5 top-1/2 h-px w-2.5 bg-emerald-200" />

                {/* drag handle */}
                <button
                  aria-label={'Arrastar ' + acc.name}
                  className="grid h-8 w-5 shrink-0 cursor-grab place-items-center touch-none text-slate-300 active:cursor-grabbing"
                  onPointerDown={(e) => startDrag(e, acc.id, 'acc')}
                >
                  <GripVertical size={13} />
                </button>

                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600">
                  <Package size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[10px]">{acc.name}</strong>
                  <small className="block truncate text-[7px] text-slate-500">
                    {acc.defaultUnit} · {acc.itemCount} {acc.itemCount === 1 ? 'movimentação' : 'movimentações'} · {acc.active ? 'ativo' : 'inativo'}
                  </small>
                </span>

                {/* move account */}
                <button aria-label={'Mover produto ' + acc.name}
                  onClick={() => setMoveAccount(acc)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-slate-400">
                  <MoveRight size={14} />
                </button>

                {/* open product */}
                {acc.productActive && (
                  <button aria-label={'Abrir produto ' + acc.name}
                    onClick={() => openProduct(acc.productId)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-indigo-600">
                    <ChevronRight size={15} />
                  </button>
                )}
              </article>
              {showLineAfter && <div className="h-0.5 rounded-full bg-emerald-400" style={{ marginLeft: (accParentLevel + 1) * 11 }} />}
            </Fragment>
          )
        })}
      </div>

      {/* ── add root category ── */}
      <button onClick={() => setEditor(emptyEditor())}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-indigo-300 py-3 text-[9px] font-semibold text-indigo-600">
        <Plus size={14} /> Nova categoria principal
      </button>

      {/* ── message ── */}
      {message && (
        <p role="status" className={'mt-3 rounded-xl p-3 text-[9px] ' + (isSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
          {message}
        </p>
      )}

      {/* ── modals ── */}
      {editor && (
        <EditorModal
          editor={editor}
          categories={categories}
          onClose={() => setEditor(null)}
          onSave={(e) => void saveEditor(e)}
          saving={saving}
        />
      )}
      {moveCategory && (
        <MoveCategoryModal
          categoryId={moveCategory}
          categories={categories}
          onClose={() => setMoveCategory(null)}
          onMove={(parentId) => void confirmMoveCategory(parentId)}
          saving={saving}
        />
      )}
      {moveAccount && (
        <MoveAccountModal
          account={moveAccount}
          categories={categories}
          onClose={() => setMoveAccount(null)}
          onMove={(categoryId) => void confirmMoveAccount(categoryId)}
          saving={saving}
        />
      )}
    </div>
  )
}

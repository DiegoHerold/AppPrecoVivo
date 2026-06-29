'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  Check, ChevronDown, ChevronRight, CornerDownRight, EyeOff, Folder, FolderOpen,
  FolderPlus, MoreVertical, Package, PackagePlus, Pencil, Search, X,
} from 'lucide-react'
import { clientApi } from '@/lib/client-api'
import type { BehaviorType, MeasureUnit, PlanoContaNode } from '@/lib/client-types'
import { EmptyState, PageHeader, PrimaryButton } from './ui'

const measureUnits: MeasureUnit[] = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz']
const behaviorOptions: { value: BehaviorType; label: string }[] = [
  { value: 'recorrente_semanal', label: 'Recorrente semanal' },
  { value: 'recorrente_mensal', label: 'Recorrente mensal' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'pontual', label: 'Pontual' },
  { value: 'sazonal', label: 'Sazonal' },
  { value: 'emergencia', label: 'Emergência' },
  { value: 'fora_do_padrao', label: 'Fora do padrão' },
]

type Filter = 'todos' | 'grupos' | 'produtos' | 'inativos'

type GroupEditor = {
  kind: 'grupo'
  id?: string
  nome: string
  icone: string
  cor: string
  parentId: string | null
  allowedUnits: MeasureUnit[]
  ativo: boolean
}

type ProductEditor = {
  kind: 'produto'
  id?: string
  nome: string
  groupId: string
  behaviorType: BehaviorType
  estimatedDurationMonths: number
  defaultUnit: MeasureUnit
  brand: string
  packageSize: string
  ativo: boolean
}

type Editor = GroupEditor | ProductEditor

const emptyGroup = (parentId: string | null = null): GroupEditor => ({
  kind: 'grupo', nome: '', icone: '📁', cor: '#635BFF', parentId, allowedUnits: ['un'], ativo: true,
})

const emptyProduct = (groupId: string): ProductEditor => ({
  kind: 'produto', nome: '', groupId, behaviorType: 'pontual', estimatedDurationMonths: 1, defaultUnit: 'un', brand: '', packageSize: '', ativo: true,
})

function flattenVisible(nodes: PlanoContaNode[], expanded: Set<string>) {
  const byParent = new Map<string | null, PlanoContaNode[]>()
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? []
    list.push(node)
    byParent.set(node.parentId, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR') : a.tipo === 'GRUPO' ? -1 : 1))
  }
  const result: PlanoContaNode[] = []
  const visit = (parentId: string | null) => {
    for (const node of byParent.get(parentId) ?? []) {
      result.push(node)
      if (expanded.has(node.id)) visit(node.id)
    }
  }
  visit(null)
  return result
}

function descendantSet(nodes: PlanoContaNode[], rootId: string) {
  const ids = new Set([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true }
    }
  }
  return ids
}

export function PlanoContasScreen({ nodes, onBack, changed, openProduct }: {
  nodes: PlanoContaNode[]
  onBack: () => void
  changed: () => Promise<void>
  openProduct: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [moving, setMoving] = useState<PlanoContaNode | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'erro'; text: string } | null>(null)

  const groups = useMemo(() => nodes.filter((node) => node.tipo === 'GRUPO').sort((a, b) => a.path.join(' / ').localeCompare(b.path.join(' / '), 'pt-BR')), [nodes])
  const isSearching = query.trim().length > 0 || filter !== 'todos'

  const rows = useMemo(() => {
    if (!isSearching) return flattenVisible(nodes, expanded)
    const term = query.trim().toLowerCase()
    return nodes
      .filter((node) => {
        if (filter === 'grupos' && node.tipo !== 'GRUPO') return false
        if (filter === 'produtos' && node.tipo !== 'PRODUTO') return false
        if (filter === 'inativos' && node.ativo) return false
        if (!term) return true
        return node.nome.toLowerCase().includes(term) || node.path.join(' › ').toLowerCase().includes(term)
      })
      .sort((a, b) => a.path.join(' / ').localeCompare(b.path.join(' / '), 'pt-BR'))
  }, [nodes, expanded, query, filter, isSearching])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function refresh(text: string) {
    setEditor(null)
    setMoving(null)
    await changed()
    setMessage({ tone: 'ok', text })
  }

  function fail(error: unknown, fallback: string) {
    setMessage({ tone: 'erro', text: error instanceof Error ? error.message : fallback })
  }

  async function save() {
    if (!editor) return
    setSaving(true)
    setMessage(null)
    try {
      if (editor.kind === 'grupo') {
        if (editor.id) {
          await clientApi('/api/plano-contas/' + editor.id, {
            method: 'PATCH',
            body: JSON.stringify({ nome: editor.nome, icone: editor.icone, cor: editor.cor, allowedUnits: editor.allowedUnits, ativo: editor.ativo }),
          })
        } else {
          await clientApi('/api/plano-contas', {
            method: 'POST',
            body: JSON.stringify({ nome: editor.nome, icone: editor.icone, cor: editor.cor, parentId: editor.parentId, allowedUnits: editor.allowedUnits, ativo: editor.ativo }),
          })
          if (editor.parentId) setExpanded((current) => new Set(current).add(editor.parentId as string))
        }
      } else if (editor.id) {
        await clientApi('/api/plano-contas/' + editor.id, {
          method: 'PATCH',
          body: JSON.stringify({ nome: editor.nome, ativo: editor.ativo }),
        })
      } else {
        await clientApi('/api/plano-contas/produto', {
          method: 'POST',
          body: JSON.stringify({
            standardName: editor.nome, groupId: editor.groupId, behaviorType: editor.behaviorType,
            estimatedDurationMonths: editor.estimatedDurationMonths, defaultUnit: editor.defaultUnit,
            brand: editor.brand, packageSize: editor.packageSize,
          }),
        })
        setExpanded((current) => new Set(current).add(editor.groupId))
      }
      await refresh('Plano de contas atualizado.')
    } catch (error) {
      fail(error, 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function moveTo(parentId: string | null) {
    if (!moving) return
    setSaving(true)
    setMessage(null)
    try {
      await clientApi('/api/plano-contas/' + moving.id + '/move', { method: 'POST', body: JSON.stringify({ parentId }) })
      if (parentId) setExpanded((current) => new Set(current).add(parentId))
      await refresh('Item movido.')
    } catch (error) {
      fail(error, 'Não foi possível mover.')
    } finally {
      setSaving(false)
    }
  }

  async function inactivate(node: PlanoContaNode) {
    const label = node.tipo === 'GRUPO' ? 'o grupo' : 'o produto'
    if (!window.confirm(`Inativar ${label} “${node.nome}”? O histórico é mantido e você pode reativar depois.`)) return
    setMessage(null)
    try {
      await clientApi('/api/plano-contas/' + node.id, { method: 'DELETE' })
      await refresh('Item inativado.')
    } catch (error) {
      fail(error, 'Não foi possível inativar.')
    }
  }

  const moveTargets = useMemo(() => {
    if (!moving) return []
    const blocked = descendantSet(nodes, moving.id)
    return groups.filter((group) => !blocked.has(group.id))
  }, [moving, groups, nodes])

  const firstGroupId = groups[0]?.id ?? null

  return <div className="px-4 pb-28 md:px-6">
    <PageHeader title="Plano de contas" subtitle="A base de tudo: categorias e produtos" onBack={onBack} />

    <label className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl bg-slate-200/70 px-4 text-slate-500">
      <Search size={19} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none" placeholder="Buscar grupo ou produto…" />
      {query && <button aria-label="Limpar busca" onClick={() => setQuery('')} className="grid h-8 w-8 place-items-center rounded-full text-slate-400"><X size={16} /></button>}
    </label>

    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none md:-mx-6 md:px-6">
      {([['todos', 'Todos'], ['grupos', 'Grupos'], ['produtos', 'Produtos'], ['inativos', 'Inativos']] as [Filter, string][]).map(([value, label]) =>
        <button key={value} onClick={() => setFilter(value)} className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${filter === value ? 'bg-indigo-600 text-white' : 'bg-slate-200/70 text-slate-600'}`}>{label}</button>)}
    </div>

    <div className="mb-3 grid grid-cols-2 gap-2">
      <button onClick={() => setEditor(emptyGroup(null))} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-300 text-sm font-semibold text-indigo-600"><FolderPlus size={18} /> Novo grupo</button>
      <button onClick={() => firstGroupId && setEditor(emptyProduct(firstGroupId))} disabled={!firstGroupId} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 text-sm font-semibold text-emerald-600 disabled:opacity-40"><PackagePlus size={18} /> Novo produto</button>
    </div>

    {!rows.length ? (
      <EmptyState
        icon={<Folder />}
        title={isSearching ? 'Nada encontrado' : 'Seu plano de contas está vazio'}
        description={isSearching ? 'Ajuste a busca ou os filtros para ver outros itens.' : 'Crie um grupo para começar a organizar suas categorias e produtos.'}
      />
    ) : (
      <div className="flex flex-col gap-2">
        {rows.map((node) => {
          const isGroup = node.tipo === 'GRUPO'
          const expandable = !isSearching && isGroup && (node.childrenCount > 0 || node.productCount > 0)
          const open = expanded.has(node.id)
          // Indentação por PADDING interno (não margin) para o card nunca ultrapassar a largura.
          const indentPad = 10 + (isSearching ? 0 : Math.min(node.level, 6) * 14)
          return <Fragment key={node.id}>
            <article
              className={`relative flex min-h-[60px] w-full min-w-0 items-center gap-2 rounded-2xl border bg-white pr-1.5 shadow-sm ${node.ativo ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60'}`}
              style={{ paddingLeft: indentPad }}
            >
              {!isSearching && node.level > 0 && <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden />}
              <button
                aria-label={expandable ? (open ? 'Recolher ' : 'Expandir ') + node.nome : node.nome}
                onClick={() => expandable && toggle(node.id)}
                disabled={!expandable}
                className="grid h-11 w-7 shrink-0 place-items-center text-slate-400 disabled:opacity-40"
              >
                {expandable ? (open ? <ChevronDown size={18} /> : <ChevronRight size={18} />) : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
              </button>

              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: node.cor + '18' }}>
                {isGroup ? (open ? <FolderOpen size={18} style={{ color: node.cor }} /> : <Folder size={18} style={{ color: node.cor }} />) : <Package size={18} className="text-emerald-600" />}
              </span>

              <button onClick={() => isGroup ? toggle(node.id) : node.produtoId && openProduct(node.produtoId)} className="min-w-0 flex-1 py-2 text-left">
                {isSearching && node.path.length > 1 && <small className="block truncate text-[11px] text-slate-400">{node.path.slice(0, -1).join(' › ')}</small>}
                <strong className="block truncate text-[15px] leading-5 text-slate-900">{node.nome}</strong>
                <small className="block truncate text-[12px] text-slate-500">
                  {isGroup
                    ? [node.childrenCount ? `${node.childrenCount} ${node.childrenCount === 1 ? 'subnível' : 'subníveis'}` : null,
                       node.productCount ? `${node.productCount} ${node.productCount === 1 ? 'produto' : 'produtos'}` : null]
                       .filter(Boolean).join(' · ') || (node.ativo ? 'Grupo vazio' : 'Grupo inativo')
                    : `${node.defaultUnit ?? 'un'} · ${node.itemCount} ${node.itemCount === 1 ? 'movimentação' : 'movimentações'}${node.ativo ? '' : ' · inativo'}`}
                </small>
              </button>

              <div className="relative shrink-0">
                <button
                  aria-label={'Ações de ' + node.nome}
                  onClick={() => setMenuFor((current) => (current === node.id ? null : node.id))}
                  className="grid h-11 w-9 place-items-center rounded-lg text-slate-500 active:bg-slate-100"
                ><MoreVertical size={18} /></button>
                {menuFor === node.id && <>
                  <button aria-hidden tabIndex={-1} onClick={() => setMenuFor(null)} className="fixed inset-0 z-10 cursor-default" />
                  <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
                    {isGroup && <button onClick={() => { setMenuFor(null); setEditor(emptyProduct(node.id)) }} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium text-emerald-700"><PackagePlus size={17} /> Novo produto aqui</button>}
                    <button onClick={() => { setMenuFor(null); setMoving(node) }} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium text-slate-700"><CornerDownRight size={16} /> Mover</button>
                    <button
                      onClick={() => { setMenuFor(null); setEditor(isGroup
                        ? { kind: 'grupo', id: node.id, nome: node.nome, icone: node.icone, cor: node.cor, parentId: node.parentId, allowedUnits: node.allowedUnits, ativo: node.ativo }
                        : { kind: 'produto', id: node.id, nome: node.nome, groupId: node.parentId ?? '', behaviorType: node.behaviorType ?? 'pontual', estimatedDurationMonths: node.estimatedDurationMonths ?? 1, defaultUnit: node.defaultUnit ?? 'un', brand: node.brand ?? '', packageSize: node.packageSize ?? '', ativo: node.ativo }) }}
                      className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium text-slate-700"
                    ><Pencil size={15} /> {isGroup ? 'Editar grupo' : 'Renomear produto'}</button>
                    {node.ativo && <button onClick={() => { setMenuFor(null); void inactivate(node) }} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium text-rose-600"><EyeOff size={15} /> Inativar</button>}
                  </div>
                </>}
              </div>
            </article>
          </Fragment>
        })}
      </div>
    )}

    {message && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{message.text}</p>}

    {/* Editor de grupo/produto */}
    {editor && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[1px]" role="dialog" aria-label={editor.kind === 'grupo' ? 'Grupo' : 'Produto'}>
      <section className="max-h-[88%] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{editor.id ? 'Editar' : editor.kind === 'grupo' ? 'Novo grupo' : 'Novo produto'}</h2>
          <button aria-label="Fechar" onClick={() => setEditor(null)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><X size={18} /></button>
        </header>

        {editor.kind === 'grupo' ? <>
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <label className="form-label">Ícone<input aria-label="Ícone" value={editor.icone} onChange={(event) => setEditor({ ...editor, icone: event.target.value })} className="form-input text-center text-xl" maxLength={8} /></label>
            <label className="form-label">Nome<input value={editor.nome} onChange={(event) => setEditor({ ...editor, nome: event.target.value })} className="form-input" placeholder="Ex.: Carnes" /></label>
          </div>
          {!editor.id && <label className="form-label mt-3 block">Grupo superior
            <select value={editor.parentId ?? ''} onChange={(event) => setEditor({ ...editor, parentId: event.target.value || null })} className="form-input">
              <option value="">Grupo principal (raiz)</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.path.join(' › ')}</option>)}
            </select>
          </label>}
          <label className="form-label mt-3 block">Cor
            <input aria-label="Cor" type="color" value={editor.cor} onChange={(event) => setEditor({ ...editor, cor: event.target.value.toUpperCase() })} className="form-input h-11 p-1" />
          </label>
          <fieldset className="mt-3">
            <legend className="form-label">Unidades aceitas neste grupo</legend>
            <div className="mt-1 flex flex-wrap gap-2">{measureUnits.map((unit) => {
              const selected = editor.allowedUnits.includes(unit)
              return <button key={unit} type="button" aria-pressed={selected} onClick={() => setEditor({ ...editor, allowedUnits: selected ? editor.allowedUnits.filter((value) => value !== unit) : [...editor.allowedUnits, unit] })} className={`min-h-11 min-w-12 rounded-full border px-3 text-sm font-bold ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-500'}`}>{unit}</button>
            })}</div>
          </fieldset>
          {editor.id && <label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={editor.ativo} onChange={(event) => setEditor({ ...editor, ativo: event.target.checked })} /> Grupo ativo</label>}
          <PrimaryButton className="mt-5" onClick={() => void save()} disabled={saving || editor.nome.trim().length < 2 || editor.allowedUnits.length === 0}>{saving ? 'Salvando…' : <><Check size={18} /> Salvar grupo</>}</PrimaryButton>
        </> : <>
          <label className="form-label block">Nome do produto<input value={editor.nome} onChange={(event) => setEditor({ ...editor, nome: event.target.value })} className="form-input" placeholder="Ex.: Peito de frango 1kg" /></label>
          <label className="form-label mt-3 block">Grupo
            <select value={editor.groupId} onChange={(event) => setEditor({ ...editor, groupId: event.target.value })} className="form-input" disabled={Boolean(editor.id)}>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.path.join(' › ')}</option>)}
            </select>
          </label>
          {!editor.id && <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="form-label">Unidade padrão
                <select value={editor.defaultUnit} onChange={(event) => setEditor({ ...editor, defaultUnit: event.target.value as MeasureUnit })} className="form-input">
                  {measureUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
              <label className="form-label">Comportamento
                <select value={editor.behaviorType} onChange={(event) => setEditor({ ...editor, behaviorType: event.target.value as BehaviorType })} className="form-input">
                  {behaviorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="form-label">Marca (opcional)<input value={editor.brand} onChange={(event) => setEditor({ ...editor, brand: event.target.value })} className="form-input" /></label>
              <label className="form-label">Embalagem (opcional)<input value={editor.packageSize} onChange={(event) => setEditor({ ...editor, packageSize: event.target.value })} className="form-input" placeholder="Ex.: 1kg" /></label>
            </div>
          </>}
          {editor.id && <label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={editor.ativo} onChange={(event) => setEditor({ ...editor, ativo: event.target.checked })} /> Produto ativo</label>}
          <PrimaryButton className="mt-5" onClick={() => void save()} disabled={saving || editor.nome.trim().length < 2 || !editor.groupId}>{saving ? 'Salvando…' : <><Check size={18} /> Salvar produto</>}</PrimaryButton>
        </>}
      </section>
    </div>}

    {/* Mover destino */}
    {moving && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[1px]" role="dialog" aria-label="Mover item">
      <section className="max-h-[80%] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <header className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-black">Mover “{moving.nome}”</h2>
          <button aria-label="Fechar" onClick={() => setMoving(null)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><X size={18} /></button>
        </header>
        <p className="mb-3 text-sm text-slate-500">Escolha o novo grupo de destino. O histórico é preservado.</p>
        <div className="grid gap-2">
          {moving.tipo === 'GRUPO' && <button onClick={() => void moveTo(null)} disabled={saving} className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-left text-sm font-semibold text-slate-700"><Folder size={18} /> Grupo principal (raiz)</button>}
          {moveTargets.map((group) => <button key={group.id} onClick={() => void moveTo(group.id)} disabled={saving || group.id === moving.parentId} className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-left disabled:opacity-40">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: group.cor + '18' }}>{group.icone}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{group.nome}</strong><small className="block truncate text-[11px] text-slate-400">{group.path.join(' › ')}</small></span>
            {group.id === moving.parentId && <small className="text-[11px] text-slate-400">atual</small>}
          </button>)}
          {!moveTargets.length && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Não há outro grupo de destino disponível.</p>}
        </div>
      </section>
    </div>}
  </div>
}

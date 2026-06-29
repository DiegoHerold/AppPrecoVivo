import assert from 'node:assert/strict'
import test from 'node:test'
import { descendantIds, indexTree, pathOf, wouldCreateCycle, type TreeRow } from './plano-contas-tree'

// Árvore de exemplo:
// Alimentação > Carnes > Aves > (Frango[GRUPO], frango-prod[PRODUTO])
const rows: TreeRow[] = [
  { id: 'alim', parentId: null, tipo: 'GRUPO', nome: 'Alimentação' },
  { id: 'carnes', parentId: 'alim', tipo: 'GRUPO', nome: 'Carnes' },
  { id: 'aves', parentId: 'carnes', tipo: 'GRUPO', nome: 'Aves' },
  { id: 'frango', parentId: 'aves', tipo: 'GRUPO', nome: 'Frango' },
  { id: 'prod-frango', parentId: 'frango', tipo: 'PRODUTO', nome: 'Peito de frango 1kg' },
  { id: 'casa', parentId: null, tipo: 'GRUPO', nome: 'Casa' },
]

test('descendantIds inclui o nó e toda a subárvore (grupos e produtos)', () => {
  const ids = descendantIds(rows, 'carnes')
  assert.deepEqual([...ids].sort(), ['aves', 'carnes', 'frango', 'prod-frango'])
  assert.equal(descendantIds(rows, 'casa').size, 1)
})

test('pathOf monta a hierarquia até a raiz', () => {
  const { byId } = indexTree(rows)
  const path = pathOf(byId.get('prod-frango')!, byId).map((row) => row.nome)
  assert.deepEqual(path, ['Alimentação', 'Carnes', 'Aves', 'Frango', 'Peito de frango 1kg'])
})

test('wouldCreateCycle bloqueia mover um nó para dentro de si mesmo ou de um descendente', () => {
  const { byId } = indexTree(rows)
  assert.equal(wouldCreateCycle(byId, 'carnes', 'aves'), true) // mover Carnes para baixo de Aves (descendente)
  assert.equal(wouldCreateCycle(byId, 'carnes', 'carnes'), true) // para si mesmo
  assert.equal(wouldCreateCycle(byId, 'carnes', 'casa'), false) // destino válido
  assert.equal(wouldCreateCycle(byId, 'carnes', null), false) // para a raiz
})

test('indexTree agrupa filhos por pai', () => {
  const { childrenByParent } = indexTree(rows)
  assert.deepEqual((childrenByParent.get(null) ?? []).map((row) => row.id).sort(), ['alim', 'casa'])
  assert.deepEqual((childrenByParent.get('aves') ?? []).map((row) => row.id), ['frango'])
})

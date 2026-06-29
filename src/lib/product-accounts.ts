// Compatibilidade: a criação de produto + nó do plano de contas vive agora em
// '@/lib/plano-contas'. Reexportado para manter imports antigos funcionando.
export { createProdutoWithNode, type NewProductInput } from '@/lib/plano-contas'

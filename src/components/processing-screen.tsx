'use client'

import { useEffect, useState } from 'react'
import { Check, Database, Sparkles } from 'lucide-react'

const steps = ['Compra salva no banco', 'Aliases verificados', 'Produtos classificados', 'Consumo estimado calculado', 'Análise mensal atualizada']

export function ProcessingScreen({ purchaseId, done }: { purchaseId: string; done: (id: string) => void }) {
  const [current, setCurrent] = useState(0)
  useEffect(() => { const timer = window.setInterval(() => setCurrent((value) => Math.min(value + 1, steps.length)), 260); const finish = window.setTimeout(() => done(purchaseId), 1600); return () => { clearInterval(timer); clearTimeout(finish) } }, [purchaseId, done])
  return <div className="flex h-full flex-col items-center bg-[radial-gradient(circle_at_50%_15%,#EDEBFF,transparent_27%),#F7F8FC] px-9 pt-16 text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-600 text-white shadow-xl"><Database size={30} /></span><span className="mt-5 inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600"><Sparkles size={13} /> Processando dados reais</span><h1 className="mt-2 text-xl font-black tracking-tight">Atualizando seu fluxo</h1><p className="mt-2 text-[10px] text-slate-400">A compra já foi persistida. Estamos consolidando a análise.</p><div className="mt-8 grid w-full gap-2 text-left">{steps.map((step, index) => <div key={step} className={`flex items-center gap-2 rounded-xl border p-2.5 text-[10px] ${index < current ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : index === current ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400'}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-[8px] ${index < current ? 'bg-emerald-500 text-white' : index === current ? 'bg-indigo-500 text-white' : 'bg-slate-100'}`}>{index < current ? <Check size={13} /> : index + 1}</span><strong>{step}</strong></div>)}</div><div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#635BFF,#22C7A0)] transition-all" style={{ width: `${current / steps.length * 100}%` }} /></div></div>
}


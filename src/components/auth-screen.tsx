'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react'
import { z } from 'zod'
import { loginSchema, registerSchema } from '@/lib/validation'
import { clientApi } from '@/lib/client-api'
import type { UserDto } from '@/lib/client-types'
import { PrimaryButton } from './ui'

type AuthResult = { user: UserDto }

function RegisterForm({ done }: { done: (user: UserDto) => void }) {
  const [show, setShow] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) })
  const submit = handleSubmit(async (values) => { try { setServerError(''); done((await clientApi<AuthResult>('/api/auth/register', { method: 'POST', body: JSON.stringify(values) })).user) } catch (error) { setServerError(error instanceof Error ? error.message : 'Não foi possível criar a conta.') } })
  return <form onSubmit={submit} className="grid gap-3">
    <label className="auth-label">Seu nome<input {...register('name')} className="auth-input" placeholder="Como podemos chamar você?" autoComplete="name" /></label>{errors.name && <p className="form-error">{errors.name.message}</p>}
    <label className="auth-label">E-mail<input {...register('email')} className="auth-input" placeholder="voce@exemplo.com" autoComplete="email" /></label>{errors.email && <p className="form-error">{errors.email.message}</p>}
    <label className="auth-label">Senha<span className="relative"><input {...register('password')} type={show ? 'text' : 'password'} className="auth-input pr-11" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" /><button type="button" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>{errors.password && <p className="form-error">{errors.password.message}</p>}
    {serverError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{serverError}</p>}
    <PrimaryButton disabled={isSubmitting}>{isSubmitting ? 'Criando conta…' : <>Criar minha conta <ArrowRight size={17} /></>}</PrimaryButton>
  </form>
}

function LoginForm({ done }: { done: (user: UserDto) => void }) {
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) })
  const submit = handleSubmit(async (values) => { try { setServerError(''); done((await clientApi<AuthResult>('/api/auth/login', { method: 'POST', body: JSON.stringify(values) })).user) } catch (error) { setServerError(error instanceof Error ? error.message : 'Não foi possível entrar.') } })
  return <form onSubmit={submit} className="grid gap-3">
    <label className="auth-label">E-mail<input {...register('email')} className="auth-input" placeholder="voce@exemplo.com" autoComplete="email" /></label>{errors.email && <p className="form-error">{errors.email.message}</p>}
    <label className="auth-label">Senha<input {...register('password')} type="password" className="auth-input" placeholder="Sua senha" autoComplete="current-password" /></label>{errors.password && <p className="form-error">{errors.password.message}</p>}
    {serverError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{serverError}</p>}
    <PrimaryButton disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : <>Entrar <ArrowRight size={17} /></>}</PrimaryButton>
  </form>
}

export function AuthScreen({ done }: { done: (user: UserDto) => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register')
  return <main className="min-h-dvh bg-white md:grid md:grid-cols-[1.05fr_.95fr]">
    <section className="hidden min-h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_15%_85%,rgba(62,220,176,.28),transparent_32%),linear-gradient(145deg,#30278F,#635BFF)] p-12 text-white md:flex">
      <div className="flex items-center gap-2 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Sparkles /></span> Fluxo de Compras</div>
      <div className="my-auto max-w-xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs"><ShieldCheck size={15} /> Seu histórico, suas respostas</span><h1 className="mt-6 text-6xl font-black leading-[1.02] tracking-[-.055em]">Entenda por que o mês mudou.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-white/70">Registre compras reais e separe desembolso, consumo, estoque, preço e quantidade.</p><ul className="mt-8 grid gap-3 text-sm text-white/85">{['Compara somente com seu próprio histórico', 'Nenhuma compra fictícia no painel', 'Aprende quando você confirma um produto'].map((text) => <li key={text} className="flex items-center gap-2"><Check size={16} className="text-emerald-300" />{text}</li>)}</ul></div>
    </section>
    <section className="grid min-h-dvh place-items-center bg-[linear-gradient(180deg,#fff,#fafaff)] p-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]"><div className="w-full max-w-md rounded-3xl bg-white p-5 md:p-0">
      <div className="mb-7 flex items-center justify-center gap-2 text-lg font-bold text-indigo-600 md:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white">↗</span> Fluxo de Compras</div>
      <div className="mb-8 grid grid-cols-2 rounded-2xl bg-slate-100 p-1"><button onClick={() => setMode('register')} className={`min-h-11 rounded-xl py-2 text-sm font-bold ${mode === 'register' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>Criar conta</button><button onClick={() => setMode('login')} className={`min-h-11 rounded-xl py-2 text-sm font-bold ${mode === 'login' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>Entrar</button></div>
      <h2 className="text-3xl font-black tracking-tight text-slate-950">{mode === 'register' ? 'Comece com dados reais' : 'Que bom ter você de volta'}</h2><p className="mb-7 mt-3 text-base leading-7 text-slate-600">{mode === 'register' ? 'Sua conta recebe apenas o plano de categorias. As compras serão cadastradas por você.' : 'Entre para continuar sua análise.'}</p>
      {mode === 'register' ? <RegisterForm done={done} /> : <LoginForm done={done} />}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-600"><ShieldCheck size={15} /> Senha protegida e sessão segura.</p>
    </div></section>
  </main>
}

'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Bell, Camera, CheckCircle2, Construction, KeyRound, LogOut, MapPin, MonitorCog, Moon, Palette, ShieldCheck, Smartphone, Sun } from 'lucide-react'
import { z } from 'zod'
import { clientApi } from '@/lib/client-api'
import { requestCamera } from '@/lib/camera'
import type { UserDto } from '@/lib/client-types'
import { passwordChangeSchema, profileSchema } from '@/lib/validation'
import { PageHeader, PrimaryButton } from './ui'

type ProfileInput = z.infer<typeof profileSchema>

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="mb-4 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</span><div><h2 className="text-base font-black text-slate-950">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p></div></div>
}

function SwitchField({ label, description, checked, onChange, icon }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; icon: React.ReactNode }) {
  return <label className="flex min-h-18 cursor-pointer items-center gap-3 border-b border-slate-100 py-3 last:border-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{label}</strong><small className="mt-0.5 block text-xs leading-4 text-slate-500">{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-200 transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 peer-checked:bg-indigo-600 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" /></label>
}

function ThemeOption({ label, description, icon, current = false }: { label: string; description: string; icon: React.ReactNode; current?: boolean }) {
  return <button type="button" disabled={!current} aria-pressed={current} className={`relative min-h-32 rounded-2xl border p-3 text-left ${current ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'}`}>
    <span className={`grid h-10 w-10 place-items-center rounded-xl ${current ? 'bg-white text-indigo-600' : 'bg-slate-200/70 text-slate-400'}`}>{icon}</span>
    <strong className="mt-3 block text-sm">{label}</strong>
    <small className="mt-1 block text-xs leading-4">{description}</small>
    {current ? <span className="absolute right-2 top-2 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white">Atual</span> : <span className="absolute right-2 top-2" title="Em desenvolvimento"><Construction size={16} /></span>}
  </button>
}

export function ProfileScreen({ user, onBack, updated, logout }: { user: UserDto; onBack: () => void; updated: (user: UserDto) => void; logout: () => void }) {
  const [saveMessage, setSaveMessage] = useState('')
  const [cameraStatus, setCameraStatus] = useState('Ainda não testada')
  const [testingCamera, setTestingCamera] = useState(false)
  const [passwordsOpen, setPasswordsOpen] = useState(false)
  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      city: user.city ?? '',
      state: user.state ?? '',
      settings: user.settings,
    },
  })
  const settings = useWatch({ control, name: 'settings' })
  const save = handleSubmit(async (values) => {
    try {
      setSaveMessage('')
      const result = await clientApi<{ user: UserDto }>('/api/profile', { method: 'PATCH', body: JSON.stringify(values) })
      updated(result.user)
      reset({ name: result.user.name, email: result.user.email, phone: result.user.phone ?? '', city: result.user.city ?? '', state: result.user.state ?? '', settings: result.user.settings })
      setSaveMessage('Perfil e preferências salvos.')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Não foi possível salvar.')
    }
  })

  async function testCamera() {
    setTestingCamera(true)
    setCameraStatus('Solicitando permissão…')
    try {
      const stream = await requestCamera({ audio: false, video: { facingMode: { ideal: settings.cameraFacingMode } } })
      stream.getTracks().forEach((track) => track.stop())
      setCameraStatus('Câmera disponível e autorizada')
    } catch (error) {
      setCameraStatus(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Permissão negada no navegador' : error instanceof DOMException && error.name === 'TimeoutError' ? 'Permissão não respondida' : error instanceof Error && error.message === 'CAMERA_UNAVAILABLE' ? 'A câmera exige uma conexão segura (HTTPS).' : error instanceof Error ? error.message : 'Câmera indisponível')
    } finally {
      setTestingCamera(false)
    }
  }

  return <div className="px-4 pb-8">
    <PageHeader title="Perfil e configurações" subtitle="Sua conta, aparência e preferências" onBack={onBack} />

    <section className="my-4 overflow-hidden rounded-3xl bg-[linear-gradient(145deg,#312E81,#635BFF)] p-5 text-white shadow-[0_14px_34px_rgba(67,56,202,.28)]">
      <div className="flex items-center gap-4"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-black ring-1 ring-white/20">{user.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xl">{user.name}</strong><small className="mt-1 block truncate text-sm text-white/65">{user.email}</small><span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-200"><ShieldCheck size={13} /> Conta protegida</span></span></div>
    </section>

    <form onSubmit={save} className="grid gap-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader icon={<Palette size={20} />} title="Aparência" description="O visual atual continua ativo enquanto preparamos novos temas." />
        <div className="grid grid-cols-3 gap-2">
          <ThemeOption current label="Claro" description="Tema atual" icon={<Sun size={20} />} />
          <ThemeOption label="Escuro" description="Em desenvolvimento" icon={<Moon size={20} />} />
          <ThemeOption label="Automático" description="Em desenvolvimento" icon={<MonitorCog size={20} />} />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-amber-800"><Construction className="mt-0.5 shrink-0" size={18} /><p className="text-xs leading-5"><strong className="block">Temas em desenvolvimento</strong>Escuro e automático aparecem aqui para você saber o que vem depois, mas ainda não alteram o aplicativo.</p></div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader icon={<Smartphone size={20} />} title="Dados pessoais" description="Informações usadas para identificar sua conta." />
        <div className="grid gap-3"><label className="form-label">Nome<input {...register('name')} className="form-input" autoComplete="name" /></label>{errors.name && <p className="form-error">{errors.name.message}</p>}<label className="form-label">E-mail<input {...register('email')} className="form-input" type="email" autoComplete="email" /></label>{errors.email && <p className="form-error">{errors.email.message}</p>}<label className="form-label">Telefone<input {...register('phone')} className="form-input" inputMode="tel" autoComplete="tel" placeholder="Opcional" /></label><div className="grid grid-cols-[1fr_72px] gap-2"><label className="form-label"><span className="flex items-center gap-1"><MapPin size={13} /> Cidade</span><input {...register('city')} className="form-input" placeholder="Opcional" /></label><label className="form-label">UF<input {...register('state')} className="form-input uppercase" maxLength={2} placeholder="SP" /></label></div>{errors.state && <p className="form-error">{errors.state.message}</p>}</div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader icon={<Camera size={20} />} title="Câmera" description="Escolha qual câmera abrir primeiro ao fotografar o QR Code." />
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setValue('settings.cameraFacingMode', 'environment', { shouldDirty: true })} className={`min-h-24 rounded-2xl border p-3 text-left ${settings.cameraFacingMode === 'environment' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}><Camera size={20} /><strong className="mt-2 block text-sm">Traseira</strong><small className="text-xs text-slate-500">Ideal para notas</small></button><button type="button" onClick={() => setValue('settings.cameraFacingMode', 'user', { shouldDirty: true })} className={`min-h-24 rounded-2xl border p-3 text-left ${settings.cameraFacingMode === 'user' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}><Smartphone size={20} /><strong className="mt-2 block text-sm">Frontal</strong><small className="text-xs text-slate-500">Câmera de selfie</small></button></div>
        <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">A imagem é processada para ler o QR Code e não fica salva na sua conta.</p>
        <button type="button" onClick={() => void testCamera()} disabled={testingCamera} className="mt-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-slate-50 px-3 text-left disabled:opacity-50"><span><strong className="block text-sm text-slate-800">Testar acesso à câmera</strong><small className={`text-xs ${cameraStatus.includes('disponível') ? 'text-emerald-600' : 'text-slate-500'}`}>{cameraStatus}</small></span>{cameraStatus.includes('disponível') ? <CheckCircle2 size={19} className="text-emerald-500" /> : <Camera size={19} className="text-slate-400" />}</button>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-4 shadow-sm">
        <div className="border-b border-slate-100 py-4"><h2 className="text-base font-black text-slate-950">Preferências do aplicativo</h2><p className="mt-1 text-xs text-slate-500">Controle avisos e densidade da interface.</p></div>
        <SwitchField label="Notificações" description="Permitir avisos importantes do aplicativo" icon={<Bell size={18} />} checked={settings.notificationsEnabled} onChange={(value) => setValue('settings.notificationsEnabled', value, { shouldDirty: true })} />
        <SwitchField label="Resumo mensal" description="Avisar quando a análise do mês estiver pronta" icon={<CheckCircle2 size={18} />} checked={settings.monthlySummaryEnabled} onChange={(value) => setValue('settings.monthlySummaryEnabled', value, { shouldDirty: true })} />
        <SwitchField label="Alertas de preço" description="Sinalizar valores fora do seu histórico" icon={<Bell size={18} />} checked={settings.priceAlertsEnabled} onChange={(value) => setValue('settings.priceAlertsEnabled', value, { shouldDirty: true })} />
        <SwitchField label="Interface compacta" description="Reduzir espaçamentos dentro do app" icon={<Smartphone size={18} />} checked={settings.compactMode} onChange={(value) => setValue('settings.compactMode', value, { shouldDirty: true })} />
      </section>

      {saveMessage && <p role="status" className={`rounded-2xl p-3 text-sm ${saveMessage.includes('salvos') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{saveMessage}</p>}
      <PrimaryButton disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar alterações'}</PrimaryButton>
    </form>

    <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><button onClick={() => setPasswordsOpen((value) => !value)} className="flex min-h-12 w-full items-center gap-3 text-left"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-600"><KeyRound size={19} /></span><span className="flex-1"><strong className="block text-sm text-slate-900">Alterar senha</strong><small className="text-xs text-slate-500">Confirme a senha atual</small></span></button>{passwordsOpen && <PasswordForm done={() => setPasswordsOpen(false)} />}</section>
    <button onClick={logout} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 text-sm font-bold text-rose-600"><LogOut size={18} /> Sair da conta</button>
  </div>
}

function PasswordForm({ done }: { done: () => void }) {
  const [message, setMessage] = useState('')
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof passwordChangeSchema>>({ resolver: zodResolver(passwordChangeSchema) })
  const submit = handleSubmit(async (values) => {
    try {
      await clientApi('/api/profile/password', { method: 'POST', body: JSON.stringify(values) })
      reset()
      setMessage('Senha alterada com sucesso.')
      window.setTimeout(done, 900)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível alterar a senha.')
    }
  })
  return <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-slate-100 pt-4"><label className="form-label">Senha atual<input {...register('currentPassword')} type="password" className="form-input" autoComplete="current-password" /></label>{errors.currentPassword && <p className="form-error">{errors.currentPassword.message}</p>}<label className="form-label">Nova senha<input {...register('newPassword')} type="password" className="form-input" autoComplete="new-password" /></label>{errors.newPassword && <p className="form-error">{errors.newPassword.message}</p>}{message && <p role="status" className="text-sm text-indigo-600">{message}</p>}<button disabled={isSubmitting} className="mt-1 min-h-12 rounded-2xl bg-slate-900 text-sm font-bold text-white disabled:opacity-50">{isSubmitting ? 'Alterando…' : 'Atualizar senha'}</button></form>
}

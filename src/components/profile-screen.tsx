'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Bell, Camera, CheckCircle2, KeyRound, LogOut, MapPin, ShieldCheck, Smartphone } from 'lucide-react'
import { z } from 'zod'
import { clientApi } from '@/lib/client-api'
import { requestCamera } from '@/lib/camera'
import type { UserDto } from '@/lib/client-types'
import { passwordChangeSchema, profileSchema } from '@/lib/validation'
import { PageHeader, PrimaryButton } from './ui'

type ProfileInput = z.infer<typeof profileSchema>

function SwitchField({ label, description, checked, onChange, icon }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; icon: React.ReactNode }) {
  return <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 py-3 last:border-0"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</span><span className="min-w-0 flex-1"><strong className="block text-[10px] text-slate-800">{label}</strong><small className="block text-[8px] leading-4 text-slate-400">{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span className="relative h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" /></label>
}

export function ProfileScreen({ user, onBack, updated, logout }: { user: UserDto; onBack: () => void; updated: (user: UserDto) => void; logout: () => void }) {
  const [saveMessage, setSaveMessage] = useState('')
  const [cameraStatus, setCameraStatus] = useState('Ainda não testada')
  const [testingCamera, setTestingCamera] = useState(false)
  const [passwordsOpen, setPasswordsOpen] = useState(false)
  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name, email: user.email, phone: user.phone ?? '', city: user.city ?? '', state: user.state ?? '', settings: user.settings,
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
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') }
  })

  async function testCamera() {
    setTestingCamera(true)
    setCameraStatus('Solicitando permissão…')
    try {
      const stream = await requestCamera({ audio: false, video: { facingMode: { ideal: settings.cameraFacingMode } } })
      stream.getTracks().forEach((track) => track.stop())
      setCameraStatus('Câmera disponível e autorizada')
    } catch (error) {
      setCameraStatus(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Permissão negada no navegador' : error instanceof DOMException && error.name === 'TimeoutError' ? 'Permissão não respondida' : error instanceof Error && error.message === 'CAMERA_UNAVAILABLE' ? 'Acesso indisponível. Use HTTPS ou localhost.' : error instanceof Error ? error.message : 'Câmera indisponível')
    } finally { setTestingCamera(false) }
  }

  return <div className="px-4 pb-8"><PageHeader title="Perfil e configurações" subtitle="Sua conta e preferências" onBack={onBack} />
    <section className="my-4 flex items-center gap-3 rounded-2xl bg-[linear-gradient(145deg,#3730A3,#635BFF)] p-4 text-white"><span className="grid h-14 w-14 place-items-center rounded-full bg-white/15 text-xl font-black">{user.name.charAt(0).toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-sm">{user.name}</strong><small className="block truncate text-[9px] text-white/60">{user.email}</small><span className="mt-1 inline-flex items-center gap-1 text-[8px] text-emerald-200"><ShieldCheck size={11} /> Conta protegida</span></span></section>

    <form onSubmit={save} className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="mb-3 text-xs font-bold">Dados pessoais</h2><div className="grid gap-3"><label className="form-label">Nome<input {...register('name')} className="form-input" autoComplete="name" /></label>{errors.name && <p className="form-error">{errors.name.message}</p>}<label className="form-label">E-mail<input {...register('email')} className="form-input" type="email" autoComplete="email" /></label>{errors.email && <p className="form-error">{errors.email.message}</p>}<label className="form-label">Telefone<input {...register('phone')} className="form-input" inputMode="tel" autoComplete="tel" placeholder="Opcional" /></label><div className="grid grid-cols-[1fr_72px] gap-2"><label className="form-label"><span className="flex items-center gap-1"><MapPin size={11} /> Cidade</span><input {...register('city')} className="form-input" placeholder="Opcional" /></label><label className="form-label">UF<input {...register('state')} className="form-input uppercase" maxLength={2} placeholder="SP" /></label></div>{errors.state && <p className="form-error">{errors.state.message}</p>}</div></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="mb-1 text-xs font-bold">Câmera</h2><p className="mb-3 text-[9px] leading-4 text-slate-400">A foto só é capturada depois do seu toque e fica vinculada à sua conta.</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setValue('settings.cameraFacingMode', 'environment', { shouldDirty: true })} className={`rounded-xl border p-3 text-left ${settings.cameraFacingMode === 'environment' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}><Camera size={17} /><strong className="mt-2 block text-[10px]">Traseira</strong><small className="text-[8px] text-slate-400">Ideal para notas</small></button><button type="button" onClick={() => setValue('settings.cameraFacingMode', 'user', { shouldDirty: true })} className={`rounded-xl border p-3 text-left ${settings.cameraFacingMode === 'user' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}><Smartphone size={17} /><strong className="mt-2 block text-[10px]">Frontal</strong><small className="text-[8px] text-slate-400">Câmera de selfie</small></button></div><button type="button" onClick={() => void testCamera()} disabled={testingCamera} className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-left"><span><strong className="block text-[9px]">Testar acesso à câmera</strong><small className={`text-[8px] ${cameraStatus.includes('disponível') ? 'text-emerald-600' : 'text-slate-400'}`}>{cameraStatus}</small></span>{cameraStatus.includes('disponível') ? <CheckCircle2 size={17} className="text-emerald-500" /> : <Camera size={17} className="text-slate-400" />}</button></section>

      <section className="rounded-2xl border border-slate-200 bg-white px-4"><SwitchField label="Notificações" description="Permitir avisos importantes do aplicativo" icon={<Bell size={16} />} checked={settings.notificationsEnabled} onChange={(value) => setValue('settings.notificationsEnabled', value, { shouldDirty: true })} /><SwitchField label="Resumo mensal" description="Lembrar quando a análise do mês estiver pronta" icon={<CheckCircle2 size={16} />} checked={settings.monthlySummaryEnabled} onChange={(value) => setValue('settings.monthlySummaryEnabled', value, { shouldDirty: true })} /><SwitchField label="Alertas de preço" description="Sinalizar valores fora do seu histórico" icon={<Bell size={16} />} checked={settings.priceAlertsEnabled} onChange={(value) => setValue('settings.priceAlertsEnabled', value, { shouldDirty: true })} /><SwitchField label="Interface compacta" description="Reduzir espaçamentos dentro do app" icon={<Smartphone size={16} />} checked={settings.compactMode} onChange={(value) => setValue('settings.compactMode', value, { shouldDirty: true })} /></section>

      {saveMessage && <p role="status" className={`rounded-xl p-3 text-[9px] ${saveMessage.includes('salvos') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{saveMessage}</p>}
      <PrimaryButton disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar alterações'}</PrimaryButton>
    </form>

    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><button onClick={() => setPasswordsOpen((value) => !value)} className="flex w-full items-center gap-3 text-left"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><KeyRound size={17} /></span><span className="flex-1"><strong className="block text-[10px]">Alterar senha</strong><small className="text-[8px] text-slate-400">Confirme a senha atual</small></span></button>{passwordsOpen && <PasswordForm done={() => setPasswordsOpen(false)} />}</section>
    <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 py-3 text-xs font-bold text-rose-600"><LogOut size={16} /> Sair da conta</button>
  </div>
}

function PasswordForm({ done }: { done: () => void }) {
  const [message, setMessage] = useState('')
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof passwordChangeSchema>>({ resolver: zodResolver(passwordChangeSchema) })
  const submit = handleSubmit(async (values) => { try { await clientApi('/api/profile/password', { method: 'POST', body: JSON.stringify(values) }); reset(); setMessage('Senha alterada com sucesso.'); window.setTimeout(done, 900) } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível alterar a senha.') } })
  return <form onSubmit={submit} className="mt-4 grid gap-2 border-t border-slate-100 pt-4"><label className="form-label">Senha atual<input {...register('currentPassword')} type="password" className="form-input" autoComplete="current-password" /></label>{errors.currentPassword && <p className="form-error">{errors.currentPassword.message}</p>}<label className="form-label">Nova senha<input {...register('newPassword')} type="password" className="form-input" autoComplete="new-password" /></label>{errors.newPassword && <p className="form-error">{errors.newPassword.message}</p>}{message && <p role="status" className="text-[9px] text-indigo-600">{message}</p>}<button disabled={isSubmitting} className="mt-1 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white disabled:opacity-50">{isSubmitting ? 'Alterando…' : 'Atualizar senha'}</button></form>
}

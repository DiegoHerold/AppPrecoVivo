import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

export const metadata: Metadata = {
  title: 'Fluxo de Compras',
  description: 'Entenda quanto você gastou e por que seu mês mudou.',
  applicationName: 'Fluxo de Compras',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Fluxo' },
  formatDetection: { telephone: false },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#635BFF',
  colorScheme: 'light',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><PwaRegister />{children}</body>
    </html>
  )
}

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fluxo de Compras',
    short_name: 'Fluxo',
    description: 'Análise pessoal de desembolso, consumo e estoque a partir das suas compras.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F6FA',
    theme_color: '#635BFF',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

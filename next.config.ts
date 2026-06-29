import type { NextConfig } from 'next'
import { networkInterfaces } from 'node:os'

const lanOrigins = Object.values(networkInterfaces()).flatMap((addresses) => addresses ?? []).filter((address) => address.family === 'IPv4' && !address.internal).map((address) => address.address)

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', ...lanOrigins],
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig

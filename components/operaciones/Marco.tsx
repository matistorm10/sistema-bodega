'use client'
import Link from 'next/link'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

// Marco común del módulo Operaciones. Por ahora solo el administrador tiene acceso.
export default function Marco({ titulo, volver = '/operaciones', volverTxt = '← Operaciones', ancho = 1100, children }: { titulo: string, volver?: string, volverTxt?: string, ancho?: number, children: React.ReactNode }) {
  const { usuario, cargando } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: `${ancho}px`, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href={volver} style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>{volverTxt}</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{titulo}</h1>
        </div>
        {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>
          : !esAdmin ? <p style={{ fontSize: '13px', color: '#999' }}>Este módulo está en construcción y por ahora es solo para administradores.</p>
          : children}
      </div>
    </main>
  )
}

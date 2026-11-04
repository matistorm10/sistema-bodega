'use client'
import Link from 'next/link'
import { fondoPagina, AZUL } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Operaciones() {
  const { usuario, cargando } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  if (cargando) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Inicio</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Operaciones</h1>
        </div>
        {!esAdmin ? <p style={{ fontSize: '13px', color: '#999' }}>Este módulo está en construcción y por ahora es solo para administradores.</p>
          : <p style={{ fontSize: '13px', color: '#667085' }}>Módulo en construcción.</p>}
      </div>
    </main>
  )
}

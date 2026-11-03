'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Módulo único de configuración: Faenas y asignaciones · Contratos y documentos · Descriptor de cargo
const TABS = [
  { href: '/hsec/jefatura/faenas', t: '🏗️ Faenas y asignaciones' },
  { href: '/hsec/jefatura/contratos', t: '📁 Contratos y documentos' },
  { href: '/hsec/jefatura/sso', t: '📋 Descriptor de cargo' },
]
export default function TabsConfig() {
  const ruta = usePathname() || ''
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
      {TABS.map(x => {
        const activo = ruta.startsWith(x.href)
        return <Link key={x.href} href={x.href} style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: `1px solid ${activo ? '#1B4F9C' : '#d0d5dd'}`, background: activo ? '#1B4F9C' : '#fff', color: activo ? '#fff' : '#344054' }}>{x.t}</Link>
      })}
    </div>
  )
}

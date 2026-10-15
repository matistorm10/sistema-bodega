'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { AZUL } from '@/lib/theme'

// Marco de la aplicación: en computador (pantalla ancha) muestra una barra lateral fija con los módulos.
// En celular y tablet pequeña no muestra nada y todo se ve exactamente como antes.

type Modulo = {
  clave: string, href: string, icon: string, label: string,
  rutas: string[], visible: boolean
}

const ANCHO = 236

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { usuario } = useUsuarioActual()
  const pathname = usePathname() || '/'
  const router = useRouter()

  const esLogin = pathname === '/login' || pathname === '/reset-password'
  if (esLogin || !usuario) return <>{children}</>

  const esAdmin = usuario.rol === 'admin'
  const modulos: Modulo[] = [
    {
      clave: 'bodega', href: '/bodega', icon: '📦', label: 'Bodega', visible: esAdmin || usuario.accesoBodega,
      rutas: ['/bodega', '/inventario', '/movimientos', '/arriendos', '/catalogo', '/ubicaciones'],
    },
    { clave: 'vehiculos', href: '/vehiculos', icon: '🚚', label: 'Vehículos y Maquinaria', visible: esAdmin || usuario.accesoVehiculos, rutas: ['/vehiculos'] },
    { clave: 'licitaciones', href: '/licitaciones', icon: '📋', label: 'Licitaciones', visible: esAdmin || usuario.accesoLicitaciones, rutas: ['/licitaciones'] },
    { clave: 'administracion', href: '/administracion', icon: '⚙️', label: 'Administración', visible: esAdmin, rutas: ['/administracion', '/usuarios'] },
  ].filter(m => m.visible)

  const dentroDe = (rutas: string[]) => rutas.some(r => pathname === r || pathname.startsWith(r + '/'))
  const esInicio = pathname === '/'
  const rolLegible = usuario.rol === 'admin' ? 'Administrador' : usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1).replace(/_/g, ' ')

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <style>{`
        .shell-side { display: none; }
        .shell-main { min-width: 0; flex: 1; }
        @media (min-width: 1024px) {
          .shell-side {
            display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; width: ${ANCHO}px;
            background: #fff; border-right: 1px solid #e2e6ed; z-index: 40; font-family: system-ui, sans-serif; overflow-y: auto;
          }
          .shell-main { margin-left: ${ANCHO}px; }
          .solo-movil { display: none !important; }
        }
        .shell-link { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 9px; text-decoration: none; color: #344054; font-size: 13.5px; transition: background .12s, color .12s; }
        .shell-link:hover { background: #f2f5fa; }
        .shell-link.activo { background: #E8F0FE; color: ${AZUL}; font-weight: 700; }
        .shell-salir:hover { color: ${AZUL} !important; text-decoration: underline; }
      `}</style>

      <aside className="shell-side" aria-label="Menú principal">
        <Link href="/" style={{ display: 'block', padding: '20px 16px 14px', textDecoration: 'none' }}>
          <img src="/logo-indeli.jpg" alt="Grupo Indeli" style={{ width: '100%', maxWidth: '190px', height: 'auto', borderRadius: '4px', border: '1px solid #e2e6ed', display: 'block' }} />
          <span style={{ display: 'block', marginTop: '8px', fontSize: '11px', fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sistema de gestión</span>
        </Link>

        <nav style={{ padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <Link href="/" className={'shell-link' + (esInicio ? ' activo' : '')}><span style={{ width: '20px', textAlign: 'center' }}>🏠</span>Inicio</Link>
          {modulos.map(m => {
            const activo = dentroDe(m.rutas)
            return (
              <div key={m.clave}>
                <Link href={m.href} className={'shell-link' + (activo ? ' activo' : '')}>
                  <span style={{ width: '20px', textAlign: 'center' }}>{m.icon}</span>{m.label}
                </Link>
              </div>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #eef1f6' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 600, margin: '0 0 1px', color: '#16213E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nombre}</p>
          <p style={{ fontSize: '10px', color: '#8a94a6', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{rolLegible}</p>
          <button onClick={cerrarSesion} className="shell-salir" style={{ fontSize: '12px', color: '#8a94a6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color .15s' }}>Cerrar sesión</button>
        </div>
      </aside>

      <div className="shell-main">{children}</div>
    </>
  )
}

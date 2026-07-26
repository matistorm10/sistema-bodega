'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

const AZUL = '#1B4F9C'

export default function Home() {
  const { usuario, cargando } = useUsuarioActual()
  const router = useRouter()

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const esAdmin = usuario?.rol === 'admin'

  const modulos = [
    { href:'/bodega', icon:'📦', label:'Bodega', desc:'Catálogo, inventario, movimientos, arriendos', visible: esAdmin || usuario?.accesoBodega },
    { href:'/vehiculos', icon:'🚚', label:'Vehículos y Maquinaria', desc:'Documentos, kilometraje y mantenciones', visible: esAdmin || usuario?.accesoVehiculos },
    { href:'/licitaciones', icon:'📋', label:'Licitaciones', desc:'Seguimiento de licitaciones y propuestas', visible: esAdmin || usuario?.accesoLicitaciones },
    { href:'/administracion', icon:'⚙️', label:'Administración', desc:'Usuarios, roles y permisos de acceso', visible: esAdmin },
  ].filter(m => m.visible)

  const rolLegible = (r?: string) => !r ? '' : r === 'admin' ? 'Administrador' : r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, ' ')

  return (
    <main style={{
      minHeight: '100vh',
      fontFamily: 'system-ui,sans-serif',
      background: '#EEF1F6',
      backgroundImage: `
        linear-gradient(rgba(27,79,156,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(27,79,156,0.05) 1px, transparent 1px)
      `,
      backgroundSize: '28px 28px',
    }}>
      <style>{`
        .tile:hover { box-shadow: 0 4px 14px rgba(16,24,40,0.08); border-color: #c7d3e6 !important; transform: translateY(-1px); }
        .tile { transition: box-shadow .15s, transform .15s, border-color .15s; }
        .signout:hover { color: ${AZUL} !important; text-decoration: underline; }
      `}</style>

      <div style={{maxWidth:'640px',margin:'0 auto',padding:'1.5rem'}}>
        <div style={{
          background:'#fff', borderRadius:'16px', padding:'1.25rem 1.5rem', marginBottom:'1.5rem',
          boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)',
        }}>
          <div style={{display:'flex', alignItems:'center', gap:'14px'}}>
            <img src="/logo-indeli.jpg" alt="Grupo Indeli" style={{height:'34px', width:'auto', borderRadius:'4px', border:'1px solid #e2e6ed', flexShrink:0}}/>
            <div style={{width:'1px', height:'30px', background:'#e2e6ed', flexShrink:0}}/>
            <div style={{minWidth:0}}>
              <h1 style={{fontSize:'16px',fontWeight:'700',margin:'0 0 2px',color:'#16213E',whiteSpace:'nowrap'}}>Sistema INDELI</h1>
              <p style={{fontSize:'11px',color:AZUL,margin:'0',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>Bodega · Vehículos · Licitaciones</p>
            </div>
          </div>
          {!cargando && usuario && (
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #eef1f6'}}>
              <div>
                <p style={{fontSize:'12px',fontWeight:'600',margin:'0 0 1px',color:'#16213E'}}>{usuario.nombre}</p>
                <p style={{fontSize:'10px',color:'#8a94a6',margin:'0',textTransform:'uppercase',letterSpacing:'0.5px'}}>{rolLegible(usuario.rol)}</p>
              </div>
              <button onClick={cerrarSesion} className="signout" style={{fontSize:'12px',color:'#8a94a6',background:'none',border:'none',cursor:'pointer',padding:'0',transition:'color .15s',whiteSpace:'nowrap'}}>Cerrar sesión</button>
            </div>
          )}
        </div>

        {!cargando && modulos.length === 0 && (
          <p style={{fontSize:'13px',color:'#999',textAlign:'center'}}>No tienes acceso a ningún módulo todavía. Pídele al administrador que te lo habilite.</p>
        )}

        <div style={{display:'grid',gap:'10px'}}>
          {modulos.map(item => (
            <Link key={item.href} href={item.href} style={{textDecoration:'none'}}>
              <div className="tile" style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'14px',padding:'16px 18px',cursor:'pointer',display:'flex',alignItems:'center',gap:'16px'}}>
                <div style={{
                  width:'48px', height:'48px', borderRadius:'12px', flexShrink:0,
                  background:'rgba(27,79,156,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px',
                }}>{item.icon}</div>
                <div>
                  <p style={{fontWeight:'700',fontSize:'16px',margin:'0 0 2px',color:'#16213E'}}>{item.label}</p>
                  <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>{item.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

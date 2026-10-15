'use client'
import Link from 'next/link'
import { fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

const AZUL = '#1B4F9C'

export default function Contabilidad() {
  const { usuario, cargando } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoContabilidad

  const secciones = [
    { href: '/rendiciones', icon: '🧾', label: 'Rendiciones', desc: 'Carga de boletas y facturas, fondos por rendir, aprobación y revisión', disponible: true },
    { href: '/guias', icon: '🚚', label: 'Guías de traslado', desc: 'Traslados internos de un punto a otro, con aprobación y correlativo interno', disponible: false },
  ]

  const cabecera = (
    <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
      <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
      <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Contabilidad</h1>
    </div>
  )

  if (cargando) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  if (!puedeAcceder) {
    return (
      <main style={fondoPagina}>
        <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
          {cabecera}
          <p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a este módulo. Pídele al administrador que te lo habilite en Usuarios.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'760px',margin:'0 auto'}}>
        {cabecera}
        <div style={{display:'grid',gap:'10px'}}>
          {secciones.map(item => (
            <Link key={item.href} href={item.disponible ? item.href : '/contabilidad'} style={{textDecoration:'none',color:'inherit',background:'#fff',border:'1px solid #e2e6ed',borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',opacity:item.disponible ? 1 : 0.75}}>
              <div style={{width:'40px',height:'40px',borderRadius:'10px',flexShrink:0,background:'rgba(27,79,156,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'19px'}}>{item.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:'700',fontSize:'14.5px',margin:'0 0 2px',color:'#16213E'}}>{item.label}</p>
                <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>{item.desc}</p>
              </div>
              {!item.disponible && <span style={{fontSize:'11px',padding:'3px 9px',borderRadius:'20px',background:'#fef7e0',color:'#986a00',whiteSpace:'nowrap'}}>Próximamente</span>}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

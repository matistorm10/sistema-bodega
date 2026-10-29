'use client'
import Link from 'next/link'
import { fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

const AZUL = '#1B4F9C'

export default function EspacioPrevencionista() {
  const { usuario, cargando } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puede = esAdmin || !!usuario?.esJefeHsec || !!usuario?.esPrevencionista

  const secciones = [
    { href: '/hsec/prevencionista/sso', icon: '📋', label: 'SSO Faena', desc: 'Descriptor de cargo, programa de liderazgo, informes diarios y semanales, stock de EPP' },
    { href: '/hsec/prevencionista/charlas', icon: '🗣️', label: 'Charlas y capacitaciones', desc: 'Registro de charlas con lista de asistentes' },
  ]

  if (cargando) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  return (
    <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'760px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
          <Link href="/hsec" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Prevención de Riesgo</Link>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Espacio del Prevencionista</h1>
        </div>
        {!puede ? <p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a esta sección. Pídele al administrador que te la habilite en Usuarios.</p> : (
          <div style={{display:'grid',gap:'10px'}}>
            {secciones.map(item => (
              <Link key={item.href} href={item.href} style={{textDecoration:'none',color:'inherit',background:'#fff',border:'1px solid #e2e6ed',borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'10px',flexShrink:0,background:'rgba(27,79,156,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'19px'}}>{item.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontWeight:'700',fontSize:'14.5px',margin:'0 0 2px',color:'#16213E'}}>{item.label}</p>
                  <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

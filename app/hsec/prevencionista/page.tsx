'use client'
import Link from 'next/link'
import { fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

const AZUL = '#1B4F9C'

export default function Pagina() {
  const { usuario, cargando } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puede = esAdmin || !!usuario?.esJefeHsec || !!usuario?.esPrevencionista

  if (cargando) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  return (
    <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'900px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
          <Link href="/hsec" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Prevención de Riesgo</Link>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Espacio del Prevencionista</h1>
        </div>
        {puede ? (
          <div style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'14px',padding:'28px 20px',textAlign:'center'}}>
            <p style={{fontSize:'28px',margin:'0 0 8px'}}>🦺</p>
            <p style={{fontWeight:'700',fontSize:'15px',margin:'0 0 4px',color:'#16213E'}}>Espacio del Prevencionista</p>
            <p style={{fontSize:'12.5px',color:'#667085',margin:'0'}}>En preparación: aquí cada prevencionista irá cargando la información de su faena.</p>
          </div>
        ) : (
          <p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a esta sección. Pídele al administrador que te la habilite en Usuarios.</p>
        )}
      </div>
    </main>
  )
}

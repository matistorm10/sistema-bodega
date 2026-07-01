import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function Ubicaciones() {
  const { data: ubicaciones } = await supabase
    .from('ubicaciones')
    .select('*')
    .order('tipo')

  const bodegas = ubicaciones?.filter(u => u.tipo === 'bodega') || []
  const faenas = ubicaciones?.filter(u => u.tipo === 'faena') || []

  return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem'}}>
        <Link href="/" style={{fontSize:'13px',color:'#1a73e8',textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Ubicaciones</h1>
      </div>

      <p style={{fontSize:'13px',color:'#666',margin:'0 0 1.25rem'}}>{bodegas.length} bodegas · {faenas.length} faenas</p>

      <h2 style={{fontSize:'15px',fontWeight:'600',margin:'0 0 8px'}}>Bodegas</h2>
      {bodegas.length === 0 && <p style={{fontSize:'13px',color:'#999'}}>Sin bodegas registradas.</p>}
      {bodegas.map(b => (
        <div key={b.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
          <p style={{fontWeight:'600',fontSize:'14px',margin:'0 0 2px'}}>{b.nombre}</p>
          <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'4px',background:'#e8f0fe',color:'#1a73e8'}}>Bodega</span>
        </div>
      ))}

      <h2 style={{fontSize:'15px',fontWeight:'600',margin:'1.25rem 0 8px'}}>Faenas / Obras</h2>
      {faenas.length === 0 && <p style={{fontSize:'13px',color:'#999'}}>Sin faenas registradas.</p>}
      {faenas.map(f => (
        <div key={f.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <p style={{fontWeight:'600',fontSize:'14px',margin:'0 0 2px'}}>{f.nombre}</p>
              {f.codigo && <p style={{fontSize:'12px',color:'#666',margin:'0 0 1px'}}>{f.codigo}{f.cliente ? ' · '+f.cliente : ''}</p>}
            </div>
            <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'4px',background:f.activa?'#e6f4ea':'#f1f3f4',color:f.activa?'#137333':'#666'}}>{f.activa?'Activa':'Cerrada'}</span>
          </div>
        </div>
      ))}

      <div style={{marginTop:'1.5rem',padding:'14px',background:'#f8f9fa',borderRadius:'12px',textAlign:'center'}}>
        <p style={{fontSize:'13px',color:'#666',margin:'0'}}>Para agregar ubicaciones, usa el panel de administración.</p>
      </div>
    </main>
  )
}
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function Catalogo() {
  const { data: categorias } = await supabase
    .from('categorias')
    .select('*, tipos(*)')
    .order('orden')

  return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem'}}>
        <Link href="/" style={{fontSize:'13px',color:'#1a73e8',textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Catálogo</h1>
      </div>
      <p style={{fontSize:'13px',color:'#666',margin:'0 0 1.5rem'}}>{categorias?.length} categorías · {categorias?.reduce((s,c)=>s+(c.tipos?.length||0),0)} tipos</p>

      {categorias?.map(cat => (
        <div key={cat.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <p style={{fontWeight:'600',fontSize:'14px',margin:'0'}}>{cat.nombre}</p>
            <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'#e8f0fe',color:'#1a73e8'}}>{cat.tipos?.length} tipos</span>
          </div>
          <div>
            {cat.tipos?.map((t:any) => (
              <p key={t.id} style={{fontSize:'12px',color:'#555',margin:'2px 0',paddingLeft:'8px',borderLeft:'2px solid #e0e0e0'}}>{t.nombre}</p>
            ))}
          </div>
        </div>
      ))}
    </main>
  )
}
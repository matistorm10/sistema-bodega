import Link from 'next/link'

export default function Home() {
  return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{marginBottom:'2rem'}}>
        <h1 style={{fontSize:'22px',fontWeight:'700',margin:'0 0 4px'}}>Sistema Bodega</h1>
        <p style={{fontSize:'13px',color:'#666',margin:'0'}}>INDELI Constructora</p>
      </div>

      <div style={{display:'grid',gap:'10px'}}>
        {[
          {href:'/catalogo',label:'📦 Catálogo',desc:'Categorías y tipos de herramientas'},
          {href:'/movimientos',label:'🔄 Movimientos',desc:'Ingresos, traslados y pérdidas'},
          {href:'/arriendos',label:'🏗 Arriendos',desc:'Equipos arrendados activos'},
          {href:'/ubicaciones',label:'📍 Ubicaciones',desc:'Bodegas y faenas'},
          {href:'/personal',label:'👥 Personal',desc:'Usuarios y accesos'},
        ].map(item => (
          <Link key={item.href} href={item.href} style={{textDecoration:'none'}}>
            <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'14px 16px',cursor:'pointer'}}>
              <p style={{fontWeight:'600',fontSize:'15px',margin:'0 0 2px',color:'#111'}}>{item.label}</p>
              <p style={{fontSize:'12px',color:'#666',margin:'0'}}>{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Home() {
  const { usuario, cargando } = useUsuarioActual()
  const router = useRouter()

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const items = [
    {href:'/catalogo',label:'📦 Catálogo',desc:'Categorías y tipos de herramientas'},
    {href:'/inventario',label:'📋 Inventario',desc:'Qué hay en cada bodega/faena, con su estado'},
    {href:'/movimientos',label:'🔄 Movimientos',desc:'Ingresos, traslados y pérdidas'},
    {href:'/arriendos',label:'🏗 Arriendos',desc:'Equipos arrendados activos'},
    {href:'/ubicaciones',label:'📍 Ubicaciones',desc:'Bodegas y faenas'},
    ...(usuario?.rol === 'admin' ? [{href:'/usuarios',label:'👥 Usuarios',desc:'Personas y sus permisos de acceso'}] : []),
  ]

  return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'2rem'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'700',margin:'0 0 4px'}}>Sistema Bodega</h1>
          <p style={{fontSize:'13px',color:'#666',margin:'0'}}>INDELI Constructora</p>
        </div>
        {!cargando && usuario && (
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:'12px',fontWeight:'600',margin:'0 0 2px'}}>{usuario.nombre}</p>
            <p style={{fontSize:'11px',color:'#999',margin:'0 0 4px'}}>{usuario.rol === 'admin' ? 'Administrador' : 'Bodeguero'}</p>
            <button onClick={cerrarSesion} style={{fontSize:'11px',color:'#1a73e8',background:'none',border:'none',cursor:'pointer',padding:'0'}}>Cerrar sesión</button>
          </div>
        )}
      </div>

      <div style={{display:'grid',gap:'10px'}}>
        {items.map(item => (
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

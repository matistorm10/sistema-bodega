'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Catalogo() {
  const { usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'

  const [categorias, setCategorias] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  const [nombreCatNueva, setNombreCatNueva] = useState('')
  const [creandoCat, setCreandoCat] = useState(false)

  const [editCatId, setEditCatId] = useState('')
  const [editCatNombre, setEditCatNombre] = useState('')

  const [nombreTipoNuevo, setNombreTipoNuevo] = useState<Record<string, string>>({})
  const [editTipoId, setEditTipoId] = useState('')
  const [editTipoNombre, setEditTipoNombre] = useState('')

  const cargar = () => {
    setCargando(true)
    supabase.from('categorias').select('*, tipos(*, productos(id))').order('orden').then(({data, error}) => {
      if (error) console.error('Error categorias:', error.message)
      setCategorias(data || [])
      setCargando(false)
    })
  }

  useEffect(() => { cargar() }, [])

  const totalTipos = categorias.reduce((s,c)=>s+(c.tipos?.length||0),0)

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}

  const crearCategoria = async () => {
    if (!nombreCatNueva.trim()) { alert('Ingresa un nombre.'); return }
    setCreandoCat(true)
    const ordenMax = categorias.reduce((m,c)=>Math.max(m, c.orden||0), 0)
    const { error, data } = await supabase.from('categorias').insert({ nombre: nombreCatNueva.trim(), orden: ordenMax + 1 }).select()
    setCreandoCat(false)
    if (error) { alert('No se pudo crear: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) en la tabla "categorias".'); return }
    setNombreCatNueva('')
    cargar()
  }

  const guardarCategoria = async (id: string) => {
    if (!editCatNombre.trim()) { alert('El nombre no puede estar vacío.'); return }
    const { error, data } = await supabase.from('categorias').update({ nombre: editCatNombre.trim() }).eq('id', id).select()
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) en la tabla "categorias".'); return }
    setEditCatId(''); setEditCatNombre('')
    cargar()
  }

  const eliminarCategoria = async (cat: any) => {
    if (cat.tipos?.length > 0) { alert(`No se puede eliminar "${cat.nombre}": todavía tiene ${cat.tipos.length} tipo(s) adentro. Elimina o mueve esos tipos primero.`); return }
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? No se puede deshacer.`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', cat.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  const crearTipo = async (catId: string) => {
    const nombre = (nombreTipoNuevo[catId] || '').trim()
    if (!nombre) { alert('Ingresa un nombre para el tipo.'); return }
    const { error, data } = await supabase.from('tipos').insert({ nombre, categoria_id: catId }).select()
    if (error) { alert('No se pudo crear: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) en la tabla "tipos".'); return }
    setNombreTipoNuevo(prev => ({ ...prev, [catId]: '' }))
    cargar()
  }

  const guardarTipo = async (id: string) => {
    if (!editTipoNombre.trim()) { alert('El nombre no puede estar vacío.'); return }
    const { error, data } = await supabase.from('tipos').update({ nombre: editTipoNombre.trim() }).eq('id', id).select()
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) en la tabla "tipos".'); return }
    setEditTipoId(''); setEditTipoNombre('')
    cargar()
  }

  const eliminarTipo = async (tipo: any) => {
    const enUso = tipo.productos?.length || 0
    if (enUso > 0) { alert(`No se puede eliminar "${tipo.nombre}": ${enUso} producto(s) del catálogo lo usan. Ese tipo ya está en uso en el inventario.`); return }
    if (!confirm(`¿Eliminar el tipo "${tipo.nombre}"? No se puede deshacer.`)) return
    const { error } = await supabase.from('tipos').delete().eq('id', tipo.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  return (
    <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Catálogo</h1>
      </div>
      <p style={{fontSize:'13px',color:'#666',margin:'0 0 1.5rem'}}>{categorias.length} categorías · {totalTipos} tipos</p>

      {esAdmin && (
        <div style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'12px 14px',marginBottom:'1.25rem'}}>
          <p style={{fontSize:'13px',fontWeight:'700',margin:'0 0 8px'}}>+ Nueva categoría</p>
          <div style={{display:'flex',gap:'8px'}}>
            <input value={nombreCatNueva} onChange={e=>setNombreCatNueva(e.target.value)} placeholder="Ej: Equipos de bombeo" style={{...inputStyle, flex:1}}/>
            <button onClick={crearCategoria} disabled={creandoCat} style={{padding:'8px 14px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:creandoCat?0.6:1}}>
              {creandoCat ? 'Creando...' : '+ Crear'}
            </button>
          </div>
        </div>
      )}

      {cargando && <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p>}

      {!cargando && categorias.map(cat => (
        <div key={cat.id} style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
          {editCatId === cat.id ? (
            <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
              <input value={editCatNombre} onChange={e=>setEditCatNombre(e.target.value)} style={{...inputStyle, flex:1}} autoFocus/>
              <button onClick={()=>guardarCategoria(cat.id)} style={{padding:'8px 12px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'12px',cursor:'pointer'}}>Guardar</button>
              <button onClick={()=>{setEditCatId('');setEditCatNombre('')}} style={{padding:'8px 12px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
            </div>
          ) : (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <p style={{fontWeight:'600',fontSize:'14px',margin:'0'}}>{cat.nombre}</p>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'rgba(27,79,156,0.08)',color:AZUL}}>{cat.tipos?.length} tipos</span>
                {esAdmin && <>
                  <button onClick={()=>{setEditCatId(cat.id);setEditCatNombre(cat.nombre)}} style={{padding:'4px 8px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',fontSize:'11px',cursor:'pointer'}}>Editar</button>
                  <button onClick={()=>eliminarCategoria(cat)} style={{padding:'4px 8px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',color:'#c5221f',fontSize:'11px',cursor:'pointer'}}>Eliminar</button>
                </>}
              </div>
            </div>
          )}

          <div>
            {cat.tipos?.map((t:any) => (
              <div key={t.id} style={{paddingLeft:'8px',borderLeft:'2px solid #e2e6ed',marginBottom:'4px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'6px'}}>
                {editTipoId === t.id ? (
                  <div style={{display:'flex',gap:'6px',flex:1,padding:'2px 0'}}>
                    <input value={editTipoNombre} onChange={e=>setEditTipoNombre(e.target.value)} style={{...inputStyle, flex:1, padding:'5px 8px'}} autoFocus/>
                    <button onClick={()=>guardarTipo(t.id)} style={{padding:'5px 10px',borderRadius:'6px',border:'none',background:AZUL,color:'#fff',fontSize:'11px',cursor:'pointer'}}>Guardar</button>
                    <button onClick={()=>{setEditTipoId('');setEditTipoNombre('')}} style={{padding:'5px 10px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',fontSize:'11px',cursor:'pointer'}}>Cancelar</button>
                  </div>
                ) : (
                  <>
                    <p style={{fontSize:'12px',color:'#555',margin:'2px 0'}}>{t.nombre}</p>
                    {esAdmin && <div style={{display:'flex',gap:'4px'}}>
                      <button onClick={()=>{setEditTipoId(t.id);setEditTipoNombre(t.nombre)}} style={{padding:'2px 6px',borderRadius:'5px',border:'0.5px solid #ddd',background:'#fff',fontSize:'10px',cursor:'pointer'}}>Editar</button>
                      <button onClick={()=>eliminarTipo(t)} style={{padding:'2px 6px',borderRadius:'5px',border:'0.5px solid #ddd',background:'#fff',color:'#c5221f',fontSize:'10px',cursor:'pointer'}}>Eliminar</button>
                    </div>}
                  </>
                )}
              </div>
            ))}
          </div>

          {esAdmin && (
            <div style={{display:'flex',gap:'6px',marginTop:'8px',paddingLeft:'8px'}}>
              <input
                value={nombreTipoNuevo[cat.id] || ''}
                onChange={e=>setNombreTipoNuevo(prev => ({ ...prev, [cat.id]: e.target.value }))}
                placeholder="Nuevo tipo..."
                style={{...inputStyle, flex:1, padding:'6px 8px', fontSize:'12px'}}
              />
              <button onClick={()=>crearTipo(cat.id)} style={{padding:'6px 10px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',color:AZUL,fontSize:'11px',fontWeight:'600',cursor:'pointer'}}>+ Tipo</button>
            </div>
          )}
        </div>
      ))}
      </div>
    </main>
  )
}

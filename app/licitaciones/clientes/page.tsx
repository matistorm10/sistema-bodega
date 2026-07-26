'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Clientes() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoLicitaciones

  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  const [nuevoCliente, setNuevoCliente] = useState('')
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [errorCliente, setErrorCliente] = useState('')

  const [editandoId, setEditandoId] = useState('')
  const [editNombre, setEditNombre] = useState('')

  const [nuevoLugar, setNuevoLugar] = useState<Record<string, string>>({})

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}

  const cargar = () => {
    setCargando(true)
    supabase.from('clientes').select('*, cliente_lugares(id, nombre)').order('nombre').then(({data, error}) => {
      if (error) console.error('Error clientes:', error.message)
      setClientes(data || [])
      setCargando(false)
    })
  }

  useEffect(() => { if (puedeAcceder) cargar() }, [puedeAcceder])

  const crearCliente = async () => {
    setErrorCliente('')
    if (!nuevoCliente.trim()) { setErrorCliente('Escribe un nombre.'); return }
    setCreandoCliente(true)
    const { error } = await supabase.from('clientes').insert({ nombre: nuevoCliente.trim() })
    setCreandoCliente(false)
    if (error) { setErrorCliente(error.code === '23505' ? 'Ya existe un cliente con ese nombre.' : 'No se pudo crear: ' + error.message); return }
    setNuevoCliente('')
    cargar()
  }

  const iniciarEdicion = (c: any) => { setEditandoId(c.id); setEditNombre(c.nombre) }

  const guardarEdicion = async (id: string) => {
    if (!editNombre.trim()) { alert('El nombre no puede estar vacío.'); return }
    const { error } = await supabase.from('clientes').update({ nombre: editNombre.trim() }).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setEditandoId('')
    cargar()
  }

  const eliminarCliente = async (c: any) => {
    const { count } = await supabase.from('licitaciones').select('id', { count: 'exact', head: true }).eq('cliente_id', c.id)
    if ((count || 0) > 0) { alert(`No se puede eliminar "${c.nombre}": tiene ${count} licitación(es) asociadas.`); return }
    if (!confirm(`¿Eliminar "${c.nombre}" y todos sus lugares? No se puede deshacer.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  const agregarLugar = async (clienteId: string) => {
    const nombre = (nuevoLugar[clienteId] || '').trim()
    if (!nombre) { alert('Escribe el nombre del lugar/faena.'); return }
    const { error } = await supabase.from('cliente_lugares').insert({ cliente_id: clienteId, nombre })
    if (error) { alert(error.code === '23505' ? 'Ese cliente ya tiene un lugar con ese nombre.' : 'No se pudo crear: ' + error.message); return }
    setNuevoLugar(prev => ({ ...prev, [clienteId]: '' }))
    cargar()
  }

  const eliminarLugar = async (lugar: any) => {
    const { count } = await supabase.from('licitaciones').select('id', { count: 'exact', head: true }).eq('cliente_lugar_id', lugar.id)
    if ((count || 0) > 0) { alert(`No se puede eliminar "${lugar.nombre}": tiene ${count} licitación(es) asociadas.`); return }
    if (!confirm(`¿Eliminar "${lugar.nombre}"?`)) return
    const { error } = await supabase.from('cliente_lugares').delete().eq('id', lugar.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  if (!puedeAcceder) {
    return (
      <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
        <p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a este módulo.</p>
      </div>
      </main>
    )
  }

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/licitaciones" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Licitaciones</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Clientes</h1>
      </div>

      <div style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'14px 16px',marginBottom:'1.25rem'}}>
        <p style={{fontSize:'13px',fontWeight:'700',margin:'0 0 8px'}}>+ Nuevo cliente</p>
        <div style={{display:'flex',gap:'8px'}}>
          <input value={nuevoCliente} onChange={e=>setNuevoCliente(e.target.value)} placeholder="Ej: SQM" style={{...inputStyle, flex:1}}/>
          <button onClick={crearCliente} disabled={creandoCliente} style={{padding:'8px 14px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:creandoCliente?0.6:1}}>
            {creandoCliente ? 'Creando...' : '+ Crear'}
          </button>
        </div>
        {errorCliente && <p style={{fontSize:'12px',color:'#c5221f',margin:'8px 0 0'}}>{errorCliente}</p>}
      </div>

      {cargando ? <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p> : clientes.length === 0 ? (
        <p style={{fontSize:'13px',color:'#999'}}>Sin clientes registrados.</p>
      ) : (
        <div style={{display:'grid',gap:'8px'}}>
          {clientes.map(c => (
            <div key={c.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px 14px'}}>
              {editandoId === c.id ? (
                <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                  <input value={editNombre} onChange={e=>setEditNombre(e.target.value)} style={{...inputStyle, flex:1}} autoFocus/>
                  <button onClick={()=>guardarEdicion(c.id)} style={{padding:'8px 12px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'12px',cursor:'pointer'}}>Guardar</button>
                  <button onClick={()=>setEditandoId('')} style={{padding:'8px 12px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
                </div>
              ) : (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                  <p style={{fontWeight:'700',fontSize:'14px',margin:'0'}}>{c.nombre}</p>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button onClick={()=>iniciarEdicion(c)} style={{fontSize:'11px',color:AZUL,background:'none',border:'none',cursor:'pointer',padding:'0'}}>Editar</button>
                    <button onClick={()=>eliminarCliente(c)} style={{fontSize:'11px',color:'#c5221f',background:'none',border:'none',cursor:'pointer',padding:'0'}}>Eliminar</button>
                  </div>
                </div>
              )}

              <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'8px'}}>
                {(c.cliente_lugares || []).map((l: any) => (
                  <span key={l.id} style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'12px',padding:'4px 6px 4px 10px',borderRadius:'20px',background:'#f1f3f4',color:'#444'}}>
                    📍 {l.nombre}
                    <button onClick={()=>eliminarLugar(l)} title="Eliminar" style={{border:'none',background:'none',cursor:'pointer',color:'#c5221f',fontSize:'13px',padding:'0 2px',lineHeight:1}}>×</button>
                  </span>
                ))}
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <input
                  value={nuevoLugar[c.id] || ''}
                  onChange={e=>setNuevoLugar(prev => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="Nuevo lugar/faena (ej: Tocopilla)"
                  style={{...inputStyle, flex:1, padding:'6px 8px', fontSize:'12px'}}
                />
                <button onClick={()=>agregarLugar(c.id)} style={{padding:'6px 10px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',color:AZUL,fontSize:'11px',fontWeight:'600',cursor:'pointer'}}>+ Lugar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </main>
  )
}

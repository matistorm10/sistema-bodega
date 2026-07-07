'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Ubicaciones() {
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  // Crear
  const [tipoNuevo, setTipoNuevo] = useState('bodega')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [codigoNuevo, setCodigoNuevo] = useState('')
  const [clienteNuevo, setClienteNuevo] = useState('')

  // Editar
  const [editId, setEditId] = useState('')
  const [editNombre, setEditNombre] = useState('')
  const [editCodigo, setEditCodigo] = useState('')
  const [editCliente, setEditCliente] = useState('')

  const cargar = () => {
    setCargando(true)
    supabase.from('ubicaciones').select('*').order('tipo').order('nombre').then(({data, error}) => {
      if (error) console.error('Error ubicaciones:', error.message)
      setUbicaciones(data || [])
      setCargando(false)
    })
  }

  useEffect(() => { cargar() }, [])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena')

  const crear = async () => {
    if (!nombreNuevo.trim()) { alert('Ingresa un nombre.'); return }
    const { error, data } = await supabase.from('ubicaciones').insert({
      nombre: nombreNuevo.trim(), tipo: tipoNuevo, activa: true,
      codigo: tipoNuevo === 'faena' ? (codigoNuevo || null) : null,
      cliente: tipoNuevo === 'faena' ? (clienteNuevo || null) : null
    }).select()
    if (error) { alert('No se pudo crear: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para insertar en la tabla "ubicaciones" en Supabase.'); return }
    setNombreNuevo(''); setCodigoNuevo(''); setClienteNuevo('')
    cargar()
  }

  const iniciarEdicion = (u: any) => {
    setEditId(u.id)
    setEditNombre(u.nombre)
    setEditCodigo(u.codigo || '')
    setEditCliente(u.cliente || '')
  }

  const cancelarEdicion = () => { setEditId(''); setEditNombre(''); setEditCodigo(''); setEditCliente('') }

  const guardarEdicion = async (u: any) => {
    if (!editNombre.trim()) { alert('El nombre no puede estar vacío.'); return }
    const { error, data } = await supabase.from('ubicaciones').update({
      nombre: editNombre.trim(),
      codigo: u.tipo === 'faena' ? (editCodigo || null) : u.codigo,
      cliente: u.tipo === 'faena' ? (editCliente || null) : u.cliente
    }).eq('id', u.id).select()
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "ubicaciones" en Supabase.'); return }
    cancelarEdicion()
    cargar()
  }

  const cerrar = async (u: any) => {
    const [{ count: cUnidades }, { count: cStock }, { count: cArriendos }] = await Promise.all([
      supabase.from('unidades').select('id', { count: 'exact', head: true }).eq('ubicacion_id', u.id).neq('estado', 'baja'),
      supabase.from('stock').select('id', { count: 'exact', head: true }).eq('ubicacion_id', u.id).gt('cantidad', 0),
      supabase.from('arriendos').select('id', { count: 'exact', head: true }).eq('ubicacion_id', u.id).eq('estado', 'activo')
    ])
    const total = (cUnidades || 0) + (cStock || 0) + (cArriendos || 0)
    if (total > 0) {
      alert(`No se puede cerrar "${u.nombre}": todavía tiene ${cUnidades || 0} herramienta(s) con código, ${cStock || 0} producto(s) a granel y ${cArriendos || 0} equipo(s) arrendado(s). Traslada todo primero (módulo Movimientos → Traslado).`)
      return
    }
    if (!confirm(`¿Cerrar "${u.nombre}"? Ya está vacía, así que es seguro. Podrás reactivarla después si es necesario.`)) return
    const { error, data } = await supabase.from('ubicaciones').update({ activa: false }).eq('id', u.id).select()
    if (error) { alert('No se pudo cerrar: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "ubicaciones" en Supabase.'); return }
    cargar()
  }

  const reactivar = async (u: any) => {
    const { error, data } = await supabase.from('ubicaciones').update({ activa: true }).eq('id', u.id).select()
    if (error) { alert('No se pudo reactivar: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "ubicaciones" en Supabase.'); return }
    cargar()
  }

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}

  const tarjeta = (u: any) => (
    <div key={u.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
      {editId === u.id ? (
        <div style={{marginBottom:'6px'}}>
          <div style={{marginBottom:'8px'}}>
            <label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Nombre</label>
            <input value={editNombre} onChange={e=>setEditNombre(e.target.value)} style={inputStyle} autoFocus/>
          </div>
          {u.tipo === 'faena' && <>
            <div style={{marginBottom:'8px'}}>
              <label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Código</label>
              <input value={editCodigo} onChange={e=>setEditCodigo(e.target.value)} placeholder="Ej: OBR-2026-14" style={inputStyle}/>
            </div>
            <div style={{marginBottom:'8px'}}>
              <label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Cliente</label>
              <input value={editCliente} onChange={e=>setEditCliente(e.target.value)} placeholder="Ej: Inmobiliaria Sur" style={inputStyle}/>
            </div>
          </>}
          <div style={{display:'flex',gap:'6px'}}>
            <button onClick={()=>guardarEdicion(u)} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:'#1a73e8',color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Guardar</button>
            <button onClick={cancelarEdicion} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
          <div>
            <p style={{fontWeight:'600',fontSize:'14px',margin:'0 0 2px'}}>{u.nombre}</p>
            {(u.codigo || u.cliente) && <p style={{fontSize:'12px',color:'#666',margin:'0 0 1px'}}>{u.codigo}{u.codigo && u.cliente ? ' · ' : ''}{u.cliente}</p>}
          </div>
          <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'4px',background:u.activa?'#e6f4ea':'#f1f3f4',color:u.activa?'#137333':'#666',whiteSpace:'nowrap'}}>{u.activa?'Activa':'Cerrada'}</span>
        </div>
      )}
      {editId !== u.id && (
        <div style={{display:'flex',gap:'6px'}}>
          <button onClick={()=>iniciarEdicion(u)} style={{padding:'6px 10px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',fontSize:'11px',cursor:'pointer'}}>Editar</button>
          {u.activa ? (
            <button onClick={()=>cerrar(u)} style={{padding:'6px 10px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',color:'#c5221f',fontSize:'11px',cursor:'pointer'}}>Cerrar</button>
          ) : (
            <button onClick={()=>reactivar(u)} style={{padding:'6px 10px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',color:'#137333',fontSize:'11px',cursor:'pointer'}}>Reactivar</button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem'}}>
        <Link href="/" style={{fontSize:'13px',color:'#1a73e8',textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Ubicaciones</h1>
      </div>

      <p style={{fontSize:'13px',color:'#666',margin:'0 0 1.25rem'}}>{bodegas.length} bodegas · {faenas.length} faenas</p>

      <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1.5rem'}}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>+ Nueva ubicación</p>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          {[{v:'bodega',l:'Bodega'},{v:'faena',l:'Faena / Obra'}].map(op => (
            <button key={op.v} type="button" onClick={()=>setTipoNuevo(op.v)} style={{flex:1,padding:'8px',borderRadius:'8px',border:tipoNuevo===op.v?'1.5px solid #1a73e8':'0.5px solid #ddd',background:tipoNuevo===op.v?'#e8f0fe':'#fff',color:tipoNuevo===op.v?'#1a73e8':'#444',fontSize:'13px',cursor:'pointer'}}>{op.l}</button>
          ))}
        </div>
        <div style={{marginBottom:'10px'}}>
          <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Nombre</label>
          <input value={nombreNuevo} onChange={e=>setNombreNuevo(e.target.value)} placeholder={tipoNuevo==='bodega' ? 'Ej: Bodega Norte' : 'Ej: Edificio Los Aromos'} style={inputStyle}/>
        </div>
        {tipoNuevo === 'faena' && <>
          <div style={{marginBottom:'10px'}}>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Código (opcional)</label>
            <input value={codigoNuevo} onChange={e=>setCodigoNuevo(e.target.value)} placeholder="Ej: OBR-2026-14" style={inputStyle}/>
          </div>
          <div style={{marginBottom:'10px'}}>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cliente (opcional)</label>
            <input value={clienteNuevo} onChange={e=>setClienteNuevo(e.target.value)} placeholder="Ej: Inmobiliaria Sur" style={inputStyle}/>
          </div>
        </>}
        <button onClick={crear} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:'#1a73e8',color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Crear</button>
      </div>

      {cargando && <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p>}

      {!cargando && <>
        <h2 style={{fontSize:'15px',fontWeight:'600',margin:'0 0 8px'}}>Bodegas</h2>
        {bodegas.length === 0 && <p style={{fontSize:'13px',color:'#999'}}>Sin bodegas registradas.</p>}
        {bodegas.map(tarjeta)}

        <h2 style={{fontSize:'15px',fontWeight:'600',margin:'1.25rem 0 8px'}}>Faenas / Obras</h2>
        {faenas.length === 0 && <p style={{fontSize:'13px',color:'#999'}}>Sin faenas registradas.</p>}
        {faenas.map(tarjeta)}
      </>}
    </main>
  )
}

'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Ubicaciones() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  // Crear
  const [tipoNuevo, setTipoNuevo] = useState('bodega')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const VACIO = { cliente: '', lugar: '', responsable_id: '', fecha_inicio: '', fecha_termino: '', observaciones: '' }
  const [detNuevo, setDetNuevo] = useState({ ...VACIO })
  const [usuarios, setUsuarios] = useState<any[]>([])

  // Editar
  const [editId, setEditId] = useState('')
  const [editNombre, setEditNombre] = useState('')
  const [detEdit, setDetEdit] = useState({ ...VACIO })

  const cargar = () => {
    setCargando(true)
    supabase.from('ubicaciones').select('*').order('tipo').order('nombre').then(({data, error}) => {
      if (error) console.error('Error ubicaciones:', error.message)
      setUbicaciones(data || [])
      setCargando(false)
    })
  }

  useEffect(() => { cargar(); supabase.from('usuarios').select('id,nombre').order('nombre').then(({data}) => setUsuarios(data || [])) }, [])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena')

  const detallesParaGuardar = (d: typeof VACIO) => ({
    cliente: d.cliente.trim() || null, lugar: d.lugar.trim() || null, responsable_id: d.responsable_id || null,
    fecha_inicio: d.fecha_inicio || null, fecha_termino: d.fecha_termino || null, observaciones: d.observaciones.trim() || null,
  })

  const crear = async () => {
    if (!nombreNuevo.trim()) { alert('Ingresa un nombre.'); return }
    const { error, data } = await supabase.from('ubicaciones').insert({
      nombre: nombreNuevo.trim(), tipo: tipoNuevo, activa: true,
      ...(tipoNuevo === 'faena' ? detallesParaGuardar(detNuevo) : {})
    }).select()
    if (error) { alert('No se pudo crear: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para insertar en la tabla "ubicaciones" en Supabase.'); return }
    setNombreNuevo(''); setDetNuevo({ ...VACIO })
    cargar()
  }

  const iniciarEdicion = (u: any) => {
    setEditId(u.id)
    setEditNombre(u.nombre)
    setDetEdit({ cliente: u.cliente || '', lugar: u.lugar || '', responsable_id: u.responsable_id || '', fecha_inicio: u.fecha_inicio || '', fecha_termino: u.fecha_termino || '', observaciones: u.observaciones || '' })
  }

  const cancelarEdicion = () => { setEditId(''); setEditNombre(''); setDetEdit({ ...VACIO }) }

  const guardarEdicion = async (u: any) => {
    if (!editNombre.trim()) { alert('El nombre no puede estar vacío.'); return }
    const { error, data } = await supabase.from('ubicaciones').update({
      nombre: editNombre.trim(),
      ...(u.tipo === 'faena' ? detallesParaGuardar(detEdit) : {})
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


  const camposCeco = (d: typeof VACIO, set: (v: typeof VACIO) => void, tam = '13px') => {
    const lab: React.CSSProperties = {fontSize:tam,color:'#555',display:'block',marginBottom:'4px'}
    const cambiar = (k: keyof typeof VACIO) => (e: any) => set({ ...d, [k]: e.target.value })
    return <>
      <div style={{marginBottom:'10px'}}>
        <label style={lab}>Cliente por defecto</label>
        <input value={d.cliente} onChange={cambiar('cliente')} placeholder="Ej: Engie" style={inputStyle}/>
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={lab}>Lugar / dirección</label>
        <input value={d.lugar} onChange={cambiar('lugar')} placeholder="Ej: Planta Tocopilla, Ruta 1 km 12" style={inputStyle}/>
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={lab}>Responsable (jefe de faena)</label>
        <select value={d.responsable_id} onChange={cambiar('responsable_id')} style={inputStyle}>
          <option value="">Sin asignar</option>
          {usuarios.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
      </div>
      <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
        <div style={{flex:1}}><label style={lab}>Inicio</label><input type="date" value={d.fecha_inicio} onChange={cambiar('fecha_inicio')} style={inputStyle}/></div>
        <div style={{flex:1}}><label style={lab}>Término estimado</label><input type="date" value={d.fecha_termino} onChange={cambiar('fecha_termino')} style={inputStyle}/></div>
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={lab}>Observaciones</label>
        <textarea value={d.observaciones} onChange={cambiar('observaciones')} rows={2} style={{...inputStyle,fontFamily:'inherit'}}/>
      </div>
    </>
  }

  const nombreUsuario = (id?: string|null) => usuarios.find(x => x.id === id)?.nombre
  const fechaCL = (f?: string|null) => f ? f.slice(0,10).split('-').reverse().join('-') : ''

  const tarjeta = (u: any) => (
    <div key={u.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
      {editId === u.id ? (
        <div style={{marginBottom:'6px'}}>
          <div style={{marginBottom:'8px'}}>
            <label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Nombre</label>
            <input value={editNombre} onChange={e=>setEditNombre(e.target.value)} style={inputStyle} autoFocus/>
          </div>
          {u.tipo === 'faena' && camposCeco(detEdit, setDetEdit, '12px')}
          <div style={{display:'flex',gap:'6px'}}>
            <button onClick={()=>guardarEdicion(u)} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Guardar</button>
            <button onClick={cancelarEdicion} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
          <div>
            <p style={{fontWeight:'600',fontSize:'14px',margin:'0 0 2px'}}>{u.nombre}</p>
            {u.tipo === 'faena' && u.cliente && <p style={{fontSize:'12px',color:'#666',margin:'0 0 1px'}}>Cliente: <b>{u.cliente}</b></p>}
            {u.tipo === 'faena' && u.lugar && <p style={{fontSize:'12px',color:'#666',margin:'0 0 1px'}}>📍 {u.lugar}</p>}
            {u.tipo === 'faena' && u.responsable_id && nombreUsuario(u.responsable_id) && <p style={{fontSize:'12px',color:'#666',margin:'0 0 1px'}}>Responsable: {nombreUsuario(u.responsable_id)}</p>}
            {u.tipo === 'faena' && (u.fecha_inicio || u.fecha_termino) && <p style={{fontSize:'12px',color:'#666',margin:'0 0 1px'}}>{u.fecha_inicio ? 'Inicio ' + fechaCL(u.fecha_inicio) : ''}{u.fecha_inicio && u.fecha_termino ? ' · ' : ''}{u.fecha_termino ? 'Término ' + fechaCL(u.fecha_termino) : ''}</p>}
            {u.tipo === 'faena' && u.observaciones && <p style={{fontSize:'12px',color:'#8a94a6',margin:'2px 0 0'}}>{u.observaciones}</p>}
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

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  if (usuario?.rol !== 'admin') {
    return (
      <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
          <Link href="/bodega" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Bodega</Link>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Centros de Costo (CECO)</h1>
        </div>
        <p style={{fontSize:'13px',color:'#999'}}>Esta sección es solo para administradores.</p>
      </div>
      </main>
    )
  }

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Centros de Costo (CECO)</h1>
      </div>

      <p style={{fontSize:'13px',color:'#666',margin:'0 0 1.25rem'}}>{bodegas.length} bodegas · {faenas.length} centros de costo</p>

      <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1.5rem'}}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>+ Nuevo centro de costo o bodega</p>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          {[{v:'bodega',l:'Bodega'},{v:'faena',l:'Centro de Costo (CECO)'}].map(op => (
            <button key={op.v} type="button" onClick={()=>setTipoNuevo(op.v)} style={{flex:1,padding:'8px',borderRadius:'8px',border:tipoNuevo===op.v?`1.5px solid ${AZUL}`:'0.5px solid #ddd',background:tipoNuevo===op.v?'#e8f0fe':'#fff',color:tipoNuevo===op.v?AZUL:'#444',fontSize:'13px',cursor:'pointer'}}>{op.l}</button>
          ))}
        </div>
        <div style={{marginBottom:'10px'}}>
          <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Nombre</label>
          <input value={nombreNuevo} onChange={e=>setNombreNuevo(e.target.value)} placeholder={tipoNuevo==='bodega' ? 'Ej: Bodega Norte' : 'Nombre del CECO (igual al de la faena). Ej: Engie Tocopilla'} style={inputStyle}/>
        </div>
        {tipoNuevo === 'faena' && camposCeco(detNuevo, setDetNuevo)}
        <button onClick={crear} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Crear</button>
      </div>

      {cargando && <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p>}

      {!cargando && <>
        <h2 style={{fontSize:'15px',fontWeight:'600',margin:'0 0 8px'}}>Bodegas</h2>
        {bodegas.length === 0 && <p style={{fontSize:'13px',color:'#999'}}>Sin bodegas registradas.</p>}
        {bodegas.map(tarjeta)}

        <h2 style={{fontSize:'15px',fontWeight:'600',margin:'1.25rem 0 8px'}}>Centros de Costo (CECO)</h2>
        {faenas.length === 0 && <p style={{fontSize:'13px',color:'#999'}}>Sin centros de costo registrados.</p>}
        {faenas.map(tarjeta)}
      </>}
    </div>
    </main>
  )
}

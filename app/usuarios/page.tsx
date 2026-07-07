'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Usuarios() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  // Form de creación
  const [nombre, setNombre] = useState('')
  const [cargo, setCargo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState('bodeguero')
  const [permisos, setPermisos] = useState<Record<string, {origen:boolean, destino:boolean}>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  // Edición de un usuario existente
  const [editandoId, setEditandoId] = useState('')
  const [editNombre, setEditNombre] = useState('')
  const [editCargo, setEditCargo] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editRol, setEditRol] = useState('bodeguero')
  const [editPermisos, setEditPermisos] = useState<Record<string, {origen:boolean, destino:boolean}>>({})
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState('')

  // Gestión de roles
  const [nuevoRol, setNuevoRol] = useState('')
  const [errorRol, setErrorRol] = useState('')
  const [creandoRol, setCreandoRol] = useState(false)

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase.from('usuarios').select('*, usuario_ubicaciones(ubicacion_id, puede_origen, puede_destino, ubicaciones(nombre))').order('nombre'),
      supabase.from('ubicaciones').select('*').order('tipo').order('nombre'),
      supabase.from('roles').select('*').order('nombre')
    ]).then(([{data: us, error: e1}, {data: ubs, error: e2}, {data: rs, error: e3}]) => {
      if (e1) console.error('Error usuarios:', e1.message)
      if (e2) console.error('Error ubicaciones:', e2.message)
      if (e3) console.error('Error roles:', e3.message)
      setUsuarios(us || [])
      setUbicaciones(ubs || [])
      setRoles(rs || [])
      setCargando(false)
    })
  }

  useEffect(() => { cargar() }, [])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena')

  const togglePermiso = (ubId: string, campo: 'origen'|'destino') => {
    setPermisos(prev => ({ ...prev, [ubId]: { origen: prev[ubId]?.origen || false, destino: prev[ubId]?.destino || false, [campo]: !prev[ubId]?.[campo] } }))
  }

  const toggleEditPermiso = (ubId: string, campo: 'origen'|'destino') => {
    setEditPermisos(prev => ({ ...prev, [ubId]: { origen: prev[ubId]?.origen || false, destino: prev[ubId]?.destino || false, [campo]: !prev[ubId]?.[campo] } }))
  }

  const crearUsuario = async () => {
    setError(''); setExito('')
    if (!nombre || !email || !password) { setError('Nombre, correo y contraseña son obligatorios.'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setGuardando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const permisosArr = Object.entries(permisos)
      .filter(([, v]) => v.origen || v.destino)
      .map(([ubicacion_id, v]) => ({ ubicacion_id, puede_origen: v.origen, puede_destino: v.destino }))
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ nombre, cargo, telefono, email, password, rol, permisos: permisosArr })
    })
    const json = await res.json()
    setGuardando(false)
    if (!res.ok) { setError(json.error || 'No se pudo crear el usuario.'); return }
    setExito(`${nombre} creado correctamente.`)
    setNombre(''); setCargo(''); setTelefono(''); setEmail(''); setPassword(''); setRol('bodeguero'); setPermisos({})
    cargar()
  }

  const iniciarEdicion = (u: any) => {
    setEditandoId(u.id)
    setEditNombre(u.nombre)
    setEditCargo(u.cargo || '')
    setEditTelefono(u.telefono || '')
    setEditRol(u.rol)
    const p: Record<string, {origen:boolean, destino:boolean}> = {}
    ;(u.usuario_ubicaciones || []).forEach((x: any) => { p[x.ubicacion_id] = { origen: x.puede_origen, destino: x.puede_destino } })
    setEditPermisos(p)
    setErrorEdicion('')
  }

  const cancelarEdicion = () => { setEditandoId(''); setErrorEdicion('') }

  const guardarEdicion = async (usuarioId: string) => {
    if (!editNombre.trim()) { setErrorEdicion('El nombre no puede estar vacío.'); return }
    setGuardandoEdicion(true)
    setErrorEdicion('')

    const { error: errPerfil } = await supabase.from('usuarios').update({
      nombre: editNombre.trim(), cargo: editCargo || null, telefono: editTelefono || null, rol: editRol
    }).eq('id', usuarioId)
    if (errPerfil) { setGuardandoEdicion(false); setErrorEdicion('No se pudo actualizar el perfil: ' + errPerfil.message); return }

    const { error: errDel } = await supabase.from('usuario_ubicaciones').delete().eq('usuario_id', usuarioId)
    if (errDel) { setGuardandoEdicion(false); setErrorEdicion('No se pudieron actualizar los permisos: ' + errDel.message); return }

    const filas = Object.entries(editPermisos)
      .filter(([, v]) => v.origen || v.destino)
      .map(([ubicacion_id, v]) => ({ usuario_id: usuarioId, ubicacion_id, puede_origen: v.origen, puede_destino: v.destino }))
    if (filas.length > 0) {
      const { error: errIns } = await supabase.from('usuario_ubicaciones').insert(filas)
      if (errIns) { setGuardandoEdicion(false); setErrorEdicion('No se pudieron guardar los permisos nuevos: ' + errIns.message); return }
    }

    setGuardandoEdicion(false)
    setEditandoId('')
    cargar()
  }

  const crearRol = async () => {
    setErrorRol('')
    const nombreLimpio = nuevoRol.trim().toLowerCase().replace(/\s+/g, '_')
    if (!nombreLimpio) { setErrorRol('Escribe un nombre para el rol.'); return }
    setCreandoRol(true)
    const { error } = await supabase.from('roles').insert({ nombre: nombreLimpio })
    setCreandoRol(false)
    if (error) { setErrorRol(error.code === '23505' ? 'Ya existe un rol con ese nombre.' : 'No se pudo crear: ' + error.message); return }
    setNuevoRol('')
    cargar()
  }

  const eliminarRol = async (nombreRol: string) => {
    if (nombreRol === 'admin') { alert('El rol "admin" no se puede eliminar.'); return }
    const enUso = usuarios.filter(u => u.rol === nombreRol).length
    if (enUso > 0) { alert(`No se puede eliminar el rol "${nombreRol}": ${enUso} usuario(s) lo tienen asignado. Cámbialos de rol primero.`); return }
    if (!confirm(`¿Eliminar el rol "${nombreRol}"? No se puede deshacer.`)) return
    const { error } = await supabase.from('roles').delete().eq('nombre', nombreRol)
    if (error) { alert('No se pudo eliminar: ' + (error.code === '23503' ? 'todavía hay usuarios con este rol.' : error.message)); return }
    cargar()
  }

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}

  const tablaPermisos = (valores: Record<string, {origen:boolean, destino:boolean}>, onToggle: (id: string, campo: 'origen'|'destino') => void) => (
    <div style={{border:'0.5px solid #eee',borderRadius:'8px',overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 70px 70px',background:'#f8f9fa',padding:'6px 10px',fontSize:'11px',color:'#666',fontWeight:'600'}}>
        <span>Ubicación</span><span style={{textAlign:'center'}}>Origen</span><span style={{textAlign:'center'}}>Destino</span>
      </div>
      {[...bodegas, ...faenas].map(u => (
        <div key={u.id} style={{display:'grid',gridTemplateColumns:'1fr 70px 70px',padding:'6px 10px',fontSize:'12px',borderTop:'0.5px solid #eee',alignItems:'center'}}>
          <span>{u.nombre}</span>
          <span style={{textAlign:'center'}}><input type="checkbox" checked={!!valores[u.id]?.origen} onChange={()=>onToggle(u.id,'origen')}/></span>
          <span style={{textAlign:'center'}}><input type="checkbox" checked={!!valores[u.id]?.destino} onChange={()=>onToggle(u.id,'destino')}/></span>
        </div>
      ))}
    </div>
  )

  const nombreRolLegible = (r: string) => r === 'admin' ? 'Administrador' : r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, ' ')

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  if (usuario?.rol !== 'admin') {
    return (
      <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
          <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Usuarios</h1>
        </div>
        <p style={{fontSize:'13px',color:'#999'}}>Esta sección es solo para administradores.</p>
      </div>
      </main>
    )
  }

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'700px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Usuarios</h1>
      </div>

      <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1.5rem'}}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>Roles</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
          {roles.map(r => (
            <span key={r.nombre} style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'12px',padding:'4px 6px 4px 10px',borderRadius:'20px',background:r.nombre==='admin'?'#fef7e0':'#f1f3f4',color:r.nombre==='admin'?'#986a00':'#444'}}>
              {nombreRolLegible(r.nombre)}
              {r.nombre !== 'admin' && (
                <button onClick={()=>eliminarRol(r.nombre)} title="Eliminar rol" style={{border:'none',background:'none',cursor:'pointer',color:'#c5221f',fontSize:'13px',padding:'0 2px',lineHeight:1}}>×</button>
              )}
            </span>
          ))}
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <input value={nuevoRol} onChange={e=>setNuevoRol(e.target.value)} placeholder="Ej: Supervisor" style={{...inputStyle, flex:1}}/>
          <button onClick={crearRol} disabled={creandoRol} style={{padding:'8px 14px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:creandoRol?0.6:1}}>
            {creandoRol ? 'Creando...' : '+ Rol'}
          </button>
        </div>
        {errorRol && <p style={{fontSize:'12px',color:'#c5221f',margin:'8px 0 0'}}>{errorRol}</p>}
        <p style={{fontSize:'11px',color:'#999',margin:'8px 0 0'}}>Un rol nuevo se comporta igual que "Bodeguero": queda restringido a las ubicaciones que le asignes. Solo "admin" tiene acceso total.</p>
      </div>

      <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1.5rem'}}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>+ Nuevo usuario</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          <div>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Juan Pérez" style={inputStyle}/>
          </div>
          <div>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cargo</label>
            <input value={cargo} onChange={e=>setCargo(e.target.value)} placeholder="Ej: Bodeguero" style={inputStyle}/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          <div>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Teléfono</label>
            <input value={telefono} onChange={e=>setTelefono(e.target.value)} placeholder="Ej: +56 9 1234 5678" style={inputStyle}/>
          </div>
          <div>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Rol</label>
            <select value={rol} onChange={e=>setRol(e.target.value)} style={inputStyle}>
              {roles.map(r => <option key={r.nombre} value={r.nombre}>{nombreRolLegible(r.nombre)}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          <div>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Correo (para iniciar sesión)</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Ej: juan@indeli.cl" style={inputStyle}/>
          </div>
          <div>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Contraseña temporal</label>
            <input type="text" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputStyle}/>
          </div>
        </div>

        {rol !== 'admin' && (
          <div style={{marginBottom:'10px'}}>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'6px'}}>Ubicaciones permitidas (marca si puede usarla como origen y/o destino en Traslado)</label>
            {tablaPermisos(permisos, togglePermiso)}
          </div>
        )}

        {error && <p style={{fontSize:'13px',color:'#c5221f',margin:'0 0 10px'}}>{error}</p>}
        {exito && <p style={{fontSize:'13px',color:'#137333',margin:'0 0 10px'}}>{exito}</p>}
        <button onClick={crearUsuario} disabled={guardando} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:guardando?0.6:1}}>
          {guardando ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>

      {cargando ? <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p> : (
        <>
          <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 8px'}}>Usuarios existentes ({usuarios.length})</p>
          {usuarios.map(u => (
            <div key={u.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px 14px',marginBottom:'8px'}}>
              {editandoId === u.id ? (
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                    <div>
                      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Nombre</label>
                      <input value={editNombre} onChange={e=>setEditNombre(e.target.value)} style={inputStyle}/>
                    </div>
                    <div>
                      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cargo</label>
                      <input value={editCargo} onChange={e=>setEditCargo(e.target.value)} style={inputStyle}/>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                    <div>
                      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Teléfono</label>
                      <input value={editTelefono} onChange={e=>setEditTelefono(e.target.value)} style={inputStyle}/>
                    </div>
                    <div>
                      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Rol</label>
                      <select value={editRol} onChange={e=>setEditRol(e.target.value)} style={inputStyle}>
                        {roles.map(r => <option key={r.nombre} value={r.nombre}>{nombreRolLegible(r.nombre)}</option>)}
                      </select>
                    </div>
                  </div>
                  {editRol !== 'admin' && (
                    <div style={{marginBottom:'10px'}}>
                      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'6px'}}>Ubicaciones permitidas</label>
                      {tablaPermisos(editPermisos, toggleEditPermiso)}
                    </div>
                  )}
                  {errorEdicion && <p style={{fontSize:'13px',color:'#c5221f',margin:'0 0 10px'}}>{errorEdicion}</p>}
                  <div style={{display:'flex',gap:'8px'}}>
                    <button onClick={()=>guardarEdicion(u.id)} disabled={guardandoEdicion} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:guardandoEdicion?0.6:1}}>
                      {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button onClick={cancelarEdicion} style={{padding:'8px 16px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'13px',cursor:'pointer'}}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <p style={{fontWeight:'600',fontSize:'14px',margin:'0 0 2px'}}>{u.nombre} {u.cargo ? `· ${u.cargo}` : ''}</p>
                      <p style={{fontSize:'12px',color:'#666',margin:'0 0 1px'}}>{u.email}{u.telefono ? ' · '+u.telefono : ''}</p>
                    </div>
                    <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'4px',background:u.rol==='admin'?'#fef7e0':'#e8f0fe',color:u.rol==='admin'?'#986a00':AZUL,whiteSpace:'nowrap'}}>{nombreRolLegible(u.rol)}</span>
                  </div>
                  {u.usuario_ubicaciones?.length > 0 && (
                    <div style={{marginTop:'6px',display:'flex',flexWrap:'wrap',gap:'4px'}}>
                      {u.usuario_ubicaciones.map((p: any) => (
                        <span key={p.ubicacion_id} style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'#f1f3f4',color:'#555'}}>
                          {p.ubicaciones?.nombre}{p.puede_origen && p.puede_destino ? ' (origen/destino)' : p.puede_origen ? ' (origen)' : p.puede_destino ? ' (destino)' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <button onClick={()=>iniciarEdicion(u)} style={{marginTop:'8px',padding:'6px 10px',borderRadius:'6px',border:'0.5px solid #ddd',background:'#fff',fontSize:'11px',cursor:'pointer'}}>Editar</button>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </div>
    </main>
  )
}

'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function DetalleLicitacion() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoLicitaciones

  const [lic, setLic] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [iteraciones, setIteraciones] = useState<any[]>([])
  const [consultasIteraciones, setConsultasIteraciones] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mostrarDatosGenerales, setMostrarDatosGenerales] = useState(false)

  const [f, setF] = useState<any>({})
  const set = (campo: string, valor: any) => setF((prev: any) => ({ ...prev, [campo]: valor }))

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}
  const card: React.CSSProperties = {background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1rem'}
  const label: React.CSSProperties = {fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}
  const checkboxLabel: React.CSSProperties = {display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'#333',cursor:'pointer'}

  const formatMiles = (v: any) => v === '' || v == null ? '' : Number(v).toLocaleString('es-CL')
  const parseMiles = (v: string) => v.replace(/\D/g, '')

  const ahora = new Date()

  // Campo de fecha y hora + su estado (Pendiente / Realizada / No realizada), con alerta si ya venció y sigue pendiente
  const campoFecha = (tituloTexto: string, campoFechaKey: string, campoEstadoKey: string) => {
    const fechaCompleta = f[campoFechaKey] || ''
    const [fechaParte, horaParteRaw] = fechaCompleta.split('T')
    const horaParte = horaParteRaw ? horaParteRaw.slice(0, 5) : ''
    const estado = f[campoEstadoKey] || 'pendiente'
    const vencidaSinResolver = fechaCompleta && new Date(fechaCompleta) < ahora && estado === 'pendiente'

    const actualizar = (nuevaFecha: string, nuevaHora: string) => {
      if (!nuevaFecha) { set(campoFechaKey, ''); return }
      set(campoFechaKey, nuevaHora ? `${nuevaFecha}T${nuevaHora}` : nuevaFecha)
    }

    return (
      <div>
        <label style={label}>{tituloTexto}</label>
        <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
          <input disabled={cerradaRef} type="date" value={fechaParte || ''} onChange={e=>actualizar(e.target.value, horaParte)} style={{...inputStyle, flex:1}}/>
          <input disabled={cerradaRef} type="time" value={horaParte} onChange={e=>actualizar(fechaParte || '', e.target.value)} style={{...inputStyle, width:'90px'}}/>
        </div>
        <select disabled={cerradaRef} value={estado} onChange={e=>set(campoEstadoKey, e.target.value)} style={{
          ...inputStyle, fontSize:'11px', padding:'5px 8px',
          color: vencidaSinResolver ? '#c5221f' : estado === 'realizada' ? '#137333' : estado === 'no_realizada' ? '#986a00' : '#666',
          fontWeight: vencidaSinResolver ? 700 : 400,
          background: vencidaSinResolver ? '#fce8e6' : '#fff',
        }}>
          <option value='pendiente'>{vencidaSinResolver ? '⚠️ Vencida — actualizar' : 'Pendiente'}</option>
          <option value='realizada'>Realizada</option>
          <option value='no_realizada'>No realizada</option>
          <option value='no_aplica'>No aplica</option>
        </select>
      </div>
    )
  }

  // Igual que campoFecha, pero sin selector de estado (para las ofertas)
  const campoFechaSimple = (campoFechaKey: string) => {
    const fechaCompleta = f[campoFechaKey] || ''
    const [fechaParte, horaParteRaw] = fechaCompleta.split('T')
    const horaParte = horaParteRaw ? horaParteRaw.slice(0, 5) : ''
    const actualizar = (nuevaFecha: string, nuevaHora: string) => {
      if (!nuevaFecha) { set(campoFechaKey, ''); return }
      set(campoFechaKey, nuevaHora ? `${nuevaFecha}T${nuevaHora}` : nuevaFecha)
    }
    return (
      <div style={{display:'flex',gap:'6px'}}>
        <input disabled={cerrada} type="date" value={fechaParte || ''} onChange={e=>actualizar(e.target.value, horaParte)} style={{...inputStyle, flex:1}}/>
        <input disabled={cerrada} type="time" value={horaParte} onChange={e=>actualizar(fechaParte || '', e.target.value)} style={{...inputStyle, width:'90px'}}/>
      </div>
    )
  }

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase.from('licitaciones').select('*, clientes(nombre), cliente_lugares(nombre)').eq('id', id).single(),
      supabase.from('clientes').select('*, cliente_lugares(id, nombre)').order('nombre'),
      supabase.from('licitacion_iteraciones').select('*').eq('licitacion_id', id).order('numero'),
      supabase.from('licitacion_historial').select('*').eq('licitacion_id', id).order('created_at', { ascending: false }),
      supabase.from('licitacion_consultas_iteraciones').select('*').eq('licitacion_id', id).order('numero'),
    ]).then(([licRes, clRes, itRes, hRes, ciRes]) => {
      if (licRes.error) console.error('Error licitacion:', licRes.error.message)
      setLic(licRes.data || null)
      setF(licRes.data || {})
      setClientes(clRes.data || [])
      setIteraciones(itRes.data || [])
      setHistorial(hRes.data || [])
      setConsultasIteraciones(ciRes.data || [])
      setCargando(false)
    })
  }

  useEffect(() => { if (id && puedeAcceder) cargar() }, [id, puedeAcceder])

  const lugaresDelCliente = clientes.find(c => c.id === f.cliente_id)?.cliente_lugares || []
  const cerrada = lic?.estado_final !== 'en_proceso'
  const cerradaRef = cerrada // usado dentro de campoFecha

  const guardarCambios = async () => {
    if (!f.nombre || !f.nombre.trim()) { alert('El nombre de la licitación no puede estar vacío.'); return }
    setGuardando(true)
    const { error } = await supabase.from('licitaciones').update({
      nombre: f.nombre.trim(),
      cliente_id: f.cliente_id || null, cliente_lugar_id: f.cliente_lugar_id || null,
      codigo_interno: f.codigo_interno || null,
      contacto_nombre: f.contacto_nombre || null, contacto_telefono: f.contacto_telefono || null, contacto_email: f.contacto_email || null,
      inicio_tentativo: f.inicio_tentativo || null, duracion_meses: f.duracion_meses !== '' && f.duracion_meses != null ? Number(f.duracion_meses) : null,
      fecha_invitacion: f.fecha_invitacion || null, estado_invitacion: f.estado_invitacion || 'pendiente',
      fecha_reunion_aclaratoria: f.fecha_reunion_aclaratoria || null, estado_reunion_aclaratoria: f.estado_reunion_aclaratoria || 'pendiente',
      fecha_visita_tecnica: f.fecha_visita_tecnica || null, estado_visita_tecnica: f.estado_visita_tecnica || 'pendiente', visita_responsable: f.visita_responsable || null,
      carta_excusa: !!f.carta_excusa,
      fecha_envio_consultas: f.fecha_envio_consultas || null, estado_envio_consultas: f.estado_envio_consultas || 'pendiente',
      fecha_recepcion_respuestas: f.fecha_recepcion_respuestas || null, estado_recepcion_respuestas: f.estado_recepcion_respuestas || 'pendiente',
      requiere_oferta_tecnica: !!f.requiere_oferta_tecnica,
      oferta_tecnica_decision: f.oferta_tecnica_decision || 'pendiente',
      fecha_oferta_tecnica: f.fecha_oferta_tecnica || null,
      oferta_tecnica_enviada: !!f.oferta_tecnica_enviada,
      fecha_oferta_economica: f.fecha_oferta_economica || null,
      oferta_economica_enviada: !!f.oferta_economica_enviada,
      monto_oferta: f.monto_oferta !== '' && f.monto_oferta != null ? Number(f.monto_oferta) : null,
      causa_no_adjudicacion: f.causa_no_adjudicacion || null,
      notas: f.notas || null,
    }).eq('id', id)
    setGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    cargar()
  }

  const [pidiendoComentario, setPidiendoComentario] = useState(false)
  const [comentarioGoNoGo, setComentarioGoNoGo] = useState('')

  const elegirGoNoGo = async (valor: string) => {
    if (valor === 'no_go') { setPidiendoComentario(true); return }
    set('go_no_go', valor)
    const { error } = await supabase.from('licitaciones').update({ go_no_go: valor }).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    cargar()
  }

  const confirmarNoGo = async () => {
    set('go_no_go', 'no_go')
    const { error } = await supabase.from('licitaciones').update({ go_no_go: 'no_go' }).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    await supabase.from('licitacion_historial').insert({
      licitacion_id: id, campo: 'go_no_go', valor_nuevo: 'no_go', comentario: comentarioGoNoGo.trim() || null, usuario: usuario?.nombre
    })
    setPidiendoComentario(false)
    setComentarioGoNoGo('')
    cargar()
  }

  const cerrarProceso = async (resultado: 'adjudicada' | 'no_adjudicada' | 'desierta') => {
    const texto = resultado === 'adjudicada' ? 'ADJUDICAR' : resultado === 'desierta' ? 'marcar como DESIERTA' : 'marcar como NO ADJUDICADA'
    if (!confirm(`¿Confirmas ${texto} esta licitación?`)) return
    setGuardando(true)
    const { error } = await supabase.from('licitaciones').update({ estado_final: resultado, fecha_cierre: new Date().toISOString().split('T')[0] }).eq('id', id)
    setGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    cargar()
  }

  const reabrirProceso = async () => {
    if (!confirm('¿Reabrir esta licitación para seguir editándola?')) return
    const { error } = await supabase.from('licitaciones').update({ estado_final: 'en_proceso', fecha_cierre: null }).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    cargar()
  }

  const [eliminando, setEliminando] = useState(false)
  const eliminarLicitacion = async () => {
    if (!confirm(`¿Eliminar por completo la licitación "${lic.nombre}"? Se borrará también su historial e iteraciones. No se puede deshacer.`)) return
    setEliminando(true)
    const { error } = await supabase.from('licitaciones').delete().eq('id', id)
    setEliminando(false)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    router.push('/licitaciones')
  }

  const [mostrarNuevaIteracion, setMostrarNuevaIteracion] = useState(false)
  const [itFecha, setItFecha] = useState(new Date().toISOString().split('T')[0])
  const [itMonto, setItMonto] = useState('')
  const [itNotas, setItNotas] = useState('')
  const [guardandoIt, setGuardandoIt] = useState(false)

  const agregarIteracion = async () => {
    setGuardandoIt(true)
    const numero = iteraciones.length + 1
    const { error } = await supabase.from('licitacion_iteraciones').insert({
      licitacion_id: id, numero, fecha: itFecha, monto: itMonto ? Number(itMonto) : null, notas: itNotas.trim() || null
    })
    setGuardandoIt(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setItFecha(new Date().toISOString().split('T')[0]); setItMonto(''); setItNotas('')
    setMostrarNuevaIteracion(false)
    cargar()
  }

  const eliminarIteracion = async (itId: string) => {
    if (!confirm('¿Eliminar esta iteración?')) return
    const { error } = await supabase.from('licitacion_iteraciones').delete().eq('id', itId)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  const [mostrarNuevaConsulta, setMostrarNuevaConsulta] = useState(false)
  const [ciFechaEnvio, setCiFechaEnvio] = useState(new Date().toISOString().split('T')[0])
  const [ciFechaRecepcion, setCiFechaRecepcion] = useState('')
  const [ciNotas, setCiNotas] = useState('')
  const [guardandoCi, setGuardandoCi] = useState(false)

  const agregarConsultaIteracion = async () => {
    setGuardandoCi(true)
    const numero = consultasIteraciones.length + 1
    const { error } = await supabase.from('licitacion_consultas_iteraciones').insert({
      licitacion_id: id, numero, fecha_envio: ciFechaEnvio || null, fecha_recepcion: ciFechaRecepcion || null, notas: ciNotas.trim() || null
    })
    setGuardandoCi(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setCiFechaEnvio(new Date().toISOString().split('T')[0]); setCiFechaRecepcion(''); setCiNotas('')
    setMostrarNuevaConsulta(false)
    cargar()
  }

  const eliminarConsultaIteracion = async (ciId: string) => {
    if (!confirm('¿Eliminar esta ronda de consultas?')) return
    const { error } = await supabase.from('licitacion_consultas_iteraciones').delete().eq('id', ciId)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  if (!puedeAcceder) {
    return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}><p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a este módulo.</p></div></main>
  }

  if (cargando || !lic) {
    return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'700px',margin:'0 auto'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>
  }

  const etiquetaCierre: Record<string, {t:string, bg:string, c:string}> = {
    adjudicada: { t: '✅ Adjudicada', bg: '#e6f4ea', c: '#137333' },
    no_adjudicada: { t: '❌ No adjudicada', bg: '#fce8e6', c: '#c5221f' },
    desierta: { t: '🚫 Desierta', bg: '#f1f3f4', c: '#666' },
  }

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'700px',margin:'0 auto'}}>
      <div style={{marginBottom:'1.25rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',marginBottom:'8px'}}>
          <Link href="/licitaciones" style={{fontSize:'13px',color:AZUL,textDecoration:'none',whiteSpace:'nowrap',flexShrink:0}}>← Licitaciones</Link>
          {esAdmin && (
            <button onClick={eliminarLicitacion} disabled={eliminando} style={{fontSize:'12px',color:'#c5221f',background:'none',border:'0.5px solid #f5c6c2',borderRadius:'6px',padding:'6px 12px',cursor:'pointer',opacity:eliminando?0.6:1,whiteSpace:'nowrap',flexShrink:0}}>
              {eliminando ? 'Eliminando...' : '🗑 Eliminar'}
            </button>
          )}
        </div>
        <h1 style={{fontSize:'18px',fontWeight:'600',margin:'0',wordBreak:'break-word'}}>{lic.nombre}</h1>
      </div>

      {cerrada && (
        <div style={{background: etiquetaCierre[lic.estado_final]?.bg, borderRadius:'12px', padding:'12px 16px', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <p style={{fontSize:'13px',fontWeight:'700',margin:'0',color: etiquetaCierre[lic.estado_final]?.c}}>
            {etiquetaCierre[lic.estado_final]?.t} — cerrada el {lic.fecha_cierre}
          </p>
          {esAdmin && <button onClick={reabrirProceso} style={{fontSize:'12px',color:'#555',background:'none',border:'0.5px solid #ccc',borderRadius:'6px',padding:'4px 10px',cursor:'pointer'}}>Reabrir</button>}
        </div>
      )}

      {/* DATOS GENERALES (desplegable) */}
      <div style={card}>
        <button onClick={()=>setMostrarDatosGenerales(!mostrarDatosGenerales)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',background:'none',border:'none',cursor:'pointer',padding:'0'}}>
          <p style={{fontSize:'14px',fontWeight:'700',margin:'0'}}>Datos generales</p>
          <span style={{fontSize:'13px',color:AZUL}}>{mostrarDatosGenerales ? '▾ Ocultar' : '▸ Mostrar'}</span>
        </button>
        {mostrarDatosGenerales && (
          <div style={{marginTop:'14px'}}>
            <div style={{marginBottom:'10px'}}>
              <label style={label}>Nombre de la licitación</label>
              <input disabled={cerrada} value={f.nombre || ''} onChange={e=>set('nombre', e.target.value)} style={inputStyle}/>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={label}>Código interno</label>
              <input disabled={cerrada} value={f.codigo_interno || ''} onChange={e=>set('codigo_interno', e.target.value)} style={inputStyle}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <label style={label}>Cliente</label>
                <select disabled={cerrada} value={f.cliente_id || ''} onChange={e=>{set('cliente_id', e.target.value); set('cliente_lugar_id', '')}} style={inputStyle}>
                  <option value=''>Sin asignar</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Lugar / Faena</label>
                <select disabled={cerrada || !f.cliente_id} value={f.cliente_lugar_id || ''} onChange={e=>set('cliente_lugar_id', e.target.value)} style={inputStyle}>
                  <option value=''>Sin asignar</option>
                  {lugaresDelCliente.map((l: any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={label}>Contacto</label><input disabled={cerrada} value={f.contacto_nombre || ''} onChange={e=>set('contacto_nombre', e.target.value)} style={inputStyle}/></div>
              <div><label style={label}>Teléfono</label><input disabled={cerrada} value={f.contacto_telefono || ''} onChange={e=>set('contacto_telefono', e.target.value)} style={inputStyle}/></div>
              <div><label style={label}>Email</label><input disabled={cerrada} value={f.contacto_email || ''} onChange={e=>set('contacto_email', e.target.value)} style={inputStyle}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              <div><label style={label}>Inicio tentativo</label><input disabled={cerrada} type="date" value={f.inicio_tentativo || ''} onChange={e=>set('inicio_tentativo', e.target.value)} style={inputStyle}/></div>
              <div><label style={label}>Duración (meses)</label><input disabled={cerrada} type="number" value={f.duracion_meses ?? ''} onChange={e=>set('duracion_meses', e.target.value)} style={inputStyle}/></div>
            </div>
          </div>
        )}
      </div>

      {/* GO / NO GO */}
      <div style={card}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 12px'}}>Decisión: ¿Vamos a esta licitación?</p>
        <div style={{display:'flex',gap:'8px',marginBottom: historial.length > 0 ? '10px' : '0'}}>
          {[{v:'go',l:'Go',c:'#137333'},{v:'no_go',l:'No Go',c:'#c5221f'}].map(op => (
            <button key={op.v} disabled={cerrada} onClick={()=>elegirGoNoGo(op.v)} style={{flex:1,padding:'10px',borderRadius:'8px',border: f.go_no_go===op.v ? `1.5px solid ${op.c}` : '0.5px solid #ddd',background: f.go_no_go===op.v ? op.c+'1a' : '#fff',color: f.go_no_go===op.v ? op.c : '#444',fontSize:'13px',fontWeight:'600',cursor: cerrada ? 'default' : 'pointer'}}>{op.l}</button>
          ))}
        </div>
        {!f.go_no_go || f.go_no_go === 'pendiente' ? <p style={{fontSize:'11px',color:'#999',margin:'6px 0 0'}}>Aún no se ha decidido.</p> : null}

        {pidiendoComentario && (
          <div style={{marginTop:'10px',padding:'12px',border:'1px solid #eee',borderRadius:'8px'}}>
            <label style={label}>¿Por qué "No Go"? (queda en el historial)</label>
            <textarea value={comentarioGoNoGo} onChange={e=>setComentarioGoNoGo(e.target.value)} rows={2} style={{...inputStyle, resize:'vertical', marginBottom:'8px'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={confirmarNoGo} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:'#c5221f',color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Confirmar No Go</button>
              <button onClick={()=>{setPidiendoComentario(false); setComentarioGoNoGo('')}} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>
        )}

        {historial.length > 0 && (
          <div style={{marginTop:'10px',display:'grid',gap:'6px'}}>
            {historial.map(h => (
              <div key={h.id} style={{background:'#f8f9fb',borderRadius:'8px',padding:'8px 12px'}}>
                <p style={{fontSize:'11px',color:'#666',margin:'0'}}>{new Date(h.created_at).toLocaleDateString('es-CL')} · {h.usuario || '—'}: marcó <b>{h.valor_nuevo === 'no_go' ? 'No Go' : h.valor_nuevo}</b>{h.comentario ? ` — "${h.comentario}"` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FECHAS DEL PROCESO */}
      <div style={card}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 12px'}}>Fechas del proceso</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          {campoFecha('Invitación a participar', 'fecha_invitacion', 'estado_invitacion')}
          {campoFecha('Reunión aclaratoria', 'fecha_reunion_aclaratoria', 'estado_reunion_aclaratoria')}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          {campoFecha('Visita técnica', 'fecha_visita_tecnica', 'estado_visita_tecnica')}
          <div><label style={label}>Quién fue / irá</label><input disabled={cerrada} value={f.visita_responsable || ''} onChange={e=>set('visita_responsable', e.target.value)} style={inputStyle}/></div>
        </div>
        <label style={{...checkboxLabel, marginBottom:'12px'}}><input disabled={cerrada} type="checkbox" checked={!!f.carta_excusa} onChange={e=>set('carta_excusa', e.target.checked)}/>Se envió carta excusa (no asistimos)</label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
          {campoFecha('Envío de consultas', 'fecha_envio_consultas', 'estado_envio_consultas')}
          {campoFecha('Recepción de respuestas', 'fecha_recepcion_respuestas', 'estado_recepcion_respuestas')}
        </div>

        <p style={{fontSize:'11px',fontWeight:'700',color:'#8a94a6',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 8px'}}>Rondas adicionales de consultas (si hubo más de una)</p>
        {consultasIteraciones.length === 0 ? (
          <p style={{fontSize:'12px',color:'#999',margin:'0 0 10px'}}>Sin rondas adicionales registradas.</p>
        ) : (
          <div style={{display:'grid',gap:'6px',marginBottom:'10px'}}>
            {consultasIteraciones.map(ci => (
              <div key={ci.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8f9fb',borderRadius:'8px',padding:'8px 12px'}}>
                <span style={{fontSize:'12px',color:'#444'}}>
                  Ronda {ci.numero} · Envío: {ci.fecha_envio || '—'} · Respuesta: {ci.fecha_recepcion || '—'}{ci.notas ? ` · ${ci.notas}` : ''}
                </span>
                {!cerrada && <button onClick={()=>eliminarConsultaIteracion(ci.id)} style={{border:'none',background:'none',color:'#c5221f',cursor:'pointer',fontSize:'13px'}}>×</button>}
              </div>
            ))}
          </div>
        )}
        {!cerrada && (
          mostrarNuevaConsulta ? (
            <div style={{border:'1px solid #eee',borderRadius:'8px',padding:'12px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={label}>Fecha de envío</label><input type="date" value={ciFechaEnvio} onChange={e=>setCiFechaEnvio(e.target.value)} style={inputStyle}/></div>
                <div><label style={label}>Fecha de respuesta</label><input type="date" value={ciFechaRecepcion} onChange={e=>setCiFechaRecepcion(e.target.value)} style={inputStyle}/></div>
              </div>
              <div style={{marginBottom:'10px'}}><label style={label}>Notas (opcional)</label><input value={ciNotas} onChange={e=>setCiNotas(e.target.value)} style={inputStyle}/></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={agregarConsultaIteracion} disabled={guardandoCi} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer',opacity:guardandoCi?0.6:1}}>{guardandoCi?'Guardando...':'Guardar ronda'}</button>
                <button onClick={()=>setMostrarNuevaConsulta(false)} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setMostrarNuevaConsulta(true)} style={{fontSize:'12px',color:AZUL,background:'none',border:'none',cursor:'pointer',padding:'0',fontWeight:'600'}}>+ Agregar nueva ronda de consultas</button>
          )
        )}
      </div>

      {/* OFERTA TÉCNICA */}
      <div style={card}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 12px'}}>Oferta técnica</p>
        <label style={{...checkboxLabel, marginBottom:'10px'}}><input disabled={cerrada} type="checkbox" checked={!!f.requiere_oferta_tecnica} onChange={e=>set('requiere_oferta_tecnica', e.target.checked)}/>Esta licitación pide oferta técnica</label>
        {f.requiere_oferta_tecnica && <>
          <div style={{marginBottom:'10px'}}>
            <label style={label}>¿Elaboramos la oferta técnica?</label>
            <div style={{display:'flex',gap:'8px'}}>
              {[{v:'elaborar',l:'Sí, la elaboraremos',c:'#137333'},{v:'no_enviar',l:'No, no la enviaremos',c:'#c5221f'}].map(op => (
                <button key={op.v} disabled={cerrada} onClick={()=>set('oferta_tecnica_decision', op.v)} style={{flex:1,padding:'8px',borderRadius:'8px',border: f.oferta_tecnica_decision===op.v ? `1.5px solid ${op.c}` : '0.5px solid #ddd',background: f.oferta_tecnica_decision===op.v ? op.c+'1a' : '#fff',color: f.oferta_tecnica_decision===op.v ? op.c : '#444',fontSize:'12px',fontWeight:'600',cursor: cerrada ? 'default' : 'pointer'}}>{op.l}</button>
              ))}
            </div>
          </div>
          {f.oferta_tecnica_decision === 'elaborar' && <>
            <div style={{marginBottom:'10px'}}><label style={label}>Fecha de envío</label>{campoFechaSimple('fecha_oferta_tecnica')}</div>
            <label style={checkboxLabel}><input disabled={cerrada} type="checkbox" checked={!!f.oferta_tecnica_enviada} onChange={e=>set('oferta_tecnica_enviada', e.target.checked)}/>Ya enviada</label>
          </>}
        </>}
      </div>

      {/* OFERTA ECONÓMICA */}
      <div style={card}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 12px'}}>Oferta económica</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          <div><label style={label}>Fecha de envío</label>{campoFechaSimple('fecha_oferta_economica')}</div>
          <div>
            <label style={label}>Monto ofertado ($)</label>
            <input disabled={cerrada} type="text" inputMode="numeric" value={formatMiles(f.monto_oferta)} onChange={e=>set('monto_oferta', parseMiles(e.target.value))} style={inputStyle}/>
          </div>
        </div>
        <label style={{...checkboxLabel, marginBottom:'14px'}}><input disabled={cerrada} type="checkbox" checked={!!f.oferta_economica_enviada} onChange={e=>set('oferta_economica_enviada', e.target.checked)}/>Ya enviada</label>

        <p style={{fontSize:'11px',fontWeight:'700',color:'#8a94a6',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 8px'}}>Iteraciones / renegociación</p>
        {iteraciones.length === 0 ? (
          <p style={{fontSize:'12px',color:'#999',margin:'0 0 10px'}}>Todavía no hay renegociaciones registradas.</p>
        ) : (
          <div style={{display:'grid',gap:'6px',marginBottom:'10px'}}>
            {iteraciones.map(it => (
              <div key={it.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8f9fb',borderRadius:'8px',padding:'8px 12px'}}>
                <span style={{fontSize:'12px',color:'#444'}}>Iteración {it.numero} · {it.fecha}{it.notas ? ` · ${it.notas}` : ''}</span>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <span style={{fontSize:'13px',fontWeight:'600'}}>{it.monto != null ? `$${Number(it.monto).toLocaleString('es-CL')}` : '—'}</span>
                  {!cerrada && <button onClick={()=>eliminarIteracion(it.id)} style={{border:'none',background:'none',color:'#c5221f',cursor:'pointer',fontSize:'13px'}}>×</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!cerrada && (
          mostrarNuevaIteracion ? (
            <div style={{border:'1px solid #eee',borderRadius:'8px',padding:'12px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={label}>Fecha</label><input type="date" value={itFecha} onChange={e=>setItFecha(e.target.value)} style={inputStyle}/></div>
                <div><label style={label}>Monto nuevo</label><input type="text" inputMode="numeric" value={formatMiles(itMonto)} onChange={e=>setItMonto(parseMiles(e.target.value))} style={inputStyle}/></div>
              </div>
              <div style={{marginBottom:'10px'}}><label style={label}>Notas (opcional)</label><input value={itNotas} onChange={e=>setItNotas(e.target.value)} style={inputStyle}/></div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={agregarIteracion} disabled={guardandoIt} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer',opacity:guardandoIt?0.6:1}}>{guardandoIt?'Guardando...':'Guardar iteración'}</button>
                <button onClick={()=>setMostrarNuevaIteracion(false)} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setMostrarNuevaIteracion(true)} style={{fontSize:'12px',color:AZUL,background:'none',border:'none',cursor:'pointer',padding:'0',fontWeight:'600'}}>+ Agregar iteración (2da, 3ra... vuelta)</button>
          )
        )}
      </div>

      {/* NOTAS Y CAUSA DE NO ADJUDICACIÓN */}
      <div style={card}>
        <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>Observaciones</p>
        <textarea disabled={cerrada} value={f.notas || ''} onChange={e=>set('notas', e.target.value)} rows={3} placeholder="Observaciones generales..." style={{...inputStyle, resize:'vertical', marginBottom: lic.estado_final === 'no_adjudicada' || f.causa_no_adjudicacion ? '10px' : '0'}}/>
        {(lic.estado_final === 'no_adjudicada' || f.causa_no_adjudicacion) && (
          <div>
            <label style={label}>Causa de no adjudicación</label>
            <input disabled={cerrada} value={f.causa_no_adjudicacion || ''} onChange={e=>set('causa_no_adjudicacion', e.target.value)} placeholder="Ej: Fuera de presupuesto" style={inputStyle}/>
          </div>
        )}
      </div>

      {/* BOTONES DE ACCIÓN */}
      {!cerrada && (
        <div style={{display:'flex',gap:'8px',marginBottom:'1rem'}}>
          <button onClick={guardarCambios} disabled={guardando} style={{flex:1,padding:'12px',borderRadius:'10px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'700',cursor:'pointer',opacity:guardando?0.6:1}}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button onClick={()=>router.push('/licitaciones')} style={{padding:'12px 20px',borderRadius:'10px',border:'0.5px solid #ddd',background:'#fff',fontSize:'14px',cursor:'pointer'}}>Volver</button>
        </div>
      )}

      {!cerrada && (
        <div style={card}>
          <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 4px'}}>Cerrar proceso</p>
          <p style={{fontSize:'12px',color:'#999',margin:'0 0 12px'}}>Cuando se resuelva la licitación, marca el resultado final. Guarda los cambios primero.</p>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>cerrarProceso('adjudicada')} style={{flex:1,padding:'10px',borderRadius:'8px',border:'none',background:'#137333',color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>✅ Adjudicada</button>
            <button onClick={()=>cerrarProceso('no_adjudicada')} style={{flex:1,padding:'10px',borderRadius:'8px',border:'none',background:'#c5221f',color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>❌ No adjudicada</button>
            <button onClick={()=>cerrarProceso('desierta')} style={{flex:1,padding:'10px',borderRadius:'8px',border:'none',background:'#666',color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>🚫 Desierta</button>
          </div>
        </div>
      )}
    </div>
    </main>
  )
}

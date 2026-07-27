'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Licitaciones() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoLicitaciones

  const [licitaciones, setLicitaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroEventoLicitacion, setFiltroEventoLicitacion] = useState('')
  const [filtroEventoTipo, setFiltroEventoTipo] = useState('')
  const [filtroGoNoGo, setFiltroGoNoGo] = useState('')
  const [filtroEstadoFinal, setFiltroEstadoFinal] = useState('')

  const [mostrarForm, setMostrarForm] = useState(false)
  const [codigoInterno, setCodigoInterno] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [lugarId, setLugarId] = useState('')
  const [nombreLic, setNombreLic] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoTelefono, setContactoTelefono] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase.from('licitaciones').select('*, clientes(nombre), cliente_lugares(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*, cliente_lugares(id, nombre)').order('nombre'),
    ]).then(([{data: ls, error: e1}, {data: cs, error: e2}]) => {
      if (e1) console.error('Error licitaciones:', e1.message)
      if (e2) console.error('Error clientes:', e2.message)
      setLicitaciones(ls || [])
      setClientes(cs || [])
      setCargando(false)
    })
  }

  useEffect(() => { if (puedeAcceder) cargar() }, [puedeAcceder])

  const lugaresDelCliente = clientes.find(c => c.id === clienteId)?.cliente_lugares || []

  const crear = async () => {
    setError('')
    if (!nombreLic.trim()) { setError('Ingresa el nombre de la licitación.'); return }
    setGuardando(true)
    const { error: err, data } = await supabase.from('licitaciones').insert({
      codigo_interno: codigoInterno.trim() || null,
      cliente_id: clienteId || null, cliente_lugar_id: lugarId || null, nombre: nombreLic.trim(),
      contacto_nombre: contactoNombre.trim() || null, contacto_telefono: contactoTelefono.trim() || null,
      contacto_email: contactoEmail.trim() || null, creado_por: usuario?.nombre,
    }).select().single()
    setGuardando(false)
    if (err) { setError('No se pudo crear: ' + err.message); return }
    setCodigoInterno(''); setClienteId(''); setLugarId(''); setNombreLic(''); setContactoNombre(''); setContactoTelefono(''); setContactoEmail('')
    setMostrarForm(false)
    cargar()
    if (data) window.location.href = `/licitaciones/${data.id}`
  }

  const totalGo = licitaciones.filter(l => l.go_no_go === 'go').length
  const totalNoGo = licitaciones.filter(l => l.go_no_go === 'no_go').length
  const totalAdjudicadas = licitaciones.filter(l => l.estado_final === 'adjudicada').length
  const totalNoAdjudicadas = licitaciones.filter(l => l.estado_final === 'no_adjudicada').length
  const totalDesiertas = licitaciones.filter(l => l.estado_final === 'desierta').length
  const totalEnProceso = licitaciones.filter(l => l.estado_final === 'en_proceso').length

  // Colores distintos por tipo de fecha, para diferenciarlas de un vistazo
  const coloresPorTipo: Record<string, string> = {
    'Invitación a participar': '#1B4F9C',
    'Reunión aclaratoria': '#8430ce',
    'Visita técnica': '#c77700',
    'Envío de consultas': '#0a7a8c',
    'Recepción de respuestas': '#137333',
    'Envío oferta técnica': '#b8590c',
    'Envío oferta económica': '#c5221f',
  }

  const eventos: { fecha: string, tipo: string, licitacion: any }[] = []
  licitaciones.forEach(l => {
    if (l.estado_final !== 'en_proceso') return
    if (l.fecha_invitacion && (l.estado_invitacion || 'pendiente') === 'pendiente') eventos.push({ fecha: l.fecha_invitacion, tipo: 'Invitación a participar', licitacion: l })
    if (l.fecha_reunion_aclaratoria && (l.estado_reunion_aclaratoria || 'pendiente') === 'pendiente') eventos.push({ fecha: l.fecha_reunion_aclaratoria, tipo: 'Reunión aclaratoria', licitacion: l })
    if (l.fecha_visita_tecnica && (l.estado_visita_tecnica || 'pendiente') === 'pendiente') eventos.push({ fecha: l.fecha_visita_tecnica, tipo: 'Visita técnica', licitacion: l })
    if (l.fecha_envio_consultas && (l.estado_envio_consultas || 'pendiente') === 'pendiente') eventos.push({ fecha: l.fecha_envio_consultas, tipo: 'Envío de consultas', licitacion: l })
    if (l.fecha_recepcion_respuestas && (l.estado_recepcion_respuestas || 'pendiente') === 'pendiente') eventos.push({ fecha: l.fecha_recepcion_respuestas, tipo: 'Recepción de respuestas', licitacion: l })
    if (l.requiere_oferta_tecnica && l.oferta_tecnica_decision === 'elaborar' && l.fecha_oferta_tecnica && !l.oferta_tecnica_enviada) eventos.push({ fecha: l.fecha_oferta_tecnica, tipo: 'Envío oferta técnica', licitacion: l })
    if (l.fecha_oferta_economica && !l.oferta_economica_enviada) eventos.push({ fecha: l.fecha_oferta_economica, tipo: 'Envío oferta económica', licitacion: l })
  })
  eventos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  const ahora = new Date()

  const licitacionesConEvento = licitaciones.filter(l => eventos.some(ev => ev.licitacion.id === l.id))
  const tiposDeEvento = Object.keys(coloresPorTipo)

  const eventosFiltrados = eventos
    .filter(ev => !filtroEventoLicitacion || ev.licitacion.id === filtroEventoLicitacion)
    .filter(ev => !filtroEventoTipo || ev.tipo === filtroEventoTipo)
  const eventosVencidos = eventosFiltrados.filter(ev => new Date(ev.fecha) < ahora)
  const eventosProximos = eventosFiltrados.filter(ev => new Date(ev.fecha) >= ahora)

  const formatFecha = (iso: string) => {
    const tieneHora = iso.includes('T')
    const [fechaParte, horaParte] = iso.split('T')
    const [y, m, d] = fechaParte.split('-')
    const hora = tieneHora ? horaParte.slice(0, 5) : null
    return { fecha: `${d}-${m}-${y}`, hora: hora && hora !== '00:00' ? hora : null }
  }

  const filaEvento = (ev: { fecha: string, tipo: string, licitacion: any }, i: number, vencido: boolean) => {
    const { fecha, hora } = formatFecha(ev.fecha)
    return (
      <Link key={i} href={`/licitaciones/${ev.licitacion.id}`} style={{textDecoration:'none',display:'block',minWidth:0,width:'100%'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',fontSize:'12px',padding:'8px 10px',borderRadius:'8px',background: vencido ? '#fce8e6' : '#f8f9fb',borderLeft:`3px solid ${coloresPorTipo[ev.tipo] || '#999'}`,width:'100%',boxSizing:'border-box'}}>
          <span style={{color:'#333',flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            <span style={{fontWeight:700,color:coloresPorTipo[ev.tipo] || '#666'}}>{ev.tipo}</span> · {ev.licitacion.nombre}
          </span>
          <span style={{display:'flex',alignItems:'center',flexShrink:0}}>
            <span style={{fontWeight:'600',color: vencido ? '#c5221f' : '#444'}}>{fecha}</span>
            <span style={{fontWeight:'400',color:'#999',marginLeft:'6px',width:'34px',textAlign:'left',visibility: hora ? 'visible' : 'hidden'}}>{hora || '00:00'}</span>
          </span>
        </div>
      </Link>
    )
  }

  const etiquetaGoNoGo = (v: string) => v === 'go' ? { t: 'Go', bg: '#e6f4ea', c: '#137333' } : v === 'no_go' ? { t: 'No Go', bg: '#fce8e6', c: '#c5221f' } : { t: 'Sin decidir', bg: '#f1f3f4', c: '#666' }
  const etiquetaFinal = (v: string) => v === 'adjudicada' ? { t: 'Adjudicada', bg: '#e6f4ea', c: '#137333' } : v === 'no_adjudicada' ? { t: 'No adjudicada', bg: '#fce8e6', c: '#c5221f' } : v === 'desierta' ? { t: 'Desierta', bg: '#f1f3f4', c: '#666' } : { t: 'En proceso', bg: '#e8f0fe', c: AZUL }

  const licitacionesFiltradas = licitaciones
    .filter(l => !filtroCliente || l.cliente_id === filtroCliente)
    .filter(l => !filtroGoNoGo || l.go_no_go === filtroGoNoGo)
    .filter(l => !filtroEstadoFinal || l.estado_final === filtroEstadoFinal)

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  if (!puedeAcceder) {
    return (
      <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
          <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Licitaciones</h1>
        </div>
        <p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a este módulo. Pídele al administrador que te lo habilite en Usuarios.</p>
      </div>
      </main>
    )
  }

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'800px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Licitaciones</h1>
        </div>
        <Link href="/licitaciones/clientes" style={{fontSize:'12px',color:AZUL,textDecoration:'none',fontWeight:'600'}}>⚙️ Clientes</Link>
      </div>

      {cargando ? <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p> : (
        <>
          <p style={{fontSize:'12px',fontWeight:'700',color:'#8a94a6',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 8px'}}>Decisión Go / No Go</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'1.25rem'}}>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:'#137333'}}>{totalGo}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>Go</p>
            </div>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:'#c5221f'}}>{totalNoGo}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>No Go</p>
            </div>
          </div>

          <p style={{fontSize:'12px',fontWeight:'700',color:'#8a94a6',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 8px'}}>Resultado final</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'10px',marginBottom:'1.25rem'}}>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:'#137333'}}>{totalAdjudicadas}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>Adjudicadas</p>
            </div>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:'#c5221f'}}>{totalNoAdjudicadas}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>No adjudicadas</p>
            </div>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:'#666'}}>{totalDesiertas}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>Desiertas</p>
            </div>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:AZUL}}>{totalEnProceso}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>En proceso</p>
            </div>
          </div>

          {eventos.length > 0 && (
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1rem',background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <div style={{minWidth:'200px',flex:1}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Filtrar fechas por proyecto</label>
                <select value={filtroEventoLicitacion} onChange={e=>setFiltroEventoLicitacion(e.target.value)} style={inputStyle}>
                  <option value=''>Todos los proyectos</option>
                  {licitacionesConEvento.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div style={{minWidth:'200px',flex:1}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Filtrar fechas por etapa</label>
                <select value={filtroEventoTipo} onChange={e=>setFiltroEventoTipo(e.target.value)} style={inputStyle}>
                  <option value=''>Todas las etapas</option>
                  {tiposDeEvento.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}

          {eventosVencidos.length > 0 && (
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',marginBottom:'1.25rem',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)',border:'1px solid #f5c6c2'}}>
              <p style={{fontSize:'13px',fontWeight:'700',margin:'0 0 8px',color:'#c5221f'}}>⚠️ Fechas vencidas sin resolver</p>
              <div style={{display:'grid',gap:'6px'}}>
                {eventosVencidos.map((ev, i) => filaEvento(ev, i, true))}
              </div>
            </div>
          )}

          {eventosProximos.length > 0 && (
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',marginBottom:'1.25rem',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'13px',fontWeight:'700',margin:'0 0 8px'}}>📅 Próximas fechas</p>
              <div style={{display:'grid',gap:'6px'}}>
                {eventosProximos.map((ev, i) => filaEvento(ev, i, false))}
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1.25rem',background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
            <div style={{minWidth:'180px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cliente</label>
              <select value={filtroCliente} onChange={e=>setFiltroCliente(e.target.value)} style={inputStyle}>
                <option value=''>Todos</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{minWidth:'150px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Go / No Go</label>
              <select value={filtroGoNoGo} onChange={e=>setFiltroGoNoGo(e.target.value)} style={inputStyle}>
                <option value=''>Todos</option>
                <option value='go'>Go</option>
                <option value='no_go'>No Go</option>
              </select>
            </div>
            <div style={{minWidth:'150px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Resultado</label>
              <select value={filtroEstadoFinal} onChange={e=>setFiltroEstadoFinal(e.target.value)} style={inputStyle}>
                <option value=''>Todos</option>
                <option value='en_proceso'>En proceso</option>
                <option value='adjudicada'>Adjudicada</option>
                <option value='no_adjudicada'>No adjudicada</option>
                <option value='desierta'>Desierta</option>
              </select>
            </div>
          </div>

          <button onClick={()=>setMostrarForm(!mostrarForm)} style={{width:'100%',padding:'10px',borderRadius:'10px',border:`1.5px dashed ${AZUL}`,background:'#fff',color:AZUL,fontSize:'13px',fontWeight:'600',cursor:'pointer',marginBottom:'1rem'}}>
            {mostrarForm ? '– Cerrar formulario' : '+ Nueva licitación'}
          </button>

          {mostrarForm && (
            <div style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'16px',marginBottom:'1.25rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Código interno</label>
                  <input value={codigoInterno} onChange={e=>setCodigoInterno(e.target.value)} placeholder="Ej: 476" style={inputStyle}/>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Nombre de la licitación</label>
                  <input value={nombreLic} onChange={e=>setNombreLic(e.target.value)} placeholder="Ej: Mantención flota liviana 2026" style={inputStyle}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cliente</label>
                  <select value={clienteId} onChange={e=>{setClienteId(e.target.value); setLugarId('')}} style={inputStyle}>
                    <option value=''>Sin asignar</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Lugar / Faena</label>
                  <select value={lugarId} onChange={e=>setLugarId(e.target.value)} style={inputStyle} disabled={!clienteId}>
                    <option value=''>Sin asignar</option>
                    {lugaresDelCliente.map((l: any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              </div>
              {!clienteId && <p style={{fontSize:'11px',color:'#999',margin:'-6px 0 10px'}}>¿No aparece el cliente que buscas? <Link href="/licitaciones/clientes" style={{color:AZUL}}>Créalo aquí</Link>.</p>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Contacto</label><input value={contactoNombre} onChange={e=>setContactoNombre(e.target.value)} style={inputStyle}/></div>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Teléfono</label><input value={contactoTelefono} onChange={e=>setContactoTelefono(e.target.value)} style={inputStyle}/></div>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Email</label><input value={contactoEmail} onChange={e=>setContactoEmail(e.target.value)} style={inputStyle}/></div>
              </div>
              {error && <p style={{fontSize:'13px',color:'#c5221f',margin:'0 0 10px'}}>{error}</p>}
              <button onClick={crear} disabled={guardando} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:guardando?0.6:1}}>
                {guardando ? 'Creando...' : 'Crear y abrir ficha'}
              </button>
            </div>
          )}

          {licitacionesFiltradas.length === 0 ? (
            <p style={{fontSize:'13px',color:'#999'}}>No hay licitaciones registradas con este filtro.</p>
          ) : (
            <div style={{display:'grid',gap:'8px'}}>
              {licitacionesFiltradas.map(l => {
                const goNoGo = etiquetaGoNoGo(l.go_no_go)
                const final = etiquetaFinal(l.estado_final)
                return (
                  <Link key={l.id} href={`/licitaciones/${l.id}`} style={{textDecoration:'none',display:'block',minWidth:0,width:'100%'}}>
                    <div className="tile" style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',width:'100%',boxSizing:'border-box'}}>
                      <div style={{flex:1,minWidth:0,overflow:'hidden'}}>
                        <p style={{fontWeight:'700',fontSize:'14px',margin:'0 0 2px',color:'#16213E',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.codigo_interno ? `[${l.codigo_interno}] ` : ''}{l.nombre}</p>
                        <p style={{fontSize:'12px',color:'#667085',margin:'0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[l.clientes?.nombre, l.cliente_lugares?.nombre].filter(Boolean).join(' · ') || 'Sin cliente asignado'}</p>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                        <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:goNoGo.bg,color:goNoGo.c}}>{goNoGo.t}</span>
                        <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:final.bg,color:final.c}}>{final.t}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
    </main>
  )
}

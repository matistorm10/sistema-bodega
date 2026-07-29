'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function Vehiculos() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoVehiculos

  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [tiposVehiculo, setTiposVehiculo] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  // Filtros
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPropiedad, setFiltroPropiedad] = useState('')

  // Gestión de tipos de vehículo (solo admin)
  const [mostrarTipos, setMostrarTipos] = useState(false)
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [creandoTipo, setCreandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')

  // Crear vehículo
  const [mostrarForm, setMostrarForm] = useState(false)
  const [patente, setPatente] = useState('')
  const [codigoInterno, setCodigoInterno] = useState('')
  const [tipo, setTipo] = useState('')
  const [propiedad, setPropiedad] = useState('propio')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [anio, setAnio] = useState('')
  const [tipoMedicion, setTipoMedicion] = useState('km')
  const [lecturaInicial, setLecturaInicial] = useState('')
  const [ubicacionId, setUbicacionId] = useState('')
  const [limiteKm, setLimiteKm] = useState('')
  const [limiteAnios, setLimiteAnios] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase.from('vehiculos').select('*, ubicaciones(nombre)').order('created_at', { ascending: false }),
      supabase.from('ubicaciones').select('*').eq('activa', true).order('tipo').order('nombre'),
      supabase.from('vehiculo_documentos').select('*, vehiculos(patente, codigo_interno, tipo)').order('fecha_vencimiento'),
      supabase.from('vehiculo_tipos').select('*').order('nombre'),
    ]).then(([{data: vs, error: e1}, {data: ubs, error: e2}, {data: docs, error: e3}, {data: tvs, error: e4}]) => {
      if (e1) console.error('Error vehiculos:', e1.message)
      if (e2) console.error('Error ubicaciones:', e2.message)
      if (e3) console.error('Error documentos:', e3.message)
      if (e4) console.error('Error tipos vehiculo:', e4.message)
      setVehiculos(vs || [])
      setUbicaciones(ubs || [])
      setDocumentos(docs || [])
      setTiposVehiculo(tvs || [])
      setCargando(false)
    })
  }

  useEffect(() => { if (puedeAcceder) cargar() }, [puedeAcceder])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena')

  const crearTipo = async () => {
    setErrorTipo('')
    if (!nuevoTipo.trim()) { setErrorTipo('Escribe un nombre.'); return }
    setCreandoTipo(true)
    const { error } = await supabase.from('vehiculo_tipos').insert({ nombre: nuevoTipo.trim() })
    setCreandoTipo(false)
    if (error) { setErrorTipo(error.code === '23505' ? 'Ya existe ese tipo.' : 'No se pudo crear: ' + error.message); return }
    setNuevoTipo('')
    cargar()
  }

  const eliminarTipo = async (nombre: string) => {
    const enUso = vehiculos.filter(v => v.tipo === nombre).length
    if (enUso > 0) { alert(`No se puede eliminar "${nombre}": ${enUso} vehículo(s) lo tienen asignado.`); return }
    if (!confirm(`¿Eliminar el tipo "${nombre}"? No se puede deshacer.`)) return
    const { error } = await supabase.from('vehiculo_tipos').delete().eq('nombre', nombre)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  const crear = async () => {
    setError('')
    if (!tipo) { setError('Elige un tipo.'); return }
    setGuardando(true)
    const { error: err, data } = await supabase.from('vehiculos').insert({
      patente: patente.trim() || null,
      codigo_interno: codigoInterno.trim() || null,
      tipo,
      propiedad,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      anio: anio ? Number(anio) : null,
      tipo_medicion: tipoMedicion,
      lectura_actual: lecturaInicial ? Number(lecturaInicial) : 0,
      ubicacion_id: ubicacionId || null,
      limite_km: limiteKm ? Number(limiteKm) : null,
      limite_anios: limiteAnios ? Number(limiteAnios) : null,
    }).select().single()
    setGuardando(false)
    if (err) { setError('No se pudo crear: ' + err.message); return }
    if (lecturaInicial && data) {
      await supabase.from('vehiculo_lecturas').insert({ vehiculo_id: data.id, valor: Number(lecturaInicial), registrado_por: usuario?.nombre })
    }
    setPatente(''); setCodigoInterno(''); setTipo(''); setPropiedad('propio'); setMarca(''); setModelo(''); setAnio('')
    setTipoMedicion('km'); setLecturaInicial(''); setUbicacionId(''); setLimiteKm(''); setLimiteAnios('')
    setMostrarForm(false)
    cargar()
  }

  const hoy = new Date()
  const en30dias = new Date(hoy.getTime() + 30 * 86400000)

  const documentosVencidos = documentos.filter(d => new Date(d.fecha_vencimiento) < hoy)
  const documentosPorVencer = documentos.filter(d => {
    const f = new Date(d.fecha_vencimiento)
    return f >= hoy && f <= en30dias
  })
  const documentosVigentes = documentos.filter(d => new Date(d.fecha_vencimiento) > en30dias)

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}
  const formatFecha = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}-${m}-${y}`
  }

  const vehiculosFiltrados = vehiculos
    .filter(v => !filtroUbicacion || v.ubicacion_id === filtroUbicacion)
    .filter(v => !filtroEstado || v.estado === filtroEstado)
    .filter(v => !filtroPropiedad || v.propiedad === filtroPropiedad)

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif'}}><p style={{fontSize:'13px',color:'#999'}}>Cargando...</p></div></main>

  if (!puedeAcceder) {
    return (
      <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
          <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Vehículos y Maquinaria</h1>
        </div>
        <p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a este módulo. Pídele al administrador que te lo habilite en Usuarios.</p>
      </div>
      </main>
    )
  }

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'800px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Vehículos y Maquinaria</h1>
      </div>

      {cargando ? <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p> : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'1.25rem'}}>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:documentosVencidos.length>0?'#c5221f':'#16213E'}}>{documentosVencidos.length}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>Vencidos</p>
            </div>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:documentosPorVencer.length>0?'#986a00':'#16213E'}}>{documentosPorVencer.length}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>Por vencer (30 días)</p>
            </div>
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'24px',fontWeight:'700',margin:'0 0 2px',color:'#137333'}}>{documentosVigentes.length}</p>
              <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>Vigentes</p>
            </div>
          </div>

          {(documentosVencidos.length > 0 || documentosPorVencer.length > 0) && (
            <div style={{background:'#fff',borderRadius:'14px',padding:'14px 16px',marginBottom:'1.25rem',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
              <p style={{fontSize:'13px',fontWeight:'700',margin:'0 0 8px'}}>⚠️ Alertas de documentos</p>
              <div style={{display:'grid',gap:'6px'}}>
                {[...documentosVencidos, ...documentosPorVencer].map(d => (
                  <Link key={d.id} href={`/vehiculos/${d.vehiculo_id}?tab=Documentos`} style={{textDecoration:'none'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px',padding:'8px 10px',borderRadius:'8px',background: new Date(d.fecha_vencimiento) < hoy ? '#fce8e6' : '#fef7e0'}}>
                      <span style={{color:'#333'}}>{d.vehiculos?.tipo} · {d.vehiculos?.patente || d.vehiculos?.codigo_interno} · {d.tipo_documento}</span>
                      <span style={{fontWeight:'600',color: new Date(d.fecha_vencimiento) < hoy ? '#c5221f' : '#986a00'}}>{formatFecha(d.fecha_vencimiento)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1.25rem',background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
            <div style={{minWidth:'200px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Ubicación</label>
              <select value={filtroUbicacion} onChange={e=>setFiltroUbicacion(e.target.value)} style={inputStyle}>
                <option value=''>Todas las ubicaciones</option>
                <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
                <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
              </select>
            </div>
            <div style={{minWidth:'160px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Estado</label>
              <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)} style={inputStyle}>
                <option value=''>Todos</option>
                <option value='activo'>Activo</option>
                <option value='fuera_servicio'>Fuera de servicio</option>
              </select>
            </div>
            <div style={{minWidth:'160px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Propiedad</label>
              <select value={filtroPropiedad} onChange={e=>setFiltroPropiedad(e.target.value)} style={inputStyle}>
                <option value=''>Todos</option>
                <option value='propio'>Propios</option>
                <option value='tercero'>Terceros</option>
              </select>
            </div>
          </div>

          {esAdmin && (
            <div style={{marginBottom:'1rem'}}>
              <button onClick={()=>setMostrarTipos(!mostrarTipos)} style={{fontSize:'12px',color:AZUL,background:'none',border:'none',cursor:'pointer',padding:'0',fontWeight:'600'}}>
                {mostrarTipos ? '– Ocultar gestión de tipos' : '⚙️ Gestionar tipos de vehículo'}
              </button>
              {mostrarTipos && (
                <div style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'14px 16px',marginTop:'8px'}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
                    {tiposVehiculo.map(t => (
                      <span key={t.nombre} style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'12px',padding:'4px 6px 4px 10px',borderRadius:'20px',background:'#f1f3f4',color:'#444'}}>
                        {t.nombre}
                        <button onClick={()=>eliminarTipo(t.nombre)} title="Eliminar" style={{border:'none',background:'none',cursor:'pointer',color:'#c5221f',fontSize:'13px',padding:'0 2px',lineHeight:1}}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <input value={nuevoTipo} onChange={e=>setNuevoTipo(e.target.value)} placeholder="Ej: Grúa Horquilla" style={{...inputStyle, flex:1}}/>
                    <button onClick={crearTipo} disabled={creandoTipo} style={{padding:'8px 14px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:creandoTipo?0.6:1}}>
                      {creandoTipo ? 'Creando...' : '+ Tipo'}
                    </button>
                  </div>
                  {errorTipo && <p style={{fontSize:'12px',color:'#c5221f',margin:'8px 0 0'}}>{errorTipo}</p>}
                </div>
              )}
            </div>
          )}

          <button onClick={()=>setMostrarForm(!mostrarForm)} style={{width:'100%',padding:'10px',borderRadius:'10px',border:`1.5px dashed ${AZUL}`,background:'#fff',color:AZUL,fontSize:'13px',fontWeight:'600',cursor:'pointer',marginBottom:'1rem'}}>
            {mostrarForm ? '– Cerrar formulario' : '+ Nuevo vehículo / maquinaria'}
          </button>

          {mostrarForm && (
            <div style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'16px',marginBottom:'1.25rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Patente</label>
                  <input value={patente} onChange={e=>setPatente(e.target.value)} placeholder="Ej: ABCD-12" style={inputStyle}/>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Código interno (si no tiene patente)</label>
                  <input value={codigoInterno} onChange={e=>setCodigoInterno(e.target.value)} placeholder="Ej: EXC-03" style={inputStyle}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label>
                  <select value={tipo} onChange={e=>setTipo(e.target.value)} style={inputStyle}>
                    <option value=''>Selecciona un tipo...</option>
                    {tiposVehiculo.map(t => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Propiedad</label>
                  <select value={propiedad} onChange={e=>setPropiedad(e.target.value)} style={inputStyle}>
                    <option value='propio'>Propio</option>
                    <option value='tercero'>Tercero</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Marca</label>
                  <input value={marca} onChange={e=>setMarca(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Modelo</label>
                  <input value={modelo} onChange={e=>setModelo(e.target.value)} style={inputStyle}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Año</label>
                  <input type="number" value={anio} onChange={e=>setAnio(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Mide en</label>
                  <select value={tipoMedicion} onChange={e=>setTipoMedicion(e.target.value)} style={inputStyle}>
                    <option value='km'>Kilómetros</option>
                    <option value='horas'>Horas (horómetro)</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Lectura inicial ({tipoMedicion})</label>
                  <input type="number" value={lecturaInicial} onChange={e=>setLecturaInicial(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Ubicación</label>
                  <select value={ubicacionId} onChange={e=>setUbicacionId(e.target.value)} style={inputStyle}>
                    <option value=''>Sin asignar</option>
                    <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
                    <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Límite estándar (km) — opcional</label>
                  <input type="number" value={limiteKm} onChange={e=>setLimiteKm(e.target.value)} placeholder="Ej: 150000" style={inputStyle}/>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Límite estándar (años) — opcional</label>
                  <input type="number" value={limiteAnios} onChange={e=>setLimiteAnios(e.target.value)} placeholder="Ej: 10" style={inputStyle}/>
                </div>
              </div>
              {error && <p style={{fontSize:'13px',color:'#c5221f',margin:'0 0 10px'}}>{error}</p>}
              <button onClick={crear} disabled={guardando} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:guardando?0.6:1}}>
                {guardando ? 'Creando...' : 'Crear'}
              </button>
            </div>
          )}

          {vehiculosFiltrados.length === 0 ? (
            <p style={{fontSize:'13px',color:'#999'}}>No hay vehículos registrados con este filtro.</p>
          ) : (
            <div style={{display:'grid',gap:'8px'}}>
              {vehiculosFiltrados.map(v => {
                const docsVehiculo = documentos.filter(d => d.vehiculo_id === v.id)
                const tieneVencido = docsVehiculo.some(d => new Date(d.fecha_vencimiento) < hoy)
                const tienePorVencer = docsVehiculo.some(d => { const f = new Date(d.fecha_vencimiento); return f >= hoy && f <= en30dias })
                return (
                  <Link key={v.id} href={`/vehiculos/${v.id}`} style={{textDecoration:'none'}}>
                    <div className="tile" style={{background: v.propiedad === 'tercero' ? '#FEF7E0' : '#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <p style={{fontWeight:'700',fontSize:'14px',margin:'0 0 2px',color:'#16213E'}}>
                          {v.patente || v.codigo_interno || 'Sin identificar'} · {v.tipo}
                        </p>
                        <p style={{fontSize:'12px',color:'#667085',margin:'0'}}>
                          {[v.marca, v.modelo, v.anio].filter(Boolean).join(' ')} · {Number(v.lectura_actual).toLocaleString('es-CL')} {v.tipo_medicion} · {v.ubicaciones?.nombre || 'Sin ubicación'}
                        </p>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        {tieneVencido && <span title="Documento vencido" style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'#fce8e6',color:'#c5221f'}}>Vencido</span>}
                        {!tieneVencido && tienePorVencer && <span title="Documento por vencer" style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'#fef7e0',color:'#986a00'}}>Por vencer</span>}
                        {v.estado === 'fuera_servicio' && <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'#f1f3f4',color:'#666'}}>Fuera de servicio</span>}
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

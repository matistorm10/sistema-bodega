'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

const TABS = ['Datos', 'Documentos', 'Kilometraje', 'Mantenciones']

export default function DetalleVehiculo() {
  const params = useParams()
  const id = params.id as string
  const { usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoVehiculos

  const [tab, setTab] = useState('Datos')
  const searchParams = useSearchParams()
  useEffect(() => {
    const tabUrl = searchParams.get('tab')
    if (tabUrl && TABS.includes(tabUrl)) setTab(tabUrl)
  }, [searchParams])
  const [vehiculo, setVehiculo] = useState<any>(null)
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [lecturas, setLecturas] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [mantenciones, setMantenciones] = useState<any[]>([])
  const [tiposDocumento, setTiposDocumento] = useState<any[]>([])
  const [historialDocs, setHistorialDocs] = useState<Record<string, any[]>>({})
  const [cargando, setCargando] = useState(true)

  const inputStyle: React.CSSProperties = {width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}
  const formatFecha = (iso: string) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}-${m}-${y}`
  }

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase.from('vehiculos').select('*, ubicaciones(nombre)').eq('id', id).single(),
      supabase.from('ubicaciones').select('*').eq('activa', true).order('tipo').order('nombre'),
      supabase.from('vehiculo_lecturas').select('*').eq('vehiculo_id', id).order('fecha'),
      supabase.from('vehiculo_documentos').select('*').eq('vehiculo_id', id).order('fecha_vencimiento', { ascending: false }),
      supabase.from('vehiculo_mantenciones').select('*').eq('vehiculo_id', id).order('fecha', { ascending: false }),
      supabase.from('vehiculo_tipos_documento').select('*').order('nombre'),
    ]).then(([vRes, ubRes, lecRes, docRes, manRes, tdRes]) => {
      if (vRes.error) console.error('Error vehiculo:', vRes.error.message)
      setVehiculo(vRes.data || null)
      setUbicaciones(ubRes.data || [])
      setLecturas(lecRes.data || [])
      setDocumentos(docRes.data || [])
      setMantenciones(manRes.data || [])
      setTiposDocumento(tdRes.data || [])
      setCargando(false)
    })
  }

  useEffect(() => { if (id && puedeAcceder) cargar() }, [id, puedeAcceder])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena')

  // ================= DATOS =================
  const [editando, setEditando] = useState(false)
  const [fPatente, setFPatente] = useState('')
  const [fCodigo, setFCodigo] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fMarca, setFMarca] = useState('')
  const [fModelo, setFModelo] = useState('')
  const [fAnio, setFAnio] = useState('')
  const [fCodigoMotor, setFCodigoMotor] = useState('')
  const [fChasis, setFChasis] = useState('')
  const [fUbicacion, setFUbicacion] = useState('')
  const [fEstado, setFEstado] = useState('activo')
  const [fLimiteKm, setFLimiteKm] = useState('')
  const [fLimiteAnios, setFLimiteAnios] = useState('')
  const [guardandoDatos, setGuardandoDatos] = useState(false)

  const iniciarEdicionDatos = () => {
    if (!vehiculo) return
    setFPatente(vehiculo.patente || ''); setFCodigo(vehiculo.codigo_interno || ''); setFTipo(vehiculo.tipo || '')
    setFMarca(vehiculo.marca || ''); setFModelo(vehiculo.modelo || ''); setFAnio(vehiculo.anio || '')
    setFCodigoMotor(vehiculo.codigo_motor || ''); setFChasis(vehiculo.chasis || '')
    setFUbicacion(vehiculo.ubicacion_id || ''); setFEstado(vehiculo.estado || 'activo')
    setFLimiteKm(vehiculo.limite_km ?? ''); setFLimiteAnios(vehiculo.limite_anios ?? '')
    setEditando(true)
  }

  const guardarDatos = async () => {
    setGuardandoDatos(true)
    const { error } = await supabase.from('vehiculos').update({
      patente: fPatente.trim() || null, codigo_interno: fCodigo.trim() || null, tipo: fTipo.trim(),
      marca: fMarca.trim() || null, modelo: fModelo.trim() || null, anio: fAnio ? Number(fAnio) : null,
      codigo_motor: fCodigoMotor.trim() || null, chasis: fChasis.trim() || null,
      ubicacion_id: fUbicacion || null, estado: fEstado,
      limite_km: fLimiteKm !== '' ? Number(fLimiteKm) : null, limite_anios: fLimiteAnios !== '' ? Number(fLimiteAnios) : null,
    }).eq('id', id)
    setGuardandoDatos(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setEditando(false)
    cargar()
  }

  // ================= DOCUMENTOS =================
  const [mostrarTiposDoc, setMostrarTiposDoc] = useState(false)
  const [nuevoTipoDoc, setNuevoTipoDoc] = useState('')
  const [creandoTipoDoc, setCreandoTipoDoc] = useState(false)
  const [errorTipoDoc, setErrorTipoDoc] = useState('')

  const crearTipoDoc = async () => {
    setErrorTipoDoc('')
    if (!nuevoTipoDoc.trim()) { setErrorTipoDoc('Escribe un nombre.'); return }
    setCreandoTipoDoc(true)
    const { error } = await supabase.from('vehiculo_tipos_documento').insert({ nombre: nuevoTipoDoc.trim() })
    setCreandoTipoDoc(false)
    if (error) { setErrorTipoDoc(error.code === '23505' ? 'Ya existe ese tipo.' : 'No se pudo crear: ' + error.message); return }
    setNuevoTipoDoc('')
    cargar()
  }

  const eliminarTipoDoc = async (nombre: string) => {
    const enUso = documentos.filter(d => d.tipo_documento === nombre).length
    if (enUso > 0) { alert(`No se puede eliminar "${nombre}": ya hay documentos registrados con ese tipo.`); return }
    if (!confirm(`¿Eliminar el tipo de documento "${nombre}"?`)) return
    const { error } = await supabase.from('vehiculo_tipos_documento').delete().eq('nombre', nombre)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  // Formulario para un documento NUEVO (tipo que este vehículo aún no tiene)
  const [tipoDoc, setTipoDoc] = useState('')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [fechaVenc, setFechaVenc] = useState('')
  const [archivoDoc, setArchivoDoc] = useState<File | null>(null)
  const [arrastrandoDoc, setArrastrandoDoc] = useState(false)
  const [guardandoDoc, setGuardandoDoc] = useState(false)
  const inputArchivoDocRef = useRef<HTMLInputElement>(null)
  const inputArchivoRenovarRef = useRef<HTMLInputElement>(null)
  const inputArchivoMantRef = useRef<HTMLInputElement>(null)

  const subirArchivo = async (file: File, carpeta: string) => {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'dat'
    const ruta = `${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error: errUp } = await supabase.storage.from('movimientos').upload(ruta, file)
    if (errUp) return null
    const { data } = supabase.storage.from('movimientos').getPublicUrl(ruta)
    return { url: data.publicUrl, nombre: file.name }
  }

  const tiposDisponiblesParaNuevo = tiposDocumento.filter(t => !documentos.some(d => d.tipo_documento === t.nombre))

  const agregarDocumento = async () => {
    if (!tipoDoc) { alert('Elige el tipo de documento.'); return }
    if (!fechaVenc) { alert('Ingresa la fecha de vencimiento.'); return }
    setGuardandoDoc(true)
    let archivo_url = null, archivo_nombre = null
    if (archivoDoc) {
      const subido = await subirArchivo(archivoDoc, 'vehiculos')
      if (subido) { archivo_url = subido.url; archivo_nombre = subido.nombre }
    }
    const { error } = await supabase.from('vehiculo_documentos').insert({
      vehiculo_id: id, tipo_documento: tipoDoc, numero_documento: numeroDoc.trim() || null,
      fecha_vencimiento: fechaVenc, archivo_url, archivo_nombre
    })
    setGuardandoDoc(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setTipoDoc(''); setNumeroDoc(''); setFechaVenc(''); setArchivoDoc(null)
    cargar()
  }

  // Renovar (editar en el mismo registro) un documento existente
  const [renovandoId, setRenovandoId] = useState('')
  const [rNumero, setRNumero] = useState('')
  const [rFecha, setRFecha] = useState('')
  const [rArchivo, setRArchivo] = useState<File | null>(null)
  const [rArrastrando, setRArrastrando] = useState(false)
  const [guardandoRenovacion, setGuardandoRenovacion] = useState(false)
  const [expandidoHistorial, setExpandidoHistorial] = useState<string>('')

  const iniciarRenovacion = (d: any) => {
    setRenovandoId(d.id)
    setRNumero(d.numero_documento || '')
    setRFecha('')
    setRArchivo(null)
  }

  const guardarRenovacion = async (docActual: any) => {
    if (!rFecha) { alert('Ingresa la nueva fecha de vencimiento.'); return }
    setGuardandoRenovacion(true)
    // 1. Guarda el estado anterior en el historial, para no perder trazabilidad
    const { error: errHist } = await supabase.from('vehiculo_documentos_historial').insert({
      documento_id: docActual.id,
      fecha_vencimiento_anterior: docActual.fecha_vencimiento,
      numero_documento_anterior: docActual.numero_documento,
      archivo_url_anterior: docActual.archivo_url,
      archivo_nombre_anterior: docActual.archivo_nombre,
      cambiado_por: usuario?.nombre,
    })
    if (errHist) { setGuardandoRenovacion(false); alert('No se pudo guardar el historial: ' + errHist.message); return }

    // 2. Sube el archivo nuevo si corresponde
    let archivo_url = docActual.archivo_url, archivo_nombre = docActual.archivo_nombre
    if (rArchivo) {
      const subido = await subirArchivo(rArchivo, 'vehiculos')
      if (subido) { archivo_url = subido.url; archivo_nombre = subido.nombre }
    }

    // 3. Actualiza el mismo registro (no crea uno nuevo)
    const { error } = await supabase.from('vehiculo_documentos').update({
      numero_documento: rNumero.trim() || null, fecha_vencimiento: rFecha, archivo_url, archivo_nombre
    }).eq('id', docActual.id)
    setGuardandoRenovacion(false)
    if (error) { alert('No se pudo renovar: ' + error.message); return }
    setRenovandoId('')
    cargar()
  }

  const cargarHistorialDoc = async (documentoId: string) => {
    if (expandidoHistorial === documentoId) { setExpandidoHistorial(''); return }
    setExpandidoHistorial(documentoId)
    if (!historialDocs[documentoId]) {
      const { data } = await supabase.from('vehiculo_documentos_historial').select('*').eq('documento_id', documentoId).order('created_at', { ascending: false })
      setHistorialDocs(prev => ({ ...prev, [documentoId]: data || [] }))
    }
  }

  const eliminarDocumento = async (d: any) => {
    if (!confirm(`¿Eliminar este documento (${d.tipo_documento})? Se borrará también su historial de renovaciones. No se puede deshacer.`)) return
    const { error } = await supabase.from('vehiculo_documentos').delete().eq('id', d.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  // ================= KILOMETRAJE =================
  const [nuevaLectura, setNuevaLectura] = useState('')
  const [fechaLectura, setFechaLectura] = useState(new Date().toISOString().split('T')[0])
  const [guardandoLectura, setGuardandoLectura] = useState(false)

  const agregarLectura = async () => {
    if (!nuevaLectura) { alert('Ingresa el valor.'); return }
    setGuardandoLectura(true)
    const valor = Number(nuevaLectura)
    const { error } = await supabase.from('vehiculo_lecturas').insert({
      vehiculo_id: id, valor, fecha: fechaLectura, registrado_por: usuario?.nombre
    })
    if (!error) {
      const masReciente = lecturas.length === 0 || fechaLectura >= lecturas[lecturas.length - 1].fecha
      if (masReciente) await supabase.from('vehiculos').update({ lectura_actual: valor }).eq('id', id)
    }
    setGuardandoLectura(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setNuevaLectura('')
    cargar()
  }

  const calcularProyeccion = () => {
    if (lecturas.length < 2 || !vehiculo) return null
    const primera = lecturas[0]
    const ultima = lecturas[lecturas.length - 1]
    const diasTranscurridos = (new Date(ultima.fecha).getTime() - new Date(primera.fecha).getTime()) / 86400000
    const mesesTranscurridos = diasTranscurridos / 30.44
    if (mesesTranscurridos < 1) return null
    const promedioMensual = (Number(ultima.valor) - Number(primera.valor)) / mesesTranscurridos
    if (promedioMensual <= 0) return { promedioMensual, mesesKm: null, mesesAnios: null, fechaKm: null, aniosRestantes: null }

    let mesesKm = null, fechaKm = null
    if (vehiculo.limite_km) {
      const restante = vehiculo.limite_km - Number(vehiculo.lectura_actual)
      mesesKm = restante / promedioMensual
      const f = new Date()
      f.setMonth(f.getMonth() + Math.round(mesesKm))
      fechaKm = f
    }
    let aniosRestantes = null
    if (vehiculo.limite_anios && vehiculo.anio) {
      const edadActual = new Date().getFullYear() - vehiculo.anio
      aniosRestantes = vehiculo.limite_anios - edadActual
    }
    return { promedioMensual, mesesKm, fechaKm, aniosRestantes }
  }
  const proyeccion = calcularProyeccion()

  // ================= MANTENCIONES =================
  const [fechaMant, setFechaMant] = useState(new Date().toISOString().split('T')[0])
  const [tipoMant, setTipoMant] = useState('preventiva')
  const [descMant, setDescMant] = useState('')
  const [tallerMant, setTallerMant] = useState('')
  const [costoMant, setCostoMant] = useState('')
  const [kmMant, setKmMant] = useState('')
  const [archivoMant, setArchivoMant] = useState<File | null>(null)
  const [guardandoMant, setGuardandoMant] = useState(false)

  const agregarMantencion = async () => {
    if (!descMant.trim()) { alert('Describe qué se hizo.'); return }
    setGuardandoMant(true)
    let archivo_url = null, archivo_nombre = null
    if (archivoMant) {
      const subido = await subirArchivo(archivoMant, 'vehiculos')
      if (subido) { archivo_url = subido.url; archivo_nombre = subido.nombre }
    }
    const { error } = await supabase.from('vehiculo_mantenciones').insert({
      vehiculo_id: id, fecha: fechaMant, tipo: tipoMant, descripcion: descMant.trim(),
      taller: tallerMant.trim() || null, costo: costoMant ? Number(costoMant) : null,
      kilometraje: kmMant ? Number(kmMant) : null, archivo_url, archivo_nombre
    })
    setGuardandoMant(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setDescMant(''); setTallerMant(''); setCostoMant(''); setKmMant(''); setArchivoMant(null)
    cargar()
  }

  // Editar / eliminar una mantención ya registrada (solo admin)
  const [editandoMantId, setEditandoMantId] = useState('')
  const [eFechaMant, setEFechaMant] = useState('')
  const [eTipoMant, setETipoMant] = useState('preventiva')
  const [eDescMant, setEDescMant] = useState('')
  const [eTallerMant, setETallerMant] = useState('')
  const [eCostoMant, setECostoMant] = useState('')
  const [eKmMant, setEKmMant] = useState('')
  const [eArchivoMant, setEArchivoMant] = useState<File | null>(null)
  const [eArrastrandoMant, setEArrastrandoMant] = useState(false)
  const [guardandoEdicionMant, setGuardandoEdicionMant] = useState(false)
  const inputArchivoEditarMantRef = useRef<HTMLInputElement>(null)

  const iniciarEdicionMant = (m: any) => {
    setEditandoMantId(m.id)
    setEFechaMant(m.fecha); setETipoMant(m.tipo || 'preventiva'); setEDescMant(m.descripcion || '')
    setETallerMant(m.taller || ''); setECostoMant(m.costo ?? ''); setEKmMant(m.kilometraje ?? '')
    setEArchivoMant(null)
  }

  const guardarEdicionMant = async (m: any) => {
    if (!eDescMant.trim()) { alert('Describe qué se hizo.'); return }
    setGuardandoEdicionMant(true)
    let archivo_url = m.archivo_url, archivo_nombre = m.archivo_nombre
    if (eArchivoMant) {
      const subido = await subirArchivo(eArchivoMant, 'vehiculos')
      if (subido) { archivo_url = subido.url; archivo_nombre = subido.nombre }
    }
    const { error } = await supabase.from('vehiculo_mantenciones').update({
      fecha: eFechaMant, tipo: eTipoMant, descripcion: eDescMant.trim(),
      taller: eTallerMant.trim() || null, costo: eCostoMant !== '' ? Number(eCostoMant) : null,
      kilometraje: eKmMant !== '' ? Number(eKmMant) : null, archivo_url, archivo_nombre
    }).eq('id', m.id)
    setGuardandoEdicionMant(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setEditandoMantId('')
    cargar()
  }

  const eliminarMantencion = async (m: any) => {
    if (!confirm('¿Eliminar este registro de mantención? No se puede deshacer.')) return
    const { error } = await supabase.from('vehiculo_mantenciones').delete().eq('id', m.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  // Zona de arrastrar-y-soltar reutilizable
  const zonaArchivo = (archivo: File | null, setArchivo: (f: File|null) => void, arrastrando: boolean, setArrastrando: (b: boolean) => void, refInput: React.RefObject<HTMLInputElement | null>, idInput: string) => (
    <div style={{marginBottom:'10px'}}>
      <div
        onClick={()=>refInput.current?.click()}
        onDragOver={e=>{ e.preventDefault(); e.stopPropagation(); setArrastrando(true) }}
        onDragLeave={()=>setArrastrando(false)}
        onDrop={e=>{
          e.preventDefault(); e.stopPropagation(); setArrastrando(false)
          const f = e.dataTransfer.files?.[0]
          if (f) setArchivo(f)
        }}
        style={{
          border: arrastrando ? `2px dashed ${AZUL}` : '1.5px dashed #c7d3e6',
          background: arrastrando ? 'rgba(27,79,156,0.07)' : '#f8f9fb',
          borderRadius:'8px', padding:'12px', textAlign:'center', cursor:'pointer',
        }}
      >
        <p style={{fontSize:'12px',fontWeight:'700',color:AZUL,margin:'0'}}>{archivo ? `📎 ${archivo.name}` : 'Arrastra el PDF/foto aquí, o haz clic para elegir'}</p>
        <input id={idInput} ref={refInput} type="file" accept="image/*,application/pdf"
          onChange={e=>{ const f = e.target.files?.[0]; if (f) setArchivo(f); e.target.value = '' }}
          style={{display:'none'}}
        />
      </div>
    </div>
  )

  if (!puedeAcceder) {
    return (
      <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
        <p style={{fontSize:'13px',color:'#999'}}>No tienes acceso a este módulo.</p>
      </div>
      </main>
    )
  }

  if (cargando || !vehiculo) {
    return (
      <main style={fondoPagina}>
      <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'700px',margin:'0 auto'}}>
        <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p>
      </div>
      </main>
    )
  }

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'700px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/vehiculos" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Vehículos</Link>
        <h1 style={{fontSize:'18px',fontWeight:'600',margin:'0'}}>{vehiculo.patente || vehiculo.codigo_interno} · {vehiculo.tipo}</h1>
      </div>

      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'1.25rem'}}>
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 12px',borderRadius:'20px',border:'0.5px solid',fontSize:'12px',cursor:'pointer',background:tab===t?AZUL:'#fff',color:tab===t?'#fff':'#444',borderColor:tab===t?AZUL:'#ddd'}}>{t}</button>
        ))}
      </div>

      {/* DATOS */}
      {tab === 'Datos' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {!editando ? (
            <>
              <div style={{display:'grid',gap:'8px',marginBottom:'14px'}}>
                <p style={{fontSize:'13px',margin:'0'}}><b>Patente:</b> {vehiculo.patente || '—'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Código interno:</b> {vehiculo.codigo_interno || '—'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Tipo:</b> {vehiculo.tipo}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Marca / Modelo:</b> {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || '—'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Año:</b> {vehiculo.anio || '—'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Código de motor:</b> {vehiculo.codigo_motor || '—'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Chasis:</b> {vehiculo.chasis || '—'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Ubicación:</b> {vehiculo.ubicaciones?.nombre || 'Sin ubicación'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Estado:</b> {vehiculo.estado === 'activo' ? 'Activo' : 'Fuera de servicio'}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Lectura actual:</b> {Number(vehiculo.lectura_actual).toLocaleString('es-CL')} {vehiculo.tipo_medicion}</p>
                <p style={{fontSize:'13px',margin:'0'}}><b>Límite estándar:</b> {vehiculo.limite_km ? `${Number(vehiculo.limite_km).toLocaleString('es-CL')} km` : '—'}{vehiculo.limite_anios ? ` · ${vehiculo.limite_anios} años` : ''}</p>
              </div>
              <button onClick={iniciarEdicionDatos} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Editar datos</button>
            </>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Patente</label><input value={fPatente} onChange={e=>setFPatente(e.target.value)} style={inputStyle}/></div>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Código interno</label><input value={fCodigo} onChange={e=>setFCodigo(e.target.value)} style={inputStyle}/></div>
              </div>
              <div style={{marginBottom:'10px'}}><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label><input value={fTipo} onChange={e=>setFTipo(e.target.value)} style={inputStyle}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Marca</label><input value={fMarca} onChange={e=>setFMarca(e.target.value)} style={inputStyle}/></div>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Modelo</label><input value={fModelo} onChange={e=>setFModelo(e.target.value)} style={inputStyle}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Año</label><input type="number" value={fAnio} onChange={e=>setFAnio(e.target.value)} style={inputStyle}/></div>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Estado</label>
                  <select value={fEstado} onChange={e=>setFEstado(e.target.value)} style={inputStyle}>
                    <option value='activo'>Activo</option>
                    <option value='fuera_servicio'>Fuera de servicio</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Código de motor</label><input value={fCodigoMotor} onChange={e=>setFCodigoMotor(e.target.value)} style={inputStyle}/></div>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Chasis</label><input value={fChasis} onChange={e=>setFChasis(e.target.value)} style={inputStyle}/></div>
              </div>
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Ubicación</label>
                <select value={fUbicacion} onChange={e=>setFUbicacion(e.target.value)} style={inputStyle}>
                  <option value=''>Sin asignar</option>
                  <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
                  <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Límite (km)</label><input type="number" value={fLimiteKm} onChange={e=>setFLimiteKm(e.target.value)} style={inputStyle}/></div>
                <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Límite (años)</label><input type="number" value={fLimiteAnios} onChange={e=>setFLimiteAnios(e.target.value)} style={inputStyle}/></div>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={guardarDatos} disabled={guardandoDatos} style={{flex:1,padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:guardandoDatos?0.6:1}}>{guardandoDatos?'Guardando...':'Guardar cambios'}</button>
                <button onClick={()=>setEditando(false)} style={{padding:'10px 16px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'13px',cursor:'pointer'}}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* DOCUMENTOS */}
      {tab === 'Documentos' && (
        <div>
          {esAdmin && (
            <div style={{marginBottom:'1rem'}}>
              <button onClick={()=>setMostrarTiposDoc(!mostrarTiposDoc)} style={{fontSize:'12px',color:AZUL,background:'none',border:'none',cursor:'pointer',padding:'0',fontWeight:'600'}}>
                {mostrarTiposDoc ? '– Ocultar gestión de tipos de documento' : '⚙️ Gestionar tipos de documento'}
              </button>
              {mostrarTiposDoc && (
                <div style={{background:'#fff',border:'1px solid #e2e6ed',borderRadius:'12px',padding:'14px 16px',marginTop:'8px'}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
                    {tiposDocumento.map(t => (
                      <span key={t.nombre} style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'12px',padding:'4px 6px 4px 10px',borderRadius:'20px',background:'#f1f3f4',color:'#444'}}>
                        {t.nombre}
                        <button onClick={()=>eliminarTipoDoc(t.nombre)} title="Eliminar" style={{border:'none',background:'none',cursor:'pointer',color:'#c5221f',fontSize:'13px',padding:'0 2px',lineHeight:1}}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <input value={nuevoTipoDoc} onChange={e=>setNuevoTipoDoc(e.target.value)} placeholder="Ej: Certificado de carga Manitou" style={{...inputStyle, flex:1}}/>
                    <button onClick={crearTipoDoc} disabled={creandoTipoDoc} style={{padding:'8px 14px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:creandoTipoDoc?0.6:1}}>
                      {creandoTipoDoc ? 'Creando...' : '+ Tipo'}
                    </button>
                  </div>
                  {errorTipoDoc && <p style={{fontSize:'12px',color:'#c5221f',margin:'8px 0 0'}}>{errorTipoDoc}</p>}
                </div>
              )}
            </div>
          )}

          {tiposDisponiblesParaNuevo.length > 0 && (
            <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1rem'}}>
              <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>+ Nuevo documento</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo de documento</label>
                  <select value={tipoDoc} onChange={e=>setTipoDoc(e.target.value)} style={inputStyle}>
                    <option value=''>Selecciona...</option>
                    {tiposDisponiblesParaNuevo.map(t => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>N° documento (opcional)</label>
                  <input value={numeroDoc} onChange={e=>setNumeroDoc(e.target.value)} style={inputStyle}/>
                </div>
              </div>
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Fecha de vencimiento</label>
                <input type="date" value={fechaVenc} onChange={e=>setFechaVenc(e.target.value)} style={inputStyle}/>
              </div>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Adjuntar PDF/foto (opcional)</label>
              {zonaArchivo(archivoDoc, setArchivoDoc, arrastrandoDoc, setArrastrandoDoc, inputArchivoDocRef, 'file-doc-nuevo')}
              <button onClick={agregarDocumento} disabled={guardandoDoc} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:guardandoDoc?0.6:1}}>
                {guardandoDoc ? 'Guardando...' : 'Guardar documento'}
              </button>
            </div>
          )}

          {documentos.length === 0 ? <p style={{fontSize:'13px',color:'#999'}}>Sin documentos registrados.</p> : (
            <div style={{display:'grid',gap:'8px'}}>
              {documentos.map(d => {
                const vencido = new Date(d.fecha_vencimiento) < new Date()
                const porVencer = !vencido && new Date(d.fecha_vencimiento) <= new Date(Date.now() + 30*86400000)
                return (
                  <div key={d.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'10px',padding:'10px 14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <p style={{fontSize:'13px',fontWeight:'600',margin:'0'}}>{d.tipo_documento}{d.numero_documento ? ` · ${d.numero_documento}` : ''}</p>
                      <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:vencido?'#fce8e6':porVencer?'#fef7e0':'#e6f4ea',color:vencido?'#c5221f':porVencer?'#986a00':'#137333'}}>
                        {vencido?'Vencido':porVencer?'Por vencer':'Vigente'}: {formatFecha(d.fecha_vencimiento)}
                      </span>
                    </div>
                    {d.archivo_url && <a href={d.archivo_url} target="_blank" rel="noopener noreferrer" style={{fontSize:'11px',color:AZUL,textDecoration:'none'}}>📎 {d.archivo_nombre || 'Ver archivo'}</a>}

                    {renovandoId === d.id ? (
                      <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #eee'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                          <div><label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>N° documento nuevo</label><input value={rNumero} onChange={e=>setRNumero(e.target.value)} style={inputStyle}/></div>
                          <div><label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Nueva fecha de vencimiento</label><input type="date" value={rFecha} onChange={e=>setRFecha(e.target.value)} style={inputStyle}/></div>
                        </div>
                        <label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Nuevo archivo (opcional, si no subes uno se mantiene el actual)</label>
                        {zonaArchivo(rArchivo, setRArchivo, rArrastrando, setRArrastrando, inputArchivoRenovarRef, `file-renovar-${d.id}`)}
                        <div style={{display:'flex',gap:'8px'}}>
                          <button onClick={()=>guardarRenovacion(d)} disabled={guardandoRenovacion} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer',opacity:guardandoRenovacion?0.6:1}}>
                            {guardandoRenovacion ? 'Guardando...' : 'Guardar renovación'}
                          </button>
                          <button onClick={()=>setRenovandoId('')} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
                        <button onClick={()=>iniciarRenovacion(d)} style={{fontSize:'11px',color:AZUL,background:'none',border:'none',cursor:'pointer',padding:'0',fontWeight:'600'}}>Renovar / actualizar</button>
                        <button onClick={()=>cargarHistorialDoc(d.id)} style={{fontSize:'11px',color:'#8a94a6',background:'none',border:'none',cursor:'pointer',padding:'0'}}>
                          {expandidoHistorial === d.id ? 'Ocultar historial' : 'Ver historial'}
                        </button>
                        {esAdmin && (
                          <button onClick={()=>eliminarDocumento(d)} style={{fontSize:'11px',color:'#c5221f',background:'none',border:'none',cursor:'pointer',padding:'0'}}>Eliminar</button>
                        )}
                      </div>
                    )}

                    {expandidoHistorial === d.id && (
                      <div style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid #eee'}}>
                        {(historialDocs[d.id]?.length ?? 0) === 0 ? (
                          <p style={{fontSize:'11px',color:'#999',margin:'0'}}>Sin renovaciones anteriores.</p>
                        ) : (
                          historialDocs[d.id].map(h => (
                            <p key={h.id} style={{fontSize:'11px',color:'#666',margin:'0 0 4px'}}>
                              Vencía el {formatFecha(h.fecha_vencimiento_anterior)}{h.numero_documento_anterior ? ` (N° ${h.numero_documento_anterior})` : ''} · cambiado por {h.cambiado_por || '—'} el {new Date(h.created_at).toLocaleDateString('es-CL')}
                              {h.archivo_url_anterior && <> · <a href={h.archivo_url_anterior} target="_blank" rel="noopener noreferrer" style={{color:AZUL}}>ver archivo anterior</a></>}
                            </p>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* KILOMETRAJE */}
      {tab === 'Kilometraje' && (
        <div>
          <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1rem'}}>
            <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>+ Nueva lectura ({vehiculo.tipo_medicion})</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
              <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Valor</label><input type="number" value={nuevaLectura} onChange={e=>setNuevaLectura(e.target.value)} style={inputStyle}/></div>
              <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Fecha</label><input type="date" value={fechaLectura} onChange={e=>setFechaLectura(e.target.value)} style={inputStyle}/></div>
            </div>
            <button onClick={agregarLectura} disabled={guardandoLectura} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:guardandoLectura?0.6:1}}>
              {guardandoLectura ? 'Guardando...' : 'Registrar lectura'}
            </button>
          </div>

          {proyeccion && (
            <div style={{background:'#fef7e0',border:'1px solid #f9e79f',borderRadius:'12px',padding:'14px 16px',marginBottom:'1rem'}}>
              <p style={{fontSize:'13px',fontWeight:'700',margin:'0 0 6px',color:'#856404'}}>📊 Proyección de uso</p>
              <p style={{fontSize:'12px',margin:'0 0 4px',color:'#856404'}}>Promedio: {proyeccion.promedioMensual.toLocaleString('es-CL', {maximumFractionDigits:0})} {vehiculo.tipo_medicion}/mes</p>
              {proyeccion.mesesKm != null && (
                <p style={{fontSize:'12px',margin:'0 0 4px',color:'#856404'}}>
                  A este ritmo, llegará al límite de {Number(vehiculo.limite_km).toLocaleString('es-CL')} km en <b>{Math.max(0,Math.round(proyeccion.mesesKm))} meses</b> ({proyeccion.fechaKm?.toLocaleDateString('es-CL')}).
                </p>
              )}
              {proyeccion.aniosRestantes != null && (
                <p style={{fontSize:'12px',margin:'0',color:'#856404'}}>
                  Por antigüedad: quedan <b>{proyeccion.aniosRestantes}</b> año(s) dentro del estándar ({vehiculo.limite_anios} años máximo).
                </p>
              )}
            </div>
          )}
          {!proyeccion && vehiculo.limite_km && (
            <p style={{fontSize:'12px',color:'#999',margin:'0 0 1rem'}}>Necesitas al menos 2 lecturas en fechas distintas para calcular la proyección.</p>
          )}

          {lecturas.length === 0 ? <p style={{fontSize:'13px',color:'#999'}}>Sin lecturas registradas.</p> : (
            <div style={{display:'grid',gap:'6px'}}>
              {[...lecturas].reverse().map(l => (
                <div key={l.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'10px',padding:'8px 14px',display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:'12px',color:'#666'}}>{formatFecha(l.fecha)} {l.registrado_por ? `· ${l.registrado_por}` : ''}</span>
                  <span style={{fontSize:'13px',fontWeight:'600'}}>{Number(l.valor).toLocaleString('es-CL')} {vehiculo.tipo_medicion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MANTENCIONES */}
      {tab === 'Mantenciones' && (
        <div>
          <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px',marginBottom:'1rem'}}>
            <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 10px'}}>+ Nueva mantención</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Fecha</label><input type="date" value={fechaMant} onChange={e=>setFechaMant(e.target.value)} style={inputStyle}/></div>
              <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label>
                <select value={tipoMant} onChange={e=>setTipoMant(e.target.value)} style={inputStyle}>
                  <option value='preventiva'>Preventiva</option>
                  <option value='correctiva'>Correctiva</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>¿Qué se hizo?</label>
              <textarea value={descMant} onChange={e=>setDescMant(e.target.value)} rows={3} style={{...inputStyle, resize:'vertical'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Taller</label><input value={tallerMant} onChange={e=>setTallerMant(e.target.value)} style={inputStyle}/></div>
              <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Costo</label><input type="number" value={costoMant} onChange={e=>setCostoMant(e.target.value)} style={inputStyle}/></div>
              <div><label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>{vehiculo.tipo_medicion} en ese momento</label><input type="number" value={kmMant} onChange={e=>setKmMant(e.target.value)} style={inputStyle}/></div>
            </div>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Adjuntar boleta/orden de trabajo (opcional)</label>
            {zonaArchivo(archivoMant, setArchivoMant, false, ()=>{}, inputArchivoMantRef, 'file-mant')}
            <button onClick={agregarMantencion} disabled={guardandoMant} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:guardandoMant?0.6:1}}>
              {guardandoMant ? 'Guardando...' : 'Guardar mantención'}
            </button>
          </div>

          {mantenciones.length === 0 ? <p style={{fontSize:'13px',color:'#999'}}>Sin mantenciones registradas.</p> : (
            <div style={{display:'grid',gap:'8px'}}>
              {mantenciones.map(m => (
                <div key={m.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'10px',padding:'10px 14px'}}>
                  {editandoMantId === m.id ? (
                    <>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                        <div><label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Fecha</label><input type="date" value={eFechaMant} onChange={e=>setEFechaMant(e.target.value)} style={inputStyle}/></div>
                        <div><label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label>
                          <select value={eTipoMant} onChange={e=>setETipoMant(e.target.value)} style={inputStyle}>
                            <option value='preventiva'>Preventiva</option>
                            <option value='correctiva'>Correctiva</option>
                          </select>
                        </div>
                      </div>
                      <div style={{marginBottom:'10px'}}>
                        <label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>¿Qué se hizo?</label>
                        <textarea value={eDescMant} onChange={e=>setEDescMant(e.target.value)} rows={3} style={{...inputStyle, resize:'vertical'}}/>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                        <div><label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Taller</label><input value={eTallerMant} onChange={e=>setETallerMant(e.target.value)} style={inputStyle}/></div>
                        <div><label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Costo</label><input type="number" value={eCostoMant} onChange={e=>setECostoMant(e.target.value)} style={inputStyle}/></div>
                        <div><label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>{vehiculo.tipo_medicion}</label><input type="number" value={eKmMant} onChange={e=>setEKmMant(e.target.value)} style={inputStyle}/></div>
                      </div>
                      <label style={{fontSize:'12px',color:'#555',display:'block',marginBottom:'4px'}}>Reemplazar archivo (opcional, si no subes uno se mantiene el actual)</label>
                      {zonaArchivo(eArchivoMant, setEArchivoMant, eArrastrandoMant, setEArrastrandoMant, inputArchivoEditarMantRef, `file-editar-mant-${m.id}`)}
                      <div style={{display:'flex',gap:'8px'}}>
                        <button onClick={()=>guardarEdicionMant(m)} disabled={guardandoEdicionMant} style={{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer',opacity:guardandoEdicionMant?0.6:1}}>
                          {guardandoEdicionMant ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button onClick={()=>setEditandoMantId('')} style={{padding:'8px 14px',borderRadius:'8px',border:'0.5px solid #ddd',background:'#fff',fontSize:'12px',cursor:'pointer'}}>Cancelar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                        <span style={{fontSize:'11px',fontWeight:'700',padding:'2px 8px',borderRadius:'20px',background: m.tipo==='correctiva'?'#fce8e6':'#e6f4ea', color: m.tipo==='correctiva'?'#c5221f':'#137333'}}>{m.tipo === 'correctiva' ? 'Correctiva' : 'Preventiva'}</span>
                        <span style={{fontSize:'11px',color:'#999'}}>{formatFecha(m.fecha)}</span>
                      </div>
                      <p style={{fontSize:'13px',margin:'0 0 4px'}}>{m.descripcion}</p>
                      <p style={{fontSize:'11px',color:'#666',margin:'0'}}>{[m.taller, m.costo ? `$${Number(m.costo).toLocaleString('es-CL')}` : null, m.kilometraje ? `${Number(m.kilometraje).toLocaleString('es-CL')} ${vehiculo.tipo_medicion}` : null].filter(Boolean).join(' · ')}</p>
                      {m.archivo_url && <a href={m.archivo_url} target="_blank" rel="noopener noreferrer" style={{fontSize:'11px',color:AZUL,textDecoration:'none'}}>📎 {m.archivo_nombre || 'Ver archivo'}</a>}
                      {esAdmin && (
                        <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
                          <button onClick={()=>iniciarEdicionMant(m)} style={{fontSize:'11px',color:AZUL,background:'none',border:'none',cursor:'pointer',padding:'0',fontWeight:'600'}}>Editar</button>
                          <button onClick={()=>eliminarMantencion(m)} style={{fontSize:'11px',color:'#c5221f',background:'none',border:'none',cursor:'pointer',padding:'0'}}>Eliminar</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </main>
  )
}

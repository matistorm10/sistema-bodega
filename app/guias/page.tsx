'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { generarGuiaTraslado, abrirVentanaGuia, numeroGuia } from '@/lib/generarGuiaTraslado'

type Estado = 'borrador' | 'pendiente' | 'aprobada' | 'rechazada' | 'recibida' | 'anulada'
const ESTADOS: Record<Estado, { texto: string, bg: string, color: string }> = {
  borrador: { texto: 'Borrador', bg: '#f1f3f7', color: '#555' },
  pendiente: { texto: 'Esperando aprobación', bg: '#fef7e0', color: '#986a00' },
  aprobada: { texto: 'Aprobada · en tránsito', bg: '#E8F0FE', color: AZUL },
  rechazada: { texto: 'Devuelta', bg: '#fde8e8', color: '#9b1c1c' },
  recibida: { texto: 'Recibida', bg: '#d7efe0', color: '#14532d' },
  anulada: { texto: 'Anulada', bg: '#ececec', color: '#666' },
}
const UNIDADES = ['un', 'kg', 'm', 'lt', 'caja', 'pallet', 'set', 'rollo']
const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
const input: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }
const label: React.CSSProperties = { fontSize: '11px', color: '#667085', display: 'block', marginBottom: '3px', fontWeight: 600 }
const btn = (primario = true, peligro = false): React.CSSProperties => ({
  padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : `1px solid ${peligro ? '#e5b4b4' : '#d0d5dd'}`,
  background: primario ? (peligro ? '#c0392b' : AZUL) : '#fff', color: primario ? '#fff' : (peligro ? '#9b1c1c' : '#344054'),
})
const OTRO = '__otro'

export default function Guias() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoContabilidad
  const aprueba = esAdmin || !!usuario?.puedeAprobar

  const [tab, setTab] = useState<'mias' | 'aprobar' | 'todas'>('mias')
  const [guias, setGuias] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [restaurado, setRestaurado] = useState(false)
  const [msg, setMsg] = useState('')

  // Formulario del encabezado (se edita sobre la guía abierta)
  const [h, setH] = useState<any>({})
  const [hGuardando, setHGuardando] = useState(false)
  // Formulario de ítem
  const ITEM_VACIO = { descripcion: '', cantidad: '1', unidad: 'un', procedencia: 'propio', proveedor: '', codigo: '', observacion: '' }
  const [it, setIt] = useState({ ...ITEM_VACIO })
  const [opcionesInv, setOpcionesInv] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  const avisar = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  const cargar = useCallback(async () => {
    setCargando(true)
    const [g, i, u, us] = await Promise.all([
      supabase.from('guias_traslado').select('*').order('created_at', { ascending: false }),
      supabase.from('guia_items').select('*').order('created_at'),
      supabase.from('ubicaciones').select('id,nombre,tipo,activa').order('tipo').order('nombre'),
      supabase.from('usuarios').select('id,nombre'),
    ])
    setGuias(g.data || []); setItems(i.data || [])
    setUbicaciones((u.data || []).filter((x: any) => x.activa !== false)); setUsuarios(us.data || [])
    setCargando(false)
  }, [])
  useEffect(() => { if (usuario) cargar() }, [usuario, cargar])

  // Recordar dónde estaba el usuario si el navegador recarga la página
  useEffect(() => {
    if (!usuario || restaurado) return
    try {
      const g = JSON.parse(sessionStorage.getItem('guias_vista') || 'null')
      if (g?.abierta) setAbierta(g.abierta)
      if (g?.tab) setTab(g.tab)
    } catch {}
    setRestaurado(true)
  }, [usuario?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!restaurado) return
    try { sessionStorage.setItem('guias_vista', JSON.stringify({ tab, abierta })) } catch {}
  }, [tab, abierta, restaurado])
  useEffect(() => { if (!cargando && abierta && !guias.some(g => g.id === abierta)) setAbierta(null) }, [cargando, abierta, guias])

  const nombreUsuario = (id?: string | null) => usuarios.find(u => u.id === id)?.nombre || '—'
  const itemsDe = (gid: string) => items.filter(x => x.guia_id === gid)
  const lugar = (id?: string | null, texto?: string | null) => id ? (ubicaciones.find(u => u.id === id)?.nombre || '—') : (texto || '—')

  // Al abrir una guía, cargar su encabezado en el formulario
  const guiaAbierta = guias.find(g => g.id === abierta)
  useEffect(() => {
    if (!guiaAbierta) return
    setH({
      fecha_traslado: guiaAbierta.fecha_traslado || '', origen: guiaAbierta.origen_id || (guiaAbierta.origen_texto ? OTRO : ''), origen_texto: guiaAbierta.origen_texto || '',
      destino: guiaAbierta.destino_id || (guiaAbierta.destino_texto ? OTRO : ''), destino_texto: guiaAbierta.destino_texto || '', motivo: guiaAbierta.motivo || '',
      chofer_nombre: guiaAbierta.chofer_nombre || '', chofer_rut: guiaAbierta.chofer_rut || '', patente: guiaAbierta.patente || '',
      transportista: guiaAbierta.transportista || '', transportista_rut: guiaAbierta.transportista_rut || '',
    })
    setIt({ ...ITEM_VACIO })
  }, [abierta]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inventario disponible en el origen (si el origen es una bodega o centro de costo del sistema)
  useEffect(() => {
    setOpcionesInv([])
    const origen = h.origen
    if (!origen || origen === OTRO) return
    let vivo = true
    ;(async () => {
      const [un, st] = await Promise.all([
        supabase.from('unidades').select('id,codigo,estado,productos(nombre)').eq('ubicacion_id', origen).neq('estado', 'baja'),
        supabase.from('stock').select('id,cantidad,productos(nombre,unidad)').eq('ubicacion_id', origen).gt('cantidad', 0),
      ])
      if (!vivo) return
      const o: any[] = []
      ;(un.data || []).forEach((x: any) => o.push({ clave: 'u' + x.id, texto: `${x.productos?.nombre || 'Herramienta'} · ${x.codigo}`, descripcion: x.productos?.nombre || '', codigo: x.codigo, cantidad: '1', unidad: 'un' }))
      ;(st.data || []).forEach((x: any) => o.push({ clave: 's' + x.id, texto: `${x.productos?.nombre || 'Producto'} · a granel (hay ${x.cantidad})`, descripcion: x.productos?.nombre || '', codigo: '', cantidad: '1', unidad: x.productos?.unidad || 'un' }))
      o.sort((a, b) => a.texto.localeCompare(b.texto))
      setOpcionesInv(o)
    })()
    return () => { vivo = false }
  }, [h.origen])

  // ---------- acciones ----------
  const [nuevaOrigen, setNuevaOrigen] = useState('')
  const crearGuia = async () => {
    if (!usuario) return
    const { data, error } = await supabase.from('guias_traslado').insert({ creado_por: usuario.id, origen_id: nuevaOrigen && nuevaOrigen !== OTRO ? nuevaOrigen : null }).select().single()
    if (error || !data) { alert('No se pudo crear la guía: ' + error?.message); return }
    setNuevaOrigen(''); await cargar(); setAbierta(data.id)
  }

  const guardarEncabezado = async (g: any, silencioso = false) => {
    setHGuardando(true)
    const { error } = await supabase.from('guias_traslado').update({
      fecha_traslado: h.fecha_traslado || g.fecha_traslado,
      origen_id: h.origen && h.origen !== OTRO ? h.origen : null, origen_texto: h.origen === OTRO ? (h.origen_texto || '').trim() || null : null,
      destino_id: h.destino && h.destino !== OTRO ? h.destino : null, destino_texto: h.destino === OTRO ? (h.destino_texto || '').trim() || null : null,
      motivo: (h.motivo || '').trim() || null, chofer_nombre: (h.chofer_nombre || '').trim() || null, chofer_rut: (h.chofer_rut || '').trim() || null,
      patente: (h.patente || '').trim().toUpperCase() || null, transportista: (h.transportista || '').trim() || null, transportista_rut: (h.transportista_rut || '').trim() || null,
    }).eq('id', g.id)
    setHGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return false }
    if (!silencioso) avisar('Datos guardados.')
    await cargar(); return true
  }

  const cambiar = async (id: string, campos: any, ok: string) => {
    const { error } = await supabase.from('guias_traslado').update(campos).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return false }
    avisar(ok); await cargar(); return true
  }

  const agregarItem = async (g: any) => {
    const cantidad = Number(it.cantidad.replace(',', '.'))
    if (!it.descripcion.trim() || !cantidad || cantidad <= 0) { alert('Indica la descripción y una cantidad válida.'); return }
    if (it.procedencia === 'proveedor' && !it.proveedor.trim()) { alert('Indica el nombre del proveedor.'); return }
    const { error } = await supabase.from('guia_items').insert({
      guia_id: g.id, descripcion: it.descripcion.trim(), cantidad, unidad: it.unidad, procedencia: it.procedencia,
      proveedor: it.procedencia === 'proveedor' ? it.proveedor.trim() : null, codigo: it.codigo.trim() || null, observacion: it.observacion.trim() || null,
    })
    if (error) { alert('No se pudo agregar: ' + error.message); return }
    setIt({ ...ITEM_VACIO }); await cargar()
  }
  const quitarItem = async (x: any) => {
    const { error } = await supabase.from('guia_items').delete().eq('id', x.id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const eliminarGuia = async (g: any) => {
    if (!confirm('¿Eliminar este borrador?')) return
    const { error } = await supabase.from('guias_traslado').delete().eq('id', g.id)
    if (error) { alert(error.message); return }
    setAbierta(null); await cargar()
  }

  const enviar = async (g: any) => {
    const its = itemsDe(g.id)
    if (!(h.origen && (h.origen !== OTRO || (h.origen_texto || '').trim()))) { alert('Indica el origen.'); return }
    if (!(h.destino && (h.destino !== OTRO || (h.destino_texto || '').trim()))) { alert('Indica el destino.'); return }
    if (h.origen !== OTRO && h.origen === h.destino) { alert('El origen y el destino no pueden ser el mismo lugar.'); return }
    if (!(h.chofer_nombre || '').trim() || !(h.patente || '').trim()) { alert('Indica al menos el nombre del chofer y la patente del vehículo.'); return }
    if (!its.length) { alert('Agrega al menos un ítem.'); return }
    if (!(await guardarEncabezado(g, true))) return
    await cambiar(g.id, { estado: 'pendiente', motivo_rechazo: null }, 'Guía enviada a aprobación.')
  }

  const descargarPDF = (g: any) => {
    const ventana = abrirVentanaGuia() // antes de cualquier await, para que el celular no bloquee la ventana
    generarGuiaTraslado({
      numero: g.numero, fechaTraslado: g.fecha_traslado, origen: lugar(g.origen_id, g.origen_texto), destino: lugar(g.destino_id, g.destino_texto), motivo: g.motivo || '',
      choferNombre: g.chofer_nombre || '', choferRut: g.chofer_rut || '', patente: g.patente || '', transportista: g.transportista || '', transportistaRut: g.transportista_rut || '',
      emitidoPor: nombreUsuario(g.creado_por), aprobadoPor: g.aprobada_por ? nombreUsuario(g.aprobada_por) : '', fechaAprobacion: g.fecha_aprobacion || '',
      items: itemsDe(g.id).map(x => ({ descripcion: x.descripcion, codigo: x.codigo || '', cantidad: Number(x.cantidad), unidad: x.unidad, procedencia: x.procedencia === 'proveedor' ? 'Proveedor: ' + (x.proveedor || '') : 'Propio', observacion: x.observacion || '' })),
    }, ventana).catch(e => { ventana?.close(); alert('No se pudo generar el PDF: ' + e.message) })
  }

  // ---------- vistas ----------
  const chip = (e: Estado) => <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', background: ESTADOS[e].bg, color: ESTADOS[e].color, whiteSpace: 'nowrap', fontWeight: 600 }}>{ESTADOS[e].texto}</span>

  const cabecera = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/contabilidad" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Contabilidad</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Guías de traslado</h1>
    </div>
  )

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  if (!puedeAcceder) {
    return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '600px', margin: '0 auto' }}>{cabecera}
      <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a este módulo. Pídele al administrador que te lo habilite en Usuarios.</p></div></main>
  }

  const fila = (g: any, conAutor: boolean) => (
    <div key={g.id} onClick={() => setAbierta(g.id)} style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{g.numero ? numeroGuia(g.numero) : 'Borrador sin número'}{conAutor ? ' · ' + nombreUsuario(g.creado_por) : ''}</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>{lugar(g.origen_id, g.origen_texto)} → {lugar(g.destino_id, g.destino_texto)} · {itemsDe(g.id).length} ítem(s) · {fechaCL(g.fecha_traslado)}</p>
      </div>
      {chip(g.estado)}
    </div>
  )

  const selectorLugar = (valor: string, setValor: (v: string) => void, texto: string, setTexto: (v: string) => void, placeholder: string) => (
    <div>
      <select value={valor} onChange={e => setValor(e.target.value)} style={input}>
        <option value="">Elegir...</option>
        <optgroup label="Bodegas">{ubicaciones.filter(u => u.tipo === 'bodega').map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</optgroup>
        <optgroup label="Centros de Costo (CECO)">{ubicaciones.filter(u => u.tipo === 'faena').map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</optgroup>
        <option value={OTRO}>Otro lugar (escribir)</option>
      </select>
      {valor === OTRO && <input value={texto} onChange={e => setTexto(e.target.value)} placeholder={placeholder} style={{ ...input, marginTop: '6px' }} />}
    </div>
  )

  const detalle = () => {
    const g = guiaAbierta
    if (!g) return null
    const its = itemsDe(g.id)
    const esDueno = g.creado_por === usuario!.id
    const editable = esDueno && (g.estado === 'borrador' || g.estado === 'rechazada')
    const puedeAprobarEsta = aprueba && g.estado === 'pendiente' && !(esDueno && !esAdmin)
    const sh = (k: string) => (e: any) => setH({ ...h, [k]: e.target.value })
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        <button onClick={() => setAbierta(null)} style={{ ...btn(false), width: 'fit-content' }}>← Volver al listado</button>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 3px', fontSize: '18px' }}>{g.numero ? numeroGuia(g.numero) : 'Guía en borrador'}</h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#667085' }}>Creada por <strong>{nombreUsuario(g.creado_por)}</strong> · {fechaCL(g.created_at)}</p>
            </div>
            {chip(g.estado)}
          </div>
          {g.estado === 'rechazada' && g.motivo_rechazo && <p style={{ margin: '10px 0 0', padding: '8px 10px', background: '#fde8e8', color: '#9b1c1c', borderRadius: '8px', fontSize: '12.5px' }}>Devuelta: {g.motivo_rechazo}</p>}
          {g.estado === 'anulada' && g.motivo_anulacion && <p style={{ margin: '10px 0 0', padding: '8px 10px', background: '#ececec', color: '#555', borderRadius: '8px', fontSize: '12.5px' }}>Anulada: {g.motivo_anulacion}</p>}
          {g.aprobada_por && <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#8a94a6' }}>Aprobada por {nombreUsuario(g.aprobada_por)} el {fechaCL(g.fecha_aprobacion)}{g.recibido_por ? ` · Recibida por ${g.recibido_por} el ${fechaCL(g.fecha_recepcion)}` : ''}</p>}
        </div>

        {/* Encabezado */}
        <div style={card}>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Traslado y transporte</p>
          {editable ? (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '10px' }}>
              <div><span style={label}>Origen</span>{selectorLugar(h.origen || '', v => setH({ ...h, origen: v }), h.origen_texto || '', v => setH({ ...h, origen_texto: v }), 'Ej: Taller proveedor, Antofagasta')}</div>
              <div><span style={label}>Destino</span>{selectorLugar(h.destino || '', v => setH({ ...h, destino: v }), h.destino_texto || '', v => setH({ ...h, destino_texto: v }), 'Ej: Obra cliente, Calama')}</div>
              <div><span style={label}>Fecha del traslado</span><input type="date" value={h.fecha_traslado || ''} onChange={sh('fecha_traslado')} style={input} /></div>
            </div>
            <div style={{ marginTop: '10px' }}><span style={label}>Motivo / observaciones</span><input value={h.motivo || ''} onChange={sh('motivo')} style={input} placeholder="Ej: Devolución de herramientas a bodega" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px', marginTop: '10px' }}>
              <div><span style={label}>Chofer</span><input value={h.chofer_nombre || ''} onChange={sh('chofer_nombre')} style={input} /></div>
              <div><span style={label}>RUT chofer</span><input value={h.chofer_rut || ''} onChange={sh('chofer_rut')} style={input} placeholder="12.345.678-9" /></div>
              <div><span style={label}>Patente</span><input value={h.patente || ''} onChange={sh('patente')} style={{ ...input, textTransform: 'uppercase' }} /></div>
              <div><span style={label}>Empresa transportista</span><input value={h.transportista || ''} onChange={sh('transportista')} style={input} /></div>
              <div><span style={label}>RUT transportista</span><input value={h.transportista_rut || ''} onChange={sh('transportista_rut')} style={input} /></div>
            </div>
            <button onClick={() => guardarEncabezado(g)} disabled={hGuardando} style={{ ...btn(false), marginTop: '12px' }}>{hGuardando ? 'Guardando...' : 'Guardar datos'}</button>
          </>) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px 16px', fontSize: '13px' }}>
              <div><span style={label}>Origen</span>{lugar(g.origen_id, g.origen_texto)}</div>
              <div><span style={label}>Destino</span>{lugar(g.destino_id, g.destino_texto)}</div>
              <div><span style={label}>Fecha del traslado</span>{fechaCL(g.fecha_traslado)}</div>
              <div><span style={label}>Chofer</span>{g.chofer_nombre || '—'} {g.chofer_rut ? '· ' + g.chofer_rut : ''}</div>
              <div><span style={label}>Patente</span>{g.patente || '—'}</div>
              <div><span style={label}>Transportista</span>{g.transportista || '—'} {g.transportista_rut ? '· ' + g.transportista_rut : ''}</div>
              {g.motivo && <div style={{ gridColumn: '1 / -1' }}><span style={label}>Motivo / observaciones</span>{g.motivo}</div>}
            </div>
          )}
        </div>

        {/* Ítems */}
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead><tr style={{ background: '#f6f8fb', textAlign: 'left' }}>{['Descripción', 'Código', 'Cantidad', 'Procedencia', ''].map((t, k) => <th key={k} style={{ padding: '9px 10px', fontSize: '11px', color: '#667085' }}>{t}</th>)}</tr></thead>
            <tbody>
              {its.length === 0 && <tr><td colSpan={5} style={{ padding: '14px', color: '#999' }}>Aún no hay ítems.</td></tr>}
              {its.map(x => (
                <tr key={x.id} style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ padding: '8px 10px' }}>{x.descripcion}{x.observacion ? <span style={{ color: '#8a94a6' }}> · {x.observacion}</span> : null}</td>
                  <td style={{ padding: '8px 10px' }}>{x.codigo || '—'}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{String(x.cantidad).replace('.', ',')} {x.unidad}</td>
                  <td style={{ padding: '8px 10px' }}>{x.procedencia === 'proveedor' ? 'Proveedor: ' + (x.proveedor || '') : 'Propio'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{(editable || esAdmin) && g.estado !== 'aprobada' && g.estado !== 'recibida' && <button onClick={() => quitarItem(x)} style={{ ...btn(false, true), padding: '4px 9px', fontSize: '11.5px' }}>Quitar</button>}</td>
                </tr>))}
            </tbody>
          </table>
        </div>

        {editable && (
          <div style={card}>
            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Agregar ítem</p>
            {h.origen && h.origen !== OTRO && (
              <div style={{ marginBottom: '10px' }}>
                <span style={label}>Tomar del inventario de {lugar(h.origen, '')} (opcional)</span>
                <select value="" onChange={e => { const o = opcionesInv.find(x => x.clave === e.target.value); if (o) setIt({ ...it, descripcion: o.descripcion, codigo: o.codigo, cantidad: o.cantidad, unidad: o.unidad, procedencia: 'propio' }) }} style={input}>
                  <option value="">{opcionesInv.length ? 'Elegir del inventario...' : 'Sin inventario en este origen'}</option>
                  {opcionesInv.map(o => <option key={o.clave} value={o.clave}>{o.texto}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' }}>
              <div style={{ gridColumn: 'span 2' }}><span style={label}>Descripción</span><input value={it.descripcion} onChange={e => setIt({ ...it, descripcion: e.target.value })} style={input} /></div>
              <div><span style={label}>Código (si tiene)</span><input value={it.codigo} onChange={e => setIt({ ...it, codigo: e.target.value })} style={input} /></div>
              <div><span style={label}>Cantidad</span><input inputMode="decimal" value={it.cantidad} onChange={e => setIt({ ...it, cantidad: e.target.value })} style={input} /></div>
              <div><span style={label}>Unidad</span><select value={it.unidad} onChange={e => setIt({ ...it, unidad: e.target.value })} style={input}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div>
              <div><span style={label}>Procedencia</span><select value={it.procedencia} onChange={e => setIt({ ...it, procedencia: e.target.value })} style={input}><option value="propio">Propio (de la empresa)</option><option value="proveedor">De un proveedor</option></select></div>
              {it.procedencia === 'proveedor' && <div><span style={label}>Proveedor</span><input value={it.proveedor} onChange={e => setIt({ ...it, proveedor: e.target.value })} style={input} /></div>}
            </div>
            <div style={{ marginTop: '10px' }}><span style={label}>Observación (opcional)</span><input value={it.observacion} onChange={e => setIt({ ...it, observacion: e.target.value })} style={input} /></div>
            <button onClick={() => agregarItem(g)} style={{ ...btn(), marginTop: '12px' }}>+ Agregar ítem</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {editable && <button style={btn()} onClick={() => enviar(g)}>Enviar a aprobación</button>}
          {editable && g.estado === 'borrador' && <button style={btn(false, true)} onClick={() => eliminarGuia(g)}>Eliminar borrador</button>}
          {puedeAprobarEsta && <>
            <button style={btn()} onClick={() => cambiar(g.id, { estado: 'aprobada', aprobada_por: usuario!.id, fecha_aprobacion: new Date().toISOString() }, 'Guía aprobada. Ya tiene su número y puedes descargar el PDF.')}>✔ Aprobar y numerar</button>
            <button style={btn(false, true)} onClick={() => { const m = prompt('Motivo de la devolución:'); if (m && m.trim()) cambiar(g.id, { estado: 'rechazada', motivo_rechazo: m.trim() }, 'Devuelta al creador.') }}>Devolver</button>
          </>}
          {(g.estado === 'aprobada' || g.estado === 'recibida') && <button style={btn()} onClick={() => descargarPDF(g)}>⬇ Descargar PDF para el chofer</button>}
          {g.estado === 'aprobada' && (esDueno || aprueba) && <button style={btn(false)} onClick={() => {
            const n = prompt('Nombre de quien recibió el traslado:'); if (!n || !n.trim()) return
            cambiar(g.id, { estado: 'recibida', recibido_por: n.trim(), fecha_recepcion: new Date().toISOString().slice(0, 10) }, 'Recepción registrada.')
          }}>Marcar como recibida</button>}
          {esAdmin && (g.estado === 'aprobada' || g.estado === 'recibida' || g.estado === 'pendiente') && <button style={btn(false, true)} onClick={() => { const m = prompt('Motivo de la anulación:'); if (m && m.trim()) cambiar(g.id, { estado: 'anulada', motivo_anulacion: m.trim() }, 'Guía anulada.') }}>Anular</button>}
        </div>
      </div>
    )
  }

  const mias = guias.filter(g => g.creado_por === usuario!.id)
  const porAprobar = guias.filter(g => g.estado === 'pendiente')
  const todas = guias.filter(g => !filtroEstado || g.estado === filtroEstado)
  const tabs: { k: typeof tab, t: string, v: boolean, n?: number }[] = [
    { k: 'mias', t: 'Mis guías', v: true },
    { k: 'aprobar', t: 'Por aprobar', v: aprueba, n: porAprobar.length },
    { k: 'todas', t: 'Todas', v: aprueba },
  ]

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '980px', margin: '0 auto' }}>
        {cabecera}
        {msg && <p style={{ background: '#e6f4ea', color: '#1e6b3a', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', margin: '0 0 10px' }}>{msg}</p>}

        {abierta ? detalle() : (<>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {tabs.filter(t => t.v).map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{ padding: '8px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, border: '1px solid ' + (tab === t.k ? AZUL : '#d0d5dd'), background: tab === t.k ? AZUL : '#fff', color: tab === t.k ? '#fff' : '#344054' }}>
                {t.t}{t.n ? ` (${t.n})` : ''}
              </button>))}
          </div>
          {cargando && <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>}

          {!cargando && tab === 'mias' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={card}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Nueva guía de traslado</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}><span style={label}>Origen (puedes cambiarlo después)</span>
                    <select value={nuevaOrigen} onChange={e => setNuevaOrigen(e.target.value)} style={input}>
                      <option value="">Elegir más tarde</option>
                      <optgroup label="Bodegas">{ubicaciones.filter(u => u.tipo === 'bodega').map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</optgroup>
                      <optgroup label="Centros de Costo (CECO)">{ubicaciones.filter(u => u.tipo === 'faena').map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</optgroup>
                    </select></div>
                  <button onClick={crearGuia} style={btn()}>Crear guía</button>
                </div>
              </div>
              {mias.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>Aún no has creado guías.</p> : mias.map(g => fila(g, false))}
            </div>
          )}

          {!cargando && tab === 'aprobar' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {porAprobar.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>No hay guías esperando aprobación.</p> : porAprobar.map(g => fila(g, true))}
            </div>
          )}

          {!cargando && tab === 'todas' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ ...label, margin: 0 }}>Estado</span>
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ ...input, width: 'auto', minWidth: '200px' }}>
                  <option value="">Todos</option>
                  {(Object.keys(ESTADOS) as Estado[]).map(k => <option key={k} value={k}>{ESTADOS[k].texto}</option>)}
                </select>
              </div>
              {todas.filter(g => g.estado !== 'borrador' || g.creado_por === usuario!.id).length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>No hay guías.</p> : todas.filter(g => g.estado !== 'borrador' || g.creado_por === usuario!.id).map(g => fila(g, true))}
            </div>
          )}
        </>)}
      </div>
    </main>
  )
}

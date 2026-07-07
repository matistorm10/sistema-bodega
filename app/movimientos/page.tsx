'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

const tabs = ['Ingreso', 'Traslado', 'Cambio estado', 'Devolución', 'Pérdida', 'Historial']

export default function Movimientos() {
  const { usuario } = useUsuarioActual()
  const [tab, setTab] = useState('Ingreso')
  const [clase, setClase] = useState('propio')
  const [categorias, setCategorias] = useState<any[]>([])
  const [tipos, setTipos] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [catSel, setCatSel] = useState('')
  const [tipoSel, setTipoSel] = useState('')
  const [dstSel, setDstSel] = useState('')
  const [modelo, setModelo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [retornable, setRetornable] = useState('1')
  const [cantidad, setCantidad] = useState(1)
  const [exito, setExito] = useState('')

  // --- Traslado ---
  const [origSel, setOrigSel] = useState('')
  const [itemsOrigen, setItemsOrigen] = useState<any[]>([]) // todo lo que existe físicamente en el origen elegido
  const [prodSel, setProdSel] = useState('')
  const [unidadSel, setUnidadSel] = useState('')
  const [cantTraslado, setCantTraslado] = useState(1)
  const [arriendosActivos, setArriendosActivos] = useState<any[]>([])
  const [arriendoSel, setArriendoSel] = useState('')

  // --- Cambio de estado ---
  const [estadoNuevo, setEstadoNuevo] = useState('')

  // --- Devolución ---
  const [fechaDevolucion, setFechaDevolucion] = useState(new Date().toISOString().split('T')[0])

  // --- Historial ---
  const [logAll, setLogAll] = useState<any[]>([])
  const [logUbicacionSel, setLogUbicacionSel] = useState('')
  const [logTipoSel, setLogTipoSel] = useState('')
  const [cargandoLog, setCargandoLog] = useState(false)

  useEffect(() => {
    supabase.from('categorias').select('*').order('orden').then(({data}) => setCategorias(data||[]))
    supabase.from('ubicaciones').select('*').order('nombre').then(({data}) => setUbicaciones(data||[]))
  }, [])

  useEffect(() => {
    if (!catSel) { setTipos([]); setTipoSel(''); return }
    supabase.from('tipos').select('*').eq('categoria_id', catSel).order('nombre').then(({data}) => { setTipos(data||[]); setTipoSel('') })
  }, [catSel])

  // Trae SOLO lo que existe físicamente en la ubicación elegida (unidades con código + stock con cantidad > 0)
  // Se usa tanto en Traslado como en Cambio estado
  useEffect(() => {
    if ((tab !== 'Traslado' && tab !== 'Cambio estado' && tab !== 'Pérdida') || clase !== 'propio' || !origSel) { setItemsOrigen([]); return }
    Promise.all([
      supabase.from('unidades').select('id, codigo, estado, producto_id, productos(nombre, retornable, tipo_id, tipos(nombre, categoria_id, categorias(nombre)))').eq('ubicacion_id', origSel).neq('estado','baja'),
      supabase.from('stock').select('id, cantidad, producto_id, productos(nombre, retornable, tipo_id, tipos(nombre, categoria_id, categorias(nombre)))').eq('ubicacion_id', origSel).gt('cantidad', 0)
    ]).then(([unidadesRes, stockRes]) => {
      const deUnidades = (unidadesRes.data||[]).map((u:any) => ({
        producto_id: u.producto_id, producto_nombre: u.productos?.nombre, retornable: true,
        tipo_id: u.productos?.tipo_id, tipo_nombre: u.productos?.tipos?.nombre,
        categoria_id: u.productos?.tipos?.categoria_id, categoria_nombre: u.productos?.tipos?.categorias?.nombre,
        unidad_id: u.id, codigo: u.codigo, estado: u.estado
      }))
      const deStock = (stockRes.data||[]).map((s:any) => ({
        producto_id: s.producto_id, producto_nombre: s.productos?.nombre, retornable: false,
        tipo_id: s.productos?.tipo_id, tipo_nombre: s.productos?.tipos?.nombre,
        categoria_id: s.productos?.tipos?.categoria_id, categoria_nombre: s.productos?.tipos?.categorias?.nombre,
        stock_id: s.id, cantidad: s.cantidad
      }))
      setItemsOrigen([...deUnidades, ...deStock])
    })
  }, [origSel, tab, clase])

  useEffect(() => {
    if (tab === 'Devolución') { /* siempre carga, no depende de "clase" porque acá no hay ese selector */ }
    else if ((tab !== 'Traslado' && tab !== 'Cambio estado' && tab !== 'Pérdida') || clase !== 'arrendado') return
    supabase.from('arriendos').select('*, tipos(nombre), ubicacion:ubicacion_id(nombre)').eq('estado','activo').order('descripcion')
      .then(({data}) => setArriendosActivos(data||[]))
  }, [tab, clase])

  // Si cambias el origen, se limpian las selecciones de abajo (categoría/tipo/producto/unidad/equipo ya no aplican)
  useEffect(() => { setCatSel(''); setTipoSel(''); setProdSel(''); setUnidadSel(''); setCantTraslado(1); setEstadoNuevo(''); setArriendoSel('') }, [origSel])
  // Si cambias el tipo, se limpia el producto/unidad elegidos
  useEffect(() => { setProdSel(''); setUnidadSel(''); setCantTraslado(1); setEstadoNuevo('') }, [tipoSel])
  // Si cambias la unidad elegida, se limpia el estado nuevo seleccionado
  useEffect(() => { setEstadoNuevo('') }, [unidadSel, arriendoSel])

  useEffect(() => {
    if (tab !== 'Historial') return
    setCargandoLog(true)
    supabase.from('movimientos_log').select('*').order('created_at', { ascending: false }).limit(300).then(({data, error}) => {
      if (error) console.error('No se pudo cargar el historial:', error.message)
      setLogAll(data || [])
      setCargandoLog(false)
    })
  }, [tab])

  // Filtra el historial por ubicación (si el movimiento tuvo esa ubicación como origen o destino)
  const logFiltrado = logAll
    .filter(l => !logUbicacionSel || l.ubicacion_origen_id === logUbicacionSel || l.ubicacion_destino_id === logUbicacionSel)
    .filter(l => !logTipoSel || l.tipo === logTipoSel)
  const etiquetasLog: Record<string, string> = { ingreso: 'Ingresos', traslado: 'Traslados', cambio_estado: 'Cambios de estado', devolucion: 'Devoluciones', perdida: 'Pérdidas' }
  const logStats = Object.keys(etiquetasLog).map(k => ({ tipo: k, etiqueta: etiquetasLog[k], total: logAll.filter(l => (!logUbicacionSel || l.ubicacion_origen_id === logUbicacionSel || l.ubicacion_destino_id === logUbicacionSel) && l.tipo === k).length }))
  const logItems = logFiltrado.slice(0, 100)

  // Categorías, tipos y productos disponibles EN EL ORIGEN elegido (solo lo que realmente hay ahí)
  const categoriasOrigen = Array.from(new Map(itemsOrigen.map(i => [i.categoria_id, {id: i.categoria_id, nombre: i.categoria_nombre}])).values())
  const tiposOrigen = Array.from(new Map(itemsOrigen.filter(i => i.categoria_id === catSel).map(i => [i.tipo_id, {id: i.tipo_id, nombre: i.tipo_nombre}])).values())
  const productosOrigen = Array.from(new Map(itemsOrigen.filter(i => i.tipo_id === tipoSel).map(i => [i.producto_id, {id: i.producto_id, nombre: i.producto_nombre, retornable: i.retornable}])).values())
  const prodInfo = productosOrigen.find(p => p.id === prodSel)
  const unidadesDelProducto = itemsOrigen.filter(i => i.producto_id === prodSel && i.retornable)
  const stockDelProducto = itemsOrigen.find(i => i.producto_id === prodSel && !i.retornable)?.cantidad || 0

  // Igual que arriba, pero solo herramientas CON CÓDIGO (el stock a granel no tiene estado individual) — para Cambio de estado
  const itemsConCodigo = itemsOrigen.filter(i => i.retornable)
  const categoriasConCodigo = Array.from(new Map(itemsConCodigo.map(i => [i.categoria_id, {id: i.categoria_id, nombre: i.categoria_nombre}])).values())
  const tiposConCodigo = Array.from(new Map(itemsConCodigo.filter(i => i.categoria_id === catSel).map(i => [i.tipo_id, {id: i.tipo_id, nombre: i.tipo_nombre}])).values())
  const productosConCodigo = Array.from(new Map(itemsConCodigo.filter(i => i.tipo_id === tipoSel).map(i => [i.producto_id, {id: i.producto_id, nombre: i.producto_nombre}])).values())
  const prodInfoConCodigo = productosConCodigo.find(p => p.id === prodSel)

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena' && u.activa)

  // Restricción de Traslado: si es bodeguero, solo ve las ubicaciones que el admin le asignó
  const esAdmin = usuario?.rol === 'admin'
  const idsOrigenPermitidos = new Set((usuario?.permisos || []).filter(p => p.puede_origen).map(p => p.ubicacion_id))
  const idsDestinoPermitidos = new Set((usuario?.permisos || []).filter(p => p.puede_destino).map(p => p.ubicacion_id))
  const bodegasOrigenTraslado = esAdmin ? bodegas : bodegas.filter(b => idsOrigenPermitidos.has(b.id))
  const faenasOrigenTraslado = esAdmin ? faenas : faenas.filter(f => idsOrigenPermitidos.has(f.id))
  const bodegasDestinoTraslado = esAdmin ? bodegas : bodegas.filter(b => idsDestinoPermitidos.has(b.id))
  const faenasDestinoTraslado = esAdmin ? faenas : faenas.filter(f => idsDestinoPermitidos.has(f.id))

  const reset = () => {
    setCatSel(''); setTipoSel(''); setModelo(''); setCodigo(''); setDstSel(''); setCantidad(1)
    setOrigSel(''); setProdSel(''); setUnidadSel(''); setCantTraslado(1); setArriendoSel(''); setEstadoNuevo('')
    setFechaDevolucion(new Date().toISOString().split('T')[0])
  }

  const registrarLog = async (opts: {
    tipo: string, clase: string, descripcion: string,
    categoria?: string, tipoItem?: string, nombreItem?: string,
    ubOrigenId?: string, ubDestinoId?: string,
    detalle?: Record<string, any>
  }) => {
    const { error } = await supabase.from('movimientos_log').insert({
      tipo: opts.tipo, clase: opts.clase, descripcion: opts.descripcion,
      categoria: opts.categoria || null, tipo_item: opts.tipoItem || null, nombre_item: opts.nombreItem || null,
      ubicacion_origen_id: opts.ubOrigenId || null, ubicacion_destino_id: opts.ubDestinoId || null,
      detalle: opts.detalle || null
    })
    if (error) console.error('No se pudo guardar en el historial:', error.message)
  }

  const registrar = async () => {
    if (!tipoSel || !dstSel || !modelo) { alert('Completa todos los campos.'); return }
    let productoId = ''
    const { data: prodExist } = await supabase.from('productos').select('id').eq('tipo_id', tipoSel).eq('nombre', modelo).single()
    if (prodExist) { productoId = prodExist.id }
    else {
      const { data: newProd } = await supabase.from('productos').insert({tipo_id: tipoSel, nombre: modelo, retornable: retornable==='1', unidad: 'un', revisado: false}).select('id').single()
      productoId = newProd?.id
    }
    if (retornable === '1') {
      if (!codigo) { alert('Ingresa el código único.'); return }
      await supabase.from('unidades').insert({producto_id: productoId, codigo, estado: 'bueno', ubicacion_id: dstSel})
    } else {
      const { data: stockEx } = await supabase.from('stock').select('id, cantidad').eq('producto_id', productoId).eq('ubicacion_id', dstSel).single()
      if (stockEx) { await supabase.from('stock').update({cantidad: stockEx.cantidad + cantidad}).eq('id', stockEx.id) }
      else { await supabase.from('stock').insert({producto_id: productoId, ubicacion_id: dstSel, cantidad}) }
    }
    registrarLog({
      tipo: 'ingreso', clase: 'propio',
      descripcion: `${modelo} ingresado en ${ubicaciones.find(u=>u.id===dstSel)?.nombre}`,
      categoria: categorias.find(c=>c.id===catSel)?.nombre, tipoItem: tipos.find(t=>t.id===tipoSel)?.nombre, nombreItem: modelo,
      ubDestinoId: dstSel,
      detalle: retornable === '1' ? { codigo } : { cantidad }
    })
    setExito(`${modelo} registrado en ${ubicaciones.find(u=>u.id===dstSel)?.nombre}.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const registrarArriendo = async () => {
    const prov = (document.getElementById('arr-prov') as HTMLInputElement)?.value
    const oc = (document.getElementById('arr-oc') as HTMLInputElement)?.value
    const vd = Number((document.getElementById('arr-vd') as HTMLInputElement)?.value)
    const fi = (document.getElementById('arr-fi') as HTMLInputElement)?.value
    if (!modelo || !prov || !vd || !fi || !dstSel) { alert('Completa todos los campos.'); return }
    await supabase.from('arriendos').insert({
      descripcion: modelo, categoria_id: catSel||null, tipo_id: tipoSel||null,
      proveedor: prov, orden_compra: oc, valor_dia: vd,
      fecha_inicio: fi, ubicacion_id: dstSel, estado: 'activo', estado_fisico: 'bueno'
    })
    registrarLog({
      tipo: 'ingreso', clase: 'arrendado',
      descripcion: `${modelo} ingresado en ${ubicaciones.find(u=>u.id===dstSel)?.nombre}`,
      categoria: categorias.find(c=>c.id===catSel)?.nombre, tipoItem: tipos.find(t=>t.id===tipoSel)?.nombre, nombreItem: modelo,
      ubDestinoId: dstSel,
      detalle: { proveedor: prov, orden_compra: oc, valor_dia: vd, fecha_inicio: fi }
    })
    setExito(`${modelo} registrado en ${ubicaciones.find(u=>u.id===dstSel)?.nombre}.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const registrarTraslado = async () => {
    if (!prodSel || !origSel || !dstSel) { alert('Completa todos los campos.'); return }
    if (origSel === dstSel) { alert('El destino debe ser distinto al origen.'); return }
    if (prodInfo?.retornable) {
      if (!unidadSel) { alert('Selecciona la unidad a trasladar.'); return }
      const { error, data } = await supabase.from('unidades').update({ ubicacion_id: dstSel }).eq('id', unidadSel).select()
      if (error) { alert('No se pudo trasladar (error de la base de datos): ' + error.message); return }
      if (!data || data.length === 0) { alert('El traslado no se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "unidades" en Supabase.'); return }
    } else {
      if (cantTraslado < 1 || cantTraslado > stockDelProducto) { alert('Cantidad inválida (máx. ' + stockDelProducto + ').'); return }
      const { data: origRow } = await supabase.from('stock').select('id, cantidad').eq('producto_id', prodSel).eq('ubicacion_id', origSel).single()
      if (!origRow) { alert('No hay stock en el origen.'); return }
      const { error: errOrig, data: dataOrig } = await supabase.from('stock').update({ cantidad: origRow.cantidad - cantTraslado }).eq('id', origRow.id).select()
      if (errOrig) { alert('No se pudo descontar del origen: ' + errOrig.message); return }
      if (!dataOrig || dataOrig.length === 0) { alert('El descuento en el origen no se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "stock" en Supabase.'); return }
      const { data: dstRow } = await supabase.from('stock').select('id, cantidad').eq('producto_id', prodSel).eq('ubicacion_id', dstSel).single()
      if (dstRow) {
        const { error: errDst } = await supabase.from('stock').update({ cantidad: dstRow.cantidad + cantTraslado }).eq('id', dstRow.id)
        if (errDst) { alert('No se pudo sumar en el destino: ' + errDst.message); return }
      } else {
        const { error: errIns } = await supabase.from('stock').insert({ producto_id: prodSel, ubicacion_id: dstSel, cantidad: cantTraslado })
        if (errIns) { alert('No se pudo crear el stock en el destino: ' + errIns.message); return }
      }
    }
    registrarLog({
      tipo: 'traslado', clase: 'propio',
      descripcion: `${prodInfo?.nombre} trasladado de ${ubicaciones.find(u=>u.id===origSel)?.nombre} a ${ubicaciones.find(u=>u.id===dstSel)?.nombre}`,
      categoria: categoriasOrigen.find(c=>c.id===catSel)?.nombre, tipoItem: tiposOrigen.find(t=>t.id===tipoSel)?.nombre, nombreItem: prodInfo?.nombre,
      ubOrigenId: origSel, ubDestinoId: dstSel,
      detalle: prodInfo?.retornable ? { codigo: unidadesDelProducto.find(u=>u.unidad_id===unidadSel)?.codigo } : { cantidad: cantTraslado }
    })
    setExito(`${prodInfo?.nombre} trasladado a ${ubicaciones.find(u=>u.id===dstSel)?.nombre}.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const registrarTrasladoArriendo = async () => {
    if (!arriendoSel || !dstSel) { alert('Completa todos los campos.'); return }
    const ar = arriendosActivos.find(a => a.id === arriendoSel)
    if (ar?.ubicacion_id === dstSel) { alert('El destino debe ser distinto al origen.'); return }
    await supabase.from('arriendos').update({ ubicacion_id: dstSel }).eq('id', arriendoSel)
    registrarLog({
      tipo: 'traslado', clase: 'arrendado',
      descripcion: `${ar?.descripcion} trasladado de ${ubicaciones.find(u=>u.id===origSel)?.nombre} a ${ubicaciones.find(u=>u.id===dstSel)?.nombre}`,
      categoria: categorias.find(c=>c.id===ar?.categoria_id)?.nombre, tipoItem: ar?.tipos?.nombre, nombreItem: ar?.descripcion,
      ubOrigenId: origSel, ubDestinoId: dstSel,
      detalle: { proveedor: ar?.proveedor, orden_compra: ar?.orden_compra }
    })
    setExito(`${ar?.descripcion} trasladado a ${ubicaciones.find(u=>u.id===dstSel)?.nombre}.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const guardarCambioEstado = async () => {
    if (!unidadSel || !estadoNuevo) { alert('Selecciona la herramienta y el nuevo estado.'); return }
    const { error, data } = await supabase.from('unidades').update({ estado: estadoNuevo }).eq('id', unidadSel).select()
    if (error) { alert('No se pudo guardar el cambio de estado: ' + error.message); return }
    if (!data || data.length === 0) { alert('El cambio no se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "unidades" en Supabase.'); return }
    registrarLog({
      tipo: 'cambio_estado', clase: 'propio',
      descripcion: `${prodInfoConCodigo?.nombre} cambiado a ${estadoNuevo}`,
      categoria: categoriasConCodigo.find(c=>c.id===catSel)?.nombre, tipoItem: tiposConCodigo.find(t=>t.id===tipoSel)?.nombre, nombreItem: prodInfoConCodigo?.nombre,
      ubOrigenId: origSel,
      detalle: { codigo: unidadesDelProducto.find(u=>u.unidad_id===unidadSel)?.codigo, estado_anterior: unidadesDelProducto.find(u=>u.unidad_id===unidadSel)?.estado, estado_nuevo: estadoNuevo }
    })
    setExito(`${prodInfoConCodigo?.nombre} (${unidadesDelProducto.find(u=>u.unidad_id===unidadSel)?.codigo}) marcado como ${estadoNuevo}.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const guardarCambioEstadoArriendo = async () => {
    if (!arriendoSel || !estadoNuevo) { alert('Selecciona el equipo y el nuevo estado.'); return }
    const ar = arriendosActivos.find(a => a.id === arriendoSel)
    const { error, data } = await supabase.from('arriendos').update({ estado_fisico: estadoNuevo }).eq('id', arriendoSel).select()
    if (error) { alert('No se pudo guardar el cambio de estado: ' + error.message); return }
    if (!data || data.length === 0) { alert('El cambio no se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "arriendos" en Supabase.'); return }
    registrarLog({
      tipo: 'cambio_estado', clase: 'arrendado',
      descripcion: `${ar?.descripcion} cambiado a ${estadoNuevo}`,
      categoria: categorias.find(c=>c.id===ar?.categoria_id)?.nombre, tipoItem: ar?.tipos?.nombre, nombreItem: ar?.descripcion,
      ubOrigenId: origSel,
      detalle: { proveedor: ar?.proveedor, orden_compra: ar?.orden_compra, estado_anterior: ar?.estado_fisico, estado_nuevo: estadoNuevo }
    })
    setExito(`${ar?.descripcion} marcado como ${estadoNuevo}.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const registrarDevolucion = async () => {
    if (!arriendoSel || !fechaDevolucion) { alert('Selecciona el equipo y la fecha de devolución.'); return }
    const ar = arriendosActivos.find(a => a.id === arriendoSel)
    if (ar && fechaDevolucion < ar.fecha_inicio) { alert('La fecha de devolución no puede ser anterior a la fecha de retiro (' + ar.fecha_inicio + ').'); return }
    const { error, data } = await supabase.from('arriendos').update({ estado: 'devuelto', fecha_devolucion: fechaDevolucion }).eq('id', arriendoSel).select()
    if (error) { alert('No se pudo registrar la devolución: ' + error.message); return }
    if (!data || data.length === 0) { alert('La devolución no se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "arriendos" en Supabase.'); return }
    const diasArr = ar ? Math.max(1, Math.round((new Date(fechaDevolucion).getTime() - new Date(ar.fecha_inicio).getTime()) / 86400000)) : 0
    const valorTotal = ar ? diasArr * ar.valor_dia : 0
    registrarLog({
      tipo: 'devolucion', clase: 'arrendado',
      descripcion: `${ar?.descripcion} devuelto`,
      categoria: categorias.find(c=>c.id===ar?.categoria_id)?.nombre, tipoItem: ar?.tipos?.nombre, nombreItem: ar?.descripcion,
      ubOrigenId: origSel,
      detalle: { proveedor: ar?.proveedor, orden_compra: ar?.orden_compra, valor_dia: ar?.valor_dia, fecha_inicio: ar?.fecha_inicio, fecha_devolucion: fechaDevolucion, dias: diasArr, valor_total: valorTotal }
    })
    setExito(`${ar?.descripcion} devuelto el ${fechaDevolucion}.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const registrarPerdidaPropio = async () => {
    if (!prodSel) { alert('Selecciona la herramienta.'); return }
    if (prodInfo?.retornable) {
      if (!unidadSel) { alert('Selecciona el elemento exacto.'); return }
      if (!confirm('¿Confirmas dar de baja esta herramienta? No podrás deshacer esto.')) return
      const { error, data } = await supabase.from('unidades').update({ estado: 'baja' }).eq('id', unidadSel).select()
      if (error) { alert('No se pudo registrar la pérdida: ' + error.message); return }
      if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "unidades" en Supabase.'); return }
      registrarLog({
        tipo: 'perdida', clase: 'propio',
        descripcion: `${prodInfo.nombre} dado de baja`,
        categoria: categoriasOrigen.find(c=>c.id===catSel)?.nombre, tipoItem: tiposOrigen.find(t=>t.id===tipoSel)?.nombre, nombreItem: prodInfo.nombre,
        ubOrigenId: origSel,
        detalle: { codigo: unidadesDelProducto.find(u=>u.unidad_id===unidadSel)?.codigo }
      })
      setExito(`${prodInfo.nombre} (${unidadesDelProducto.find(u=>u.unidad_id===unidadSel)?.codigo}) dado de baja.`)
    } else {
      if (cantTraslado < 1 || cantTraslado > stockDelProducto) { alert('Cantidad inválida (máx. ' + stockDelProducto + ').'); return }
      if (!confirm(`¿Confirmas registrar la pérdida de ${cantTraslado} unidades? No podrás deshacer esto.`)) return
      const { data: row } = await supabase.from('stock').select('id, cantidad').eq('producto_id', prodSel).eq('ubicacion_id', origSel).single()
      if (!row) { alert('No hay stock en esta ubicación.'); return }
      const { error, data } = await supabase.from('stock').update({ cantidad: row.cantidad - cantTraslado }).eq('id', row.id).select()
      if (error) { alert('No se pudo registrar la pérdida: ' + error.message); return }
      if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "stock" en Supabase.'); return }
      registrarLog({
        tipo: 'perdida', clase: 'propio',
        descripcion: `${prodInfo?.nombre} perdido en ${ubicaciones.find(u=>u.id===origSel)?.nombre}`,
        categoria: categoriasOrigen.find(c=>c.id===catSel)?.nombre, tipoItem: tiposOrigen.find(t=>t.id===tipoSel)?.nombre, nombreItem: prodInfo?.nombre,
        ubOrigenId: origSel,
        detalle: { cantidad: cantTraslado }
      })
      setExito(`Pérdida de ${cantTraslado} unidades de ${prodInfo?.nombre} registrada.`)
    }
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const registrarPerdidaArriendo = async () => {
    if (!arriendoSel) { alert('Selecciona el equipo.'); return }
    const ar = arriendosActivos.find(a => a.id === arriendoSel)
    if (!confirm('¿Confirmas registrar la pérdida de este equipo arrendado? No podrás deshacer esto.')) return
    const hoy = new Date().toISOString().split('T')[0]
    const { error, data } = await supabase.from('arriendos').update({ estado: 'perdido', fecha_devolucion: hoy }).eq('id', arriendoSel).select()
    if (error) { alert('No se pudo registrar la pérdida: ' + error.message); return }
    if (!data || data.length === 0) { alert('No se guardó. Probablemente falten permisos (RLS) para actualizar la tabla "arriendos" en Supabase.'); return }
    registrarLog({
      tipo: 'perdida', clase: 'arrendado',
      descripcion: `${ar?.descripcion} registrado como perdido`,
      categoria: categorias.find(c=>c.id===ar?.categoria_id)?.nombre, tipoItem: ar?.tipos?.nombre, nombreItem: ar?.descripcion,
      ubOrigenId: origSel,
      detalle: { proveedor: ar?.proveedor, orden_compra: ar?.orden_compra }
    })
    setExito(`${ar?.descripcion} registrado como perdido.`)
    reset()
    setTimeout(() => setExito(''), 4000)
  }

  const selDst = <div style={{marginBottom:'14px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Destino</label>
    <select value={dstSel} onChange={e=>setDstSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona destino...</option>
      <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
      <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
    </select>
  </div>

  const selOrigen = <div style={{marginBottom:'10px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Origen</label>
    <select value={origSel} onChange={e=>{setOrigSel(e.target.value); setDstSel('')}} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona origen...</option>
      <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
      <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
    </select>
  </div>

  const selDstSinOrigen = <div style={{marginBottom:'14px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Destino</label>
    <select value={dstSel} onChange={e=>setDstSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona destino...</option>
      <optgroup label='Bodegas'>{bodegas.filter(b=>b.id!==origSel).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
      <optgroup label='Faenas'>{faenas.filter(f=>f.id!==origSel).map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
    </select>
  </div>

  // Solo para Traslado: origen/destino limitados a lo que el admin le asignó a este bodeguero
  const selOrigenTraslado = <div style={{marginBottom:'10px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Origen</label>
    <select value={origSel} onChange={e=>{setOrigSel(e.target.value); setDstSel('')}} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona origen...</option>
      <optgroup label='Bodegas'>{bodegasOrigenTraslado.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
      <optgroup label='Faenas'>{faenasOrigenTraslado.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
    </select>
    {!esAdmin && bodegasOrigenTraslado.length + faenasOrigenTraslado.length === 0 && (
      <p style={{fontSize:'12px',color:'#c5221f',margin:'4px 0 0'}}>No tienes ninguna ubicación asignada como origen. Pídele al administrador que te la asigne en Usuarios.</p>
    )}
  </div>

  const selDstSinOrigenTraslado = <div style={{marginBottom:'14px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Destino</label>
    <select value={dstSel} onChange={e=>setDstSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona destino...</option>
      <optgroup label='Bodegas'>{bodegasDestinoTraslado.filter(b=>b.id!==origSel).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
      <optgroup label='Faenas'>{faenasDestinoTraslado.filter(f=>f.id!==origSel).map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
    </select>
    {!esAdmin && (bodegasDestinoTraslado.length + faenasDestinoTraslado.length === 0) && (
      <p style={{fontSize:'12px',color:'#c5221f',margin:'4px 0 0'}}>No tienes ningún destino asignado. Pídele al administrador que te lo asigne en Usuarios.</p>
    )}
  </div>

  const catTipoProdOrigen = <>
    <div style={{marginBottom:'10px'}}>
      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Categoría (solo con existencia en este origen)</label>
      <select value={catSel} onChange={e=>setCatSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
        <option value=''>Selecciona categoría...</option>
        {categoriasOrigen.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
    </div>
    {catSel && <div style={{marginBottom:'10px'}}>
      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label>
      <select value={tipoSel} onChange={e=>setTipoSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
        <option value=''>Selecciona tipo...</option>
        {tiposOrigen.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>
    </div>}
    {tipoSel && <div style={{marginBottom:'10px'}}>
      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Producto</label>
      <select value={prodSel} onChange={e=>setProdSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
        <option value=''>Selecciona producto...</option>
        {productosOrigen.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
    </div>}
  </>

  // Solo las ubicaciones que realmente tienen algún equipo arrendado activo
  const ubicacionesConArriendo = Array.from(new Map(arriendosActivos.map(a => [a.ubicacion_id, a.ubicacion?.nombre || '—'])).entries())
  const arriendosDeUbicacion = arriendosActivos.filter(a => a.ubicacion_id === origSel)

  const selUbicacionArriendo = <div style={{marginBottom:'10px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Ubicación</label>
    <select value={origSel} onChange={e=>setOrigSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona ubicación...</option>
      {ubicacionesConArriendo.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
    </select>
  </div>

  // Solo para Traslado: mismo filtro, pero limitado a las ubicaciones permitidas del bodeguero
  const ubicacionesConArriendoTraslado = esAdmin ? ubicacionesConArriendo : ubicacionesConArriendo.filter(([id]) => idsOrigenPermitidos.has(id))
  const selUbicacionArriendoTraslado = <div style={{marginBottom:'10px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Ubicación</label>
    <select value={origSel} onChange={e=>setOrigSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona ubicación...</option>
      {ubicacionesConArriendoTraslado.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
    </select>
    {!esAdmin && ubicacionesConArriendoTraslado.length === 0 && (
      <p style={{fontSize:'12px',color:'#c5221f',margin:'4px 0 0'}}>No tienes ninguna ubicación asignada como origen. Pídele al administrador que te la asigne en Usuarios.</p>
    )}
  </div>

  const fmtMoneda = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  const cardsArriendos = (lista: any[], seleccionado: string, onSelect: (id: string) => void) => (
    <div style={{display:'grid',gap:'8px',marginBottom:'14px'}}>
      {lista.map(a => {
        const sel = seleccionado === a.id
        return (
          <button key={a.id} type="button" onClick={()=>onSelect(a.id)} style={{textAlign:'left',cursor:'pointer',padding:'12px',borderRadius:'10px',border:sel?`1.5px solid ${AZUL}`:'0.5px solid #ddd',background:sel?'#e8f0fe':'#fff'}}>
            <p style={{fontWeight:'700',fontSize:'13px',margin:'0 0 4px'}}>{a.tipos?.nombre ? a.tipos.nombre+' — ' : ''}{a.descripcion}</p>
            <p style={{fontSize:'11px',color:'#666',margin:'0 0 2px'}}>Proveedor: {a.proveedor || '—'}{a.orden_compra ? ' · OC ' + a.orden_compra : ''}</p>
            <p style={{fontSize:'11px',color:'#666',margin:'0'}}>Retiro: {a.fecha_inicio} · {fmtMoneda(a.valor_dia)}/día · estado: {a.estado_fisico}</p>
          </button>
        )
      })}
    </div>
  )

  const catTipoProdConCodigo = <>
    <div style={{marginBottom:'10px'}}>
      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Categoría (solo herramientas con código en esta ubicación)</label>
      <select value={catSel} onChange={e=>setCatSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
        <option value=''>Selecciona categoría...</option>
        {categoriasConCodigo.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
    </div>
    {catSel && <div style={{marginBottom:'10px'}}>
      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label>
      <select value={tipoSel} onChange={e=>setTipoSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
        <option value=''>Selecciona tipo...</option>
        {tiposConCodigo.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>
    </div>}
    {tipoSel && <div style={{marginBottom:'10px'}}>
      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Producto</label>
      <select value={prodSel} onChange={e=>setProdSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
        <option value=''>Selecciona producto...</option>
        {productosConCodigo.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
    </div>}
  </>

  const catTipoSel = <><div style={{marginBottom:'10px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Categoría</label>
    <select value={catSel} onChange={e=>setCatSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona categoría...</option>
      {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </select>
  </div>
  {catSel && <div style={{marginBottom:'10px'}}>
    <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label>
    <select value={tipoSel} onChange={e=>setTipoSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
      <option value=''>Selecciona tipo...</option>
      {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
    </select>
  </div>}</>

  if (exito) return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto',textAlign:'center',paddingTop:'4rem'}}>
      <div style={{fontSize:'48px',marginBottom:'12px'}}>✅</div>
      <p style={{fontSize:'16px',fontWeight:'600',margin:'0 0 8px',color:'#137333'}}>Movimiento registrado</p>
      <p style={{fontSize:'13px',color:'#666',margin:'0 0 24px'}}>{exito}</p>
      <button onClick={()=>setExito('')} style={{padding:'10px 24px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar otro</button>
    </main>
  )

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Movimientos</h1>
      </div>

      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'1rem'}}>
        {tabs.map(t => (
          <button key={t} onClick={()=>{setTab(t);reset()}} style={{padding:'6px 12px',borderRadius:'20px',border:'0.5px solid',fontSize:'12px',cursor:'pointer',background:tab===t?AZUL:'#fff',color:tab===t?'#fff':'#444',borderColor:tab===t?AZUL:'#ddd'}}>{t}</button>
        ))}
      </div>

      {tab !== 'Devolución' && tab !== 'Historial' && (
        <div style={{display:'flex',gap:'8px',marginBottom:'1rem'}}>
          {['propio','arrendado'].map(c => (
            <button key={c} onClick={()=>{setClase(c);reset()}} style={{flex:1,padding:'8px',borderRadius:'8px',border:'0.5px solid',fontSize:'13px',cursor:'pointer',background:clase===c?'#e8f0fe':'#fff',color:clase===c?AZUL:'#444',borderColor:clase===c?AZUL:'#ddd'}}>
              {c === 'propio' ? '🔧 Herramienta propia' : '🏗 Equipo arrendado'}
            </button>
          ))}
        </div>
      )}

      {/* INGRESO PROPIO */}
      {tab === 'Ingreso' && clase === 'propio' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {catTipoSel}
          {tipoSel && <>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Modelo / descripción</label>
              <input value={modelo} onChange={e=>setModelo(e.target.value)} placeholder="Ej: Taladro Bosch GSB 13" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>¿Retornable?</label>
              <select value={retornable} onChange={e=>setRetornable(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
                <option value='1'>Sí — código único por unidad</option>
                <option value='0'>No — consumible por cantidad</option>
              </select>
            </div>
            {retornable==='1' ? (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Código único</label>
                <input value={codigo} onChange={e=>setCodigo(e.target.value)} placeholder="Ej: BSH-001" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
              </div>
            ) : (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cantidad</label>
                <input type='number' value={cantidad} onChange={e=>setCantidad(Number(e.target.value))} min={1} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
              </div>
            )}
            {selDst}
            <button onClick={registrar} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar ingreso</button>
          </>}
        </div>
      )}

      {/* INGRESO ARRENDADO */}
      {tab === 'Ingreso' && clase === 'arrendado' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {catTipoSel}
          {tipoSel && <>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Descripción / identificación única</label>
              <input value={modelo} onChange={e=>setModelo(e.target.value)} placeholder="Ej: Hilti TE 70, N° serie 12345" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Proveedor</label>
              <input id="arr-prov" placeholder="Ej: Rental SpA" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>N° OC</label>
              <input id="arr-oc" placeholder="Ej: OC-4521" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Valor por día ($)</label>
              <input id="arr-vd" type="number" placeholder="Ej: 15000" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Fecha de retiro</label>
              <input id="arr-fi" type="date" defaultValue={new Date().toISOString().split('T')[0]} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
            {selDst}
            <button onClick={registrarArriendo} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar arriendo</button>
          </>}
        </div>
      )}

      {/* TRASLADO PROPIO */}
      {tab === 'Traslado' && clase === 'propio' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {selOrigenTraslado}
          {origSel && categoriasOrigen.length === 0 && (
            <p style={{fontSize:'13px',color:'#c5221f',margin:'0'}}>Esta ubicación no tiene herramientas propias registradas.</p>
          )}
          {origSel && categoriasOrigen.length > 0 && catTipoProdOrigen}
          {origSel && prodSel && (() => {
            if (prodInfo?.retornable) {
              const estadoColor = (e: string) => e === 'bueno' ? {bg:'#e6f4ea',fg:'#137333'} : e === 'malo' ? {bg:'#fce8e6',fg:'#c5221f'} : {bg:'#fef7e0',fg:'#986a00'}
              return (
                <div style={{marginBottom:'10px'}}>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Elemento exacto a trasladar — {prodInfo.nombre}</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                    {unidadesDelProducto.map(u => {
                      const c = estadoColor(u.estado)
                      const sel = unidadSel === u.unidad_id
                      return (
                        <button key={u.unidad_id} type="button" onClick={()=>setUnidadSel(u.unidad_id)} style={{textAlign:'left',cursor:'pointer',padding:'10px',borderRadius:'10px',border:sel?`1.5px solid ${AZUL}`:'0.5px solid #ddd',background:sel?'#e8f0fe':'#fff'}}>
                          <p style={{fontWeight:'700',fontSize:'13px',margin:'0 0 4px'}}>{u.codigo}</p>
                          <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'4px',background:c.bg,color:c.fg}}>{u.estado}</span>
                        </button>
                      )
                    })}
                  </div>
                  {unidadSel && <p style={{fontSize:'12px',color:AZUL,margin:'8px 0 0'}}>Seleccionado: {unidadesDelProducto.find(u=>u.unidad_id===unidadSel)?.codigo}</p>}
                </div>
              )
            }
            return (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cantidad a trasladar (disp: {stockDelProducto})</label>
                <input type='number' value={cantTraslado} min={1} max={stockDelProducto} onChange={e=>setCantTraslado(Number(e.target.value))} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
              </div>
            )
          })()}
          {origSel && prodSel && ((prodInfo?.retornable && unidadSel) || (!prodInfo?.retornable && stockDelProducto > 0)) && <>
            {selDstSinOrigenTraslado}
            <button onClick={registrarTraslado} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar traslado</button>
          </>}
        </div>
      )}


      {/* TRASLADO ARRENDADO */}
      {tab === 'Traslado' && clase === 'arrendado' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {ubicacionesConArriendoTraslado.length === 0 ? (
            <p style={{fontSize:'13px',color:'#999',margin:'0'}}>{esAdmin ? 'No hay equipos arrendados activos.' : 'No tienes ubicaciones asignadas con equipos arrendados.'}</p>
          ) : (
            <>
              {selUbicacionArriendoTraslado}
              {origSel && arriendosDeUbicacion.length === 0 && (
                <p style={{fontSize:'13px',color:'#c5221f',margin:'0'}}>Esta ubicación no tiene equipos arrendados.</p>
              )}
              {origSel && arriendosDeUbicacion.length > 0 && cardsArriendos(arriendosDeUbicacion, arriendoSel, setArriendoSel)}
              {arriendoSel && <>
                {selDstSinOrigenTraslado}
                <button onClick={registrarTrasladoArriendo} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar traslado</button>
              </>}
            </>
          )}
        </div>
      )}

      {/* CAMBIO DE ESTADO PROPIO */}
      {tab === 'Cambio estado' && clase === 'propio' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {selOrigen}
          {origSel && categoriasConCodigo.length === 0 && (
            <p style={{fontSize:'13px',color:'#c5221f',margin:'0'}}>Esta ubicación no tiene herramientas con código registradas.</p>
          )}
          {origSel && categoriasConCodigo.length > 0 && catTipoProdConCodigo}
          {origSel && prodSel && (() => {
            const estadoColor = (e: string) => e === 'bueno' ? {bg:'#e6f4ea',fg:'#137333'} : e === 'malo' ? {bg:'#fce8e6',fg:'#c5221f'} : {bg:'#fef7e0',fg:'#986a00'}
            return (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Elemento exacto — {prodInfoConCodigo?.nombre}</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  {unidadesDelProducto.map(u => {
                    const c = estadoColor(u.estado)
                    const sel = unidadSel === u.unidad_id
                    return (
                      <button key={u.unidad_id} type="button" onClick={()=>setUnidadSel(u.unidad_id)} style={{textAlign:'left',cursor:'pointer',padding:'10px',borderRadius:'10px',border:sel?`1.5px solid ${AZUL}`:'0.5px solid #ddd',background:sel?'#e8f0fe':'#fff'}}>
                        <p style={{fontWeight:'700',fontSize:'13px',margin:'0 0 4px'}}>{u.codigo}</p>
                        <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'4px',background:c.bg,color:c.fg}}>Actual: {u.estado}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
          {unidadSel && <>
            <div style={{marginBottom:'14px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Nuevo estado</label>
              <div style={{display:'flex',gap:'8px'}}>
                <button type="button" onClick={()=>setEstadoNuevo('bueno')} style={{flex:1,padding:'10px',borderRadius:'8px',border:estadoNuevo==='bueno'?'1.5px solid #137333':'0.5px solid #ddd',background:estadoNuevo==='bueno'?'#e6f4ea':'#fff',color:'#137333',fontWeight:'600',fontSize:'13px',cursor:'pointer'}}>✅ Bueno</button>
                <button type="button" onClick={()=>setEstadoNuevo('malo')} style={{flex:1,padding:'10px',borderRadius:'8px',border:estadoNuevo==='malo'?'1.5px solid #c5221f':'0.5px solid #ddd',background:estadoNuevo==='malo'?'#fce8e6':'#fff',color:'#c5221f',fontWeight:'600',fontSize:'13px',cursor:'pointer'}}>⚠️ Malo</button>
              </div>
            </div>
            {estadoNuevo && <button onClick={guardarCambioEstado} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Guardar cambio de estado</button>}
          </>}
        </div>
      )}

      {/* CAMBIO DE ESTADO ARRENDADO */}
      {tab === 'Cambio estado' && clase === 'arrendado' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {ubicacionesConArriendo.length === 0 ? (
            <p style={{fontSize:'13px',color:'#999',margin:'0'}}>No hay equipos arrendados activos.</p>
          ) : (
            <>
              {selUbicacionArriendo}
              {origSel && arriendosDeUbicacion.length === 0 && (
                <p style={{fontSize:'13px',color:'#c5221f',margin:'0'}}>Esta ubicación no tiene equipos arrendados.</p>
              )}
              {origSel && arriendosDeUbicacion.length > 0 && cardsArriendos(arriendosDeUbicacion, arriendoSel, setArriendoSel)}
              {arriendoSel && <>
                <div style={{marginBottom:'14px'}}>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Nuevo estado</label>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button type="button" onClick={()=>setEstadoNuevo('bueno')} style={{flex:1,padding:'10px',borderRadius:'8px',border:estadoNuevo==='bueno'?'1.5px solid #137333':'0.5px solid #ddd',background:estadoNuevo==='bueno'?'#e6f4ea':'#fff',color:'#137333',fontWeight:'600',fontSize:'13px',cursor:'pointer'}}>✅ Bueno</button>
                    <button type="button" onClick={()=>setEstadoNuevo('malo')} style={{flex:1,padding:'10px',borderRadius:'8px',border:estadoNuevo==='malo'?'1.5px solid #c5221f':'0.5px solid #ddd',background:estadoNuevo==='malo'?'#fce8e6':'#fff',color:'#c5221f',fontWeight:'600',fontSize:'13px',cursor:'pointer'}}>⚠️ Malo</button>
                  </div>
                </div>
                {estadoNuevo && <button onClick={guardarCambioEstadoArriendo} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Guardar cambio de estado</button>}
              </>}
            </>
          )}
        </div>
      )}

      {/* DEVOLUCIÓN */}
      {tab === 'Devolución' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {ubicacionesConArriendo.length === 0 ? (
            <p style={{fontSize:'13px',color:'#999',margin:'0'}}>No hay equipos arrendados activos.</p>
          ) : (
            <>
              {selUbicacionArriendo}
              {origSel && arriendosDeUbicacion.length === 0 && (
                <p style={{fontSize:'13px',color:'#c5221f',margin:'0'}}>Esta ubicación no tiene equipos arrendados.</p>
              )}
              {origSel && arriendosDeUbicacion.length > 0 && cardsArriendos(arriendosDeUbicacion, arriendoSel, setArriendoSel)}
              {arriendoSel && (() => {
                const ar = arriendosActivos.find(a => a.id === arriendoSel)
                const hoy = new Date().toISOString().split('T')[0]
                const dias = Math.max(1, Math.round((new Date(fechaDevolucion || hoy).getTime() - new Date(ar.fecha_inicio).getTime()) / 86400000))
                const costo = dias * ar.valor_dia
                const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
                return (
                  <>
                    <div style={{background:'#f8f9fa',borderRadius:'10px',padding:'12px 14px',marginBottom:'14px'}}>
                      <p style={{fontSize:'12px',color:'#666',margin:'0 0 2px'}}>Proveedor: {ar.proveedor}</p>
                      <p style={{fontSize:'12px',color:'#666',margin:'0 0 2px'}}>Retiro: {ar.fecha_inicio}</p>
                      <p style={{fontSize:'12px',color:'#666',margin:'0 0 8px'}}>Valor por día: {fmt(ar.valor_dia)}</p>
                      <div style={{borderTop:'0.5px solid #e0e0e0',paddingTop:'8px',display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontSize:'13px',color:'#333'}}>{dias} días acumulados</span>
                        <span style={{fontSize:'14px',fontWeight:'700'}}>{fmt(costo)}</span>
                      </div>
                    </div>
                    <div style={{marginBottom:'14px'}}>
                      <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Fecha de devolución</label>
                      <input type="date" value={fechaDevolucion} onChange={e=>setFechaDevolucion(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
                    </div>
                    <button onClick={registrarDevolucion} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:AZUL,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar devolución</button>
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* PÉRDIDA PROPIO */}
      {tab === 'Pérdida' && clase === 'propio' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {selOrigen}
          {origSel && categoriasOrigen.length === 0 && (
            <p style={{fontSize:'13px',color:'#c5221f',margin:'0'}}>Esta ubicación no tiene herramientas propias registradas.</p>
          )}
          {origSel && categoriasOrigen.length > 0 && catTipoProdOrigen}
          {origSel && prodSel && (() => {
            if (prodInfo?.retornable) {
              const estadoColor = (e: string) => e === 'bueno' ? {bg:'#e6f4ea',fg:'#137333'} : e === 'malo' ? {bg:'#fce8e6',fg:'#c5221f'} : {bg:'#fef7e0',fg:'#986a00'}
              return (
                <div style={{marginBottom:'10px'}}>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Elemento exacto perdido — {prodInfo.nombre}</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                    {unidadesDelProducto.map(u => {
                      const c = estadoColor(u.estado)
                      const sel = unidadSel === u.unidad_id
                      return (
                        <button key={u.unidad_id} type="button" onClick={()=>setUnidadSel(u.unidad_id)} style={{textAlign:'left',cursor:'pointer',padding:'10px',borderRadius:'10px',border:sel?'1.5px solid #c5221f':'0.5px solid #ddd',background:sel?'#fce8e6':'#fff'}}>
                          <p style={{fontWeight:'700',fontSize:'13px',margin:'0 0 4px'}}>{u.codigo}</p>
                          <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'4px',background:c.bg,color:c.fg}}>{u.estado}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            }
            return (
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cantidad perdida (disp: {stockDelProducto})</label>
                <input type='number' value={cantTraslado} min={1} max={stockDelProducto} onChange={e=>setCantTraslado(Number(e.target.value))} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
              </div>
            )
          })()}
          {origSel && prodSel && ((prodInfo?.retornable && unidadSel) || (!prodInfo?.retornable && stockDelProducto > 0)) && (
            <button onClick={registrarPerdidaPropio} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:'#c5221f',color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar pérdida</button>
          )}
        </div>
      )}

      {/* PÉRDIDA ARRENDADO */}
      {tab === 'Pérdida' && clase === 'arrendado' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          {ubicacionesConArriendo.length === 0 ? (
            <p style={{fontSize:'13px',color:'#999',margin:'0'}}>No hay equipos arrendados activos.</p>
          ) : (
            <>
              {selUbicacionArriendo}
              {origSel && arriendosDeUbicacion.length === 0 && (
                <p style={{fontSize:'13px',color:'#c5221f',margin:'0'}}>Esta ubicación no tiene equipos arrendados.</p>
              )}
              {origSel && arriendosDeUbicacion.length > 0 && cardsArriendos(arriendosDeUbicacion, arriendoSel, setArriendoSel)}
              {arriendoSel && (
                <button onClick={registrarPerdidaArriendo} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:'#c5221f',color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar pérdida</button>
              )}
            </>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {tab === 'Historial' && (() => {
        const tipoInfo: Record<string, {label:string, fg:string, bg:string}> = {
          ingreso: {label:'Ingreso', fg:'#137333', bg:'#e6f4ea'},
          traslado: {label:'Traslado', fg:AZUL, bg:'#e8f0fe'},
          cambio_estado: {label:'Cambio de estado', fg:'#986a00', bg:'#fef7e0'},
          devolucion: {label:'Devolución', fg:'#8430ce', bg:'#f3e8fd'},
          perdida: {label:'Pérdida', fg:'#c5221f', bg:'#fce8e6'},
        }
        const nombreUb = (id: string) => ubicaciones.find(u=>u.id===id)?.nombre
        const fmtM = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

        const renderDetalle = (item: any) => {
          const d = item.detalle || {}
          if (item.tipo === 'devolucion') {
            return (
              <div style={{background:'#f8f9fa',borderRadius:'8px',padding:'10px 12px',marginTop:'8px'}}>
                <p style={{fontSize:'11px',color:'#666',margin:'0 0 2px'}}>Proveedor: {d.proveedor || '—'} {d.orden_compra ? '· OC ' + d.orden_compra : ''}</p>
                <p style={{fontSize:'11px',color:'#666',margin:'0 0 2px'}}>Inicio: {d.fecha_inicio || '—'} → Término: {d.fecha_devolucion || '—'} ({d.dias ?? '—'} días)</p>
                <p style={{fontSize:'12px',color:'#333',fontWeight:'700',margin:'4px 0 0'}}>Valor total: {d.valor_total != null ? fmtM(d.valor_total) : '—'} <span style={{fontWeight:'400',color:'#888'}}>({d.valor_dia != null ? fmtM(d.valor_dia) : '—'}/día)</span></p>
              </div>
            )
          }
          if (item.tipo === 'ingreso') {
            return (
              <p style={{fontSize:'11px',color:'#888',margin:'6px 0 0'}}>
                {d.codigo ? `Código: ${d.codigo}` : d.cantidad != null ? `Cantidad: ${d.cantidad}` : d.proveedor ? `Proveedor: ${d.proveedor}${d.orden_compra ? ' · OC ' + d.orden_compra : ''}${d.valor_dia ? ' · ' + fmtM(d.valor_dia) + '/día' : ''}` : null}
                {item.ubicacion_destino_id && <> · en {nombreUb(item.ubicacion_destino_id)}</>}
              </p>
            )
          }
          if (item.tipo === 'traslado') {
            return (
              <p style={{fontSize:'11px',color:'#888',margin:'6px 0 0'}}>
                {d.codigo ? `Código: ${d.codigo}` : d.cantidad != null ? `Cantidad: ${d.cantidad}` : (d.proveedor ? `Proveedor: ${d.proveedor}${d.orden_compra ? ' · OC ' + d.orden_compra : ''}` : null)}
                {(item.ubicacion_origen_id || item.ubicacion_destino_id) && <><br/>{nombreUb(item.ubicacion_origen_id)} → {nombreUb(item.ubicacion_destino_id)}</>}
              </p>
            )
          }
          if (item.tipo === 'cambio_estado') {
            return (
              <p style={{fontSize:'11px',color:'#888',margin:'6px 0 0'}}>
                {d.codigo ? `Código ${d.codigo} · ` : ''}{d.estado_anterior || '—'} → <b>{d.estado_nuevo}</b>{d.orden_compra ? ` · OC ${d.orden_compra}` : ''}
                {item.ubicacion_origen_id && <> · en {nombreUb(item.ubicacion_origen_id)}</>}
              </p>
            )
          }
          if (item.tipo === 'perdida') {
            return (
              <p style={{fontSize:'11px',color:'#888',margin:'6px 0 0'}}>
                {d.codigo ? `Código: ${d.codigo}` : d.cantidad != null ? `Cantidad: ${d.cantidad}` : d.proveedor ? `Proveedor: ${d.proveedor}${d.orden_compra ? ' · OC ' + d.orden_compra : ''}` : null}
                {item.ubicacion_origen_id && <> · en {nombreUb(item.ubicacion_origen_id)}</>}
              </p>
            )
          }
          return null
        }

        return (
        <div>
          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1.25rem',background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
            <div style={{minWidth:'220px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Filtrar por ubicación</label>
              <select value={logUbicacionSel} onChange={e=>setLogUbicacionSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
                <option value=''>Todas las ubicaciones</option>
                <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
                <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
              </select>
            </div>
            <div style={{minWidth:'220px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Filtrar por movimiento</label>
              <select value={logTipoSel} onChange={e=>setLogTipoSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
                <option value=''>Todos los movimientos</option>
                {Object.entries(tipoInfo).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {cargandoLog && <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p>}
          {!cargandoLog && <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))',gap:'8px',marginBottom:'1.25rem'}}>
              {logStats.map(s => (
                <div key={s.tipo} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'10px',padding:'12px'}}>
                  <p style={{fontSize:'22px',fontWeight:'700',margin:'0 0 2px'}}>{s.total}</p>
                  <p style={{fontSize:'11px',color:'#666',margin:'0'}}>{s.etiqueta}</p>
                </div>
              ))}
            </div>
            <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 8px'}}>Últimos movimientos</p>
            {logItems.length === 0 ? (
              <p style={{fontSize:'13px',color:'#999'}}>Todavía no hay movimientos registrados{logUbicacionSel ? ' en esta ubicación' : ''}.</p>
            ) : (
              <div style={{display:'grid',gap:'8px'}}>
                {logItems.map(item => {
                  const info = tipoInfo[item.tipo] || {label:item.tipo, fg:'#444', bg:'#f1f1f1'}
                  return (
                    <div key={item.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'10px',padding:'12px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                        <span style={{fontSize:'11px',fontWeight:'700',padding:'2px 8px',borderRadius:'20px',background:info.bg,color:info.fg}}>{info.label}</span>
                        <span style={{fontSize:'11px',color:'#999'}}>{new Date(item.created_at).toLocaleString('es-CL')}</span>
                      </div>
                      {item.categoria && <p style={{fontSize:'11px',color:'#999',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'0.3px'}}>{item.categoria}</p>}
                      <p style={{fontSize:'14px',fontWeight:'700',margin:'0',color:'#111'}}>
                        {item.tipo_item || item.descripcion}
                        {item.tipo_item && item.nombre_item && <span style={{fontWeight:'400',color:'#555'}}> - {item.nombre_item}</span>}
                        {' '}<span style={{fontWeight:'400',fontSize:'12px',color:'#999'}}>{item.clase === 'propio' ? '🔧' : '🏗'}</span>
                      </p>
                      {renderDetalle(item)}
                    </div>
                  )
                })}
              </div>
            )}
          </>}
        </div>
        )
      })()}

      {/* RESTO EN CONSTRUCCIÓN */}
      {tab !== 'Ingreso' && tab !== 'Traslado' && tab !== 'Cambio estado' && tab !== 'Devolución' && tab !== 'Pérdida' && tab !== 'Historial' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'24px',textAlign:'center'}}>
          <p style={{fontSize:'13px',color:'#999',margin:'0'}}>Esta sección está en construcción. Próximamente disponible.</p>
        </div>
      )}
    </div>
    </main>
  )
}
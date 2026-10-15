'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

type Estado = 'borrador' | 'enviada' | 'aprobada' | 'revisada' | 'pagada' | 'rechazada'
const ESTADOS: Record<Estado, { texto: string, bg: string, color: string }> = {
  borrador: { texto: 'Borrador', bg: '#f1f3f7', color: '#555' },
  enviada: { texto: 'Esperando aprobación', bg: '#fef7e0', color: '#986a00' },
  aprobada: { texto: 'Aprobada · en revisión contable', bg: '#E8F0FE', color: AZUL },
  revisada: { texto: 'Revisada · por pagar', bg: '#e6f4ea', color: '#1e6b3a' },
  pagada: { texto: 'Pagada', bg: '#d7efe0', color: '#14532d' },
  rechazada: { texto: 'Devuelta', bg: '#fde8e8', color: '#9b1c1c' },
}
const TIPOS: Record<string, string> = { boleta: 'Boleta', factura: 'Factura', en_sistema: 'En sistema (compra con RUT empresa)', otro: 'Otro' }
const peso = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''
const numRend = (n: number) => 'R-' + String(n).padStart(4, '0')

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
const input: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }
const btn = (primario = true, peligro = false): React.CSSProperties => ({
  padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : `1px solid ${peligro ? '#e5b4b4' : '#d0d5dd'}`,
  background: primario ? (peligro ? '#c0392b' : AZUL) : '#fff', color: primario ? '#fff' : (peligro ? '#9b1c1c' : '#344054'),
})
const label: React.CSSProperties = { fontSize: '11px', color: '#667085', display: 'block', marginBottom: '3px', fontWeight: 600 }

export default function Rendiciones() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puedeAcceder = esAdmin || usuario?.accesoContabilidad
  const aprueba = esAdmin || !!usuario?.puedeAprobar
  const revisa = esAdmin || !!usuario?.esRevisor

  const [tab, setTab] = useState<'mias' | 'aprobar' | 'revision' | 'fondos' | 'resumen' | 'todas'>('mias')
  const [rendiciones, setRendiciones] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [fondos, setFondos] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [restaurado, setRestaurado] = useState(false)
  const [fUsuario, setFUsuario] = useState('')
  const [fMonto, setFMonto] = useState('')
  const [fDesc, setFDesc] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const [r, i, f, u, us] = await Promise.all([
      supabase.from('rendiciones').select('*').order('numero', { ascending: false }),
      supabase.from('rendicion_items').select('*').order('fecha').order('created_at'),
      supabase.from('fondos_rendir').select('*').order('fecha', { ascending: false }),
      supabase.from('ubicaciones').select('id,nombre,codigo,tipo,activa').eq('tipo', 'faena').order('nombre'),
      supabase.from('usuarios').select('id,nombre'),
    ])
    setRendiciones(r.data || []); setItems(i.data || []); setFondos(f.data || [])
    setFaenas((u.data || []).filter((x: any) => x.activa !== false)); setUsuarios(us.data || [])
    setCargando(false)
  }, [])
  useEffect(() => { if (usuario) cargar() }, [usuario, cargar])
  // Recordar la pestaña y la rendición abierta: si el navegador recarga la página (típico en celular), se vuelve al mismo lugar
  useEffect(() => {
    if (!usuario || restaurado) return
    try {
      const g = JSON.parse(sessionStorage.getItem('rend_vista') || 'null')
      if (g?.abierta) setAbierta(g.abierta)
      if (g?.tab) { setTab(g.tab); setRestaurado(true); return }
    } catch {}
    setRestaurado(true)
    if (esAdmin || usuario.puedeAprobar || usuario.esRevisor) setTab('resumen')
  }, [usuario?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!restaurado) return
    try { sessionStorage.setItem('rend_vista', JSON.stringify({ tab, abierta })) } catch {}
  }, [tab, abierta, restaurado])
  useEffect(() => { if (!cargando && abierta && !rendiciones.some(r => r.id === abierta)) setAbierta(null) }, [cargando, abierta, rendiciones])

  const nombreUsuario = (id: string) => usuarios.find(u => u.id === id)?.nombre || '—'
  const faena = (id?: string | null) => faenas.find(f => f.id === id)
  const nombreCC = (id?: string | null) => { const f = faena(id); return f ? f.nombre : 'Sin centro de costo' }
  const itemsDe = (rid: string) => items.filter(i => i.rendicion_id === rid)
  const totalDe = (rid: string) => itemsDe(rid).reduce((s, i) => s + Number(i.monto), 0)

  // Saldo del fondo por rendir: lo entregado menos lo rendido (desde que se envía)
  const saldoDe = (uid: string) => {
    const entregado = fondos.filter(f => f.usuario_id === uid).reduce((s, f) => s + Number(f.monto), 0)
    const rendido = rendiciones.filter(r => r.usuario_id === uid && ['enviada', 'aprobada', 'revisada', 'pagada'].includes(r.estado)).reduce((s, r) => s + totalDe(r.id), 0)
    return { entregado, rendido, saldo: entregado - rendido }
  }

  const avisar = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }
  const cambiar = async (id: string, campos: any, ok: string) => {
    const { error } = await supabase.from('rendiciones').update(campos).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return false }
    avisar(ok); await cargar(); return true
  }

  // ---------- nueva rendición ----------
  const [nuevoCC, setNuevoCC] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')
  const crearRendicion = async () => {
    if (!usuario) return
    if (!nuevoCC) { alert('Elige el centro de costo (faena o proyecto).'); return }
    const { data, error } = await supabase.from('rendiciones').insert({ usuario_id: usuario.id, centro_costo_id: nuevoCC, descripcion: nuevaDesc.trim() || null }).select().single()
    if (error || !data) { alert('No se pudo crear: ' + error?.message); return }
    setNuevoCC(''); setNuevaDesc(''); await cargar(); setAbierta(data.id)
  }

  // ---------- ítems ----------
  const hoy = new Date().toISOString().slice(0, 10)
  const [iFecha, setIFecha] = useState(hoy)
  const [iTipo, setITipo] = useState('boleta')
  const [iNum, setINum] = useState('')
  const [iDet, setIDet] = useState('')
  const [iMonto, setIMonto] = useState('')
  const [iFoto, setIFoto] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const MOTIVOS = ['Monto no cuadra', 'Falta información', 'No se logra ver', 'Rendición no corresponde']
  const [rechazando, setRechazando] = useState<any | null>(null)
  const [motivoSel, setMotivoSel] = useState('')
  const [motivoExtra, setMotivoExtra] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [visor, setVisor] = useState<{ url: string, pdf: boolean } | null>(null)

  const limpiarForm = () => { setINum(''); setIDet(''); setIMonto(''); setIFoto(null); setEditandoId(null); setIFecha(hoy); setITipo('boleta') }
  const editarItem = (it: any) => {
    setEditandoId(it.id); setIFecha(it.fecha); setITipo(it.tipo_doc); setINum(it.numero_doc || ''); setIDet(it.detalle); setIMonto(String(Math.round(Number(it.monto)))); setIFoto(null)
    setTimeout(() => document.getElementById('form-gasto')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  const agregarItem = async (r: any) => {
    const monto = Number(iMonto.replace(/\./g, '').replace(',', '.'))
    if (!iDet.trim() || !monto || monto <= 0) { alert('Indica el detalle y el monto.'); return }
    setSubiendo(true)
    let path: string | null = null
    if (iFoto) {
      const limpio = iFoto.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      path = `${r.usuario_id}/${r.id}/${Date.now()}-${limpio}`
      const { error: eUp } = await supabase.storage.from('comprobantes').upload(path, iFoto, { contentType: iFoto.type })
      if (eUp) { setSubiendo(false); alert('No se pudo subir la foto: ' + eUp.message); return }
    }
    const campos: any = { fecha: iFecha, tipo_doc: iTipo, numero_doc: iNum.trim() || null, detalle: iDet.trim(), monto }
    let error: any
    if (editandoId) {
      const previo = items.find(i => i.id === editandoId)
      if (path) { campos.comprobante_path = path }
      if (previo?.estado_item === 'rechazado') campos.estado_item = 'corregido'
      ;({ error } = await supabase.from('rendicion_items').update(campos).eq('id', editandoId))
      if (!error && path && previo?.comprobante_path) await supabase.storage.from('comprobantes').remove([previo.comprobante_path])
    } else {
      ;({ error } = await supabase.from('rendicion_items').insert({ ...campos, rendicion_id: r.id, comprobante_path: path }))
    }
    setSubiendo(false)
    if (error) { alert('No se pudo guardar el gasto: ' + error.message); return }
    limpiarForm()
    await cargar()
  }
  const observarItem = (it: any) => { setRechazando(it); setMotivoSel(''); setMotivoExtra('') }
  const confirmarRechazo = async () => {
    if (!rechazando) return
    if (!motivoSel) { alert('Elige el motivo del rechazo.'); return }
    const motivo = motivoSel + (motivoExtra.trim() ? ' — ' + motivoExtra.trim() : '')
    const { error } = await supabase.from('rendicion_items').update({ estado_item: 'rechazado', motivo_rechazo: motivo }).eq('id', rechazando.id)
    if (error) { alert(error.message); return }
    setRechazando(null)
    await cargar()
  }
  const deshacerRechazo = async (it: any) => {
    const { error } = await supabase.from('rendicion_items').update({ estado_item: 'ok', motivo_rechazo: null }).eq('id', it.id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const devolver = async (r: any) => {
    const marcados = itemsDe(r.id).filter(i => i.estado_item === 'rechazado')
    if (marcados.length === 0) {
      const m = prompt('Ningún gasto está marcado con observación. Si quieres devolver toda la rendición, escribe el motivo general (o cancela y usa "Rechazar" en cada gasto):')
      if (m && m.trim()) await cambiar(r.id, { estado: 'rechazada', motivo_rechazo: m.trim() }, 'Devuelta al trabajador.')
      return
    }
    if (!confirm(`Se devolverá la rendición al trabajador con ${marcados.length} gasto(s) observado(s). ¿Continuar?`)) return
    await cambiar(r.id, { estado: 'rechazada', motivo_rechazo: `${marcados.length} gasto(s) con observaciones` }, 'Devuelta al trabajador con las observaciones por gasto.')
  }
  const quitarItem = async (it: any) => {
    if (!confirm('¿Quitar este gasto?')) return
    if (it.comprobante_path) await supabase.storage.from('comprobantes').remove([it.comprobante_path])
    const { error } = await supabase.from('rendicion_items').delete().eq('id', it.id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const verFoto = async (path: string) => {
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(path, 600)
    if (error || !data) { alert('No se pudo abrir la foto.'); return }
    setVisor({ url: data.signedUrl, pdf: /\.pdf$/i.test(path) })
  }
  const guardarItemContable = async (it: any, cuenta: string, obs: string) => {
    const { error } = await supabase.from('rendicion_items').update({ cuenta_contable: cuenta.trim() || null, observacion_revisor: obs.trim() || null }).eq('id', it.id)
    if (error) alert(error.message)
  }

  const eliminarRendicion = async (r: any) => {
    if (!confirm(`¿Eliminar la rendición ${numRend(r.numero)}?`)) return
    const paths = itemsDe(r.id).map(i => i.comprobante_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('comprobantes').remove(paths)
    const { error } = await supabase.from('rendiciones').delete().eq('id', r.id)
    if (error) { alert(error.message); return }
    setAbierta(null); await cargar()
  }

  // ---------- Excel ----------
  const exportarExcel = async (lista: any[]) => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Rendiciones')
    ws.columns = [
      { header: 'N° rendición', width: 13 }, { header: 'Trabajador', width: 24 }, { header: 'Centro de costo', width: 28 },
      { header: 'Fecha', width: 12 }, { header: 'Tipo documento', width: 16 }, { header: 'N° documento', width: 15 },
      { header: 'Detalle', width: 40 }, { header: 'Monto', width: 14 }, { header: 'Cuenta contable', width: 22 },
      { header: 'Estado', width: 26 }, { header: 'Fecha pago', width: 12 }, { header: 'Observación contable', width: 32 },
    ]
    const h = ws.getRow(1)
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F9C' } }
    for (const r of lista) {
      for (const it of itemsDe(r.id)) {
        ws.addRow([numRend(r.numero), nombreUsuario(r.usuario_id), nombreCC(r.centro_costo_id), fechaCL(it.fecha), TIPOS[it.tipo_doc]?.split(' (')[0] || it.tipo_doc,
          it.numero_doc || '', it.detalle, Number(it.monto), it.cuenta_contable || '', ESTADOS[r.estado as Estado]?.texto || r.estado, fechaCL(r.fecha_pago), it.observacion_revisor || ''])
      }
    }
    ws.getColumn(8).numFmt = '$#,##0'
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: 'A1', to: 'L1' }
    const buf = await wb.xlsx.writeBuffer()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    a.download = `Rendiciones_${hoy}.xlsx`
    a.click()
  }

  // ---------- vistas ----------
  const chip = (e: Estado) => <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', background: ESTADOS[e].bg, color: ESTADOS[e].color, whiteSpace: 'nowrap', fontWeight: 600 }}>{ESTADOS[e].texto}</span>

  const cabecera = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/contabilidad" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Contabilidad</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Rendiciones</h1>
    </div>
  )

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  if (!puedeAcceder) {
    return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '600px', margin: '0 auto' }}>{cabecera}
      <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a este módulo. Pídele al administrador que te lo habilite en Usuarios.</p></div></main>
  }

  const mias = rendiciones.filter(r => r.usuario_id === usuario!.id)
  const porAprobar = rendiciones.filter(r => r.estado === 'enviada')
  const enRevision = rendiciones.filter(r => r.estado === 'aprobada' || r.estado === 'revisada')
  const miSaldo = saldoDe(usuario!.id)

  const fila = (r: any, conTrabajador: boolean) => (
    <div key={r.id} onClick={() => setAbierta(r.id)} style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{numRend(r.numero)}{conTrabajador ? ' · ' + nombreUsuario(r.usuario_id) : ''}</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>{nombreCC(r.centro_costo_id)} · {itemsDe(r.id).length} gasto(s) · {fechaCL(r.created_at)}{r.estado === 'rechazada' && itemsDe(r.id).some(i => i.estado_item === 'rechazado') ? ' · ' + itemsDe(r.id).filter(i => i.estado_item === 'rechazado').length + ' por corregir' : ''}</p>
      </div>
      <strong style={{ fontSize: '14px' }}>{peso(totalDe(r.id))}</strong>
      {chip(r.estado)}
    </div>
  )

  // detalle de una rendición
  const detalle = () => {
    const r = rendiciones.find(x => x.id === abierta)
    if (!r) return null
    const its = itemsDe(r.id)
    const esDueno = r.usuario_id === usuario!.id
    const editable = esDueno && (r.estado === 'borrador' || r.estado === 'rechazada')
    const puedeRevisar = revisa && (r.estado === 'aprobada' || r.estado === 'revisada')
    const puedeAprobarEsta = aprueba && r.estado === 'enviada' && !(r.usuario_id === usuario!.id && !esAdmin)
    const puedeObservar = puedeAprobarEsta || (revisa && r.estado === 'aprobada')
    const pendientesCorregir = its.filter(i => i.estado_item === 'rechazado').length
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        <button onClick={() => setAbierta(null)} style={{ ...btn(false), width: 'fit-content' }}>← Volver al listado</button>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 3px', fontSize: '18px' }}>{numRend(r.numero)} · {nombreUsuario(r.usuario_id)}</h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#667085' }}>Centro de costo: <strong>{nombreCC(r.centro_costo_id)}</strong>{r.descripcion ? ' · ' + r.descripcion : ''}</p>
            </div>
            {chip(r.estado)}
          </div>
          {r.estado === 'rechazada' && esDueno && pendientesCorregir > 0 && <p style={{ margin: '10px 0 0', padding: '8px 10px', background: '#fde8e8', color: '#9b1c1c', borderRadius: '8px', fontSize: '12.5px' }}>Tienes <strong>{pendientesCorregir}</strong> gasto(s) con observaciones (marcados en rojo). Edítalos para corregirlos o quítalos, y luego envía de nuevo.</p>}
          {r.estado === 'rechazada' && r.motivo_rechazo && <p style={{ margin: '10px 0 0', padding: '8px 10px', background: '#fde8e8', color: '#9b1c1c', borderRadius: '8px', fontSize: '12.5px' }}>Devuelta: {r.motivo_rechazo}</p>}
          {r.aprobada_por && <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#8a94a6' }}>Aprobada por {nombreUsuario(r.aprobada_por)} el {fechaCL(r.fecha_aprobacion)}{r.fecha_pago ? ' · Pagada el ' + fechaCL(r.fecha_pago) : ''}</p>}
        </div>

        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead><tr style={{ background: '#f6f8fb', textAlign: 'left' }}>
              {['Fecha', 'Documento', 'Detalle', 'Monto', puedeRevisar ? 'Cuenta contable' : '', puedeRevisar ? 'Observación' : '', ''].map((t, k) => <th key={k} style={{ padding: '9px 10px', fontSize: '11px', color: '#667085' }}>{t}</th>)}
            </tr></thead>
            <tbody>
              {its.length === 0 && <tr><td colSpan={7} style={{ padding: '14px', color: '#999' }}>Aún no hay gastos cargados.</td></tr>}
              {its.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid #eef1f6', background: it.estado_item === 'rechazado' ? '#fff5f5' : it.estado_item === 'corregido' ? '#f3faf5' : undefined }}>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fechaCL(it.fecha)}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {TIPOS[it.tipo_doc]?.split(' (')[0]} {it.numero_doc || ''}
                    {it.tipo_doc === 'en_sistema' && <span style={{ marginLeft: '6px', fontSize: '10.5px', background: '#fef7e0', color: '#986a00', padding: '2px 6px', borderRadius: '10px' }}>Angela: cruzar</span>}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {it.detalle}
                    {it.estado_item === 'rechazado' && <div style={{ marginTop: '4px', fontSize: '12px', color: '#9b1c1c', background: '#fde8e8', padding: '5px 8px', borderRadius: '6px' }}>❌ <strong>Observación:</strong> {it.motivo_rechazo}</div>}
                    {it.estado_item === 'corregido' && <div style={{ marginTop: '4px', fontSize: '12px', color: '#1e6b3a' }}>✔ Corregido{it.motivo_rechazo ? <span style={{ color: '#667085' }}> · observación anterior: {it.motivo_rechazo}</span> : null}</div>}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{peso(it.monto)}</td>
                  {puedeRevisar ? (<>
                    <td style={{ padding: '6px 10px' }}><input defaultValue={it.cuenta_contable || ''} onBlur={e => guardarItemContable(it, e.target.value, it.observacion_revisor || '')} style={{ ...input, minWidth: '130px' }} placeholder="Cuenta" /></td>
                    <td style={{ padding: '6px 10px' }}><input defaultValue={it.observacion_revisor || ''} onBlur={e => guardarItemContable(it, it.cuenta_contable || '', e.target.value)} style={{ ...input, minWidth: '140px' }} placeholder="Nota" /></td>
                  </>) : (<><td /><td /></>)}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {it.comprobante_path && <button onClick={() => verFoto(it.comprobante_path)} style={{ ...btn(false), padding: '4px 9px', fontSize: '11.5px' }}>📎 Ver foto</button>}{' '}
                    {editable && <button onClick={() => editarItem(it)} style={{ ...btn(false), padding: '4px 9px', fontSize: '11.5px' }}>Editar</button>}{' '}
                    {(editable || esAdmin) && <button onClick={() => quitarItem(it)} style={{ ...btn(false, true), padding: '4px 9px', fontSize: '11.5px' }}>Quitar</button>}
                    {puedeObservar && (it.estado_item === 'rechazado'
                      ? <button onClick={() => deshacerRechazo(it)} style={{ ...btn(false), padding: '4px 9px', fontSize: '11.5px' }}>Deshacer rechazo</button>
                      : <button onClick={() => observarItem(it)} style={{ ...btn(false, true), padding: '4px 9px', fontSize: '11.5px' }}>Rechazar gasto</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ borderTop: '2px solid #e2e6ed' }}><td colSpan={3} style={{ padding: '10px', fontWeight: 700, textAlign: 'right' }}>Total</td><td style={{ padding: '10px', fontWeight: 800 }}>{peso(totalDe(r.id))}</td><td colSpan={3} /></tr></tfoot>
          </table>
        </div>

        {editable && (
          <div style={card} id="form-gasto">
            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>{editandoId ? '✏️ Editando gasto' : 'Agregar gasto'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' }}>
              <div><span style={label}>Fecha</span><input type="date" value={iFecha} onChange={e => setIFecha(e.target.value)} style={input} /></div>
              <div><span style={label}>Tipo de documento</span>
                <select value={iTipo} onChange={e => setITipo(e.target.value)} style={input}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><span style={label}>N° documento</span><input value={iNum} onChange={e => setINum(e.target.value)} style={input} /></div>
              <div><span style={label}>Monto ($)</span><input inputMode="numeric" value={iMonto} onChange={e => setIMonto(e.target.value)} style={input} /></div>
            </div>
            <div style={{ marginTop: '10px' }}><span style={label}>Detalle (qué se compró)</span><input value={iDet} onChange={e => setIDet(e.target.value)} style={input} /></div>
            <div style={{ marginTop: '10px' }}>
              <span style={label}>Foto de la boleta o factura</span>
              <label
                onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={e => { e.preventDefault(); setArrastrando(false); const f = e.dataTransfer.files?.[0]; if (f) { if (!/^image\/|application\/pdf/.test(f.type)) { alert('Solo se aceptan fotos o PDF.'); return } setIFoto(f) } }}
                style={{ display: 'block', cursor: 'pointer', textAlign: 'center', padding: '18px 12px', borderRadius: '10px', border: '2px dashed ' + (arrastrando ? AZUL : '#c4cad6'), background: arrastrando ? '#E8F0FE' : '#fafbfd', fontSize: '13px', color: '#475467' }}>
                {iFoto ? <>📎 <strong>{iFoto.name}</strong> <span style={{ color: '#8a94a6' }}>({Math.max(1, Math.round(iFoto.size / 1024))} KB)</span></> : <>Arrastra aquí la foto o el PDF, o <span style={{ color: AZUL, fontWeight: 600, textDecoration: 'underline' }}>haz clic para seleccionar</span></>}
                <input type="file" accept="image/*,application/pdf" onChange={e => setIFoto(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              </label>
              {iFoto && <button type="button" onClick={() => setIFoto(null)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '11.5px', marginTop: '6px' }}>Quitar archivo</button>}
            </div>
            <button onClick={() => agregarItem(r)} disabled={subiendo} style={{ ...btn(), marginTop: '12px', opacity: subiendo ? 0.6 : 1 }}>{subiendo ? 'Guardando...' : editandoId ? 'Guardar cambios' : '+ Agregar gasto'}</button>
            {editandoId && <button onClick={limpiarForm} style={{ ...btn(false), marginTop: '12px', marginLeft: '8px' }}>Cancelar edición</button>}
            {editandoId && <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#8a94a6' }}>Si no subes una foto nueva, se mantiene la actual.</p>}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {editable && <button style={btn()} onClick={() => { if (!its.length) { alert('Agrega al menos un gasto.'); return } if (pendientesCorregir > 0) { alert(`Aún tienes ${pendientesCorregir} gasto(s) con observaciones. Edítalos para corregirlos o quítalos antes de enviar.`); return } cambiar(r.id, { estado: 'enviada', motivo_rechazo: null }, 'Rendición enviada a aprobación.') }}>Enviar a aprobación</button>}
          {editable && r.estado === 'borrador' && <button style={btn(false, true)} onClick={() => eliminarRendicion(r)}>Eliminar</button>}
          {aprueba && r.estado === 'enviada' && !(r.usuario_id === usuario!.id && !esAdmin) && <>
            <button style={btn()} onClick={() => cambiar(r.id, { estado: 'aprobada', aprobada_por: usuario!.id, fecha_aprobacion: new Date().toISOString() }, 'Aprobada. Pasa a revisión contable.')}>✔ Aprobar</button>
            <button style={btn(false, true)} onClick={() => devolver(r)}>Devolver al trabajador{pendientesCorregir ? ` (${pendientesCorregir} observado${pendientesCorregir > 1 ? 's' : ''})` : ''}</button>
          </>}
          {puedeRevisar && r.estado === 'aprobada' && <>
            <button style={btn()} onClick={() => cambiar(r.id, { estado: 'revisada', revisada_por: usuario!.id, fecha_revision: new Date().toISOString() }, 'Marcada como revisada.')}>✔ Marcar revisada (cruzada con KAME)</button>
            <button style={btn(false, true)} onClick={() => devolver(r)}>Devolver al trabajador{pendientesCorregir ? ` (${pendientesCorregir} observado${pendientesCorregir > 1 ? 's' : ''})` : ''}</button>
          </>}
          {puedeRevisar && r.estado === 'revisada' && <button style={btn()} onClick={() => { const f = prompt('Fecha de pago (AAAA-MM-DD):', hoy); if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) cambiar(r.id, { estado: 'pagada', fecha_pago: f }, 'Marcada como pagada.') }}>💲 Marcar pagada</button>}
          <button style={btn(false)} onClick={() => exportarExcel([r])}>⬇ Excel</button>
        </div>
      </div>
    )
  }

  // ---------- fondos ----------
  const darFondo = async () => {
    const monto = Number(fMonto.replace(/\./g, ''))
    if (!fUsuario || !monto) { alert('Elige la persona y el monto.'); return }
    const { error } = await supabase.from('fondos_rendir').insert({ usuario_id: fUsuario, monto, descripcion: fDesc.trim() || null, creado_por: usuario!.id })
    if (error) { alert(error.message); return }
    setFUsuario(''); setFMonto(''); setFDesc(''); avisar('Fondo registrado.'); await cargar()
  }

  const tabs: { k: typeof tab, t: string, v: boolean, n?: number }[] = [
    { k: 'resumen', t: '📊 Resumen', v: aprueba || revisa },
    { k: 'mias', t: 'Mis rendiciones', v: true },
    { k: 'todas', t: 'Todas', v: aprueba || revisa },
    { k: 'aprobar', t: 'Por aprobar', v: aprueba, n: porAprobar.length },
    { k: 'revision', t: 'Revisión contable', v: revisa, n: enRevision.length },
    { k: 'fondos', t: 'Fondos por rendir', v: revisa },
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
              </button>
            ))}
          </div>

          {cargando && <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>}


          {!cargando && tab === 'resumen' && (() => {
            const activas = rendiciones.filter(r => r.estado !== 'borrador')
            const suma = (l: any[]) => l.reduce((a, r) => a + totalDe(r.id), 0)
            const mesActual = hoy.slice(0, 7)
            const delMes = activas.filter(r => (r.created_at || '').slice(0, 7) === mesActual)
            const porEstado = (e: Estado) => activas.filter(r => r.estado === e)
            const kpis = [
              { t: 'Rendido este mes', v: peso(suma(delMes)), s: delMes.length + ' rendición(es)', c: AZUL },
              { t: 'Esperando aprobación', v: peso(suma(porEstado('enviada'))), s: porEstado('enviada').length + ' rendición(es)', c: '#986a00' },
              { t: 'En revisión contable', v: peso(suma(porEstado('aprobada'))), s: porEstado('aprobada').length + ' rendición(es)', c: AZUL },
              { t: 'Revisadas, por pagar', v: peso(suma(porEstado('revisada'))), s: porEstado('revisada').length + ' rendición(es)', c: '#1e6b3a' },
              { t: 'Pagado este mes', v: peso(suma(porEstado('pagada').filter(r => (r.fecha_pago || '').slice(0, 7) === mesActual))), s: 'rendiciones pagadas', c: '#14532d' },
              { t: 'Devueltas', v: String(porEstado('rechazada').length), s: 'esperando corrección', c: '#9b1c1c' },
            ]
            const agrupar = (clave: (r: any) => string) => {
              const m: Record<string, number> = {}
              activas.filter(r => r.estado !== 'rechazada').forEach(r => { const k = clave(r); m[k] = (m[k] || 0) + totalDe(r.id) })
              return Object.entries(m).sort((a, b) => b[1] - a[1])
            }
            const barras = (datos: [string, number][], vacio: string) => {
              const max = Math.max(1, ...datos.map(d => d[1]))
              if (!datos.length) return <p style={{ fontSize: '12.5px', color: '#999', margin: 0 }}>{vacio}</p>
              return <div style={{ display: 'grid', gap: '8px' }}>{datos.slice(0, 8).map(([k, v]) => (
                <div key={k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '3px' }}><span>{k}</span><strong>{peso(v)}</strong></div>
                  <div style={{ height: '8px', background: '#eef1f6', borderRadius: '6px' }}><div style={{ width: (v / max * 100) + '%', height: '100%', background: AZUL, borderRadius: '6px' }} /></div>
                </div>))}</div>
            }
            const meses: [string, number][] = []
            for (let k = 5; k >= 0; k--) {
              const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k)
              const clave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
              meses.push([clave.slice(5) + '/' + clave.slice(2, 4), suma(activas.filter(r => r.estado !== 'rechazada' && (r.created_at || '').slice(0, 7) === clave))])
            }
            const sinCuenta = activas.filter(r => r.estado === 'aprobada' || r.estado === 'revisada').reduce((a, r) => a + itemsDe(r.id).filter(i => !i.cuenta_contable).length, 0)
            const enSistema = activas.filter(r => r.estado === 'aprobada').reduce((a, r) => a + itemsDe(r.id).filter(i => i.tipo_doc === 'en_sistema').length, 0)
            return (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '10px' }}>
                  {kpis.map(k => (
                    <div key={k.t} style={card}>
                      <p style={{ margin: '0 0 4px', fontSize: '11.5px', color: '#667085', fontWeight: 600 }}>{k.t}</p>
                      <p style={{ margin: '0 0 2px', fontSize: '21px', fontWeight: 800, color: k.c }}>{k.v}</p>
                      <p style={{ margin: 0, fontSize: '11.5px', color: '#8a94a6' }}>{k.s}</p>
                    </div>))}
                </div>
                {revisa && (sinCuenta > 0 || enSistema > 0) && (
                  <div style={{ ...card, background: '#fef7e0', borderColor: '#f3e2a5' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#7a5600' }}>Para revisión contable: <strong>{sinCuenta}</strong> gasto(s) sin cuenta asignada · <strong>{enSistema}</strong> gasto(s) "en sistema" por cruzar.</p>
                  </div>)}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '12px' }}>
                  <div style={card}><p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Por centro de costo</p>{barras(agrupar(r => nombreCC(r.centro_costo_id)), 'Sin datos todavía.')}</div>
                  <div style={card}><p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Por trabajador</p>{barras(agrupar(r => nombreUsuario(r.usuario_id)), 'Sin datos todavía.')}</div>
                  <div style={card}><p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Últimos 6 meses</p>{barras(meses, '')}</div>
                  <div style={card}><p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Fondos por rendir pendientes</p>
                    {barras(usuarios.filter(u => fondos.some(f => f.usuario_id === u.id)).map(u => [u.nombre, Math.max(0, saldoDe(u.id).saldo)] as [string, number]).filter(d => d[1] > 0), 'No hay saldos pendientes.')}</div>
                </div>
              </div>)
          })()}

          {!cargando && tab === 'mias' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {miSaldo.entregado > 0 && (
                <div style={card}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px' }}>Mi fondo por rendir</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#344054' }}>Entregado {peso(miSaldo.entregado)} · Rendido {peso(miSaldo.rendido)} · <strong style={{ color: miSaldo.saldo < 0 ? '#9b1c1c' : '#1e6b3a' }}>{miSaldo.saldo < 0 ? 'Se te debe ' + peso(-miSaldo.saldo) : 'Saldo por rendir ' + peso(miSaldo.saldo)}</strong></p>
                </div>
              )}
              <div style={card}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Nueva rendición</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '10px' }}>
                  <div><span style={label}>Centro de costo (CECO)</span>
                    <select value={nuevoCC} onChange={e => setNuevoCC(e.target.value)} style={input}>
                      <option value="">Elegir...</option>
                      {faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select></div>
                  <div><span style={label}>Descripción (opcional)</span><input value={nuevaDesc} onChange={e => setNuevaDesc(e.target.value)} style={input} placeholder="Ej: compras de la semana" /></div>
                </div>
                <button onClick={crearRendicion} style={{ ...btn(), marginTop: '12px' }}>Crear y agregar gastos</button>
              </div>
              {mias.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>Aún no tienes rendiciones.</p> : mias.map(r => fila(r, false))}
            </div>
          )}

          {!cargando && tab === 'todas' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {rendiciones.filter(r => r.estado !== 'borrador' || r.usuario_id === usuario!.id).length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>No hay rendiciones.</p> : rendiciones.filter(r => r.estado !== 'borrador' || r.usuario_id === usuario!.id).map(r => fila(r, true))}
            </div>
          )}

          {!cargando && tab === 'aprobar' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {porAprobar.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>No hay rendiciones esperando aprobación.</p> : porAprobar.map(r => fila(r, true))}
            </div>
          )}

          {!cargando && tab === 'revision' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button style={btn(false)} onClick={() => exportarExcel(rendiciones.filter(r => r.estado !== 'borrador'))}>⬇ Excel de todas las rendiciones</button>
              </div>
              {enRevision.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>No hay rendiciones pendientes de revisión.</p> : enRevision.map(r => fila(r, true))}
              <p style={{ margin: '10px 0 0', fontWeight: 700, fontSize: '13.5px' }}>Pagadas</p>
              {rendiciones.filter(r => r.estado === 'pagada').slice(0, 30).map(r => fila(r, true))}
            </div>
          )}

          {!cargando && tab === 'fondos' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={card}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13.5px' }}>Entregar fondo por rendir</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px' }}>
                  <div><span style={label}>Persona</span>
                    <select value={fUsuario} onChange={e => setFUsuario(e.target.value)} style={input}><option value="">Elegir...</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
                  <div><span style={label}>Monto ($)</span><input inputMode="numeric" value={fMonto} onChange={e => setFMonto(e.target.value)} style={input} /></div>
                  <div><span style={label}>Nota</span><input value={fDesc} onChange={e => setFDesc(e.target.value)} style={input} /></div>
                </div>
                <button onClick={darFondo} style={{ ...btn(), marginTop: '12px' }}>Registrar fondo</button>
              </div>
              <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead><tr style={{ background: '#f6f8fb', textAlign: 'left' }}>{['Persona', 'Entregado', 'Rendido', 'Saldo'].map(t => <th key={t} style={{ padding: '9px 10px', fontSize: '11px', color: '#667085' }}>{t}</th>)}</tr></thead>
                  <tbody>
                    {usuarios.filter(u => fondos.some(f => f.usuario_id === u.id)).map(u => { const s = saldoDe(u.id); return (
                      <tr key={u.id} style={{ borderTop: '1px solid #eef1f6' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{u.nombre}</td><td style={{ padding: '8px 10px' }}>{peso(s.entregado)}</td><td style={{ padding: '8px 10px' }}>{peso(s.rendido)}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: s.saldo < 0 ? '#9b1c1c' : '#1e6b3a' }}>{s.saldo < 0 ? 'Se le debe ' + peso(-s.saldo) : peso(s.saldo)}</td>
                      </tr>) })}
                    {fondos.length === 0 && <tr><td colSpan={4} style={{ padding: '14px', color: '#999' }}>Aún no hay fondos entregados.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>)}
      </div>
      {rechazando && (
        <div onClick={() => setRechazando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.55)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '400px' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px' }}>Rechazar gasto</p>
            <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#667085' }}>{rechazando.detalle} · {peso(rechazando.monto)}</p>
            <span style={label}>Motivo</span>
            <select value={motivoSel} onChange={e => setMotivoSel(e.target.value)} style={input} autoFocus>
              <option value="">Elegir motivo...</option>
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ ...label, marginTop: '10px' }}>Comentario (opcional)</span>
            <input value={motivoExtra} onChange={e => setMotivoExtra(e.target.value)} style={input} placeholder="Ej: la boleta dice $12.000" />
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
              <button onClick={() => setRechazando(null)} style={btn(false)}>Cancelar</button>
              <button onClick={confirmarRechazo} style={btn(true, true)}>Rechazar gasto</button>
            </div>
          </div>
        </div>
      )}
      {visor && (
        <div onClick={() => setVisor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.78)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <a href={visor.url} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: 'none', background: '#fff' }}>Abrir en pestaña nueva</a>
            <button onClick={() => setVisor(null)} style={btn()}>✕ Cerrar</button>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: '900px', overflow: 'auto', background: '#fff', borderRadius: '10px', display: 'flex', justifyContent: 'center' }}>
            {visor.pdf ? <iframe src={visor.url} style={{ width: '100%', height: '100%', border: 0 }} /> : <img src={visor.url} alt="Comprobante" style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', alignSelf: 'flex-start' }} />}
          </div>
        </div>
      )}
    </main>
  )
}

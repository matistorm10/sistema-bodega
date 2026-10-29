'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { fechaCL } from '@/lib/prevencion'

const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const TIPOS: Record<string, string> = { ingreso: 'Ingreso', entrega: 'Entrega', ajuste: 'Ajuste', baja: 'Baja' }
const COL: Record<string, string> = { ingreso: '#1e8e4e', entrega: '#1B4F9C', ajuste: '#986a00', baja: '#c0392b' }

export default function EppPrevencionista() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esJefe = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const puede = esJefe || !!usuario?.esPrevencionista

  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [ubic, setUbic] = useState('')
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [movs, setMovs] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<'stock' | 'registrar' | 'historial'>('stock')
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [f, setF] = useState({ tipo: 'entrega', item: '', talla: '', cantidad: '', fecha: hoy(), nombre: '', rut: '', motivo: '' })

  const cargarBase = useCallback(async () => {
    if (!usuario) return
    const [u, c, asig] = await Promise.all([
      supabase.from('ubicaciones').select('id,nombre,activa').order('nombre'),
      supabase.from('pr_epp_catalogo').select('*').eq('activo', true).order('nombre'),
      supabase.from('pr_epp_ubicaciones').select('ubicacion_id').eq('usuario_id', usuario.id),
    ])
    const propias = new Set((asig.data || []).map((x: any) => x.ubicacion_id))
    const lista = (u.data || []).filter((x: any) => x.activa !== false && (esJefe || propias.has(x.id)))
    setUbicaciones(lista); setCatalogo(c.data || [])
    setUbic(prev => prev && lista.some((x: any) => x.id === prev) ? prev : (lista[0]?.id || ''))
    setCargando(false)
  }, [usuario, esJefe])
  useEffect(() => { if (usuario && puede) cargarBase() }, [usuario, puede, cargarBase])

  const cargarUbic = useCallback(async () => {
    if (!ubic) { setStock([]); setMovs([]); return }
    const [s, m, us] = await Promise.all([
      supabase.from('pr_epp_stock').select('*').eq('ubicacion_id', ubic),
      supabase.from('pr_epp_movimientos').select('*').eq('ubicacion_id', ubic).order('created_at', { ascending: false }).limit(60),
      supabase.from('usuarios').select('id,nombre'),
    ])
    setStock(s.data || []); setMovs(m.data || []); setUsuarios(us.data || [])
  }, [ubic])
  useEffect(() => { cargarUbic() }, [cargarUbic])

  const item = (id: string) => catalogo.find(c => c.id === id)
  const filas = useMemo(() => {
    const out: { key: string, item: any, talla: string, stock: number }[] = []
    catalogo.forEach(c => {
      const ss = stock.filter(s => s.item_id === c.id && s.stock !== 0)
      if (ss.length === 0) out.push({ key: c.id, item: c, talla: '', stock: 0 })
      else ss.forEach(s => out.push({ key: c.id + s.talla, item: c, talla: s.talla, stock: s.stock }))
    })
    return out
  }, [catalogo, stock])
  const stockActual = (itemId: string, talla: string) => stock.find(s => s.item_id === itemId && s.talla === talla)?.stock || 0

  const itSel = item(f.item)
  const registrar = async () => {
    if (!usuario) return
    const n = Math.abs(parseInt(f.cantidad, 10))
    if (!ubic || !f.item || !n) { setMsg('Completa el ítem y la cantidad.'); return }
    if (itSel?.usa_talla && !f.talla.trim()) { setMsg('Indica la talla.'); return }
    if (f.tipo === 'entrega' && !f.nombre.trim()) { setMsg('Indica quién recibe el EPP.'); return }
    if (f.tipo === 'ajuste' && !f.motivo.trim()) { setMsg('El ajuste requiere un motivo.'); return }
    const talla = itSel?.usa_talla ? f.talla.trim().toUpperCase() : ''
    const cantidad = f.tipo === 'ingreso' ? n : f.tipo === 'ajuste' ? parseInt(f.cantidad, 10) : -n
    setGuardando(true); setMsg('')
    const { error } = await supabase.from('pr_epp_movimientos').insert({
      fecha: f.fecha, ubicacion_id: ubic, item_id: f.item, talla, tipo: f.tipo, cantidad,
      receptor_nombre: f.nombre.trim() || null, receptor_rut: f.rut.trim() || null, motivo: f.motivo.trim() || null, creado_por: usuario.id,
    })
    setGuardando(false)
    if (error) { setMsg(error.message.includes('Stock insuficiente') ? error.message.replace(/^.*Stock/, 'Stock') : 'No se pudo registrar: ' + error.message); return }
    setMsg('Registrado ✓'); setF({ ...f, item: f.item, cantidad: '', nombre: '', rut: '', motivo: '' }); await cargarUbic()
  }
  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento? El stock se recalcula.')) return
    const { error } = await supabase.from('pr_epp_movimientos').delete().eq('id', id)
    if (error) { alert(error.message); return }
    await cargarUbic()
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/prevencionista" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Espacio del Prevencionista</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Stock de EPP</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  const wrap = (c: React.ReactNode) => <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>{cab}{c}</div></main>
  if (!puede) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p>)
  if (cargando) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)
  if (ubicaciones.length === 0) return wrap(<p style={{ fontSize: '13px', color: '#667085' }}>Todavía no tienes una ubicación asignada para controlar EPP. La jefatura te la asignará.</p>)

  const tabBtn = (t: typeof tab, txt: string) => <button onClick={() => { setTab(t); setMsg('') }} style={{ ...btn(tab === t), padding: '8px 14px', fontSize: '12.5px' }}>{txt}</button>
  return wrap(
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <select value={ubic} onChange={e => setUbic(e.target.value)} style={{ ...input, width: 'auto', fontWeight: 600 }}>{ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        {tabBtn('stock', 'Stock')}{tabBtn('registrar', '+ Registrar movimiento')}{tabBtn('historial', 'Historial')}
      </div>

      {tab === 'stock' && (
        <div style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ textAlign: 'left', color: '#667085', fontSize: '12px' }}><th style={{ padding: '6px 8px' }}>EPP</th><th style={{ padding: '6px 8px' }}>Talla</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Stock</th></tr></thead>
              <tbody>{filas.map(r => {
                const bajo = r.item.stock_minimo > 0 && (r.item.usa_talla ? r.stock : stock.filter(s => s.item_id === r.item.id).reduce((a, s) => a + s.stock, 0)) < r.item.stock_minimo
                return (
                  <tr key={r.key} style={{ borderTop: '1px solid #eef1f6' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 600 }}>{r.item.nombre}{bajo && <span style={{ marginLeft: '6px', fontSize: '10.5px', padding: '2px 7px', borderRadius: '20px', background: '#fde8e8', color: '#9b1c1c' }}>bajo mínimo ({r.item.stock_minimo})</span>}</td>
                    <td style={{ padding: '7px 8px', color: '#667085' }}>{r.talla || '—'}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: r.stock === 0 ? '#c0392b' : '#16213E' }}>{r.stock}</td>
                  </tr>)
              })}</tbody>
            </table>
          </div>
          <p style={{ fontSize: '11.5px', color: '#98a2b3', margin: '10px 0 0' }}>El stock sube con cada ingreso y baja con cada entrega. Registra todo en la pestaña “Registrar movimiento”.</p>
        </div>
      )}

      {tab === 'registrar' && (
        <div style={card}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {Object.entries(TIPOS).map(([k, t]) => <button key={k} type="button" onClick={() => setF({ ...f, tipo: k })} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${f.tipo === k ? COL[k] : '#d0d5dd'}`, background: f.tipo === k ? COL[k] : '#fff', color: f.tipo === k ? '#fff' : '#667085' }}>{t}</button>)}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div style={{ flex: '1 1 200px' }}><label style={label}>EPP *</label><select value={f.item} onChange={e => setF({ ...f, item: e.target.value, talla: '' })} style={input}><option value="">— elegir —</option>{catalogo.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            {itSel?.usa_talla && <div style={{ flex: '0 1 110px' }}><label style={label}>Talla *</label><input value={f.talla} onChange={e => setF({ ...f, talla: e.target.value })} placeholder="M, L, 42…" style={input} /></div>}
            <div style={{ flex: '0 1 110px' }}><label style={label}>Cantidad *{f.tipo === 'ajuste' ? ' (+/−)' : ''}</label><input type="number" value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value })} style={input} /></div>
            <div style={{ flex: '0 1 150px' }}><label style={label}>Fecha</label><input type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} style={input} /></div>
          </div>
          {f.item && (f.tipo === 'entrega' || f.tipo === 'baja') && <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Stock disponible: <strong>{stockActual(f.item, itSel?.usa_talla ? f.talla.trim().toUpperCase() : '')}</strong></p>}
          {f.tipo === 'entrega' && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div style={{ flex: '1 1 220px' }}><label style={label}>Recibe (nombre) *</label><input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={input} /></div>
              <div style={{ flex: '0 1 160px' }}><label style={label}>RUT</label><input value={f.rut} onChange={e => setF({ ...f, rut: e.target.value })} style={input} /></div>
            </div>
          )}
          <div style={{ marginBottom: '10px' }}><label style={label}>{f.tipo === 'ajuste' ? 'Motivo del ajuste *' : f.tipo === 'ingreso' ? 'Detalle (proveedor, guía, factura)' : 'Observación'}</label><input value={f.motivo} onChange={e => setF({ ...f, motivo: e.target.value })} style={input} /></div>
          {msg && <p style={{ fontSize: '12.5px', margin: '0 0 8px', color: msg.endsWith('✓') ? '#1e8e4e' : '#c5221f' }}>{msg}</p>}
          <button onClick={registrar} disabled={guardando} style={{ ...btn(), opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : `Registrar ${TIPOS[f.tipo].toLowerCase()}`}</button>
        </div>
      )}

      {tab === 'historial' && (
        <div style={{ display: 'grid', gap: '6px' }}>
          {movs.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Sin movimientos.</p>}
          {movs.map(m => (
            <div key={m.id} style={{ ...card, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                  <span style={{ color: COL[m.tipo] }}>{TIPOS[m.tipo]}</span> · {item(m.item_id)?.nombre || '—'}{m.talla ? ` (${m.talla})` : ''} · <strong>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</strong>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#667085' }}>
                  {fechaCL(m.fecha)}{m.receptor_nombre ? ` · recibe ${m.receptor_nombre}${m.receptor_rut ? ` (${m.receptor_rut})` : ''}` : ''}{m.motivo ? ` · ${m.motivo}` : ''} · por {usuarios.find(u => u.id === m.creado_por)?.nombre || '—'}
                </p>
              </div>
              {esJefe && <button onClick={() => eliminar(m.id)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '11.5px' }}>Eliminar</button>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

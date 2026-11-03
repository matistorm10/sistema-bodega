'use client'
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { fechaCL } from '@/lib/prevencion'
import { TIPOS_TALLA, ordenTalla, tallasDe, stockDe, minimoDe, evaluarMinimos, etiquetaMin, type TipoTalla } from '@/lib/epp'
import CertificadosEpp from '@/components/programa/CertificadosEpp'

const TIPOS: Record<string, string> = { ingreso: 'Ingreso', entrega: 'Entrega', ajuste: 'Ajuste', baja: 'Baja' }

export default function JefaturaEpp() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [minimos, setMinimos] = useState<any[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [asigs, setAsigs] = useState<any[]>([])
  const [prevs, setPrevs] = useState<any[]>([])
  const [movs, setMovs] = useState<any[]>([])
  const [certs, setCerts] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState<{ nombre: string, talla: boolean, tipo: TipoTalla, otras: string }>({ nombre: '', talla: false, tipo: 'ropa', otras: '' })
  const [asigSel, setAsigSel] = useState({ u: '', ub: '' })
  const [fUbic, setFUbic] = useState('')
  const [msg, setMsg] = useState('')
  const [ocultos, setOcultos] = useState<string[]>([])
  useEffect(() => { try { const v = localStorage.getItem('epp_ocultos'); if (v) setOcultos(JSON.parse(v)) } catch {} }, [])
  const oc = (k: string) => ocultos.includes(k)
  const alternar = (k: string) => setOcultos(prev => { const n = prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]; try { localStorage.setItem('epp_ocultos', JSON.stringify(n)) } catch {} return n })
  const hdr = (k: string, t: string, st: React.CSSProperties) => <p onClick={() => alternar(k)} title={oc(k) ? 'Mostrar' : 'Ocultar'} style={{ ...st, cursor: 'pointer', userSelect: 'none', ...(oc(k) ? { marginBottom: 0 } : {}) }}><span style={{ color: '#98a2b3', marginRight: '6px', fontSize: '11px' }}>{oc(k) ? '▸' : '▾'}</span>{t}</p>
  const [edit, setEdit] = useState<{ id: string, nombre: string } | null>(null)

  const cargar = useCallback(async () => {
    const [c, s, u, a, p, m, us, ce, mn] = await Promise.all([
      supabase.from('pr_epp_catalogo').select('*').order('nombre'),
      supabase.from('pr_epp_stock').select('*'),
      supabase.from('ubicaciones').select('id,nombre,activa').order('nombre'),
      supabase.from('pr_epp_ubicaciones').select('*'),
      supabase.from('usuarios').select('id,nombre').eq('es_prevencionista', true).order('nombre'),
      supabase.from('pr_epp_movimientos').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('usuarios').select('id,nombre'),
      supabase.from('pr_epp_certificados').select('*'),
      supabase.from('pr_epp_minimos').select('*'),
    ])
    setCerts(ce.data || []); setMinimos(mn.data || [])
    setCatalogo(c.data || []); setStock(s.data || []); setUbicaciones((u.data || []).filter((x: any) => x.activa !== false))
    setAsigs(a.data || []); setPrevs(p.data || []); setMovs(m.data || []); setUsuarios(us.data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const nUbic = (id: string) => ubicaciones.find(u => u.id === id)?.nombre || '—'
  const nItem = (id: string) => catalogo.find(c => c.id === id)?.nombre || '—'
  const nUser = (id: string) => usuarios.find(u => u.id === id)?.nombre || '—'
  const activos = catalogo.filter(c => c.activo)
  // ubicaciones con algún control de EPP (asignadas o con stock)
  const ubicEpp = useMemo(() => ubicaciones.filter(u => asigs.some(a => a.ubicacion_id === u.id) || stock.some(s => s.ubicacion_id === u.id)), [ubicaciones, asigs, stock])
  const total = (itemId: string, ubId: string) => stock.filter(s => s.item_id === itemId && s.ubicacion_id === ubId).reduce((a, s) => a + s.stock, 0)
  // mínimo efectivo: el definido por el Jefe para esa faena; si no hay, el valor por defecto del catálogo
  const evalMin = evaluarMinimos(minimos, stock, activos, ubicEpp)
  const bajoMin = evalMin.filter(e => e.stock < e.min).map(e => ({ k: e.item.id + e.ubic.id + e.talla, t: etiquetaMin(e) }))
  const igualMin = evalMin.filter(e => e.stock === e.min).map(e => ({ k: e.item.id + e.ubic.id + e.talla, t: etiquetaMin(e) }))
  const estado = (ubId: string, itemId: string, talla: string, v: number) => { const m = minimoDe(minimos, ubId, itemId, talla); return { bajo: m > 0 && v < m, igual: m > 0 && v === m } }
  const tallasFila = (c: any) => c.usa_talla ? Array.from(new Set([...stock.filter(x => x.item_id === c.id && x.stock !== 0).map(x => x.talla as string), ...minimos.filter(m => m.item_id === c.id && m.minimo > 0 && m.talla).map(m => m.talla as string)])).sort(ordenTalla) : []
  const guardarMin = async (c: any, ubId: string, talla: string, txt: string) => {
    const actual = minimos.find(x => x.item_id === c.id && x.ubicacion_id === ubId && (x.talla || '') === talla)
    if (txt.trim() === '') { if (!actual) return; const { error } = await supabase.from('pr_epp_minimos').delete().eq('item_id', c.id).eq('ubicacion_id', ubId).eq('talla', talla); if (error) { alert(error.message); return } await cargar(); return }
    const v = Math.floor(Number(txt)); if (!(v >= 0)) return
    if (actual && actual.minimo === v) return
    const { error } = await supabase.from('pr_epp_minimos').upsert({ ubicacion_id: ubId, item_id: c.id, talla, minimo: v }, { onConflict: 'ubicacion_id,item_id,talla' })
    if (error) alert(error.message); else await cargar()
  }
  const movsF = movs.filter(m => !fUbic || m.ubicacion_id === fUbic).slice(0, 25)

  const parseTallas = (t: string) => Array.from(new Set(t.split(',').map(x => x.trim().toUpperCase()).filter(Boolean))).sort(ordenTalla)
  const agregar = async () => {
    if (!nuevo.nombre.trim()) { setMsg('Escribe el nombre del EPP.'); return }
    const otras = parseTallas(nuevo.otras)
    if (nuevo.talla && nuevo.tipo === 'otra' && otras.length === 0) { setMsg('Escribe las tallas separadas por coma (ej: S, M, L).'); return }
    const { error } = await supabase.from('pr_epp_catalogo').insert({ nombre: nuevo.nombre.trim(), usa_talla: nuevo.talla, tipo_talla: nuevo.talla ? nuevo.tipo : null, tallas: nuevo.talla && nuevo.tipo === 'otra' ? otras : null })
    if (error) { setMsg(error.code === '23505' ? 'Ese EPP ya existe.' : error.message); return }
    setNuevo({ nombre: '', talla: false, tipo: 'ropa', otras: '' }); setMsg(''); await cargar()
  }
  const act = async (id: string, campos: any) => { const { error } = await supabase.from('pr_epp_catalogo').update(campos).eq('id', id); if (error) alert(error.message); else await cargar() }
  const stockTotal = (id: string) => stock.filter(x => x.item_id === id).reduce((a, x) => a + x.stock, 0)
  const renombrar = async () => {
    if (!edit) return
    const nombre = edit.nombre.trim()
    if (!nombre) { alert('El nombre no puede quedar vacío.'); return }
    const { error } = await supabase.from('pr_epp_catalogo').update({ nombre }).eq('id', edit.id)
    if (error) { alert(error.code === '23505' ? 'Ya existe un EPP con ese nombre.' : error.message); return }
    setEdit(null); await cargar()
  }
  const eliminar = async (c: any) => {
    if (stockTotal(c.id) !== 0) { alert(`No se puede eliminar: tiene ${stockTotal(c.id)} unidades en stock. Primero deja el stock en cero.`); return }
    const { count } = await supabase.from('pr_epp_movimientos').select('id', { count: 'exact', head: true }).eq('item_id', c.id)
    if ((count || 0) > 0) {
      if (!confirm(`"${c.nombre}" tiene ${count} movimiento(s) en el historial. Para no perder esa información se ocultará del catálogo (no se borra). ¿Continuar?`)) return
      await act(c.id, { activo: false }); return
    }
    if (!confirm(`¿Eliminar "${c.nombre}" del catálogo? No tiene stock ni movimientos.`)) return
    const { error } = await supabase.from('pr_epp_catalogo').delete().eq('id', c.id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const asignar = async () => {
    if (!asigSel.u || !asigSel.ub) { alert('Elige prevencionista y ubicación.'); return }
    const { error } = await supabase.from('pr_epp_ubicaciones').insert({ usuario_id: asigSel.u, ubicacion_id: asigSel.ub })
    if (error) { alert(error.code === '23505' ? 'Ya está asignado.' : error.message); return }
    setAsigSel({ u: '', ub: '' }); await cargar()
  }
  const quitar = async (id: string) => { if (!confirm('¿Quitar esta asignación? El stock y el historial se conservan.')) return; const { error } = await supabase.from('pr_epp_ubicaciones').delete().eq('id', id); if (error) alert(error.message); else await cargar() }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Stock de EPP · todas las faenas</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            {bajoMin.length > 0 && (
              <div style={{ ...card, background: '#fde8e8', borderColor: '#f3b4b4', marginBottom: '12px' }}>
                {hdr('bajo', "⚠️ Stock bajo el mínimo", { margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' })}
                {!oc('bajo') && <>
                {bajoMin.map(x => <p key={x.k} style={{ margin: '2px 0', fontSize: '12.5px', color: '#9b1c1c' }}>{x.t}</p>)}
                </>}
              </div>
            )}

            {(() => {
              const prob = activos.filter(c => c.requiere_certificado !== false).flatMap(c => { const cs = certs.filter(x => x.item_id === c.id); if (!cs.length) return [{ k: c.id, t: `${c.nombre}: sin certificado de calidad cargado` }]; return cs.filter(x => x.vence && x.vence <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)).map(x => ({ k: x.id, t: `${c.nombre}${x.proveedor ? ' (' + x.proveedor + ')' : ''}: certificado ${x.vence < new Date().toISOString().slice(0, 10) ? 'vencido' : 'por vencer'} el ${fechaCL(x.vence)}` })) })
              return prob.length > 0 ? <div style={{ ...card, background: '#fff8e5', borderColor: '#f0d98a', marginBottom: '12px' }}>{hdr('certrev', '📎 Certificados de calidad por revisar', { margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#7a5600' })}{!oc('certrev') && prob.map(x => <p key={x.k} style={{ margin: '2px 0', fontSize: '12.5px', color: '#7a5600' }}>{x.t}</p>)}</div> : null
            })()}

            <div style={{ ...card, marginBottom: '12px' }}>
              {hdr('resumen', "Resumen de stock por faena", { margin: '0 0 10px', fontWeight: 700, fontSize: '14px' })}
              {!oc('resumen') && <>
              {ubicEpp.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Aún no hay ubicaciones con control de EPP. Asigna prevencionistas más abajo.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#667085' }}>
                      <th style={{ padding: '6px 8px' }}>EPP</th>
                      {ubicEpp.map(u => <th key={u.id} style={{ padding: '6px 8px', textAlign: 'right' }}>{u.nombre}</th>)}
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                    </tr></thead>
                    <tbody>
                      {activos.map(c => {
                        const tot = ubicEpp.reduce((a, u) => a + total(c.id, u.id), 0)
                        const tallas = tallasFila(c)
                        return (
                          <Fragment key={c.id}>
                          <tr style={{ borderTop: '1px solid #eef1f6' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.nombre}</td>
                            {ubicEpp.map(u => {
                              const v = total(c.id, u.id)
                              const es = c.usa_talla ? tallas.map(t => estado(u.id, c.id, t, stockDe(stock, u.id, c.id, t))) : [estado(u.id, c.id, '', v)]
                              const bajo = es.some(e => e.bajo), igual = !bajo && es.some(e => e.igual)
                              return <td key={u.id} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: bajo ? '#c0392b' : igual ? '#b7791f' : '#16213E', background: bajo ? '#fff5f5' : igual ? '#fff8e5' : undefined }}>{v}</td> })}
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{tot}</td>
                          </tr>
                          {tallas.map(t => (
                            <tr key={c.id + t} style={{ background: '#fafbfd' }}>
                              <td style={{ padding: '3px 8px 3px 24px', color: '#667085', fontSize: '12px' }}>Talla {t}</td>
                              {ubicEpp.map(u => { const v = stockDe(stock, u.id, c.id, t), e = estado(u.id, c.id, t, v), m = minimoDe(minimos, u.id, c.id, t)
                                return <td key={u.id} style={{ padding: '3px 8px', textAlign: 'right', fontSize: '12px', fontWeight: e.bajo || e.igual ? 700 : 400, color: e.bajo ? '#c0392b' : e.igual ? '#b7791f' : '#667085', background: e.bajo ? '#fff5f5' : e.igual ? '#fff8e5' : undefined }}>{v}{m > 0 && <span style={{ fontWeight: 400, color: '#98a2b3' }}> /{m}</span>}</td> })}
                              <td style={{ padding: '3px 8px', textAlign: 'right', color: '#667085', fontSize: '12px' }}>{ubicEpp.reduce((a, u) => a + stockDe(stock, u.id, c.id, t), 0)}</td>
                            </tr>))}
                          </Fragment>)
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ fontSize: '11.5px', color: '#98a2b3', margin: '8px 0 0' }}>En rojo: bajo el stock mínimo de esa faena. En amarillo: justo en el mínimo. En los EPP con talla, el número de arriba es el total y debajo va cada talla con «stock /mínimo». El mínimo se controla por talla.</p>
              </>}
            </div>

            <div style={{ ...card, marginBottom: '12px' }}>
              {hdr('minimos', "Stock mínimo por faena", { margin: '0 0 4px', fontWeight: 700, fontSize: '14px' })}
              {!oc('minimos') && <>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Lo define el Jefe y puedes cambiarlo cuando quieras (queda historial). Cada talla tiene su propio mínimo; celda vacía = sin mínimo definido. El prevencionista lo ve pero no lo puede editar.</p>
              {ubicEpp.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Aún no hay faenas con control de EPP.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#667085' }}><th style={{ padding: '6px 8px' }}>EPP</th>{ubicEpp.map(u => <th key={u.id} style={{ padding: '6px 8px', textAlign: 'right' }}>{u.nombre}</th>)}</tr></thead>
                    <tbody>{activos.map(c => {
                      const celda = (u: any, talla: string) => { const m = minimos.find(x => x.item_id === c.id && x.ubicacion_id === u.id && (x.talla || '') === talla)
                        return <td key={u.id} style={{ padding: '4px 8px', textAlign: 'right' }}><input type="number" min="0" key={c.id + u.id + talla + (m ? m.minimo : 'x')} defaultValue={m ? m.minimo : ''} placeholder="—" onBlur={e => guardarMin(c, u.id, talla, e.target.value)} style={{ ...input, width: '64px', padding: '4px 6px', textAlign: 'right' }} /></td> }
                      if (!c.usa_talla) return (
                        <tr key={c.id} style={{ borderTop: '1px solid #eef1f6' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.nombre}</td>
                          {ubicEpp.map(u => celda(u, ''))}
                        </tr>)
                      return (
                        <Fragment key={c.id}>
                          <tr style={{ borderTop: '1px solid #eef1f6' }}><td colSpan={ubicEpp.length + 1} style={{ padding: '6px 8px', fontWeight: 600 }}>{c.nombre} <span style={{ fontWeight: 400, color: '#98a2b3', fontSize: '11.5px' }}>· un mínimo por talla</span></td></tr>
                          {tallasDe(c).map(t => (
                            <tr key={c.id + t} style={{ background: '#fafbfd' }}>
                              <td style={{ padding: '2px 8px 2px 24px', color: '#667085', fontSize: '12px' }}>Talla {t}</td>
                              {ubicEpp.map(u => celda(u, t))}
                            </tr>))}
                        </Fragment>)
                    })}</tbody>
                  </table>
                </div>
              )}
              </>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '12px', marginBottom: '12px' }}>
              <div style={card}>
                {hdr('prevs', "Prevencionistas por ubicación", { margin: '0 0 8px', fontWeight: 700, fontSize: '14px' })}
                {!oc('prevs') && <>
                {asigs.length === 0 && <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#999' }}>Sin asignaciones.</p>}
                {asigs.map(a => <div key={a.id} style={{ borderTop: '1px solid #eef1f6', padding: '6px 0', fontSize: '13px' }}><strong>{nUser(a.usuario_id)}</strong> · {nUbic(a.ubicacion_id)}</div>)}
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#667085' }}>Se asignan en <Link href="/hsec/jefatura/faenas" style={{ color: AZUL, fontWeight: 600 }}>Faenas y asignaciones →</Link></p>
                </>}
              </div>

              <div style={card}>
                {hdr('catalogo', "Catálogo de EPP", { margin: '0 0 8px', fontWeight: 700, fontSize: '14px' })}
                {!oc('catalogo') && <>
                {catalogo.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #eef1f6', padding: '5px 0', fontSize: '12.5px', opacity: c.activo ? 1 : 0.5 }}>
                    {edit && edit.id === c.id ? (
                      <span style={{ flex: 1, display: 'flex', gap: '4px' }}>
                        <input value={edit.nombre} onChange={e => { const v = e.target.value; setEdit(r => r && { ...r, nombre: v }) }} onKeyDown={e => { if (e.key === 'Enter') renombrar() }} style={{ ...input, padding: '4px 6px' }} autoFocus />
                        <button onClick={renombrar} style={{ ...btn(), padding: '3px 8px', fontSize: '11px' }}>OK</button>
                        <button onClick={() => setEdit(null)} style={{ ...btn(false), padding: '3px 8px', fontSize: '11px' }}>✕</button>
                      </span>
                    ) : <span style={{ flex: 1 }}>{c.nombre} <button onClick={() => setEdit({ id: c.id, nombre: c.nombre })} title="Editar nombre" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button></span>}
                    {c.usa_talla && <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <select value={c.tipo_talla || 'ropa'} onChange={e => act(c.id, { tipo_talla: e.target.value, tallas: e.target.value === 'otra' ? (c.tallas || []) : null })} title="Tallas disponibles al registrar" style={{ ...input, width: 'auto', padding: '3px 6px', fontSize: '11.5px' }}>{Object.entries(TIPOS_TALLA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      {c.tipo_talla === 'otra' && <input defaultValue={(c.tallas || []).join(', ')} placeholder="S, M, L" onBlur={e => { const t = parseTallas(e.target.value); if (t.join() !== (c.tallas || []).join()) act(c.id, { tallas: t }) }} style={{ ...input, width: '110px', padding: '3px 6px', fontSize: '11.5px' }} />}
                    </span>}
                    <button onClick={() => act(c.id, { activo: !c.activo })} style={{ ...btn(false), padding: '3px 8px', fontSize: '11px' }}>{c.activo ? 'Ocultar' : 'Activar'}</button>
                    <button onClick={() => eliminar(c)} title={stockTotal(c.id) !== 0 ? 'Solo se puede eliminar con stock en cero' : 'Eliminar'} style={{ ...btn(false, true), padding: '3px 8px', fontSize: '11px', opacity: stockTotal(c.id) !== 0 ? 0.4 : 1 }}>🗑</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 140px' }}><label style={label}>Nuevo EPP</label><input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} style={input} /></div>
                  <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center', paddingBottom: '9px' }}><input type="checkbox" checked={nuevo.talla} onChange={e => setNuevo({ ...nuevo, talla: e.target.checked })} />Talla</label>
                  {nuevo.talla && <select value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value as TipoTalla })} style={{ ...input, width: 'auto' }}>{Object.entries(TIPOS_TALLA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
                  {nuevo.talla && nuevo.tipo === 'otra' && <input value={nuevo.otras} onChange={e => setNuevo({ ...nuevo, otras: e.target.value })} placeholder="S, M, L" style={{ ...input, width: '110px' }} />}
                  <button onClick={agregar} style={btn()}>Agregar</button>
                </div>
                {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '6px 0 0' }}>{msg}</p>}
                </>}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>{hdr('certs', '📎 Certificados de calidad por EPP', { margin: '0 0 8px', fontWeight: 700, fontSize: '14px' })}{!oc('certs') && <CertificadosEpp items={activos} certs={certs} usuarioId={usuario!.id} esJefe nombreDe={nUser} onCambio={cargar} sinTitulo />}</div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                {hdr('movs', "Últimos movimientos", { margin: 0, fontWeight: 700, fontSize: '14px' })}
                {!oc('movs') && <select value={fUbic} onChange={e => setFUbic(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Todas las ubicaciones</option>{ubicEpp.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>}
              </div>
              {!oc('movs') && (movsF.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Sin movimientos.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#667085' }}><th style={{ padding: '6px 8px' }}>Fecha</th><th style={{ padding: '6px 8px' }}>Ubicación</th><th style={{ padding: '6px 8px' }}>Movimiento</th><th style={{ padding: '6px 8px' }}>EPP</th><th style={{ padding: '6px 8px' }}>Cant.</th><th style={{ padding: '6px 8px' }}>Detalle</th><th style={{ padding: '6px 8px' }}>Registró</th></tr></thead>
                    <tbody>{movsF.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid #eef1f6' }}>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{fechaCL(m.fecha)}</td><td style={{ padding: '6px 8px' }}>{nUbic(m.ubicacion_id)}</td>
                        <td style={{ padding: '6px 8px' }}>{TIPOS[m.tipo]}</td><td style={{ padding: '6px 8px' }}>{nItem(m.item_id)}{m.talla ? ` (${m.talla})` : ''}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
                        <td style={{ padding: '6px 8px' }}>{m.receptor_nombre || m.motivo || ''}</td><td style={{ padding: '6px 8px' }}>{nUser(m.creado_por)}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

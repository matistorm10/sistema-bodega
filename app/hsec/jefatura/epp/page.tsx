'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { fechaCL } from '@/lib/prevencion'

const TIPOS: Record<string, string> = { ingreso: 'Ingreso', entrega: 'Entrega', ajuste: 'Ajuste', baja: 'Baja' }

export default function JefaturaEpp() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [asigs, setAsigs] = useState<any[]>([])
  const [prevs, setPrevs] = useState<any[]>([])
  const [movs, setMovs] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ nombre: '', talla: false, min: '0' })
  const [asigSel, setAsigSel] = useState({ u: '', ub: '' })
  const [fUbic, setFUbic] = useState('')
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    const [c, s, u, a, p, m, us] = await Promise.all([
      supabase.from('pr_epp_catalogo').select('*').order('nombre'),
      supabase.from('pr_epp_stock').select('*'),
      supabase.from('ubicaciones').select('id,nombre,activa').order('nombre'),
      supabase.from('pr_epp_ubicaciones').select('*'),
      supabase.from('usuarios').select('id,nombre').eq('es_prevencionista', true).order('nombre'),
      supabase.from('pr_epp_movimientos').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('usuarios').select('id,nombre'),
    ])
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
  const bajoMin = activos.flatMap(c => c.stock_minimo > 0 ? ubicEpp.filter(u => total(c.id, u.id) < c.stock_minimo).map(u => ({ k: c.id + u.id, t: `${c.nombre} en ${u.nombre}: ${total(c.id, u.id)} (mínimo ${c.stock_minimo})` })) : [])
  const movsF = movs.filter(m => !fUbic || m.ubicacion_id === fUbic).slice(0, 25)

  const agregar = async () => {
    if (!nuevo.nombre.trim()) { setMsg('Escribe el nombre del EPP.'); return }
    const { error } = await supabase.from('pr_epp_catalogo').insert({ nombre: nuevo.nombre.trim(), usa_talla: nuevo.talla, stock_minimo: Number(nuevo.min) || 0 })
    if (error) { setMsg(error.code === '23505' ? 'Ese EPP ya existe.' : error.message); return }
    setNuevo({ nombre: '', talla: false, min: '0' }); setMsg(''); await cargar()
  }
  const act = async (id: string, campos: any) => { const { error } = await supabase.from('pr_epp_catalogo').update(campos).eq('id', id); if (error) alert(error.message); else await cargar() }
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
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' }}>⚠️ Stock bajo el mínimo</p>
                {bajoMin.map(x => <p key={x.k} style={{ margin: '2px 0', fontSize: '12.5px', color: '#9b1c1c' }}>{x.t}</p>)}
              </div>
            )}

            <div style={{ ...card, marginBottom: '12px' }}>
              <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '14px' }}>Resumen de stock por faena</p>
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
                        return (
                          <tr key={c.id} style={{ borderTop: '1px solid #eef1f6' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.nombre}</td>
                            {ubicEpp.map(u => { const v = total(c.id, u.id), bajo = c.stock_minimo > 0 && v < c.stock_minimo
                              return <td key={u.id} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: bajo ? '#c0392b' : '#16213E', background: bajo ? '#fff5f5' : undefined }}>{v}</td> })}
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{tot}</td>
                          </tr>)
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ fontSize: '11.5px', color: '#98a2b3', margin: '8px 0 0' }}>En rojo: bajo el stock mínimo definido para ese EPP. Las tallas se suman en esta vista.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '12px', marginBottom: '12px' }}>
              <div style={card}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Prevencionistas por ubicación</p>
                {asigs.length === 0 && <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#999' }}>Sin asignaciones.</p>}
                {asigs.map(a => <div key={a.id} style={{ borderTop: '1px solid #eef1f6', padding: '6px 0', fontSize: '13px' }}><strong>{nUser(a.usuario_id)}</strong> · {nUbic(a.ubicacion_id)}</div>)}
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#667085' }}>Se asignan en <Link href="/hsec/jefatura/faenas" style={{ color: AZUL, fontWeight: 600 }}>Faenas y asignaciones →</Link></p>
              </div>

              <div style={card}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Catálogo de EPP</p>
                {catalogo.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #eef1f6', padding: '5px 0', fontSize: '12.5px', opacity: c.activo ? 1 : 0.5 }}>
                    <span style={{ flex: 1 }}>{c.nombre}{c.usa_talla ? ' · talla' : ''}</span>
                    <span style={{ color: '#667085' }}>mín.</span>
                    <input type="number" min="0" defaultValue={c.stock_minimo} onBlur={e => { const v = Number(e.target.value); if (v !== c.stock_minimo && v >= 0) act(c.id, { stock_minimo: v }) }} style={{ ...input, width: '60px', padding: '4px 6px' }} />
                    <button onClick={() => act(c.id, { activo: !c.activo })} style={{ ...btn(false), padding: '3px 8px', fontSize: '11px' }}>{c.activo ? 'Ocultar' : 'Activar'}</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 140px' }}><label style={label}>Nuevo EPP</label><input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} style={input} /></div>
                  <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center', paddingBottom: '9px' }}><input type="checkbox" checked={nuevo.talla} onChange={e => setNuevo({ ...nuevo, talla: e.target.checked })} />Talla</label>
                  <button onClick={agregar} style={btn()}>Agregar</button>
                </div>
                {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '6px 0 0' }}>{msg}</p>}
              </div>
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>Últimos movimientos</p>
                <select value={fUbic} onChange={e => setFUbic(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Todas las ubicaciones</option>{ubicEpp.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
              </div>
              {movsF.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Sin movimientos.</p> : (
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
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

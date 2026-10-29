'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { DIAS, hhmm, periodos, inicioPeriodo, limiteEntrega, estadoSemanal, fechaLarga, COLOR_SEM } from '@/lib/semanal'

const abrir = async (path: string) => {
  const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
  if (error || !data) { alert('No se pudo abrir el archivo.'); return }
  window.open(data.signedUrl, '_blank')
}

export default function JefaturaSemanales() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [clientes, setClientes] = useState<any[]>([])
  const [asigs, setAsigs] = useState<any[]>([])
  const [informes, setInformes] = useState<any[]>([])
  const [prevs, setPrevs] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')
  const [nuevo, setNuevo] = useState({ nombre: '', dia: '7', plazo: '1', hora: '23:59' })
  const [asigSel, setAsigSel] = useState<Record<string, { u: string, f: string }>>({})
  const [subiendo, setSubiendo] = useState('')
  const [edNombre, setEdNombre] = useState<{ id: string, nombre: string } | null>(null)

  const cargar = useCallback(async () => {
    const [c, a, i, u, f] = await Promise.all([
      supabase.from('pr_clientes_informe').select('*').order('nombre'),
      supabase.from('pr_semanal_asignaciones').select('*'),
      supabase.from('pr_informes_semanales').select('*'),
      supabase.from('usuarios').select('id,nombre').eq('es_prevencionista', true).order('nombre'),
      supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
    ])
    setClientes(c.data || []); setAsigs(a.data || []); setInformes(i.data || []); setPrevs(u.data || [])
    setFaenas((f.data || []).filter((x: any) => x.activa !== false)); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const nombreU = (id: string) => prevs.find(p => p.id === id)?.nombre || '—'
  const crear = async () => {
    if (!nuevo.nombre.trim()) { setMsg('Escribe el nombre del cliente.'); return }
    const { error } = await supabase.from('pr_clientes_informe').insert({ nombre: nuevo.nombre.trim(), dia_cierre: Number(nuevo.dia), dias_plazo: Number(nuevo.plazo), hora_limite: nuevo.hora || '23:59' })
    if (error) { setMsg(error.code === '23505' ? 'Ese cliente ya existe.' : error.message); return }
    setNuevo({ nombre: '', dia: '7', plazo: '1', hora: '23:59' }); setMsg(''); await cargar()
  }
  const actualizar = async (id: string, campos: any) => {
    const { error } = await supabase.from('pr_clientes_informe').update(campos).eq('id', id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const subirFormato = async (c: any, archivo: File) => {
    setSubiendo(c.id)
    const ext = (archivo.name.split('.').pop() || 'bin').toLowerCase()
    const path = `formatos/${c.id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('hsec-documentos').upload(path, archivo, { contentType: archivo.type || undefined })
    if (error) { setSubiendo(''); alert('No se pudo subir: ' + error.message); return }
    await actualizar(c.id, { formato_path: path, formato_nombre: archivo.name }); setSubiendo('')
  }
  const asignar = async (c: any) => {
    const s = asigSel[c.id]
    if (!s?.u) { alert('Elige al prevencionista.'); return }
    const { error } = await supabase.from('pr_semanal_asignaciones').insert({ cliente_id: c.id, usuario_id: s.u, ubicacion_id: s.f || null })
    if (error) { alert(error.code === '23505' ? 'Ya está asignado a este cliente.' : error.message); return }
    setAsigSel({ ...asigSel, [c.id]: { u: '', f: '' } }); await cargar()
  }
  const quitar = async (id: string) => {
    if (!confirm('¿Quitar esta asignación? Los informes ya entregados se conservan.')) return
    const { error } = await supabase.from('pr_semanal_asignaciones').delete().eq('id', id)
    if (error) { alert(error.message); return }
    await cargar()
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Informes semanales por cliente</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <div style={{ ...card, marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '14px' }}>Nuevo cliente / calendario</p>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Cada cliente tiene su formato y su calendario: el día en que cierra su semana y cuántos días después se debe entregar el informe.</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 180px' }}><label style={label}>Cliente (ej. SQM, ENGIE)</label><input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} style={input} /></div>
                <div style={{ flex: '0 1 150px' }}><label style={label}>La semana cierra el</label><select value={nuevo.dia} onChange={e => setNuevo({ ...nuevo, dia: e.target.value })} style={input}>{DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></div>
                <div style={{ flex: '0 1 130px' }}><label style={label}>Plazo (días después)</label><input type="number" min="0" max="30" value={nuevo.plazo} onChange={e => setNuevo({ ...nuevo, plazo: e.target.value })} style={input} /></div>
                <div style={{ flex: '0 1 110px' }}><label style={label}>Hora límite</label><input type="time" value={nuevo.hora} onChange={e => setNuevo({ ...nuevo, hora: e.target.value })} style={input} /></div>
                <button onClick={crear} style={btn()}>Agregar</button>
              </div>
              {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
            </div>

            {clientes.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay clientes.</p>}
            <div style={{ display: 'grid', gap: '12px' }}>
              {clientes.map(c => {
                const mias = asigs.filter(a => a.cliente_id === c.id)
                const ps = periodos(c.dia_cierre, 4)
                const s = asigSel[c.id] || { u: '', f: '' }
                return (
                  <div key={c.id} style={{ ...card, opacity: c.activo ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {edNombre && edNombre.id === c.id ? (
                        <div style={{ display: 'flex', gap: '6px', flex: '1 1 240px' }}>
                          <input value={edNombre.nombre} onChange={e => { const v = e.target.value; setEdNombre(r => r && { ...r, nombre: v }) }} style={input} autoFocus />
                          <button onClick={async () => { const n = edNombre.nombre.trim(); if (!n) return; const { error } = await supabase.from('pr_clientes_informe').update({ nombre: n }).eq('id', c.id); if (error) { alert(error.code === '23505' ? 'Ya existe un cliente con ese nombre.' : error.message); return } setEdNombre(null); await cargar() }} style={{ ...btn(), padding: '6px 12px', fontSize: '12px' }}>Guardar</button>
                          <button onClick={() => setEdNombre(null)} style={{ ...btn(false), padding: '6px 10px', fontSize: '12px' }}>✕</button>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#16213E' }}>{c.nombre} <button onClick={() => setEdNombre({ id: c.id, nombre: c.nombre })} title="Editar nombre" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px' }}>✏️</button></p>
                      )}
                      <button onClick={() => actualizar(c.id, { activo: !c.activo })} style={{ ...btn(false), padding: '4px 10px', fontSize: '11.5px' }}>{c.activo ? 'Desactivar' : 'Reactivar'}</button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '10px 0' }}>
                      <div><label style={label}>La semana cierra el</label><select value={c.dia_cierre} onChange={e => actualizar(c.id, { dia_cierre: Number(e.target.value) })} style={{ ...input, width: '150px' }}>{DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></div>
                      <div><label style={label}>Plazo (días después)</label><input type="number" min="0" max="30" defaultValue={c.dias_plazo} onBlur={e => { const v = Number(e.target.value); if (v !== c.dias_plazo && v >= 0 && v <= 30) actualizar(c.id, { dias_plazo: v }) }} style={{ ...input, width: '110px' }} /></div>
                      <div><label style={label}>Hora límite</label><input type="time" defaultValue={hhmm(c.hora_limite)} onBlur={e => { if (e.target.value && e.target.value !== hhmm(c.hora_limite)) actualizar(c.id, { hora_limite: e.target.value }) }} style={{ ...input, width: '110px' }} /></div>
                      <div style={{ flex: '1 1 220px' }}>
                        <label style={label}>Formato del cliente</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {c.formato_path && <button onClick={() => abrir(c.formato_path)} style={{ ...btn(false), padding: '6px 10px', fontSize: '12px' }}>📄 {c.formato_nombre || 'Ver formato'}</button>}
                          <label style={{ ...btn(false), padding: '6px 10px', fontSize: '12px', display: 'inline-block' }}>
                            {subiendo === c.id ? 'Subiendo...' : c.formato_path ? 'Reemplazar' : 'Subir formato'}
                            <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirFormato(c, f); e.target.value = '' }} />
                          </label>
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: '4px 0 6px', fontSize: '12.5px', fontWeight: 700, color: '#344054' }}>Prevencionistas asignados</p>
                    {mias.length === 0 && <p style={{ margin: '0 0 6px', fontSize: '12.5px', color: '#98a2b3' }}>Ninguno todavía.</p>}
                    {mias.map(a => (
                      <div key={a.id} style={{ borderTop: '1px solid #eef1f6', padding: '8px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{nombreU(a.usuario_id)}{a.ubicacion_id ? <span style={{ fontWeight: 400, color: '#667085' }}> · {faenas.find(f => f.id === a.ubicacion_id)?.nombre}</span> : null}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {ps.map(fin => {
                            const inf = informes.find(i => i.cliente_id === c.id && i.usuario_id === a.usuario_id && i.periodo_fin === fin)
                            const e = estadoSemanal(fin, c.dias_plazo, !!inf, c.hora_limite)
                            const [bg, col, ic] = COLOR_SEM[e.tipo]
                            return (
                              <span key={fin} title={`${fechaLarga(inicioPeriodo(fin))} al ${fechaLarga(fin)} · ${e.texto}`} onClick={() => inf && abrir(inf.path)}
                                style={{ fontSize: '11.5px', padding: '4px 9px', borderRadius: '8px', background: bg, color: col, cursor: inf ? 'pointer' : 'default' }}>
                                {ic} sem. al {fechaLarga(fin).slice(0, 5)} · {e.tipo === 'entregado' ? 'entregado' : e.tipo === 'vigente' ? `vence ${fechaLarga(limiteEntrega(fin, c.dias_plazo)).slice(0, 5)} ${hhmm(c.hora_limite)}` : 'atrasado'}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <p style={{ margin: '8px 0 0', borderTop: '1px solid #eef1f6', paddingTop: '8px', fontSize: '12px', color: '#667085' }}>Los prevencionistas se asignan según la faena de cada cliente. <Link href="/hsec/jefatura/faenas" style={{ color: AZUL, fontWeight: 600 }}>Faenas y asignaciones →</Link></p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

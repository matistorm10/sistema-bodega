'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import FormActividad from '@/components/programa/FormActividad'
import { card, btn, input, Barra } from '@/components/programa/ui'
import EditorMetas from '@/components/programa/EditorMetas'
import MiFirma from '@/components/programa/MiFirma'
import { descargarProgramaMensual } from '@/lib/generarProgramaMensual'
import { ACTIVIDADES, ORDEN_ACTIVIDADES, CARGOS_PROGRAMA, mesActual, nombreMes, mesesRecientes, pct, estadoPlazo, mesAnterior, textoPlazo } from '@/lib/programa'

const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''
const ESTADOS: Record<string, [string, string, string]> = {
  abierto: ['En curso', '#f1f3f7', '#555'],
  enviado: ['Por aprobar', '#fef7e0', '#986a00'],
  aprobado: ['Aprobado', '#d7efe0', '#14532d'],
  devuelto: ['Devuelto', '#fde8e8', '#9b1c1c'],
}

export default function JefaturaPrograma() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec

  const [mes, setMes] = useState(mesActual())
  const [personas, setPersonas] = useState<any[]>([])
  const [metas, setMetas] = useState<any[]>([])
  const [acts, setActs] = useState<any[]>([])
  const [conDs132, setConDs132] = useState<Set<string>>(new Set())
  const [mensuales, setMensuales] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [ver, setVer] = useState<any | null>(null)
  const [prevPend, setPrevPend] = useState<any[]>([])
  const [retros, setRetros] = useState<Record<string, { desde: string, hasta: string | null }>>({})
  const [verRetro, setVerRetro] = useState(false); const [retroDesde, setRetroDesde] = useState('2026-08-01'); const [msgRetro, setMsgRetro] = useState('')

  const cargar = useCallback(async () => {
    const [p, m, a, mm, f, nm, asg] = await Promise.all([
      supabase.from('usuarios').select('id,nombre,cargo_programa').not('cargo_programa', 'is', null).order('nombre'),
      supabase.from('pr_prog_metas').select('*'),
      supabase.from('pr_prog_actividades').select('*').eq('mes', mes).order('fecha'),
      supabase.from('pr_prog_mensual').select('*').eq('mes', mes),
      supabase.from('ubicaciones').select('id,nombre').eq('tipo', 'faena'),
      supabase.from('pr_faena_normativa').select('ubicacion_id').eq('aplica_ds132', true),
      supabase.from('pr_epp_ubicaciones').select('usuario_id,ubicacion_id'),
    ])
    const rt = await supabase.from('pr_prog_retro').select('usuario_id,desde,hasta'); setRetros(Object.fromEntries((rt.data || []).map((r: any) => [r.usuario_id, { desde: r.desde, hasta: r.hasta }])))
    const ap = new Set((nm.data || []).map((x: any) => x.ubicacion_id)); setConDs132(new Set((asg.data || []).filter((x: any) => ap.has(x.ubicacion_id)).map((x: any) => x.usuario_id)))
    const prev = mesAnterior(mesActual())
    const { data: mp } = await supabase.from('pr_prog_mensual').select('usuario_id,estado').eq('mes', prev)
    setPrevPend((p.data || []).filter((u: any) => { const x = (mp || []).find((y: any) => y.usuario_id === u.id); return !x || x.estado === 'abierto' || x.estado === 'devuelto' }))
    setPersonas(p.data || []); setMetas(m.data || []); setActs(a.data || []); setMensuales(mm.data || []); setFaenas(f.data || [])
    setCargando(false)
  }, [mes])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const habilitarRetro = async (ids: string[]) => {
    if (!retroDesde) { setMsgRetro('Indica desde qué fecha.'); return }
    const { error } = await supabase.from('pr_prog_retro').upsert(ids.map(id => ({ usuario_id: id, desde: retroDesde, hasta: null, created_by: usuario?.id })))
    setMsgRetro(error ? 'No se pudo guardar: ' + error.message : `Registro retroactivo habilitado desde ${fechaCL(retroDesde)} para ${ids.length} persona(s).`); cargar()
  }
  const quitarRetro = async (ids: string[]) => {
    const { error } = await supabase.from('pr_prog_retro').delete().in('usuario_id', ids)
    setMsgRetro(error ? 'No se pudo quitar: ' + error.message : 'Registro retroactivo desactivado.'); cargar()
  }
  const resumen = (u: any) => {
    const ms = metas.filter(m => m.cargo === u.cargo_programa && (m.actividad !== 'verificacion_ds132' || conDs132.has(u.id) || acts.some(a => a.usuario_id === u.id && a.actividad === 'verificacion_ds132')))
    const mine = acts.filter(a => a.usuario_id === u.id)
    const filas = ORDEN_ACTIVIDADES.filter(k => ms.some(m => m.actividad === k)).map(k => {
      const meta = ms.find(m => m.actividad === k)!.meta as number
      const reg = mine.filter(a => a.actividad === k)
      return { k, meta, real: reg.filter(a => a.revision_estado !== 'rechazado').length, reg }
    })
    const tm = filas.reduce((s, f) => s + f.meta, 0), tr = filas.reduce((s, f) => s + Math.min(f.real, f.meta), 0)
    return { filas, cumplimiento: pct(tr, tm) ?? 0 }
  }

  const revisar = async (a: any, estado: 'aprobado' | 'rechazado', comentario?: string) => {
    const { error } = await supabase.from('pr_prog_actividades').update({ revision_estado: estado, revision_comentario: comentario || null }).eq('id', a.id)
    if (error) { alert('No se pudo guardar la revisión: ' + error.message); return }
    await cargar()
  }
  const resolver = async (u: any, estado: 'aprobado' | 'devuelto') => {
    const m = mensuales.find(x => x.usuario_id === u.id)
    if (!m) return
    if (estado === 'devuelto' && !comentario.trim()) { alert('Escribe un comentario para que la persona sepa qué corregir.'); return }
    const { error } = await supabase.from('pr_prog_mensual').update({ estado, comentario: comentario.trim() || null }).eq('id', m.id)
    if (error) { alert(error.message); return }
    setComentario(''); setAbierto(null); await cargar()
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Programa de liderazgo · aprobación mensual</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>

  if (ver) {
    const u = personas.find(p => p.id === ver.usuario_id)
    return (
      <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>
        {cab}
        <p style={{ fontSize: '12.5px', color: '#667085', margin: '0 0 8px' }}>Registro de <strong>{u?.nombre}</strong></p>
        <FormActividad actividad={ver.actividad} usuario={{ id: ver.usuario_id, nombre: u?.nombre || '', cargoPrograma: u?.cargo_programa }} faenas={faenas} inicial={ver} soloLectura
          onGuardar={async () => {}} onCancelar={() => setVer(null)} />
      </div></main>
    )
  }

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            {prevPend.length > 0 && (() => { const pl = estadoPlazo(mesAnterior(mesActual()), 'abierto'); return (
              <div style={{ ...card, marginBottom: '12px', background: pl.tipo === 'atraso' ? '#fde8e8' : '#fff8e5', borderColor: pl.tipo === 'atraso' ? '#f3b4b4' : '#f0d98a' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: pl.tipo === 'atraso' ? '#9b1c1c' : '#7a5600' }}>
                  {pl.tipo === 'atraso' ? '⚠️' : '🗓️'} Programa de {nombreMes(mesAnterior(mesActual()))} sin enviar · plazo {textoPlazo(mesAnterior(mesActual()))}
                </p>
                <p style={{ margin: 0, fontSize: '12.5px', color: pl.tipo === 'atraso' ? '#9b1c1c' : '#7a5600' }}>{prevPend.map(u => u.nombre).join(' · ')}</p>
              </div>) })()}
            {(() => { const pend = acts.filter((a: any) => a.firmado_at && a.revision_estado === 'pendiente'); return pend.length > 0 ? (
              <div style={{ ...card, marginBottom: '12px', background: '#fff8e5', borderColor: '#f0d98a' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#7a5600' }}>📥 {pend.length} documento(s) esperando tu aprobación o rechazo</p>
                {personas.filter(u => pend.some((a: any) => a.usuario_id === u.id)).map(u => <button key={u.id} onClick={() => setAbierto(u.id)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px', margin: '2px 6px 2px 0' }}>{u.nombre} ({pend.filter((a: any) => a.usuario_id === u.id).length}) → Revisar</button>)}
              </div>) : null })()}
            <div style={{ ...card, marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setVerRetro(v => !v)}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px' }}>🕘 Registro con fechas anteriores (ponerse al día)</p>
                <span style={{ fontSize: '12px', color: '#667085' }}>{Object.keys(retros).length} persona(s) habilitada(s)</span>
                <span style={{ marginLeft: 'auto', color: '#667085' }}>{verRetro ? '▲' : '▼'}</span>
              </div>
              {verRetro && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#475467' }}>Por defecto cada persona solo registra con la fecha de hoy. Aquí habilitas a quienes pueden registrar con fechas desde un día anterior hasta hoy. No aplica a meses ya enviados o aprobados (devuélvelos primero). Se sigue permitiendo un solo registro por actividad y día, y la firma queda con la fecha real en que se firma.</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <div><label style={{ display: 'block', fontSize: '11.5px', color: '#667085', marginBottom: '2px' }}>Habilitar desde</label><input type="date" min="2020-01-01" max="2100-12-31" value={retroDesde} onChange={e => setRetroDesde(e.target.value)} style={{ ...input, width: '160px' }} /></div>
                    <button onClick={() => habilitarRetro(personas.map(u => u.id))} style={btn()}>Habilitar a todos</button>
                    <button onClick={() => quitarRetro(personas.map(u => u.id))} style={btn(false)}>Quitar a todos</button>
                  </div>
                  {msgRetro && <p style={{ fontSize: '12.5px', color: '#475467', margin: '0 0 8px' }}>{msgRetro}</p>}
                  {personas.map(u => { const r = retros[u.id]; return (
                    <div key={u.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', borderTop: '1px solid #eef1f6', fontSize: '13px' }}>
                      <span style={{ flex: 1 }}>{u.nombre} <span style={{ color: '#98a2b3', fontSize: '11.5px' }}>{CARGOS_PROGRAMA[u.cargo_programa]}</span></span>
                      {r ? <><span style={{ fontSize: '11.5px', padding: '2px 8px', borderRadius: '20px', background: '#d7efe0', color: '#14532d', fontWeight: 600 }}>Desde {fechaCL(r.desde)}</span><button onClick={() => quitarRetro([u.id])} style={{ ...btn(false), padding: '3px 10px', fontSize: '12px' }}>Quitar</button></>
                        : <button onClick={() => habilitarRetro([u.id])} style={{ ...btn(false), padding: '3px 10px', fontSize: '12px' }}>Habilitar</button>}
                    </div>) })}
                </div>)}
            </div>
            <EditorMetas metas={metas} onCambio={cargar} />
            {usuario && <MiFirma usuarioId={usuario.id} />}
            <select value={mes} onChange={e => setMes(e.target.value)} style={{ ...input, width: 'auto', marginBottom: '12px' }}>
              {Array.from(new Set([mes, ...mesesRecientes(12)])).sort().reverse().map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
            </select>
            {personas.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay usuarios con un cargo en el programa. Asígnalos en Usuarios.</p>}
            <div style={{ display: 'grid', gap: '8px' }}>
              {personas.map(u => {
                const r = resumen(u)
                const m = mensuales.find(x => x.usuario_id === u.id)
                const [et, bg, col] = ESTADOS[m?.estado || 'abierto']
                const open = abierto === u.id
                return (
                  <div key={u.id} style={card}>
                    <div onClick={() => { setAbierto(open ? null : u.id); setComentario(m?.comentario || '') }} style={{ cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 220px' }}>
                        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{u.nombre}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>{CARGOS_PROGRAMA[u.cargo_programa]}</p>
                      </div>
                      <div style={{ width: '130px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}><span style={{ color: '#667085' }}>Cumplimiento</span><strong>{r.cumplimiento}%</strong></div>
                        <Barra valor={r.cumplimiento} />
                      </div>
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: bg, color: col, fontWeight: 600 }}>{et}</span>
                        {(() => { const n = acts.filter((x: any) => x.usuario_id === u.id && x.firmado_at && x.revision_estado === 'pendiente').length; return n > 0 ? <span style={{ fontSize: '11px', color: '#986a00', fontWeight: 700 }}>👉 {n} por revisar</span> : null })()}
                        {(() => { const pl = estadoPlazo(mes, m?.estado, m?.enviado_at); return pl.tipo === 'vigente' ? null : <span style={{ fontSize: '10.5px', color: pl.tipo === 'atraso' ? '#9b1c1c' : '#14532d' }}>{pl.tipo === 'atraso' ? '⚠️' : '✓'} {pl.texto}</span> })()}
                      </span>
                    </div>
                    {open && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
                        {r.filas.map(f => (
                          <div key={f.k} style={{ marginBottom: '8px' }}>
                            <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 600, color: '#344054' }}>{ACTIVIDADES[f.k].nombre} <span style={{ fontWeight: 400, color: f.real >= f.meta ? '#1e8e4e' : '#c0392b' }}>· {f.real} de {f.meta}</span></p>
                            {f.reg.map((a: any) => (
                              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', padding: '3px 0 3px 12px', color: '#475467' }}>
                                <span>{a.firmado_at && <strong style={{ marginRight: '6px', color: a.revision_estado === 'aprobado' ? '#14532d' : a.revision_estado === 'rechazado' ? '#9b1c1c' : '#986a00' }}>{a.revision_estado === 'aprobado' ? '✅' : a.revision_estado === 'rechazado' ? '❌' : '⏳'}</strong>}{fechaCL(a.fecha)} · {faenas.find(x => x.id === a.ubicacion_id)?.nombre || '—'}{a.datos?.tarea ? ` · ${a.datos.tarea}` : a.datos?.tema ? ` · ${a.datos.tema}` : a.datos?.rbs ? ` · RBS N°${a.datos.rbs}` : ''}{a.porcentaje !== null ? ` · ${a.porcentaje}%` : ''}</span>
                                <span style={{ display: 'flex', gap: '6px' }}>
                                  {a.pdf_path && <button onClick={async () => { const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(a.pdf_path, 600); if (error || !data) { alert('No se pudo abrir el PDF.'); return } window.open(data.signedUrl, '_blank') }} style={{ ...btn(false), padding: '3px 10px', fontSize: '12px' }}>📄 PDF firmado</button>}
                                  <button onClick={() => setVer(a)} style={{ ...btn(false), padding: '3px 10px', fontSize: '12px' }}>Ver</button>
                                  {a.firmado_at && (a.actividad === 'verificacion_ds594' || a.actividad === 'verificacion_ds132') && !a.admin_firma_at && <span style={{ fontSize: '11px', color: '#9b1c1c', fontWeight: 600 }}>⏳ Falta firma del administrador</span>}
                                  {a.firmado_at && a.revision_estado !== 'aprobado' && !((a.actividad === 'verificacion_ds594' || a.actividad === 'verificacion_ds132') && !a.admin_firma_at) && <button onClick={() => revisar(a, 'aprobado')} style={{ ...btn(), padding: '3px 10px', fontSize: '12px' }}>✓ Aprobar</button>}
                                  {a.firmado_at && a.revision_estado !== 'rechazado' && <button onClick={() => { const c = prompt('Comentario para el APR (obligatorio):'); if (c && c.trim()) revisar(a, 'rechazado', c.trim()) }} style={{ ...btn(false, true), padding: '3px 10px', fontSize: '12px' }}>✗ Rechazar</button>}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                        <button onClick={() => descargarProgramaMensual({ persona: { id: u.id, nombre: u.nombre, cargo: u.cargo_programa }, mes, metas, acts, mensual: m || null, faenas })} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px', marginTop: '4px' }}>📄 Descargar PDF del mes</button>
                      </div>
                    )}
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

'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import FormActividad from '@/components/programa/FormActividad'
import { card, btn, input, Barra } from '@/components/programa/ui'
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
  const [mensuales, setMensuales] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [ver, setVer] = useState<any | null>(null)
  const [prevPend, setPrevPend] = useState<any[]>([])

  const cargar = useCallback(async () => {
    const [p, m, a, mm, f] = await Promise.all([
      supabase.from('usuarios').select('id,nombre,cargo_programa').not('cargo_programa', 'is', null).order('nombre'),
      supabase.from('pr_prog_metas').select('*'),
      supabase.from('pr_prog_actividades').select('*').eq('mes', mes).order('fecha'),
      supabase.from('pr_prog_mensual').select('*').eq('mes', mes),
      supabase.from('ubicaciones').select('id,nombre').eq('tipo', 'faena'),
    ])
    const prev = mesAnterior(mesActual())
    const { data: mp } = await supabase.from('pr_prog_mensual').select('usuario_id,estado').eq('mes', prev)
    setPrevPend((p.data || []).filter((u: any) => { const x = (mp || []).find((y: any) => y.usuario_id === u.id); return !x || x.estado === 'abierto' || x.estado === 'devuelto' }))
    setPersonas(p.data || []); setMetas(m.data || []); setActs(a.data || []); setMensuales(mm.data || []); setFaenas(f.data || [])
    setCargando(false)
  }, [mes])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const resumen = (u: any) => {
    const ms = metas.filter(m => m.cargo === u.cargo_programa)
    const mine = acts.filter(a => a.usuario_id === u.id)
    const filas = ORDEN_ACTIVIDADES.filter(k => ms.some(m => m.actividad === k)).map(k => {
      const meta = ms.find(m => m.actividad === k)!.meta as number
      const reg = mine.filter(a => a.actividad === k)
      return { k, meta, real: reg.length, reg }
    })
    const tm = filas.reduce((s, f) => s + f.meta, 0), tr = filas.reduce((s, f) => s + Math.min(f.real, f.meta), 0)
    return { filas, cumplimiento: pct(tr, tm) ?? 0 }
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
                                <span>{fechaCL(a.fecha)} · {faenas.find(x => x.id === a.ubicacion_id)?.nombre || '—'}{a.datos?.tarea ? ` · ${a.datos.tarea}` : a.datos?.tema ? ` · ${a.datos.tema}` : a.datos?.rbs ? ` · RBS N°${a.datos.rbs}` : ''}{a.porcentaje !== null ? ` · ${a.porcentaje}%` : ''}</span>
                                <span style={{ display: 'flex', gap: '6px' }}>
                                  {a.pdf_path && <button onClick={async () => { const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(a.pdf_path, 600); if (error || !data) { alert('No se pudo abrir el PDF.'); return } window.open(data.signedUrl, '_blank') }} style={{ ...btn(false), padding: '3px 10px', fontSize: '12px' }}>📄 PDF firmado</button>}
                                  <button onClick={() => setVer(a)} style={{ ...btn(false), padding: '3px 10px', fontSize: '12px' }}>Ver</button>
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                        <button onClick={() => descargarProgramaMensual({ persona: { id: u.id, nombre: u.nombre, cargo: u.cargo_programa }, mes, metas, acts, mensual: m || null, faenas })} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px', marginTop: '4px' }}>📄 Descargar PDF del mes</button>
                        {m && (m.estado === 'enviado' || m.estado === 'aprobado' || m.estado === 'devuelto') ? (
                          <div style={{ marginTop: '10px' }}>
                            <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2} placeholder="Comentarios para el APR (obligatorios si rechazas)" style={{ ...input, resize: 'vertical' }} />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              {m.estado !== 'aprobado' && <button onClick={() => resolver(u, 'aprobado')} style={btn()}>✓ Aprobar programa</button>}
                              {m.estado !== 'devuelto' && <button onClick={() => resolver(u, 'devuelto')} style={btn(false, true)}>✗ Rechazar y devolver al APR</button>}
                            </div>
                          </div>
                        ) : <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#98a2b3' }}>La persona aún no envía su programa del mes.</p>}
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

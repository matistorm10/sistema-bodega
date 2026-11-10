'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn } from '@/components/programa/ui'
import CalendarioCapacitaciones from '@/components/programa/CalendarioCapacitaciones'
import FormCharla from '@/components/programa/FormCharla'
import { misUbicacionesIds } from '@/lib/prevencion'
import { generarCalendarioCapacitaciones } from '@/lib/generarCalendarioCap'
import { abrirVentanaPDF } from '@/lib/abrirPDF'
import { useVersionesCap } from '@/lib/capVersiones'
import { desdeCiclo, etiquetaMes, mesHoy, aplica, estadoCelda, COLOR_CELDA } from '@/lib/capacitaciones'

const AvisoFirma = ({ pendiente }: { pendiente: any }) => pendiente ? (
  <div style={{ ...card, background: '#fff8e5', borderColor: '#f0d98a', marginBottom: '12px' }}>
    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#7a5600' }}>🔒 El calendario de capacitaciones está en firma (revisión {(pendiente.revision || '').trim() || pendiente.numero})</p>
    <p style={{ margin: 0, fontSize: '12.5px', color: '#7a5600' }}>Mientras falten las firmas del Jefe, el Administrador de Faena y el Gerente General no se pueden registrar nuevas capacitaciones ni descargar el PDF. Se habilita solo cuando estén las tres.</p>
  </div>) : null

export default function CapPrevencionista() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const { pendiente, vigente } = useVersionesCap(!!usuario)
  const esJefe = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const puede = esJefe || !!usuario?.esPrevencionista
  const [prog, setProg] = useState<any[]>([])
  const [ubics, setUbics] = useState<any[]>([])
  const [lugares, setLugares] = useState<any[]>([])
  const [charlas, setCharlas] = useState<any[]>([])
  const [asist, setAsist] = useState<any[]>([])
  const [config, setConfig] = useState<any[]>([])
  const [form, setForm] = useState<{ fecha: string, prog?: string } | null>(null)
  const [subiendo, setSubiendo] = useState('')
  const [msg, setMsg] = useState('')
  const [ubic, setUbic] = useState('')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!usuario) return
    const [p, u, l, c, a, cf] = await Promise.all([
      supabase.from('pr_cap_programa').select('*').eq('activo', true).order('n'),
      supabase.from('ubicaciones').select('id,nombre,activa').order('nombre'),
      supabase.from('pr_cap_ubic_lugar').select('*'),
      supabase.from('pr_charlas').select('id,programa_id,ubicacion_id,fecha,tema,tipo,respaldo_path,creado_por').order('fecha', { ascending: false }),
      supabase.from('pr_charla_asistentes').select('charla_id,nombre,rut'),
      supabase.from('pr_cap_config').select('*'),
    ])
    setConfig(cf.data || [])
    setAsist(a.data || [])
    const propias = esJefe ? null : await misUbicacionesIds(usuario.id)
    const lista = (u.data || []).filter((x: any) => x.activa !== false && (!propias || propias.has(x.id)))
    setProg(p.data || []); setUbics(lista); setLugares(l.data || []); setCharlas(c.data || [])
    setUbic(prev => prev && lista.some((x: any) => x.id === prev) ? prev : (lista[0]?.id || '')); setCargando(false)
  }, [usuario, esJefe])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const charlasU = useMemo(() => charlas.filter(c => c.ubicacion_id === ubic), [charlas, ubic])
  const asistCount = useMemo(() => { const m: Record<string, number> = {}; asist.forEach(a => { m[a.charla_id] = (m[a.charla_id] || 0) + 1 }); return m }, [asist])
  const previos = useMemo(() => { const ids = new Set(charlasU.map(c => c.id)); const m = new Map<string, { nombre: string, rut: string }>(); asist.filter(a => ids.has(a.charla_id)).forEach(a => { const k = (a.rut || a.nombre).toLowerCase(); if (!m.has(k)) m.set(k, { nombre: a.nombre, rut: a.rut || '' }) }); return Array.from(m.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)) }, [charlasU, asist])
  const abrirArchivo = async (path: string) => { const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600); if (error || !data) { alert('No se pudo abrir el archivo'); return } window.open(data.signedUrl, '_blank') }
  const subirPapel = async (c: any, f: File) => {
    if (!usuario) return
    if (f.size > 15 * 1024 * 1024) { setMsg('El archivo supera 15 MB.'); return }
    setSubiendo(c.id); setMsg('')
    const path = `charlas/${usuario.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
    if (up.error) { setSubiendo(''); setMsg('No se pudo subir: ' + up.error.message); return }
    const { error } = await supabase.from('pr_charlas').update({ respaldo_path: path, respaldo_nombre: f.name }).eq('id', c.id)
    setSubiendo(''); if (error) { setMsg(error.message); return }
    await cargar()
  }
  const lugar = lugares.find(l => l.ubicacion_id === ubic)?.lugar
  const hoy = mesHoy()
  const filas = useMemo(() => prog.filter(p => aplica(p, lugar)).map(p => ({
    p, celdas: Object.keys(p.meses).sort().map(k => {
      const m = Number(k.slice(5))
      const hechas = charlasU.filter(c => c.programa_id === p.id && c.ubicacion_id === ubic && c.fecha.slice(0, 7) === k).length
      return { m, k, e: estadoCelda(k, hechas, 1, hoy), hechas, cod: p.meses[k] }
    }),
  })), [prog, lugar, charlas, ubic, hoy])
  const pendientes = filas.flatMap(f => f.celdas.filter(c => (c.e === 'atraso' || c.e === 'actual') && c.hechas === 0).map(c => ({ ...c, p: f.p })))
  const planificadas = filas.flatMap(f => f.celdas.filter(c => c.k <= hoy))
  const cumpl = planificadas.length ? Math.round(planificadas.filter(c => c.hechas > 0).length / planificadas.length * 100) : 100

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/prevencionista/sso" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← SSO Faena</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Capacitaciones</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  const wrap = (c: React.ReactNode) => <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>{cab}{c}</div></main>
  if (!puede) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p>)
  if (cargando) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)
  if (ubics.length === 0) return wrap(<p style={{ fontSize: '13px', color: '#667085' }}>Todavía no tienes una faena asignada. La jefatura te la asignará.</p>)

  return wrap(
    <>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
        <select value={ubic} onChange={e => setUbic(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#fff' }}>{ubics.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        <span style={{ fontSize: '13px', color: '#667085' }}>Cumplimiento a la fecha: <strong style={{ color: cumpl >= 100 ? '#1e8e4e' : '#16213E' }}>{cumpl}%</strong></span>
      </div>
      {!lugar && <p style={{ fontSize: '12px', color: '#986a00', margin: '0 0 10px' }}>La jefatura aún no clasifica esta faena (ENGIE / SQM / SACYR / oficina); por ahora ves todo el programa.</p>}

      <AvisoFirma pendiente={pendiente} />
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 8px' }}>{msg}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '8px', marginBottom: '12px' }}>
        {[[`${cumpl}%`, 'Cumplimiento del programa', cumpl >= 100 ? '#1e8e4e' : cumpl >= 70 ? '#b7791f' : '#c0392b'], [pendientes.length, 'Por hacer o atrasadas', pendientes.length ? '#c0392b' : '#1e8e4e'], [charlasU.filter(c => c.fecha.slice(0, 7) === hoy).length, 'Capacitaciones este mes', '#16213E'], [charlasU.filter(c => !c.respaldo_path).length, 'Sin papel firmado', charlasU.some(c => !c.respaldo_path) ? '#b7791f' : '#1e8e4e']].map(([v, t, col]) => (
          <div key={String(t)} style={{ ...card, padding: '10px 12px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: String(col) }}>{v}</p><p style={{ margin: '2px 0 0', fontSize: '11px', color: '#667085' }}>{t}</p></div>))}
      </div>
      {form
        ? <FormCharla key={form.fecha + (form.prog || '')} usuario={{ id: usuario!.id, nombre: usuario!.nombre }} ubicId={ubic} ubicNombre={ubics.find(u => u.id === ubic)?.nombre || ''} programas={filas.map(f => f.p)} previos={previos} fechaIni={form.fecha} progIni={form.prog} onListo={async () => { setForm(null); await cargar() }} onCancelar={() => setForm(null)} />
        : <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}><button disabled={!!pendiente} onClick={() => setForm({ fecha: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) })} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: AZUL, color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', opacity: pendiente ? 0.5 : 1 }}>＋ Registrar capacitación</button><button disabled={!!pendiente || !vigente} title={pendiente ? 'Disponible cuando estén las tres firmas' : ''} onClick={async () => { const v = abrirVentanaPDF(); try { await generarCalendarioCapacitaciones({ prog: vigente!.snapshot || prog, desde: vigente!.desde || desdeCiclo(config, prog), version: vigente }, v) } catch (e: any) { v?.close(); alert('No se pudo generar el PDF: ' + (e?.message || e)) } }} style={{ ...btn(false), opacity: pendiente ? 0.5 : 1 }}>📄 Descargar calendario (PDF)</button></div>}
      <CalendarioCapacitaciones charlas={charlasU} asistCount={asistCount} filas={filas} puedeEditar onRegistrar={(fecha, prog) => { if (pendiente) { setMsg('El calendario está en firma: no se pueden registrar capacitaciones hasta que estén las tres firmas.'); return } setForm({ fecha, prog }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} onVer={abrirArchivo} onSubirPapel={subirPapel} subiendo={subiendo} />

      <details style={card}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>Programa anual completo de esta faena</summary>
        {filas.map(f => (
          <div key={f.p.id} style={{ borderTop: '1px solid #eef1f6', padding: '8px 0' }}>
            <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600 }}>{f.p.n}. {f.p.tematica}</p>
            <p style={{ margin: '0 0 5px', fontSize: '11.5px', color: '#667085' }}>{f.p.horas} h · {f.p.tipo === 'difusion' ? 'difusión' : 'capacitación'} · relator {f.p.resp_curso}</p>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {f.celdas.map(c => { const [bg, col] = COLOR_CELDA[c.e]; return <span key={c.k} style={{ fontSize: '11.5px', padding: '3px 9px', borderRadius: '8px', background: bg, color: col, fontWeight: 600 }}>{etiquetaMes(c.k)}{c.cod !== 'P' ? ` ${c.cod}` : ''} {c.e === 'ok' ? '✓' : c.e === 'atraso' ? '✗' : ''}</span> })}
            </div>
          </div>
        ))}
      </details>
    </>
  )
}

'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ACTIVIDADES, CARGOS_PROGRAMA } from '@/lib/programa'
import { generarRegistroActividad } from '@/lib/generarRegistroActividad'
import { extraerPlanes, estadoPlazo, aplicarCierre, type PlanItem } from '@/lib/planesAccion'
import { hoyISO } from '@/lib/estadoPlan'
import { card, btn, input, label } from './ui'

const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''

// Aviso en la pantalla principal del programa: oportunidades de mejora abiertas (en plazo / pendientes) y cierre con evidencia.
export default function OportunidadesPendientes({ usuario, faenas, onCambio }: { usuario: any, faenas: any[], onCambio?: () => void }) {
  const [planes, setPlanes] = useState<PlanItem[]>([])
  const [verCerradas, setVerCerradas] = useState(false)
  const [sel, setSel] = useState<PlanItem | null>(null)
  const [fecha, setFecha] = useState(hoyISO()); const [coment, setComent] = useState(''); const [archivos, setArchivos] = useState<File[]>([])
  const [trabajando, setTrabajando] = useState(false); const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pr_prog_actividades').select('*').eq('usuario_id', usuario.id).in('actividad', ['verificacion_ds594', 'verificacion_ds132', 'cdp_tarea_critica']).order('fecha', { ascending: false }).limit(600)
    setPlanes((data || []).flatMap(extraerPlanes))
  }, [usuario.id])
  useEffect(() => { cargar() }, [cargar])

  const abiertas = planes.filter(p => !p.cerrado).sort((a, b) => estadoPlazo(a).orden - estadoPlazo(b).orden)
  const cerradas = planes.filter(p => p.cerrado && p.cierre)
  const vencidas = abiertas.filter(p => p.plazo && p.plazo < hoyISO()).length
  if (abiertas.length === 0 && cerradas.length === 0) return null

  const abrir = (p: PlanItem) => { setSel(p); setFecha(hoyISO()); setComent(''); setArchivos([]); setMsg('') }

  const cerrar = async () => {
    if (!sel) return
    if (archivos.length === 0) { setMsg('Sube al menos una foto o archivo como evidencia del cierre.'); return }
    if (!fecha || fecha > hoyISO()) { setMsg('La fecha de cierre no puede ser futura.'); return }
    setTrabajando(true); setMsg('')
    try {
      const a = sel.act
      const paths: string[] = []
      for (const f of archivos) {
        const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
        const path = `programa/${usuario.id}/cierres/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
        const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
        if (up.error) throw new Error('No se pudo subir ' + f.name + ': ' + up.error.message)
        paths.push(path)
      }
      const datos = aplicarCierre(a.datos, sel.clave, { fecha, comentario: coment.trim(), evidencia: paths, por: usuario.nombre, registrado_at: new Date().toISOString() })
      let pdf: string | null = null
      if (a.firmado_at) {
        // el PDF del ítem se genera de nuevo con el cierre y sus evidencias, conservando las firmas
        const { data: f1 } = await supabase.from('firmas_usuario').select('imagen').eq('usuario_id', usuario.id).maybeSingle()
        let admin: any = null
        if (a.admin_firma_at && a.admin_firma_por) {
          const [{ data: fa }, { data: ua }] = await Promise.all([supabase.from('firmas_usuario').select('imagen').eq('usuario_id', a.admin_firma_por).maybeSingle(), supabase.from('usuarios').select('nombre').eq('id', a.admin_firma_por).maybeSingle()])
          admin = { nombre: ua?.nombre || '', firma: fa?.imagen || null, firmadoAt: a.admin_firma_at }
        }
        const blob = await generarRegistroActividad({ actividad: a.actividad, fecha: a.fecha, faena: faenas.find(x => x.id === a.ubicacion_id)?.nombre || '', nombre: usuario.nombre, cargo: usuario.cargoPrograma ? CARGOS_PROGRAMA[usuario.cargoPrograma] : '', datos, porcentaje: a.porcentaje, firma: f1?.imagen || null, firmadoAt: a.firmado_at, admin })
        pdf = `programa/${usuario.id}/registros/${a.id}_${Date.now()}.pdf`
        const up = await supabase.storage.from('hsec-documentos').upload(pdf, blob, { contentType: 'application/pdf' })
        if (up.error) throw new Error('No se pudo archivar el PDF actualizado: ' + up.error.message)
      }
      const { error } = await supabase.rpc('pr_cerrar_plan', { p_id: a.id, p_datos: datos, p_pdf: pdf })
      if (error) throw new Error(error.message)
      setSel(null); await cargar(); onCambio?.()
    } catch (e: any) { setMsg(e.message || 'No se pudo registrar el cierre.') } finally { setTrabajando(false) }
  }

  const fila = (p: PlanItem, k: string) => { const e = estadoPlazo(p); return (
    <div key={k} style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid #eef1f6', fontSize: '12.5px' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div><strong>{ACTIVIDADES[p.act.actividad]?.corto}</strong> · {p.ref} · {fechaCL(p.act.fecha)} · {faenas.find(x => x.id === p.act.ubicacion_id)?.nombre || '—'}</div>
        <div style={{ color: '#344054' }}>{p.texto}{p.responsable ? <span style={{ color: '#667085' }}> · Resp.: {p.responsable}</span> : null}{p.plazo ? <span style={{ color: '#667085' }}> · Plazo {fechaCL(p.plazo)}</span> : null}</div>
        {p.cierre && <div style={{ color: '#667085' }}>Cerrada el {fechaCL(p.cierre.fecha)}{p.cierre.comentario ? ` · ${p.cierre.comentario}` : ''} · {(p.cierre.evidencia || []).length} evidencia(s)</div>}
      </div>
      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: e.bg, color: e.col, whiteSpace: 'nowrap' }}>{e.txt}</span>
      {!p.cerrado && <button onClick={() => abrir(p)} style={{ ...btn(), padding: '4px 12px', fontSize: '12px' }}>Cerrar con evidencia</button>}
    </div>) }

  return (
    <div style={{ ...card, marginBottom: '12px', borderColor: vencidas ? '#f0b4b4' : '#cfe0f5', background: vencidas ? '#fff8f8' : '#f7faff' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13.5px', color: vencidas ? '#9b1c1c' : '#1B4F9C' }}>
        🎯 Oportunidades de mejora por cerrar: {abiertas.length}{vencidas ? ` · ${vencidas} pendiente${vencidas === 1 ? '' : 's'} por plazo excedido` : abiertas.length ? ' · todas en plazo' : ''}
      </p>
      {abiertas.length === 0 && <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: '#667085' }}>No tienes oportunidades abiertas.</p>}
      {abiertas.map((p, i) => fila(p, 'a' + i))}
      {cerradas.length > 0 && <button onClick={() => setVerCerradas(!verCerradas)} style={{ ...btn(false), padding: '4px 12px', fontSize: '12px', marginTop: '8px' }}>{verCerradas ? 'Ocultar' : 'Ver'} cerradas ({cerradas.length})</button>}
      {verCerradas && cerradas.map((p, i) => fila(p, 'c' + i))}
      {sel && (
        <div onClick={() => !trabajando && setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px' }}>Cerrar oportunidad de mejora</p>
            <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#475467' }}>{ACTIVIDADES[sel.act.actividad]?.corto} · {sel.ref} · {sel.texto}</p>
            <label style={label}>Fecha de cierre</label>
            <input type="date" max={hoyISO()} value={fecha} onChange={e => setFecha(e.target.value)} style={input} />
            <label style={{ ...label, marginTop: '8px' }}>Comentario (opcional)</label>
            <textarea value={coment} onChange={e => setComent(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} placeholder="Qué se hizo para cerrarla" />
            <label style={{ ...label, marginTop: '8px' }}>Evidencia de cierre (fotos o PDF) *</label>
            <input type="file" accept="image/*,application/pdf" multiple onChange={e => setArchivos(Array.from(e.target.files || []))} style={{ fontSize: '12.5px' }} />
            {archivos.length > 0 && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#667085' }}>{archivos.length} archivo(s): {archivos.map(f => f.name).join(', ')}</p>}
            <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#667085' }}>Al confirmar, la evidencia se agrega al PDF del registro donde se levantó la oportunidad.</p>
            {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}><button onClick={cerrar} disabled={trabajando} style={btn()}>{trabajando ? 'Guardando…' : 'Confirmar cierre'}</button><button onClick={() => setSel(null)} disabled={trabajando} style={btn(false)}>Cancelar</button></div>
          </div>
        </div>)}
    </div>
  )
}

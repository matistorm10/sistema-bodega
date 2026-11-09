'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { generarRegistroActividad } from '@/lib/generarRegistroActividad'
import { ACTIVIDADES, CARGOS_PROGRAMA } from '@/lib/programa'
import FirmaPreview from './FirmaPreview'
import { card, btn } from './ui'

const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''
const ACTS = ['verificacion_ds594', 'verificacion_ds132']

// Autoevaluaciones DS 594 / DS 132 firmadas por el APR que esperan la firma del administrador de contrato o faena.
export default function FirmasAdministrador({ usuario, faenas }: { usuario: any, faenas: any[] }) {
  const [pend, setPend] = useState<any[]>([])
  const [nombres, setNombres] = useState<Record<string, { nombre: string, cargo: string | null }>>({})
  const [faenasTodas, setFaenasTodas] = useState<any[]>(faenas)
  const [sel, setSel] = useState<any | null>(null)
  const [firmaApr, setFirmaApr] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pr_prog_actividades').select('*').in('actividad', ACTS).not('firmado_at', 'is', null).is('admin_firma_at', null).order('fecha', { ascending: false })
    setPend(data || [])
    const ids = Array.from(new Set((data || []).map((a: any) => a.usuario_id)))
    if (ids.length) {
      const { data: us } = await supabase.from('usuarios').select('id,nombre,cargo_programa').in('id', ids)
      setNombres(Object.fromEntries((us || []).map((u: any) => [u.id, { nombre: u.nombre, cargo: u.cargo_programa }])))
    }
    const { data: fa } = await supabase.from('ubicaciones').select('id,nombre').eq('tipo', 'faena'); setFaenasTodas(fa || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const abrir = async (a: any) => {
    setMsg('')
    const { data } = await supabase.from('firmas_usuario').select('imagen').eq('usuario_id', a.usuario_id).maybeSingle()
    setFirmaApr(data?.imagen || null); setSel(a)
  }
  const base = (a: any) => ({
    actividad: a.actividad, fecha: a.fecha, faena: faenasTodas.find(x => x.id === a.ubicacion_id)?.nombre || '', nombre: nombres[a.usuario_id]?.nombre || '',
    cargo: nombres[a.usuario_id]?.cargo ? CARGOS_PROGRAMA[nombres[a.usuario_id].cargo!] : '', datos: a.datos, porcentaje: a.porcentaje,
  })
  const firmar = async (firma: string, firmaNueva: boolean) => {
    const a = sel; if (!a) return
    const ahora = new Date().toISOString()
    if (firmaNueva) {
      const { error } = await supabase.from('firmas_usuario').upsert({ usuario_id: usuario.id, imagen: firma, consentimiento_at: ahora, updated_at: ahora })
      if (error) throw new Error('No se pudo guardar tu firma: ' + error.message)
    } else await supabase.from('firmas_usuario').update({ consentimiento_at: ahora }).eq('usuario_id', usuario.id)
    const blob = await generarRegistroActividad({ ...base(a), firma: firmaApr, firmadoAt: a.firmado_at, admin: { nombre: usuario.nombre, firma, firmadoAt: ahora } })
    const path = `programa/${a.usuario_id}/registros/${a.id}_${Date.now()}.pdf`
    const up = await supabase.storage.from('hsec-documentos').upload(path, blob, { contentType: 'application/pdf' })
    if (up.error) throw new Error('No se pudo archivar el documento: ' + up.error.message)
    const { error } = await supabase.rpc('pr_firmar_admin', { p_id: a.id, p_pdf: path })
    if (error) throw new Error('No se pudo registrar la firma: ' + error.message)
    setSel(null); await cargar()
  }

  if (sel) return <FirmaPreview usuarioId={usuario.id} exigeDescriptor={false} onVolver={() => setSel(null)} onConfirmar={firmar}
    generar={() => generarRegistroActividad({ ...base(sel), firma: firmaApr, firmadoAt: sel.firmado_at, admin: { nombre: usuario.nombre } })} />
  if (pend.length === 0) return null
  return (
    <div style={{ ...card, marginBottom: '12px', background: '#fff8e5', border: '1px solid #f0d98a' }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px', color: '#7a5600' }}>✍️ {pend.length} autoevaluación(es) esperando tu firma como administrador de contrato / faena</p>
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 6px' }}>{msg}</p>}
      {pend.map(a => (
        <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f3e4b0', fontSize: '12.5px' }}>
          <span>{ACTIVIDADES[a.actividad]?.corto} · {fechaCL(a.fecha)} · {faenasTodas.find(x => x.id === a.ubicacion_id)?.nombre || '—'} · {nombres[a.usuario_id]?.nombre || ''}{a.porcentaje !== null ? ` · ${a.porcentaje}%` : ''}</span>
          <button onClick={() => abrir(a)} style={{ ...btn(), padding: '4px 12px', fontSize: '12px' }}>Revisar y firmar</button>
        </div>))}
    </div>
  )
}

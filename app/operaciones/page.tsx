'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card } from '@/components/programa/ui'
import Marco from '@/components/operaciones/Marco'
import { traerTodo, hoyISO, sumarDias, fechaCorta, estadoEn, asigEn, TIPOS_CONTRATO, type Asig, type Turno } from '@/lib/operaciones'

export default function Operaciones() {
  const [trab, setTrab] = useState<any[]>([])
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const hoy = hoyISO()

  useEffect(() => {
    (async () => {
      try {
        const [t, a, tu, c] = await Promise.all([traerTodo('op_trabajadores'), traerTodo('op_asignaciones'), traerTodo('op_turnos'), supabase.from('pr_contratos').select('id,nombre,empresa,referencia,activo').order('nombre')])
        setTrab(t); setAsigs(a as Asig[]); setTurnos(tu as Turno[]); setContratos(c.data || [])
      } catch (e: any) { setError(e.message || 'No se pudo cargar') }
      setCargando(false)
    })()
  }, [])

  const nTrab = (id: string) => trab.find(t => t.id === id)?.nombre || '—'
  const nCont = (id?: string) => { const c = contratos.find(x => x.id === id); return c ? (c.empresa ? `${c.empresa} · ${c.nombre}` : c.nombre) : '—' }
  const activos = trab.filter(t => t.activo)
  const filas = contratos.map(c => {
    const ids = asigs.filter(a => a.contrato_id === c.id && a.desde <= hoy && (!a.hasta || a.hasta >= hoy)).map(a => a.trabajador_id)
    const enFaena = ids.filter(id => estadoEn(asigs, turnos, id, hoy) === 'faena').length
    return { c, total: ids.length, enFaena, descanso: ids.length - enFaena }
  }).filter(f => f.total > 0)
  const totEn = filas.reduce((a, f) => a + f.enFaena, 0), totDesc = filas.reduce((a, f) => a + f.descanso, 0)
  const hasta14 = sumarDias(hoy, 14), hasta30 = sumarDias(hoy, 30)
  const subidas = turnos.filter(t => t.sube > hoy && t.sube <= hasta14).sort((a, b) => a.sube.localeCompare(b.sube))
  const bajadas = turnos.filter(t => t.baja && t.baja >= hoy && t.baja <= hasta14).sort((a, b) => (a.baja || '').localeCompare(b.baja || ''))
  const vencen = asigs.filter(a => a.tipo_contrato && a.tipo_contrato !== 'indefinido' && a.vence && a.vence >= sumarDias(hoy, -7) && a.vence <= hasta30 && !a.hasta).sort((a, b) => (a.vence || '').localeCompare(b.vence || ''))
  const sinContratoHoy = activos.filter(t => !asigEn(asigs, t.id, hoy)).length

  const kpi = (n: number | string, t: string, col = '#16213E') => <div style={{ ...card, textAlign: 'center' }}><p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: col }}>{n}</p><p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#667085' }}>{t}</p></div>
  const lista = (titulo: string, items: { k: string, t: string, f: string }[]) => (
    <div style={card}>
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>{titulo}</p>
      {items.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Nada en este período.</p> : items.slice(0, 12).map(i => <p key={i.k} style={{ margin: '3px 0', fontSize: '12.5px' }}><strong>{fechaCorta(i.f)}</strong> · {i.t}</p>)}
      {items.length > 12 && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#667085' }}>…y {items.length - 12} más</p>}
    </div>
  )
  const acceso = (href: string, icono: string, t: string, d: string) => (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', ...card, display: 'flex', alignItems: 'center', gap: '14px', borderColor: AZUL }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(27,79,156,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px' }}>{icono}</div>
      <div><p style={{ fontWeight: 700, fontSize: '14.5px', margin: '0 0 2px', color: '#16213E' }}>{t}</p><p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>{d}</p></div>
    </Link>
  )

  return (
    <Marco titulo="Operaciones" volver="/" volverTxt="← Inicio">
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : error ? <p style={{ fontSize: '13px', color: '#c5221f' }}>{error}</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '10px', marginBottom: '14px' }}>
            {acceso('/operaciones/trabajadores', '👷', 'Trabajadores', 'Ficha, contratos, plazos y turnos de cada persona')}
            {acceso('/operaciones/turnos', '🗓️', 'Turnos', 'Grilla de quién está en faena cada día, por contrato, con descarga a Excel')}
          </div>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>Dónde está el personal hoy ({fechaCorta(hoy)})</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '12px' }}>
            {kpi(totEn, 'En faena', '#1e8e4e')}{kpi(totDesc, 'En descanso', '#1B4F9C')}{kpi(activos.length, 'Trabajadores activos')}{kpi(sinContratoHoy, 'Activos sin contrato hoy', sinContratoHoy ? '#b7791f' : '#1e8e4e')}
          </div>
          <div style={{ ...card, marginBottom: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ textAlign: 'left', color: '#667085', fontSize: '12px' }}><th style={{ padding: '6px 8px' }}>Contrato</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>En faena</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Descanso</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>{filas.map(f => (
                <tr key={f.c.id} style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 600 }}><Link href={`/operaciones/turnos?contrato=${f.c.id}`} style={{ color: AZUL, textDecoration: 'none' }}>{nCont(f.c.id)}</Link><span style={{ display: 'block', fontWeight: 400, fontSize: '11.5px', color: '#98a2b3' }}>{(f.c.referencia || '').slice(0, 70)}</span></td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#1e8e4e' }}>{f.enFaena}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right' }}>{f.descanso}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700 }}>{f.total}</td>
                </tr>))}
                {filas.length === 0 && <tr><td colSpan={4} style={{ padding: '10px', fontSize: '12.5px', color: '#999' }}>Aún no hay trabajadores asignados a contratos hoy.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '12px' }}>
            {lista('⬆️ Subidas próximos 14 días', subidas.map(t => ({ k: t.id, f: t.sube, t: `${nTrab(t.trabajador_id)} · ${nCont(asigEn(asigs, t.trabajador_id, t.sube)?.contrato_id)}` })))}
            {lista('⬇️ Bajadas próximos 14 días', bajadas.map(t => ({ k: t.id, f: t.baja as string, t: `${nTrab(t.trabajador_id)} · ${nCont(asigEn(asigs, t.trabajador_id, t.baja as string)?.contrato_id)}` })))}
            {lista('📄 Plazos de contrato por vencer (30 días)', vencen.map(a => ({ k: a.id, f: a.vence as string, t: `${nTrab(a.trabajador_id)} · ${TIPOS_CONTRATO[a.tipo_contrato as string]}${(a.vence as string) < hoy ? ' (vencido)' : ''}` })))}
          </div>
        </>
      )}
    </Marco>
  )
}

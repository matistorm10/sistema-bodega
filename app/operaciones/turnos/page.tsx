'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card, btn, input } from '@/components/programa/ui'
import Marco from '@/components/operaciones/Marco'
import FiltroContratos from '@/components/operaciones/FiltroContratos'
import { etiquetaContrato, cmpPersonal, TIPOS_PERSONAL, traerTodo, hoyISO, sumarDias, fechaCorta, DIAS_SEM, descargarXlsx, type Asig, type Turno, type Vuelo } from '@/lib/operaciones'

export default function GrillaTurnos() {
  const hoy = hoyISO()
  const [trab, setTrab] = useState<any[]>([])
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [contrato, setContrato] = useState<string[]>([])
  const [vuelos, setVuelos] = useState<Vuelo[]>([])
  const [desde, setDesde] = useState(sumarDias(hoy, -3))
  const [ndias, setNdias] = useState(28)
  const [soloActivos, setSoloActivos] = useState(true)

  useEffect(() => {
    try { const c = new URLSearchParams(window.location.search).get('contrato'); if (c) setContrato(c.split(',').filter(Boolean)) } catch {}
    (async () => {
      const [t, a, tu, c, v] = await Promise.all([traerTodo('op_trabajadores', '*', 'nombre'), traerTodo('op_asignaciones'), traerTodo('op_turnos'), supabase.from('pr_contratos').select('id,nombre,empresa,referencia').order('nombre'), traerTodo('op_vuelos')])
      setVuelos(v as Vuelo[]); setTrab(t); setAsigs(a as Asig[]); setTurnos(tu as Turno[]); setContratos(c.data || []); setCargando(false)
    })()
  }, [])
  const nCont = (id?: string) => etiquetaContrato(contratos.find(x => x.id === id))
  const vueloDe = useMemo(() => { const m = new Map<string, Vuelo[]>(); vuelos.forEach(v => { const k = v.trabajador_id + '|' + v.fecha; m.set(k, [...(m.get(k) || []), v]) }); return m }, [vuelos])
  const dias = useMemo(() => Array.from({ length: ndias }, (_, i) => sumarDias(desde, i)), [desde, ndias])
  const hasta = dias[dias.length - 1]

  const filas = useMemo(() => [...trab].sort(cmpPersonal).filter(t => !soloActivos || t.activo).map(t => {
    const as = asigs.filter(a => a.trabajador_id === t.id && a.desde <= hasta && (!a.hasta || a.hasta >= desde) && (contrato.length === 0 || contrato.includes(a.contrato_id)))
    if (as.length === 0) return null
    const ts = turnos.filter(x => x.trabajador_id === t.id && x.sube <= hasta && (!x.baja || x.baja >= desde))
    const celdas = dias.map(d => {
      const a = as.find(x => x.desde <= d && (!x.hasta || x.hasta >= d))
      const en = !!a && ts.some(x => x.sube <= d && (!x.baja || x.baja >= d))
      return { a, en }
    })
    return { t, celdas, contratoPrincipal: as[as.length - 1].contrato_id }
  }).filter(Boolean) as { t: any, celdas: { a?: Asig, en: boolean }[], contratoPrincipal: string }[], [trab, asigs, turnos, contrato, dias, desde, hasta, soloActivos])
  const totales = dias.map((_, i) => filas.filter(f => f.celdas[i].en).length)

  const descargar = () => descargarXlsx(`Turnos_${desde}_a_${hasta}.xlsx`, async (X) => {
    const libro = new X.Workbook(); libro.creator = 'Sistema INDELI'
    const h = libro.addWorksheet('Turnos')
    const cab = h.addRow(['Nombre', 'Tipo', 'Cargo', 'RUT', 'Contrato', ...dias.map(d => fechaCorta(d).slice(0, 5))]); cab.font = { bold: true }
    filas.forEach(f => h.addRow([f.t.nombre, TIPOS_PERSONAL[f.t.tipo_personal] || 'Directo', f.t.cargo || '', f.t.rut || '', nCont(f.contratoPrincipal), ...f.celdas.map(c => c.en ? 1 : '')]))
    h.addRow(['TOTAL EN FAENA', '', '', '', '', ...totales]).font = { bold: true }
    h.columns = [{ width: 28 }, { width: 11 }, { width: 22 }, { width: 14 }, { width: 30 }, ...dias.map(() => ({ width: 5.5 }))]
    h.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
    return libro
  })

  const W = 26
  return (
    <Marco titulo="Turnos" ancho={1400}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <FiltroContratos contratos={contratos} sel={contrato} onChange={setContrato} />
        <button onClick={() => setDesde(sumarDias(desde, -ndias))} style={{ ...btn(false), padding: '8px 12px' }}>←</button>
        <input type="date" value={desde} onChange={e => e.target.value && setDesde(e.target.value)} style={{ ...input, width: '150px' }} />
        <button onClick={() => setDesde(sumarDias(desde, ndias))} style={{ ...btn(false), padding: '8px 12px' }}>→</button>
        <button onClick={() => setDesde(sumarDias(hoy, -3))} style={{ ...btn(false), padding: '8px 12px' }}>Hoy</button>
        <select value={ndias} onChange={e => setNdias(Number(e.target.value))} style={{ ...input, width: 'auto' }}>{[14, 28, 42, 60].map(n => <option key={n} value={n}>{n} días</option>)}</select>
        <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center' }}><input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} />Solo activos</label>
        <button onClick={descargar} style={{ ...btn(), marginLeft: 'auto' }}>⬇ Descargar Excel</button>
      </div>
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
        <div style={{ ...card, padding: '10px', overflowX: 'auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>{filas.length} trabajadores · del {fechaCorta(desde)} al {fechaCorta(hasta)} · <span style={{ background: '#1e8e4e', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>1</span> en faena · <span style={{ background: '#f59e0b', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>✈</span> día de vuelo/bus · <span style={{ background: '#eef1f6', padding: '0 6px', borderRadius: '4px' }}>gris</span> sin contrato ese día</p>
          <table style={{ borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <thead>
              <tr><th style={{ position: 'sticky', left: 0, background: '#fff', minWidth: '190px', textAlign: 'left', padding: '4px 6px', zIndex: 1 }}>Trabajador</th>
                {dias.map(d => { const dt = new Date(d + 'T12:00:00'); const esHoy = d === hoy; return <th key={d} style={{ minWidth: W, width: W, padding: '2px 0', textAlign: 'center', background: esHoy ? '#fff3cd' : dt.getDay() === 0 || dt.getDay() === 6 ? '#f8fafc' : '#fff', fontWeight: esHoy ? 700 : 500, color: '#667085', lineHeight: 1.15 }}>{dt.getDate() === 1 || d === desde ? <div style={{ fontSize: '9px', color: AZUL }}>{dt.toLocaleDateString('es-CL', { month: 'short' })}</div> : <div style={{ fontSize: '9px' }}>&nbsp;</div>}<div>{dt.getDate()}</div><div style={{ fontSize: '9px' }}>{DIAS_SEM[dt.getDay()]}</div></th> })}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, ix) => (
                <Fragment key={f.t.id}>
                {(ix === 0 || filas[ix - 1].t.tipo_personal !== f.t.tipo_personal) && <tr><td colSpan={dias.length + 1} style={{ position: 'sticky', left: 0, background: f.t.tipo_personal === 'indirecto' ? '#fff3cd' : '#f2f4f7', fontWeight: 700, fontSize: '11px', padding: '3px 6px', color: '#475467' }}>{f.t.tipo_personal === 'indirecto' ? 'INDIRECTOS' : 'DIRECTOS'} ({filas.filter(x => x.t.tipo_personal === f.t.tipo_personal).length})</td></tr>}
                <tr style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '3px 6px', whiteSpace: 'nowrap', zIndex: 1 }}><Link href={`/operaciones/trabajadores/${f.t.id}`} style={{ color: AZUL, textDecoration: 'none', fontWeight: 600 }}>{f.t.nombre}</Link><span style={{ color: '#98a2b3', marginLeft: '6px', fontSize: '10.5px' }}>{f.t.cargo || ''}</span></td>
                  {f.celdas.map((c, i) => { const vs = vueloDe.get(f.t.id + '|' + dias[i]); const tip = vs?.map(v => `${v.tipo || 'vuelo'} ${v.medio === 'bus' ? 'bus' : v.aerolinea || ''} ${v.hora || ''}`.trim()).join(' / ')
                    return <td key={i} title={tip} style={{ width: W, minWidth: W, height: '22px', textAlign: 'center', fontWeight: 700, background: vs ? '#f59e0b' : c.en ? '#1e8e4e' : !c.a ? '#eef1f6' : dias[i] === hoy ? '#fff8e5' : undefined, color: '#fff', borderLeft: '1px solid #f2f4f7', fontSize: vs ? '11px' : undefined }}>{vs ? (vs[0].medio === 'bus' ? '🚌' : '✈') : c.en ? '1' : ''}</td> })}
                </tr></Fragment>))}
              <tr style={{ borderTop: '2px solid #d0d5dd' }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '4px 6px', fontWeight: 700 }}>Total en faena</td>
                {totales.map((n, i) => <td key={i} style={{ textAlign: 'center', fontWeight: 700, color: '#16213E' }}>{n}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Marco>
  )
}

'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card, btn, input, label } from '@/components/programa/ui'
import Marco from '@/components/operaciones/Marco'
import PanelVuelos from '@/components/operaciones/PanelVuelos'
import FiltroContratos from '@/components/operaciones/FiltroContratos'
import { resumenVuelo, marcarDia, msgError, TIPOS_CONTRATO, diasEntre, etiquetaContrato, cmpPersonal, TIPOS_PERSONAL, traerTodo, hoyISO, sumarDias, fechaCorta, DIAS_SEM, descargarXlsx, type Asig, type Turno, type Vuelo } from '@/lib/operaciones'

export default function GrillaTurnos() {
  const hoy = hoyISO()
  const [trab, setTrab] = useState<any[]>([])
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [contrato, setContrato] = useState<string[]>([])
  const [vuelos, setVuelos] = useState<Vuelo[]>([])
  const mesIni = hoy.slice(0, 7) + '-01'
  const [desde, setDesde] = useState(mesIni)
  // Hasta el último día del mes 12 (el mes actual + 11 meses)
  const finVentana = (() => { const d = new Date(mesIni + 'T12:00:00'); d.setMonth(d.getMonth() + 12); d.setDate(0); return d.toISOString().slice(0, 10) })()
  const ndias = diasEntre(desde, finVentana) + 1
  const mesAnterior = () => { const d = new Date(desde + 'T12:00:00'); d.setMonth(d.getMonth() - 1); setDesde(d.toISOString().slice(0, 7) + '-01') }
  const [soloActivos, setSoloActivos] = useState(true)
  const [modo, setModo] = useState<'turno' | 'vuelo'>('turno')
  const [msg, setMsg] = useState('')
  const [pv, setPv] = useState<{ t: any, dia: string } | null>(null)
  const [ec, setEc] = useState<{ id: string, nombre: string, contrato: string, tipo_contrato: string, vence: string, hasta: string, regimen: string, sueldo: string, condiciones: string } | null>(null)
  const [msgEc, setMsgEc] = useState('')

  const cargar = async () => {
    const [t, a, tu, c, v] = await Promise.all([traerTodo('op_trabajadores', '*', 'nombre'), traerTodo('op_asignaciones'), traerTodo('op_turnos'), supabase.from('pr_contratos').select('id,nombre,empresa,referencia').order('nombre'), traerTodo('op_vuelos')])
    setVuelos(v as Vuelo[]); setTrab(t); setAsigs(a as Asig[]); setTurnos(tu as Turno[]); setContratos(c.data || []); setCargando(false)
  }
  useEffect(() => {
    try { const c = new URLSearchParams(window.location.search).get('contrato'); if (c) setContrato(c.split(',').filter(Boolean)) } catch {}
    cargar()
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
    const vista = as.find(x => x.desde <= hoy && (!x.hasta || x.hasta >= hoy)) || as[as.length - 1]
    return { t, celdas, contratoPrincipal: vista.contrato_id, vista }
  }).filter(Boolean) as { t: any, celdas: { a?: Asig, en: boolean }[], contratoPrincipal: string, vista: Asig }[], [trab, asigs, turnos, contrato, dias, desde, hasta, soloActivos])
  const totales = dias.map((_, i) => filas.filter(f => f.celdas[i].en).length)

  const descargar = () => descargarXlsx(`Turnos_${desde}_a_${hasta}.xlsx`, async (X) => {
    const libro = new X.Workbook(); libro.creator = 'Sistema INDELI'
    const h = libro.addWorksheet('Turnos')
    const cab = h.addRow(['Nombre', 'Tipo', 'Cargo', 'RUT', 'Contrato', 'Tipo contrato', 'Vence', ...dias.map(d => fechaCorta(d).slice(0, 5))]); cab.font = { bold: true }
    filas.forEach(f => h.addRow([f.t.nombre, TIPOS_PERSONAL[f.t.tipo_personal] || 'Directo', f.t.cargo || '', f.t.rut || '', nCont(f.contratoPrincipal), f.vista.tipo_contrato ? TIPOS_CONTRATO[f.vista.tipo_contrato] : '', f.vista.vence ? fechaCorta(f.vista.vence) : '', ...f.celdas.map(c => c.en ? 1 : '')]))
    h.addRow(['TOTAL EN FAENA', '', '', '', '', '', '', ...totales]).font = { bold: true }
    h.columns = [{ width: 28 }, { width: 11 }, { width: 22 }, { width: 14 }, { width: 30 }, { width: 14 }, { width: 12 }, ...dias.map(() => ({ width: 5.5 }))]
    h.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
    return libro
  })

  const clicCelda = async (f: { t: any, celdas: { a?: Asig, en: boolean }[] }, i: number) => {
    setMsg(''); const d = dias[i]
    if (modo === 'vuelo') { setPv({ t: f.t, dia: d }); return }
    if (!f.celdas[i].a) { setMsg(`${f.t.nombre} no tiene contrato el ${fechaCorta(d)}: asígnalo primero en su ficha.`); return }
    // actualización inmediata en pantalla y luego guardado
    const e = await marcarDia(turnos.filter(x => x.trabajador_id === f.t.id), f.t.id, d, !f.celdas[i].en)
    if (e) setMsg(e)
    cargar()
  }
  const abrirContrato = (f: { t: any, vista: Asig }) => { const a = f.vista; setMsgEc(''); setEc({ id: a.id, nombre: f.t.nombre, contrato: nCont(a.contrato_id), tipo_contrato: a.tipo_contrato || '', vence: a.vence || '', hasta: a.hasta || '', regimen: a.regimen || '', sueldo: a.sueldo ? String(a.sueldo) : '', condiciones: a.condiciones || '' }) }
  const guardarContrato = async () => {
    if (!ec) return
    const { error } = await supabase.from('op_asignaciones').update({ tipo_contrato: ec.tipo_contrato || null, vence: ec.vence || null, hasta: ec.hasta || null, regimen: ec.regimen || null, sueldo: ec.sueldo ? Number(ec.sueldo) : null, condiciones: ec.condiciones || null }).eq('id', ec.id)
    if (error) { setMsgEc(msgError(error)); return }
    setEc(null); cargar()
  }
  // Vencimiento del plazo: color según días que faltan
  const venc = (a: Asig) => {
    if (a.tipo_contrato === 'indefinido') return { t: 'Indefinido', bg: '#e8f0fe', col: '#1B4F9C' }
    if (!a.vence) return { t: a.tipo_contrato ? TIPOS_CONTRATO[a.tipo_contrato] : 'Sin dato', bg: '#f2f4f7', col: '#667085' }
    const n = diasEntre(hoy, a.vence); const pref = a.tipo_contrato === 'pf1' ? 'PF1' : a.tipo_contrato === 'pf2' ? 'PF2' : 'Vence'
    if (n < 0) return { t: `${pref} vencido ${fechaCorta(a.vence).slice(0, 5)}`, bg: '#fde2e1', col: '#b42318' }
    if (n <= 15) return { t: `${pref} ${fechaCorta(a.vence).slice(0, 5)} (${n}d)`, bg: '#fde2e1', col: '#b42318' }
    if (n <= 30) return { t: `${pref} ${fechaCorta(a.vence).slice(0, 5)} (${n}d)`, bg: '#fff3cd', col: '#8a5a00' }
    return { t: `${pref} ${fechaCorta(a.vence).slice(0, 5)} (${n}d)`, bg: '#e6f4ea', col: '#1e8e4e' }
  }
  const W = 26
  const CH = { textAlign: 'left' as const, padding: '4px 6px', color: '#667085', fontWeight: 500 }
  const ST = (left: number) => ({ position: 'sticky' as const, left, background: '#fff', zIndex: 1 })
  const CC = { padding: '3px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }
  return (
    <Marco titulo="Turnos" ancho={1400}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <FiltroContratos contratos={contratos} sel={contrato} onChange={setContrato} />
        <button onClick={mesAnterior} style={{ ...btn(false), padding: '8px 12px' }}>← Mes anterior</button>
        {desde !== mesIni && <button onClick={() => setDesde(mesIni)} style={{ ...btn(false), padding: '8px 12px' }}>Volver al mes actual</button>}
        <span style={{ fontSize: '12px', color: '#667085' }}>Desde {fechaCorta(desde)} hasta {fechaCorta(finVentana)} · desplázate a la derecha</span>
        <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center' }}><input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} />Solo activos</label>
        <div style={{ display: 'flex', border: '1px solid #d0d5dd', borderRadius: '8px', overflow: 'hidden' }}>
          {([['turno', 'Marcar turno'], ['vuelo', 'Vuelos']] as const).map(([k, t]) => <button key={k} onClick={() => setModo(k)} style={{ padding: '8px 12px', fontSize: '12.5px', border: 'none', cursor: 'pointer', background: modo === k ? AZUL : '#fff', color: modo === k ? '#fff' : '#475467', fontWeight: 600 }}>{t}</button>)}
        </div>
        <button onClick={descargar} style={{ ...btn(), marginLeft: 'auto' }}>⬇ Descargar Excel</button>
      </div>
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 8px' }}>{msg}</p>}
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
        <div style={{ ...card, padding: '10px 0', overflowX: 'auto' }}>
          <p style={{ margin: '0 10px 8px', position: 'sticky', left: 10, fontSize: '12px', color: '#667085' }}>{filas.length} trabajadores · del {fechaCorta(desde)} al {fechaCorta(hasta)} · {modo === 'turno' ? 'Haz clic en una celda para marcar/desmarcar en faena. ' : 'Haz clic en una celda para ver o agregar el vuelo/bus de ese día. '}<span style={{ background: '#1e8e4e', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>1</span> en faena · <span style={{ background: '#f59e0b', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>✈</span> vuelo/bus comprado · <span style={{ background: '#dc2626', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>⏳</span> por comprar · <span style={{ background: '#eef1f6', padding: '0 6px', borderRadius: '4px' }}>gris</span> sin contrato ese día</p>
          <table style={{ borderCollapse: 'collapse', fontSize: '11.5px', tableLayout: 'fixed', width: 492 + dias.length * W }}>
            <thead>
              <tr><th style={{ position: 'sticky', left: 0, background: '#fff', width: '170px', minWidth: '170px', maxWidth: '170px', textAlign: 'left', padding: '4px 6px 4px 12px', zIndex: 1 }}>Trabajador</th><th style={{ ...CH, ...ST(170), width: '110px', minWidth: '110px' }}>Cargo</th><th style={{ ...CH, ...ST(280), width: '84px', minWidth: '84px' }}>Origen</th><th style={{ ...CH, ...ST(364), width: '128px', minWidth: '128px', borderRight: '1px solid #d0d5dd' }}>Contrato / plazo</th>
                {dias.map(d => { const dt = new Date(d + 'T12:00:00'); const esHoy = d === hoy; return <th key={d} style={{ minWidth: W, width: W, padding: '2px 0', textAlign: 'center', background: esHoy ? '#fff3cd' : dt.getDay() === 0 || dt.getDay() === 6 ? '#f8fafc' : '#fff', fontWeight: esHoy ? 700 : 500, color: '#667085', lineHeight: 1.15 }}>{dt.getDate() === 1 || d === desde ? <div style={{ fontSize: '9px', color: AZUL }}>{dt.toLocaleDateString('es-CL', { month: 'short' })}</div> : <div style={{ fontSize: '9px' }}>&nbsp;</div>}<div>{dt.getDate()}</div><div style={{ fontSize: '9px' }}>{DIAS_SEM[dt.getDay()]}</div></th> })}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, ix) => (
                <Fragment key={f.t.id}>
                {(ix === 0 || filas[ix - 1].t.tipo_personal !== f.t.tipo_personal) && <tr><td colSpan={dias.length + 4} style={{ background: f.t.tipo_personal === 'indirecto' ? '#fff3cd' : '#f2f4f7', fontWeight: 700, fontSize: '11px', padding: 0, color: '#475467' }}><div style={{ position: 'sticky', left: 12, width: 'fit-content', padding: '3px 0' }}>{f.t.tipo_personal === 'indirecto' ? 'INDIRECTOS' : 'DIRECTOS'} ({filas.filter(x => x.t.tipo_personal === f.t.tipo_personal).length})</div></td></tr>}
                <tr style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '3px 6px 3px 12px', width: '170px', minWidth: '170px', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1 }} title={f.t.nombre}><Link href={`/operaciones/trabajadores/${f.t.id}`} style={{ color: AZUL, textDecoration: 'none', fontWeight: 600 }}>{f.t.nombre}</Link></td>
                  <td style={{ ...CC, ...ST(170), width: '110px', minWidth: '110px', maxWidth: '110px', color: '#667085' }} title={f.t.cargo || ''}>{f.t.cargo || '—'}</td>
                  <td style={{ ...CC, ...ST(280), width: '84px', minWidth: '84px', maxWidth: '84px' }}>{f.t.aeropuerto_origen ? <span style={{ fontSize: '10.5px', padding: '1px 8px', borderRadius: '10px', background: '#e8f0fe', color: '#1B4F9C', fontWeight: 600 }} title="Aeropuerto de origen">{f.t.aeropuerto_origen}</span> : <span style={{ color: '#b7791f', fontSize: '10.5px' }}>sin definir</span>}</td>
                  <td style={{ ...CC, ...ST(364), width: '128px', minWidth: '128px', maxWidth: '128px', borderRight: '1px solid #d0d5dd' }}>{(() => { const v = venc(f.vista); return <button onClick={() => abrirContrato(f)} title={`${nCont(f.vista.contrato_id)} · clic para editar`} style={{ border: 'none', cursor: 'pointer', fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: v.bg, color: v.col, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.t}</button> })()}</td>
                  {f.celdas.map((c, i) => { const vs = vueloDe.get(f.t.id + '|' + dias[i]); const tip = vs?.map(resumenVuelo).join(' / ')
                    return <td key={i} onClick={() => clicCelda(f, i)} title={tip} style={{ cursor: 'pointer', width: W, minWidth: W, height: '22px', textAlign: 'center', fontWeight: 700, background: vs ? (vs.some(v => v.estado === 'por_comprar') ? '#dc2626' : '#f59e0b') : c.en ? '#1e8e4e' : !c.a ? '#eef1f6' : dias[i] === hoy ? '#fff8e5' : undefined, color: '#fff', borderLeft: dias[i].endsWith('-01') ? '2px solid #98a2b3' : '1px solid #f2f4f7', fontSize: vs ? '11px' : undefined }}>{vs ? (vs.some(v => v.estado === 'por_comprar') ? '⏳' : vs[0].medio === 'bus' ? '🚌' : '✈') : c.en ? '1' : ''}</td> })}
                </tr></Fragment>))}
              <tr style={{ borderTop: '2px solid #d0d5dd' }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '4px 6px 4px 12px', fontWeight: 700, zIndex: 1 }}>Total en faena</td><td colSpan={3} style={{ ...ST(170), borderRight: '1px solid #d0d5dd' }} />
                {totales.map((n, i) => <td key={i} style={{ textAlign: 'center', fontWeight: 700, color: '#16213E' }}>{n}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {ec && (
        <div onClick={() => setEc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px' }}>{ec.nombre}</p>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>{ec.contrato}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Tipo de contrato</label><select value={ec.tipo_contrato} onChange={e => setEc({ ...ec, tipo_contrato: e.target.value })} style={input}><option value="">—</option>{Object.entries(TIPOS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Vence</label><input type="date" value={ec.vence} onChange={e => setEc({ ...ec, vence: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Término en este contrato</label><input type="date" value={ec.hasta} onChange={e => setEc({ ...ec, hasta: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 100px' }}><label style={label}>Régimen</label><input value={ec.regimen} onChange={e => setEc({ ...ec, regimen: e.target.value })} placeholder="14x14" style={input} /></div>
              <div style={{ flex: '1 1 140px' }}><label style={label}>Sueldo</label><input type="number" value={ec.sueldo} onChange={e => setEc({ ...ec, sueldo: e.target.value })} style={input} /></div>
            </div>
            <div style={{ marginTop: '8px' }}><label style={label}>Condiciones / trato</label><input value={ec.condiciones} onChange={e => setEc({ ...ec, condiciones: e.target.value })} style={input} /></div>
            {msgEc && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msgEc}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}><button onClick={guardarContrato} style={btn()}>Guardar</button><button onClick={() => setEc(null)} style={btn(false)}>Cancelar</button></div>
          </div>
        </div>)}
      {pv && (
        <div onClick={() => setPv(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>{pv.t.nombre}</p>
            <PanelVuelos trabajador={pv.t} trabId={pv.t.id} dia={pv.dia} vuelos={vueloDe.get(pv.t.id + '|' + pv.dia) || []} onCambio={cargar} />
            <button onClick={() => setPv(null)} style={{ ...btn(false), marginTop: '12px' }}>Cerrar</button>
          </div>
        </div>)}
    </Marco>
  )
}

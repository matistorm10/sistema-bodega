'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card, btn, input, label } from '@/components/programa/ui'
import { formatearRut } from '@/lib/rut'
import Marco from '@/components/operaciones/Marco'
import PuntoExamen from '@/components/operaciones/PuntoExamen'
import PanelVuelos from '@/components/operaciones/PanelVuelos'
import FiltroContratos from '@/components/operaciones/FiltroContratos'
import { BACKOFFICE_ID, type Cupo, ESTATUS_CONTRATO, resumenVuelo, planRango, aplicarPlanLocal, guardarPlan, type PlanTurnos, msgError, TIPOS_CONTRATO, diasEntre, etiquetaContrato, cmpPersonal, TIPOS_PERSONAL, traerTodo, hoyISO, sumarDias, fechaCorta, DIAS_SEM, descargarXlsx, type Asig, type Turno, type Vuelo } from '@/lib/operaciones'

export default function GrillaTurnos() {
  const hoy = hoyISO()
  const [trab, setTrab] = useState<any[]>([])
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [contrato, setContrato] = useState<string[]>([])
  const [vuelos, setVuelos] = useState<Vuelo[]>([])
  const [cupos, setCupos] = useState<Cupo[]>([])
  const [cu, setCu] = useState<Cupo | null>(null); const [fcu, setFcu] = useState({ nombre: '', rut: '', tipo: 'directo', existente: '' }); const [msgCu, setMsgCu] = useState('')
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
  const [ec, setEc] = useState<{ id: string, contrato_id: string, desde: string, nombre: string, contrato: string, tipo_contrato: string, vence: string, hasta: string, regimen: string, sueldo: string, condiciones: string, estatus: string, estatus_fecha: string, o_tipo: string, o_vence: string } | null>(null)
  const [msgEc, setMsgEc] = useState('')

  const cargar = async () => {
    const [t, a, tu, c, v, cp] = await Promise.all([traerTodo('op_trabajadores', '*', 'nombre'), traerTodo('op_asignaciones'), traerTodo('op_turnos'), supabase.from('pr_contratos').select('id,nombre,cliente:pr_clientes_informe(nombre),referencia').order('nombre'), traerTodo('op_vuelos'), traerTodo('op_cupos')])
    setCupos(cp as Cupo[])
    setVuelos(v as Vuelo[]); setTrab(t); setAsigs(a as Asig[]); setTurnos(tu as Turno[]); setContratos([...(c.data || []), { id: BACKOFFICE_ID, nombre: 'Back Office', referencia: null, cliente: null }]); setCargando(false)
  }
  // Recuerda filtros, mes y modo para que al volver desde una ficha la grilla quede como estaba
  const [listo, setListo] = useState(false)
  useEffect(() => {
    if (!listo) return
    try { sessionStorage.setItem('op_turnos_estado', JSON.stringify({ contrato, desde, soloActivos, modo })) } catch {}
  }, [listo, contrato, desde, soloActivos, modo])
  useEffect(() => {
    try {
      const g = sessionStorage.getItem('op_turnos_estado')
      if (g) { const e = JSON.parse(g); if (Array.isArray(e.contrato)) setContrato(e.contrato); if (typeof e.desde === 'string') setDesde(e.desde); if (typeof e.soloActivos === 'boolean') setSoloActivos(e.soloActivos); if (e.modo === 'turno' || e.modo === 'vuelo') setModo(e.modo) }
    } catch {}
    try { const c = new URLSearchParams(window.location.search).get('contrato'); if (c) setContrato(c.split(',').filter(Boolean)) } catch {}
    setListo(true)
    cargar()
  }, [])
  const nCont = (id?: string) => etiquetaContrato(contratos.find(x => x.id === id))
  const vueloDe = useMemo(() => { const m = new Map<string, Vuelo[]>(); vuelos.forEach(v => { const k = v.trabajador_id + '|' + v.fecha; m.set(k, [...(m.get(k) || []), v]) }); return m }, [vuelos])
  const dias = useMemo(() => Array.from({ length: ndias }, (_, i) => sumarDias(desde, i)), [desde, ndias])
  const hasta = dias[dias.length - 1]

  const filas = useMemo(() => [...trab].sort(cmpPersonal).filter(t => !soloActivos || t.activo).map(t => {
    // Back Office: sin contrato real; se muestra bajo el «contrato» virtual Back Office
    const as: Asig[] = t.tipo_personal === 'backoffice'
      ? ((contrato.length === 0 || contrato.includes(BACKOFFICE_ID)) ? [{ id: 'bo-' + t.id, trabajador_id: t.id, contrato_id: BACKOFFICE_ID, desde: '2000-01-01', hasta: null, tipo_contrato: 'indefinido', vence: null, regimen: null, sueldo: null, condiciones: null } as Asig] : [])
      : asigs.filter(a => a.trabajador_id === t.id && a.desde <= hasta && (!a.hasta || a.hasta >= desde) && (contrato.length === 0 || contrato.includes(a.contrato_id)))
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
  // Cupos (cargos vendidos) sin cubrir o cuyo trabajador aún no tiene contrato en ese contrato
  const porContratar = useMemo(() => cupos.filter(c => (contrato.length === 0 || contrato.includes(c.contrato_id)) && (() => {
    if (!c.trabajador_id) return true
    const t = trab.find(x => x.id === c.trabajador_id); if (!t || (soloActivos && !t.activo)) return false
    return !asigs.some(a => a.trabajador_id === c.trabajador_id && a.contrato_id === c.contrato_id && (!a.hasta || a.hasta >= hoy))
  })()).sort((a, b) => a.cargo.localeCompare(b.cargo, 'es') || (a.trabajador_id ? 1 : 0) - (b.trabajador_id ? 1 : 0)), [cupos, trab, asigs, contrato, soloActivos, hoy])
  const abrirCupo = (c: Cupo) => { setCu(c); setFcu({ nombre: '', rut: '', tipo: 'directo', existente: '' }); setMsgCu('') }
  const cubrirNuevo = async () => {
    if (!cu) return
    if (!fcu.nombre.trim()) { setMsgCu('Escribe el nombre del trabajador.'); return }
    const { data, error } = await supabase.from('op_trabajadores').insert({ nombre: fcu.nombre.trim(), rut: fcu.rut.trim() || null, cargo: cu.cargo, tipo_personal: fcu.tipo, examenes: 'pendiente', examenes_fecha: hoy }).select('id').single()
    if (error || !data) { setMsgCu(msgError(error)); return }
    const r = await supabase.from('op_cupos').update({ trabajador_id: data.id }).eq('id', cu.id)
    if (r.error) { setMsgCu(msgError(r.error)); return }
    setCu(null); cargar()
  }
  const cubrirExistente = async () => {
    if (!cu || !fcu.existente) { setMsgCu('Elige un trabajador.'); return }
    const r = await supabase.from('op_cupos').update({ trabajador_id: fcu.existente }).eq('id', cu.id)
    if (r.error) { setMsgCu(msgError(r.error)); return }
    setCu(null); cargar()
  }
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

  const cola = useRef<Promise<void>>(Promise.resolve())
  const turnosRef = useRef<Turno[]>([]); turnosRef.current = turnos
  const clicCelda = (f: { t: any }, i: number) => { setMsg(''); if (modo === 'vuelo') setPv({ t: f.t, dia: dias[i] }) }
  // Aplica un cambio de turno: la pantalla se actualiza al instante y el guardado va en segundo plano, en orden
  const cambiarTurnos = (cambios: { trabId: string, a: string, b: string, on: boolean }[]) => {
    let lista = turnosRef.current; const planes: PlanTurnos[] = []
    for (const c of cambios) {
      const plan = planRango(lista.filter(x => x.trabajador_id === c.trabId), c.trabId, c.a, c.b, c.on)
      lista = aplicarPlanLocal(lista, plan); planes.push(plan)
    }
    turnosRef.current = lista; setTurnos(lista)
    cola.current = cola.current.then(async () => {
      for (const p of planes) { const e = await guardarPlan(p); if (e) { setMsg(e); const tu = await traerTodo('op_turnos'); setTurnos(tu as Turno[]); return } }
    })
  }
  // Selección arrastrando el mouse: un solo clic cambia una celda; arrastrar cambia varias (de una o varias filas)
  const sel = useRef<{ r0: number, c0: number, r1: number, c1: number, on: boolean } | null>(null)
  const marcadas = useRef<HTMLElement[]>([])
  const limpiarSel = () => { marcadas.current.forEach(el => { el.style.boxShadow = ''; el.style.filter = '' }); marcadas.current = [] }
  const pintarSel = () => {
    limpiarSel(); const s = sel.current; if (!s) return
    const [ra, rb] = [Math.min(s.r0, s.r1), Math.max(s.r0, s.r1)], [ca, cb] = [Math.min(s.c0, s.c1), Math.max(s.c0, s.c1)]
    for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) { const el = document.querySelector<HTMLElement>(`td[data-r="${r}"][data-c="${c}"]`); if (el) { el.style.boxShadow = 'inset 0 0 0 2px #1B4F9C'; el.style.filter = 'brightness(.85)'; marcadas.current.push(el) } }
  }
  const empezarSel = (e: React.MouseEvent, ix: number, i: number) => {
    if (modo !== 'turno' || e.button !== 0) return
    e.preventDefault(); setMsg('')
    sel.current = { r0: ix, c0: i, r1: ix, c1: i, on: !filas[ix].celdas[i].en }; pintarSel()
  }
  const moverSel = (e: React.MouseEvent) => {
    if (!sel.current) return
    const el = (e.target as HTMLElement).closest('td[data-r]'); if (!el) return
    const r = Number(el.getAttribute('data-r')), c = Number(el.getAttribute('data-c'))
    if (r !== sel.current.r1 || c !== sel.current.c1) { sel.current = { ...sel.current, r1: r, c1: c }; pintarSel() }
  }
  const terminarSel = () => {
    const s = sel.current; sel.current = null; limpiarSel(); if (!s) return
    const [ra, rb] = [Math.min(s.r0, s.r1), Math.max(s.r0, s.r1)], [ca, cb] = [Math.min(s.c0, s.c1), Math.max(s.c0, s.c1)]
    const cambios: { trabId: string, a: string, b: string, on: boolean }[] = []; let sinContrato = 0
    for (let r = ra; r <= rb; r++) {
      const f = filas[r]; if (!f) continue
      let ini = -1
      for (let c = ca; c <= cb + 1; c++) {
        const ok = c <= cb && !!f.celdas[c]?.a
        if (c <= cb && !ok) sinContrato++
        if (ok && ini < 0) ini = c
        if (!ok && ini >= 0) { cambios.push({ trabId: f.t.id, a: dias[ini], b: dias[c - 1], on: s.on }); ini = -1 }
      }
    }
    if (cambios.length === 0) { setMsg(sinContrato ? 'Esas celdas no tienen contrato: asígnalo primero en la ficha del trabajador.' : ''); return }
    if (sinContrato) setMsg(`${sinContrato} celda(s) sin contrato no se modificaron.`)
    cambiarTurnos(cambios)
  }
  useEffect(() => { window.addEventListener('mouseup', terminarSel); return () => window.removeEventListener('mouseup', terminarSel) }) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 7000); return () => clearTimeout(t) }, [msg])
  const abrirContrato = (f: { t: any, vista: Asig }) => { const a = f.vista; setMsgEc(''); setEc({ id: a.id, contrato_id: a.contrato_id, desde: a.desde, nombre: f.t.nombre, contrato: nCont(a.contrato_id), tipo_contrato: a.tipo_contrato || '', vence: a.vence || '', hasta: a.hasta || '', regimen: a.regimen || '', sueldo: a.sueldo ? String(a.sueldo) : '', condiciones: a.condiciones || '', estatus: a.estatus_contrato || '', estatus_fecha: a.estatus_fecha || '', o_tipo: a.tipo_contrato || '', o_vence: a.vence || '' }) }
  const guardarContrato = async () => {
    if (!ec) return
    if (ec.tipo_contrato && ec.tipo_contrato !== 'indefinido' && ec.o_vence && ec.tipo_contrato !== ec.o_tipo && (!ec.vence || ec.vence === ec.o_vence)) { setMsgEc('Al cambiar de plazo indica la nueva fecha de vencimiento (distinta a la anterior).'); return }
    if (ec.tipo_contrato && ec.tipo_contrato !== 'indefinido' && !ec.vence) { setMsgEc('Indica la fecha en que vence este plazo fijo.'); return }
    if (!ec.desde) { setMsgEc('Indica la fecha de inicio del contrato.'); return }
    if (ec.hasta && ec.hasta < ec.desde) { setMsgEc('La fecha de salida no puede ser anterior al inicio.'); return }
    const { error } = await supabase.from('op_asignaciones').update({ contrato_id: ec.contrato_id, desde: ec.desde, tipo_contrato: ec.tipo_contrato || null, vence: ec.tipo_contrato === 'indefinido' ? null : (ec.vence || null), hasta: ec.hasta || null, regimen: ec.regimen || null, sueldo: ec.sueldo ? Number(ec.sueldo) : null, condiciones: ec.condiciones || null, estatus_contrato: ec.estatus || null, estatus_fecha: ec.estatus ? (ec.estatus_fecha || hoy) : null }).eq('id', ec.id)
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
  const estiloRef = useRef<HTMLStyleElement>(null); const hoverRef = useRef<string | null>(null)
  const idxHoy = dias.indexOf(hoy)
  const LINEA_HOY = 'inset 2px 0 0 #1B4F9C, inset -2px 0 0 #1B4F9C'
  const pintar = (h: string | null) => {
    if (!estiloRef.current) return
    let css = idxHoy >= 0 ? `[data-c="${idxHoy}"]{box-shadow:${LINEA_HOY}}` : ''
    if (h !== null) css += `[data-c="${h}"]{box-shadow:inset 0 0 0 200px rgba(71,84,103,.18)${Number(h) === idxHoy ? ',' + LINEA_HOY : ''}}`
    estiloRef.current.textContent = css
  }
  useEffect(() => { pintar(hoverRef.current) }) // eslint-disable-line react-hooks/exhaustive-deps
  const alPasar = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest('[data-c]'); const c = el ? el.getAttribute('data-c') : null; if (c !== hoverRef.current) { hoverRef.current = c; pintar(c) } }
  const alSalir = () => { hoverRef.current = null; pintar(null) }
  const W = 28
  const CH = { textAlign: 'left' as const, padding: '4px 4px', color: '#667085', fontWeight: 500 }
  const ST = (left: number) => ({ position: 'sticky' as const, left, background: '#fff', zIndex: 1 })
  const CC = { padding: '3px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }
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
      {msg && <div onClick={() => setMsg('')} style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 70, maxWidth: '90vw', background: '#fff', border: '1px solid #f3b4b4', borderLeft: '4px solid #c5221f', color: '#9b1c1c', fontSize: '13px', padding: '10px 14px', borderRadius: '10px', boxShadow: '0 6px 24px rgba(16,24,40,.2)', cursor: 'pointer' }}>{msg}</div>}
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
        <div style={{ ...card, padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 170px)' }}>
          <style ref={estiloRef} />
          <p style={{ margin: '10px 10px 8px', position: 'sticky', left: 10, fontSize: '12px', color: '#667085' }}>{filas.length} trabajadores · del {fechaCorta(desde)} al {fechaCorta(hasta)} · {modo === 'turno' ? 'Haz clic en una celda, o arrastra sobre varias (también de varias filas), para marcar/desmarcar en faena. ' : 'Haz clic en una celda para ver o agregar el vuelo/bus de ese día. '}<span style={{ background: '#1e8e4e', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>1</span> en faena · <span style={{ background: '#f59e0b', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>✈</span> vuelo/bus comprado · <span style={{ background: '#dc2626', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>⏳</span> por comprar · <span style={{ background: '#fde2e1', borderRight: '4px solid #7a1212', padding: '0 6px', borderRadius: '2px' }}>&nbsp;</span> fin de contrato (plazo fijo) · <span style={{ background: '#eef1f6', padding: '0 6px', borderRadius: '4px' }}>gris</span> sin contrato ese día</p>
          <table onMouseOver={e => { alPasar(e); moverSel(e) }} onMouseLeave={alSalir} style={{ borderCollapse: 'collapse', fontSize: '11.5px', tableLayout: 'fixed', width: 464 + dias.length * W }}>
            <thead>
              <tr><th style={{ position: 'sticky', left: 0, background: '#fff', width: '150px', minWidth: '150px', maxWidth: '150px', textAlign: 'left', padding: '4px 6px 4px 12px', zIndex: 4, top: 0 }}>Trabajador</th><th style={{ ...CH, ...ST(150), width: '100px', minWidth: '100px', top: 0, zIndex: 4 }}>Cargo</th><th style={{ ...CH, ...ST(250), width: '96px', minWidth: '96px', top: 0, zIndex: 4 }}>Origen</th><th style={{ ...CH, ...ST(346), width: '118px', minWidth: '118px', borderRight: '1px solid #d0d5dd', top: 0, zIndex: 4 }}>Contrato / plazo</th>
                {dias.map((d, ci) => { const dt = new Date(d + 'T12:00:00'); const esHoy = d === hoy; return <th key={d} data-c={ci} style={{ position: 'sticky', top: 0, zIndex: 3, minWidth: W, width: W, padding: '2px 0', textAlign: 'center', background: esHoy ? '#fff3cd' : dt.getDay() === 0 || dt.getDay() === 6 ? '#f8fafc' : '#fff', fontWeight: esHoy ? 700 : 500, color: '#667085', lineHeight: 1.15 }}>{dt.getDate() === 1 || d === desde ? <div style={{ fontSize: '9px', color: AZUL }}>{dt.toLocaleDateString('es-CL', { month: 'short' })}</div> : <div style={{ fontSize: '9px' }}>&nbsp;</div>}<div>{dt.getDate()}</div><div style={{ fontSize: '9px' }}>{DIAS_SEM[dt.getDay()]}</div></th> })}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, ix) => (
                <Fragment key={f.t.id}>
                {(ix === 0 || filas[ix - 1].t.tipo_personal !== f.t.tipo_personal) && <tr><td colSpan={dias.length + 4} style={{ background: f.t.tipo_personal === 'indirecto' ? '#fff3cd' : '#f2f4f7', fontWeight: 700, fontSize: '11px', padding: 0, color: '#475467' }}><div style={{ position: 'sticky', left: 12, width: 'fit-content', padding: '3px 0' }}>{f.t.tipo_personal === 'indirecto' ? 'INDIRECTOS' : f.t.tipo_personal === 'backoffice' ? 'BACK OFFICE' : 'DIRECTOS'} ({filas.filter(x => x.t.tipo_personal === f.t.tipo_personal).length})</div></td></tr>}
                <tr style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '3px 6px 3px 12px', width: '150px', minWidth: '150px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1 }} title={f.t.nombre}><PuntoExamen estado={f.t.examenes} /><Link href={`/operaciones/trabajadores/${f.t.id}?desde=turnos`} style={{ color: AZUL, textDecoration: 'none', fontWeight: 600 }}>{f.t.nombre}</Link></td>
                  <td style={{ ...CC, ...ST(150), width: '100px', minWidth: '100px', maxWidth: '100px', color: '#667085' }} title={f.t.cargo || ''}>{f.t.cargo || '—'}</td>
                  <td style={{ ...CC, ...ST(250), width: '96px', minWidth: '96px', maxWidth: '96px' }}>{!f.t.ciudad ? <span style={{ color: '#b7791f', fontSize: '10.5px' }}>sin definir</span> : f.t.modalidad_viaje === 'vuelo' ? <span style={{ fontSize: '10.5px', padding: '1px 7px', borderRadius: '10px', background: '#e8f0fe', color: '#1B4F9C', fontWeight: 700, whiteSpace: 'nowrap' }} title={f.t.ciudad}>{f.t.ciudad}</span> : <span style={{ fontSize: '11px', color: '#667085' }} title={f.t.ciudad}>{f.t.ciudad}</span>}</td>
                  <td style={{ ...CC, ...ST(346), width: '118px', minWidth: '118px', maxWidth: '118px', borderRight: '1px solid #d0d5dd' }}>{(() => { const v = f.t.tipo_personal === 'backoffice' ? { bg: '#e8f0fe', col: '#1B4F9C', t: 'Back Office' } : venc(f.vista); return <><button onClick={() => f.t.tipo_personal !== 'backoffice' && abrirContrato(f)} title={f.t.tipo_personal === 'backoffice' ? 'Personal de casa matriz: sin contrato en este sistema' : `${nCont(f.vista.contrato_id)} · clic para editar`} style={{ border: 'none', cursor: f.t.tipo_personal === 'backoffice' ? 'default' : 'pointer', fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: v.bg, color: v.col, maxWidth: f.vista.estatus_contrato ? 'calc(100% - 20px)' : '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{v.t}</button>{f.vista.estatus_contrato && <span title={`${ESTATUS_CONTRATO[f.vista.estatus_contrato]}${f.vista.estatus_fecha ? ' · ' + fechaCorta(f.vista.estatus_fecha) : ''}`} style={{ marginLeft: '4px', fontSize: '13px', verticalAlign: 'middle', cursor: 'help' }}>{f.vista.estatus_contrato === 'proceso_finiquito' ? '⛔' : '✉️'}</span>}</> })()}</td>
                  {f.celdas.map((c, i) => { const vs = vueloDe.get(f.t.id + '|' + dias[i]); const fin = !!c.a && !!c.a.vence && c.a.vence === dias[i] && c.a.tipo_contrato !== 'indefinido'; const tip = [fin ? `Fin de contrato (${c.a?.tipo_contrato === 'pf1' ? 'PF1' : c.a?.tipo_contrato === 'pf2' ? 'PF2' : 'plazo'}) ${fechaCorta(c.a?.vence)}` : '', vs?.map(resumenVuelo).join(' / ')].filter(Boolean).join(' · ')
                    return <td key={i} data-c={i} data-r={ix} onMouseDown={e => empezarSel(e, ix, i)} onClick={() => clicCelda(f, i)} title={tip} style={{ cursor: 'pointer', userSelect: 'none', width: W, minWidth: W, height: '22px', textAlign: 'center', fontWeight: 700, background: vs ? (vs.some(v => v.estado === 'por_comprar') ? '#dc2626' : '#f59e0b') : c.en ? '#1e8e4e' : !c.a ? '#eef1f6' : fin ? '#fde2e1' : dias[i] === hoy ? '#fff8e5' : undefined, borderRight: fin ? '4px solid #7a1212' : undefined, color: '#fff', borderLeft: dias[i].endsWith('-01') ? '2px solid #98a2b3' : '1px solid #f2f4f7', fontSize: vs ? '11px' : undefined }}>{vs ? (vs.some(v => v.estado === 'por_comprar') ? '⏳' : vs[0].medio === 'bus' ? '🚌' : '✈') : c.en ? '1' : ''}</td> })}
                </tr></Fragment>))}
              {porContratar.length > 0 && <tr><td colSpan={dias.length + 4} style={{ background: '#fde2e1', fontWeight: 700, fontSize: '11px', padding: 0, color: '#7a1212' }}><div style={{ position: 'sticky', left: 12, width: 'fit-content', padding: '3px 0' }}>POR CONTRATAR ({porContratar.length}) · cargos vendidos sin trabajador o sin contrato</div></td></tr>}
              {porContratar.map(c => { const t = c.trabajador_id ? trab.find(x => x.id === c.trabajador_id) : null; return (
                <tr key={c.id} style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '3px 6px 3px 12px', width: '150px', minWidth: '150px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1 }}>
                    {t ? <><PuntoExamen estado={t.examenes} /><Link href={`/operaciones/trabajadores/${t.id}?desde=turnos`} style={{ color: AZUL, textDecoration: 'none', fontWeight: 600 }}>{t.nombre}</Link></>
                      : <button onClick={() => abrirCupo(c)} title="Cubrir este cupo con un trabajador" style={{ border: '1px dashed #b42318', background: '#fff5f5', color: '#b42318', borderRadius: '6px', fontSize: '11px', fontWeight: 700, padding: '1px 8px', cursor: 'pointer' }}>＋ Vacante</button>}
                  </td>
                  <td style={{ ...CC, ...ST(150), width: '100px', minWidth: '100px', maxWidth: '100px', color: '#16213E', fontWeight: 600 }} title={c.cargo}>{c.cargo}{c.es_reemplazo ? <span title="Cupo de reemplazo" style={{ marginLeft: '4px', fontSize: '10px', color: '#b7791f' }}>↺</span> : null}</td>
                  <td style={{ ...CC, ...ST(250), width: '96px', minWidth: '96px', maxWidth: '96px', color: '#667085', fontSize: '11px' }}>{t?.ciudad || ''}</td>
                  <td style={{ ...CC, ...ST(346), width: '118px', minWidth: '118px', maxWidth: '118px', borderRight: '1px solid #d0d5dd', fontSize: '10.5px', color: '#667085' }} title={nCont(c.contrato_id)}>{t ? 'sin contrato aún' : nCont(c.contrato_id)}</td>
                  {dias.map((_, i) => <td key={i} data-c={i} style={{ width: W, minWidth: W, height: '22px', background: '#fff8f8', borderLeft: dias[i].endsWith('-01') ? '2px solid #98a2b3' : '1px solid #f2f4f7' }} />)}
                </tr>) })}
              <tr>
                <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '4px 6px 4px 12px', fontWeight: 700, zIndex: 4, bottom: 0, borderTop: '2px solid #d0d5dd' }}>Total en faena</td><td colSpan={3} style={{ ...ST(150), bottom: 0, zIndex: 4, borderTop: '2px solid #d0d5dd', borderRight: '1px solid #d0d5dd' }} />
                {totales.map((n, i) => <td key={i} data-c={i} style={{ position: 'sticky', bottom: 0, zIndex: 2, background: '#fff', borderTop: '2px solid #d0d5dd', textAlign: 'center', fontWeight: 700, color: '#16213E' }}>{n}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {cu && (
        <div onClick={() => setCu(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px' }}>Cubrir cupo: {cu.cargo}</p>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>{nCont(cu.contrato_id)}</p>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700 }}>Trabajador nuevo (reclutamiento ya tiene el nombre)</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 200px' }}><label style={label}>Nombre *</label><input value={fcu.nombre} onChange={e => setFcu({ ...fcu, nombre: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 130px' }}><label style={label}>RUT</label><input value={fcu.rut} onChange={e => setFcu({ ...fcu, rut: formatearRut(e.target.value) })} placeholder="12.345.678-9" style={input} /></div>
              <div style={{ flex: '1 1 130px' }}><label style={label}>Tipo de personal</label><select value={fcu.tipo} onChange={e => setFcu({ ...fcu, tipo: e.target.value })} style={input}><option value="directo">Directo</option><option value="indirecto">Indirecto</option></select></div>
            </div>
            <button onClick={cubrirNuevo} style={{ ...btn(), marginTop: '8px' }}>Crear ficha y asignar al cupo</button>
            <p style={{ margin: '4px 0 12px', fontSize: '11.5px', color: '#667085' }}>Parte con exámenes «pendiente». Luego se completa su ficha, se aprueban los exámenes y se carga contrato, turnos y pasajes.</p>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700 }}>O elegir un trabajador que ya existe</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={fcu.existente} onChange={e => setFcu({ ...fcu, existente: e.target.value })} style={input}><option value="">— elegir —</option>{trab.filter(t => t.activo && t.tipo_personal !== 'backoffice' && !cupos.some(c => c.trabajador_id === t.id)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(t => <option key={t.id} value={t.id}>{t.nombre}{t.cargo ? ` · ${t.cargo}` : ''}</option>)}</select>
              <button onClick={cubrirExistente} style={btn(false)}>Asignar</button>
            </div>
            {msgCu && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msgCu}</p>}
            <button onClick={() => setCu(null)} style={{ ...btn(false), marginTop: '12px' }}>Cerrar</button>
          </div>
        </div>)}
      {ec && (
        <div onClick={() => setEc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px' }}>{ec.nombre}</p>
            <div style={{ margin: '0 0 8px' }}><label style={label}>Contrato</label><select value={ec.contrato_id} onChange={e => setEc({ ...ec, contrato_id: e.target.value })} style={input}>{contratos.filter(c => c.id !== BACKOFFICE_ID).map(c => <option key={c.id} value={c.id}>{nCont(c.id)}</option>)}</select></div>
            {(() => { const a = asigs.find(x => x.id === ec.id); if (!a || !a.vence || a.tipo_contrato === 'indefinido') return null
              const n = diasEntre(hoy, a.vence); const nom = a.tipo_contrato ? TIPOS_CONTRATO[a.tipo_contrato] : 'El contrato'
              const rojo = n <= 15, amb = n <= 30
              return <div style={{ background: rojo ? '#fde2e1' : amb ? '#fff3cd' : '#e6f4ea', color: rojo ? '#7a1212' : amb ? '#6b4500' : '#14532d', borderRadius: '8px', padding: '7px 10px', margin: '0 0 8px', fontSize: '12.5px', fontWeight: 600 }}>
                {rojo ? '⚠️' : 'ℹ️'} {nom} {n < 0 ? `venció el ${fechaCorta(a.vence)} (hace ${-n} día${n === -1 ? '' : 's'})` : n === 0 ? `vence HOY (${fechaCorta(a.vence)})` : `vence el ${fechaCorta(a.vence)} (en ${n} día${n === 1 ? '' : 's'})`}.
                <span style={{ fontWeight: 400 }}> Para renovar: cambia el tipo de contrato y pon la nueva fecha de vencimiento.</span></div> })()}
            {(() => { const a = asigs.find(x => x.id === ec.id); if (!a) return null; return (
              <div style={{ background: '#e8f0fe', border: '1px solid #c7d7f5', borderRadius: '8px', padding: '8px 10px', margin: '0 0 10px', fontSize: '12px', color: '#16213E', lineHeight: 1.5 }}>
                <strong>Contrato actual</strong><br />
                En este contrato desde el {fechaCorta(a.desde)}{a.hasta ? ` · termina el ${fechaCorta(a.hasta)}` : ' · sin fecha de término'}<br />
                {a.tipo_contrato ? `${TIPOS_CONTRATO[a.tipo_contrato]}${a.tipo_contrato !== 'indefinido' && a.vence ? ` · vence el ${fechaCorta(a.vence)}` : ''}` : 'Tipo de contrato sin definir'}{a.regimen ? ` · régimen ${a.regimen}` : ''}{a.sueldo ? ` · sueldo $${Number(a.sueldo).toLocaleString('es-CL')}` : ''}
                {a.estatus_contrato && <><br />{a.estatus_contrato === 'proceso_finiquito' ? '⛔' : '✉️'} {ESTATUS_CONTRATO[a.estatus_contrato]}{a.estatus_fecha ? ` (${fechaCorta(a.estatus_fecha)})` : ''}</>}
                {a.condiciones && <><br />Condiciones: {a.condiciones}</>}
              </div>) })()}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Tipo de contrato</label><select value={ec.tipo_contrato} onChange={e => setEc({ ...ec, tipo_contrato: e.target.value })} style={input}><option value="">—</option>{Object.entries(TIPOS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Inicio del contrato</label><input type="date" min="2000-01-01" max="2100-12-31" value={ec.desde} onChange={e => setEc({ ...ec, desde: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Vence (fin del plazo fijo)</label><input type="date" min="2000-01-01" max="2100-12-31" disabled={ec.tipo_contrato === 'indefinido'} value={ec.tipo_contrato === 'indefinido' ? '' : ec.vence} onChange={e => setEc({ ...ec, vence: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Sale de este contrato el</label><input type="date" min="2000-01-01" max="2100-12-31" value={ec.hasta} onChange={e => setEc({ ...ec, hasta: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 100px' }}><label style={label}>Régimen</label><input value={ec.regimen} onChange={e => setEc({ ...ec, regimen: e.target.value })} placeholder="14x14" style={input} /></div>
              <div style={{ flex: '1 1 140px' }}><label style={label}>Sueldo</label><input type="number" value={ec.sueldo} onChange={e => setEc({ ...ec, sueldo: e.target.value })} style={input} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              <div style={{ flex: '2 1 190px' }}><label style={label}>Estatus del contrato</label><select value={ec.estatus} onChange={e => setEc({ ...ec, estatus: e.target.value, estatus_fecha: e.target.value ? (ec.estatus_fecha || hoy) : '' })} style={input}><option value="">Normal (sin aviso)</option>{Object.entries(ESTATUS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              {ec.estatus && <div style={{ flex: '1 1 140px' }}><label style={label}>Fecha</label><input type="date" min="2000-01-01" max="2100-12-31" value={ec.estatus_fecha} onChange={e => setEc({ ...ec, estatus_fecha: e.target.value })} style={input} /></div>}
            </div>
            <div style={{ marginTop: '8px' }}><label style={label}>Condiciones / trato</label><input value={ec.condiciones} onChange={e => setEc({ ...ec, condiciones: e.target.value })} style={input} /></div>
            <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#667085', lineHeight: 1.45 }}><strong>Vence</strong>: cuándo se cumple el plazo fijo (se marca con la línea roja en la grilla). <strong>Sale de este contrato el</strong>: último día del trabajador en este contrato; déjalo vacío si sigue. Se llena sola al mover a otro contrato o al retirarlo.</p>
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

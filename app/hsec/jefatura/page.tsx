'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { TIPOS_CHARLA, fechaCL } from '@/lib/prevencion'
import { periodos, estadoSemanal } from '@/lib/semanal'
import { pct, mesActual, nombreMes, CARGOS_PROGRAMA } from '@/lib/programa'
import { INICIO_OPERACION } from '@/lib/inicio'
import { estadoCelda, aplica, mesHoy } from '@/lib/capacitaciones'
import { resumen, calificacion, vigencia, estadoEpp, AudItem, AudResp, AudDoc, AudTrab } from '@/lib/auditoriaMandante'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
const input: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', background: '#fff' }
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

function Barras({ titulo, filas, vacio }: { titulo: string, filas: { nombre: string, valor: number }[], vacio?: string }) {
  const max = Math.max(1, ...filas.map(f => f.valor))
  return (
    <div style={card}>
      <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>{titulo}</p>
      {filas.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>{vacio || 'Sin datos en el período.'}</p> : filas.map(f => (
        <div key={f.nombre} style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
            <span style={{ color: '#344054' }}>{f.nombre}</span><strong>{f.valor}</strong>
          </div>
          <div style={{ height: '8px', background: '#eef1f6', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${(f.valor / max) * 100}%`, height: '100%', background: AZUL, borderRadius: '6px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Jefatura() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puede = esAdmin || !!usuario?.esJefeHsec

  const [charlas, setCharlas] = useState<any[]>([])
  const [asistentes, setAsistentes] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [informes, setInformes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [asigs, setAsigs] = useState<any[]>([])
  const [semanales, setSemanales] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [prog, setProg] = useState<{ usuarios: any[], metas: any[], acts: any[], men: any[] }>({ usuarios: [], metas: [], acts: [], men: [] })
  const [aud, setAud] = useState<any | null>(null)
  const [epp, setEpp] = useState<any | null>(null)
  const [calCap, setCalCap] = useState<{ plan: number, hechas: number } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [fFaena, setFFaena] = useState('')
  const [fPrev, setFPrev] = useState('')

  useEffect(() => {
    if (!usuario || !puede) return
    ;(async () => {
      const mes = mesActual()
      const [c, a, f, u, inf, cl, asg, sem, ct] = await Promise.all([
        supabase.from('pr_charlas').select('*').order('fecha', { ascending: false }),
        supabase.from('pr_charla_asistentes').select('id,charla_id,nombre,rut'),
        supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
        supabase.from('usuarios').select('id,nombre,cargo_programa'),
        supabase.from('pr_informes_diarios').select('id,fecha,ubicacion_id,creado_por,estado,revision').order('fecha', { ascending: false }),
        supabase.from('pr_clientes_informe').select('*').eq('activo', true),
        supabase.from('pr_semanal_asignaciones').select('*'),
        supabase.from('pr_informes_semanales').select('cliente_id,usuario_id,periodo_fin,revision'),
        supabase.from('pr_contratos').select('id,nombre,referencia,cliente_id,activo').eq('activo', true).order('nombre'),
      ])
      setContratos(ct.data || [])
      setInformes(inf.data || []); setClientes(cl.data || []); setAsigs(asg.data || []); setSemanales(sem.data || [])
      setCharlas(c.data || []); setAsistentes(a.data || [])
      setFaenas((f.data || []).filter((x: any) => x.activa !== false)); setUsuarios(u.data || [])
      setCargando(false)
      // Programa de liderazgo (mes en curso)
      const [pm, pa, pmen] = await Promise.all([
        supabase.from('pr_prog_metas').select('*'),
        supabase.from('pr_prog_actividades').select('usuario_id,actividad,revision_estado,firmado_at').eq('mes', mes),
        supabase.from('pr_prog_mensual').select('usuario_id,estado').eq('mes', mes),
      ])
      setProg({ usuarios: (u.data || []).filter((x: any) => x.cargo_programa), metas: pm.data || [], acts: pa.data || [], men: pmen.data || [] })
      // Auditoría mandante
      const [fm, it, lv, rs, dc, dt, tb, ec, ecs] = await Promise.all([
        supabase.from('aud_formatos').select('*'), supabase.from('aud_items').select('*').order('orden'),
        supabase.from('aud_levantamientos').select('*'), supabase.from('aud_respuestas').select('*'),
        supabase.from('aud_documentos').select('*'), supabase.from('aud_doc_trabajadores').select('documento_id,trabajador_id'),
        supabase.from('aud_trabajadores').select('*'),
        supabase.from('pr_epp_catalogo').select('id,nombre,activo,requiere_certificado,stock_minimo'), supabase.from('pr_epp_certificados').select('*'),
      ])
      const dts = dt.data || []
      const docs = ((dc.data || []) as AudDoc[]).map(d => ({ ...d, trab_ids: dts.filter((x: any) => x.documento_id === d.id).map((x: any) => x.trabajador_id) }))
      const eppEst = estadoEpp(ec.data || [], ecs.data || [])
      const levs = (lv.data || []).map((l: any) => {
        const fmt = (fm.data || []).find((x: any) => x.id === l.formato_id)
        const its = ((it.data || []) as AudItem[]).filter(i => i.formato_id === l.formato_id)
        const rm: Record<string, AudResp> = {}; (rs.data || []).filter((r: any) => r.levantamiento_id === l.id).forEach((r: any) => { rm[r.item_id] = r })
        const r = resumen(its, rm, docs.filter(d => d.levantamiento_id === l.id), !!fmt?.usa_puntaje, ((tb.data || []) as AudTrab[]).filter(t => t.levantamiento_id === l.id), eppEst.ok)
        return { l, fmt, r }
      })
      setAud({ levs, porRevisar: docs.filter(d => d.revision === 'pendiente').length, vencidos: docs.filter(d => d.revision !== 'rechazado' && vigencia(d.vence) === 'vencido').length, porVencer: docs.filter(d => d.revision !== 'rechazado' && vigencia(d.vence) === 'por_vencer').length })
      // Stock de EPP
      const [st, eu, mn] = await Promise.all([supabase.from('pr_epp_stock').select('*'), supabase.from('pr_epp_ubicaciones').select('ubicacion_id'), supabase.from('pr_epp_minimos').select('*')])
      const activosEpp = (ec.data || []).filter((x: any) => x.activo !== false)
      const ubicEpp = (f.data || []).filter((x: any) => (eu.data || []).some((e: any) => e.ubicacion_id === x.id) || (st.data || []).some((s: any) => s.ubicacion_id === x.id))
      const tot = (itemId: string, ub: string) => (st.data || []).filter((s: any) => s.item_id === itemId && s.ubicacion_id === ub).reduce((a: number, s: any) => a + s.stock, 0)
      const minDe = (x: any, ub: string) => { const m = (mn.data || []).find((r: any) => r.item_id === x.id && r.ubicacion_id === ub); return m ? m.minimo : 0 }
      const pares = activosEpp.flatMap((x: any) => ubicEpp.map((ub: any) => ({ x, ub, t: tot(x.id, ub.id), m: minDe(x, ub.id) }))).filter((p: any) => p.m > 0)
      const bajo = pares.filter((p: any) => p.t < p.m).map((p: any) => `${p.x.nombre} · ${p.ub.nombre}: ${p.t} (mínimo ${p.m})`)
      const igual = pares.filter((p: any) => p.t === p.m).map((p: any) => `${p.x.nombre} · ${p.ub.nombre}: ${p.t} (mínimo ${p.m})`)
      const certsVig = (ecs.data || []).filter((x: any) => x.vence)
      setEpp({ bajo, igual, items: activosEpp.length, ubic: ubicEpp.length, vencidos: certsVig.filter((x: any) => vigencia(x.vence) === 'vencido').length, porVencer: certsVig.filter((x: any) => vigencia(x.vence) === 'por_vencer').length, est: eppEst })
      // Calendario de capacitaciones a la fecha
      const [cp, cu] = await Promise.all([supabase.from('pr_cap_programa').select('*').eq('activo', true), supabase.from('pr_cap_ubic_lugar').select('*')])
      const hoyM = mesHoy(); let plan = 0, hechas = 0
      for (const lu of cu.data || []) {
        for (const p of (cp.data || []).filter((p: any) => aplica(p, lu.lugar))) for (const k of Object.keys(p.meses || {}).filter(k => k <= hoyM && k >= INICIO_OPERACION.slice(0, 7))) {
          plan++; if ((c.data || []).some((x: any) => x.programa_id === p.id && x.ubicacion_id === lu.ubicacion_id && String(x.fecha).slice(0, 7) === k)) hechas++
        }
      }
      setCalCap({ plan, hechas })
    })()
  }, [usuario, puede])

  const nombreFaena = (id?: string | null) => faenas.find(f => f.id === id)?.nombre || 'Sin faena'
  const nombreUsuario = (id: string) => usuarios.find(u => u.id === id)?.nombre || '—'

  const desde = useMemo(() => {
    const h = new Date()
    if (periodo === 'mes') return iso(new Date(h.getFullYear(), h.getMonth(), 1))
    if (periodo === '30') return iso(new Date(h.getTime() - 30 * 86400000))
    if (periodo === 'anio') return iso(new Date(h.getFullYear(), 0, 1))
    return '0000-01-01'
  }, [periodo])

  const filtradas = useMemo(() => charlas.filter(c =>
    c.fecha >= desde && (!fFaena || c.ubicacion_id === fFaena) && (!fPrev || c.creado_por === fPrev)), [charlas, desde, fFaena, fPrev])
  const asistPorCharla = useMemo(() => {
    const m: Record<string, number> = {}
    asistentes.forEach(a => { m[a.charla_id] = (m[a.charla_id] || 0) + 1 })
    return m
  }, [asistentes])

  const totalAsist = filtradas.reduce((s, c) => s + (asistPorCharla[c.id] || 0), 0)
  const promedio = filtradas.length ? Math.round((totalAsist / filtradas.length) * 10) / 10 : 0
  const horas = Math.round(filtradas.reduce((s, c) => s + (c.duracion_min || 0) * (asistPorCharla[c.id] || 0), 0) / 60 * 10) / 10

  const contar = (clave: (c: any) => string) => {
    const m: Record<string, number> = {}
    filtradas.forEach(c => { const k = clave(c); m[k] = (m[k] || 0) + 1 })
    return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor)
  }
  const porFaena = contar(c => nombreFaena(c.ubicacion_id))
  const porPrev = contar(c => nombreUsuario(c.creado_por))
  const porTipo = contar(c => TIPOS_CHARLA[c.tipo] || c.tipo)
  const infFiltrados = informes.filter(i => i.fecha >= desde && (!fFaena || i.ubicacion_id === fFaena) && (!fPrev || i.creado_por === fPrev))
  const infPorPrev = (() => { const m: Record<string, number> = {}; infFiltrados.forEach(i => { const k = nombreUsuario(i.creado_por); m[k] = (m[k] || 0) + 1 }); return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor) })()
  const semAtrasados = asigs.flatMap(a => {
    const c = clientes.find(x => x.id === a.cliente_id); if (!c) return []
    return periodos(c.dia_cierre, 4).filter(fin => estadoSemanal(fin, c.dias_plazo, semanales.some(s => s.cliente_id === c.id && s.usuario_id === a.usuario_id && s.periodo_fin === fin), c.hora_limite).tipo === 'atraso')
      .map(fin => ({ k: a.id + fin, texto: `${nombreUsuario(a.usuario_id)} · ${c.nombre} · semana al ${fin.split('-').reverse().join('-').slice(0, 5)}` }))
  })
  const faenasSinActividad = faenas.filter(f => (!fFaena || f.id === fFaena) && !filtradas.some(c => c.ubicacion_id === f.id))

  // últimos 6 meses (ignora el filtro de período, respeta faena y prevencionista)
  const porMes = useMemo(() => {
    const h = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(h.getFullYear(), h.getMonth() - (5 - i), 1)
      const pref = iso(d).slice(0, 7)
      const valor = charlas.filter(c => c.fecha.startsWith(pref) && (!fFaena || c.ubicacion_id === fFaena) && (!fPrev || c.creado_por === fPrev)).length
      return { nombre: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, valor }
    })
  }, [charlas, fFaena, fPrev])

  const kpi = (valor: string | number, texto: string) => (
    <div style={{ ...card, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: AZUL }}>{valor}</p>
      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{texto}</p>
    </div>
  )

  // ───── Resúmenes por módulo ─────
  const mesAct = mesActual()
  const progFilas = prog.usuarios.map(u => {
    const metas = prog.metas.filter(m => m.cargo === u.cargo_programa)
    const mias = prog.acts.filter(a => a.usuario_id === u.id)
    const meta = metas.reduce((s, m) => s + m.meta, 0)
    const real = metas.reduce((s, m) => s + Math.min(mias.filter(a => a.actividad === m.actividad && a.revision_estado !== 'rechazado').length, m.meta), 0)
    const men = prog.men.find(x => x.usuario_id === u.id)?.estado || 'abierto'
    return { u, p: pct(real, meta) ?? 0, men, rech: mias.filter(a => a.revision_estado === 'rechazado').length }
  }).sort((a, b) => a.p - b.p)
  const progProm = progFilas.length ? Math.round(progFilas.reduce((s, f) => s + f.p, 0) / progFilas.length) : 0
  const progPorAprobar = prog.acts.filter(a => a.firmado_at && a.revision_estado === 'pendiente').length
  const progEnviados = progFilas.filter(f => f.men === 'enviado' || f.men === 'aprobado').length
  const infEnviados = infFiltrados.filter(i => i.estado === 'cerrado').length
  const infPorAprobar = informes.filter(i => i.estado === 'cerrado' && i.revision === 'pendiente').length
  const infRech = infFiltrados.filter(i => i.estado === 'cerrado' && i.revision === 'rechazado').length
  const infBorr = infFiltrados.filter(i => i.estado === 'borrador').length
  const semPorAprobar = semanales.filter(s => s.revision === 'pendiente').length
  const semEntregados = semanales.length
  const audProm = aud && aud.levs.length ? Math.round(aud.levs.reduce((s: number, x: any) => s + x.r.pct, 0) / aud.levs.length) : null
  const capAtrasadas = calCap ? calCap.plan - calCap.hechas : 0
  const capPct = calCap && calCap.plan ? Math.round(calCap.hechas / calCap.plan * 100) : null
  const verde = (v: number | null) => v === null ? '#667085' : v >= 90 ? '#1e8e4e' : v >= 60 ? '#b7791f' : '#c0392b'
  const kpiC = (valor: string | number, texto: string, color?: string) => (
    <div style={{ ...card, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: color || AZUL }}>{valor}</p>
      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{texto}</p>
    </div>
  )
  const grid = (min: number, ch: React.ReactNode) => <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap: '10px', marginBottom: '10px' }}>{ch}</div>
  const mod = (href: string, icon: string, titulo: string, desc: string, badge?: React.ReactNode) => (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', ...card, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px', borderColor: AZUL }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: 'rgba(27,79,156,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: '14.5px', margin: '0 0 2px', color: '#16213E' }}>{titulo}</p>
        <p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>{desc}</p>
      </div>
      {badge}
    </Link>
  )
  const pill = (n: number, txt: string, rojo = false) => n > 0 ? <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: rojo ? '#fde8e8' : '#fef7e0', color: rojo ? '#9b1c1c' : '#986a00', whiteSpace: 'nowrap' }}>{rojo ? '🔴' : '⏳'} {n} {txt}</span> : null

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/hsec" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Prevención de Riesgo</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Panel de Jefatura</h1>
        </div>

        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección. Pídele al administrador que te la habilite en Usuarios.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px', alignItems: 'center' }}>
              <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={input}>
                <option value="mes">Este mes</option><option value="30">Últimos 30 días</option><option value="anio">Este año</option><option value="todo">Todo el historial</option>
              </select>
              <select value={fFaena} onChange={e => setFFaena(e.target.value)} style={input}>
                <option value="">Todas las faenas</option>{faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
              <select value={fPrev} onChange={e => setFPrev(e.target.value)} style={input}>
                <option value="">Todos los prevencionistas</option>
                {Array.from(new Set(charlas.map(c => c.creado_por))).map(id => <option key={id} value={id}>{nombreUsuario(id)}</option>)}
              </select>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '11.5px', color: '#98a2b3' }}>Los filtros afectan a informes diarios y capacitaciones. El resto muestra el estado actual.</p>

            {/* 1 · Programa de liderazgo percibido */}
            {mod('/hsec/jefatura/programa', '📈', 'Programa de liderazgo percibido', 'Cumplimiento de cada persona, revisión de sus actividades y aprobación del mes', pill(progPorAprobar, 'por aprobar'))}
            {grid(150, <>
              {kpiC(`${progProm}%`, `Cumplimiento promedio · ${nombreMes(mesAct)}`, verde(progProm))}
              {kpiC(`${progEnviados}/${progFilas.length}`, 'Programas enviados del mes')}
              {kpiC(progPorAprobar, 'Documentos por aprobar', progPorAprobar ? '#b7791f' : '#1e8e4e')}
            </>)}
            {progFilas.length > 0 && (
              <div style={{ ...card, marginBottom: '26px' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>Avance por persona (de menor a mayor)</p>
                {progFilas.map(x => (
                  <div key={x.u.id} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                      <span style={{ color: '#344054' }}>{x.u.nombre} <span style={{ color: '#98a2b3' }}>· {CARGOS_PROGRAMA[x.u.cargo_programa]}{x.rech ? ` · ❌ ${x.rech} rechazado(s)` : ''}</span></span><strong style={{ color: verde(x.p) }}>{x.p}%</strong>
                    </div>
                    <div style={{ height: '8px', background: '#eef1f6', borderRadius: '6px', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, x.p)}%`, height: '100%', background: verde(x.p), borderRadius: '6px' }} /></div>
                  </div>
                ))}
              </div>
            )}
            {progFilas.length === 0 && <div style={{ marginBottom: '26px' }} />}

            {/* 2 · Informes diarios */}
            {mod('/hsec/prevencionista/informe-diario', '📝', 'Informes diarios', 'Aprueba o rechaza cada día los informes de los prevencionistas y configura la lista de actividades', pill(infPorAprobar, 'por aprobar'))}
            {grid(150, <>
              {kpiC(infEnviados, 'Informes enviados en el período')}
              {kpiC(infPorAprobar, 'Esperan tu aprobación', infPorAprobar ? '#b7791f' : '#1e8e4e')}
              {kpiC(infRech, 'Rechazados por corregir', infRech ? '#c0392b' : '#1e8e4e')}
              {kpiC(infBorr, 'Borradores sin enviar', '#667085')}
            </>)}
            <div style={{ marginBottom: '26px' }}><Barras titulo="Informes diarios por prevencionista" filas={infPorPrev} vacio="Sin informes en el período." /></div>

            {/* 3 · Informes semanales */}
            {mod('/hsec/jefatura/semanales', '🗓️', 'Informes semanales', 'Formato y calendario de cada cliente, asignación de prevencionistas y semáforo de entregas', <>{pill(semAtrasados.length, `atrasado${semAtrasados.length === 1 ? '' : 's'}`, true)}{pill(semPorAprobar, 'por aprobar')}</>)}
            {grid(150, <>
              {kpiC(semAtrasados.length, 'Atrasados', semAtrasados.length ? '#c0392b' : '#1e8e4e')}
              {kpiC(semPorAprobar, 'Por aprobar', semPorAprobar ? '#b7791f' : '#1e8e4e')}
              {kpiC(semEntregados, 'Entregados (total)')}
            </>)}
            {semAtrasados.length > 0 && (
              <div style={{ ...card, background: '#fde8e8', borderColor: '#f3b4b4', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' }}>⚠️ Informes semanales atrasados</p>
                {semAtrasados.map(x => <p key={x.k} style={{ margin: '2px 0', fontSize: '12.5px', color: '#9b1c1c' }}>{x.texto}</p>)}
              </div>
            )}
            <div style={{ marginBottom: '26px' }} />

            {/* 4 · Auditoría mandante */}
            {mod('/hsec/prevencionista/auditoria-mandante', '🧾', 'Auditoría mandante', 'Formatos de SQM, Engie, Eurohinca y otros por contrato: documentos de respaldo, vencimientos y revisión', pill(aud?.porRevisar || 0, 'por revisar'))}
            {aud && grid(150, <>
              {kpiC(audProm === null ? '—' : `${audProm}%`, 'Cumplimiento promedio', verde(audProm))}
              {kpiC(aud.levs.length, 'Contratos auditados')}
              {kpiC(aud.porRevisar, 'Documentos por revisar', aud.porRevisar ? '#b7791f' : '#1e8e4e')}
              {kpiC(aud.vencidos + aud.porVencer, `Vencidos o por vencer (${aud.vencidos} vencidos)`, aud.vencidos ? '#c0392b' : aud.porVencer ? '#b7791f' : '#1e8e4e')}
            </>)}
            {aud && aud.levs.length > 0 && (
              <div style={{ ...card, marginBottom: '26px' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>Estado por contrato</p>
                {aud.levs.map((x: any) => (
                  <div key={x.l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '12.5px', padding: '6px 0', borderTop: '1px solid #eef1f6' }}>
                    <span><b>{contratos.find(c => c.id === x.l.contrato_id)?.nombre || '—'}</b> · {x.fmt?.nombre || ''}</span>
                    <span><b style={{ color: verde(x.r.pct) }}>{Math.round(x.r.pct)}%</b> · {calificacion(x.r.pct)} · ✓ {x.r.nCumple} · ✗ {x.r.nNo} · pendientes {x.r.pend}</span>
                  </div>
                ))}
              </div>
            )}
            {(!aud || aud.levs.length === 0) && <div style={{ marginBottom: '26px' }} />}

            {/* 5 · Capacitaciones */}
            {mod('/hsec/jefatura/capacitaciones', '🎓', 'Capacitaciones', 'Programa anual: calendario, cumplimiento por mes y por faena (ENGIE, SQM, SACYR - EUROHINCA, oficina central)')}
            {grid(150, <>
              {kpiC(capPct === null ? '—' : `${capPct}%`, 'Calendario cumplido a la fecha', verde(capPct))}
              {kpiC(capAtrasadas, 'Capacitaciones sin registrar', capAtrasadas ? '#c0392b' : '#1e8e4e')}
              {kpiC(filtradas.length, 'Charlas realizadas')}
              {kpiC(totalAsist, 'Asistencias registradas')}
              {kpiC(promedio, 'Asistentes por charla')}
              {kpiC(horas, 'Horas de capacitación (hombre)')}
            </>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '10px', marginBottom: '12px' }}>
              <Barras titulo="Charlas por faena" filas={porFaena} />
              <Barras titulo="Charlas por prevencionista" filas={porPrev} />
              <Barras titulo="Por tipo" filas={porTipo} />
              <Barras titulo="Últimos 6 meses" filas={porMes} />
            </div>
            {faenasSinActividad.length > 0 && (
              <div style={{ ...card, background: '#fff8e5', borderColor: '#f0d98a', marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#7a5600' }}>⚠️ Faenas sin charlas en este período</p>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#7a5600' }}>{faenasSinActividad.map(f => f.nombre).join(' · ')}</p>
              </div>
            )}
            <div style={{ ...card, marginBottom: '26px' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>Últimas charlas</p>
              {filtradas.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Sin charlas en el período.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#667085' }}>
                      <th style={{ padding: '6px 8px' }}>Fecha</th><th style={{ padding: '6px 8px' }}>Tema</th><th style={{ padding: '6px 8px' }}>Tipo</th>
                      <th style={{ padding: '6px 8px' }}>Faena</th><th style={{ padding: '6px 8px' }}>Prevencionista</th><th style={{ padding: '6px 8px' }}>Asist.</th>
                    </tr></thead>
                    <tbody>
                      {filtradas.slice(0, 15).map(c => (
                        <tr key={c.id} style={{ borderTop: '1px solid #eef1f6' }}>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{fechaCL(c.fecha)}</td>
                          <td style={{ padding: '6px 8px' }}>{c.tema}</td>
                          <td style={{ padding: '6px 8px' }}>{TIPOS_CHARLA[c.tipo] || c.tipo}</td>
                          <td style={{ padding: '6px 8px' }}>{nombreFaena(c.ubicacion_id)}</td>
                          <td style={{ padding: '6px 8px' }}>{nombreUsuario(c.creado_por)}</td>
                          <td style={{ padding: '6px 8px' }}>{asistPorCharla[c.id] || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 6 · Stock de EPP */}
            {mod('/hsec/jefatura/epp', '🦺', 'Stock de EPP', 'Resumen de stock por faena, mínimos, catálogo, certificados y movimientos', pill((epp?.bajo.length || 0) + (epp?.igual.length || 0), 'en/bajo mínimo', true))}
            {epp && grid(150, <>
              {kpiC(epp.igual.length, 'Ítems justo en el stock mínimo', epp.igual.length ? '#b7791f' : '#1e8e4e')}
              {kpiC(epp.bajo.length, 'Ítems bajo el stock mínimo', epp.bajo.length ? '#c0392b' : '#1e8e4e')}
              {kpiC(epp.vencidos, 'Certificados vencidos', epp.vencidos ? '#c0392b' : '#1e8e4e')}
              {kpiC(epp.porVencer, 'Certificados por vencer (30 días)', epp.porVencer ? '#b7791f' : '#1e8e4e')}
              {kpiC(`${epp.est.conCert}/${epp.est.total}`, 'EPP con certificado vigente', epp.est.total && epp.est.ok ? '#1e8e4e' : '#b7791f')}
            </>)}
            {epp && epp.igual.length > 0 && (
              <div style={{ ...card, background: '#fff8e5', borderColor: '#f0d98a', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#7a5600' }}>🟡 Justo en el stock mínimo ({epp.igual.length})</p>
                {epp.igual.slice(0, 8).map((t: string) => <p key={t} style={{ margin: '2px 0', fontSize: '12.5px', color: '#7a5600' }}>{t}</p>)}
                {epp.igual.length > 8 && <p style={{ margin: '2px 0', fontSize: '12px', color: '#7a5600' }}>…y {epp.igual.length - 8} más</p>}
              </div>
            )}
            {epp && epp.bajo.length > 0 && (
              <div style={{ ...card, background: '#fde8e8', borderColor: '#f3b4b4', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' }}>⚠️ Bajo el stock mínimo</p>
                {epp.bajo.slice(0, 8).map((t: string) => <p key={t} style={{ margin: '2px 0', fontSize: '12.5px', color: '#9b1c1c' }}>{t}</p>)}
                {epp.bajo.length > 8 && <p style={{ margin: '2px 0', fontSize: '12px', color: '#9b1c1c' }}>…y {epp.bajo.length - 8} más</p>}
              </div>
            )}
            <div style={{ marginBottom: '26px' }} />

            {/* Configuración (módulo fusionado, sin resumen) */}
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>⚙️ Configuración</p>
            {mod('/hsec/jefatura/faenas', '🏗️', 'Faenas, contratos y descriptor de cargo', 'Faenas y asignaciones de prevencionistas · Contratos y documentos (PTS, matrices, planes de emergencia) · Descriptor de cargo y verificación de firmas')}
          </>
        )}
      </div>
    </main>
  )
}

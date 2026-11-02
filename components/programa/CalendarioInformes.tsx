'use client'
import { useState, useMemo } from 'react'
import { card, btn } from './ui'
import { estadoPlan, COLOR_PLAN } from '@/lib/estadoPlan'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const fcl = (f: string) => f.split('-').reverse().join('-')
const sumaDias = (f: string, n: number) => { const [y, m, d] = f.split('-').map(Number); const t = new Date(y, m - 1, d + n); return iso(t.getFullYear(), t.getMonth(), t.getDate()) }
const esFinde = (f: string) => { const [y, m, d] = f.split('-').map(Number); const w = new Date(y, m - 1, d).getDay(); return w === 0 || w === 6 }

type Venc = { fecha: string, texto: string, tipo: string, estado: 'En ejecución' | 'Ejecutado' | 'Pendiente' | 'Próximo', informe: any }

// Vencimientos que el APR se comprometió a cumplir, sacados de sus informes
function vencimientos(informes: any[]): Venc[] {
  const out: Venc[] = []
  for (const r of informes) {
    const d = r.datos || {}
    ;(d.pendientes || []).forEach((p: any) => { if (p.pendiente && /^\d{4}-/.test(p.fecha || '')) out.push({ fecha: p.fecha, texto: p.pendiente, tipo: 'Pendiente del turno', estado: p.fecha < hoyISO() ? 'Pendiente' : 'Próximo', informe: r }) })
    ;(d.mejoras || []).forEach((m: any) => { if (m.oportunidad && /^\d{4}-/.test(m.plazo || '') && m.estado !== 'Ejecutado') out.push({ fecha: m.plazo, texto: m.compromiso || m.oportunidad, tipo: 'Oportunidad de mejora', estado: estadoPlan(m.estado, m.plazo), informe: r }) })
    ;(d.condiciones || []).forEach((c: any) => { if (c.estado === 'NC' && /^\d{4}-/.test(c.fecha || '') && c.status !== 'Ejecutado') out.push({ fecha: c.fecha, texto: `${c.item}: ${c.accion || ''}`, tipo: 'Plan de acción (No conforme)', estado: estadoPlan(c.status, c.fecha), informe: r }) })
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export default function CalendarioInformes({ informes, plazoDias = 3, onAbrir, onNuevo }: {
  informes: any[], plazoDias?: number, onAbrir: (r: any) => void, onNuevo: (fecha: string) => void,
}) {
  const hoy = hoyISO()
  const [h0] = useState(() => { const [y, m] = hoy.split('-').map(Number); return { y, m: m - 1 } })
  const [mes, setMes] = useState(h0)
  const [sel, setSel] = useState<string | null>(hoy)
  const [finde, setFinde] = useState(false)
  const [ayuda, setAyuda] = useState(false)

  const porDia = useMemo(() => { const m: Record<string, any[]> = {}; informes.forEach(r => { (m[r.fecha] = m[r.fecha] || []).push(r) }); return m }, [informes])
  const venc = useMemo(() => vencimientos(informes), [informes])
  const vencPorDia = useMemo(() => { const m: Record<string, Venc[]> = {}; venc.forEach(v => { (m[v.fecha] = m[v.fecha] || []).push(v) }); return m }, [venc])

  const primero = new Date(mes.y, mes.m, 1)
  const offset = (primero.getDay() + 6) % 7
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate()
  const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => iso(mes.y, mes.m, i + 1))]
  while (celdas.length % 7) celdas.push(null)

  const estadoDia = (f: string) => {
    const rs = porDia[f] || []
    if (rs.some(r => r.estado === 'cerrado')) return 'cerrado'
    if (rs.length) return 'borrador'
    if (f > hoy) return 'futuro'
    if (!finde && esFinde(f)) return 'libre'
    return f === hoy ? 'hoy' : 'falta'
  }
  const COL: Record<string, [string, string, string]> = {
    cerrado: ['#e7f6ec', '#14532d', '✓'], borrador: ['#fef7e0', '#986a00', '✎'], falta: ['#fde8e8', '#9b1c1c', '!'],
    hoy: ['#e8f0fe', '#1B4F9C', '●'], futuro: ['#fff', '#98a2b3', ''], libre: ['#f6f7f9', '#b0b6c0', ''],
  }

  // Resumen del mes visible
  const delMes = celdas.filter((f): f is string => !!f && f <= hoy && (finde || !esFinde(f)))
  const cerrados = delMes.filter(f => estadoDia(f) === 'cerrado').length
  const faltan = delMes.filter(f => estadoDia(f) === 'falta')
  const pct = delMes.length ? Math.round((cerrados / delMes.length) * 100) : 0
  // racha: días hábiles consecutivos hasta hoy con informe cerrado
  let racha = 0
  for (let f = hoy; racha < 400; f = sumaDias(f, -1)) {
    if (!finde && esFinde(f)) continue
    if (estadoDia(f) === 'cerrado') racha++
    else if (f === hoy) continue
    else break
  }
  const pendientes = venc.filter(v => v.estado === 'Pendiente')
  const proximos = venc.filter(v => v.estado !== 'Pendiente').slice(0, 6)
  const mover = (n: number) => setMes(({ y, m }) => { const t = new Date(y, m + n, 1); return { y: t.getFullYear(), m: t.getMonth() } })
  const puedeCrear = (f: string) => f <= hoy && f >= sumaDias(hoy, -plazoDias)

  const kpi = (v: string | number, t: string, col = '#16213E', ayudaTxt?: string) => (
    <div title={ayudaTxt} style={{ ...card, padding: '10px 12px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: col }}>{v}</p>
      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#667085' }}>{t}</p>
    </div>
  )
  const selRs = sel ? (porDia[sel] || []) : []
  const selVenc = sel ? (vencPorDia[sel] || []) : []

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '8px', marginBottom: '10px' }}>
        {kpi(`${pct}%`, 'Informes al día (mes)', pct >= 90 ? '#1e8e4e' : pct >= 60 ? '#b7791f' : '#c0392b', 'Días con informe cerrado sobre los días que ya pasaron este mes')}
        {kpi(`🔥 ${racha}`, 'Racha de días seguidos', '#16213E', 'Días hábiles consecutivos con informe cerrado')}
        {kpi(faltan.length, 'Días sin informe', faltan.length ? '#c0392b' : '#1e8e4e', 'Días que ya pasaron y no tienen informe')}
        {kpi(pendientes.length, 'Compromisos vencidos', pendientes.length ? '#c0392b' : '#1e8e4e', 'Planes de acción y pendientes con fecha ya pasada')}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => mover(-1)} style={{ ...btn(false), padding: '4px 10px' }}>‹</button>
            <strong style={{ fontSize: '15px', minWidth: '130px', textAlign: 'center' }}>{MESES[mes.m]} {mes.y}</strong>
            <button onClick={() => mover(1)} style={{ ...btn(false), padding: '4px 10px' }}>›</button>
            <button onClick={() => { setMes(h0); setSel(hoy) }} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Hoy</button>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', color: '#667085', display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }} title="Si trabajas turnos que incluyen fines de semana, actívalo para que cuenten como días con informe obligatorio">
              <input type="checkbox" checked={finde} onChange={e => setFinde(e.target.checked)} /> Contar sáb y dom
            </label>
            <button onClick={() => setAyuda(v => !v)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>¿Cómo leerlo? {ayuda ? '▲' : '▼'}</button>
          </div>
        </div>

        {ayuda && (
          <div style={{ background: '#f4f8fd', border: '1px solid #cfe0f5', borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', color: '#344054', marginBottom: '10px', lineHeight: 1.5 }}>
            <strong>Cómo usar este calendario</strong><br />
            • Cada cuadro es un día. <span style={{ color: '#14532d', fontWeight: 700 }}>✓ verde</span> = informe cerrado · <span style={{ color: '#986a00', fontWeight: 700 }}>✎ amarillo</span> = borrador sin cerrar · <span style={{ color: '#9b1c1c', fontWeight: 700 }}>! rojo</span> = falta el informe · <span style={{ color: '#1B4F9C', fontWeight: 700 }}>● azul</span> = hoy.<br />
            • Los puntitos de color abajo del número son compromisos que vencen ese día: <span style={{ color: '#1B4F9C' }}>azul</span> = en plazo, <span style={{ color: '#c0392b' }}>rojo</span> = vencido.<br />
            • Toca un día para ver su informe o crearlo. Solo puedes crear informes de hoy y de hasta {plazoDias} días atrás.<br />
            • Las tarjetas de arriba se calculan solas: «al día» es cuántos días hábiles del mes tienen informe cerrado; la racha son los días seguidos sin fallar.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {DIAS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#98a2b3', padding: '2px 0' }}>{d}</div>)}
          {celdas.map((f, i) => {
            if (!f) return <div key={i} />
            const e = estadoDia(f), [bg, fg, ic] = COL[e]
            const vs = vencPorDia[f] || []
            const activo = sel === f
            return (
              <button key={f} onClick={() => setSel(f)} title={`${fcl(f)} · ${e === 'cerrado' ? 'Informe cerrado' : e === 'borrador' ? 'Borrador sin cerrar' : e === 'falta' ? 'Falta el informe' : e === 'hoy' ? 'Hoy' : ''}${vs.length ? ` · ${vs.length} compromiso(s)` : ''}`}
                style={{ background: bg, color: fg, border: activo ? '2px solid #1B4F9C' : f === hoy ? '2px solid #1B4F9C55' : '1px solid #e8ebf0', borderRadius: '8px', minHeight: '54px', padding: '4px 2px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{Number(f.slice(8))}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1 }}>{ic}</span>
                <span style={{ display: 'flex', gap: '2px', height: '7px' }}>
                  {vs.slice(0, 4).map((v, k) => <span key={k} style={{ width: '6px', height: '6px', borderRadius: '50%', background: v.estado === 'Pendiente' ? '#c0392b' : '#1B4F9C' }} />)}
                </span>
              </button>
            )
          })}
        </div>

        {sel && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px' }}>{fcl(sel)}{sel === hoy ? ' · hoy' : ''}</p>
            {selRs.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '6px 0', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px' }}>{r.estado === 'cerrado' ? '✅ Informe cerrado' : '✎ Borrador'} {r.datos?.contrato ? <span style={{ color: '#667085' }}>· {r.datos.contrato}</span> : null}</span>
                <button onClick={() => onAbrir(r)} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>{r.estado === 'cerrado' ? 'Ver informe' : 'Continuar'}</button>
              </div>
            ))}
            {selRs.length === 0 && (
              puedeCrear(sel)
                ? <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}><span style={{ fontSize: '13px', color: '#9b1c1c' }}>{sel === hoy ? 'Aún no hay informe de hoy.' : 'Este día no tiene informe.'}</span><button onClick={() => onNuevo(sel)} style={{ ...btn(), padding: '6px 14px', fontSize: '12.5px' }}>+ Crear informe de este día</button></div>
                : <span style={{ fontSize: '12.5px', color: '#98a2b3' }}>{sel > hoy ? 'Es un día futuro.' : `Sin informe. Ya pasó el plazo de ${plazoDias} días para crearlo.`}</span>
            )}
            {selVenc.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#667085' }}>Compromisos que vencen este día</p>
                {selVenc.map((v, i) => <div key={i} style={{ fontSize: '12.5px', padding: '2px 0' }}><span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', marginRight: '6px', background: (COLOR_PLAN[v.estado] || ['#e8f0fe', '#1B4F9C'])[0], color: (COLOR_PLAN[v.estado] || ['#e8f0fe', '#1B4F9C'])[1] }}>{v.estado === 'Próximo' ? 'En plazo' : v.estado}</span>{v.texto} <span style={{ color: '#98a2b3' }}>· {v.tipo}</span></div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {(pendientes.length > 0 || proximos.length > 0 || faltan.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '8px', marginTop: '8px' }}>
          {(faltan.length > 0 || pendientes.length > 0) && (
            <div style={{ ...card, background: '#fff5f5', borderColor: '#f3b4b4' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' }}>⚠️ Qué necesita tu atención</p>
              {faltan.length > 0 && <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: '#9b1c1c' }}>{faltan.length} día(s) sin informe: {faltan.slice(-5).map(f => <button key={f} onClick={() => { setSel(f); const [y, m] = f.split('-').map(Number); setMes({ y, m: m - 1 }) }} style={{ border: 'none', background: '#fde8e8', color: '#9b1c1c', borderRadius: '20px', padding: '1px 8px', margin: '0 3px 3px 0', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}>{fcl(f).slice(0, 5)}</button>)}{faltan.length > 5 ? '…' : ''}</p>}
              {pendientes.slice(0, 5).map((v, i) => <p key={i} style={{ margin: '0 0 3px', fontSize: '12.5px', color: '#9b1c1c' }}>• Venció el {fcl(v.fecha).slice(0, 5)}: {v.texto} <span style={{ color: '#b07070' }}>({v.tipo})</span></p>)}
            </div>
          )}
          {proximos.length > 0 && (
            <div style={card}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>🗓️ Próximos vencimientos</p>
              {proximos.map((v, i) => <p key={i} style={{ margin: '0 0 3px', fontSize: '12.5px' }}><strong style={{ color: '#1B4F9C' }}>{fcl(v.fecha).slice(0, 5)}</strong> · {v.texto} <span style={{ color: '#98a2b3' }}>({v.tipo})</span></p>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

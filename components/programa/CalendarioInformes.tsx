'use client'
import { useState, useMemo } from 'react'
import { card, btn, input } from './ui'
import { estadoPlan, COLOR_PLAN } from '@/lib/estadoPlan'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const fcl = (f: string) => f.split('-').reverse().join('-')
const sumaDias = (f: string, n: number) => { const [y, m, d] = f.split('-').map(Number); const t = new Date(y, m - 1, d + n); return iso(t.getFullYear(), t.getMonth(), t.getDate()) }
const esFinde = (f: string) => { const [y, m, d] = f.split('-').map(Number); const w = new Date(y, m - 1, d).getDay(); return w === 0 || w === 6 }

type Venc = { fecha: string, texto: string, tipo: string, estado: 'En ejecución' | 'Ejecutado' | 'Pendiente' | 'Próximo', informe: any, clave: string }

// Vencimientos que el APR se comprometió a cumplir, sacados de sus informes (se omiten los ya cerrados con respaldo)
function vencimientos(informes: any[], cierres: any[]): Venc[] {
  const out: Venc[] = []
  const hechos = new Set(cierres.map(c => `${c.informe_id}|${c.clave}`))
  for (const r of informes) {
    if (r.estado !== 'cerrado') continue // solo cuentan los compromisos de informes ya enviados
    const d = r.datos || {}
    const add = (pref: string, x: any, i: number, v: Omit<Venc, 'clave' | 'informe'>) => { const clave = `${pref}:${x.uid ?? i}`; if (!hechos.has(`${r.id}|${clave}`)) out.push({ ...v, clave, informe: r }) }
    ;(d.pendientes || []).forEach((p: any, i: number) => { if (p.pendiente && /^\d{4}-/.test(p.fecha || '')) add('p', p, i, { fecha: p.fecha, texto: p.pendiente, tipo: 'Pendiente del turno', estado: p.fecha < hoyISO() ? 'Pendiente' : 'Próximo' }) })
    ;(d.mejoras || []).forEach((m: any, i: number) => { if (m.oportunidad && /^\d{4}-/.test(m.plazo || '') && m.estado !== 'Ejecutado') add('m', m, i, { fecha: m.plazo, texto: m.compromiso || m.oportunidad, tipo: 'Oportunidad de mejora', estado: estadoPlan(m.estado, m.plazo) }) })
    ;(d.condiciones || []).forEach((c: any, i: number) => { if (c.estado === 'NC' && /^\d{4}-/.test(c.fecha || '') && c.status !== 'Ejecutado') add('c', c, i, { fecha: c.fecha, texto: `${c.item}: ${c.accion || ''}`, tipo: 'Plan de acción (No conforme)', estado: estadoPlan(c.status, c.fecha) }) })
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Aviso compacto: al tocarlo se abre su detalle, el informe de origen y, si corresponde, el cierre con respaldo
function Aviso({ v, esAutor, onAbrir, onCerrarPlan }: { v: Venc, esAutor: boolean, onAbrir: (r: any) => void, onCerrarPlan: (informeId: string, clave: string, f: File, nota: string) => Promise<void> }) {
  const [abierto, setAbierto] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const venc = v.estado === 'Pendiente'
  return (
    <div style={{ border: `1px solid ${venc ? '#f3b4b4' : '#e3e8f0'}`, borderRadius: '8px', background: '#fff', marginBottom: '5px' }}>
      <button type="button" onClick={() => setAbierto(a => !a)} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '6px 9px', display: 'flex', gap: '8px', alignItems: 'center', fontFamily: 'inherit' }}>
        <strong style={{ fontSize: '12px', color: venc ? '#c0392b' : '#1B4F9C', flexShrink: 0 }}>{fcl(v.fecha).slice(0, 5)}</strong>
        <span style={{ fontSize: '12.5px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#344054' }}>{v.texto}</span>
        <span style={{ fontSize: '11px', color: '#98a2b3' }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div style={{ padding: '0 9px 9px', fontSize: '12.5px', color: '#344054' }}>
          <p style={{ margin: '0 0 4px' }}>{v.texto}</p>
          <p style={{ margin: '0 0 6px', color: '#667085' }}>{v.tipo} · vence {fcl(v.fecha)} · del informe del {fcl(v.informe.fecha)}{venc ? ' · ⚠️ vencido' : ''}</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onAbrir(v.informe)} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>📄 Abrir informe</button>
            {esAutor && !cerrando && <button type="button" onClick={() => setCerrando(true)} style={{ ...btn(), padding: '5px 10px', fontSize: '12px' }}>✔ Marcar como ejecutado</button>}
          </div>
          {esAutor && cerrando && (
            <div style={{ marginTop: '8px', background: '#f4f8fd', border: '1px dashed #9db8e0', borderRadius: '8px', padding: '8px', display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 700, color: '#1B4F9C' }}>📎 Adjunta el respaldo de lo ejecutado (foto o PDF) *</span>
              <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: '12px' }} />
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Comentario (opcional)" style={{ ...input, fontSize: '12.5px' }} />
              {err && <span style={{ color: '#c5221f' }}>{err}</span>}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" disabled={!file || busy} onClick={async () => { if (!file) return; setBusy(true); setErr(''); try { await onCerrarPlan(v.informe.id, v.clave, file, nota) } catch (x: any) { setErr('No se pudo cerrar: ' + (x?.message || x)); setBusy(false) } }} style={{ ...btn(), padding: '5px 12px', fontSize: '12px', opacity: !file || busy ? 0.5 : 1 }}>{busy ? 'Guardando…' : 'Confirmar: pasa a Ejecutado'}</button>
                <button type="button" onClick={() => setCerrando(false)} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CalendarioInformes({ informes, cierres = [], plazoDias = 3, esAutor, esJefe = false, onAbrir, onNuevo, onCerrarPlan, onEvidencia }: {
  informes: any[], cierres?: any[], plazoDias?: number, esAutor: boolean, esJefe?: boolean, onAbrir: (r: any) => void, onNuevo: (fecha: string) => void,
  onCerrarPlan: (informeId: string, clave: string, f: File, nota: string) => Promise<void>, onEvidencia?: (path: string) => void,
}) {
  const hoy = hoyISO()
  const [h0] = useState(() => { const [y, m] = hoy.split('-').map(Number); return { y, m: m - 1 } })
  const [mes, setMes] = useState(h0)
  const [sel, setSel] = useState<string | null>(hoy)
  const [finde, setFinde] = useState(false)
  const [ayuda, setAyuda] = useState(false)

  const porDia = useMemo(() => { const m: Record<string, any[]> = {}; informes.forEach(r => { (m[r.fecha] = m[r.fecha] || []).push(r) }); return m }, [informes])
  const venc = useMemo(() => vencimientos(informes, cierres), [informes, cierres])
  const vencPorDia = useMemo(() => { const m: Record<string, Venc[]> = {}; venc.forEach(v => { (m[v.fecha] = m[v.fecha] || []).push(v) }); return m }, [venc])

  const primero = new Date(mes.y, mes.m, 1)
  const offset = (primero.getDay() + 6) % 7
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate()
  const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => iso(mes.y, mes.m, i + 1))]
  while (celdas.length % 7) celdas.push(null)

  const estadoDia = (f: string) => {
    const rs = porDia[f] || []
    if (rs.some(r => r.estado === 'cerrado' && r.revision === 'aprobado')) return 'cerrado'
    if (rs.some(r => r.estado === 'cerrado' && r.revision === 'pendiente')) return 'enviado'
    if (rs.some(r => r.estado === 'cerrado')) return 'rechazado'
    if (rs.length) return 'borrador'
    if (f > hoy) return 'futuro'
    if (!finde && esFinde(f)) return 'libre'
    return f === hoy ? 'hoy' : 'falta'
  }
  const COL: Record<string, [string, string, string]> = {
    cerrado: ['#e7f6ec', '#14532d', '✓'], enviado: ['#f1ebfd', '#5b3aa6', '⏳'], rechazado: ['#fff1e6', '#b4540a', '↩'], borrador: ['#fef7e0', '#986a00', '✎'], falta: ['#fde8e8', '#9b1c1c', '!'],
    hoy: ['#e8f0fe', '#1B4F9C', '●'], futuro: ['#fff', '#98a2b3', ''], libre: ['#f6f7f9', '#b0b6c0', ''],
  }

  // Resumen del mes visible
  const delMes = celdas.filter((f): f is string => !!f && f <= hoy && (finde || !esFinde(f)))
  const cerrados = delMes.filter(f => ['cerrado', 'enviado'].includes(estadoDia(f))).length
  const porCorregir = informes.filter(r => r.estado === 'cerrado' && r.revision === 'rechazado')
  const porAprobar = informes.filter(r => r.estado === 'cerrado' && r.revision === 'pendiente')
  const faltan = delMes.filter(f => estadoDia(f) === 'falta')
  const pct = delMes.length ? Math.round((cerrados / delMes.length) * 100) : 0
  // racha: días hábiles consecutivos hasta hoy con informe cerrado
  let racha = 0
  for (let f = hoy; racha < 400; f = sumaDias(f, -1)) {
    if (!finde && esFinde(f)) continue
    if (['cerrado', 'enviado'].includes(estadoDia(f))) racha++
    else if (f === hoy) continue
    else break
  }
  const pendientes = venc.filter(v => v.estado === 'Pendiente')
  const proximos = venc.filter(v => v.estado !== 'Pendiente')
  const [verTodosProx, setVerTodosProx] = useState(false)
  const mover = (n: number) => setMes(({ y, m }) => { const t = new Date(y, m + n, 1); return { y: t.getFullYear(), m: t.getMonth() } })
  const puedeCrear = (f: string) => esAutor && f <= hoy && f >= sumaDias(hoy, -plazoDias)

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
            • Cada cuadro es un día. <span style={{ color: '#14532d', fontWeight: 700 }}>✓ verde</span> = aprobado por el Jefe · <span style={{ color: '#5b3aa6', fontWeight: 700 }}>⏳ lila</span> = enviado, esperando aprobación · <span style={{ color: '#b4540a', fontWeight: 700 }}>↩ naranjo</span> = rechazado, hay que corregirlo · <span style={{ color: '#986a00', fontWeight: 700 }}>✎ amarillo</span> = borrador sin cerrar · <span style={{ color: '#9b1c1c', fontWeight: 700 }}>! rojo</span> = falta el informe · <span style={{ color: '#1B4F9C', fontWeight: 700 }}>● azul</span> = hoy.<br />
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
                <span style={{ fontSize: '13px' }}>{r.estado !== 'cerrado' ? '✎ Borrador' : r.revision === 'aprobado' ? '✅ Aprobado' : r.revision === 'rechazado' ? '↩ Rechazado · corregir' : '⏳ Enviado, por aprobar'} {r.datos?.contrato ? <span style={{ color: '#667085' }}>· {r.datos.contrato}</span> : null}</span>
                <button onClick={() => onAbrir(r)} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>{r.estado === 'cerrado' ? (esJefe && r.revision === 'pendiente' ? 'Revisar' : r.revision === 'rechazado' && esAutor ? 'Corregir' : 'Ver informe') : esAutor ? 'Continuar' : 'Ver informe'}</button>
              </div>
            ))}
            {selRs.length === 0 && (
              puedeCrear(sel)
                ? <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}><span style={{ fontSize: '13px', color: '#9b1c1c' }}>{sel === hoy ? 'Aún no hay informe de hoy.' : 'Este día no tiene informe.'}</span><button onClick={() => onNuevo(sel)} style={{ ...btn(), padding: '6px 14px', fontSize: '12.5px' }}>+ Crear informe de este día</button></div>
                : <span style={{ fontSize: '12.5px', color: '#98a2b3' }}>{sel > hoy ? 'Es un día futuro.' : (sel >= sumaDias(hoy, -plazoDias) ? `Sin informe. Aún está dentro del plazo (hasta el ${fcl(sumaDias(sel, plazoDias))}), pero solo el APR autor puede crearlo.` : `Sin informe. Ya pasó el plazo de ${plazoDias} días para crearlo.`)}</span>
            )}
            {selVenc.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#667085' }}>Compromisos que vencen este día</p>
                {selVenc.map((v, i) => <Aviso key={v.informe.id + v.clave} v={v} esAutor={esAutor} onAbrir={onAbrir} onCerrarPlan={onCerrarPlan} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {(pendientes.length > 0 || proximos.length > 0 || faltan.length > 0 || porCorregir.length > 0 || (esJefe && porAprobar.length > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '8px', marginTop: '8px' }}>
          {(faltan.length > 0 || pendientes.length > 0 || porCorregir.length > 0 || (esJefe && porAprobar.length > 0)) && (
            <div style={{ ...card, background: '#fff5f5', borderColor: '#f3b4b4' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' }}>⚠️ Qué necesita atención</p>
              {esJefe && porAprobar.length > 0 && <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: '#5b3aa6' }}>⏳ {porAprobar.length} informe(s) por aprobar: {porAprobar.slice(0, 6).map(r => <button key={r.id} onClick={() => onAbrir(r)} style={{ border: 'none', background: '#efe7fd', color: '#5b3aa6', borderRadius: '20px', padding: '1px 8px', margin: '0 3px 3px 0', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}>{fcl(r.fecha).slice(0, 5)}</button>)}</p>}
              {porCorregir.length > 0 && <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: '#b4540a' }}>↩ {porCorregir.length} informe(s) rechazado(s): {porCorregir.slice(0, 6).map(r => <button key={r.id} onClick={() => onAbrir(r)} style={{ border: 'none', background: '#ffe6d1', color: '#b4540a', borderRadius: '20px', padding: '1px 8px', margin: '0 3px 3px 0', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}>{fcl(r.fecha).slice(0, 5)}</button>)}</p>}
              {faltan.length > 0 && <p style={{ margin: '0 0 6px', fontSize: '12.5px', color: '#9b1c1c' }}>{faltan.length} día(s) sin informe: {faltan.slice(-5).map(f => <button key={f} onClick={() => { setSel(f); const [y, m] = f.split('-').map(Number); setMes({ y, m: m - 1 }) }} style={{ border: 'none', background: '#fde8e8', color: '#9b1c1c', borderRadius: '20px', padding: '1px 8px', margin: '0 3px 3px 0', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}>{fcl(f).slice(0, 5)}</button>)}{faltan.length > 5 ? '…' : ''}</p>}
              {pendientes.slice(0, 5).map(v => <Aviso key={v.informe.id + v.clave} v={v} esAutor={esAutor} onAbrir={onAbrir} onCerrarPlan={onCerrarPlan} />)}
              {pendientes.length > 5 && <p style={{ margin: 0, fontSize: '11.5px', color: '#9b1c1c' }}>… y {pendientes.length - 5} más vencidos</p>}
            </div>
          )}
          {proximos.length > 0 && (
            <div style={card}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>🗓️ Próximos vencimientos <span style={{ fontWeight: 400, color: '#98a2b3', fontSize: '11.5px' }}>· toca uno para ver su informe</span></p>
              {(verTodosProx ? proximos : proximos.slice(0, 5)).map(v => <Aviso key={v.informe.id + v.clave} v={v} esAutor={esAutor} onAbrir={onAbrir} onCerrarPlan={onCerrarPlan} />)}
              {proximos.length > 5 && <button type="button" onClick={() => setVerTodosProx(x => !x)} style={{ ...btn(false), padding: '4px 10px', fontSize: '11.5px' }}>{verTodosProx ? 'Ver menos' : `Ver los ${proximos.length}`}</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

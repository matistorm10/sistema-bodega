'use client'
import { useState, useMemo } from 'react'
import { card, btn } from './ui'
import { ItemSem } from '@/lib/semanalItems'
import { inicioPeriodo, fechaLarga } from '@/lib/semanal'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const dif = (a: string, b: string) => Math.round((new Date(a + 'T00:00').getTime() - new Date(b + 'T00:00').getTime()) / 86400000)

const COL: Record<string, [string, string, string, string]> = {
  entregado: ['#e7f6ec', '#14532d', '✓', 'Entregado a tiempo'], tarde: ['#fef7e0', '#986a00', '✓', 'Entregado con atraso'],
  vigente: ['#e8f0fe', '#1B4F9C', '●', 'En plazo: por entregar'], atraso: ['#fde8e8', '#9b1c1c', '!', 'Atrasado'], proximo: ['#f6f7f9', '#98a2b3', '○', 'Próxima semana'],
}

export default function CalendarioSemanal({ items, puedeSubir, subiendo = '', onSubir, onVer }: {
  items: ItemSem[], puedeSubir: boolean, subiendo?: string, onSubir?: (c: any, fin: string, f: File) => void, onVer: (path: string) => void,
}) {
  const hoy = hoyISO()
  const [h0] = useState(() => { const [y, m] = hoy.split('-').map(Number); return { y, m: m - 1 } })
  const [mes, setMes] = useState(h0)
  const [sel, setSel] = useState<string | null>(hoy)
  const [ayuda, setAyuda] = useState(false)

  const porLimite = useMemo(() => { const m: Record<string, ItemSem[]> = {}; items.forEach(i => { (m[i.limite] = m[i.limite] || []).push(i) }); return m }, [items])
  const porCierre = useMemo(() => { const m: Record<string, ItemSem[]> = {}; items.forEach(i => { (m[i.fin] = m[i.fin] || []).push(i) }); return m }, [items])
  const peor = (rs: ItemSem[]) => (['atraso', 'vigente', 'tarde', 'entregado', 'proximo'] as const).find(t => rs.some(r => r.tipo === t))

  const exigibles = items.filter(i => i.tipo !== 'proximo' && i.tipo !== 'vigente' || i.tipo === 'vigente' && false)
  const cumplidas = items.filter(i => i.tipo === 'entregado' || i.tipo === 'tarde')
  const atrasadas = items.filter(i => i.tipo === 'atraso')
  const vigentes = items.filter(i => i.tipo === 'vigente')
  const aTiempo = items.filter(i => i.tipo === 'entregado').length
  const base = items.filter(i => ['entregado', 'tarde', 'atraso'].includes(i.tipo)).length
  const pct = base ? Math.round((aTiempo / base) * 100) : 100
  let racha = 0
  for (const i of [...items].filter(i => ['entregado', 'tarde', 'atraso'].includes(i.tipo)).reverse()) { if (i.tipo === 'entregado') racha++; else break }
  const prox = [...vigentes, ...items.filter(i => i.tipo === 'proximo')].sort((a, b) => a.limite.localeCompare(b.limite))[0]
  void exigibles; void cumplidas

  const primero = new Date(mes.y, mes.m, 1)
  const offset = (primero.getDay() + 6) % 7
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate()
  const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => iso(mes.y, mes.m, i + 1))]
  while (celdas.length % 7) celdas.push(null)
  const mover = (n: number) => setMes(({ y, m }) => { const t = new Date(y, m + n, 1); return { y: t.getFullYear(), m: t.getMonth() } })

  const kpi = (v: string | number, t: string, col = '#16213E', tip?: string) => (
    <div title={tip} style={{ ...card, padding: '10px 12px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: col }}>{v}</p>
      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#667085' }}>{t}</p>
    </div>
  )
  const fila = (i: ItemSem) => {
    const [bg, fg, ic] = COL[i.tipo]
    const k = i.cliente.id + i.fin
    return (
      <div key={i.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f0f2f6' }}>
        <div style={{ flex: '1 1 200px' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{i.cliente.nombre} <span style={{ fontWeight: 400, color: '#667085' }}>· semana {fechaLarga(inicioPeriodo(i.fin)).slice(0, 5)} al {fechaLarga(i.fin).slice(0, 5)}</span></p>
          <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', background: bg, color: fg, fontWeight: 700 }}>{ic} {i.texto}</span>
          <span style={{ fontSize: '11.5px', color: '#98a2b3', marginLeft: '6px' }}>entrega hasta {fechaLarga(i.limite).slice(0, 5)} {i.hora}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {i.inf && <button onClick={() => onVer(i.inf.path)} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>Ver</button>}
          {puedeSubir && i.tipo !== 'proximo' && onSubir && (
            <label style={{ ...btn(!i.inf), padding: '5px 12px', fontSize: '12px', display: 'inline-block' }}>
              {subiendo === k ? 'Subiendo...' : i.inf ? 'Reemplazar' : 'Subir informe'}
              <input type="file" style={{ display: 'none' }} onChange={ev => { const f = ev.target.files?.[0]; if (f) onSubir(i.cliente, i.fin, f); ev.target.value = '' }} />
            </label>)}
        </div>
      </div>
    )
  }
  const selItems = sel ? [...(porLimite[sel] || []), ...(porCierre[sel] || []).filter(x => x.limite !== sel)] : []

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '8px', marginBottom: '10px' }}>
        {kpi(`${pct}%`, 'Entregados a tiempo', pct >= 90 ? '#1e8e4e' : pct >= 60 ? '#b7791f' : '#c0392b', 'Informes entregados dentro del plazo sobre los que ya vencieron')}
        {kpi(`🔥 ${racha}`, 'Semanas seguidas a tiempo', '#16213E', 'Entregas consecutivas dentro del plazo')}
        {kpi(atrasadas.length, 'Atrasados', atrasadas.length ? '#c0392b' : '#1e8e4e', 'Informes cuyo plazo ya venció y no se han entregado')}
        {kpi(prox ? (dif(prox.limite, hoy) <= 0 ? 'Hoy' : `${dif(prox.limite, hoy)} d`) : '—', prox ? `Próxima entrega · ${prox.cliente.nombre}` : 'Próxima entrega', '#1B4F9C', 'Días que faltan para el próximo plazo')}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => mover(-1)} style={{ ...btn(false), padding: '4px 10px' }}>‹</button>
            <strong style={{ fontSize: '15px', minWidth: '130px', textAlign: 'center' }}>{MESES[mes.m]} {mes.y}</strong>
            <button onClick={() => mover(1)} style={{ ...btn(false), padding: '4px 10px' }}>›</button>
            <button onClick={() => { setMes(h0); setSel(hoy) }} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Hoy</button>
          </div>
          <button onClick={() => setAyuda(v => !v)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>¿Cómo leerlo? {ayuda ? '▲' : '▼'}</button>
        </div>
        {ayuda && (
          <div style={{ background: '#f4f8fd', border: '1px solid #cfe0f5', borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', color: '#344054', marginBottom: '10px', lineHeight: 1.5 }}>
            <strong>Cómo usar este calendario</strong><br />
            • Cada informe semanal se marca en el <b>día límite de entrega</b> (cierre de la semana + plazo del cliente).<br />
            • <span style={{ color: '#14532d', fontWeight: 700 }}>✓ verde</span> = entregado a tiempo · <span style={{ color: '#986a00', fontWeight: 700 }}>✓ amarillo</span> = entregado con atraso · <span style={{ color: '#1B4F9C', fontWeight: 700 }}>● azul</span> = en plazo, por entregar · <span style={{ color: '#9b1c1c', fontWeight: 700 }}>! rojo</span> = atrasado · <span style={{ color: '#98a2b3', fontWeight: 700 }}>○ gris</span> = semana que viene.<br />
            • El puntito gris abajo del número marca el día en que <b>cierra la semana</b> del cliente.<br />
            • Toca un día para ver el detalle{puedeSubir ? ' y subir o reemplazar el informe ahí mismo' : ''}. Si hay varios clientes el día toma el color del más urgente.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {DIAS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#98a2b3', padding: '2px 0' }}>{d}</div>)}
          {celdas.map((f, i) => {
            if (!f) return <div key={i} />
            const lim = porLimite[f] || [], cie = porCierre[f] || []
            const t = peor(lim)
            const [bg, fg, ic] = t ? COL[t] : ['#fff', '#667085', '']
            const activo = sel === f
            return (
              <button key={f} onClick={() => setSel(f)} title={lim.map(x => `${x.cliente.nombre}: ${x.texto}`).join('\n') || fechaLarga(f)}
                style={{ background: bg, color: fg, border: activo ? '2px solid #1B4F9C' : f === hoy ? '2px solid #1B4F9C55' : '1px solid #e8ebf0', borderRadius: '8px', minHeight: '54px', padding: '4px 2px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12.5px', fontWeight: f === hoy ? 800 : 700 }}>{Number(f.slice(8))}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1 }}>{ic}{lim.length > 1 ? <sup style={{ fontSize: '9px' }}>{lim.length}</sup> : null}</span>
                <span style={{ height: '7px' }}>{cie.length > 0 && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#98a2b3' }} />}</span>
              </button>
            )
          })}
        </div>
        {sel && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13.5px' }}>{fechaLarga(sel)}{sel === hoy ? ' · hoy' : ''}</p>
            {selItems.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#98a2b3' }}>Sin entregas ni cierres de semana este día.</p> : selItems.map(fila)}
          </div>
        )}
      </div>

      {(atrasadas.length > 0 || vigentes.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '8px', marginTop: '8px' }}>
          {atrasadas.length > 0 && <div style={{ ...card, background: '#fff5f5', borderColor: '#f3b4b4' }}><p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' }}>⚠️ Atrasados ({atrasadas.length})</p>{atrasadas.slice(-5).reverse().map(fila)}</div>}
          {vigentes.length > 0 && <div style={card}><p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>🗓️ Por entregar ({vigentes.length})</p>{vigentes.slice(0, 5).map(fila)}</div>}
        </div>
      )}
    </div>
  )
}

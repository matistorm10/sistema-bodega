'use client'
import { useState, useMemo } from 'react'
import { card, btn } from './ui'
import { MESES_C } from '@/lib/capacitaciones'
import { TIPOS_CHARLA } from '@/lib/prevencion'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const fechaLarga = (f: string) => { const d = new Date(f + 'T12:00'); return `${DIAS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}` }

export type FilaProg = { p: any, celdas: { m: number, k: string, e: 'ok' | 'parcial' | 'atraso' | 'futuro' | 'actual', hechas: number }[] }
const EST: Record<string, [string, string, string]> = { ok: ['#d7efe0', '#14532d', '✓ Hecha'], parcial: ['#fef7e0', '#986a00', 'Parcial'], atraso: ['#fde8e8', '#9b1c1c', '! Atrasada'], actual: ['#e8f0fb', '#1B4F9C', '● Toca este mes'], futuro: ['#f1f3f7', '#667085', '○ Próximamente'] }

export default function CalendarioCapacitaciones({ charlas, asistCount, filas, puedeEditar, onRegistrar, onVer, onSubirPapel, subiendo }: {
  charlas: any[], asistCount: Record<string, number>, filas: FilaProg[], puedeEditar: boolean,
  onRegistrar: (fecha: string, progId?: string) => void, onVer: (path: string) => void, onSubirPapel: (c: any, f: File) => void, subiendo: string,
}) {
  const hoy = hoyISO()
  const [h0] = useState(() => { const [y, m] = hoy.split('-').map(Number); return { y, m: m - 1 } })
  const [mes, setMes] = useState(h0)
  const [sel, setSel] = useState<string | null>(hoy)
  const [ayuda, setAyuda] = useState(false)
  const porDia = useMemo(() => { const m: Record<string, any[]> = {}; charlas.forEach(c => { (m[c.fecha] = m[c.fecha] || []).push(c) }); return m }, [charlas])
  const primero = new Date(mes.y, mes.m, 1)
  const offset = (primero.getDay() + 6) % 7
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate()
  const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => iso(mes.y, mes.m, i + 1))]
  while (celdas.length % 7) celdas.push(null)
  const mover = (n: number) => setMes(({ y, m }) => { const t = new Date(y, m + n, 1); return { y: t.getFullYear(), m: t.getMonth() } })
  const kMes = `${mes.y}-${String(mes.m + 1).padStart(2, '0')}`
  const tocan = filas.flatMap(f => f.celdas.filter(c => c.k === kMes).map(c => ({ ...c, p: f.p })))
  const delDia = sel ? porDia[sel] || [] : []

  return (
    <div style={{ marginBottom: '14px' }}>
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
            • Cada día con capacitación muestra un número: cuántas hiciste.<br />
            • <b style={{ color: '#14532d' }}>Verde ✓</b> = capacitación con el papel firmado subido · <b style={{ color: '#986a00' }}>Amarillo</b> = capacitación hecha, falta subir el papel firmado.<br />
            • Debajo del calendario ves <b>qué capacitaciones del programa tocan ese mes</b>: toca «Registrar» y se abre el formulario ya con el tema.<br />
            • Toca un día para ver sus capacitaciones{puedeEditar ? ' o registrar una nueva en esa fecha' : ''}.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {DIAS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#98a2b3', padding: '2px 0' }}>{d}</div>)}
          {celdas.map((f, i) => {
            if (!f) return <div key={i} />
            const cs = porDia[f] || []
            const sinPapel = cs.some(c => !c.respaldo_path)
            const [bg, fg] = !cs.length ? ['#fff', '#667085'] : sinPapel ? ['#fef7e0', '#986a00'] : ['#e7f6ec', '#14532d']
            const activo = sel === f
            return (
              <button key={f} onClick={() => setSel(f)} title={cs.map(c => c.tema).join('\n') || fechaLarga(f)}
                style={{ background: bg, color: fg, border: activo ? '2px solid #1B4F9C' : f === hoy ? '2px solid #1B4F9C55' : '1px solid #e8ebf0', borderRadius: '8px', minHeight: '50px', padding: '4px 2px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
                <span style={{ fontSize: '12.5px', fontWeight: f === hoy ? 800 : 700 }}>{Number(f.slice(8))}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1 }}>{cs.length ? (sinPapel ? (cs.length > 1 ? String(cs.length) : '●') : `✓${cs.length > 1 ? cs.length : ''}`) : ''}</span>
                <span style={{ height: '4px' }} />
              </button>
            )
          })}
        </div>
        {sel && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px' }}>{fechaLarga(sel)}{sel === hoy ? ' · hoy' : ''}</p>
              {puedeEditar && sel <= hoy && <button onClick={() => onRegistrar(sel)} style={{ ...btn(), padding: '5px 12px', fontSize: '12px' }}>＋ Registrar capacitación este día</button>}
            </div>
            {delDia.length === 0 && <p style={{ margin: 0, fontSize: '12.5px', color: '#98a2b3' }}>Sin capacitaciones este día.</p>}
            {delDia.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f0f2f6' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{c.tema}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '11.5px', color: '#667085' }}>{TIPOS_CHARLA[c.tipo] || c.tipo} · {asistCount[c.id] || 0} asistente(s)
                    {' '}<span style={{ fontWeight: 700, padding: '1px 8px', borderRadius: '20px', background: c.respaldo_path ? '#e7f6ec' : '#fef7e0', color: c.respaldo_path ? '#14532d' : '#986a00' }}>{c.respaldo_path ? '✓ papel firmado' : 'falta papel firmado'}</span></p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {c.respaldo_path && <button onClick={() => onVer(c.respaldo_path)} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>Ver papel</button>}
                  {puedeEditar && (
                    <label style={{ ...btn(!c.respaldo_path), padding: '5px 12px', fontSize: '12px', display: 'inline-block' }}>
                      {subiendo === c.id ? 'Subiendo...' : c.respaldo_path ? 'Reemplazar' : '📎 Subir papel firmado'}
                      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={ev => { const f = ev.target.files?.[0]; if (f) onSubirPapel(c, f); ev.target.value = '' }} />
                    </label>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, marginTop: '8px' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>🗓️ Capacitaciones del programa en {MESES[mes.m].toLowerCase()}</p>
        {tocan.length === 0 && <p style={{ margin: 0, fontSize: '12.5px', color: '#98a2b3' }}>No hay capacitaciones programadas este mes.</p>}
        {tocan.map(x => {
          const [bg, fg, tx] = EST[x.e]
          return (
            <div key={x.p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f0f2f6' }}>
              <span style={{ fontSize: '12.5px', color: '#344054', flex: '1 1 220px' }}>{x.p.n}. {x.p.tematica}</span>
              <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', background: bg, color: fg, fontWeight: 700 }}>{tx}</span>
              {puedeEditar && x.hechas === 0 && x.e !== 'futuro' && <button onClick={() => onRegistrar(hoy, x.p.id)} style={{ ...btn(), padding: '4px 12px', fontSize: '12px' }}>Registrar</button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
void MESES_C

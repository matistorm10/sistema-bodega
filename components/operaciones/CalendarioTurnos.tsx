'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { btn, input, label } from '@/components/programa/ui'
import { hoyISO, sumarDias, fechaCorta, marcarDia, msgError, AEROLINEAS, type Asig, type Turno, type Vuelo } from '@/lib/operaciones'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const CAB = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const vacioV = { tipo: '', medio: 'vuelo', aerolinea: '', hora: '', reserva: '', notas: '' }

export default function CalendarioTurnos({ trabId, turnos, asigs, vuelos, onCambio }: { trabId: string, turnos: Turno[], asigs: Asig[], vuelos: Vuelo[], onCambio: () => void }) {
  const hoy = hoyISO()
  const [ini, setIni] = useState(hoy.slice(0, 7) + '-01')
  const [modo, setModo] = useState<'turno' | 'vuelo'>('turno')
  const [dia, setDia] = useState<string | null>(null)
  const [fv, setFv] = useState({ ...vacioV })
  const [msg, setMsg] = useState(''); const [ocupado, setOcupado] = useState(false)

  const enTurno = (d: string) => turnos.some(x => x.sube <= d && (!x.baja || x.baja >= d))
  const conContrato = (d: string) => asigs.some(a => a.desde <= d && (!a.hasta || a.hasta >= d))
  const vuelosDe = (d: string) => vuelos.filter(v => v.fecha === d)
  const moverMes = (n: number) => { const d = new Date(ini + 'T12:00:00'); d.setMonth(d.getMonth() + n); setIni(d.toISOString().slice(0, 7) + '-01') }

  const clic = async (d: string) => {
    setMsg('')
    if (modo === 'vuelo') { setDia(d); setFv({ ...vacioV }); return }
    if (ocupado) return
    setOcupado(true); const e = await marcarDia(turnos, trabId, d, !enTurno(d)); setOcupado(false)
    if (e) setMsg(e); else onCambio()
  }
  const guardarVuelo = async () => {
    if (!dia) return
    const { error } = await supabase.from('op_vuelos').insert({ trabajador_id: trabId, fecha: dia, tipo: fv.tipo || null, medio: fv.medio, aerolinea: fv.medio === 'vuelo' ? (fv.aerolinea || null) : null, hora: fv.hora || null, reserva: fv.reserva || null, notas: fv.notas || null })
    if (error) { setMsg(msgError(error)); return }
    setFv({ ...vacioV }); setMsg(''); onCambio()
  }
  const borrarVuelo = async (v: Vuelo) => { if (!confirm('¿Eliminar este vuelo/bus?')) return; const { error } = await supabase.from('op_vuelos').delete().eq('id', v.id); if (error) setMsg(msgError(error)); else onCambio() }

  const mes = (m0: string) => {
    const primero = new Date(m0 + 'T12:00:00'); const offset = (primero.getDay() + 6) % 7
    const n = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate()
    const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: n }, (_, i) => sumarDias(m0, i))]
    return (
      <div style={{ flex: '1 1 260px', minWidth: '250px' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>{MESES[primero.getMonth()]} {primero.getFullYear()}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {CAB.map((c, i) => <div key={i} style={{ textAlign: 'center', fontSize: '10px', color: '#98a2b3' }}>{c}</div>)}
          {celdas.map((d, i) => {
            if (!d) return <div key={i} />
            const vs = vuelosDe(d), en = enTurno(d), cc = conContrato(d), sel = dia === d && modo === 'vuelo'
            const bg = vs.length ? '#f59e0b' : en ? '#1e8e4e' : cc ? '#fff' : '#eef1f6'
            const col = vs.length || en ? '#fff' : '#475467'
            return (
              <button key={i} onClick={() => clic(d)} title={vs.map(v => `${v.tipo || 'vuelo'} ${v.medio === 'bus' ? 'bus' : v.aerolinea || ''} ${v.hora || ''}`.trim()).join(' / ') || (en ? 'En faena' : cc ? 'Descanso' : 'Sin contrato')}
                style={{ position: 'relative', height: '38px', borderRadius: '6px', border: sel ? `2px solid ${AZUL}` : d === hoy ? '2px solid #16213E' : vs.length && en ? '3px solid #14532d' : '1px solid #e2e6ed', boxShadow: vs.length && en ? '0 0 0 2px #86efac' : undefined, background: bg, color: col, cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0, lineHeight: 1.1 }}>
                {Number(d.slice(8))}
                {vs.length > 0 && <div style={{ fontSize: '10px' }}>{vs[0].medio === 'bus' ? '🚌' : '✈'}{vs[0].tipo === 'subida' ? '↑' : vs[0].tipo === 'bajada' ? '↓' : ''}</div>}
                {vs.length > 0 && en && <span style={{ position: 'absolute', left: 2, right: 2, bottom: 1, height: '3px', borderRadius: '2px', background: '#1e8e4e' }} />}
              </button>)
          })}
        </div>
      </div>
    )
  }
  const sig = new Date(ini + 'T12:00:00'); sig.setMonth(sig.getMonth() + 1)
  const dv = dia ? vuelosDe(dia) : []
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <button onClick={() => moverMes(-1)} style={{ ...btn(false), padding: '6px 12px' }}>←</button>
        <button onClick={() => setIni(hoy.slice(0, 7) + '-01')} style={{ ...btn(false), padding: '6px 12px' }}>Hoy</button>
        <button onClick={() => moverMes(1)} style={{ ...btn(false), padding: '6px 12px' }}>→</button>
        <div style={{ display: 'flex', border: '1px solid #d0d5dd', borderRadius: '8px', overflow: 'hidden', marginLeft: 'auto' }}>
          {([['turno', 'Marcar turno'], ['vuelo', 'Vuelos']] as const).map(([k, t]) => <button key={k} onClick={() => setModo(k)} style={{ padding: '6px 12px', fontSize: '12.5px', border: 'none', cursor: 'pointer', background: modo === k ? AZUL : '#fff', color: modo === k ? '#fff' : '#475467', fontWeight: 600 }}>{t}</button>)}
        </div>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>
        {modo === 'turno' ? 'Haz clic en un día para marcarlo o desmarcarlo como «en faena». ' : 'Haz clic en un día para agregar o ver su vuelo/bus. '}
        <span style={{ background: '#1e8e4e', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>verde</span> en faena · <span style={{ background: '#f59e0b', color: '#fff', padding: '0 6px', borderRadius: '4px' }}>naranja ✈</span> día con vuelo/bus · <span style={{ background: '#eef1f6', padding: '0 6px', borderRadius: '4px' }}>gris</span> sin contrato
      </p>
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>{mes(ini)}{mes(sig.toISOString().slice(0, 7) + '-01')}</div>
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
      {modo === 'vuelo' && dia && (
        <div style={{ marginTop: '12px', background: '#fff8e5', border: '1px solid #f3d9a4', borderRadius: '10px', padding: '12px' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px' }}>Vuelos / buses del {fechaCorta(dia)}</p>
          {dv.length === 0 && <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#667085' }}>Sin vuelos ese día.</p>}
          {dv.map(v => (
            <div key={v.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12.5px', padding: '4px 0' }}>
              <span>{v.medio === 'bus' ? '🚌' : '✈'} <strong>{v.tipo || 'sin tipo'}</strong> · {v.medio === 'bus' ? 'Bus' : v.aerolinea || '—'} · {v.hora || 'sin hora'}{v.reserva ? ` · reserva ${v.reserva}` : ''}{v.notas ? ` · ${v.notas}` : ''}</span>
              <button onClick={() => borrarVuelo(v)} style={{ ...btn(false, true), padding: '2px 8px', fontSize: '11px', marginLeft: 'auto' }}>Eliminar</button>
            </div>))}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '8px' }}>
            <div><label style={label}>Tipo</label><select value={fv.tipo} onChange={e => setFv({ ...fv, tipo: e.target.value })} style={{ ...input, width: '110px' }}><option value="">—</option><option value="subida">Subida</option><option value="bajada">Bajada</option></select></div>
            <div><label style={label}>Medio</label><select value={fv.medio} onChange={e => setFv({ ...fv, medio: e.target.value })} style={{ ...input, width: '100px' }}><option value="vuelo">Vuelo</option><option value="bus">Bus</option></select></div>
            {fv.medio === 'vuelo' && <div><label style={label}>Aerolínea</label><select value={fv.aerolinea} onChange={e => setFv({ ...fv, aerolinea: e.target.value })} style={{ ...input, width: '120px' }}><option value="">—</option>{AEROLINEAS.map(a => <option key={a}>{a}</option>)}</select></div>}
            <div><label style={label}>Hora</label><input value={fv.hora} onChange={e => setFv({ ...fv, hora: e.target.value })} placeholder="08:27 - 10:48" style={{ ...input, width: '140px' }} /></div>
            <div><label style={label}>Reserva</label><input value={fv.reserva} onChange={e => setFv({ ...fv, reserva: e.target.value })} style={{ ...input, width: '100px' }} /></div>
            <div style={{ flex: '1 1 140px' }}><label style={label}>Notas</label><input value={fv.notas} onChange={e => setFv({ ...fv, notas: e.target.value })} style={input} /></div>
            <button onClick={guardarVuelo} style={btn()}>Agregar</button>
          </div>
        </div>
      )}
    </div>
  )
}

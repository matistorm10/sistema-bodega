'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { btn, input, label } from '@/components/programa/ui'
import { fechaCorta, msgError, AEROLINEAS, type Vuelo } from '@/lib/operaciones'

const vacioV = { tipo: '', medio: 'vuelo', aerolinea: '', hora: '', reserva: '', notas: '' }
// Vuelos/buses de un trabajador en un día: lista + formulario para agregar
export default function PanelVuelos({ trabId, dia, vuelos, onCambio }: { trabId: string, dia: string, vuelos: Vuelo[], onCambio: () => void }) {
  const [fv, setFv] = useState({ ...vacioV }); const [msg, setMsg] = useState('')
  const dv = vuelos
  const guardarVuelo = async () => {
    const { error } = await supabase.from('op_vuelos').insert({ trabajador_id: trabId, fecha: dia, tipo: fv.tipo || null, medio: fv.medio, aerolinea: fv.medio === 'vuelo' ? (fv.aerolinea || null) : null, hora: fv.hora || null, reserva: fv.reserva || null, notas: fv.notas || null })
    if (error) { setMsg(msgError(error)); return }
    setFv({ ...vacioV }); setMsg(''); onCambio()
  }
  const borrarVuelo = async (v: Vuelo) => { if (!confirm('¿Eliminar este vuelo/bus?')) return; const { error } = await supabase.from('op_vuelos').delete().eq('id', v.id); if (error) setMsg(msgError(error)); else onCambio() }
  return (
    <div>
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
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
    </div>
  )
}

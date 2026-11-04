'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { btn, input, label } from '@/components/programa/ui'
import { fechaCorta, msgError, AEROLINEAS, LUGARES, type Vuelo } from '@/lib/operaciones'

const vacioV = { tipo: '', medio: 'vuelo', aerolinea: '', origen: '', destino: '', hora_salida: '', hora_llegada: '', reserva: '', notas: '' }
const desde = (v: Vuelo) => ({ tipo: v.tipo || '', medio: v.medio || 'vuelo', aerolinea: v.aerolinea || '', origen: v.origen || '', destino: v.destino || '', hora_salida: v.hora_salida || '', hora_llegada: v.hora_llegada || '', reserva: v.reserva || '', notas: v.notas || '' })

// Vuelo/bus de un trabajador en un día: solo uno por día. Si existe se edita; si no, se crea. Todos los campos son obligatorios (salvo notas).
export default function PanelVuelos({ trabId, dia, vuelos, onCambio }: { trabId: string, dia: string, vuelos: Vuelo[], onCambio: () => void }) {
  const existente = vuelos[0] || null
  const [f, setF] = useState(existente ? desde(existente) : { ...vacioV })
  const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false)
  useEffect(() => { setF(existente ? desde(existente) : { ...vacioV }) }, [existente?.id, dia, trabId]) // eslint-disable-line react-hooks/exhaustive-deps
  const esVuelo = f.medio === 'vuelo'
  const faltan = [
    !f.tipo && 'tipo', !f.origen && 'origen', !f.destino && 'destino', !f.hora_salida && 'hora de salida', !f.hora_llegada && 'hora de llegada',
    esVuelo && !f.aerolinea && 'aerolínea', esVuelo && !f.reserva.trim() && 'reserva',
  ].filter(Boolean) as string[]
  const guardar = async () => {
    setOk(false)
    if (faltan.length) { setMsg('Falta completar: ' + faltan.join(', ') + '.'); return }
    if (f.origen === f.destino) { setMsg('El origen y el destino no pueden ser iguales.'); return }
    const fila = { tipo: f.tipo, medio: f.medio, aerolinea: esVuelo ? f.aerolinea : null, origen: f.origen, destino: f.destino, hora_salida: f.hora_salida, hora_llegada: f.hora_llegada, reserva: esVuelo ? f.reserva.trim() : (f.reserva.trim() || null), notas: f.notas.trim() || null }
    const { error } = existente
      ? await supabase.from('op_vuelos').update(fila).eq('id', existente.id)
      : await supabase.from('op_vuelos').insert({ ...fila, trabajador_id: trabId, fecha: dia })
    if (error) { setMsg(msgError(error)); return }
    setMsg(''); setOk(true); onCambio()
  }
  const borrar = async () => { if (!existente || !confirm('¿Eliminar este vuelo/bus?')) return; const { error } = await supabase.from('op_vuelos').delete().eq('id', existente.id); if (error) setMsg(msgError(error)); else onCambio() }
  const lugar = (v: string, k: 'origen' | 'destino') => <select value={v} onChange={e => setF({ ...f, [k]: e.target.value })} style={input}><option value="">— elegir —</option>{v && !LUGARES.includes(v) && <option>{v}</option>}{LUGARES.map(l => <option key={l}>{l}</option>)}</select>
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px' }}>{existente ? 'Editar' : 'Agregar'} vuelo / bus del {fechaCorta(dia)}</p>
      {vuelos.length > 1 && <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#b7791f' }}>Este día tiene {vuelos.length} registros (de la carga inicial). Se edita el primero; deja solo uno.</p>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Tipo *</label><select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} style={input}><option value="">—</option><option value="subida">Subida</option><option value="bajada">Bajada</option></select></div>
        <div style={{ flex: '1 1 100px' }}><label style={label}>Medio *</label><select value={f.medio} onChange={e => setF({ ...f, medio: e.target.value })} style={input}><option value="vuelo">Vuelo</option><option value="bus">Bus</option></select></div>
        {esVuelo && <div style={{ flex: '1 1 120px' }}><label style={label}>Aerolínea *</label><select value={f.aerolinea} onChange={e => setF({ ...f, aerolinea: e.target.value })} style={input}><option value="">—</option>{AEROLINEAS.map(a => <option key={a}>{a}</option>)}</select></div>}
        <div style={{ flex: '1 1 140px' }}><label style={label}>Origen *</label>{lugar(f.origen, 'origen')}</div>
        <div style={{ flex: '1 1 140px' }}><label style={label}>Destino *</label>{lugar(f.destino, 'destino')}</div>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Hora salida *</label><input type="time" value={f.hora_salida} onChange={e => setF({ ...f, hora_salida: e.target.value })} style={input} /></div>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Hora llegada *</label><input type="time" value={f.hora_llegada} onChange={e => setF({ ...f, hora_llegada: e.target.value })} style={input} /></div>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Reserva{esVuelo ? ' *' : ''}</label><input value={f.reserva} onChange={e => setF({ ...f, reserva: e.target.value })} style={input} /></div>
        <div style={{ flex: '2 1 200px' }}><label style={label}>Notas (opcional)</label><input value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} style={input} /></div>
      </div>
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
      {ok && <p style={{ fontSize: '12.5px', color: '#1e8e4e', margin: '8px 0 0' }}>Guardado ✓</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button onClick={guardar} disabled={faltan.length > 0} style={{ ...btn(), opacity: faltan.length ? 0.5 : 1, cursor: faltan.length ? 'not-allowed' : 'pointer' }}>{existente ? 'Guardar cambios' : 'Guardar vuelo'}</button>
        {existente && <button onClick={borrar} style={btn(false, true)}>Eliminar</button>}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { btn, input, label } from '@/components/programa/ui'
import { useCiudades } from './useCiudades'
import Hora24 from './Hora24'
import { formatearRut } from '@/lib/rut'
import { fechaCorta, msgError, AEROLINEAS, LUGARES, ESTADOS_VUELO, type Vuelo } from '@/lib/operaciones'

const vacioV = { estado: 'por_comprar', tipo: '', medio: 'vuelo', aerolinea: '', origen: '', destino: '', hora_salida: '', hora_llegada: '', reserva: '', notas: '' }
const desde = (v: Vuelo) => ({ estado: v.estado || 'comprado', tipo: v.tipo || '', medio: v.medio || 'vuelo', aerolinea: v.aerolinea || '', origen: v.origen || '', destino: v.destino || '', hora_salida: v.hora_salida || '', hora_llegada: v.hora_llegada || '', reserva: v.reserva || '', notas: v.notas || '' })

// Vuelo/bus de un trabajador en un día: solo uno por día. Si existe se edita; si no, se crea. «Por comprar» solo pide el tipo; «Comprado» exige todos los datos (salvo notas).
export default function PanelVuelos({ trabId, dia, vuelos, onCambio, trabajador }: { trabId: string, dia: string, vuelos: Vuelo[], onCambio: () => void, trabajador?: { id?: string, nombre?: string | null, rut?: string | null, fecha_nacimiento?: string | null, ciudad?: string | null, examenes?: string | null } }) {
  const { aeropuertoDe } = useCiudades()
  const existente = vuelos[0] || null
  const [f, setF] = useState(existente ? desde(existente) : { ...vacioV })
  const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false)
  useEffect(() => { setF(existente ? desde(existente) : { ...vacioV }) }, [existente?.id, dia, trabId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [copiado, setCopiado] = useState('')
  const copiar = async (k: string, v: string) => { try { await navigator.clipboard.writeText(v); setCopiado(k); setTimeout(() => setCopiado(''), 1500) } catch { /* sin permiso de portapapeles */ } }
  const esVuelo = f.medio === 'vuelo'
  const porComprar = f.estado === 'por_comprar'
  const faltan = porComprar ? [!f.tipo && 'tipo'].filter(Boolean) as string[] : [
    !f.tipo && 'tipo', !f.origen && 'origen', !f.destino && 'destino', !f.hora_salida && 'hora de salida', !f.hora_llegada && 'hora de llegada',
    esVuelo && !f.aerolinea && 'aerolínea', esVuelo && !f.reserva.trim() && 'reserva',
  ].filter(Boolean) as string[]
  const aeropuerto = aeropuertoDe(trabajador?.ciudad)
  // Al elegir subida/bajada, propone el aeropuerto de origen del trabajador en el lado que corresponde (si ese campo está vacío)
  const cambiarTipo = (tipo: string) => {
    const n = { ...f, tipo }
    if (aeropuerto) { if (tipo === 'subida' && !f.origen) n.origen = aeropuerto; if (tipo === 'bajada' && !f.destino) n.destino = aeropuerto }
    setF(n)
  }
  const guardar = async () => {
    setOk(false)
    if (faltan.length) { setMsg('Falta completar: ' + faltan.join(', ') + '.'); return }
    if (f.origen && f.origen === f.destino) { setMsg('El origen y el destino no pueden ser iguales.'); return }
    const fila = { estado: f.estado, tipo: f.tipo, medio: f.medio, aerolinea: esVuelo ? (f.aerolinea || null) : null, origen: f.origen || null, destino: f.destino || null, hora_salida: f.hora_salida || null, hora_llegada: f.hora_llegada || null, reserva: f.reserva.trim() || null, notas: f.notas.trim() || null }
    const { error } = existente
      ? await supabase.from('op_vuelos').update(fila).eq('id', existente.id)
      : await supabase.from('op_vuelos').insert({ ...fila, trabajador_id: trabId, fecha: dia })
    if (error) { setMsg(msgError(error)); return }
    setMsg(''); setOk(true); onCambio()
  }
  const borrar = async () => { if (!existente || !confirm('¿Eliminar este vuelo/bus?')) return; const { error } = await supabase.from('op_vuelos').delete().eq('id', existente.id); if (error) setMsg(msgError(error)); else onCambio() }
  const lugar = (v: string, k: 'origen' | 'destino') => <select value={v} onChange={e => setF({ ...f, [k]: e.target.value })} style={input}><option value="">— elegir —</option>{v && !LUGARES.includes(v) && <option>{v}</option>}{LUGARES.map(l => <option key={l}>{l}</option>)}</select>
  if (trabajador && trabajador.examenes && trabajador.examenes !== 'aprobado') return <p style={{ margin: 0, fontSize: '13px', color: '#b7791f' }}>Los pasajes se habilitan cuando los exámenes del trabajador estén aprobados (hoy: {trabajador.examenes}). Cámbialo en su ficha.</p>
  return (
    <div>
      {trabajador && (() => {
        const rut = trabajador.rut ? formatearRut(trabajador.rut) : ''
        const nac = trabajador.fecha_nacimiento ? fechaCorta(trabajador.fecha_nacimiento).replace(/-/g, '/') : ''
        const dato = (k: string, t: string, v: string) => (
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', color: '#667085', textTransform: 'uppercase', letterSpacing: '.03em' }}>{t}</div>
            {v ? <button type="button" onClick={() => copiar(k, v)} title="Clic para copiar" style={{ all: 'unset', cursor: 'copy', fontSize: '13.5px', fontWeight: 700, color: '#16213E', wordBreak: 'break-word' }}>{v} <span style={{ fontSize: '11px', fontWeight: 600, color: copiado === k ? '#1e8e4e' : '#1B4F9C' }}>{copiado === k ? '✓ copiado' : '📋'}</span></button>
              : <span style={{ fontSize: '13px', color: '#c5221f', fontWeight: 600 }}>Falta — complétalo en la ficha</span>}
          </div>)
        return (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', background: '#f4f8fd', border: '1px solid #cfe0f5', borderRadius: '10px', padding: '9px 12px', margin: '0 0 10px' }}>
            {dato('n', 'Nombre completo', trabajador.nombre || '')}
            {dato('r', 'RUT', rut)}
            {dato('f', 'Fecha de nacimiento', nac)}
          </div>)
      })()}
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px' }}>{existente ? 'Editar' : 'Agregar'} vuelo / bus del {fechaCorta(dia)}</p>
      {vuelos.length > 1 && <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#b7791f' }}>Este día tiene {vuelos.length} registros (de la carga inicial). Se edita el primero; deja solo uno.</p>}
      <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#475467' }}>Origen: <strong>{trabajador?.ciudad || 'sin ciudad definida'}</strong>{aeropuerto ? ` · aeropuerto ${aeropuerto}` : ''}</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 130px' }}><label style={label}>Estado *</label><select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={{ ...input, fontWeight: 700, background: porComprar ? '#fde2e1' : '#e6f4ea' }}>{Object.entries(ESTADOS_VUELO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Tipo *</label><select value={f.tipo} onChange={e => cambiarTipo(e.target.value)} style={input}><option value="">—</option><option value="subida">Subida</option><option value="bajada">Bajada</option></select></div>
        <div style={{ flex: '1 1 100px' }}><label style={label}>Medio *</label><select value={f.medio} onChange={e => setF({ ...f, medio: e.target.value })} style={input}><option value="vuelo">Vuelo</option><option value="bus">Bus</option></select></div>
        {esVuelo && <div style={{ flex: '1 1 120px' }}><label style={label}>Aerolínea{porComprar ? '' : ' *'}</label><select value={f.aerolinea} onChange={e => setF({ ...f, aerolinea: e.target.value })} style={input}><option value="">—</option>{AEROLINEAS.map(a => <option key={a}>{a}</option>)}</select></div>}
        <div style={{ flex: '1 1 140px' }}><label style={label}>Origen{porComprar ? '' : ' *'}</label>{lugar(f.origen, 'origen')}</div>
        <div style={{ flex: '1 1 140px' }}><label style={label}>Destino{porComprar ? '' : ' *'}</label>{lugar(f.destino, 'destino')}</div>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Hora salida{porComprar ? '' : ' *'}</label><Hora24 value={f.hora_salida} onChange={v => setF(x => ({ ...x, hora_salida: v }))} /></div>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Hora llegada{porComprar ? '' : ' *'}</label><Hora24 value={f.hora_llegada} onChange={v => setF(x => ({ ...x, hora_llegada: v }))} /></div>
        <div style={{ flex: '1 1 110px' }}><label style={label}>Reserva{esVuelo && !porComprar ? ' *' : ''}</label><input value={f.reserva} onChange={e => setF({ ...f, reserva: e.target.value })} style={input} /></div>
        <div style={{ flex: '2 1 200px' }}><label style={label}>Notas (opcional)</label><input value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} style={input} /></div>
      </div>
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
      {ok && <p style={{ fontSize: '12.5px', color: '#1e8e4e', margin: '8px 0 0' }}>Guardado ✓</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button onClick={guardar} disabled={faltan.length > 0} style={{ ...btn(), opacity: faltan.length ? 0.5 : 1, cursor: faltan.length ? 'not-allowed' : 'pointer' }}>{existente ? 'Guardar cambios' : porComprar ? 'Guardar como por comprar' : 'Guardar vuelo'}</button>
        {existente && <button onClick={borrar} style={btn(false, true)}>Eliminar</button>}
      </div>
    </div>
  )
}

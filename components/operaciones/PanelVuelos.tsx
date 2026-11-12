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
  // Otros trabajadores con un pasaje «por comprar» ese mismo día: se pueden marcar para guardar la misma compra a todos de una vez
  const [otros, setOtros] = useState<{ id: string, trabajador_id: string, tipo: string | null, nombre: string, rut: string | null }[]>([])
  const [sel, setSel] = useState<string[]>([])
  useEffect(() => {
    let vivo = true; setSel([])
    supabase.from('op_vuelos').select('id,trabajador_id,tipo,trabajador:op_trabajadores(nombre,rut,examenes,activo)').eq('fecha', dia).eq('estado', 'por_comprar').neq('trabajador_id', trabId).then(({ data }) => {
      if (!vivo) return
      setOtros(((data as any[]) || []).filter(x => x.trabajador?.activo !== false && (!x.trabajador?.examenes || x.trabajador.examenes === 'aprobado')).map(x => ({ id: x.id, trabajador_id: x.trabajador_id, tipo: x.tipo, nombre: x.trabajador?.nombre || '—', rut: x.trabajador?.rut || null })).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    })
    return () => { vivo = false }
  }, [dia, trabId, existente?.id])
  const visibles = otros.filter(o => !f.tipo || !o.tipo || o.tipo === f.tipo)
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
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    if (guardando) return
    setOk(false)
    if (faltan.length) { setMsg('Falta completar: ' + faltan.join(', ') + '.'); return }
    if (f.origen && f.origen === f.destino) { setMsg('El origen y el destino no pueden ser iguales.'); return }
    const fila = { estado: f.estado, tipo: f.tipo, medio: f.medio, aerolinea: esVuelo ? (f.aerolinea || null) : null, origen: f.origen || null, destino: f.destino || null, hora_salida: f.hora_salida || null, hora_llegada: f.hora_llegada || null, reserva: f.reserva.trim() || null, notas: f.notas.trim() || null }
    setGuardando(true)
    try {
    // Solo un pasaje por trabajador y día: si ya existe en la base (aunque esta pantalla no se haya refrescado), se actualiza en vez de duplicar
    let idExistente = existente?.id
    if (!idExistente) { const { data: ya } = await supabase.from('op_vuelos').select('id').eq('trabajador_id', trabId).eq('fecha', dia).limit(1); idExistente = ya?.[0]?.id }
    const { error } = idExistente
      ? await supabase.from('op_vuelos').update(fila).eq('id', idExistente)
      : await supabase.from('op_vuelos').insert({ ...fila, trabajador_id: trabId, fecha: dia })
    if (error) { setMsg(msgError(error)); return }
    const extra = visibles.filter(o => sel.includes(o.id))
    if (extra.length) {
      const { error: e2 } = await supabase.from('op_vuelos').update(fila).in('id', extra.map(o => o.id))
      if (e2) { setMsg('Se guardó este pasaje, pero no se pudo aplicar a los otros seleccionados: ' + msgError(e2)); onCambio(); return }
    }
    setMsg(''); setOk(true); setSel([]); onCambio()
    } finally { setGuardando(false) }
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
      {visibles.length > 0 && (
        <div style={{ marginTop: '10px', background: '#f8fafc', border: '1px solid #e2e6ed', borderRadius: '10px', padding: '8px 12px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: '#16213E' }}>Misma compra para otros ({sel.length} marcados) <span style={{ fontWeight: 400, color: '#667085' }}>· pasajes «por comprar» del {fechaCorta(dia)}; al guardar se les aplican los mismos datos</span></p>
          <div style={{ display: 'flex', gap: '4px 16px', flexWrap: 'wrap' }}>
            {visibles.map(o => <label key={o.id} style={{ fontSize: '12.5px', display: 'flex', gap: '5px', alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={sel.includes(o.id)} onChange={e => setSel(x => e.target.checked ? [...x, o.id] : x.filter(y => y !== o.id))} />{o.nombre}{o.tipo ? <span style={{ color: '#98a2b3', fontSize: '11px' }}> · {o.tipo}</span> : null}</label>)}
          </div>
          <button type="button" onClick={() => setSel(sel.length === visibles.length ? [] : visibles.map(o => o.id))} style={{ ...btn(false), padding: '3px 10px', fontSize: '11.5px', marginTop: '6px' }}>{sel.length === visibles.length ? 'Quitar todos' : 'Marcar todos'}</button>
        </div>)}
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
      {ok && <p style={{ fontSize: '12.5px', color: '#1e8e4e', margin: '8px 0 0' }}>Guardado ✓</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button onClick={guardar} disabled={faltan.length > 0 || guardando} style={{ ...btn(), opacity: faltan.length ? 0.5 : 1, cursor: faltan.length ? 'not-allowed' : 'pointer' }}>{existente ? 'Guardar cambios' : porComprar ? 'Guardar como por comprar' : 'Guardar vuelo'}{sel.length ? ` (+${sel.length})` : ''}</button>
        {existente && <button onClick={borrar} style={btn(false, true)}>Eliminar</button>}
      </div>
    </div>
  )
}

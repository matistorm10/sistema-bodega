'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { btn, input } from '@/components/programa/ui'
import { LUGARES, msgError } from '@/lib/operaciones'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import type { Ciudad } from './useCiudades'

// Lista de ciudades (A-Z) con opción "Agregar ciudad" solo para el administrador
export default function CiudadSelect({ value, onChange, ciudades, recargar }: { value: string, onChange: (v: string) => void, ciudades: Ciudad[], recargar: () => void }) {
  const { usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(''); const [aero, setAero] = useState(''); const [msg, setMsg] = useState('')
  const nombres = ciudades.map(c => c.nombre)
  const agregar = async () => {
    const n = nombre.trim().replace(/\s+/g, ' ')
    if (!n) { setMsg('Escribe el nombre de la ciudad.'); return }
    if (nombres.some(x => x.toLowerCase() === n.toLowerCase())) { setMsg('Esa ciudad ya existe.'); return }
    const { error } = await supabase.from('op_ciudades').insert({ nombre: n, aeropuerto: aero || null })
    if (error) { setMsg(msgError(error)); return }
    await recargar(); onChange(n); setNombre(''); setAero(''); setMsg(''); setAbierto(false)
  }
  return (
    <div>
      <select value={value || ''} onChange={e => { if (e.target.value === '__nueva') setAbierto(true); else onChange(e.target.value) }} style={input}>
        <option value="">—</option>
        {value && !nombres.includes(value) && <option>{value}</option>}
        {nombres.map(o => <option key={o}>{o}</option>)}
        {esAdmin && <option value="__nueva">➕ Agregar ciudad…</option>}
      </select>
      {abierto && esAdmin && (
        <div style={{ marginTop: '6px', padding: '8px', border: '1px solid #d0d5dd', borderRadius: '8px', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de la ciudad" style={input} autoFocus />
          <select value={aero} onChange={e => setAero(e.target.value)} style={input}><option value="">Aeropuerto para pasajes (opcional)</option>{LUGARES.map(l => <option key={l}>{l}</option>)}</select>
          {msg && <span style={{ fontSize: '12px', color: '#c5221f' }}>{msg}</span>}
          <div style={{ display: 'flex', gap: '6px' }}><button type="button" onClick={agregar} style={{ ...btn(), padding: '5px 12px', fontSize: '12px' }}>Agregar</button><button type="button" onClick={() => { setAbierto(false); setMsg('') }} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>Cancelar</button></div>
        </div>
      )}
    </div>
  )
}

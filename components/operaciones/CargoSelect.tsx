'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { btn, input } from '@/components/programa/ui'
import { msgError } from '@/lib/operaciones'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

// Cargos (tabla op_cargos), ordenados A-Z
export function useCargos() {
  const [cargos, setCargos] = useState<string[]>([])
  const recargar = useCallback(async () => {
    const { data } = await supabase.from('op_cargos').select('nombre')
    setCargos(((data || []) as { nombre: string }[]).map(x => x.nombre).sort((a, b) => a.localeCompare(b, 'es')))
  }, [])
  useEffect(() => { recargar() }, [recargar])
  return { cargos, recargar }
}

// Texto a formato "Nombre Propio" (primera letra en mayúscula, de/en/y/del en minúscula)
const formatear = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase().split(' ').map((w, i) => (i > 0 && ['de', 'del', 'en', 'y', 'la', 'el', 'a'].includes(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export default function CargoSelect({ value, onChange, cargos, recargar }: { value: string, onChange: (v: string) => void, cargos: string[], recargar: () => void }) {
  const { usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [abierto, setAbierto] = useState(false); const [nombre, setNombre] = useState(''); const [msg, setMsg] = useState('')
  const agregar = async () => {
    const n = formatear(nombre)
    if (!n) { setMsg('Escribe el nombre del cargo.'); return }
    if (cargos.some(x => x.toLowerCase() === n.toLowerCase())) { setMsg('Ese cargo ya existe.'); return }
    const { error } = await supabase.from('op_cargos').insert({ nombre: n })
    if (error) { setMsg(msgError(error)); return }
    await recargar(); onChange(n); setNombre(''); setMsg(''); setAbierto(false)
  }
  return (
    <div>
      <select value={value || ''} onChange={e => { if (e.target.value === '__nuevo') setAbierto(true); else onChange(e.target.value) }} style={input}>
        <option value="">—</option>
        {value && !cargos.includes(value) && <option>{value}</option>}
        {cargos.map(o => <option key={o}>{o}</option>)}
        {esAdmin && <option value="__nuevo">➕ Agregar cargo…</option>}
      </select>
      {abierto && esAdmin && (
        <div style={{ marginTop: '6px', padding: '8px', border: '1px solid #d0d5dd', borderRadius: '8px', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del cargo" style={input} autoFocus />
          {msg && <span style={{ fontSize: '12px', color: '#c5221f' }}>{msg}</span>}
          <div style={{ display: 'flex', gap: '6px' }}><button type="button" onClick={agregar} style={{ ...btn(), padding: '5px 12px', fontSize: '12px' }}>Agregar</button><button type="button" onClick={() => { setAbierto(false); setMsg('') }} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>Cancelar</button></div>
        </div>
      )}
    </div>
  )
}

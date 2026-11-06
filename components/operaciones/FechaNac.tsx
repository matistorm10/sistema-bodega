'use client'
import { useEffect, useState } from 'react'
import { input } from '@/components/programa/ui'

// Fecha escrita como dd/mm/aaaa (con las barras puestas solas). Entrega 'aaaa-mm-dd' solo cuando la fecha está completa y es válida.
const aTexto = (iso?: string | null) => iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''
export default function FechaNac({ value, onChange, anioMin = 1900, anioMax = new Date().getFullYear() }: { value: string, onChange: (iso: string) => void, anioMin?: number, anioMax?: number }) {
  const [txt, setTxt] = useState(aTexto(value)); const [mal, setMal] = useState(false)
  useEffect(() => { if (value) setTxt(aTexto(value)) }, [value])
  const cambiar = (v: string) => {
    const dig = v.replace(/\D/g, '').slice(0, 8)
    const f = dig.length > 4 ? `${dig.slice(0, 2)}/${dig.slice(2, 4)}/${dig.slice(4)}` : dig.length > 2 ? `${dig.slice(0, 2)}/${dig.slice(2)}` : dig
    setTxt(f)
    if (dig.length < 8) { setMal(false); onChange(''); return }
    const d = Number(dig.slice(0, 2)), m = Number(dig.slice(2, 4)), a = Number(dig.slice(4))
    const fecha = new Date(a, m - 1, d)
    const ok = a >= anioMin && a <= anioMax && m >= 1 && m <= 12 && fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d
    setMal(!ok); onChange(ok ? `${dig.slice(4)}-${dig.slice(2, 4)}-${dig.slice(0, 2)}` : '')
  }
  return (
    <div>
      <input value={txt} onChange={e => cambiar(e.target.value)} inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} style={{ ...input, borderColor: mal ? '#c5221f' : undefined }} />
      {mal && <span style={{ fontSize: '10.5px', color: '#c5221f' }}>Fecha no válida (año entre {anioMin} y {anioMax})</span>}
    </div>
  )
}

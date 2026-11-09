'use client'
import { useEffect, useState } from 'react'
import { input } from '@/components/programa/ui'

// Hora en formato 24 h (hh:mm), escrita con los dos puntos puestos solos. Entrega 'hh:mm' solo cuando está completa y es válida.
export default function Hora24({ value, onChange }: { value: string, onChange: (hhmm: string) => void }) {
  const [txt, setTxt] = useState((value || '').slice(0, 5)); const [mal, setMal] = useState(false)
  useEffect(() => { if (value) setTxt(value.slice(0, 5)); else if (!mal && txt.length === 5) setTxt('') }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const cambiar = (v: string) => {
    const dig = v.replace(/\D/g, '').slice(0, 4)
    setTxt(dig.length > 2 ? `${dig.slice(0, 2)}:${dig.slice(2)}` : dig)
    if (dig.length < 4) { setMal(false); onChange(''); return }
    const h = Number(dig.slice(0, 2)), m = Number(dig.slice(2))
    const ok = h <= 23 && m <= 59
    setMal(!ok); onChange(ok ? `${dig.slice(0, 2)}:${dig.slice(2)}` : '')
  }
  return (
    <div>
      <input value={txt} onChange={e => cambiar(e.target.value)} inputMode="numeric" placeholder="hh:mm (24 h)" maxLength={5} style={{ ...input, borderColor: mal ? '#c5221f' : undefined }} />
      {mal && <span style={{ fontSize: '10.5px', color: '#c5221f' }}>Hora no válida (00:00 a 23:59)</span>}
    </div>
  )
}

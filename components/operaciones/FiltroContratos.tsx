'use client'
import { useEffect, useRef, useState } from 'react'
import { input } from '@/components/programa/ui'
import { etiquetaContrato } from '@/lib/operaciones'

// Selector de uno o varios contratos (checkboxes). Lista vacía = todos.
export default function FiltroContratos({ contratos, sel, onChange }: { contratos: any[], sel: string[], onChange: (v: string[]) => void }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [])
  const ord = [...contratos].sort((a, b) => etiquetaContrato(a).localeCompare(etiquetaContrato(b), 'es'))
  const txt = sel.length === 0 ? 'Todos los contratos' : sel.length === 1 ? etiquetaContrato(contratos.find(c => c.id === sel[0]), 40) : `${sel.length} contratos seleccionados`
  const alternar = (id: string) => onChange(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setAbierto(!abierto)} style={{ ...input, width: 'auto', minWidth: '220px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span>{txt}</span><span>▾</span></button>
      {abierto && (
        <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, marginTop: '4px', background: '#fff', border: '1px solid #d0d5dd', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,.12)', padding: '8px', minWidth: '360px', maxWidth: '92vw', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <button type="button" onClick={() => onChange([])} style={{ fontSize: '11.5px', background: 'none', border: 'none', color: '#1B4F9C', cursor: 'pointer' }}>Todos</button>
            <button type="button" onClick={() => setAbierto(false)} style={{ fontSize: '11.5px', background: 'none', border: 'none', color: '#667085', cursor: 'pointer', marginLeft: 'auto' }}>Cerrar</button>
          </div>
          {ord.map(c => (
            <label key={c.id} title={c.referencia || ''} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '5px 4px', fontSize: '12.5px', cursor: 'pointer', borderTop: '1px solid #f2f4f7' }}>
              <input type="checkbox" checked={sel.includes(c.id)} onChange={() => alternar(c.id)} style={{ marginTop: '2px' }} />
              <span>{etiquetaContrato(c, 70)}</span>
            </label>))}
        </div>
      )}
    </div>
  )
}

'use client'
import { AZUL } from '@/lib/theme'

export const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
export const input: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit' }
export const label: React.CSSProperties = { fontSize: '11px', color: '#667085', display: 'block', marginBottom: '3px', fontWeight: 600 }
export const btn = (primario = true, peligro = false): React.CSSProperties => ({
  padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : `1px solid ${peligro ? '#e5b4b4' : '#d0d5dd'}`,
  background: primario ? AZUL : '#fff', color: primario ? '#fff' : (peligro ? '#9b1c1c' : '#344054'),
})

// Botones segmentados para responder un ítem (SI / NO / N/A, o C / NC / NA)
export function Opciones({ valor, onChange, opciones, disabled }: { valor: string | null, onChange: (v: string) => void, opciones: { v: string, t: string, col: string }[], disabled?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', gap: '4px', flexShrink: 0 }}>
      {opciones.map(o => {
        const act = valor === o.v
        return (
          <button key={o.v} type="button" disabled={disabled} onClick={() => onChange(o.v)}
            style={{ minWidth: '38px', padding: '6px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
              border: `1.5px solid ${act ? o.col : '#d0d5dd'}`, background: act ? o.col : '#fff', color: act ? '#fff' : '#667085' }}>{o.t}</button>
        )
      })}
    </div>
  )
}
export const OP_SI = [{ v: 'si', t: 'SÍ', col: '#1e8e4e' }, { v: 'no', t: 'NO', col: '#c0392b' }, { v: 'na', t: 'N/A', col: '#667085' }]
export const OP_C = [{ v: 'C', t: 'C', col: '#1e8e4e' }, { v: 'NC', t: 'NC', col: '#c0392b' }, { v: 'NA', t: 'NA', col: '#667085' }]

export function Campo({ titulo, children, ancho }: { titulo: string, children: React.ReactNode, ancho?: string }) {
  return <div style={{ flex: `1 1 ${ancho || '180px'}`, minWidth: 0 }}><label style={label}>{titulo}</label>{children}</div>
}
export function Fila({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>{children}</div>
}
export function Barra({ valor, color }: { valor: number, color?: string }) {
  const c = color || (valor >= 100 ? '#1e8e4e' : valor >= 50 ? '#d9a21b' : '#c0392b')
  return (
    <div style={{ height: '8px', background: '#eef1f6', borderRadius: '6px', overflow: 'hidden', minWidth: '70px' }}>
      <div style={{ width: `${Math.min(100, valor)}%`, height: '100%', background: c, borderRadius: '6px' }} />
    </div>
  )
}

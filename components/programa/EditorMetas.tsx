'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { card, input } from '@/components/programa/ui'
import { ACTIVIDADES, ORDEN_ACTIVIDADES, CARGOS_PROGRAMA } from '@/lib/programa'

// El Jefe define cuántas veces al mes debe hacer cada cargo cada actividad (0 = no aplica)
export default function EditorMetas({ metas, onCambio }: { metas: any[], onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [msg, setMsg] = useState('')
  const valor = (cargo: string, act: string) => metas.find(m => m.cargo === cargo && m.actividad === act)?.meta ?? 0
  const guardar = async (cargo: string, actividad: string, txt: string) => {
    const n = Math.max(0, Math.min(99, parseInt(txt || '0', 10) || 0))
    if (n === valor(cargo, actividad)) return
    const { error } = n === 0
      ? await supabase.from('pr_prog_metas').delete().eq('cargo', cargo).eq('actividad', actividad)
      : await supabase.from('pr_prog_metas').upsert({ cargo, actividad, meta: n }, { onConflict: 'cargo,actividad' })
    if (error) { setMsg('No se pudo guardar: ' + error.message); return }
    setMsg('✓ Guardado. Rige desde el mes en curso.'); onCambio()
  }
  const cargos = Object.keys(CARGOS_PROGRAMA)
  return (
    <div style={{ ...card, marginBottom: '12px' }}>
      <div onClick={() => setAbierto(!abierto)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px' }}>🎯 Metas mensuales por cargo</p>
        <span style={{ fontSize: '12px', color: '#667085' }}>{abierto ? '▲ ocultar' : '▼ editar'}</span>
      </div>
      {abierto && (
        <div style={{ marginTop: '10px', overflowX: 'auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>Cuántas veces al mes debe hacer cada cargo cada actividad. Deja 0 (o vacío) si no le corresponde.</p>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '560px', width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '4px' }}>Actividad</th>{cargos.map(c => <th key={c} style={{ padding: '4px', fontWeight: 600, color: '#344054' }}>{CARGOS_PROGRAMA[c]}</th>)}</tr></thead>
            <tbody>{ORDEN_ACTIVIDADES.map(a => (
              <tr key={a} style={{ borderTop: '1px solid #eef1f6' }}>
                <td style={{ padding: '4px' }}>{ACTIVIDADES[a].corto}</td>
                {cargos.map(c => (
                  <td key={c} style={{ padding: '2px', textAlign: 'center' }}>
                    <input type="number" min={0} max={99} defaultValue={valor(c, a)} key={`${c}${a}${valor(c, a)}`} onBlur={e => guardar(c, a, e.target.value)} style={{ ...input, width: '56px', textAlign: 'center', padding: '4px' }} />
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
          {msg && <p style={{ margin: '8px 0 0', fontSize: '12px', color: msg.startsWith('✓') ? '#137333' : '#c5221f' }}>{msg}</p>}
        </div>
      )}
    </div>
  )
}

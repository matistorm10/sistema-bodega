'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { etiquetaContrato } from '@/lib/operaciones'

// Nivel de acceso al módulo Operaciones y, para el nivel limitado, los contratos que puede ver.
export default function AccesoOperaciones({ completo, contratos, onChange }: { completo: boolean, contratos: string[], onChange: (v: { completo: boolean, contratos: string[] }) => void }) {
  const [lista, setLista] = useState<any[]>([])
  const [q, setQ] = useState('')
  useEffect(() => { supabase.from('pr_contratos').select('id,nombre,referencia,cliente:pr_clientes_informe(nombre)').order('nombre').then(({ data }) => setLista(data || [])) }, [])
  const alternar = (id: string) => onChange({ completo, contratos: contratos.includes(id) ? contratos.filter(x => x !== id) : [...contratos, id] })
  const vis = lista.filter(c => !q.trim() || etiquetaContrato(c, 120).toLowerCase().includes(q.trim().toLowerCase()))
  const radio = (v: boolean, t: string, d: string) => (
    <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12.5px', cursor: 'pointer', padding: '4px 0' }}>
      <input type="radio" checked={completo === v} onChange={() => onChange({ completo: v, contratos })} style={{ marginTop: '2px' }} />
      <span><strong>{t}</strong><br /><span style={{ color: '#667085' }}>{d}</span></span>
    </label>)
  return (
    <div style={{ margin: '6px 0 8px 22px', padding: '8px 10px', background: '#f6f8fb', border: '1px solid #e2e6ed', borderRadius: '8px' }}>
      {radio(true, 'Completo (administración / reclutamiento)', 'Todo el módulo y todos los contratos.')}
      {radio(false, 'Terreno / consulta', 'Ve dashboard, trabajadores, vuelos y turnos solo de los contratos asignados. En Turnos puede marcar turno y registrar fallos; no edita fichas, contratos ni vuelos.')}
      {!completo && (
        <div style={{ marginTop: '6px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: contratos.length ? '#16213E' : '#c5221f' }}>Contratos que puede ver ({contratos.length} seleccionados){contratos.length === 0 ? ' — elige al menos uno, si no verá todo vacío' : ''}</p>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contrato…" style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: '12.5px', border: '1px solid #d0d5dd', borderRadius: '6px', marginBottom: '4px' }} />
          <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#fff', border: '1px solid #e2e6ed', borderRadius: '6px', padding: '2px 6px' }}>
            {vis.map(c => (
              <label key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '4px 0', fontSize: '12.5px', cursor: 'pointer', borderTop: '1px solid #f2f4f7' }}>
                <input type="checkbox" checked={contratos.includes(c.id)} onChange={() => alternar(c.id)} style={{ marginTop: '2px' }} /><span>{etiquetaContrato(c, 90)}</span>
              </label>))}
            {vis.length === 0 && <p style={{ margin: '6px 0', fontSize: '12px', color: '#98a2b3' }}>Sin resultados.</p>}
          </div>
        </div>)}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import FirmaCanvas from './FirmaCanvas'
import { card, btn } from './ui'

// Firma propia que se estampa en los PDF del programa (y se puede reutilizar en otros documentos).
export default function MiFirma({ usuarioId }: { usuarioId: string }) {
  const [firma, setFirma] = useState<string | null>(null)
  const [nueva, setNueva] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [msg, setMsg] = useState('')
  const [k, setK] = useState(0)

  const cargar = async () => {
    const { data } = await supabase.from('firmas_usuario').select('imagen').eq('usuario_id', usuarioId).maybeSingle()
    setFirma(data?.imagen || null)
  }
  useEffect(() => { cargar() }, [usuarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!nueva) return
    const { error } = await supabase.from('firmas_usuario').upsert({ usuario_id: usuarioId, imagen: nueva, updated_at: new Date().toISOString() })
    if (error) { setMsg('No se pudo guardar: ' + error.message); return }
    setMsg(''); setEditando(false); setNueva(null); setK(x => x + 1); await cargar()
  }
  return (
    <div style={{ ...card, marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: '120px', height: '56px', border: '1px solid #e2e6ed', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', flexShrink: 0 }}>
        {firma ? <img src={firma} alt="Mi firma" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ fontSize: '11px', color: '#8a94a6' }}>Sin firma</span>}
      </div>
      <div style={{ flex: '1 1 220px' }}>
        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '13px' }}>Mi firma para los documentos</p>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>Se estampa sola en el PDF mensual del programa cuando recibes o apruebas.</p>
        {!editando ? <button onClick={() => setEditando(true)} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>{firma ? 'Cambiar firma' : 'Crear firma'}</button> : (
          <>
            <FirmaCanvas key={k} onChange={setNueva} />
            {msg && <p style={{ fontSize: '12px', color: '#c5221f', margin: '6px 0 0' }}>{msg}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={guardar} disabled={!nueva} style={{ ...btn(), padding: '7px 14px', fontSize: '12.5px', opacity: nueva ? 1 : 0.5 }}>Guardar firma</button>
              <button onClick={() => { setEditando(false); setNueva(null) }} style={{ ...btn(false), padding: '7px 14px', fontSize: '12.5px' }}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

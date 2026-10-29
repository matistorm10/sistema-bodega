'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import FirmaCanvas from './FirmaCanvas'
import { card, btn } from './ui'

// Firma propia que se estampa en los PDF del programa (y se puede reutilizar en otros documentos).
export default function MiFirma({ usuarioId }: { usuarioId: string }) {
  const [firma, setFirma] = useState<string | null>(null)
  const [consent, setConsent] = useState<string | null>(null)
  const [acepta, setAcepta] = useState(false)
  const [nueva, setNueva] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [msg, setMsg] = useState('')
  const [k, setK] = useState(0)

  const cargar = async () => {
    const { data } = await supabase.from('firmas_usuario').select('imagen,consentimiento_at').eq('usuario_id', usuarioId).maybeSingle()
    setFirma(data?.imagen || null); setConsent(data?.consentimiento_at || null)
  }
  useEffect(() => { cargar() }, [usuarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!nueva) return
    const { error } = await supabase.from('firmas_usuario').upsert({ usuario_id: usuarioId, imagen: nueva, consentimiento_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    if (error) { setMsg('No se pudo guardar: ' + error.message); return }
    setMsg(''); setEditando(false); setNueva(null); setAcepta(false); setK(x => x + 1); await cargar()
  }
  return (
    <div style={{ ...card, marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: '120px', height: '56px', border: '1px solid #e2e6ed', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', flexShrink: 0 }}>
        {firma ? <img src={firma} alt="Mi firma" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ fontSize: '11px', color: '#8a94a6' }}>Sin firma</span>}
      </div>
      <div style={{ flex: '1 1 220px' }}>
        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '13px' }}>Mi firma para los documentos</p>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>Se estampa sola en tus documentos (PDF mensual, informes, etc.) mientras autorices su uso.</p>
        {firma && <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: consent ? '#14532d' : '#9b1c1c' }}>{consent ? `✓ Uso autorizado el ${new Date(consent).toLocaleDateString('es-CL')}` : '✗ Uso no autorizado: no se estampará en los documentos'}
          {' '}{consent
            ? <button onClick={async () => { if (!confirm('¿Retirar la autorización? Tu firma dejará de aparecer en los documentos nuevos.')) return; await supabase.from('firmas_usuario').update({ consentimiento_at: null }).eq('usuario_id', usuarioId); await cargar() }} style={{ border: 'none', background: 'none', color: '#9b1c1c', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Retirar</button>
            : <button onClick={async () => { await supabase.from('firmas_usuario').update({ consentimiento_at: new Date().toISOString() }).eq('usuario_id', usuarioId); await cargar() }} style={{ border: 'none', background: 'none', color: '#1B4F9C', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Autorizar</button>}</p>}
        {!editando ? <button onClick={() => setEditando(true)} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>{firma ? 'Cambiar firma' : 'Crear firma'}</button> : (
          <>
            <FirmaCanvas key={k} onChange={setNueva} />
            <label style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '12px', margin: '8px 0 0' }}><input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} style={{ marginTop: '2px' }} /><span>Autorizo al Sistema INDELI a usar esta firma en los documentos que yo genere o revise.</span></label>
            {msg && <p style={{ fontSize: '12px', color: '#c5221f', margin: '6px 0 0' }}>{msg}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={guardar} disabled={!nueva || !acepta} style={{ ...btn(), padding: '7px 14px', fontSize: '12.5px', opacity: nueva && acepta ? 1 : 0.5 }}>Guardar firma</button>
              <button onClick={() => { setEditando(false); setNueva(null) }} style={{ ...btn(false), padding: '7px 14px', fontSize: '12.5px' }}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

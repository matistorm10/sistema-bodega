'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'

import { CATEGORIAS as CATS, COLOR_DOC as COL_EST } from '@/lib/contratos'

export default function ContratosPrevencionista() {
  const router = useRouter()
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec || !!usuario?.esPrevencionista
  const [contratos, setContratos] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [sel, setSel] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario || !puede) return
    Promise.all([
      supabase.from('pr_contratos').select('*').eq('activo', true).order('nombre'),
      supabase.from('pr_contrato_documentos').select('*').eq('estado', 'Aprobado').order('nombre'),
    ]).then(([c, d]) => { setContratos(c.data || []); setDocs(d.data || []); setSel((c.data || [])[0]?.id || ''); setCargando(false) })
  }, [usuario, puede])

  const abrir = async (path: string) => {
    const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
    if (error || !data) { alert('No se pudo abrir el archivo.'); return }
    window.open(data.signedUrl, '_blank')
  }
  const c = contratos.find(x => x.id === sel)
  const mios = docs.filter(d => d.contrato_id === sel)

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <a href="/hsec/prevencionista" onClick={e => { e.preventDefault(); if (window.opener) window.close(); else if (window.history.length > 1) router.back(); else router.push('/hsec/prevencionista') }} style={{ fontSize: '13px', color: AZUL, textDecoration: 'none', cursor: 'pointer' }}>← Volver</a>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Documentos de contratos</h1>
        </div>
        {cargandoUsuario || cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : !puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : contratos.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>La jefatura aún no ha creado contratos.</p> : (
          <>
            <div style={{ ...card, marginBottom: '12px' }}>
              <label style={label}>Contrato</label>
              <select value={sel} onChange={e => setSel(e.target.value)} style={input}>{contratos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>
            </div>
            {c && CATS.map(([k, t]) => {
              const l = mios.filter(d => d.categoria === k)
              return (
                <div key={k} style={{ ...card, marginBottom: '10px' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{t} <span style={{ fontWeight: 400, color: '#98a2b3', fontSize: '12px' }}>· {l.length}</span></p>
                  {l.length === 0 && <p style={{ margin: 0, fontSize: '12.5px', color: '#98a2b3' }}>Sin documentos aprobados.</p>}
                  {l.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: '1px solid #f3f5f9', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', flex: '1 1 220px' }}>{d.nombre} <span style={{ color: '#98a2b3', fontSize: '11px' }}>Rev. {d.rev}</span></span>
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', fontWeight: 600, background: COL_EST[d.estado][0], color: COL_EST[d.estado][1] }}>{d.estado}</span>
                        {d.path ? <button onClick={() => abrir(d.path)} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>Ver / descargar</button> : <span style={{ fontSize: '11.5px', color: '#98a2b3' }}>Sin archivo</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>
    </main>
  )
}

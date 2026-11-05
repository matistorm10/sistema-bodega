'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// Página pública (sin login) a la que lleva el QR: MIPER vigente del contrato
export default function MiperPublica() {
  const { token } = useParams() as { token: string }
  const [d, setD] = useState<any | null>(null); const [err, setErr] = useState('')
  useEffect(() => { fetch(`/api/miper/${token}`).then(async r => { const j = await r.json(); if (!r.ok) setErr(j.error || 'No disponible.'); else setD(j) }).catch(() => setErr('No se pudo cargar. Revisa tu conexión.')) }, [token])
  const f = (x?: string | null) => x ? new Date(x).toLocaleDateString('es-CL') : ''
  return (
    <main style={{ minHeight: '100vh', background: '#f4f6fa', fontFamily: 'system-ui,sans-serif', padding: '16px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <div style={{ background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(16,24,40,.08)', marginBottom: '12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#667085', fontWeight: 700, letterSpacing: '.04em' }}>GRUPO INDELI</p>
          <h1 style={{ margin: 0, fontSize: '19px', color: '#16213E' }}>Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER)</h1>
          {d && <p style={{ margin: '8px 0 0', fontSize: '13.5px', color: '#344054' }}>{[d.contrato.cliente, d.contrato.referencia, d.contrato.nombre && 'N° ' + d.contrato.nombre].filter(Boolean).join(' · ')}</p>}
        </div>
        {err && <p style={{ color: '#b42318', fontSize: '14px', background: '#fff', padding: '14px', borderRadius: '12px' }}>{err}</p>}
        {!d && !err && <p style={{ color: '#98a2b3', fontSize: '14px' }}>Cargando...</p>}
        {d && d.docs.length === 0 && <p style={{ background: '#fff8e5', border: '1px solid #f0d98a', color: '#7a5600', fontSize: '14px', padding: '14px', borderRadius: '12px' }}>La MIPER de este contrato aún no está disponible. Consulta con tu prevencionista.</p>}
        {d && d.docs.map((x: any) => (
          <a key={x.id} href={`/api/miper/${token}?d=${x.id}`} target="_blank" rel="noreferrer" style={{ display: 'block', background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '8px', textDecoration: 'none', boxShadow: '0 1px 3px rgba(16,24,40,.08)' }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: '15px', color: '#1B4F9C' }}>📄 {x.nombre}</span>
            <span style={{ display: 'block', fontSize: '12px', color: '#667085', marginTop: '3px' }}>Revisión {x.rev}{x.fecha ? ` · aprobada ${f(x.fecha)}` : ''} · toca para abrir</span>
          </a>
        ))}
      </div>
    </main>
  )
}

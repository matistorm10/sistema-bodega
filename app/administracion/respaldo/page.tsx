'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

const AZUL = '#1B4F9C'
const BUCKETS = ['hsec-documentos', 'movimientos', 'comprobantes']

// Lista recursivamente todos los archivos bajo un prefijo
async function listar(bucket: string, prefijo: string): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefijo, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    for (const it of data || []) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name
      if (it.id) out.push(ruta); else out.push(...await listar(bucket, ruta))
    }
    if (!data || data.length < 1000) break
  }
  return out
}

export default function Respaldo() {
  const { usuario, cargando } = useUsuarioActual()
  const [partes, setPartes] = useState<{ bucket: string, carpeta: string }[]>([])
  const [estado, setEstado] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const esAdmin = usuario?.rol === 'admin'

  useEffect(() => {
    if (!esAdmin) return
    ;(async () => {
      const r: { bucket: string, carpeta: string }[] = []
      for (const b of BUCKETS) {
        const { data } = await supabase.storage.from(b).list('', { limit: 1000 })
        const carpetas = (data || []).filter(x => !x.id).map(x => x.name)
        const sueltos = (data || []).some(x => x.id)
        if (b === 'hsec-documentos') carpetas.forEach(c => r.push({ bucket: b, carpeta: c })); else r.push({ bucket: b, carpeta: '' })
        if (b === 'hsec-documentos' && sueltos) r.push({ bucket: b, carpeta: '(archivos sueltos)' })
      }
      setPartes(r)
    })()
  }, [esAdmin])

  const descargar = async (p: { bucket: string, carpeta: string }) => {
    const k = p.bucket + '/' + p.carpeta
    setOcupado(true); setEstado(e => ({ ...e, [k]: 'Listando archivos…' }))
    try {
      const JSZip = (await import('jszip')).default
      const rutas = p.carpeta === '(archivos sueltos)' ? (await listar(p.bucket, '')).filter(x => !x.includes('/')) : await listar(p.bucket, p.carpeta)
      const zip = new JSZip(); let hechos = 0; const fallidos: string[] = []
      const cola = [...rutas]
      const worker = async () => {
        for (let ruta = cola.shift(); ruta; ruta = cola.shift()) {
          const { data, error } = await supabase.storage.from(p.bucket).download(ruta)
          if (error || !data) fallidos.push(ruta); else zip.file(ruta, data)
          hechos++; setEstado(e => ({ ...e, [k]: `Descargando ${hechos} de ${rutas.length}…` }))
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      if (fallidos.length) zip.file('_NO_SE_PUDIERON_DESCARGAR.txt', fallidos.join('\n'))
      setEstado(e => ({ ...e, [k]: 'Armando el ZIP…' }))
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = url; a.download = `Respaldo_${p.bucket}${p.carpeta ? '_' + p.carpeta.replace(/[()\s]/g, '') : ''}_${new Date().toISOString().slice(0, 10)}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
      setEstado(e => ({ ...e, [k]: `Listo: ${rutas.length - fallidos.length} archivos${fallidos.length ? ` (${fallidos.length} no se pudieron leer, quedan listados en el ZIP)` : ''}` }))
    } catch (e: any) { setEstado(x => ({ ...x, [k]: 'Error: ' + (e?.message || e) })) } finally { setOcupado(false) }
  }

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/administracion" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Administración</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Respaldo de archivos</h1>
        </div>
        {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : !esAdmin ? <p style={{ fontSize: '13px', color: '#999' }}>Esta sección es solo para administradores.</p> : (
          <>
            <p style={{ fontSize: '13px', color: '#475467', margin: '0 0 12px' }}>Las copias automáticas de la base de datos <strong>no incluyen los archivos</strong> (fotos de respaldo, PDFs firmados, contratos, certificados). Aquí descargas cada grupo de archivos en un ZIP y lo guardas en tu computador o en Drive. Hazlo una vez al mes y no cierres la pestaña mientras descarga.</p>
            <div style={{ display: 'grid', gap: '8px' }}>
              {partes.map(p => { const k = p.bucket + '/' + p.carpeta; return (
                <div key={k} style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: '12px', padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>{p.bucket}{p.carpeta ? ' / ' + p.carpeta : ''}</p>
                    {estado[k] && <p style={{ margin: '2px 0 0', fontSize: '12px', color: estado[k].startsWith('Error') ? '#c5221f' : '#667085' }}>{estado[k]}</p>}
                  </div>
                  <button onClick={() => descargar(p)} disabled={ocupado} style={{ background: ocupado ? '#98a2b3' : AZUL, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', fontWeight: 600, cursor: ocupado ? 'not-allowed' : 'pointer' }}>⬇ Descargar ZIP</button>
                </div>) })}
              {partes.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Buscando carpetas…</p>}
            </div>
            <p style={{ fontSize: '12px', color: '#98a2b3', margin: '14px 0 0' }}>Los datos de Operaciones (trabajadores, turnos, vuelos) se respaldan con el botón «Descargar respaldo de datos» de esa pantalla.</p>
          </>
        )}
      </div>
    </main>
  )
}

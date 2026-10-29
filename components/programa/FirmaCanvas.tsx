'use client'
import { useRef, useEffect, useState } from 'react'

// Recuadro para firmar con el dedo o el mouse. Entrega la firma como imagen PNG (data URL) con fondo transparente.
export default function FirmaCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const [vacio, setVacio] = useState(true)
  const [subida, setSubida] = useState<string | null>(null)
  const [errImg, setErrImg] = useState('')

  useEffect(() => {
    const c = ref.current!
    c.width = 600; c.height = 220
  }, [])

  const pos = (e: React.PointerEvent) => {
    const c = ref.current!, r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  const empezar = (e: React.PointerEvent) => {
    const c = ref.current!, ctx = c.getContext('2d')!
    c.setPointerCapture(e.pointerId)
    dibujando.current = true
    const p = pos(e)
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f4d'
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke()
  }
  const mover = (e: React.PointerEvent) => {
    if (!dibujando.current) return
    const ctx = ref.current!.getContext('2d')!, p = pos(e)
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  const terminar = () => {
    if (!dibujando.current) return
    dibujando.current = false
    setVacio(false)
    onChange(ref.current!.toDataURL('image/png'))
  }
  const limpiar = () => {
    const c = ref.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setVacio(true); setSubida(null); setErrImg(''); onChange(null)
  }
  // Subir una imagen (PNG/JPG) con la firma. Se ajusta de tamaño y, si trae fondo blanco, se vuelve transparente.
  const subir = (archivo: File) => {
    setErrImg('')
    if (!/^image\//.test(archivo.type)) { setErrImg('Sube un archivo de imagen (PNG recomendado).'); return }
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const esc = Math.min(1, 600 / img.width, 220 / img.height)
      const w = Math.max(1, Math.round(img.width * esc)), h = Math.max(1, Math.round(img.height * esc))
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const ctx = cv.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h), px = d.data
      let opaco = true
      for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { opaco = false; break }
      if (opaco) for (let i = 0; i < px.length; i += 4) if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) px[i + 3] = 0
      ctx.putImageData(d, 0, 0)
      URL.revokeObjectURL(url)
      const out = cv.toDataURL('image/png')
      const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setVacio(true)
      setSubida(out); onChange(out)
    }
    img.onerror = () => { URL.revokeObjectURL(url); setErrImg('No se pudo leer la imagen.') }
    img.src = url
  }

  return (
    <div>
      <canvas ref={ref} onPointerDown={empezar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar}
        style={{ width: '100%', maxWidth: '480px', aspectRatio: '600 / 220', border: '1.5px dashed #98a2b3', borderRadius: '10px', background: '#fff', touchAction: 'none', cursor: 'crosshair', display: 'block' }} />
      {subida && <div style={{ marginTop: '6px', border: '1px solid #e2e6ed', borderRadius: '8px', padding: '6px', background: '#fff', display: 'inline-block' }}><img src={subida} alt="Firma subida" style={{ maxHeight: '90px', maxWidth: '100%', display: 'block' }} /></div>}
      <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <label style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d0d5dd', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#344054' }}>📎 Subir firma (PNG)
        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = '' }} /></label>
      {errImg && <span style={{ fontSize: '12px', color: '#c5221f' }}>{errImg}</span>}
      </div>
      <button type="button" onClick={limpiar} disabled={vacio && !subida} style={{ marginTop: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #d0d5dd', background: '#fff', fontSize: '12px', cursor: vacio && !subida ? 'default' : 'pointer', color: '#344054' }}>Borrar y firmar de nuevo</button>
    </div>
  )
}

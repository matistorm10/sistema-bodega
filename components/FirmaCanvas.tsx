'use client'
import { useRef, useEffect, useState } from 'react'

// Recuadro para firmar con el dedo o el mouse. Entrega la firma como imagen PNG (data URL) con fondo transparente.
export default function FirmaCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const [vacio, setVacio] = useState(true)

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
    setVacio(true); onChange(null)
  }

  return (
    <div>
      <canvas ref={ref} onPointerDown={empezar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar}
        style={{ width: '100%', maxWidth: '480px', aspectRatio: '600 / 220', border: '1.5px dashed #98a2b3', borderRadius: '10px', background: '#fff', touchAction: 'none', cursor: 'crosshair', display: 'block' }} />
      <button type="button" onClick={limpiar} disabled={vacio} style={{ marginTop: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #d0d5dd', background: '#fff', fontSize: '12px', cursor: vacio ? 'default' : 'pointer', color: '#344054' }}>Borrar y firmar de nuevo</button>
    </div>
  )
}

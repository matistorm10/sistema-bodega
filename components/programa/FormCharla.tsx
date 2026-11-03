'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { card, btn, input, label } from './ui'
import { AZUL } from '@/lib/theme'
import { formatearRut, rutValido } from '@/lib/rut'
import { TIPOS_CHARLA } from '@/lib/prevencion'

type Pers = { nombre: string, rut: string }
const clave = (p: Pers) => (p.rut || p.nombre).toLowerCase()

// Registrar una charla en 3 pasos: tema → asistentes (con clicks) → papel firmado
export default function FormCharla({ usuario, ubicId, ubicNombre, programas, previos, fechaIni, progIni, onListo, onCancelar }: {
  usuario: { id: string, nombre?: string }, ubicId: string, ubicNombre: string, programas: any[], previos: Pers[], fechaIni: string, progIni?: string, onListo: () => void, onCancelar: () => void,
}) {
  const p0 = programas.find(p => p.id === progIni)
  const [progId, setProgId] = useState(progIni || '')
  const [tema, setTema] = useState(p0?.tematica || '')
  const [tipo, setTipo] = useState(p0 ? 'capacitacion' : 'charla_5min')
  const [fecha, setFecha] = useState(fechaIni)
  const [relator, setRelator] = useState(usuario.nombre || '')
  const [duracion, setDuracion] = useState(p0?.horas ? String(Math.round(Number(p0.horas) * 60)) : '')
  const [pool, setPool] = useState<Pers[]>(previos)
  const [sel, setSel] = useState<string[]>([])
  const [nom, setNom] = useState(''); const [rut, setRut] = useState(''); const [pegar, setPegar] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState(''); const [guardando, setGuardando] = useState(false)
  const elegir = (id: string) => {
    setProgId(id); const p = programas.find(x => x.id === id)
    if (p) { setTema(p.tematica); setTipo('capacitacion'); if (p.horas) setDuracion(String(Math.round(Number(p.horas) * 60))) }
  }
  const agregar = (ps: Pers[]) => {
    setPool(l => { const ya = new Set(l.map(clave)); return [...l, ...ps.filter(p => !ya.has(clave(p)))] })
    setSel(s => Array.from(new Set([...s, ...ps.map(clave)])))
  }
  const marcados = useMemo(() => pool.filter(p => sel.includes(clave(p))), [pool, sel])
  const guardar = async () => {
    if (!tema.trim()) { setMsg('Elige o escribe el tema.'); return }
    if (!marcados.length && !confirm('No marcaste asistentes. ¿Guardar igual?')) return
    setGuardando(true); setMsg('')
    let path: string | null = null
    if (file) {
      if (file.size > 15 * 1024 * 1024) { setGuardando(false); setMsg('El archivo supera 15 MB.'); return }
      path = `charlas/${usuario.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const up = await supabase.storage.from('hsec-documentos').upload(path, file, { contentType: file.type || undefined })
      if (up.error) { setGuardando(false); setMsg('No se pudo subir el papel: ' + up.error.message); return }
    }
    const { data, error } = await supabase.from('pr_charlas').insert({
      fecha, tipo, tema: tema.trim(), ubicacion_id: ubicId, relator: relator.trim() || null, duracion_min: duracion ? Number(duracion) : null,
      creado_por: usuario.id, programa_id: progId || null, respaldo_path: path, respaldo_nombre: file?.name || null,
    }).select().single()
    if (error || !data) { setGuardando(false); setMsg('No se pudo guardar: ' + (error?.message || '')); return }
    if (marcados.length) {
      const { error: e2 } = await supabase.from('pr_charla_asistentes').insert(marcados.map(a => ({ charla_id: data.id, nombre: a.nombre, rut: a.rut || null })))
      if (e2) { setGuardando(false); setMsg('La capacitación se guardó, pero fallaron los asistentes: ' + e2.message); return }
    }
    setGuardando(false); onListo()
  }
  const paso = (n: number, t: string) => <p style={{ margin: '12px 0 6px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}><span style={{ display: 'inline-block', width: '20px', height: '20px', lineHeight: '20px', textAlign: 'center', borderRadius: '50%', background: AZUL, color: '#fff', fontSize: '11px', marginRight: '6px' }}>{n}</span>{t}</p>
  return (
    <div style={{ ...card, marginBottom: '14px', borderColor: '#cfe0f5', background: '#fbfdff' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>Registro de capacitación · <span style={{ fontWeight: 500, color: '#667085' }}>{ubicNombre}</span></p>

      {paso(1, '¿Qué capacitación fue?')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '8px' }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={label}>Tema del programa (o capacitación libre)</label>
          <select value={progId} onChange={e => elegir(e.target.value)} style={input}><option value="">— Capacitación libre (escribo el tema) —</option>{programas.map(p => <option key={p.id} value={p.id}>{p.n}. {p.tematica}</option>)}</select></div>
        {!progId && <div style={{ gridColumn: '1 / -1' }}><label style={label}>Tema</label><input value={tema} onChange={e => setTema(e.target.value)} placeholder="Ej: Trabajo en altura, uso de arnés" style={input} /></div>}
        <div><label style={label}>Fecha</label><input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={e => setFecha(e.target.value)} style={input} /></div>
        <div><label style={label}>Tipo</label><select value={tipo} onChange={e => setTipo(e.target.value)} style={input}>{Object.entries(TIPOS_CHARLA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label style={label}>Relator</label><input value={relator} onChange={e => setRelator(e.target.value)} style={input} /></div>
        <div><label style={label}>Duración (min)</label><input type="number" min="0" value={duracion} onChange={e => setDuracion(e.target.value)} style={input} /></div>
      </div>

      {paso(2, `¿Quiénes asistieron? (${marcados.length} marcados)`)}
      {pool.length > 0 && <>
        <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: '#667085' }}>Toca los nombres de quienes estuvieron. Aquí aparecen los que ya han asistido a capacitaciones en esta faena.</p>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {pool.map(p => { const on = sel.includes(clave(p)); return (
            <button key={clave(p)} type="button" title={p.rut} onClick={() => setSel(s => on ? s.filter(x => x !== clave(p)) : [...s, clave(p)])}
              style={{ padding: '4px 11px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: `1.5px solid ${on ? AZUL : '#d0d5dd'}`, background: on ? AZUL : '#fff', color: on ? '#fff' : '#344054', fontWeight: on ? 700 : 500, fontFamily: 'inherit' }}>{on ? '☑' : '☐'} {p.nombre}</button>) })}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button type="button" onClick={() => setSel(pool.map(clave))} style={{ ...btn(false), padding: '3px 10px', fontSize: '11.5px' }}>Todos</button>
          <button type="button" onClick={() => setSel([])} style={{ ...btn(false), padding: '3px 10px', fontSize: '11.5px' }}>Ninguno</button>
        </div>
      </>}
      <p style={{ margin: '0 0 4px', fontSize: '11.5px', color: '#667085' }}>¿Alguien nuevo? Agrégalo una vez y queda disponible para las próximas capacitaciones.</p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nombre" style={{ ...input, flex: '2 1 160px', width: 'auto' }} />
        <input value={rut} onChange={e => setRut(formatearRut(e.target.value))} placeholder="RUT (opcional)" maxLength={12} style={{ ...input, flex: '1 1 120px', width: 'auto' }} />
        <button type="button" onClick={() => {
          if (!nom.trim()) return
          if (rut && !rutValido(rut)) { setMsg('El RUT no es válido.'); return }
          setMsg(''); agregar([{ nombre: nom.trim(), rut }]); setNom(''); setRut('')
        }} style={btn(false)}>Agregar</button>
      </div>
      <details style={{ marginTop: '6px' }}>
        <summary style={{ fontSize: '12px', color: AZUL, cursor: 'pointer' }}>Pegar una lista (Nombre, RUT por línea)</summary>
        <textarea value={pegar} onChange={e => setPegar(e.target.value)} rows={3} placeholder={'Juan Pérez, 12.345.678-5\nPedro Soto, 9.876.543-3'} style={{ ...input, marginTop: '6px' }} />
        <button type="button" disabled={!pegar.trim()} onClick={() => {
          const ps = pegar.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [n, r] = l.split(/[;\t,]/).map(x => x.trim()); return { nombre: n, rut: r && rutValido(r) ? formatearRut(r) : '' } }).filter(p => p.nombre)
          agregar(ps); setPegar('')
        }} style={{ ...btn(false), marginTop: '6px' }}>Agregar lista</button>
      </details>

      {paso(3, 'Papel de asistencia firmado')}
      <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: '#667085' }}>Escanea o fotografía el papel firmado por los asistentes. Si no lo tienes ahora, puedes subirlo después desde el calendario.</p>
      <label style={{ ...btn(false), display: 'inline-block', cursor: 'pointer' }}>{file ? `📎 ${file.name}` : '📎 Elegir archivo'}
        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      {file && <button type="button" onClick={() => setFile(null)} style={{ border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer', marginLeft: '6px' }}>× quitar</button>}

      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '10px 0 0' }}>{msg}</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button onClick={guardar} disabled={guardando} style={btn()}>{guardando ? 'Guardando...' : 'Guardar capacitación'}</button>
        <button onClick={onCancelar} style={btn(false)}>Cancelar</button>
      </div>
    </div>
  )
}

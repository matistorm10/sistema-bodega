'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { LUGARES, MESES_C } from '@/lib/capacitaciones'

const anio = new Date().getFullYear()
const chip = (on: boolean, col = AZUL): React.CSSProperties => ({ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${on ? col : '#d0d5dd'}`, background: on ? col : '#fff', color: on ? '#fff' : '#667085', fontWeight: on ? 700 : 500 })

export default function ConfigCalendario() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [prog, setProg] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [f, setF] = useState({ categoria: '', tematica: '', dirigido: '', horas: '', tipo: 'capacitacion', resp_curso: '' })
  const [fLug, setFLug] = useState<string[]>(['oficina', 'engie', 'sacyr', 'sqm'])
  const [fMes, setFMes] = useState<number[]>([])

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pr_cap_programa').select('*').eq('anio', anio).order('n')
    setProg(data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const cats = useMemo(() => Array.from(new Set(prog.map(p => p.categoria).filter(Boolean))), [prog])
  const guardar = async (p: any, patch: any) => {
    setMsg('')
    setProg(l => l.map(x => x.id === p.id ? { ...x, ...patch } : x))
    const { error } = await supabase.from('pr_cap_programa').update(patch).eq('id', p.id)
    if (error) { setMsg('No se pudo guardar: ' + error.message); await cargar() }
  }
  const toggleMes = (p: any, m: number) => {
    const meses = { ...(p.meses || {}) }
    if (meses[m]) delete meses[m]; else meses[m] = 'P'
    guardar(p, { meses })
  }
  const toggleLugar = (p: any, l: string) => {
    const act: string[] = p.lugares || []
    guardar(p, { lugares: act.includes(l) ? act.filter(x => x !== l) : [...act, l] })
  }
  const crear = async () => {
    if (!f.tematica.trim()) { setMsg('Escribe la temática.'); return }
    if (!fMes.length) { setMsg('Marca al menos un mes.'); return }
    if (!fLug.length) { setMsg('Marca a qué grupos aplica.'); return }
    const meses: Record<number, string> = {}; fMes.forEach(m => { meses[m] = 'P' })
    const n = Math.max(0, ...prog.map(p => p.n)) + 1
    const { error } = await supabase.from('pr_cap_programa').insert({ anio, n, categoria: f.categoria.trim() || 'Otras', tematica: f.tematica.trim(), dirigido: f.dirigido.trim() || null, tipo: f.tipo, lugares: fLug, horas: f.horas ? Number(f.horas) : null, resp_curso: f.resp_curso.trim() || null, meses, activo: true })
    if (error) { setMsg('No se pudo crear: ' + error.message); return }
    setNuevo(false); setF({ categoria: '', tematica: '', dirigido: '', horas: '', tipo: 'capacitacion', resp_curso: '' }); setFMes([]); setMsg(''); await cargar()
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/jefatura/capacitaciones" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Programa de Capacitaciones</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Calendario de capacitaciones {anio}</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  const porCat = cats.map(c => ({ c, ps: prog.filter(p => p.categoria === c) }))
  const sinCat = prog.filter(p => !p.categoria)
  if (sinCat.length) porCat.push({ c: 'Otras', ps: sinCat })

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>Solo el Jefe puede configurar el calendario.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (<>
          <div style={{ ...card, background: '#f4f8fd', borderColor: '#cfe0f5', marginBottom: '12px', fontSize: '12.5px', color: '#344054', lineHeight: 1.5 }}>
            <b>Tú defines el calendario de la empresa.</b> Para cada capacitación marca <b>en qué meses</b> se hace y <b>a qué grupo de faenas aplica</b> (oficina, ENGIE, SACYR - EUROHINCA, SQM). Cada contrato ve y cumple exactamente este calendario. Los cambios se guardan al instante y los APR los ven de inmediato.
          </div>
          {msg && <p style={{ fontSize: '12.5px', color: '#c5221f' }}>{msg}</p>}
          <div style={{ marginBottom: '12px' }}>{!nuevo && <button onClick={() => setNuevo(true)} style={btn()}>＋ Agregar capacitación al calendario</button>}</div>

          {nuevo && (
            <div style={{ ...card, marginBottom: '12px', borderColor: '#cfe0f5' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Nueva capacitación</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '8px' }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Temática</label><input value={f.tematica} onChange={e => setF({ ...f, tematica: e.target.value })} style={input} /></div>
                <div><label style={label}>Categoría</label><input list="cats" value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })} style={input} /><datalist id="cats">{cats.map(c => <option key={c} value={c} />)}</datalist></div>
                <div><label style={label}>Dirigido a</label><input value={f.dirigido} onChange={e => setF({ ...f, dirigido: e.target.value })} style={input} placeholder="Toda persona trabajadora" /></div>
                <div><label style={label}>Horas</label><input type="number" min="0" step="0.5" value={f.horas} onChange={e => setF({ ...f, horas: e.target.value })} style={input} /></div>
                <div><label style={label}>Relator</label><input value={f.resp_curso} onChange={e => setF({ ...f, resp_curso: e.target.value })} style={input} /></div>
                <div><label style={label}>Tipo</label><select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} style={input}><option value="capacitacion">Capacitación</option><option value="difusion">Difusión</option></select></div>
              </div>
              <p style={{ ...{ margin: '10px 0 4px' }, fontSize: '12px', fontWeight: 700 }}>Aplica a</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>{Object.entries(LUGARES).map(([k, v]) => <button key={k} type="button" onClick={() => setFLug(l => l.includes(k) ? l.filter(x => x !== k) : [...l, k])} style={chip(fLug.includes(k))}>{v}</button>)}</div>
              <p style={{ margin: '10px 0 4px', fontSize: '12px', fontWeight: 700 }}>Meses en que se realiza</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>{MESES_C.map((m, i) => <button key={m} type="button" onClick={() => setFMes(l => l.includes(i + 1) ? l.filter(x => x !== i + 1) : [...l, i + 1])} style={chip(fMes.includes(i + 1), '#1e8e4e')}>{m}</button>)}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}><button onClick={crear} style={btn()}>Agregar</button><button onClick={() => setNuevo(false)} style={btn(false)}>Cancelar</button></div>
            </div>
          )}

          {porCat.map(({ c, ps }) => (
            <div key={c} style={{ ...card, marginBottom: '10px' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>{c}</p>
              {ps.map(p => {
                const meses = Object.keys(p.meses || {}).map(Number)
                const open = abierto === p.id
                return (
                  <div key={p.id} style={{ borderTop: '1px solid #eef1f6', padding: '8px 0', opacity: p.activo ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{p.n}. {p.tematica}{!p.activo && <span style={{ color: '#9b1c1c', fontWeight: 700 }}> (quitada)</span>}</p>
                      <button type="button" onClick={() => setAbierto(open ? null : p.id)} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>{open ? 'Cerrar ▲' : 'Detalles ▼'}</button>
                    </div>
                    <p style={{ margin: '2px 0 5px', fontSize: '11.5px', color: '#667085' }}>{p.horas ? `${p.horas} h · ` : ''}{(p.lugares || []).map((l: string) => LUGARES[l] || l).join(', ') || 'sin grupos'}</p>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {MESES_C.map((m, i) => <button key={m} type="button" disabled={!p.activo} onClick={() => toggleMes(p, i + 1)} style={{ ...chip(meses.includes(i + 1), '#1e8e4e'), padding: '3px 8px', fontSize: '11.5px' }}>{m}</button>)}
                    </div>
                    {open && (
                      <div style={{ marginTop: '8px', background: '#f7f9fd', borderRadius: '8px', padding: '8px 10px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700 }}>Aplica a</p>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>{Object.entries(LUGARES).map(([k, v]) => <button key={k} type="button" onClick={() => toggleLugar(p, k)} style={chip((p.lugares || []).includes(k))}>{v}</button>)}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '8px' }}>
                          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Temática</label><input defaultValue={p.tematica} onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.tematica) guardar(p, { tematica: v }) }} style={input} /></div>
                          <div><label style={label}>Horas</label><input type="number" min="0" step="0.5" defaultValue={p.horas ?? ''} onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (p.horas == null ? null : Number(p.horas))) guardar(p, { horas: v }) }} style={input} /></div>
                          <div><label style={label}>Relator</label><input defaultValue={p.resp_curso || ''} onBlur={e => { if (e.target.value !== (p.resp_curso || '')) guardar(p, { resp_curso: e.target.value || null }) }} style={input} /></div>
                          <div><label style={label}>Dirigido a</label><input defaultValue={p.dirigido || ''} onBlur={e => { if (e.target.value !== (p.dirigido || '')) guardar(p, { dirigido: e.target.value || null }) }} style={input} /></div>
                          <div><label style={label}>Tipo</label><select value={p.tipo} onChange={e => guardar(p, { tipo: e.target.value })} style={input}><option value="capacitacion">Capacitación</option><option value="difusion">Difusión</option></select></div>
                        </div>
                        <button type="button" onClick={() => guardar(p, { activo: !p.activo })} style={{ ...btn(false, p.activo), marginTop: '8px', padding: '5px 12px', fontSize: '12px' }}>{p.activo ? 'Quitar del calendario' : 'Volver a poner en el calendario'}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </>)}
      </div>
    </main>
  )
}

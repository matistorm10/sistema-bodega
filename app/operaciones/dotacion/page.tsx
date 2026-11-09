'use client'
import { traerContratosOp } from '@/lib/operaciones'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card, btn, input, label } from '@/components/programa/ui'
import Marco from '@/components/operaciones/Marco'
import CargoSelect, { useCargos } from '@/components/operaciones/CargoSelect'
import PuntoExamen from '@/components/operaciones/PuntoExamen'
import { traerTodo, etiquetaContrato, msgError, type Cupo } from '@/lib/operaciones'

// Dotación por contrato: cargos vendidos al cliente (cupos), con nombre o vacantes
export default function Dotacion() {
  const { cargos, recargar } = useCargos()
  const [contratos, setContratos] = useState<any[]>([]); const [cupos, setCupos] = useState<Cupo[]>([]); const [trab, setTrab] = useState<any[]>([])
  const [cid, setCid] = useState(''); const [cargando, setCargando] = useState(true); const [msg, setMsg] = useState('')
  const [nc, setNc] = useState({ cargo: '', n: '1' }); const [abierto, setAbierto] = useState<string | null>(null); const [elegir, setElegir] = useState<{ cupo: string, w: string } | null>(null)
  const cargar = async () => {
    const [c, cp, t] = await Promise.all([traerContratosOp(), traerTodo('op_cupos'), traerTodo('op_trabajadores', 'id,nombre,cargo,activo,examenes', 'nombre')])
    setContratos(c.data || []); setCupos(cp as Cupo[]); setTrab(t); setCargando(false)
  }
  useEffect(() => { cargar() }, [])
  const mios = useMemo(() => cupos.filter(c => c.contrato_id === cid), [cupos, cid])
  const grupos = useMemo(() => {
    const m = new Map<string, Cupo[]>(); mios.forEach(c => m.set(c.cargo, [...(m.get(c.cargo) || []), c]))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [mios])
  const tr = (id: string | null) => id ? trab.find(t => t.id === id) : null
  const ejecutar = async (p: PromiseLike<{ error: any }>) => { const r = await p; if (r.error) setMsg(msgError(r.error)); else { setMsg(''); await cargar() } }
  const agregar = async () => {
    const n = Math.floor(Number(nc.n))
    if (!cid || !nc.cargo || !(n >= 1 && n <= 200)) { setMsg('Elige el cargo y una cantidad entre 1 y 200.'); return }
    await ejecutar(supabase.from('op_cupos').insert(Array.from({ length: n }, () => ({ contrato_id: cid, cargo: nc.cargo }))))
    setNc({ cargo: '', n: '1' })
  }
  const totVend = mios.filter(c => !c.es_reemplazo).length, totNombre = mios.filter(c => !c.es_reemplazo && c.trabajador_id).length
  return (
    <Marco titulo="Dotación por contrato" soloCompleto>
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
        <>
          <div style={{ ...card, marginBottom: '12px' }}>
            <label style={label}>Contrato</label>
            <select value={cid} onChange={e => { setCid(e.target.value); setAbierto(null) }} style={input}><option value="">— elegir contrato —</option>{contratos.map(c => <option key={c.id} value={c.id}>{etiquetaContrato(c, 90)}</option>)}</select>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#667085' }}>Cada cupo es un cargo vendido al cliente. Los cupos sin nombre aparecen como «Vacante» en la grilla de Turnos, en «Por contratar».</p>
          </div>
          {msg && <p style={{ fontSize: '12.5px', color: '#c5221f' }}>{msg}</p>}
          {cid && (
            <>
              <div style={{ ...card, marginBottom: '12px' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13.5px' }}>Agregar cargos vendidos</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '2 1 220px' }}><label style={label}>Cargo</label><CargoSelect value={nc.cargo} onChange={v => setNc({ ...nc, cargo: v })} cargos={cargos} recargar={recargar} /></div>
                  <div style={{ flex: '0 1 90px' }}><label style={label}>Cantidad</label><input type="number" min={1} value={nc.n} onChange={e => setNc({ ...nc, n: e.target.value })} style={input} /></div>
                  <button onClick={agregar} style={btn()}>Agregar</button>
                </div>
              </div>
              <div style={card}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13.5px' }}>Vendidos: {totVend} · Con nombre: {totNombre} · Vacantes: {totVend - totNombre}</p>
                {grupos.length === 0 ? <p style={{ fontSize: '13px', color: '#98a2b3', margin: 0 }}>Este contrato aún no tiene cargos cargados.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#667085' }}><th style={{ padding: '6px 8px' }}>Cargo</th><th style={{ padding: '6px 8px' }}>Vendidos</th><th style={{ padding: '6px 8px' }}>Con nombre</th><th style={{ padding: '6px 8px' }}>Vacantes</th><th /></tr></thead>
                    <tbody>
                      {grupos.map(([cargo, lista]) => { const base = lista.filter(c => !c.es_reemplazo); const con = base.filter(c => c.trabajador_id).length; const open = abierto === cargo; return (
                        <Fragment key={cargo}>
                          <tr style={{ borderTop: '1px solid #eef1f6' }}>
                            <td style={{ padding: '7px 8px', fontWeight: 600 }}>{cargo}</td><td style={{ padding: '7px 8px' }}>{base.length}</td><td style={{ padding: '7px 8px' }}>{con}</td>
                            <td style={{ padding: '7px 8px', fontWeight: 700, color: base.length - con ? '#b42318' : '#1e8e4e' }}>{base.length - con}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right' }}><button onClick={() => setAbierto(open ? null : cargo)} style={{ ...btn(false), padding: '3px 10px', fontSize: '12px' }}>{open ? 'Ocultar' : 'Ver cupos'}</button></td>
                          </tr>
                          {open && lista.map(c => { const t = tr(c.trabajador_id); return (
                            <tr key={c.id} style={{ background: '#f9fafb' }}>
                              <td colSpan={4} style={{ padding: '6px 8px 6px 24px' }}>
                                {t ? <><PuntoExamen estado={t.examenes} /><Link href={`/operaciones/trabajadores/${t.id}`} style={{ color: AZUL, textDecoration: 'none', fontWeight: 600 }}>{t.nombre}</Link></> : <span style={{ color: '#b42318', fontWeight: 700 }}>Vacante</span>}
                                {c.es_reemplazo && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#b7791f' }}>↺ reemplazo{c.reemplaza_trabajador_id && tr(c.reemplaza_trabajador_id) ? ` de ${tr(c.reemplaza_trabajador_id).nombre}` : ''}</span>}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {t ? <>
                                  {!c.es_reemplazo && <button onClick={() => ejecutar(supabase.from('op_cupos').insert({ contrato_id: cid, cargo: c.cargo, es_reemplazo: true, reemplaza_trabajador_id: t.id }))} title="Va a jubilar o salir: crea un cupo para su reemplazo" style={{ ...btn(false), padding: '2px 8px', fontSize: '11.5px', marginRight: '4px' }}>+ Reemplazo</button>}
                                  <button onClick={() => confirm(`¿Liberar el cupo de ${t.nombre}? El trabajador no se borra.`) && ejecutar(supabase.from('op_cupos').update({ trabajador_id: null }).eq('id', c.id))} style={{ ...btn(false), padding: '2px 8px', fontSize: '11.5px' }}>Liberar</button>
                                </> : <>
                                  {elegir?.cupo === c.id ? <>
                                    <select value={elegir.w} onChange={e => setElegir({ cupo: c.id, w: e.target.value })} style={{ ...input, width: '180px', display: 'inline-block' }}><option value="">— trabajador —</option>{trab.filter(x => x.activo && !cupos.some(k => k.trabajador_id === x.id)).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>
                                    <button onClick={() => elegir.w && ejecutar(supabase.from('op_cupos').update({ trabajador_id: elegir.w }).eq('id', c.id)).then(() => setElegir(null))} style={{ ...btn(), padding: '2px 8px', fontSize: '11.5px', marginLeft: '4px' }}>OK</button>
                                  </> : <button onClick={() => setElegir({ cupo: c.id, w: '' })} style={{ ...btn(false), padding: '2px 8px', fontSize: '11.5px', marginRight: '4px' }}>Asignar trabajador</button>}
                                  <button onClick={() => confirm('¿Eliminar este cupo vacante?') && ejecutar(supabase.from('op_cupos').delete().eq('id', c.id))} style={{ ...btn(false, true), padding: '2px 8px', fontSize: '11.5px' }}>Eliminar</button>
                                </>}
                              </td>
                            </tr>) })}
                        </Fragment>) })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Marco>
  )
}

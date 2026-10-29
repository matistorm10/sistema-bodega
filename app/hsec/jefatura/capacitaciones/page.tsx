'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, input, label } from '@/components/programa/ui'
import { LUGARES, MESES_C, mesKey, mesHoy, aplica, estadoCelda, COLOR_CELDA } from '@/lib/capacitaciones'

const anio = new Date().getFullYear()
export default function JefaturaCap() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [prog, setProg] = useState<any[]>([])
  const [ubics, setUbics] = useState<any[]>([])
  const [lugares, setLugares] = useState<any[]>([])
  const [charlas, setCharlas] = useState<any[]>([])
  const [asist, setAsist] = useState<any[]>([])
  const [fUbic, setFUbic] = useState('')
  const [fLugar, setFLugar] = useState('')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const [p, u, l, c, a] = await Promise.all([
      supabase.from('pr_cap_programa').select('*').eq('anio', anio).eq('activo', true).order('n'),
      supabase.from('ubicaciones').select('id,nombre,activa').order('nombre'),
      supabase.from('pr_cap_ubic_lugar').select('*'),
      supabase.from('pr_charlas').select('id,programa_id,ubicacion_id,fecha').not('programa_id', 'is', null),
      supabase.from('pr_charla_asistentes').select('charla_id'),
    ])
    setProg(p.data || []); setUbics((u.data || []).filter((x: any) => x.activa !== false)); setLugares(l.data || []); setCharlas(c.data || []); setAsist(a.data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const guardarLugar = async (ubId: string, lugar: string) => {
    const { error } = lugar
      ? await supabase.from('pr_cap_ubic_lugar').upsert({ ubicacion_id: ubId, lugar })
      : await supabase.from('pr_cap_ubic_lugar').delete().eq('ubicacion_id', ubId)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const lugarDe = (id: string) => lugares.find(l => l.ubicacion_id === id)?.lugar as string | undefined
  // ubicaciones consideradas según filtros (solo clasificadas)
  const base = useMemo(() => ubics.filter(u => lugarDe(u.id) && (!fUbic || u.id === fUbic) && (!fLugar || lugarDe(u.id) === fLugar)), [ubics, lugares, fUbic, fLugar]) // eslint-disable-line react-hooks/exhaustive-deps
  const hoy = mesHoy()

  const filas = useMemo(() => prog.map(p => {
    const req = base.filter(u => aplica(p, lugarDe(u.id)))
    return { p, req, celdas: Object.keys(p.meses).map(Number).sort((a, b) => a - b).map(m => {
      const k = mesKey(anio, m)
      const hechas = req.filter(u => charlas.some(c => c.programa_id === p.id && c.ubicacion_id === u.id && c.fecha.slice(0, 7) === k)).length
      return { m, k, cod: p.meses[m], hechas, requeridas: req.length, e: req.length ? estadoCelda(k, hechas, req.length, hoy) : 'futuro' as const }
    }) }
  }).filter(f => f.req.length > 0), [prog, base, charlas, lugares, hoy]) // eslint-disable-line react-hooks/exhaustive-deps

  const aCorte = filas.flatMap(f => f.celdas.filter(c => c.k <= hoy))
  const debidas = aCorte.reduce((s, c) => s + c.requeridas, 0), hechas = aCorte.reduce((s, c) => s + c.hechas, 0)
  const cumpl = debidas ? Math.round(hechas / debidas * 100) : 100
  const atrasadas = aCorte.filter(c => c.e === 'atraso').length
  const horasAsist = charlas.filter(c => c.fecha.startsWith(String(anio))).length
  const nAsist = asist.length

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Programa Anual de Capacitaciones {anio}</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <div style={{ ...card, marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '14px' }}>1 · Clasifica cada faena</p>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Indica a qué grupo del programa pertenece cada ubicación (Oficina central, ENGIE, SACYR - EUROHINCA o SQM). Así se sabe qué capacitaciones le corresponden.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '8px' }}>
                {ubics.map(u => (
                  <div key={u.id}><label style={label}>{u.nombre}</label>
                    <select value={lugarDe(u.id) || ''} onChange={e => guardarLugar(u.id, e.target.value)} style={input}><option value="">Sin clasificar</option>{Object.entries(LUGARES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <select value={fLugar} onChange={e => setFLugar(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Todos los grupos</option>{Object.entries(LUGARES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <select value={fUbic} onChange={e => setFUbic(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Todas las faenas</option>{ubics.filter(u => lugarDe(u.id)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '12px' }}>
              {[[`${cumpl}%`, 'Cumplimiento a la fecha'], [atrasadas, 'Capacitaciones atrasadas'], [horasAsist, `Charlas del programa ${anio}`], [nAsist, 'Asistencias registradas (charlas)']].map(([v, t]) => (
                <div key={String(t)} style={{ ...card, textAlign: 'center' }}><p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: AZUL }}>{v}</p><p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{t}</p></div>
              ))}
            </div>

            {filas.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>Clasifica al menos una faena arriba para ver el cumplimiento.</p> : (
              <div style={{ ...card, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '820px' }}>
                  <thead><tr style={{ textAlign: 'left', color: '#667085' }}><th style={{ padding: '6px' }}>N°</th><th style={{ padding: '6px' }}>Temática</th>{MESES_C.map(m => <th key={m} style={{ padding: '6px 2px', textAlign: 'center' }}>{m}</th>)}</tr></thead>
                  <tbody>
                    {filas.map(f => (
                      <tr key={f.p.id} style={{ borderTop: '1px solid #eef1f6' }}>
                        <td style={{ padding: '6px' }}>{f.p.n}</td>
                        <td style={{ padding: '6px', minWidth: '220px' }}><span style={{ fontWeight: 600 }}>{f.p.tematica}</span><br /><span style={{ color: '#98a2b3', fontSize: '10.5px' }}>{f.p.categoria} · {f.p.horas} h</span></td>
                        {MESES_C.map((_, i) => {
                          const c = f.celdas.find(x => x.m === i + 1)
                          if (!c) return <td key={i} />
                          const [bg, col] = COLOR_CELDA[c.e]
                          return <td key={i} style={{ padding: '3px 2px', textAlign: 'center' }}><span title={`${c.hechas} de ${c.requeridas} faena(s)`} style={{ display: 'block', padding: '4px 0', borderRadius: '6px', background: bg, color: col, fontWeight: 700, fontSize: '11px' }}>{c.hechas}/{c.requeridas}</span></td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: '11.5px', color: '#98a2b3', margin: '10px 0 0' }}>Cada celda muestra cuántas faenas ya realizaron la capacitación sobre cuántas les corresponden. Verde: completa · amarillo: en curso · rojo: atrasada · azul: este mes · gris: futura. Una capacitación cuenta como realizada cuando el prevencionista registra la charla vinculada al programa.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

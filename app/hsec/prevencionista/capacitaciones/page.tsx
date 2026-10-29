'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card } from '@/components/programa/ui'
import { misUbicacionesIds } from '@/lib/prevencion'
import { MESES_C, mesKey, mesHoy, aplica, estadoCelda, COLOR_CELDA } from '@/lib/capacitaciones'

const anio = new Date().getFullYear()
export default function CapPrevencionista() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esJefe = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const puede = esJefe || !!usuario?.esPrevencionista
  const [prog, setProg] = useState<any[]>([])
  const [ubics, setUbics] = useState<any[]>([])
  const [lugares, setLugares] = useState<any[]>([])
  const [charlas, setCharlas] = useState<any[]>([])
  const [ubic, setUbic] = useState('')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!usuario) return
    const [p, u, l, c] = await Promise.all([
      supabase.from('pr_cap_programa').select('*').eq('anio', anio).eq('activo', true).order('n'),
      supabase.from('ubicaciones').select('id,nombre,activa').order('nombre'),
      supabase.from('pr_cap_ubic_lugar').select('*'),
      supabase.from('pr_charlas').select('id,programa_id,ubicacion_id,fecha').not('programa_id', 'is', null),
    ])
    const propias = esJefe ? null : await misUbicacionesIds(usuario.id)
    const lista = (u.data || []).filter((x: any) => x.activa !== false && (!propias || propias.has(x.id)))
    setProg(p.data || []); setUbics(lista); setLugares(l.data || []); setCharlas(c.data || [])
    setUbic(prev => prev && lista.some((x: any) => x.id === prev) ? prev : (lista[0]?.id || '')); setCargando(false)
  }, [usuario, esJefe])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const lugar = lugares.find(l => l.ubicacion_id === ubic)?.lugar
  const hoy = mesHoy()
  const filas = useMemo(() => prog.filter(p => aplica(p, lugar)).map(p => ({
    p, celdas: Object.keys(p.meses).map(Number).sort((a, b) => a - b).map(m => {
      const k = mesKey(anio, m)
      const hechas = charlas.filter(c => c.programa_id === p.id && c.ubicacion_id === ubic && c.fecha.slice(0, 7) === k).length
      return { m, k, e: estadoCelda(k, hechas, 1, hoy), hechas, cod: p.meses[m] }
    }),
  })), [prog, lugar, charlas, ubic, hoy])
  const pendientes = filas.flatMap(f => f.celdas.filter(c => (c.e === 'atraso' || c.e === 'actual') && c.hechas === 0).map(c => ({ ...c, p: f.p })))
  const planificadas = filas.flatMap(f => f.celdas.filter(c => c.k <= hoy))
  const cumpl = planificadas.length ? Math.round(planificadas.filter(c => c.hechas > 0).length / planificadas.length * 100) : 100

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/prevencionista/sso" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← SSO Faena</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Capacitaciones y charlas {anio}</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  const wrap = (c: React.ReactNode) => <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>{cab}{c}</div></main>
  if (!puede) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p>)
  if (cargando) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)
  if (ubics.length === 0) return wrap(<p style={{ fontSize: '13px', color: '#667085' }}>Todavía no tienes una faena asignada. La jefatura te la asignará.</p>)

  return wrap(
    <>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
        <select value={ubic} onChange={e => setUbic(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#fff' }}>{ubics.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        <span style={{ fontSize: '13px', color: '#667085' }}>Cumplimiento a la fecha: <strong style={{ color: cumpl >= 100 ? '#1e8e4e' : '#16213E' }}>{cumpl}%</strong></span>
      </div>
      {!lugar && <p style={{ fontSize: '12px', color: '#986a00', margin: '0 0 10px' }}>La jefatura aún no clasifica esta faena (ENGIE / SQM / SACYR / oficina); por ahora ves todo el programa.</p>}

      <Link href="/hsec/prevencionista/charlas" style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit', marginBottom: '12px' }}>
        <span><strong style={{ fontSize: '13.5px', color: '#16213E' }}>🗣️ Charlas y lista de asistentes</strong><br /><span style={{ fontSize: '12px', color: '#667085' }}>Ver las charlas realizadas o registrar una charla libre (fuera del programa)</span></span>
        <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', background: AZUL, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>Abrir</span>
      </Link>

      <div style={{ ...card, marginBottom: '12px', background: pendientes.length ? '#fff8e5' : '#e7f6ec', borderColor: pendientes.length ? '#f0d98a' : '#b9e2c8' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: pendientes.length ? '#7a5600' : '#14532d' }}>{pendientes.length ? `🗓️ Por realizar o atrasadas (${pendientes.length})` : '✅ Estás al día con el programa'}</p>
        {pendientes.map(x => (
          <div key={x.p.id + x.k} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#344054' }}>{x.p.n}. {x.p.tematica} <span style={{ color: x.e === 'atraso' ? '#9b1c1c' : '#667085' }}>· {MESES_C[x.m - 1]}{x.e === 'atraso' ? ' (atrasada)' : ' (este mes)'}</span></span>
            <Link href={`/hsec/prevencionista/charlas?prog=${x.p.id}`} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', background: AZUL, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Registrar</Link>
          </div>
        ))}
      </div>

      <div style={card}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Programa anual de esta faena</p>
        {filas.map(f => (
          <div key={f.p.id} style={{ borderTop: '1px solid #eef1f6', padding: '8px 0' }}>
            <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600 }}>{f.p.n}. {f.p.tematica}</p>
            <p style={{ margin: '0 0 5px', fontSize: '11.5px', color: '#667085' }}>{f.p.horas} h · {f.p.tipo === 'difusion' ? 'difusión' : 'capacitación'} · relator {f.p.resp_curso}</p>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {f.celdas.map(c => { const [bg, col] = COLOR_CELDA[c.e]; return <span key={c.k} style={{ fontSize: '11.5px', padding: '3px 9px', borderRadius: '8px', background: bg, color: col, fontWeight: 600 }}>{MESES_C[c.m - 1]}{c.cod !== 'P' ? ` ${c.cod}` : ''} {c.e === 'ok' ? '✓' : c.e === 'atraso' ? '✗' : ''}</span> })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

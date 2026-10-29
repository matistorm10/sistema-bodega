'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { TIPOS_CHARLA, fechaCL } from '@/lib/prevencion'
import { periodos, estadoSemanal } from '@/lib/semanal'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
const input: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', background: '#fff' }
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

function Barras({ titulo, filas, vacio }: { titulo: string, filas: { nombre: string, valor: number }[], vacio?: string }) {
  const max = Math.max(1, ...filas.map(f => f.valor))
  return (
    <div style={card}>
      <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>{titulo}</p>
      {filas.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>{vacio || 'Sin datos en el período.'}</p> : filas.map(f => (
        <div key={f.nombre} style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
            <span style={{ color: '#344054' }}>{f.nombre}</span><strong>{f.valor}</strong>
          </div>
          <div style={{ height: '8px', background: '#eef1f6', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${(f.valor / max) * 100}%`, height: '100%', background: AZUL, borderRadius: '6px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Jefatura() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puede = esAdmin || !!usuario?.esJefeHsec

  const [charlas, setCharlas] = useState<any[]>([])
  const [asistentes, setAsistentes] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [informes, setInformes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [asigs, setAsigs] = useState<any[]>([])
  const [semanales, setSemanales] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [fFaena, setFFaena] = useState('')
  const [fPrev, setFPrev] = useState('')

  useEffect(() => {
    if (!usuario || !puede) return
    ;(async () => {
      const [c, a, f, u, inf, cl, asg, sem] = await Promise.all([
        supabase.from('pr_charlas').select('*').order('fecha', { ascending: false }),
        supabase.from('pr_charla_asistentes').select('id,charla_id,nombre,rut'),
        supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
        supabase.from('usuarios').select('id,nombre'),
        supabase.from('pr_informes_diarios').select('id,fecha,ubicacion_id,creado_por,estado').order('fecha', { ascending: false }),
        supabase.from('pr_clientes_informe').select('*').eq('activo', true),
        supabase.from('pr_semanal_asignaciones').select('*'),
        supabase.from('pr_informes_semanales').select('cliente_id,usuario_id,periodo_fin'),
      ])
      setInformes(inf.data || []); setClientes(cl.data || []); setAsigs(asg.data || []); setSemanales(sem.data || [])
      setCharlas(c.data || []); setAsistentes(a.data || [])
      setFaenas((f.data || []).filter((x: any) => x.activa !== false)); setUsuarios(u.data || [])
      setCargando(false)
    })()
  }, [usuario, puede])

  const nombreFaena = (id?: string | null) => faenas.find(f => f.id === id)?.nombre || 'Sin faena'
  const nombreUsuario = (id: string) => usuarios.find(u => u.id === id)?.nombre || '—'

  const desde = useMemo(() => {
    const h = new Date()
    if (periodo === 'mes') return iso(new Date(h.getFullYear(), h.getMonth(), 1))
    if (periodo === '30') return iso(new Date(h.getTime() - 30 * 86400000))
    if (periodo === 'anio') return iso(new Date(h.getFullYear(), 0, 1))
    return '0000-01-01'
  }, [periodo])

  const filtradas = useMemo(() => charlas.filter(c =>
    c.fecha >= desde && (!fFaena || c.ubicacion_id === fFaena) && (!fPrev || c.creado_por === fPrev)), [charlas, desde, fFaena, fPrev])
  const asistPorCharla = useMemo(() => {
    const m: Record<string, number> = {}
    asistentes.forEach(a => { m[a.charla_id] = (m[a.charla_id] || 0) + 1 })
    return m
  }, [asistentes])

  const totalAsist = filtradas.reduce((s, c) => s + (asistPorCharla[c.id] || 0), 0)
  const promedio = filtradas.length ? Math.round((totalAsist / filtradas.length) * 10) / 10 : 0
  const horas = Math.round(filtradas.reduce((s, c) => s + (c.duracion_min || 0) * (asistPorCharla[c.id] || 0), 0) / 60 * 10) / 10

  const contar = (clave: (c: any) => string) => {
    const m: Record<string, number> = {}
    filtradas.forEach(c => { const k = clave(c); m[k] = (m[k] || 0) + 1 })
    return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor)
  }
  const porFaena = contar(c => nombreFaena(c.ubicacion_id))
  const porPrev = contar(c => nombreUsuario(c.creado_por))
  const porTipo = contar(c => TIPOS_CHARLA[c.tipo] || c.tipo)
  const infFiltrados = informes.filter(i => i.fecha >= desde && (!fFaena || i.ubicacion_id === fFaena) && (!fPrev || i.creado_por === fPrev))
  const infPorPrev = (() => { const m: Record<string, number> = {}; infFiltrados.forEach(i => { const k = nombreUsuario(i.creado_por); m[k] = (m[k] || 0) + 1 }); return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor) })()
  const semAtrasados = asigs.flatMap(a => {
    const c = clientes.find(x => x.id === a.cliente_id); if (!c) return []
    return periodos(c.dia_cierre, 4).filter(fin => estadoSemanal(fin, c.dias_plazo, semanales.some(s => s.cliente_id === c.id && s.usuario_id === a.usuario_id && s.periodo_fin === fin)).tipo === 'atraso')
      .map(fin => ({ k: a.id + fin, texto: `${nombreUsuario(a.usuario_id)} · ${c.nombre} · semana al ${fin.split('-').reverse().join('-').slice(0, 5)}` }))
  })
  const faenasSinActividad = faenas.filter(f => (!fFaena || f.id === fFaena) && !filtradas.some(c => c.ubicacion_id === f.id))

  // últimos 6 meses (ignora el filtro de período, respeta faena y prevencionista)
  const porMes = useMemo(() => {
    const h = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(h.getFullYear(), h.getMonth() - (5 - i), 1)
      const pref = iso(d).slice(0, 7)
      const valor = charlas.filter(c => c.fecha.startsWith(pref) && (!fFaena || c.ubicacion_id === fFaena) && (!fPrev || c.creado_por === fPrev)).length
      return { nombre: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, valor }
    })
  }, [charlas, fFaena, fPrev])

  const kpi = (valor: string | number, texto: string) => (
    <div style={{ ...card, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: AZUL }}>{valor}</p>
      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{texto}</p>
    </div>
  )

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/hsec" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Prevención de Riesgo</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Panel de Jefatura</h1>
        </div>

        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección. Pídele al administrador que te la habilite en Usuarios.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={input}>
                <option value="mes">Este mes</option><option value="30">Últimos 30 días</option><option value="anio">Este año</option><option value="todo">Todo el historial</option>
              </select>
              <select value={fFaena} onChange={e => setFFaena(e.target.value)} style={input}>
                <option value="">Todas las faenas</option>{faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
              <select value={fPrev} onChange={e => setFPrev(e.target.value)} style={input}>
                <option value="">Todos los prevencionistas</option>
                {Array.from(new Set(charlas.map(c => c.creado_por))).map(id => <option key={id} value={id}>{nombreUsuario(id)}</option>)}
              </select>
            </div>

            <Link href="/hsec/jefatura/sso" style={{ textDecoration: 'none', color: 'inherit', ...card, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: 'rgba(27,79,156,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px' }}>📋</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '14.5px', margin: '0 0 2px', color: '#16213E' }}>SSO Faena · Descriptores de cargo</p>
                <p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>Asignar prevencionistas a faenas, cargar el descriptor y verificar firmas</p>
              </div>
            </Link>

            <Link href="/hsec/jefatura/programa" style={{ textDecoration: 'none', color: 'inherit', ...card, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: 'rgba(27,79,156,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px' }}>📈</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '14.5px', margin: '0 0 2px', color: '#16213E' }}>Programa de liderazgo · aprobación mensual</p>
                <p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>Cumplimiento de cada persona, revisión de sus actividades y aprobación del mes</p>
              </div>
            </Link>

            <Link href="/hsec/jefatura/semanales" style={{ textDecoration: 'none', color: 'inherit', ...card, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: 'rgba(27,79,156,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px' }}>🗓️</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '14.5px', margin: '0 0 2px', color: '#16213E' }}>Informes semanales por cliente</p>
                <p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>Formato y calendario de cada cliente, asignación de prevencionistas y semáforo de entregas</p>
              </div>
              {semAtrasados.length > 0 && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#fde8e8', color: '#9b1c1c', fontWeight: 700 }}>🔴 {semAtrasados.length} atrasado{semAtrasados.length === 1 ? '' : 's'}</span>}
            </Link>

            {semAtrasados.length > 0 && (
              <div style={{ ...card, background: '#fde8e8', borderColor: '#f3b4b4', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#9b1c1c' }}>⚠️ Informes semanales atrasados</p>
                {semAtrasados.map(x => <p key={x.k} style={{ margin: '2px 0', fontSize: '12.5px', color: '#9b1c1c' }}>{x.texto}</p>)}
              </div>
            )}

            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>📝 Informes diarios SSO</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '10px', marginBottom: '16px' }}>
              {kpi(infFiltrados.length, 'Informes diarios en el período')}
              <Barras titulo="Informes diarios por prevencionista" filas={infPorPrev} vacio="Sin informes en el período." />
            </div>

            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>🗣️ Charlas y capacitaciones</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '12px' }}>
              {kpi(filtradas.length, 'Charlas realizadas')}
              {kpi(totalAsist, 'Asistencias registradas')}
              {kpi(promedio, 'Asistentes por charla')}
              {kpi(horas, 'Horas de capacitación (hombre)')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '10px', marginBottom: '12px' }}>
              <Barras titulo="Charlas por faena" filas={porFaena} />
              <Barras titulo="Charlas por prevencionista" filas={porPrev} />
              <Barras titulo="Por tipo" filas={porTipo} />
              <Barras titulo="Últimos 6 meses" filas={porMes} />
            </div>

            {faenasSinActividad.length > 0 && (
              <div style={{ ...card, background: '#fff8e5', borderColor: '#f0d98a', marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px', color: '#7a5600' }}>⚠️ Faenas sin charlas en este período</p>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#7a5600' }}>{faenasSinActividad.map(f => f.nombre).join(' · ')}</p>
              </div>
            )}

            <div style={card}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>Últimas charlas</p>
              {filtradas.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Sin charlas en el período.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#667085' }}>
                      <th style={{ padding: '6px 8px' }}>Fecha</th><th style={{ padding: '6px 8px' }}>Tema</th><th style={{ padding: '6px 8px' }}>Tipo</th>
                      <th style={{ padding: '6px 8px' }}>Faena</th><th style={{ padding: '6px 8px' }}>Prevencionista</th><th style={{ padding: '6px 8px' }}>Asist.</th>
                    </tr></thead>
                    <tbody>
                      {filtradas.slice(0, 15).map(c => (
                        <tr key={c.id} style={{ borderTop: '1px solid #eef1f6' }}>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{fechaCL(c.fecha)}</td>
                          <td style={{ padding: '6px 8px' }}>{c.tema}</td>
                          <td style={{ padding: '6px 8px' }}>{TIPOS_CHARLA[c.tipo] || c.tipo}</td>
                          <td style={{ padding: '6px 8px' }}>{nombreFaena(c.ubicacion_id)}</td>
                          <td style={{ padding: '6px 8px' }}>{nombreUsuario(c.creado_por)}</td>
                          <td style={{ padding: '6px 8px' }}>{asistPorCharla[c.id] || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

'use client'
import { traerContratosOp } from '@/lib/operaciones'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card } from '@/components/programa/ui'
import Marco from '@/components/operaciones/Marco'
import FiltroContratos from '@/components/operaciones/FiltroContratos'
import { descargarXlsx, etiquetaContrato, traerTodo, hoyISO, sumarDias, fechaCorta, estadoEn, asigEn, type Asig, type Turno, type Vuelo } from '@/lib/operaciones'

export default function Operaciones() {
  const { usuario: usuarioOp } = useUsuarioActual(); const completo = !!usuarioOp?.operacionesCompleto
  const [trab, setTrab] = useState<any[]>([])
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [vuelos, setVuelos] = useState<Vuelo[]>([])
  const [fc, setFc] = useState<string[]>([]); const [hoverDia, setHoverDia] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const hoy = hoyISO()

  useEffect(() => {
    (async () => {
      try {
        const [t, a, tu, vu, c] = await Promise.all([traerTodo('op_trabajadores'), traerTodo('op_asignaciones'), traerTodo('op_turnos'), traerTodo('op_vuelos'), traerContratosOp('id,nombre,cliente:pr_clientes_informe(nombre),referencia,activo')])
        setTrab(t); setAsigs(a as Asig[]); setTurnos(tu as Turno[]); setVuelos(vu as Vuelo[]); setContratos(c.data || [])
      } catch (e: any) { setError(e.message || 'No se pudo cargar') }
      setCargando(false)
    })()
  }, [])

  const nTrab = (id: string) => trab.find(t => t.id === id)?.nombre || '—'
  const nCont = (id?: string) => etiquetaContrato(contratos.find(x => x.id === id))
  const activos = trab.filter(t => t.activo && t.tipo_personal !== 'backoffice')
  const nBO = trab.filter(t => t.activo && t.tipo_personal === 'backoffice').length
  const idsActivos = new Set(activos.map(t => t.id)) // solo personal de contratos activo: sin Back Office ni retirados
  const filas = contratos.map(c => {
    const ids = asigs.filter(a => a.contrato_id === c.id && idsActivos.has(a.trabajador_id) && a.desde <= hoy && (!a.hasta || a.hasta >= hoy)).map(a => a.trabajador_id)
    const enFaena = ids.filter(id => estadoEn(asigs, turnos, id, hoy) === 'faena').length
    return { c, total: ids.length, enFaena, descanso: ids.length - enFaena }
  }).filter(f => f.total > 0)
  const totEn = filas.reduce((a, f) => a + f.enFaena, 0), totDesc = filas.reduce((a, f) => a + f.descanso, 0)
  const sinContratoHoy = activos.filter(t => !asigEn(asigs, t.id, hoy)).length

  const kpi = (n: number | string, t: string, col = '#16213E') => <div style={{ ...card, textAlign: 'center' }}><p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: col }}>{n}</p><p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#667085' }}>{t}</p></div>
  // Personal en faena por día del mes presente, por contrato y total
  const mesIni = hoy.slice(0, 7) + '-01'
  const diasMes = useMemo(() => { const d = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0).getDate(); return Array.from({ length: d }, (_, i) => sumarDias(mesIni, i)) }, [hoy]) // eslint-disable-line react-hooks/exhaustive-deps
  const serie = useMemo(() => {
    const porC: Record<string, number[]> = {}; const total = diasMes.map(() => 0)
    diasMes.forEach((d, i) => activos.forEach(t => {
      const a = asigEn(asigs, t.id, d); if (!a || estadoEn(asigs, turnos, t.id, d) !== 'faena') return
      ;(porC[a.contrato_id] ||= diasMes.map(() => 0))[i]++; total[i]++
    }))
    return { porC, total }
  }, [trab, asigs, turnos, diasMes]) // eslint-disable-line react-hooks/exhaustive-deps
  const PALETA = ['#1B4F9C', '#e8710a', '#0f9d9a', '#9334e6', '#c5221f', '#7a8a00', '#d6409f', '#5f6b7a']
  const lineas = contratos.filter(c => serie.porC[c.id] && (fc.length === 0 || fc.includes(c.id))).map((c, i) => ({ id: c.id, nombre: etiquetaContrato(c, 50), datos: serie.porC[c.id], col: PALETA[i % PALETA.length] }))
  const ymax = Math.max(5, ...serie.total, ...lineas.flatMap(l => l.datos)); const yTope = Math.ceil(ymax / 5) * 5
  const GW = 820, GH = 300, ML = 38, MR = 12, MT = 14, MB = 28
  const gx = (i: number) => ML + (diasMes.length <= 1 ? 0 : i * (GW - ML - MR) / (diasMes.length - 1)), gy = (v: number) => MT + (GH - MT - MB) * (1 - v / yTope)
  const trazo = (d: number[]) => d.map((v, i) => `${i === 0 ? 'M' : 'L'}${gx(i).toFixed(1)},${gy(v).toFixed(1)}`).join(' ')
  // Pasajes: comprados vs por comprar (por comprar solo de trabajadores activos)
  const vigentes = vuelos.filter(v => v.estado === 'comprado' || trab.find(t => t.id === v.trabajador_id)?.activo !== false)
  const indicePasajes = (desde: string, hasta: string) => { const l = vigentes.filter(v => v.fecha >= desde && v.fecha <= hasta); const c = l.filter(v => v.estado === 'comprado').length; return { c, p: l.length - c, pct: l.length ? Math.round(c * 100 / l.length) : 0 } }
  const finMes = diasMes[diasMes.length - 1]
  const pMes = indicePasajes(mesIni, finMes), pFut = indicePasajes(hoy, '9999-12-31'), pUrg = vigentes.filter(v => v.estado === 'por_comprar' && v.fecha >= hoy && v.fecha <= sumarDias(hoy, 7)).length
  const kpi2 = (n: number | string, t: string, col = '#16213E') => <div style={{ flex: '1 1 90px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: col }}>{n}</p><p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#667085' }}>{t}</p></div>
  const bloquePasajes = (titulo: string, p: { c: number, p: number, pct: number }) => (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: '#475467' }}>{titulo}</p>
      <div style={{ display: 'flex', gap: '6px' }}>{kpi2(p.c, 'comprados', '#e8710a')}{kpi2(p.p, 'por comprar', p.p ? '#c5221f' : '#1e8e4e')}{kpi2(p.pct + '%', 'comprado')}</div>
      <div style={{ height: '8px', borderRadius: '6px', background: '#fde2e1', overflow: 'hidden', marginTop: '6px' }}><div style={{ width: p.pct + '%', height: '100%', background: '#e8710a' }} /></div>
    </div>
  )
  const acceso = (href: string, icono: string, t: string, d: string) => (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', ...card, display: 'flex', alignItems: 'center', gap: '14px', borderColor: AZUL }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(27,79,156,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px' }}>{icono}</div>
      <div><p style={{ fontWeight: 700, fontSize: '14.5px', margin: '0 0 2px', color: '#16213E' }}>{t}</p><p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>{d}</p></div>
    </Link>
  )

  const [respaldando, setRespaldando] = useState(false)
  const respaldo = async () => {
    setRespaldando(true)
    try {
      const tablas = ['op_trabajadores', 'op_asignaciones', 'op_turnos', 'op_vuelos', 'op_cupos', 'op_fallos', 'pr_contratos']
      const datos: Record<string, any[]> = {}
      for (const t of tablas) datos[t] = await traerTodo(t)
      await descargarXlsx(`Respaldo_Operaciones_${hoy}.xlsx`, async (X) => {
        const wb = new X.Workbook()
        for (const t of tablas) {
          const filas = datos[t]; const cols = filas.length ? Object.keys(filas[0]) : ['(sin datos)']
          const ws = wb.addWorksheet(t.replace(/^(op|pr)_/, '')); ws.addRow(cols).font = { bold: true }
          filas.forEach(f => ws.addRow(cols.map(c => { const v = f[c]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v })))
          ws.views = [{ state: 'frozen', ySplit: 1 }]
        }
        return wb
      })
    } catch (e: any) { alert('No se pudo generar el respaldo: ' + (e?.message || e)) } finally { setRespaldando(false) }
  }
  return (
    <Marco titulo="Operaciones" volver="/" volverTxt="← Inicio">
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : error ? <p style={{ fontSize: '13px', color: '#c5221f' }}>{error}</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '10px', marginBottom: '14px' }}>
            {acceso('/operaciones/trabajadores', '👷', 'Trabajadores', 'Ficha, contratos, plazos y turnos de cada persona')}
            {acceso('/operaciones/turnos', '🗓️', 'Turnos', 'Grilla de quién está en faena cada día, por contrato, con descarga a Excel')}
            {completo && acceso('/operaciones/dotacion', '🧩', 'Dotación por contrato', 'Cargos vendidos por contrato, cupos con y sin nombre, reemplazos')}
            {acceso('/operaciones/vuelos', '✈️', 'Vuelos y pasajes', 'Qué pasajes están por comprar y cuáles ya se compraron, con el aeropuerto de origen de cada trabajador')}
          </div>
          {completo && <div style={{ margin: '-4px 0 14px' }}><button onClick={respaldo} disabled={respaldando} style={{ border: '1px solid #d0d5dd', background: '#fff', borderRadius: '8px', padding: '7px 12px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: '#475467' }}>{respaldando ? 'Preparando respaldo…' : '💾 Descargar respaldo de datos (Excel)'}</button> <span style={{ fontSize: '11.5px', color: '#98a2b3' }}>trabajadores, contratos, turnos, vuelos y cupos, para guardar una copia propia</span></div>}
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>Dónde está el personal hoy ({fechaCorta(hoy)})</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '12px' }}>
            {kpi(totEn, 'En faena', '#1e8e4e')}{kpi(totDesc, 'En descanso', '#1B4F9C')}{kpi(activos.length, 'Trabajadores activos')}{kpi(nBO, 'Back Office', '#1B4F9C')}{kpi(sinContratoHoy, 'Activos sin contrato hoy', sinContratoHoy ? '#b7791f' : '#1e8e4e')}{kpi(activos.filter(t => t.examenes === 'pendiente').length, 'Exámenes pendientes', '#b7791f')}
          </div>
          <div style={{ ...card, marginBottom: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ textAlign: 'left', color: '#667085', fontSize: '12px' }}><th style={{ padding: '6px 8px' }}>Contrato</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>En faena</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Descanso</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>{filas.map(f => (
                <tr key={f.c.id} style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 600 }}><Link href={`/operaciones/turnos?contrato=${f.c.id}`} style={{ color: AZUL, textDecoration: 'none' }}>{nCont(f.c.id)}</Link></td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#1e8e4e' }}>{f.enFaena}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right' }}>{f.descanso}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700 }}>{f.total}</td>
                </tr>))}
                {filas.length === 0 && <tr><td colSpan={4} style={{ padding: '10px', fontSize: '12.5px', color: '#999' }}>Aún no hay trabajadores asignados a contratos hoy.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '12px', alignItems: 'start' }}>
            <div style={{ ...card, gridColumn: 'span 2', minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>Personal en faena por día · {new Date(mesIni + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</p>
                <span style={{ marginLeft: 'auto' }}><FiltroContratos contratos={contratos.filter(c => serie.porC[c.id])} sel={fc} onChange={setFc} /></span>
              </div>
              <div style={{ position: 'relative' }}>
                <svg viewBox={`0 0 ${GW} ${GH}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHoverDia(null)}>
                  {Array.from({ length: yTope / 5 + 1 }, (_, k) => k * 5).map(v => <g key={v}><line x1={ML} x2={GW - MR} y1={gy(v)} y2={gy(v)} stroke="#eef1f6" /><text x={ML - 6} y={gy(v) + 4} fontSize="10.5" textAnchor="end" fill="#667085">{v}</text></g>)}
                  {diasMes.map((d, i) => (i % (diasMes.length > 20 ? 2 : 1) === 0 || i === diasMes.length - 1) && <text key={d} x={gx(i)} y={GH - 10} fontSize="10.5" textAnchor="middle" fill={d === hoy ? '#1B4F9C' : '#667085'} fontWeight={d === hoy ? 700 : 400}>{i + 1}</text>)}
                  {diasMes.includes(hoy) && <line x1={gx(diasMes.indexOf(hoy))} x2={gx(diasMes.indexOf(hoy))} y1={MT} y2={GH - MB} stroke="#1B4F9C" strokeDasharray="3 3" opacity=".5" />}
                  {lineas.map(l => <path key={l.id} d={trazo(l.datos)} fill="none" stroke={l.col} strokeWidth="2" strokeLinejoin="round" />)}
                  <path d={trazo(serie.total)} fill="none" stroke="#16213E" strokeWidth="3" strokeDasharray="7 4" strokeLinejoin="round" />
                  {hoverDia !== null && <g><line x1={gx(hoverDia)} x2={gx(hoverDia)} y1={MT} y2={GH - MB} stroke="#98a2b3" />{lineas.map(l => <circle key={l.id} cx={gx(hoverDia)} cy={gy(l.datos[hoverDia])} r="3.5" fill={l.col} />)}<circle cx={gx(hoverDia)} cy={gy(serie.total[hoverDia])} r="4" fill="#16213E" /></g>}
                  {diasMes.map((d, i) => <rect key={d} x={gx(i) - (GW - ML - MR) / (diasMes.length - 1) / 2} y={MT} width={(GW - ML - MR) / (diasMes.length - 1)} height={GH - MT - MB} fill="transparent" onMouseEnter={() => setHoverDia(i)} />)}
                </svg>
                {hoverDia !== null && (
                  <div style={{ position: 'absolute', top: 0, left: hoverDia > diasMes.length / 2 ? undefined : `${gx(hoverDia) / GW * 100 + 2}%`, right: hoverDia > diasMes.length / 2 ? `${100 - gx(hoverDia) / GW * 100 + 2}%` : undefined, background: '#fff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '6px 9px', fontSize: '11.5px', boxShadow: '0 4px 14px rgba(16,24,40,.15)', pointerEvents: 'none', maxWidth: '260px' }}>
                    <strong>{fechaCorta(diasMes[hoverDia])}</strong>
                    {lineas.map(l => <div key={l.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><span style={{ width: '9px', height: '9px', borderRadius: '50%', background: l.col, flexShrink: 0 }} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</span><strong>{l.datos[hoverDia]}</strong></div>)}
                    <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid #eef1f6', marginTop: '3px', paddingTop: '3px' }}><span style={{ flex: 1 }}>Total todos los contratos</span><strong>{serie.total[hoverDia]}</strong></div>
                  </div>)}
              </div>
              <div style={{ display: 'flex', gap: '6px 16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '12px' }}>
                {lineas.map(l => <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '16px', height: '3px', background: l.col, borderRadius: '2px' }} />{l.nombre}</span>)}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}><span style={{ width: '16px', borderTop: '3px dashed #16213E' }} />Total todos los contratos (máx. {Math.max(...serie.total)})</span>
              </div>
            </div>
            <div style={{ ...card, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}><p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>✈️ Pasajes</p><Link href="/operaciones/vuelos" style={{ marginLeft: 'auto', fontSize: '12px', color: AZUL, textDecoration: 'none', fontWeight: 600 }}>Ver detalle →</Link></div>
              {bloquePasajes('Este mes', pMes)}
              {bloquePasajes('Desde hoy en adelante', pFut)}
              <p style={{ margin: 0, fontSize: '12px', color: pUrg ? '#c5221f' : '#667085', fontWeight: pUrg ? 700 : 400 }}>{pUrg ? `⚠️ ${pUrg} pasaje(s) por comprar con viaje en los próximos 7 días` : 'Sin pasajes pendientes para los próximos 7 días.'}</p>
            </div>
          </div>
        </>
      )}
    </Marco>
  )
}

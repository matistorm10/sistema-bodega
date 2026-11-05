'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AZUL } from '@/lib/theme'
import { card, btn, input } from '@/components/programa/ui'
import Marco from '@/components/operaciones/Marco'
import { useCiudades } from '@/components/operaciones/useCiudades'
import PanelVuelos from '@/components/operaciones/PanelVuelos'
import { traerTodo, hoyISO, fechaCorta, descargarXlsx, ESTADOS_VUELO, type Vuelo } from '@/lib/operaciones'

export default function VuelosPasajes() {
  const ciu = useCiudades()
  const hoy = hoyISO()
  const [vuelos, setVuelos] = useState<Vuelo[]>([]); const [trab, setTrab] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [fEstado, setFEstado] = useState('por_comprar'); const [fOrigen, setFOrigen] = useState(''); const [fTipo, setFTipo] = useState(''); const [q, setQ] = useState(''); const [pasados, setPasados] = useState(false)
  const [ed, setEd] = useState<Vuelo | null>(null)
  const cargar = async () => { const [v, t] = await Promise.all([traerTodo('op_vuelos', '*', 'fecha'), traerTodo('op_trabajadores', '*', 'nombre')]); setVuelos(v as Vuelo[]); setTrab(t); setCargando(false) }
  useEffect(() => { cargar() }, [])
  const tr = (id: string) => trab.find(t => t.id === id)
  const filas = useMemo(() => vuelos.filter(v => (pasados || v.fecha >= hoy) && (tr(v.trabajador_id)?.activo !== false || v.estado !== 'por_comprar') && (!fEstado || v.estado === fEstado) && (!fTipo || v.tipo === fTipo) && (!fOrigen || (fOrigen === '_sin' ? !tr(v.trabajador_id)?.ciudad : tr(v.trabajador_id)?.ciudad === fOrigen)) &&
    (!q.trim() || (tr(v.trabajador_id)?.nombre || '').toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.fecha.localeCompare(b.fecha) || (tr(a.trabajador_id)?.nombre || '').localeCompare(tr(b.trabajador_id)?.nombre || '')),
    [vuelos, trab, fEstado, fOrigen, fTipo, q, pasados, hoy]) // eslint-disable-line react-hooks/exhaustive-deps
  const nPorComprar = vuelos.filter(v => v.estado === 'por_comprar' && v.fecha >= hoy).length
  const descargar = () => descargarXlsx('Vuelos_y_pasajes.xlsx', async (X) => {
    const l = new X.Workbook(); l.creator = 'Sistema INDELI'; const h = l.addWorksheet('Vuelos')
    h.addRow(['Fecha', 'Trabajador', 'RUT', 'Ciudad de origen', 'Viaja', 'Estado', 'Tipo', 'Medio', 'Aerolínea', 'Origen', 'Destino', 'Salida', 'Llegada', 'Reserva', 'Notas']).font = { bold: true }
    filas.forEach(v => { const t = tr(v.trabajador_id); h.addRow([fechaCorta(v.fecha), t?.nombre, t?.rut || '', t?.ciudad || '', t?.modalidad_viaje === 'vuelo' ? 'Vuelo' : t?.modalidad_viaje === 'local' ? 'Local' : '', ESTADOS_VUELO[v.estado], v.tipo || '', v.medio, v.aerolinea || '', v.origen || '', v.destino || '', v.hora_salida || '', v.hora_llegada || '', v.reserva || '', v.notas || '']) })
    h.columns = [{ width: 12 }, { width: 28 }, { width: 14 }, { width: 18 }, { width: 16 }, { width: 13 }, { width: 10 }, { width: 8 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 8 }, { width: 8 }, { width: 10 }, { width: 24 }]
    return l
  })
  const th = { padding: '6px 8px' }
  return (
    <Marco titulo="Vuelos y pasajes" ancho={1200}>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#475467' }}><strong style={{ color: nPorComprar ? '#b42318' : '#1e8e4e' }}>{nPorComprar}</strong> pasaje{nPorComprar === 1 ? '' : 's'} por comprar desde hoy. Los vuelos se proyectan («por comprar») en Turnos → modo Vuelos; aquí se ven en lista y se completan al comprarlos.</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar trabajador…" style={{ ...input, width: '200px' }} />
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Todos los estados</option><option value="por_comprar">Por comprar</option><option value="comprado">Comprado</option></select>
        <select value={fOrigen} onChange={e => setFOrigen(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Todos los orígenes</option>{ciu.nombres.map(l => <option key={l}>{l}</option>)}<option value="_sin">Sin ciudad definida</option></select>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Subida y bajada</option><option value="subida">Subida</option><option value="bajada">Bajada</option></select>
        <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center' }}><input type="checkbox" checked={pasados} onChange={e => setPasados(e.target.checked)} />Ver pasados</label>
        <button onClick={descargar} style={{ ...btn(), marginLeft: 'auto' }}>⬇ Descargar Excel</button>
      </div>
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
        <div style={{ ...card, overflowX: 'auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>{filas.length} registro{filas.length === 1 ? '' : 's'}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead><tr style={{ textAlign: 'left', color: '#667085' }}><th style={th}>Fecha</th><th style={th}>Trabajador</th><th style={th}>Ciudad de origen</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Ruta</th><th style={th}>Aerolínea / horas</th><th style={th}>Reserva</th><th style={th}></th></tr></thead>
            <tbody>{filas.map(v => { const t = tr(v.trabajador_id); const pc = v.estado === 'por_comprar'; return (
              <tr key={v.id} style={{ borderTop: '1px solid #eef1f6' }}>
                <td style={{ ...th, whiteSpace: 'nowrap', fontWeight: 600 }}>{fechaCorta(v.fecha)}</td>
                <td style={{ ...th, minWidth: '230px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Link href={`/operaciones/trabajadores/${v.trabajador_id}`} style={{ color: AZUL, textDecoration: 'none', fontWeight: 600 }}>{t?.nombre || '—'}</Link>{t?.tipo_personal === 'indirecto' && <span style={{ marginLeft: 'auto', width: '62px', textAlign: 'center', boxSizing: 'border-box', flexShrink: 0, fontSize: '10px', padding: '1px 0', borderRadius: '10px', background: '#fff3cd', color: '#8a5a00', fontWeight: 700 }}>Indirecto</span>}</div></td>
                <td style={th}>{!t?.ciudad ? <span style={{ color: '#b7791f' }}>sin definir</span> : t.modalidad_viaje === 'vuelo' ? <span style={{ fontSize: '11.5px', padding: '2px 9px', borderRadius: '10px', background: '#e8f0fe', color: '#1B4F9C', fontWeight: 700 }}>{t.ciudad}</span> : <span style={{ color: '#667085' }}>{t.ciudad}</span>}</td>
                <td style={th}>{v.tipo || '—'}</td>
                <td style={th}><span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '20px', background: pc ? '#fde2e1' : '#e6f4ea', color: pc ? '#b42318' : '#1e8e4e' }}>{ESTADOS_VUELO[v.estado]}</span></td>
                <td style={th}>{v.origen && v.destino ? `${v.origen} → ${v.destino}` : '—'}</td>
                <td style={th}>{v.medio === 'bus' ? 'Bus' : v.aerolinea || '—'}{v.hora_salida ? ` · ${v.hora_salida}${v.hora_llegada ? '–' + v.hora_llegada : ''}` : ''}</td>
                <td style={th}>{v.reserva || '—'}</td>
                <td style={th}><button onClick={() => setEd(v)} style={{ ...btn(false), padding: '3px 10px', fontSize: '11.5px' }}>{pc ? 'Completar compra' : 'Editar'}</button></td>
              </tr>) })}</tbody>
          </table>
        </div>
      )}
      {ed && (
        <div onClick={() => setEd(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>{tr(ed.trabajador_id)?.nombre}</p>
            <PanelVuelos trabajador={tr(ed.trabajador_id)} trabId={ed.trabajador_id} dia={ed.fecha} vuelos={vuelos.filter(v => v.trabajador_id === ed.trabajador_id && v.fecha === ed.fecha)} onCambio={cargar} />
            <button onClick={() => setEd(null)} style={{ ...btn(false), marginTop: '12px' }}>Cerrar</button>
          </div>
        </div>)}
    </Marco>
  )
}

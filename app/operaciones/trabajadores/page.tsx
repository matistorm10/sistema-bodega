'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card, btn, input, label } from '@/components/programa/ui'
import { tallasDe } from '@/lib/epp'
import PuntoExamen from '@/components/operaciones/PuntoExamen'
import Marco from '@/components/operaciones/Marco'
import FiltroContratos from '@/components/operaciones/FiltroContratos'
import CargoSelect, { useCargos } from '@/components/operaciones/CargoSelect'
import CiudadSelect from '@/components/operaciones/CiudadSelect'
import { useCiudades } from '@/components/operaciones/useCiudades'
import { EXAMENES, etiquetaContrato, cmpPersonal, TIPOS_PERSONAL, traerTodo, hoyISO, estadoEn, asigEn, fechaCorta, TIPOS_CONTRATO, msgError, type Asig, type Turno } from '@/lib/operaciones'

const ESTADO: Record<string, { t: string, bg: string, col: string }> = {
  faena: { t: 'En faena', bg: '#e6f4ea', col: '#1e8e4e' }, descanso: { t: 'Descanso', bg: '#e8f0fe', col: '#1B4F9C' }, sin_contrato: { t: 'Sin contrato', bg: '#f2f4f7', col: '#667085' },
}
export default function Trabajadores() {
  const router = useRouter()
  const [trab, setTrab] = useState<any[]>([])
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState(''); const [fContrato, setFContrato] = useState<string[]>([]); const [fTipo, setFTipo] = useState(''); const [fExam, setFExam] = useState(''); const [fEstado, setFEstado] = useState(''); const [verInactivos, setVerInactivos] = useState(false)
  const [nuevo, setNuevo] = useState(false)
  const ciu = useCiudades()
  const car = useCargos()
  const [f, setF] = useState({ nombre: '', rut: '', cargo: '', ciudad: '', modalidad: '', examenes: 'pendiente', tipo: 'directo', calzado: '', ropa: '' })
  const [msg, setMsg] = useState('')
  const hoy = hoyISO()

  const cargar = async () => {
    const [t, a, tu, c] = await Promise.all([traerTodo('op_trabajadores', '*', 'nombre'), traerTodo('op_asignaciones'), traerTodo('op_turnos'), supabase.from('pr_contratos').select('id,nombre,empresa,referencia').order('nombre')])
    setTrab(t); setAsigs(a as Asig[]); setTurnos(tu as Turno[]); setContratos(c.data || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])
  const nCont = (id?: string) => etiquetaContrato(contratos.find(x => x.id === id))

  const filas = useMemo(() => trab.filter(t => (verInactivos || t.activo)).map(t => {
    const a = asigEn(asigs, t.id, hoy)
    return { t, a, est: estadoEn(asigs, turnos, t.id, hoy) }
  }).sort((x, y) => cmpPersonal(x.t, y.t)).filter(r => (fContrato.length === 0 || (!!r.a && fContrato.includes(r.a.contrato_id))) && (!fTipo || r.t.tipo_personal === fTipo) && (!fExam || r.t.examenes === fExam) && (!fEstado || r.est === fEstado) &&
    (!q.trim() || `${r.t.nombre} ${r.t.rut || ''} ${r.t.cargo || ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [trab, asigs, turnos, q, fExam, fContrato, fEstado, verInactivos, hoy])

  const crear = async () => {
    if (!f.nombre.trim()) { setMsg('Escribe el nombre.'); return }
    const { data, error } = await supabase.from('op_trabajadores').insert({ nombre: f.nombre.trim(), rut: f.rut.trim() || null, cargo: f.cargo || null, ciudad: f.ciudad || null, modalidad_viaje: f.modalidad || null, tipo_personal: f.tipo, examenes: f.examenes, examenes_fecha: hoyISO(), talla_calzado: f.calzado || null, talla_ropa: f.ropa || null }).select('id').single()
    if (error) { setMsg(msgError(error)); return }
    router.push(`/operaciones/trabajadores/${data.id}`)
  }
  return (
    <Marco titulo="Trabajadores">
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nombre, RUT o cargo…" style={{ ...input, width: '240px' }} />
        <FiltroContratos contratos={contratos} sel={fContrato} onChange={setFContrato} />
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Directos e indirectos</option><option value="indirecto">Solo indirectos</option><option value="directo">Solo directos</option></select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Todos los estados hoy</option><option value="faena">En faena</option><option value="descanso">Descanso</option><option value="sin_contrato">Sin contrato</option></select>
        <select value={fExam} onChange={e => setFExam(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">Exámenes: todos</option>{Object.entries(EXAMENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center' }}><input type="checkbox" checked={verInactivos} onChange={e => setVerInactivos(e.target.checked)} />Ver retirados</label>
        <button onClick={() => setNuevo(!nuevo)} style={{ ...btn(), marginLeft: 'auto' }}>{nuevo ? 'Cancelar' : '+ Nuevo trabajador'}</button>
      </div>
      {nuevo && (
        <div style={{ ...card, marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}><label style={label}>Nombre *</label><input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={input} /></div>
            <div style={{ flex: '0 1 140px' }}><label style={label}>RUT</label><input value={f.rut} onChange={e => setF({ ...f, rut: e.target.value })} placeholder="12.345.678-9" style={input} /></div>
            <div style={{ flex: '1 1 160px' }}><label style={label}>Cargo</label><CargoSelect value={f.cargo} onChange={v => setF({ ...f, cargo: v })} cargos={car.cargos} recargar={car.recargar} /></div>
            <div style={{ flex: '1 1 140px' }}><label style={label}>Ciudad de origen</label><CiudadSelect value={f.ciudad} onChange={v => setF({ ...f, ciudad: v })} ciudades={ciu.ciudades} recargar={ciu.recargar} /></div>
            <div style={{ flex: '0 1 130px' }}><label style={label}>Exámenes</label><select value={f.examenes} onChange={e => setF({ ...f, examenes: e.target.value })} style={input}>{Object.entries(EXAMENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div style={{ flex: '0 1 110px' }}><label style={label}>Viaja</label><select value={f.modalidad} onChange={e => setF({ ...f, modalidad: e.target.value })} style={input}><option value="">—</option><option value="vuelo">Vuelo</option><option value="local">Local</option></select></div>
            <div style={{ flex: '0 1 130px' }}><label style={label}>Tipo de personal</label><select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} style={input}><option value="indirecto">Indirecto</option><option value="directo">Directo</option></select></div>
            <div style={{ flex: '0 1 100px' }}><label style={label}>Talla calzado</label><select value={f.calzado} onChange={e => setF({ ...f, calzado: e.target.value })} style={input}><option value="">—</option>{tallasDe({ usa_talla: true, tipo_talla: 'calzado' }).map(t => <option key={t}>{t}</option>)}</select></div>
            <div style={{ flex: '0 1 100px' }}><label style={label}>Talla ropa</label><select value={f.ropa} onChange={e => setF({ ...f, ropa: e.target.value })} style={input}><option value="">—</option>{tallasDe({ usa_talla: true, tipo_talla: 'ropa' }).map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
          <button onClick={crear} style={{ ...btn(), marginTop: '10px' }}>Crear y abrir ficha</button>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#667085' }}>Después de crearlo podrás asignarle contrato y turnos en su ficha.</p>
        </div>
      )}
      {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
        <div style={{ ...card, overflowX: 'auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>{filas.length} trabajador{filas.length === 1 ? '' : 'es'}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead><tr style={{ textAlign: 'left', color: '#667085' }}><th style={{ padding: '6px 8px' }}>Nombre</th><th style={{ padding: '6px 8px' }}>Tipo</th><th style={{ padding: '6px 8px' }}>Exámenes</th><th style={{ padding: '6px 8px' }}>Cargo</th><th style={{ padding: '6px 8px' }}>Contrato hoy</th><th style={{ padding: '6px 8px' }}>Plazo</th><th style={{ padding: '6px 8px' }}>Hoy</th><th style={{ padding: '6px 8px' }}>Tallas</th></tr></thead>
            <tbody>{filas.map(({ t, a, est }) => (
              <tr key={t.id} style={{ borderTop: '1px solid #eef1f6', opacity: t.activo ? 1 : 0.55 }}>
                <td style={{ padding: '7px 8px', fontWeight: 600 }}><PuntoExamen estado={t.examenes} /><Link href={`/operaciones/trabajadores/${t.id}`} style={{ color: AZUL, textDecoration: 'none' }}>{t.nombre}</Link><span style={{ display: 'block', fontWeight: 400, fontSize: '11px', color: '#98a2b3' }}>{t.rut || 'sin RUT'}</span></td>
                <td style={{ padding: '7px 8px' }}><span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: t.tipo_personal === 'indirecto' ? '#fff3cd' : '#f2f4f7', color: t.tipo_personal === 'indirecto' ? '#8a5a00' : '#667085' }}>{TIPOS_PERSONAL[t.tipo_personal] || 'Directo'}</span></td>
                <td style={{ padding: '7px 8px' }}><span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: t.examenes === 'aprobado' ? '#e6f4ea' : t.examenes === 'rechazado' ? '#fde2e1' : '#fff3cd', color: t.examenes === 'aprobado' ? '#1e8e4e' : t.examenes === 'rechazado' ? '#b42318' : '#8a5a00' }}>{EXAMENES[t.examenes] || 'Pendiente'}</span></td>
                <td style={{ padding: '7px 8px' }}>{t.cargo || '—'}</td>
                <td style={{ padding: '7px 8px' }}>{nCont(a?.contrato_id)}</td>
                <td style={{ padding: '7px 8px' }}>{a?.tipo_contrato ? `${TIPOS_CONTRATO[a.tipo_contrato]}${a.vence ? ' · ' + fechaCorta(a.vence) : ''}` : '—'}</td>
                <td style={{ padding: '7px 8px' }}><span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '20px', background: ESTADO[est].bg, color: ESTADO[est].col }}>{ESTADO[est].t}</span></td>
                <td style={{ padding: '7px 8px', color: '#667085' }}>{t.talla_calzado || '—'} / {t.talla_ropa || '—'}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </Marco>
  )
}

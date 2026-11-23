'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { traerTodo } from '@/lib/operaciones'
import { TIPOS, TipoArchivo, Doc, Rem, leerInforme, leerLibro, leerRemuneraciones, guardarImportacion, guardarRemuneraciones } from '@/lib/finanzas'

const AZUL = '#1B4F9C'
const $ = (n: number) => Math.round(n || 0).toLocaleString('es-CL')
const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)', marginBottom: 16 }
const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }
const btn = (primario = true, off = false): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: primario ? 'none' : '1px solid #d0d5dd', background: off ? '#c7ced9' : primario ? AZUL : '#fff', color: primario ? '#fff' : '#344054', fontSize: 13, cursor: off ? 'default' : 'pointer', fontFamily: 'inherit' })
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: '#667085', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid #eaecf0', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontSize: 13, padding: '6px 8px', borderBottom: '1px solid #f2f4f7' }
const der: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

type Unidad = { id: string, nombre: string, grupo: string | null, activa: boolean, monto_contrato_base: number }
type Pestana = 'importar' | 'unidades' | 'presupuesto' | 'resultado' | 'kame'

export default function Finanzas() {
  const { usuario, cargando } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [tab, setTab] = useState<Pestana>('resultado')
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const cargarUnidades = useCallback(async () => {
    const { data } = await supabase.from('fin_unidades').select('*').order('nombre')
    setUnidades((data || []) as Unidad[])
  }, [])
  useEffect(() => { if (esAdmin) cargarUnidades() }, [esAdmin, cargarUnidades])

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, background: '#fff', borderRadius: 16, padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/" style={{ fontSize: 13, color: AZUL, textDecoration: 'none' }}>← Inicio</Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Finanzas · Control de costos</h1>
      <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 99 }}>En desarrollo · solo administradores</span>
    </div>
  )
  if (cargando) return <main style={fondoPagina}><div style={{ padding: '1.5rem' }}><p style={{ fontSize: 13, color: '#999' }}>Cargando...</p></div></main>
  if (!esAdmin) return <main style={fondoPagina}><div style={{ padding: '1.5rem', maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui,sans-serif' }}>{cab}<div style={card}><p style={{ fontSize: 14 }}>Este módulo está en desarrollo y solo está habilitado para administradores.</p></div></div></main>

  const tabs: [Pestana, string][] = [['resultado', 'Resultado por proyecto'], ['presupuesto', 'Presupuesto'], ['importar', 'Importar'], ['unidades', 'Unidades'], ['kame', 'Conexión Kame']]
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: 1100, margin: '0 auto' }}>
        {cab}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ ...btn(tab === k), fontWeight: tab === k ? 600 : 400 }}>{l}</button>)}
        </div>
        {tab === 'importar' && <Importar onListo={cargarUnidades} />}
        {tab === 'unidades' && <Unidades unidades={unidades} recargar={cargarUnidades} />}
        {tab === 'presupuesto' && <Presupuesto unidades={unidades.filter(u => u.activa)} recargar={cargarUnidades} />}
        {tab === 'kame' && <ConexionKame />}
        {tab === 'resultado' && <Resultado unidades={unidades.filter(u => u.activa)} />}
      </div>
    </main>
  )
}

// ───────────────────────── Importar ─────────────────────────
function Importar({ onListo }: { onListo: () => void }) {
  const [tipo, setTipo] = useState<TipoArchivo>('informe_compras')
  const [periodo, setPeriodo] = useState('')
  const [msg, setMsg] = useState(''); const [avisos, setAvisos] = useState<string[]>([]); const [ocupado, setOcupado] = useState(false)
  const [lotes, setLotes] = useState<any[]>([])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const cargarLotes = async () => { const { data } = await supabase.from('fin_lotes').select('*').order('creado_en', { ascending: false }).limit(15); setLotes(data || []) }
  useEffect(() => { cargarLotes() }, [])

  const subir = async (file: File | undefined) => {
    if (!file) return
    setOcupado(true); setMsg('Leyendo archivo…'); setAvisos([])
    try {
      let docs: Doc[]; let av: string[]; let per = ''
      const sentido = tipo.endsWith('compras') ? 'compra' : 'venta'
      if (tipo.startsWith('informe')) ({ docs, avisos: av } = await leerInforme(file, sentido))
      else { const r = await leerLibro(file, periodo); docs = r.docs; av = r.avisos; per = r.periodo }
      if (!docs.length) throw new Error('No encontré documentos en el archivo.')
      const r = await guardarImportacion(tipo, file.name, docs, per, setMsg)
      setMsg(`Listo: ${docs.length} documentos (${r.nuevos} nuevos, ${r.actualizados} ya existían y se actualizaron).${per ? ` Período tributario ${per}.` : ''}`)
      setAvisos(av); onListo(); cargarLotes()
    } catch (e: any) { setMsg('Error: ' + (e.message || e)) }
    setOcupado(false)
  }
  const subirRem = async (file: File | undefined) => {
    if (!file) return
    setOcupado(true); setMsg('Leyendo planilla…'); setAvisos([])
    try {
      const { filas, avisos: av }: { filas: Rem[], avisos: string[] } = await leerRemuneraciones(file, anio)
      if (!filas.length) throw new Error('No encontré filas de remuneraciones.')
      const n = await guardarRemuneraciones(filas, setMsg)
      setMsg(`Listo: ${filas.length} filas de ${n} mes(es). Costo empresa total ${$(filas.reduce((a, f) => a + f.costo, 0))}.`)
      setAvisos(av); onListo()
    } catch (e: any) { setMsg('Error: ' + (e.message || e)) }
    setOcupado(false)
  }

  return (
    <>
      <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Compras y ventas desde Kame</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Los documentos se identifican por RUT + tipo de documento + folio, así que dos proveedores con el mismo número de factura no se mezclan. Puedes volver a subir el mismo archivo sin duplicar. Sube el informe (trae la unidad de negocio) y el libro (trae el período tributario del SII).</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoArchivo)} style={inp}>{TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          {tipo.startsWith('libro') && <input value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="Período AAAA-MM (opcional)" style={{ ...inp, width: 190 }} />}
          <input type="file" accept=".xlsx" disabled={ocupado} onChange={e => { subir(e.target.files?.[0]); e.target.value = '' }} style={{ fontSize: 13 }} />
        </div>
      </div>
      <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Remuneraciones (planilla de RR.HH., desde BUK)</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Se usa la hoja «TOTAL». Los meses que trae el archivo se reemplazan completos al subirlo.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...inp, width: 90 }} />
          <input type="file" accept=".xlsx" disabled={ocupado} onChange={e => { subirRem(e.target.files?.[0]); e.target.value = '' }} style={{ fontSize: 13 }} />
        </div>
      </div>
      {msg && <div style={{ ...card, background: msg.startsWith('Error') ? '#fef3f2' : '#f0f9ff' }}><p style={{ fontSize: 13, margin: 0 }}>{msg}</p>
        {avisos.length > 0 && <details style={{ marginTop: 8 }}><summary style={{ fontSize: 12, cursor: 'pointer' }}>{avisos.length} aviso(s) para revisar</summary><ul style={{ fontSize: 12, color: '#92400e' }}>{avisos.slice(0, 50).map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
      </div>}
      <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Últimas importaciones</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Tipo</th><th style={th}>Archivo</th><th style={th}>Docs</th><th style={th}>Nuevos</th></tr></thead>
          <tbody>{lotes.map(l => <tr key={l.id}><td style={td}>{new Date(l.creado_en).toLocaleString('es-CL')}</td><td style={td}>{TIPOS.find(t => t.id === l.tipo)?.label}</td><td style={td}>{l.archivo}</td><td style={td}>{l.docs}</td><td style={td}>{l.nuevos}</td></tr>)}</tbody></table>
      </div>
    </>
  )
}

// ───────────────────────── Unidades ─────────────────────────
function Unidades({ unidades, recargar }: { unidades: Unidad[], recargar: () => void }) {
  const [sin, setSin] = useState<string[]>([])
  const cargarSin = useCallback(async () => {
    const { data } = await supabase.from('fin_remuneraciones').select('centro_texto').is('unidad_id', null)
    setSin([...new Set((data || []).map(r => r.centro_texto as string))].filter(Boolean).sort())
  }, [])
  useEffect(() => { cargarSin() }, [cargarSin, unidades.length])
  const cambiar = async (id: string, campos: Partial<Unidad>) => { await supabase.from('fin_unidades').update(campos).eq('id', id); recargar() }
  const asignar = async (centro: string, unidadId: string) => {
    if (!unidadId) return
    await supabase.from('fin_alias_centro').upsert({ centro_texto: centro, unidad_id: unidadId })
    await supabase.from('fin_remuneraciones').update({ unidad_id: unidadId }).eq('centro_texto', centro)
    cargarSin()
  }
  return (
    <>
      <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Unidades de negocio (centros de costo)</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Se crean solas al importar. Deja activas solo las que quieres controlar; las demás no aparecen en Presupuesto ni en Resultado.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Activa</th><th style={th}>Nombre en Kame</th><th style={th}>Contrato base ($ neto)</th></tr></thead>
          <tbody>{unidades.map(u => <tr key={u.id} style={{ opacity: u.activa ? 1 : 0.5 }}>
            <td style={td}><input type="checkbox" checked={u.activa} onChange={e => cambiar(u.id, { activa: e.target.checked })} /></td>
            <td style={td}>{u.nombre}</td>
            <td style={td}><input type="number" defaultValue={u.monto_contrato_base} onBlur={e => Number(e.target.value) !== u.monto_contrato_base && cambiar(u.id, { monto_contrato_base: Number(e.target.value) })} style={{ ...inp, width: 150 }} /></td>
          </tr>)}</tbody></table>
      </div>
      {sin.length > 0 && <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Centros de costo de remuneraciones sin unidad</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>En BUK los centros se llaman distinto que en Kame. Asocia cada uno una sola vez y queda guardado.</p>
        {sin.map(c => <div key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, width: 280 }}>{c}</span>
          <select defaultValue="" onChange={e => asignar(c, e.target.value)} style={inp}><option value="">Elegir unidad…</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        </div>)}
      </div>}
    </>
  )
}

// ───────────────────────── Presupuesto ─────────────────────────
function Presupuesto({ unidades, recargar }: { unidades: Unidad[], recargar: () => void }) {
  const [uid, setUid] = useState('')
  const [partidas, setPartidas] = useState<any[]>([])
  const [versiones, setVersiones] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])
  const [remUnidad, setRemUnidad] = useState(0)
  const [nueva, setNueva] = useState('')
  const [vTipo, setVTipo] = useState<'base' | 'adicional'>('base'); const [vDesc, setVDesc] = useState(''); const [vContrato, setVContrato] = useState(''); const [vDeltas, setVDeltas] = useState<Record<string, string>>({})
  const unidad = unidades.find(u => u.id === uid)

  const cargar = useCallback(async () => {
    if (!uid) return
    const [p, v, l] = await Promise.all([
      supabase.from('fin_partidas').select('*').eq('unidad_id', uid).order('orden').order('nombre'),
      supabase.from('fin_versiones').select('*').eq('unidad_id', uid).order('numero'),
      supabase.from('fin_lineas').select('id,monto,concepto,detalle,partida_id,documento:fin_documentos(sentido,razon_social,folio,fecha_doc)').eq('unidad_id', uid).limit(5000),
    ])
    const { data: rm } = await supabase.from('fin_remuneraciones').select('costo_empresa').eq('unidad_id', uid).limit(5000)
    setRemUnidad((rm || []).reduce((a, r) => a + Number(r.costo_empresa), 0))
    setPartidas(p.data || []); setVersiones(v.data || []); setLineas((l.data || []).filter((x: any) => x.documento?.sentido === 'compra'))
    const ids = (v.data || []).map(x => x.id)
    if (ids.length) { const { data } = await supabase.from('fin_version_items').select('*').in('version_id', ids); setItems(data || []) } else setItems([])
  }, [uid])
  useEffect(() => { cargar() }, [cargar])

  const presup = useMemo(() => { const m: Record<string, number> = {}; items.forEach(i => { m[i.partida_id] = (m[i.partida_id] || 0) + Number(i.delta) }); return m }, [items])
  const real = useMemo(() => { const m: Record<string, number> = {}; lineas.forEach(l => { if (l.partida_id) m[l.partida_id] = (m[l.partida_id] || 0) + Number(l.monto) }); return m }, [lineas])
  const sinClas = lineas.filter(l => !l.partida_id)
  const contrato = (unidad?.monto_contrato_base || 0) + versiones.reduce((a, v) => a + Number(v.delta_contrato), 0)
  const totPres = Object.values(presup).reduce((a, b) => a + b, 0)

  const agregarPartida = async () => { if (!nueva.trim()) return; await supabase.from('fin_partidas').insert({ unidad_id: uid, nombre: nueva.trim(), orden: partidas.length }); setNueva(''); cargar() }
  const agregarRem = async () => { await supabase.from('fin_partidas').insert({ unidad_id: uid, nombre: 'Remuneraciones', orden: partidas.length, fuente: 'remuneraciones' }); cargar() }
  const guardarVersion = async () => {
    const numero = (versiones[versiones.length - 1]?.numero || 0) + 1
    const { data: v, error } = await supabase.from('fin_versiones').insert({ unidad_id: uid, numero, tipo: vTipo, descripcion: vDesc || (vTipo === 'base' ? 'Presupuesto base' : 'Adicional'), delta_contrato: Number(vContrato) || 0 }).select('id').single()
    if (error || !v) { alert('No se pudo guardar: ' + error?.message); return }
    const rows = Object.entries(vDeltas).filter(([, x]) => Number(x)).map(([partida_id, x]) => ({ version_id: v.id, partida_id, delta: Number(x) }))
    if (rows.length) await supabase.from('fin_version_items').insert(rows)
    setVDesc(''); setVContrato(''); setVDeltas({}); cargar(); recargar()
  }
  const clasificar = async (id: string, partida_id: string) => { await supabase.from('fin_lineas').update({ partida_id: partida_id || null }).eq('id', id); cargar() }

  return (
    <>
      <div style={card}>
        <select value={uid} onChange={e => setUid(e.target.value)} style={{ ...inp, minWidth: 320 }}><option value="">Elegir proyecto…</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        {unidad && <span style={{ marginLeft: 16, fontSize: 13 }}>Contrato vigente: <b>${$(contrato)}</b> · Presupuesto de costos: <b>${$(totPres)}</b>{contrato > 0 && <> · Margen presupuestado: <b>{(((contrato - totPres) / contrato) * 100).toFixed(1)}%</b></>}</span>}
      </div>
      {unidad && <>
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Partidas: presupuesto vigente vs real</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Partida</th><th style={{ ...th, textAlign: 'right' }}>Presupuesto</th><th style={{ ...th, textAlign: 'right' }}>Real (compras)</th><th style={{ ...th, textAlign: 'right' }}>Saldo</th><th style={{ ...th, textAlign: 'right' }}>% usado</th></tr></thead>
            <tbody>{partidas.map(p => { const pr = presup[p.id] || 0, re = p.fuente === 'remuneraciones' ? remUnidad : (real[p.id] || 0); const pct = pr ? (re / pr) * 100 : 0; return <tr key={p.id}>
              <td style={td}>{p.nombre}{p.fuente === 'remuneraciones' && <span style={{ fontSize: 11, color: '#667085' }}> · automática (BUK / planilla)</span>}</td><td style={der}>{$(pr)}</td><td style={der}>{$(re)}</td>
              <td style={{ ...der, color: pr - re < 0 ? '#b42318' : '#067647' }}>{$(pr - re)}</td>
              <td style={{ ...der, color: pct > 100 ? '#b42318' : undefined }}>{pr ? pct.toFixed(0) + '%' : '—'}</td></tr> })}
              <tr><td style={{ ...td, color: '#92400e' }}>Sin clasificar ({sinClas.length} líneas)</td><td style={der}>—</td><td style={der}>{$(sinClas.reduce((a, l) => a + Number(l.monto), 0))}</td><td style={der} colSpan={2} /></tr>
            </tbody></table>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><input value={nueva} onChange={e => setNueva(e.target.value)} placeholder="Nueva partida (ej. Hormigón)" style={{ ...inp, width: 260 }} /><button onClick={agregarPartida} style={btn()}>Agregar partida</button>{!partidas.some(p => p.fuente === 'remuneraciones') && <button onClick={agregarRem} style={btn(false)}>+ Partida de remuneraciones</button>}</div>
        </div>
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Versiones del presupuesto</h2>
          <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>El presupuesto base y cada adicional / nota de venta se suman. Ejemplo: contrato +100.000 y Hormigón +50.000.</p>
          {versiones.map(v => <div key={v.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f2f4f7' }}>#{v.numero} · {v.tipo === 'base' ? 'Base' : 'Adicional'} · {v.descripcion} · {new Date(v.fecha + 'T12:00').toLocaleDateString('es-CL')} · contrato {Number(v.delta_contrato) >= 0 ? '+' : ''}{$(Number(v.delta_contrato))}</div>)}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={vTipo} onChange={e => setVTipo(e.target.value as any)} style={inp}><option value="base">Presupuesto base</option><option value="adicional">Adicional / nota de venta</option></select>
            <input value={vDesc} onChange={e => setVDesc(e.target.value)} placeholder="Descripción" style={{ ...inp, width: 240 }} />
            <input type="number" value={vContrato} onChange={e => setVContrato(e.target.value)} placeholder="Variación del contrato $" style={{ ...inp, width: 190 }} />
          </div>
          {partidas.length > 0 && <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 6 }}>
            {partidas.map(p => <label key={p.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>{p.nombre}<input type="number" value={vDeltas[p.id] || ''} onChange={e => setVDeltas(d => ({ ...d, [p.id]: e.target.value }))} placeholder="$ variación" style={{ ...inp, width: 120 }} /></label>)}
          </div>}
          <button onClick={guardarVersion} style={{ ...btn(), marginTop: 12 }}>Guardar versión</button>
        </div>
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Líneas por clasificar ({sinClas.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Proveedor</th><th style={th}>Folio</th><th style={th}>Concepto</th><th style={{ ...th, textAlign: 'right' }}>Neto</th><th style={th}>Partida</th></tr></thead>
            <tbody>{sinClas.slice(0, 200).map(l => <tr key={l.id}><td style={td}>{l.documento?.fecha_doc}</td><td style={td}>{l.documento?.razon_social}</td><td style={td}>{l.documento?.folio}</td><td style={td}>{l.concepto}</td><td style={der}>{$(l.monto)}</td>
              <td style={td}><select value="" onChange={e => clasificar(l.id, e.target.value)} style={inp}><option value="">Elegir…</option>{partidas.filter(p => p.fuente !== 'remuneraciones').map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></td></tr>)}</tbody></table>
        </div>
      </>}
    </>
  )
}

// ───────────────────────── Resultado ─────────────────────────
function Resultado({ unidades }: { unidades: Unidad[] }) {
  const [mes, setMes] = useState('')
  const [lineas, setLineas] = useState<any[]>([]); const [rem, setRem] = useState<any[]>([]); const [vers, setVers] = useState<any[]>([])
  const [cargando, setCargando] = useState(true); const [tardias, setTardias] = useState<any[]>([])
  useEffect(() => {
    (async () => {
      setCargando(true)
      const [l, r, v] = await Promise.all([
        traerTodo('fin_lineas', 'id,monto,unidad_id,documento:fin_documentos(sentido,fecha_doc,periodo_tributario,razon_social,folio,tipo_doc)'),
        traerTodo('fin_remuneraciones', 'id,periodo,unidad_id,costo_empresa'),
        traerTodo('fin_versiones', 'id,unidad_id,delta_contrato'),
      ])
      setLineas(l); setRem(r); setVers(v)
      // Documentos cuyo período tributario no coincide con el mes de su fecha: aviso de "cae en otro mes"
      setTardias(l.filter(x => x.documento?.periodo_tributario && x.documento?.fecha_doc && x.documento.fecha_doc.slice(0, 7) !== x.documento.periodo_tributario))
      setCargando(false)
    })()
  }, [])
  const meses = useMemo(() => [...new Set([...lineas.map(l => l.documento?.fecha_doc?.slice(0, 7)), ...rem.map(r => r.periodo)].filter(Boolean))].sort().reverse() as string[], [lineas, rem])

  const filas = unidades.map(u => {
    const ls = lineas.filter(l => l.unidad_id === u.id && (!mes || (l.documento?.periodo_tributario || l.documento?.fecha_doc?.slice(0, 7)) === mes))
    const ventas = ls.filter(l => l.documento?.sentido === 'venta').reduce((a, l) => a + Number(l.monto), 0)
    const compras = ls.filter(l => l.documento?.sentido === 'compra').reduce((a, l) => a + Number(l.monto), 0)
    const sueldos = rem.filter(r => r.unidad_id === u.id && (!mes || r.periodo === mes)).reduce((a, r) => a + Number(r.costo_empresa), 0)
    const contrato = Number(u.monto_contrato_base) + vers.filter(v => v.unidad_id === u.id).reduce((a, v) => a + Number(v.delta_contrato), 0)
    const margen = ventas - compras - sueldos
    return { u, ventas, compras, sueldos, margen, pct: ventas ? (margen / ventas) * 100 : null, contrato }
  }).filter(f => f.ventas || f.compras || f.sueldos || f.contrato)
  const tot = filas.reduce((a, f) => ({ v: a.v + f.ventas, c: a.c + f.compras, s: a.s + f.sueldos }), { v: 0, c: 0, s: 0 })

  return (
    <>
      <div style={card}>
        <span style={{ fontSize: 13, marginRight: 8 }}>Período:</span>
        <select value={mes} onChange={e => setMes(e.target.value)} style={inp}><option value="">Acumulado</option>{meses.map(m => <option key={m} value={m}>{m}</option>)}</select>
        <p style={{ fontSize: 12, color: '#667085', margin: '8px 0 0' }}>Los documentos con libro del SII cargado se ubican en su período tributario; los demás, en el mes de su fecha. Montos netos.</p>
      </div>
      <div style={card}>
        {cargando ? <p style={{ fontSize: 13, color: '#999' }}>Cargando…</p> : filas.length === 0 ? <p style={{ fontSize: 13 }}>Aún no hay datos. Sube los informes en la pestaña Importar y marca las unidades activas.</p> :
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Proyecto</th><th style={{ ...th, textAlign: 'right' }}>Contrato</th><th style={{ ...th, textAlign: 'right' }}>Ventas</th><th style={{ ...th, textAlign: 'right' }}>Compras</th><th style={{ ...th, textAlign: 'right' }}>Remuneraciones</th><th style={{ ...th, textAlign: 'right' }}>Margen</th><th style={{ ...th, textAlign: 'right' }}>%</th></tr></thead>
            <tbody>{filas.map(f => <tr key={f.u.id}><td style={td}>{f.u.nombre}</td><td style={der}>{f.contrato ? $(f.contrato) : '—'}</td><td style={der}>{$(f.ventas)}</td><td style={der}>{$(f.compras)}</td><td style={der}>{$(f.sueldos)}</td>
              <td style={{ ...der, color: f.margen < 0 ? '#b42318' : '#067647', fontWeight: 600 }}>{$(f.margen)}</td><td style={der}>{f.pct == null ? '—' : f.pct.toFixed(1) + '%'}</td></tr>)}
              <tr><td style={{ ...td, fontWeight: 600 }}>Total</td><td style={der} /><td style={{ ...der, fontWeight: 600 }}>{$(tot.v)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.c)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.s)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.v - tot.c - tot.s)}</td><td style={der} /></tr></tbody></table></div>}
      </div>
      {tardias.length > 0 && <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Documentos que caen en otro mes ({tardias.length} líneas)</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>La fecha del documento y el período en que se declaró al SII no coinciden.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Proveedor / cliente</th><th style={th}>Folio</th><th style={th}>Fecha doc.</th><th style={th}>Período SII</th></tr></thead>
          <tbody>{tardias.slice(0, 30).map(t => <tr key={t.id}><td style={td}>{t.documento.razon_social}</td><td style={td}>{t.documento.folio}</td><td style={td}>{t.documento.fecha_doc}</td><td style={td}>{t.documento.periodo_tributario}</td></tr>)}</tbody></table>
      </div>}
    </>
  )
}

// ───────────────────────── Conexión Kame ─────────────────────────
const SUGERIDOS = ['/api/getInformeVentas', '/api/getInformeCompras', '/api/getCuentaxCobrar', '/api/getCuentaxPagar', '/api/getInformeCobros', '/api/getInformePagos', '/api/getListFicha']
function ConexionKame() {
  const [ruta, setRuta] = useState('/api/getInformeVentas'); const [metodo, setMetodo] = useState<'GET' | 'POST'>('GET')
  const [query, setQuery] = useState('{}'); const [cuerpo, setCuerpo] = useState('{}')
  const [pref, setPref] = useState('/api/Contabilidad,/api/Compras,/api/Ventas,/api/Tesoreria,/api/Informes,/api/Maestros')
  const [nom, setNom] = useState('getInformeCompras,getInformeVentas,getLibroCompras,getLibroVentas,getLibroMayor,getLibroDiario,getBalance,getComprobantes,getAsientos,getCentrosCosto,getUnidadesNegocio,getListUnidadNegocio,getListCentroCosto,getListFicha,getListCuentas,getPlanCuentas,getDocumentosCompra,getDocumentosVenta,getCompras,getVentas')
  const [salida, setSalida] = useState(''); const [ocupado, setOcupado] = useState(false)
  const llamar = async (payload: any) => {
    setOcupado(true); setSalida('Consultando…')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/finanzas/kame', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (j.intentos) setSalida(j.intentos.map((x: any) => `${x.parametros}\n  HTTP ${x.status} · ${x.estado || '-'} · ${x.largo} caracteres\n  ${x.msg}`).join('\n\n'))
      else if (j.distintas) setSalida(`Probé ${j.probadas} rutas. Las que NO dieron 404:\n\n` + (j.distintas.length ? j.distintas.map((x: any) => `${x.status}  ${x.ruta}`).join('\n') : '(ninguna: todas dieron 404)'))
      else if (j.respuesta !== undefined) { let t = j.respuesta; try { t = JSON.stringify(JSON.parse(t), null, 2) } catch {} ; setSalida(`HTTP ${j.status} · ${j.tipo} · ${j.largo} caracteres\n\n${t}`) }
      else setSalida(j.mensaje || j.error || JSON.stringify(j))
    } catch (e: any) { setSalida('Error: ' + e.message) }
    setOcupado(false)
  }
  const parse = (t: string) => { try { return JSON.parse(t || '{}') } catch { return {} } }
  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Conexión con la API de Kame</h2>
      <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Las credenciales están solo en el servidor (variables KAME_CLIENT_ID y KAME_CLIENT_SECRET en Vercel). Esta pantalla sirve para probar la conexión y descubrir qué endpoints responden.</p>
      <button disabled={ocupado} onClick={() => llamar({ accion: 'token' })} style={btn(true, ocupado)}>1. Probar conexión (token)</button>
      <button disabled={ocupado} onClick={() => llamar({ accion: 'descubrir', prefijos: pref.split(',').map(x => x.trim()), nombres: nom.split(',').map(x => x.trim()) })} style={{ ...btn(false, ocupado), marginLeft: 8 }}>Descubrir endpoints</button>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <label style={{ fontSize: 12 }}>Carpetas a probar<br /><input value={pref} onChange={e => setPref(e.target.value)} style={{ ...inp, width: 340 }} /></label>
        <label style={{ fontSize: 12 }}>Nombres a probar<br /><input value={nom} onChange={e => setNom(e.target.value)} style={{ ...inp, width: 440 }} /></label>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={metodo} onChange={e => setMetodo(e.target.value as any)} style={inp}><option>GET</option><option>POST</option></select>
        <input list="sug" value={ruta} onChange={e => setRuta(e.target.value)} style={{ ...inp, width: 300 }} /><datalist id="sug">{SUGERIDOS.map(x => <option key={x} value={x} />)}</datalist>
        <button disabled={ocupado} onClick={() => llamar({ accion: 'parametros', ruta })} style={btn(false, ocupado)}>Buscar parámetros de fecha</button>
        <button disabled={ocupado} onClick={() => llamar({ accion: 'llamar', metodo, ruta, query: parse(query), cuerpo: parse(cuerpo) })} style={btn(true, ocupado)}>2. Consultar</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12 }}>Parámetros URL (JSON)<br /><input value={query} onChange={e => setQuery(e.target.value)} style={{ ...inp, width: 340 }} /></label>
        <label style={{ fontSize: 12 }}>Cuerpo POST (JSON)<br /><input value={cuerpo} onChange={e => setCuerpo(e.target.value)} style={{ ...inp, width: 340 }} /></label>
      </div>
      {salida && <pre style={{ marginTop: 12, background: '#101828', color: '#e4e7ec', padding: 12, borderRadius: 8, fontSize: 12, maxHeight: 420, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{salida}</pre>}
    </div>
  )
}

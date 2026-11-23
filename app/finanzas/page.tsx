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

type Unidad = { id: string, nombre: string, grupo: string | null, activa: boolean, monto_contrato_base: number, presupuesto_desde?: string | null, presupuesto_hasta?: string | null }
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
// Nombre normalizado para impedir duplicados tipo "Cubierta" / "cubiertas" / "CUBIERTAS "
const normNombre = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ').split(' ').map(w => w.length > 4 ? w.replace(/(es|s)$/, '') : w).join(' ')
const nombreMes = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }).replace('.', '') }
const rangoMeses = (d?: string | null, h?: string | null) => { const out: string[] = []; if (!d || !h) return out; let [y, m] = d.split('-').map(Number); const [yh, mh] = h.split('-').map(Number); while ((y < yh || (y === yh && m <= mh)) && out.length < 48) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } } return out }
const prefijos = (c: string) => String(c || '').split(',').map(x => x.trim()).filter(Boolean)

function Presupuesto({ unidades, recargar }: { unidades: Unidad[], recargar: () => void }) {
  const [uid, setUid] = useState('')
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [partidas, setPartidas] = useState<any[]>([])
  const [versiones, setVersiones] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [asientos, setAsientos] = useState<any[]>([])
  const [rem, setRem] = useState<any[]>([])
  const [elegida, setElegida] = useState('')
  const [vTipo, setVTipo] = useState<'base' | 'adicional'>('base'); const [vDesc, setVDesc] = useState(''); const [vContrato, setVContrato] = useState(''); const [draft, setDraft] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState(''); const [guardando, setGuardando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState(''); const [nuevasCuentas, setNuevasCuentas] = useState('')
  const unidad = unidades.find(u => u.id === uid)
  const meses = useMemo(() => rangoMeses(unidad?.presupuesto_desde, unidad?.presupuesto_hasta), [unidad])

  const cargarCatalogo = useCallback(async () => { const { data } = await supabase.from('fin_catalogo_partidas').select('*').order('orden').order('nombre'); setCatalogo(data || []) }, [])
  useEffect(() => { cargarCatalogo() }, [cargarCatalogo])

  const cargar = useCallback(async () => {
    if (!uid) return
    const [p, v, a, r] = await Promise.all([
      supabase.from('fin_partidas').select('*, catalogo:fin_catalogo_partidas(nombre,cuentas,fuente)').eq('unidad_id', uid).order('orden').order('nombre'),
      supabase.from('fin_versiones').select('*').eq('unidad_id', uid).order('numero'),
      supabase.from('fin_asientos').select('kame_id,fecha,cuenta,debe,haber').eq('unidad_id', uid).like('cuenta', '4.%').limit(20000),
      supabase.from('fin_remuneraciones').select('periodo,costo_empresa').eq('unidad_id', uid).limit(20000),
    ])
    setPartidas(p.data || []); setVersiones(v.data || []); setAsientos(a.data || []); setRem(r.data || [])
    const ids = (v.data || []).map(x => x.id)
    if (ids.length) { const { data } = await supabase.from('fin_version_items').select('*').in('version_id', ids).limit(20000); setItems(data || []) } else setItems([])
  }, [uid])
  useEffect(() => { cargar() }, [cargar])

  const pres = useMemo(() => { const m: Record<string, number> = {}; items.forEach(i => { const k = i.partida_id + '|' + i.mes; m[k] = (m[k] || 0) + Number(i.delta) }); return m }, [items])
  const realDe = (p: any, mes: string) => p.catalogo?.fuente === 'remuneraciones'
    ? rem.filter(r => r.periodo === mes).reduce((t, r) => t + Number(r.costo_empresa), 0)
    : asientos.filter(a => String(a.fecha).slice(0, 7) === mes && prefijos(p.catalogo?.cuentas).some(x => a.cuenta.startsWith(x))).reduce((t, a) => t + Number(a.debe) - Number(a.haber), 0)
  const cubiertas = useMemo(() => partidas.flatMap(p => prefijos(p.catalogo?.cuentas)), [partidas])
  const sinPartida = (mes: string) => asientos.filter(a => String(a.fecha).slice(0, 7) === mes && !cubiertas.some(x => a.cuenta.startsWith(x))).reduce((t, a) => t + Number(a.debe) - Number(a.haber), 0)
  const fueraDePeriodo = useMemo(() => asientos.filter(a => !meses.includes(String(a.fecha).slice(0, 7))).reduce((t, a) => t + Number(a.debe) - Number(a.haber), 0), [asientos, meses])

  const contrato = (unidad?.monto_contrato_base || 0) + versiones.reduce((a, v) => a + Number(v.delta_contrato), 0)
  const totPres = items.reduce((a, i) => a + Number(i.delta), 0)

  const guardarPeriodo = async (campo: 'presupuesto_desde' | 'presupuesto_hasta', valor: string) => { await supabase.from('fin_unidades').update({ [campo]: valor || null }).eq('id', uid); recargar() }
  const agregarPartida = async () => {
    if (!elegida) return
    const c = catalogo.find(x => x.id === elegida); if (!c) return
    const { error } = await supabase.from('fin_partidas').insert({ unidad_id: uid, nombre: c.nombre, catalogo_id: c.id, fuente: c.fuente === 'remuneraciones' ? 'remuneraciones' : 'manual', orden: partidas.length })
    if (error) setMsg('No se pudo agregar: ' + error.message); else { setElegida(''); setMsg(''); cargar() }
  }
  const quitarPartida = async (p: any) => {
    if (!confirm(`¿Quitar «${p.nombre}» de este proyecto? Se borra también su presupuesto.`)) return
    await supabase.from('fin_partidas').delete().eq('id', p.id); cargar()
  }
  const guardarVersion = async () => {
    const celdas = Object.entries(draft).filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) !== 0)
    if (!celdas.length && !Number(vContrato)) { setMsg('Escribe al menos un monto en la grilla o una variación del contrato.'); return }
    if (vTipo === 'base' && versiones.some(v => v.tipo === 'base') && !confirm('Este proyecto ya tiene un presupuesto base. Si guardas otro, los montos se SUMAN. ¿Es lo que quieres? (Para modificar usa «Adicional», con montos positivos o negativos).')) return
    setGuardando(true)
    const numero = (versiones[versiones.length - 1]?.numero || 0) + 1
    const { data: v, error } = await supabase.from('fin_versiones').insert({ unidad_id: uid, numero, tipo: vTipo, descripcion: vDesc || (vTipo === 'base' ? 'Presupuesto base' : 'Adicional'), delta_contrato: Number(vContrato) || 0 }).select('id').single()
    if (error || !v) { setMsg('No se pudo guardar: ' + error?.message); setGuardando(false); return }
    const rows = celdas.map(([k, x]) => { const [partida_id, mes] = k.split('|'); return { version_id: v.id, partida_id, mes, delta: Number(x) } })
    if (rows.length) { const { error: e2 } = await supabase.from('fin_version_items').insert(rows); if (e2) { setMsg('No se pudieron guardar los montos: ' + e2.message); setGuardando(false); return } }
    setDraft({}); setVDesc(''); setVContrato(''); setMsg('Versión guardada.'); setGuardando(false); cargar(); recargar()
  }
  const borrarVersion = async (v: any) => { if (!confirm(`¿Borrar la versión #${v.numero} («${v.descripcion}»)? Se quitan sus montos del presupuesto.`)) return; await supabase.from('fin_versiones').delete().eq('id', v.id); cargar(); recargar() }

  // Catálogo oficial de partidas
  const agregarCatalogo = async () => {
    const nombre = nuevoNombre.trim().replace(/\s+/g, ' '); if (!nombre) return
    const norm = normNombre(nombre); const ya = catalogo.find(c => c.nombre_norm === norm)
    if (ya) { setMsg(`Ya existe la partida «${ya.nombre}». Usa esa en vez de crear «${nombre}».`); return }
    const { error } = await supabase.from('fin_catalogo_partidas').insert({ nombre, nombre_norm: norm, cuentas: nuevasCuentas, orden: catalogo.length })
    if (error) setMsg('No se pudo crear: ' + error.message); else { setNuevoNombre(''); setNuevasCuentas(''); setMsg(`Partida «${nombre}» creada en el catálogo.`); cargarCatalogo() }
  }
  const dispo = catalogo.filter(c => !partidas.some(p => p.catalogo_id === c.id))
  const celda: React.CSSProperties = { ...td, padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12 }

  return (
    <>
      <div style={card}>
        <select value={uid} onChange={e => { setUid(e.target.value); setDraft({}); setMsg('') }} style={{ ...inp, minWidth: 320 }}><option value="">Elegir proyecto…</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        {unidad && <span style={{ marginLeft: 16, fontSize: 13 }}>Contrato vigente: <b>${$(contrato)}</b> · Presupuesto de costos: <b>${$(totPres)}</b>{contrato > 0 && totPres > 0 && <> · Margen presupuestado: <b>{(((contrato - totPres) / contrato) * 100).toFixed(1)}%</b></>}</span>}
        {msg && <p style={{ fontSize: 12, margin: '8px 0 0', color: msg.startsWith('No') || msg.startsWith('Ya') || msg.startsWith('Escribe') ? '#b42318' : '#067647' }}>{msg}</p>}
      </div>

      <details style={card}>
        <summary style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Catálogo oficial de partidas ({catalogo.length})</summary>
        <p style={{ fontSize: 12, color: '#667085', margin: '8px 0' }}>Todos los proyectos usan estas partidas, así nadie escribe «Cubierta» y otro «Cubiertas». En «Cuentas Kame» pon las cuentas (o prefijos) que alimentan su costo real, separadas por coma. «Remuneraciones» se alimenta de la planilla de RR.HH.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Partida</th><th style={th}>Cuentas Kame</th><th style={th}>Fuente del real</th></tr></thead>
          <tbody>{catalogo.map(c => <tr key={c.id}><td style={td}>{c.nombre}</td>
            <td style={td}>{c.fuente === 'remuneraciones' ? <span style={{ color: '#667085' }}>{c.cuentas || '—'}</span> : <input defaultValue={c.cuentas} placeholder="ej. 4.01.02.02, 4.01.03.18" onBlur={async e => { if (e.target.value !== c.cuentas) { await supabase.from('fin_catalogo_partidas').update({ cuentas: e.target.value }).eq('id', c.id); cargarCatalogo(); cargar() } }} style={{ ...inp, width: 300, padding: '4px 6px' }} />}</td>
            <td style={td}>{c.fuente === 'remuneraciones' ? 'Planilla RR.HH. (BUK)' : 'Contabilidad Kame'}</td></tr>)}</tbody></table>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nueva partida (ej. Hormigón)" style={{ ...inp, width: 240 }} />
          <input value={nuevasCuentas} onChange={e => setNuevasCuentas(e.target.value)} placeholder="Cuentas Kame (opcional)" style={{ ...inp, width: 260 }} />
          <button onClick={agregarCatalogo} style={btn()}>Crear en el catálogo</button>
        </div>
      </details>

      {unidad && <>
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>1. Período del presupuesto</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
            Desde <input type="month" defaultValue={unidad.presupuesto_desde || ''} onBlur={e => e.target.value !== (unidad.presupuesto_desde || '') && guardarPeriodo('presupuesto_desde', e.target.value)} style={inp} />
            hasta <input type="month" defaultValue={unidad.presupuesto_hasta || ''} onBlur={e => e.target.value !== (unidad.presupuesto_hasta || '') && guardarPeriodo('presupuesto_hasta', e.target.value)} style={inp} />
            <span style={{ color: '#667085', fontSize: 12 }}>{meses.length ? `${meses.length} meses` : 'Define el primer y último mes del proyecto para ver las columnas.'}</span>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>2. Partidas de este proyecto</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {partidas.map(p => <span key={p.id} style={{ background: '#eef4ff', borderRadius: 99, padding: '4px 10px', fontSize: 13 }}>{p.nombre} <button onClick={() => quitarPartida(p)} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#667085' }}>✕</button></span>)}
            {partidas.length === 0 && <span style={{ fontSize: 12, color: '#667085' }}>Aún no hay partidas.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <select value={elegida} onChange={e => setElegida(e.target.value)} style={{ ...inp, minWidth: 260 }}><option value="">Agregar partida del catálogo…</option>{dispo.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            <button onClick={agregarPartida} disabled={!elegida} style={btn(true, !elegida)}>Agregar</button>
          </div>
        </div>

        {partidas.length > 0 && meses.length > 0 && <>
          <div style={card}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>3. Ingresar presupuesto por mes</h2>
            <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Escribe el monto (neto) de cada partida en cada mes. Primero guarda el <b>presupuesto base</b>. Si después hay un adicional o nota de venta, guarda una versión <b>adicional</b> con la <b>variación</b> (positiva o negativa) y la del contrato.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={vTipo} onChange={e => setVTipo(e.target.value as any)} style={inp}><option value="base">Presupuesto base</option><option value="adicional">Adicional / nota de venta</option></select>
              <input value={vDesc} onChange={e => setVDesc(e.target.value)} placeholder="Descripción (ej. Adicional pozo 2)" style={{ ...inp, width: 280 }} />
              <input type="number" value={vContrato} onChange={e => setVContrato(e.target.value)} placeholder={vTipo === 'base' ? 'Valor del contrato $' : 'Variación del contrato $'} style={{ ...inp, width: 220 }} />
            </div>
            <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse' }}><thead><tr><th style={th}>Partida</th>{meses.map(m => <th key={m} style={{ ...th, textAlign: 'right' }}>{nombreMes(m)}</th>)}</tr></thead>
              <tbody>{partidas.map(p => <tr key={p.id}><td style={{ ...td, whiteSpace: 'nowrap' }}>{p.nombre}</td>{meses.map(m => <td key={m} style={{ ...td, padding: 3 }}>
                <input type="number" value={draft[p.id + '|' + m] ?? ''} onChange={e => setDraft(d => ({ ...d, [p.id + '|' + m]: e.target.value }))} style={{ ...inp, width: 100, padding: '5px 6px', textAlign: 'right' }} /></td>)}</tr>)}</tbody></table></div>
            <button onClick={guardarVersion} disabled={guardando} style={{ ...btn(true, guardando), marginTop: 12 }}>{guardando ? 'Guardando…' : `Guardar ${vTipo === 'base' ? 'presupuesto base' : 'adicional'}`}</button>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>4. Presupuesto vigente vs real</h2>
            <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>En cada mes: arriba lo presupuestado, abajo lo real (rojo si se pasó). «Sin partida» son costos de cuentas que ninguna partida del proyecto cubre.</p>
            <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>Partida</th>{meses.map(m => <th key={m} style={{ ...th, textAlign: 'right' }}>{nombreMes(m)}</th>)}<th style={{ ...th, textAlign: 'right' }}>Total presup.</th><th style={{ ...th, textAlign: 'right' }}>Total real</th><th style={{ ...th, textAlign: 'right' }}>Saldo</th><th style={{ ...th, textAlign: 'right' }}>% usado</th></tr></thead>
              <tbody>{(() => {
                let gp = 0, gr = 0
                const filas = partidas.map(p => {
                  let tp = 0, tr = 0
                  const cs = meses.map(m => { const a = pres[p.id + '|' + m] || 0, r = realDe(p, m); tp += a; tr += r; return <td key={m} style={celda}><div style={{ color: '#1B4F9C' }}>{a ? $(a) : '·'}</div><div style={{ color: r > a && a > 0 ? '#b42318' : (r ? '#344054' : '#98a2b3') }}>{r ? $(r) : '·'}</div></td> })
                  gp += tp; gr += tr
                  return <tr key={p.id}><td style={{ ...td, whiteSpace: 'nowrap' }}>{p.nombre}</td>{cs}<td style={celda}>{$(tp)}</td><td style={celda}>{$(tr)}</td><td style={{ ...celda, color: tp - tr < 0 ? '#b42318' : '#067647' }}>{$(tp - tr)}</td><td style={{ ...celda, color: tp && tr > tp ? '#b42318' : undefined }}>{tp ? (tr / tp * 100).toFixed(0) + '%' : '—'}</td></tr>
                })
                let tsp = 0
                const sp = <tr key="sp"><td style={{ ...td, color: '#92400e', whiteSpace: 'nowrap' }}>Sin partida</td>{meses.map(m => { const v = sinPartida(m); tsp += v; return <td key={m} style={{ ...celda, color: '#92400e' }}>{v ? $(v) : '·'}</td> })}<td style={celda} /><td style={{ ...celda, color: '#92400e' }}>{$(tsp)}</td><td style={celda} colSpan={2} /></tr>
                const tot = <tr key="t"><td style={{ ...td, fontWeight: 600 }}>Total</td>{meses.map(m => <td key={m} style={celda} />)}<td style={{ ...celda, fontWeight: 600 }}>{$(gp)}</td><td style={{ ...celda, fontWeight: 600 }}>{$(gr + tsp)}</td><td style={{ ...celda, fontWeight: 600, color: gp - gr - tsp < 0 ? '#b42318' : '#067647' }}>{$(gp - gr - tsp)}</td><td style={celda}>{gp ? ((gr + tsp) / gp * 100).toFixed(0) + '%' : '—'}</td></tr>
                return [...filas, sp, tot]
              })()}</tbody></table></div>
            {Math.abs(fueraDePeriodo) > 0 && <p style={{ fontSize: 12, color: '#92400e', margin: '8px 0 0' }}>Hay ${$(fueraDePeriodo)} de costos de este proyecto en meses fuera del período definido arriba (no aparecen en las columnas).</p>}
          </div>
        </>}

        {versiones.length > 0 && <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Historial de versiones</h2>
          {versiones.map(v => <div key={v.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f2f4f7', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>#{v.numero} · {v.tipo === 'base' ? 'Base' : 'Adicional'} · {v.descripcion} · {new Date(v.fecha + 'T12:00').toLocaleDateString('es-CL')} · contrato {Number(v.delta_contrato) >= 0 ? '+' : ''}{$(Number(v.delta_contrato))} · montos {$(items.filter(i => i.version_id === v.id).reduce((a, i) => a + Number(i.delta), 0))}</span>
            <button onClick={() => borrarVersion(v)} style={btn(false)}>Borrar</button></div>)}
        </div>}
      </>}
    </>
  )
}

// ───────────────────────── Resultado ─────────────────────────
function Resultado({ unidades }: { unidades: Unidad[] }) {
  const [mes, setMes] = useState('')
  const [lineas, setLineas] = useState<any[]>([]); const [rem, setRem] = useState<any[]>([]); const [vers, setVers] = useState<any[]>([]); const [asi, setAsi] = useState<any[]>([]); const [detalle, setDetalle] = useState(''); const [abierta, setAbierta] = useState(''); const [provAbierto, setProvAbierto] = useState('')
  const [cargando, setCargando] = useState(true); const [tardias, setTardias] = useState<any[]>([])
  useEffect(() => {
    (async () => {
      setCargando(true)
      const [l, r, v, a] = await Promise.all([
        traerTodo('fin_lineas', 'id,monto,unidad_id,documento:fin_documentos(sentido,fecha_doc,periodo_tributario,razon_social,folio,tipo_doc)'),
        traerTodo('fin_remuneraciones', 'id,periodo,unidad_id,costo_empresa'),
        traerTodo('fin_versiones', 'id,unidad_id,delta_contrato'),
        traerTodo('fin_asientos', 'kame_id,fecha,cuenta,nombre_cuenta,debe,haber,unidad_id,doc_tipo,doc_folio,doc_rut,doc_nombre,comentario_det,comentario', 'kame_id'),
      ])
      setLineas(l); setRem(r); setVers(v); setAsi(a)
      // Documentos cuyo período tributario no coincide con el mes de su fecha: aviso de "cae en otro mes"
      setTardias(l.filter(x => x.documento?.periodo_tributario && x.documento?.fecha_doc && x.documento.fecha_doc.slice(0, 7) !== x.documento.periodo_tributario))
      setCargando(false)
    })()
  }, [])
  const hayKame = asi.length > 0
  const meses = useMemo(() => [...new Set([...(hayKame ? asi.map(a => String(a.fecha).slice(0, 7)) : lineas.map(l => l.documento?.fecha_doc?.slice(0, 7))), ...rem.map(r => r.periodo)].filter(Boolean))].sort().reverse() as string[], [lineas, rem, asi, hayKame])

  const filas = unidades.map(u => {
    const ls = lineas.filter(l => l.unidad_id === u.id && (!mes || (l.documento?.periodo_tributario || l.documento?.fecha_doc?.slice(0, 7)) === mes))
    const as = asi.filter(a => a.unidad_id === u.id && (!mes || String(a.fecha).slice(0, 7) === mes))
    const ventas = hayKame ? as.filter(a => a.cuenta.startsWith('3.')).reduce((t, a) => t + Number(a.haber) - Number(a.debe), 0) : ls.filter(l => l.documento?.sentido === 'venta').reduce((a, l) => a + Number(l.monto), 0)
    const compras = hayKame ? as.filter(a => a.cuenta.startsWith('4.')).reduce((t, a) => t + Number(a.debe) - Number(a.haber), 0) : ls.filter(l => l.documento?.sentido === 'compra').reduce((a, l) => a + Number(l.monto), 0)
    const sueldos = rem.filter(r => r.unidad_id === u.id && (!mes || r.periodo === mes)).reduce((a, r) => a + Number(r.costo_empresa), 0)
    const contrato = Number(u.monto_contrato_base) + vers.filter(v => v.unidad_id === u.id).reduce((a, v) => a + Number(v.delta_contrato), 0)
    const margen = ventas - compras - (hayKame ? 0 : sueldos)
    return { u, ventas, compras, sueldos, margen, pct: ventas ? (margen / ventas) * 100 : null, contrato }
  }).filter(f => f.ventas || f.compras || f.sueldos || f.contrato)
  const tot = filas.reduce((a, f) => ({ v: a.v + f.ventas, c: a.c + f.compras, s: a.s + f.sueldos }), { v: 0, c: 0, s: 0 })

  return (
    <>
      <div style={card}>
        <span style={{ fontSize: 13, marginRight: 8 }}>Período:</span>
        <select value={mes} onChange={e => setMes(e.target.value)} style={inp}><option value="">Acumulado</option>{meses.map(m => <option key={m} value={m}>{m}</option>)}</select>
        <p style={{ fontSize: 12, color: '#667085', margin: '8px 0 0' }}>{hayKame ? 'Fuente: contabilidad de Kame (Libro Diario), por fecha del asiento. Ingresos = cuentas 3.x, costos = cuentas 4.x. La planilla de remuneraciones se muestra como referencia: no se resta aparte para no contarla dos veces si Kame ya la tiene en sus costos.' : 'Fuente: archivos importados. Los documentos con libro del SII cargado se ubican en su período tributario; los demás, en el mes de su fecha. Montos netos.'}</p>
      </div>
      <div style={card}>
        {cargando ? <p style={{ fontSize: 13, color: '#999' }}>Cargando…</p> : filas.length === 0 ? <p style={{ fontSize: 13 }}>Aún no hay datos. Sube los informes en la pestaña Importar y marca las unidades activas.</p> :
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Proyecto</th><th style={{ ...th, textAlign: 'right' }}>Contrato</th><th style={{ ...th, textAlign: 'right' }}>Ventas</th><th style={{ ...th, textAlign: 'right' }}>{hayKame ? 'Costos (contabilidad)' : 'Compras'}</th><th style={{ ...th, textAlign: 'right' }}>{hayKame ? 'Rem. planilla (ref.)' : 'Remuneraciones'}</th><th style={{ ...th, textAlign: 'right' }}>Margen</th><th style={{ ...th, textAlign: 'right' }}>%</th></tr></thead>
            <tbody>{filas.map(f => <tr key={f.u.id}><td style={td}>{f.u.nombre}</td><td style={der}>{f.contrato ? $(f.contrato) : '—'}</td><td style={der}>{$(f.ventas)}</td><td style={der}>{$(f.compras)}</td><td style={der}>{$(f.sueldos)}</td>
              <td style={{ ...der, color: f.margen < 0 ? '#b42318' : '#067647', fontWeight: 600 }}>{$(f.margen)}</td><td style={der}>{f.pct == null ? '—' : f.pct.toFixed(1) + '%'}</td></tr>)}
              <tr><td style={{ ...td, fontWeight: 600 }}>Total</td><td style={der} /><td style={{ ...der, fontWeight: 600 }}>{$(tot.v)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.c)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.s)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.v - tot.c - (hayKame ? 0 : tot.s))}</td><td style={der} /></tr></tbody></table></div>}
      </div>
      {hayKame && filas.length > 0 && <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Costos por cuenta contable</h2>
        <select value={detalle} onChange={e => setDetalle(e.target.value)} style={inp}><option value="">Elegir proyecto…</option>{filas.map(f => <option key={f.u.id} value={f.u.id}>{f.u.nombre}</option>)}</select>
        {detalle && (() => {
          const base = asi.filter(a => a.unidad_id === detalle && a.cuenta.startsWith('4.') && (!mes || String(a.fecha).slice(0, 7) === mes))
          const m: Record<string, { n: string, v: number }> = {}
          base.forEach(a => { m[a.cuenta] = { n: a.nombre_cuenta, v: (m[a.cuenta]?.v || 0) + Number(a.debe) - Number(a.haber) } })
          return <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}><thead><tr><th style={th}>Cuenta</th><th style={th}>Nombre</th><th style={{ ...th, textAlign: 'right' }}>Monto</th></tr></thead>
            <tbody>{Object.entries(m).sort((x, y) => y[1].v - x[1].v).map(([c, x]) => {
              const abre = abierta === c
              const provs: Record<string, { n: string, rut: string, v: number, docs: any[] }> = {}
              if (abre) base.filter(a => a.cuenta === c).forEach(a => {
                const k = a.doc_rut || a.doc_nombre || '(sin proveedor)'
                provs[k] = provs[k] || { n: a.doc_nombre || (a.doc_rut ? a.doc_rut : 'Sin proveedor (asiento manual o remuneraciones)'), rut: a.doc_rut || '', v: 0, docs: [] }
                provs[k].v += Number(a.debe) - Number(a.haber); provs[k].docs.push(a)
              })
              return [
                <tr key={c} onClick={() => { setAbierta(abre ? '' : c); setProvAbierto('') }} style={{ cursor: 'pointer', background: abre ? '#f0f9ff' : undefined }}>
                  <td style={td}>{abre ? '▾' : '▸'} {c}</td><td style={td}>{x.n}</td><td style={der}>{$(x.v)}</td></tr>,
                ...Object.entries(provs).sort((p, q) => q[1].v - p[1].v).flatMap(([k, pv]) => {
                  const ab2 = provAbierto === c + '|' + k
                  return [
                    <tr key={c + k} onClick={() => setProvAbierto(ab2 ? '' : c + '|' + k)} style={{ cursor: 'pointer', background: '#fafcff' }}>
                      <td style={{ ...td, paddingLeft: 28 }}>{ab2 ? '▾' : '▸'} {pv.rut}</td><td style={td}>{pv.n} <span style={{ color: '#98a2b3' }}>· {pv.docs.length} mov.</span></td><td style={der}>{$(pv.v)}</td></tr>,
                    ...(ab2 ? pv.docs.sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha))).map((a: any) =>
                      <tr key={a.kame_id}><td style={{ ...td, paddingLeft: 52, color: '#667085' }}>{String(a.fecha).slice(0, 10)}</td><td style={{ ...td, color: '#667085' }}>{a.doc_tipo ? `${a.doc_tipo} ${a.doc_folio || ''}` : (a.comentario_det || a.comentario || '')}</td><td style={{ ...der, color: '#667085' }}>{$(Number(a.debe) - Number(a.haber))}</td></tr>) : []),
                  ]
                }),
              ]
            })}</tbody></table>
        })()}
      </div>}
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
      if (j.resumen) setSalida(j.resumen)
      else if (j.intentos) setSalida(j.intentos.map((x: any) => `${x.parametros}\n  HTTP ${x.status} · ${x.estado || '-'} · ${x.largo} caracteres\n  ${x.msg}`).join('\n\n'))
      else if (j.distintas) setSalida(`Probé ${j.probadas} rutas. Las que NO dieron 404:\n\n` + (j.distintas.length ? j.distintas.map((x: any) => `${x.status}  ${x.ruta}`).join('\n') : '(ninguna: todas dieron 404)'))
      else if (j.respuesta !== undefined) { let t = j.respuesta; try { t = JSON.stringify(JSON.parse(t), null, 2) } catch {} ; setSalida(`HTTP ${j.status} · ${j.tipo} · ${j.largo} caracteres\n\n${t}`) }
      else setSalida(j.mensaje || j.error || JSON.stringify(j))
    } catch (e: any) { setSalida('Error: ' + e.message) }
    setOcupado(false)
  }
  const hoy = new Date(); const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const [mDesde, setMDesde] = useState(mesActual); const [mHasta, setMHasta] = useState(mesActual); const [log, setLog] = useState<string[]>([])
  const sincronizar = async () => {
    setOcupado(true); setLog([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const meses: string[] = []
      for (let [y, m] = mDesde.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= mHasta; m++) { if (m > 12) { m = 1; y++ } meses.push(`${y}-${String(m).padStart(2, '0')}`); if (meses.length > 36) break }
      for (const mes of meses) {
        const [y, m] = mes.split('-').map(Number); const fin = new Date(y, m, 0).getDate()
        let total = 0, guardadas = 0
        for (let page = 1; page <= 40; page++) {
          setLog(l => [...l.filter(x => !x.startsWith(mes + ':')), `${mes}: página ${page}…`])
          const r = await fetch('/api/finanzas/kame', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ accion: 'sync_pagina', desde: `${mes}-01`, hasta: `${mes}-${fin}`, page }) })
          const j = await r.json()
          if (!r.ok) throw new Error(`${mes} página ${page}: ${j.error || r.status}`)
          total += j.lineas; guardadas += j.guardadas
          if (!j.hayMas) break
        }
        setLog(l => [...l.filter(x => !x.startsWith(mes + ':')), `${mes}: listo · ${total} líneas leídas, ${guardadas} de ingresos/costos guardadas`])
      }
    } catch (e: any) { setLog(l => [...l, 'Error: ' + e.message]) }
    setOcupado(false)
  }
  const parse = (t: string) => { try { return JSON.parse(t || '{}') } catch { return {} } }
  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Conexión con la API de Kame</h2>
      <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Las credenciales están solo en el servidor (variables KAME_CLIENT_ID y KAME_CLIENT_SECRET en Vercel). Esta pantalla sirve para probar la conexión y descubrir qué endpoints responden.</p>
      <div style={{ background: '#f0f9ff', borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <b style={{ fontSize: 14 }}>Sincronizar contabilidad desde Kame (Libro Diario)</b>
        <p style={{ fontSize: 12, color: '#667085', margin: '4px 0 8px' }}>Trae ingresos (cuentas 3.x) y costos (cuentas 4.x) con su unidad de negocio. Volver a sincronizar un mes reemplaza ese mes completo, sin duplicar.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          Desde <input type="month" value={mDesde} onChange={e => setMDesde(e.target.value)} style={inp} /> hasta <input type="month" value={mHasta} onChange={e => setMHasta(e.target.value)} style={inp} />
          <button disabled={ocupado} onClick={sincronizar} style={btn(true, ocupado)}>Sincronizar</button>
        </div>
        {log.length > 0 && <pre style={{ fontSize: 12, margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>}
      </div>
      <button disabled={ocupado} onClick={() => llamar({ accion: 'token' })} style={btn(true, ocupado)}>1. Probar conexión (token)</button>
      <button disabled={ocupado} onClick={() => llamar({ accion: 'descubrir', prefijos: pref.split(',').map(x => x.trim()), nombres: nom.split(',').map(x => x.trim()) })} style={{ ...btn(false, ocupado), marginLeft: 8 }}>Descubrir endpoints</button>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <label style={{ fontSize: 12 }}>Carpetas a probar<br /><input value={pref} onChange={e => setPref(e.target.value)} style={{ ...inp, width: 340 }} /></label>
        <label style={{ fontSize: 12 }}>Nombres a probar<br /><input value={nom} onChange={e => setNom(e.target.value)} style={{ ...inp, width: 440 }} /></label>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={metodo} onChange={e => setMetodo(e.target.value as any)} style={inp}><option>GET</option><option>POST</option></select>
        <input list="sug" value={ruta} onChange={e => setRuta(e.target.value)} style={{ ...inp, width: 300 }} /><datalist id="sug">{SUGERIDOS.map(x => <option key={x} value={x} />)}</datalist>
        <button disabled={ocupado} onClick={() => llamar({ accion: 'paginar' })} style={btn(false, ocupado)}>Probar paginación Libro Diario</button>
        <button disabled={ocupado} onClick={() => llamar({ accion: 'resumen_diario' })} style={btn(false, ocupado)}>Resumen Libro Diario (octubre)</button>
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

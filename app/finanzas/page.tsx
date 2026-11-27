'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { traerTodo } from '@/lib/operaciones'
import { TIPOS, TipoArchivo, Doc, Rem, leerInforme, leerLibro, leerRemuneraciones, guardarImportacion, guardarRemuneraciones } from '@/lib/finanzas'

const AZUL = '#1B4F9C'
const miles = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const $ = (n: number) => { const r = Math.round(n || 0); return (r < 0 ? '-' : '') + miles(String(Math.abs(r))) }
// Campo de monto: muestra puntos de miles mientras se escribe y guarda solo dígitos (con - opcional)
function MontoInput({ value, onChange, style, placeholder }: { value: string, onChange: (v: string) => void, style?: React.CSSProperties, placeholder?: string }) {
  const mostrar = (v: string) => { const neg = v.startsWith('-'); const d = v.replace(/\D/g, ''); return (neg ? '-' : '') + (d ? miles(String(Number(d))) : '') }
  return <input type="text" inputMode="decimal" value={mostrar(value)} placeholder={placeholder} onChange={e => { const t = e.target.value; const neg = t.trim().startsWith('-'); const d = t.replace(/\D/g, ''); onChange((neg ? '-' : '') + (d ? String(Number(d)) : '')) }} style={style} />
}
const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)', marginBottom: 16 }
const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }
const btn = (primario = true, off = false): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: primario ? 'none' : '1px solid #d0d5dd', background: off ? '#c7ced9' : primario ? AZUL : '#fff', color: primario ? '#fff' : '#344054', fontSize: 13, cursor: off ? 'default' : 'pointer', fontFamily: 'inherit' })
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: '#667085', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid #eaecf0', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontSize: 13, padding: '6px 8px', borderBottom: '1px solid #f2f4f7' }
const der: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

type Unidad = { id: string, nombre: string, grupo: string | null, activa: boolean, monto_contrato_base: number, presupuesto_desde?: string | null, presupuesto_hasta?: string | null }
type Pestana = 'importar' | 'unidades' | 'presupuesto' | 'ingresos' | 'resultado' | 'kame'

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

  const tabs: [Pestana, string][] = [['resultado', 'Resultado por proyecto'], ['ingresos', 'Ingresos'], ['presupuesto', 'Presupuesto'], ['importar', 'Importar'], ['unidades', 'Unidades'], ['kame', 'Conexión Kame']]
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
        {tab === 'ingresos' && <Ingresos unidades={unidades.filter(u => u.activa)} />}
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
  const cambiar = async (id: string, campos: Partial<Unidad>) => { await supabase.from('fin_unidades').update(campos).eq('id', id); recargar() }
  const [nombreU, setNombreU] = useState(''); const [msgU, setMsgU] = useState('')
  const agregarUnidad = async () => {
    const nombre = nombreU.trim().replace(/\s+/g, ' '); if (!nombre) return
    if (unidades.some(u => normNombre(u.nombre) === normNombre(nombre))) { setMsgU(`Ya existe la unidad «${nombre}».`); return }
    const { error } = await supabase.from('fin_unidades').insert({ nombre, activa: true })
    if (error) setMsgU('No se pudo crear: ' + error.message); else { setNombreU(''); setMsgU(`Unidad «${nombre}» creada. Vuelve a sincronizar Kame y BUK para traer sus datos.`); recargar() }
  }
  return (
    <>
      <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Unidades de negocio (centros de costo)</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Las sincronizaciones con Kame y BUK solo guardan las unidades registradas aquí. Para sumar un proyecto nuevo, créalo con el mismo nombre que tiene en Kame como unidad de negocio. Deja activas solo las que quieres controlar; las demás no aparecen en Presupuesto ni en Resultado.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Activa</th><th style={th}>Nombre en Kame</th></tr></thead>
          <tbody>{unidades.map(u => <tr key={u.id} style={{ opacity: u.activa ? 1 : 0.5 }}>
            <td style={td}><input type="checkbox" checked={u.activa} onChange={e => cambiar(u.id, { activa: e.target.checked })} /></td>
            <td style={td}>{u.nombre}</td>
          </tr>)}</tbody></table>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input value={nombreU} onChange={e => setNombreU(e.target.value)} placeholder="Nueva unidad (nombre exacto de Kame)" style={{ ...inp, width: 320 }} />
          <button onClick={agregarUnidad} style={btn()}>Crear unidad</button>
        </div>
        {msgU && <p style={{ fontSize: 12, margin: '8px 0 0', color: /^(No|Ya)/.test(msgU) ? '#b42318' : '#067647' }}>{msgU}</p>}
      </div>
      <Catalogo />
    </>
  )
}

// Catálogo oficial de subpartidas (configuración): cada una pertenece a UNA cuenta contable de Kame
function Catalogo() {
  const [catalogo, setCatalogo] = useState<any[]>([]); const [cuentas, setCuentas] = useState<Record<string, string>>({})
  const [nuevoNombre, setNuevoNombre] = useState(''); const [nuevaCuenta, setNuevaCuenta] = useState(''); const [msg, setMsg] = useState('')
  const cargarCatalogo = useCallback(async () => {
    const [c, k] = await Promise.all([supabase.from('fin_catalogo_partidas').select('*').order('orden').order('nombre'), supabase.from('fin_cuentas').select('*').order('cuenta')])
    setCatalogo(c.data || []); setCuentas(Object.fromEntries((k.data || []).map((x: any) => [x.cuenta, x.nombre_cuenta])))
  }, [])
  useEffect(() => { cargarCatalogo() }, [cargarCatalogo])
  const agregarCatalogo = async () => {
    const nombre = nuevoNombre.trim().replace(/\s+/g, ' ')
    if (!nombre) return
    if (!nuevaCuenta) { setMsg('Elige a qué cuenta contable de Kame pertenece la subpartida.'); return }
    const norm = normNombre(nombre); const ya = catalogo.find(c => c.nombre_norm === norm)
    if (ya) { setMsg(`Ya existe la subpartida «${ya.nombre}». Usa esa en vez de crear «${nombre}».`); return }
    const { error } = await supabase.from('fin_catalogo_partidas').insert({ nombre, nombre_norm: norm, cuenta: nuevaCuenta, cuentas: nuevaCuenta, orden: catalogo.length })
    if (error) setMsg('No se pudo crear: ' + error.message); else { setNuevoNombre(''); setNuevaCuenta(''); setMsg(`Subpartida «${nombre}» creada.`); cargarCatalogo() }
  }
  const cambiarCuentaCatalogo = async (c: any, cuenta: string) => {
    const { data: ps } = await supabase.from('fin_partidas').select('id').eq('catalogo_id', c.id)
    const ids = (ps || []).map(x => x.id)
    if (ids.length) { const { count } = await supabase.from('fin_asignaciones').select('id', { count: 'exact', head: true }).in('partida_id', ids); if (count) { alert(`«${c.nombre}» ya tiene ${count} costos asignados; no se puede cambiar de cuenta. Quita primero esas asignaciones.`); cargarCatalogo(); return } }
    await supabase.from('fin_catalogo_partidas').update({ cuenta, cuentas: cuenta }).eq('id', c.id); cargarCatalogo()
  }
  const cuentasOpc = Object.keys(cuentas).filter(c => !c.startsWith(CUENTA_REM)).sort()
  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Catálogo oficial de subpartidas ({catalogo.length})</h2>
      <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Kame solo tiene la cuenta contable (ej. «Costos Materiales de Construcción»). Aquí definimos las subpartidas que la abren (Hormigón, Cubiertas, Fierro…). Todos los proyectos usan esta lista, así nadie escribe «Cubierta» y otro «Cubiertas». El presupuesto de una cuenta es la suma de sus subpartidas.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Subpartida</th><th style={th}>Cuenta contable de Kame</th><th style={th}>Costo real desde</th></tr></thead>
        <tbody>{[...catalogo].sort((a, b) => a.cuenta.localeCompare(b.cuenta) || a.nombre.localeCompare(b.nombre)).map(c => <tr key={c.id}><td style={td}>{c.nombre}</td>
          <td style={td}>{c.fuente === 'remuneraciones' ? <span style={{ color: '#667085' }}>{nomCuenta(cuentas, CUENTA_REM)}</span> :
            <select value={c.cuenta} onChange={e => cambiarCuentaCatalogo(c, e.target.value)} style={{ ...inp, padding: '4px 6px', maxWidth: 380 }}>{!cuentasOpc.includes(c.cuenta) && <option value={c.cuenta}>{c.cuenta || 'Elegir cuenta…'}</option>}{cuentasOpc.map(k => <option key={k} value={k}>{k} · {cuentas[k]}</option>)}</select>}</td>
          <td style={td}>{c.fuente === 'remuneraciones' ? 'Remuneraciones de BUK' : 'Facturas de Kame asignadas'}</td></tr>)}</tbody></table>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nueva subpartida (ej. Fierro)" style={{ ...inp, width: 220 }} />
        <select value={nuevaCuenta} onChange={e => setNuevaCuenta(e.target.value)} style={{ ...inp, maxWidth: 380 }}><option value="">Cuenta contable de Kame…</option>{cuentasOpc.map(k => <option key={k} value={k}>{k} · {cuentas[k]}</option>)}</select>
        <button onClick={agregarCatalogo} style={btn()}>Crear subpartida</button>
      </div>
      {msg && <p style={{ fontSize: 12, margin: '8px 0 0', color: /^(No|Ya|Escribe|Elige)/.test(msg) ? '#b42318' : '#067647' }}>{msg}</p>}
    </div>
  )
}

// ───────────────────────── Presupuesto ─────────────────────────
// Nombre normalizado para impedir duplicados tipo "Cubierta" / "cubiertas" / "CUBIERTAS "
const normNombre = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ').split(' ').map(w => w.length > 4 ? w.replace(/(es|s)$/, '') : w).join(' ')
const nombreMes = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }).replace('.', '') }
const rangoMeses = (d?: string | null, h?: string | null) => { const out: string[] = []; if (!d || !h) return out; let [y, m] = d.slice(0, 7).split('-').map(Number); const [yh, mh] = h.slice(0, 7).split('-').map(Number); while ((y < yh || (y === yh && m <= mh)) && out.length < 60) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } } return out }
const CUENTA_REM = '4.02.04'
const nomCuenta = (mapa: Record<string, string>, c: string) => c === CUENTA_REM ? 'Remuneraciones (BUK)' : (mapa[c] || 'Cuenta sin nombre')
const agruparPorCuenta = (partidas: any[]) => { const g: Record<string, any[]> = {}; partidas.forEach(p => { const c = p.catalogo?.cuenta || '(sin cuenta)'; (g[c] = g[c] || []).push(p) }); return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0])) }

function Presupuesto({ unidades, recargar }: { unidades: Unidad[], recargar: () => void }) {
  const [uid, setUid] = useState('')
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<Record<string, string>>({})
  const [partidas, setPartidas] = useState<any[]>([])
  const [versiones, setVersiones] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [elegida, setElegida] = useState('')
  const [vTipo, setVTipo] = useState<'base' | 'adicional'>('base'); const [vDesc, setVDesc] = useState(''); const [vContratoId, setVContratoId] = useState(''); const [draft, setDraft] = useState<Record<string, string>>({})
  const [contratos, setContratos] = useState<any[]>([]); const [editId, setEditId] = useState<string | null>(null); const [abSub, setAbSub] = useState(false); const [abPer, setAbPer] = useState(false)
  const [msg, setMsg] = useState(''); const [guardando, setGuardando] = useState(false)
  const unidad = unidades.find(u => u.id === uid)
  const meses = useMemo(() => rangoMeses(unidad?.presupuesto_desde, unidad?.presupuesto_hasta), [unidad])

  const cargarCatalogo = useCallback(async () => {
    const [c, k] = await Promise.all([supabase.from('fin_catalogo_partidas').select('*').order('orden').order('nombre'), supabase.from('fin_cuentas').select('*').order('cuenta')])
    setCatalogo(c.data || []); setCuentas(Object.fromEntries((k.data || []).map((x: any) => [x.cuenta, x.nombre_cuenta])))
  }, [])
  useEffect(() => { cargarCatalogo() }, [cargarCatalogo])

  const cargar = useCallback(async () => {
    if (!uid) return
    const [p, v, ct] = await Promise.all([
      supabase.from('fin_partidas').select('*, catalogo:fin_catalogo_partidas(nombre,cuenta,fuente)').eq('unidad_id', uid).order('orden').order('nombre'),
      supabase.from('fin_versiones').select('*').eq('unidad_id', uid).order('numero'),
      supabase.from('fin_contratos').select('*').eq('unidad_id', uid).order('creado_en'),
    ])
    setPartidas(p.data || []); setVersiones(v.data || []); setContratos(ct.data || [])
    const ids = (v.data || []).map(x => x.id)
    if (ids.length) { const { data } = await supabase.from('fin_version_items').select('*').in('version_id', ids).limit(20000); setItems(data || []) } else setItems([])
  }, [uid])
  useEffect(() => { cargar() }, [cargar])

  const pres = useMemo(() => { const m: Record<string, number> = {}; items.forEach(i => { const k = i.partida_id + '|' + i.mes; m[k] = (m[k] || 0) + Number(i.delta) }); return m }, [items])
  const grupos = useMemo(() => agruparPorCuenta(partidas), [partidas])
  const contrato = contratos.reduce((a, c) => a + Number(c.monto), 0)
  const totPres = items.reduce((a, i) => a + Number(i.delta), 0)
  const sinMes = items.filter(i => !meses.includes(i.mes)).reduce((a, i) => a + Number(i.delta), 0)

  const guardarPeriodo = async (campo: 'presupuesto_desde' | 'presupuesto_hasta', valor: string) => { await supabase.from('fin_unidades').update({ [campo]: valor || null }).eq('id', uid); recargar() }
  const agregarPartida = async () => {
    const c = catalogo.find(x => x.id === elegida); if (!c) return
    const { error } = await supabase.from('fin_partidas').insert({ unidad_id: uid, nombre: c.nombre, catalogo_id: c.id, fuente: c.fuente === 'remuneraciones' ? 'remuneraciones' : 'manual', orden: partidas.length })
    if (error) setMsg('No se pudo agregar: ' + error.message); else { setElegida(''); setMsg(''); cargar() }
  }
  const quitarPartida = async (p: any) => {
    const { count } = await supabase.from('fin_asignaciones').select('id', { count: 'exact', head: true }).eq('partida_id', p.id)
    if (!confirm(`¿Quitar «${p.nombre}» de este proyecto? Se borra su presupuesto${count ? ` y ${count} asignaciones de costos (esos costos vuelven a «por asignar»)` : ''}.`)) return
    await supabase.from('fin_partidas').delete().eq('id', p.id); cargar()
  }
  const limpiarEdicion = () => { setEditId(null); setDraft({}); setVDesc(''); setVContratoId(''); setVTipo('base') }
  const editarVersion = (v: any) => {
    const d: Record<string, string> = {}
    items.filter(i => i.version_id === v.id).forEach(i => { d[i.partida_id + '|' + i.mes] = String(Math.round(Number(i.delta))) })
    setEditId(v.id); setVTipo(v.tipo); setVDesc(v.descripcion || ''); setDraft(d); setVContratoId(contratos.find(c => c.version_id === v.id)?.id || ''); setMsg('')
    setTimeout(() => document.getElementById('grilla-ppto')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const guardarVersion = async () => {
    const celdas = Object.entries(draft).filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) !== 0)
    if (!celdas.length) { setMsg('Escribe al menos un monto en la grilla.'); return }
    if (!editId && vTipo === 'base' && versiones.some(v => v.tipo === 'base') && !confirm('Este proyecto ya tiene un presupuesto base. Si guardas otro, los montos se SUMAN. ¿Es lo que quieres? (Para modificar uno existente, púlsalo en el historial de versiones; para un adicional usa «Adicional», con montos positivos o negativos).')) return
    setGuardando(true)
    const desc = vDesc || (vTipo === 'base' ? 'Presupuesto base' : 'Adicional')
    let versionId = editId
    if (editId) {
      const { error } = await supabase.from('fin_versiones').update({ tipo: vTipo, descripcion: desc }).eq('id', editId)
      if (error) { setMsg('No se pudo guardar: ' + error.message); setGuardando(false); return }
      const { error: eD } = await supabase.from('fin_version_items').delete().eq('version_id', editId)
      if (eD) { setMsg('No se pudieron reemplazar los montos: ' + eD.message); setGuardando(false); return }
    } else {
      const numero = (versiones[versiones.length - 1]?.numero || 0) + 1
      const { data: v, error } = await supabase.from('fin_versiones').insert({ unidad_id: uid, numero, tipo: vTipo, descripcion: desc, delta_contrato: 0 }).select('id').single()
      if (error || !v) { setMsg('No se pudo guardar: ' + error?.message); setGuardando(false); return }
      versionId = v.id
    }
    const rows = celdas.map(([k, x]) => { const [partida_id, mes] = k.split('|'); return { version_id: versionId, partida_id, mes, delta: Number(x) } })
    const { error: e2 } = await supabase.from('fin_version_items').insert(rows); if (e2) { setMsg('No se pudieron guardar los montos: ' + e2.message); setGuardando(false); return }
    // Vínculo con el adicional de contrato (se crea en la pestaña Ingresos)
    await supabase.from('fin_contratos').update({ version_id: null }).eq('version_id', versionId)
    if (vTipo === 'adicional' && vContratoId) await supabase.from('fin_contratos').update({ version_id: versionId }).eq('id', vContratoId)
    limpiarEdicion(); setMsg(editId ? 'Versión actualizada.' : 'Versión guardada.'); setGuardando(false); cargar(); recargar()
  }
  const borrarVersion = async (v: any) => { if (!confirm(`¿Borrar la versión #${v.numero} («${v.descripcion}»)? Se quitan sus montos del presupuesto.`)) return; await supabase.from('fin_versiones').delete().eq('id', v.id); cargar(); recargar() }

  const dispo = catalogo.filter(c => !partidas.some(p => p.catalogo_id === c.id))
  const celda: React.CSSProperties = { ...td, padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12 }
  const cabCuenta: React.CSSProperties = { ...td, background: '#f2f4f7', fontWeight: 600, whiteSpace: 'nowrap' }

  return (
    <>
      <div style={card}>
        <select value={uid} onChange={e => { setUid(e.target.value); setDraft({}); setMsg('') }} style={{ ...inp, minWidth: 320 }}><option value="">Elegir proyecto…</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        {unidad && <span style={{ marginLeft: 16, fontSize: 13 }}>Contrato vigente (ver pestaña Ingresos): <b>${$(contrato)}</b> · Presupuesto de costos: <b>${$(totPres)}</b>{contrato > 0 && totPres > 0 && <> · Margen presupuestado: <b>{(((contrato - totPres) / contrato) * 100).toFixed(1)}%</b></>}</span>}
        {msg && <p style={{ fontSize: 12, margin: '8px 0 0', color: /^(No|Ya|Escribe|Elige)/.test(msg) ? '#b42318' : '#067647' }}>{msg}</p>}
      </div>

      {unidad && <>
        <details style={card} open={abPer || meses.length === 0} onToggle={e => setAbPer((e.target as HTMLDetailsElement).open)}>
          <summary style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Período del proyecto{meses.length ? ` · ${meses.length} meses` : ''}</summary>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, marginTop: 8 }}>
            Inicio <input type="date" defaultValue={(unidad.presupuesto_desde || '').length === 10 ? unidad.presupuesto_desde! : ''} onBlur={e => e.target.value !== (unidad.presupuesto_desde || '') && guardarPeriodo('presupuesto_desde', e.target.value)} style={inp} />
            Término <input type="date" defaultValue={(unidad.presupuesto_hasta || '').length === 10 ? unidad.presupuesto_hasta! : ''} onBlur={e => e.target.value !== (unidad.presupuesto_hasta || '') && guardarPeriodo('presupuesto_hasta', e.target.value)} style={inp} />
            <span style={{ color: '#667085', fontSize: 12 }}>{meses.length ? `${meses.length} meses de presupuesto` : 'Elige fecha de inicio y de término para generar las columnas de meses.'}</span>
          </div>
        </details>

        {partidas.length > 0 && meses.length > 0 && <>
          <div style={{ ...card, border: editId ? '2px solid #f79009' : undefined }} id="grilla-ppto">
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>{editId ? `Editando la versión #${versiones.find(v => v.id === editId)?.numero ?? ''}` : 'Ingresar presupuesto por mes'}</h2>
            <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>{editId ? 'Corrige los montos y guarda: esta versión se reemplaza (no se crea otra). ' : ''}Escribe el monto neto de cada subpartida en cada mes; la cuenta contable suma sola. Primero guarda el <b>presupuesto base</b>. Si el proyecto gana un adicional, regístralo antes en la pestaña <b>Ingresos</b> (con su monto de venta) y aquí guarda una versión <b>adicional</b> con el costo por subpartida y mes. El contrato y los EDP se manejan en Ingresos.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={vTipo} onChange={e => setVTipo(e.target.value as any)} style={inp}><option value="base">Presupuesto base</option><option value="adicional">Adicional / nota de venta</option></select>
              <input value={vDesc} onChange={e => setVDesc(e.target.value)} placeholder="Descripción (ej. Adicional fierro)" style={{ ...inp, width: 280 }} />
              {vTipo === 'adicional' && <select value={vContratoId} onChange={e => { setVContratoId(e.target.value); const c = contratos.find(x => x.id === e.target.value); if (c && !vDesc) setVDesc(c.descripcion) }} style={{ ...inp, maxWidth: 320 }}><option value="">Adicional de contrato asociado…</option>{contratos.filter(c => c.tipo === 'adicional' && (!c.version_id || c.version_id === editId)).map(c => <option key={c.id} value={c.id}>{c.descripcion || 'Adicional'} · ${$(Number(c.monto))}</option>)}</select>}
            </div>
            <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse' }}><thead><tr><th style={th}>Cuenta / subpartida</th>{meses.map(m => <th key={m} style={{ ...th, textAlign: 'right' }}>{nombreMes(m)}</th>)}<th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>{grupos.flatMap(([c, ps]) => [
                <tr key={c}><td style={cabCuenta}>{c} · {nomCuenta(cuentas, c)}</td>{meses.map(m => <td key={m} style={{ ...celda, background: '#f2f4f7', fontWeight: 600 }}>{(() => { const v = ps.reduce((a, p) => a + (Number(draft[p.id + '|' + m]) || 0), 0); return v ? $(v) : '' })()}</td>)}<td style={{ ...celda, background: '#f2f4f7', fontWeight: 600 }}>{$(ps.reduce((a, p) => a + meses.reduce((b, m) => b + (Number(draft[p.id + '|' + m]) || 0), 0), 0))}</td></tr>,
                ...ps.map(p => <tr key={p.id}><td style={{ ...td, whiteSpace: 'nowrap', paddingLeft: 24 }}>{p.nombre}</td>{meses.map(m => <td key={m} style={{ ...td, padding: 3 }}>
                  <MontoInput value={draft[p.id + '|' + m] ?? ''} onChange={v => setDraft(d => ({ ...d, [p.id + '|' + m]: v }))} style={{ ...inp, width: 110, padding: '5px 6px', textAlign: 'right' }} /></td>)}
                  <td style={celda}>{$(meses.reduce((b, m) => b + (Number(draft[p.id + '|' + m]) || 0), 0))}</td></tr>),
              ])}</tbody></table></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={guardarVersion} disabled={guardando} style={btn(true, guardando)}>{guardando ? 'Guardando…' : editId ? 'Guardar cambios de la versión' : `Guardar ${vTipo === 'base' ? 'presupuesto base' : 'adicional'}`}</button>
              {editId && <button onClick={limpiarEdicion} style={btn(false)}>Cancelar edición</button>}
            </div>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Presupuesto vigente (base + adicionales)</h2>
            <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>El avance contra el costo real está en <b>Resultado por proyecto</b>.</p>
            <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>Cuenta / subpartida</th>{meses.map(m => <th key={m} style={{ ...th, textAlign: 'right' }}>{nombreMes(m)}</th>)}<th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>{grupos.flatMap(([c, ps]) => {
                const tp = (p: any) => meses.reduce((a, m) => a + (pres[p.id + '|' + m] || 0), 0)
                return [
                  <tr key={c}><td style={cabCuenta}>{c} · {nomCuenta(cuentas, c)}</td>{meses.map(m => <td key={m} style={{ ...celda, background: '#f2f4f7', fontWeight: 600 }}>{(() => { const v = ps.reduce((a, p) => a + (pres[p.id + '|' + m] || 0), 0); return v ? $(v) : '·' })()}</td>)}<td style={{ ...celda, background: '#f2f4f7', fontWeight: 600 }}>{$(ps.reduce((a, p) => a + tp(p), 0))}</td></tr>,
                  ...ps.map(p => <tr key={p.id}><td style={{ ...td, whiteSpace: 'nowrap', paddingLeft: 24 }}>{p.nombre}</td>{meses.map(m => <td key={m} style={celda}>{pres[p.id + '|' + m] ? $(pres[p.id + '|' + m]) : '·'}</td>)}<td style={celda}>{$(tp(p))}</td></tr>),
                ]
              })}
                <tr><td style={{ ...td, fontWeight: 600 }}>Total proyecto</td>{meses.map(m => <td key={m} style={{ ...celda, fontWeight: 600 }}>{(() => { const v = partidas.reduce((a, p) => a + (pres[p.id + '|' + m] || 0), 0); return v ? $(v) : '·' })()}</td>)}<td style={{ ...celda, fontWeight: 600 }}>{$(totPres - sinMes)}</td></tr>
              </tbody></table></div>
            {Math.abs(sinMes) > 0 && <p style={{ fontSize: 12, color: '#92400e', margin: '8px 0 0' }}>Hay ${$(sinMes)} presupuestados en meses fuera del período (o sin mes) que no aparecen en las columnas.</p>}
          </div>
        </>}
        {!(partidas.length > 0 && meses.length > 0) && <div style={card}><p style={{ fontSize: 13, margin: 0 }}>Para ingresar presupuesto falta {meses.length === 0 ? 'definir el <b>período</b>' : ''}{meses.length === 0 && partidas.length === 0 ? ' y ' : ''}{partidas.length === 0 ? 'agregar las <b>subpartidas</b> del proyecto' : ''}: están en las secciones desplegables de esta pantalla.</p></div>}

        {versiones.length > 0 && <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Historial de versiones</h2>
          <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Pincha una versión para cargarla en la grilla y corregirla.</p>
          {versiones.map(v => <div key={v.id} onClick={() => editarVersion(v)} title="Pincha para editar" style={{ fontSize: 13, padding: '6px 8px', borderBottom: '1px solid #f2f4f7', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', background: v.id === editId ? '#fff7ed' : undefined }}>
            <span style={{ flex: 1 }}>#{v.numero} · {v.tipo === 'base' ? 'Base' : 'Adicional'} · {v.descripcion} · {new Date(v.fecha + 'T12:00').toLocaleDateString('es-CL')} · montos ${$(items.filter(i => i.version_id === v.id).reduce((a, i) => a + Number(i.delta), 0))}{v.id === editId ? ' · (editando)' : ''}</span>
            <button onClick={e => { e.stopPropagation(); editarVersion(v) }} style={btn(false)}>Editar</button>
            <button onClick={e => { e.stopPropagation(); if (editId === v.id) limpiarEdicion(); borrarVersion(v) }} style={btn(false)}>Borrar</button></div>)}
        </div>}

        <details style={card} open={abSub || partidas.length === 0} onToggle={e => setAbSub((e.target as HTMLDetailsElement).open)}>
          <summary style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Subpartidas de este proyecto ({partidas.length})</summary>
          <div style={{ marginTop: 8 }}>
            {grupos.length === 0 && <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Aún no hay subpartidas. Agrega las que necesitas desde el catálogo (si falta alguna, créala en la pestaña Unidades).</p>}
            {grupos.map(([c, ps]) => <div key={c} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#344054' }}>{c} · {nomCuenta(cuentas, c)}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>{ps.map(p => <span key={p.id} style={{ background: '#eef4ff', borderRadius: 99, padding: '4px 10px', fontSize: 13 }}>{p.nombre} <button onClick={() => quitarPartida(p)} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#667085' }}>✕</button></span>)}</div>
            </div>)}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <select value={elegida} onChange={e => setElegida(e.target.value)} style={{ ...inp, minWidth: 300 }}><option value="">Agregar subpartida del catálogo…</option>{dispo.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.cuenta}</option>)}</select>
              <button onClick={agregarPartida} disabled={!elegida} style={btn(true, !elegida)}>Agregar</button>
            </div>
          </div>
        </details>
      </>}
    </>
  )
}

// ───────────────────────── Ingresos (contratos, EDP, órdenes de compra) ─────────────────────────
// Número de EDP dentro de la glosa de una factura: «EDP N°1», «EDP N1», «EDP de 3 rev 0», «EDP 2»
const numEdp = (t: string) => { const m = String(t || '').match(/\bEDP\s*(?:n\s*[°º.o]?\s*|nro\.?\s*|de\s+)?0*(\d+)/i); return m ? m[1] : '' }
const soloNum = (t: string) => { const m = String(t || '').match(/\d+/); return m ? m[0].replace(/^0+(?=\d)/, '') : '' }
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fechaCL = (f?: string | null) => f ? new Date(String(f).slice(0, 10) + 'T12:00').toLocaleDateString('es-CL') : '—'

// Agrupa las líneas de venta de Kame por documento (rut + tipo + folio) y les pone su EDP, si ya calzó
function docsVenta(ventas: any[], links: any[]) {
  const lk = new Map(links.map(l => [Number(l.kame_id), l]))
  const m = new Map<string, any>()
  ventas.forEach(a => {
    const k = a.doc_folio ? `${a.doc_rut}|${a.doc_tipo}|${a.doc_folio}` : `k${a.kame_id}`
    const o = m.get(k) || { key: k, fecha: String(a.fecha).slice(0, 10), tipo: a.doc_tipo, folio: a.doc_folio, nombre: a.doc_nombre, glosa: String(a.comentario_det || a.comentario || ''), texto: `${a.comentario_det || ''} ${a.comentario || ''}`, monto: 0, ids: [] as number[] }
    o.monto += Number(a.haber) - Number(a.debe); o.ids.push(Number(a.kame_id)); m.set(k, o)
  })
  return [...m.values()].map(o => { const l = lk.get(o.ids[0]); return { ...o, edp_id: (l?.edp_id as string) || null, forzado: !!l && !l.edp_id } }).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Datos de ingresos de un proyecto. Calza solo las facturas cuya glosa trae el número de EDP.
function useIngresos(uid: string) {
  const vacio = { contratos: [] as any[], edps: [] as any[], links: [] as any[], ordenes: [] as any[], ventas: [] as any[] }
  const [d, setD] = useState(vacio); const [auto, setAuto] = useState(0)
  const cargar = useCallback(async () => {
    if (!uid) { setD(vacio); return }
    const [c, e, o, v] = await Promise.all([
      supabase.from('fin_contratos').select('*').eq('unidad_id', uid).order('creado_en'),
      supabase.from('fin_edp').select('*').eq('unidad_id', uid).order('creado_en'),
      supabase.from('fin_ordenes_cliente').select('*').eq('unidad_id', uid).order('creado_en'),
      supabase.from('fin_asientos').select('kame_id,fecha,cuenta,debe,haber,doc_tipo,doc_folio,doc_rut,doc_nombre,comentario,comentario_det').eq('unidad_id', uid).like('cuenta', '3.%').order('fecha').limit(5000),
    ])
    const ventas = v.data || []; let links: any[] = []
    const ids = ventas.map(x => Number(x.kame_id))
    for (let i = 0; i < ids.length; i += 400) { const { data } = await supabase.from('fin_edp_asientos').select('*').in('kame_id', ids.slice(i, i + 400)); links = links.concat(data || []) }
    // Calce automático: facturas sin vínculo previo cuya glosa nombra un EDP existente del proyecto
    const edps = e.data || []; const porNum = new Map<string, any[]>(); edps.forEach(x => { const n = soloNum(x.numero); if (n) porNum.set(n, [...(porNum.get(n) || []), x]) })
    const nuevos: any[] = []
    docsVenta(ventas, links).filter(x => !x.edp_id && !x.forzado).forEach(x => { const c = porNum.get(numEdp(x.texto)); if (c && c.length === 1) x.ids.forEach((k: number) => nuevos.push({ kame_id: k, edp_id: c[0].id, manual: false })) })
    if (nuevos.length) { const { error } = await supabase.from('fin_edp_asientos').upsert(nuevos, { onConflict: 'kame_id' }); if (!error) { links = links.concat(nuevos); setAuto(nuevos.length) } }
    setD({ contratos: c.data || [], edps, links, ordenes: o.data || [], ventas })
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [cargar])
  const docs = useMemo(() => docsVenta(d.ventas, d.links), [d.ventas, d.links])
  const facturadoDe = (edpId: string) => docs.filter(x => x.edp_id === edpId).reduce((t, x) => t + x.monto, 0)
  const contratado = d.contratos.reduce((t, c) => t + Number(c.monto), 0)
  const edpTot = d.edps.reduce((t, x) => t + Number(x.monto), 0)
  const facturadoTot = docs.reduce((t, x) => t + x.monto, 0)
  const sinEdp = docs.filter(x => !x.edp_id)
  const porAprobar = d.edps.filter(x => x.estado === 'presentado').reduce((t, x) => t + Math.max(0, Number(x.monto) - facturadoDe(x.id)), 0)
  const porFacturar = d.edps.filter(x => x.estado === 'aprobado').reduce((t, x) => t + Math.max(0, Number(x.monto) - facturadoDe(x.id)), 0)
  const ocPend = d.ordenes.filter(x => x.estado === 'pendiente').reduce((t, x) => t + Number(x.monto), 0)
  return { ...d, docs, cargar, auto, facturadoDe, contratado, edpTot, facturadoTot, sinEdp, porAprobar, porFacturar, ocPend, sinPresentar: contratado - edpTot }
}

function Tarjeta({ t, v, s, color }: { t: string, v: string, s?: string, color?: string }) {
  return <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}><div style={{ fontSize: 11, color: '#667085' }}>{t}</div><div style={{ fontSize: 18, fontWeight: 600, color }}>{v}</div><div style={{ fontSize: 11, color: '#667085' }}>{s || ' '}</div></div>
}

function Ingresos({ unidades }: { unidades: Unidad[] }) {
  const [uid, setUid] = useState(''); const unidad = unidades.find(u => u.id === uid)
  const I = useIngresos(uid)
  const [msg, setMsg] = useState(''); const [abiertos, setAbiertos] = useState<Record<string, boolean>>({}); const [sel, setSel] = useState<Record<string, string>>({})
  const err = (e: any) => { if (e) { setMsg('No se pudo guardar: ' + e.message); return true } return false }
  // Contratos
  const [cEdit, setCEdit] = useState<string | null>(null); const cVacio = { tipo: 'original', descripcion: '', oc: '', monto: '', fecha: '' }; const [fc, setFc] = useState(cVacio)
  const guardarContrato = async () => {
    if (!Number(fc.monto)) { setMsg('Escribe el monto del contrato.'); return }
    const fila = { unidad_id: uid, tipo: fc.tipo, descripcion: fc.descripcion || (fc.tipo === 'original' ? 'Contrato original' : 'Adicional'), orden_compra: fc.oc, monto: Number(fc.monto), fecha: fc.fecha || null }
    const { error } = cEdit ? await supabase.from('fin_contratos').update(fila).eq('id', cEdit) : await supabase.from('fin_contratos').insert(fila)
    if (err(error)) return; setCEdit(null); setFc(cVacio); setMsg('Contrato guardado.'); I.cargar()
  }
  const borrarContrato = async (c: any) => { if (!confirm(`¿Borrar «${c.descripcion}»? Los EDP asociados quedan sin contrato.`)) return; await supabase.from('fin_contratos').delete().eq('id', c.id); I.cargar() }
  // EDP
  const [eEdit, setEEdit] = useState<string | null>(null); const eVacio = { numero: '', descripcion: '', oc: '', contrato_id: '', monto: '', avance: '', fecha: hoyISO() }; const [fe, setFe] = useState(eVacio)
  const guardarEdp = async () => {
    if (!fe.numero.trim() || !Number(fe.monto)) { setMsg('Escribe el número del EDP y su valor neto.'); return }
    if (!eEdit && I.edps.some(x => soloNum(x.numero) === soloNum(fe.numero))) { setMsg(`Ya existe el EDP N°${fe.numero}.`); return }
    const fila: any = { unidad_id: uid, numero: fe.numero.trim(), descripcion: fe.descripcion, orden_compra: fe.oc, contrato_id: fe.contrato_id || null, monto: Number(fe.monto), avance_pct: fe.avance === '' ? null : Number(fe.avance), fecha_presentacion: fe.fecha || null }
    const { error } = eEdit ? await supabase.from('fin_edp').update(fila).eq('id', eEdit) : await supabase.from('fin_edp').insert(fila)
    if (err(error)) return; setEEdit(null); setFe(eVacio); setMsg('EDP guardado. Si una factura de Kame nombra este EDP en su glosa, calza sola.'); I.cargar()
  }
  const cambiarEstado = async (x: any, estado: string) => { await supabase.from('fin_edp').update({ estado, fecha_aprobacion: estado === 'aprobado' ? (x.fecha_aprobacion || hoyISO()) : null }).eq('id', x.id); I.cargar() }
  const borrarEdp = async (x: any) => { if (!confirm(`¿Borrar el EDP N°${x.numero}? Sus facturas quedan «sin EDP».`)) return; await supabase.from('fin_edp').delete().eq('id', x.id); I.cargar() }
  const asignarDoc = async (doc: any, edpId: string | null) => {
    const { error } = await supabase.from('fin_edp_asientos').upsert(doc.ids.map((k: number) => ({ kame_id: k, edp_id: edpId, manual: true })), { onConflict: 'kame_id' })
    if (!err(error)) { setMsg(edpId ? 'Factura asignada al EDP.' : 'Factura desvinculada (queda sin EDP y no se vuelve a calzar sola).'); I.cargar() }
  }
  // Órdenes de compra
  const oVacio = { numero: '', descripcion: '', monto: '', fecha: hoyISO() }; const [fo, setFo] = useState(oVacio)
  const guardarOc = async () => {
    if (!Number(fo.monto)) { setMsg('Escribe el monto de la orden de compra.'); return }
    const { error } = await supabase.from('fin_ordenes_cliente').insert({ unidad_id: uid, numero: fo.numero, descripcion: fo.descripcion, monto: Number(fo.monto), fecha: fo.fecha || null })
    if (!err(error)) { setFo(oVacio); setMsg('Orden de compra registrada.'); I.cargar() }
  }
  const ep = (x: any) => ({ presentado: ['Presentado', '#92400e', '#fef3c7'], aprobado: ['Aprobado', '#065f46', '#d1fae5'] } as any)[x.estado]
  const rojo = (v: number) => v < 0 ? '#b42318' : undefined

  return (
    <>
      <div style={card}>
        <select value={uid} onChange={e => { setUid(e.target.value); setMsg(''); setCEdit(null); setEEdit(null); setFc(cVacio); setFe(eVacio) }} style={{ ...inp, minWidth: 320 }}><option value="">Elegir proyecto…</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        {msg && <p style={{ fontSize: 12, margin: '8px 0 0', color: /^(No|Ya|Escribe)/.test(msg) ? '#b42318' : '#067647' }}>{msg}</p>}
        {I.auto > 0 && <p style={{ fontSize: 12, margin: '8px 0 0', color: '#067647' }}>{I.auto} línea(s) de factura de Kame se calzaron solas con su EDP.</p>}
      </div>

      {unidad && <>
        <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          <Tarjeta t="Contrato vigente" v={'$' + $(I.contratado)} s={`${I.contratos.length} contrato(s) y adicionales`} />
          <Tarjeta t="EDP presentados" v={'$' + $(I.edpTot)} s={I.contratado > 0 ? Math.round(I.edpTot / I.contratado * 100) + '% del contrato' : ''} />
          <Tarjeta t="Facturado (Kame)" v={'$' + $(I.facturadoTot)} s={I.contratado > 0 ? Math.round(I.facturadoTot / I.contratado * 100) + '% del contrato' : ''} />
          <Tarjeta t="EDP por facturar" v={'$' + $(I.porFacturar)} s="aprobados, aún sin factura" />
          <Tarjeta t="EDP por aprobar" v={'$' + $(I.porAprobar)} s="presentados al cliente" />
          <Tarjeta t="Contrato sin EDP" v={'$' + $(I.sinPresentar)} s="aún no presentado" color={rojo(I.sinPresentar)} />
          <Tarjeta t="OC cliente por facturar" v={'$' + $(I.ocPend)} s={`${I.ordenes.filter(x => x.estado === 'pendiente').length} pendiente(s)`} />
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>1. Contrato y adicionales</h2>
          <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>El valor de venta (neto) del contrato original y de cada adicional. Al registrar un adicional, ve a <b>Presupuesto</b> y carga su costo por subpartida; aquí queda marcado si ya lo hiciste.</p>
          {I.contratos.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}><thead><tr><th style={th}>Tipo</th><th style={th}>Descripción</th><th style={th}>N° OC</th><th style={th}>Fecha</th><th style={{ ...th, textAlign: 'right' }}>Monto neto</th><th style={th}>Costos (Presupuesto)</th><th style={th} /></tr></thead>
            <tbody>{I.contratos.map(c => <tr key={c.id}><td style={td}>{c.tipo === 'original' ? 'Original' : 'Adicional'}</td><td style={td}>{c.descripcion}</td><td style={td}>{c.orden_compra || '—'}</td><td style={td}>{fechaCL(c.fecha)}</td><td style={der}>{$(Number(c.monto))}</td>
              <td style={td}>{c.tipo === 'adicional' ? (c.version_id ? <span style={{ color: '#067647' }}>✔ cargado</span> : <span style={{ color: '#b54708' }}>pendiente: ve a Presupuesto</span>) : ''}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}><button onClick={() => { setCEdit(c.id); setFc({ tipo: c.tipo, descripcion: c.descripcion, oc: c.orden_compra || '', monto: String(Math.round(Number(c.monto))), fecha: c.fecha || '' }) }} style={{ ...btn(false), padding: '3px 8px', fontSize: 12 }}>Editar</button> <button onClick={() => borrarContrato(c)} style={{ ...btn(false), padding: '3px 8px', fontSize: 12 }}>Borrar</button></td></tr>)}
              <tr><td style={{ ...td, fontWeight: 600 }} colSpan={4}>Total vigente</td><td style={{ ...der, fontWeight: 600 }}>{$(I.contratado)}</td><td style={td} colSpan={2} /></tr></tbody></table>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: cEdit ? '#fff7ed' : undefined, padding: cEdit ? 8 : 0, borderRadius: 8 }}>
            <select value={fc.tipo} onChange={e => setFc({ ...fc, tipo: e.target.value })} style={inp}><option value="original">Contrato original</option><option value="adicional">Adicional</option></select>
            <input value={fc.descripcion} onChange={e => setFc({ ...fc, descripcion: e.target.value })} placeholder="Descripción" style={{ ...inp, width: 220 }} />
            <input value={fc.oc} onChange={e => setFc({ ...fc, oc: e.target.value })} placeholder="N° OC" style={{ ...inp, width: 130 }} />
            <input type="date" value={fc.fecha} onChange={e => setFc({ ...fc, fecha: e.target.value })} style={inp} />
            <MontoInput value={fc.monto} onChange={v => setFc({ ...fc, monto: v })} placeholder="Monto neto $" style={{ ...inp, width: 160, textAlign: 'right' }} />
            <button onClick={guardarContrato} style={btn()}>{cEdit ? 'Guardar cambios' : 'Agregar'}</button>
            {cEdit && <button onClick={() => { setCEdit(null); setFc(cVacio) }} style={btn(false)}>Cancelar</button>}
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>2. Estados de pago (EDP)</h2>
          <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Cada EDP se <b>presenta</b> al cliente, él lo <b>aprueba</b> y recién ahí se factura (ahora, o en otro mes). Cuando Kame trae una factura cuya glosa dice «EDP N°…», calza sola con el EDP del mismo número y descuenta lo «por facturar». Las que no calzan aparecen más abajo para asignarlas a mano.</p>
          {I.edps.length > 0 && <div style={{ overflowX: 'auto', marginBottom: 8 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>N°</th><th style={th}>Descripción</th><th style={th}>N° OC</th><th style={th}>Presentado</th><th style={{ ...th, textAlign: 'right' }}>Avance acum.</th><th style={{ ...th, textAlign: 'right' }}>Valor neto</th><th style={th}>Estado</th><th style={{ ...th, textAlign: 'right' }}>Facturado</th><th style={{ ...th, textAlign: 'right' }}>Por facturar</th><th style={th} /></tr></thead>
            <tbody>{I.edps.map(x => {
              const fac = I.facturadoDe(x.id); const dif = Number(x.monto) - fac; const e = ep(x); const docsX = I.docs.filter(d => d.edp_id === x.id)
              return [<tr key={x.id}><td style={td}>{docsX.length > 0 && <span onClick={() => setAbiertos(a => ({ ...a, [x.id]: !a[x.id] }))} style={{ cursor: 'pointer', color: '#98a2b3' }}>{abiertos[x.id] ? '▾' : '▸'} </span>}{x.numero}</td><td style={td}>{x.descripcion || '—'}</td><td style={td}>{x.orden_compra || '—'}</td><td style={td}>{fechaCL(x.fecha_presentacion)}</td><td style={der}>{x.avance_pct != null ? Number(x.avance_pct) + '%' : '—'}</td><td style={der}>{$(Number(x.monto))}</td>
                <td style={td}><select value={x.estado} onChange={ev => cambiarEstado(x, ev.target.value)} style={{ ...inp, padding: '3px 6px', fontSize: 12, background: e[2], color: e[1] }}><option value="presentado">Presentado</option><option value="aprobado">Aprobado</option></select>{x.fecha_aprobacion && <div style={{ fontSize: 11, color: '#667085' }}>aprob. {fechaCL(x.fecha_aprobacion)}</div>}</td>
                <td style={der}>{fac ? $(fac) : '—'}</td><td style={{ ...der, color: Math.abs(dif) < 1 ? '#067647' : undefined }}>{Math.abs(dif) < 1 ? 'Facturado' : $(dif)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><button onClick={() => { setEEdit(x.id); setFe({ numero: x.numero, descripcion: x.descripcion || '', oc: x.orden_compra || '', contrato_id: x.contrato_id || '', monto: String(Math.round(Number(x.monto))), avance: x.avance_pct != null ? String(x.avance_pct) : '', fecha: x.fecha_presentacion || '' }) }} style={{ ...btn(false), padding: '3px 8px', fontSize: 12 }}>Editar</button> <button onClick={() => borrarEdp(x)} style={{ ...btn(false), padding: '3px 8px', fontSize: 12 }}>Borrar</button></td></tr>,
                ...(abiertos[x.id] ? docsX.map(d => <tr key={x.id + d.key} style={{ background: '#fafafa' }}><td style={td} /><td style={{ ...td, fontSize: 12 }} colSpan={3}>{d.tipo ? `${d.tipo} ${d.folio || ''}` : 'Asiento sin documento'} · {d.nombre || ''} · {d.glosa.slice(0, 70)}</td><td style={{ ...td, fontSize: 12 }}>{fechaCL(d.fecha)}</td><td style={{ ...der, fontSize: 12 }} colSpan={3}>{$(d.monto)}</td><td style={td} colSpan={2}><button onClick={() => asignarDoc(d, null)} style={{ ...btn(false), padding: '2px 8px', fontSize: 12 }}>Desvincular</button></td></tr>) : [])]
            })}
              <tr><td style={{ ...td, fontWeight: 600 }} colSpan={5}>Total</td><td style={{ ...der, fontWeight: 600 }}>{$(I.edpTot)}</td><td style={td} /><td style={{ ...der, fontWeight: 600 }}>{$(I.docs.filter(d => d.edp_id).reduce((t, d) => t + d.monto, 0))}</td><td style={{ ...der, fontWeight: 600 }}>{$(I.porFacturar + I.porAprobar)}</td><td style={td} /></tr></tbody></table></div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: eEdit ? '#fff7ed' : undefined, padding: eEdit ? 8 : 0, borderRadius: 8 }}>
            <input value={fe.numero} onChange={e => setFe({ ...fe, numero: e.target.value })} placeholder="N° EDP" style={{ ...inp, width: 80 }} />
            <input value={fe.descripcion} onChange={e => setFe({ ...fe, descripcion: e.target.value })} placeholder="Descripción (ej. Anticipo)" style={{ ...inp, width: 220 }} />
            <input value={fe.oc} onChange={e => setFe({ ...fe, oc: e.target.value })} placeholder="N° OC" style={{ ...inp, width: 120 }} />
            {I.contratos.length > 0 && <select value={fe.contrato_id} onChange={e => setFe({ ...fe, contrato_id: e.target.value })} style={{ ...inp, maxWidth: 220 }}><option value="">Contrato / adicional…</option>{I.contratos.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}</select>}
            <input type="date" value={fe.fecha} onChange={e => setFe({ ...fe, fecha: e.target.value })} title="Fecha de presentación" style={inp} />
            <input type="number" value={fe.avance} onChange={e => setFe({ ...fe, avance: e.target.value })} placeholder="% avance acum." style={{ ...inp, width: 110 }} />
            <MontoInput value={fe.monto} onChange={v => setFe({ ...fe, monto: v })} placeholder="Valor neto $" style={{ ...inp, width: 150, textAlign: 'right' }} />
            <button onClick={guardarEdp} style={btn()}>{eEdit ? 'Guardar cambios' : 'Agregar EDP'}</button>
            {eEdit && <button onClick={() => { setEEdit(null); setFe(eVacio) }} style={btn(false)}>Cancelar</button>}
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>3. Facturas de venta de Kame sin EDP ({I.sinEdp.length})</h2>
          <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Ventas ya contabilizadas en Kame que no calzaron con ningún EDP (la glosa no trae su número, o el EDP aún no está creado). Asígnalas a mano.</p>
          {I.sinEdp.length === 0 ? <p style={{ fontSize: 13, color: '#067647', margin: 0 }}>Todas las ventas de Kame están asignadas a un EDP.</p> :
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Documento</th><th style={th}>Cliente / glosa</th><th style={{ ...th, textAlign: 'right' }}>Monto neto</th><th style={th}>Asignar a EDP</th></tr></thead>
              <tbody>{I.sinEdp.map(d => <tr key={d.key}><td style={td}>{fechaCL(d.fecha)}</td><td style={td}>{d.tipo ? `${d.tipo} ${d.folio || ''}` : 'Asiento sin documento'}</td><td style={{ ...td, fontSize: 12 }}>{d.nombre || ''}<div style={{ color: '#667085' }}>{d.glosa.slice(0, 80)}</div></td><td style={der}>{$(d.monto)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{I.edps.length === 0 ? <span style={{ fontSize: 12, color: '#667085' }}>Crea primero el EDP</span> : <><select value={sel[d.key] || ''} onChange={e => setSel(s => ({ ...s, [d.key]: e.target.value }))} style={{ ...inp, padding: '3px 6px', fontSize: 12 }}><option value="">EDP…</option>{I.edps.map(x => <option key={x.id} value={x.id}>N°{x.numero}{x.descripcion ? ' · ' + x.descripcion.slice(0, 25) : ''}</option>)}</select> <button disabled={!sel[d.key]} onClick={() => asignarDoc(d, sel[d.key])} style={{ ...btn(true, !sel[d.key]), padding: '3px 8px', fontSize: 12 }}>Asignar</button></>}</td></tr>)}</tbody></table>}
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>4. Órdenes de compra del cliente por facturar</h2>
          <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Compromisos del cliente que aún no se facturan. Márcalas como facturadas cuando corresponda.</p>
          {I.ordenes.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}><thead><tr><th style={th}>N° OC</th><th style={th}>Descripción</th><th style={th}>Fecha</th><th style={{ ...th, textAlign: 'right' }}>Monto neto</th><th style={th}>Estado</th><th style={th} /></tr></thead>
            <tbody>{I.ordenes.map(o => <tr key={o.id} style={{ opacity: o.estado === 'facturada' ? 0.55 : 1 }}><td style={td}>{o.numero || '—'}</td><td style={td}>{o.descripcion || '—'}</td><td style={td}>{fechaCL(o.fecha)}</td><td style={der}>{$(Number(o.monto))}</td>
              <td style={td}><select value={o.estado} onChange={async e => { await supabase.from('fin_ordenes_cliente').update({ estado: e.target.value }).eq('id', o.id); I.cargar() }} style={{ ...inp, padding: '3px 6px', fontSize: 12 }}><option value="pendiente">Por facturar</option><option value="facturada">Facturada</option></select></td>
              <td style={td}><button onClick={async () => { if (confirm('¿Borrar esta orden de compra?')) { await supabase.from('fin_ordenes_cliente').delete().eq('id', o.id); I.cargar() } }} style={{ ...btn(false), padding: '3px 8px', fontSize: 12 }}>Borrar</button></td></tr>)}</tbody></table>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={fo.numero} onChange={e => setFo({ ...fo, numero: e.target.value })} placeholder="N° OC" style={{ ...inp, width: 140 }} />
            <input value={fo.descripcion} onChange={e => setFo({ ...fo, descripcion: e.target.value })} placeholder="Descripción" style={{ ...inp, width: 260 }} />
            <input type="date" value={fo.fecha} onChange={e => setFo({ ...fo, fecha: e.target.value })} style={inp} />
            <MontoInput value={fo.monto} onChange={v => setFo({ ...fo, monto: v })} placeholder="Monto neto $" style={{ ...inp, width: 150, textAlign: 'right' }} />
            <button onClick={guardarOc} style={btn()}>Agregar</button>
          </div>
        </div>
      </>}
    </>
  )
}

// ───────────────────────── Resultado ─────────────────────────
const colorAvance = (real: number, ppto: number) => ppto > 0 ? (real / ppto > 1 ? '#d92d20' : real / ppto >= 0.85 ? '#f79009' : '#12b76a') : (real > 0 ? '#d92d20' : '#98a2b3')
function Barra({ real, ppto }: { real: number, ppto: number }) {
  const pct = ppto > 0 ? real / ppto * 100 : 0; const c = colorAvance(real, ppto)
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ flex: 1, height: 10, background: '#eaecf0', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: Math.min(100, Math.max(0, ppto > 0 ? pct : (real > 0 ? 100 : 0))) + '%', height: '100%', background: c }} /></div>
    <span style={{ fontSize: 12, width: 52, textAlign: 'right', color: c, fontVariantNumeric: 'tabular-nums' }}>{ppto > 0 ? Math.round(pct) + '%' : (real > 0 ? 's/ppto' : '—')}</span>
  </div>
}
const COLS = 'minmax(240px,1fr) 190px 105px 105px'

function Resultado({ unidades }: { unidades: Unidad[] }) {
  const [mes, setMes] = useState('')
  const [lineas, setLineas] = useState<any[]>([]); const [rem, setRem] = useState<any[]>([]); const [contr, setContr] = useState<any[]>([]); const [asi, setAsi] = useState<any[]>([])
  const [cargando, setCargando] = useState(true); const [tardias, setTardias] = useState<any[]>([]); const [proyecto, setProyecto] = useState('')
  useEffect(() => {
    (async () => {
      setCargando(true)
      const [l, r, v, a] = await Promise.all([
        traerTodo('fin_lineas', 'id,monto,unidad_id,documento:fin_documentos(sentido,fecha_doc,periodo_tributario,razon_social,folio,tipo_doc)'),
        traerTodo('fin_remuneraciones', 'id,periodo,unidad_id,rut,nombre,cargo,costo_empresa,abierta'),
        traerTodo('fin_contratos', 'id,unidad_id,monto'),
        traerTodo('fin_asientos', 'kame_id,fecha,cuenta,nombre_cuenta,debe,haber,unidad_id,doc_tipo,doc_folio,doc_rut,doc_nombre,comentario_det,comentario', 'kame_id'),
      ])
      setLineas(l); setRem(r); setContr(v); setAsi(a)
      setTardias(l.filter(x => x.documento?.periodo_tributario && x.documento?.fecha_doc && x.documento.fecha_doc.slice(0, 7) !== x.documento.periodo_tributario))
      setCargando(false)
    })()
  }, [])
  const hayKame = asi.length > 0
  const meses = useMemo(() => [...new Set([...(hayKame ? asi.map(a => String(a.fecha).slice(0, 7)) : lineas.map(l => l.documento?.fecha_doc?.slice(0, 7))), ...rem.map(r => r.periodo)].filter(Boolean))].sort().reverse() as string[], [lineas, rem, asi, hayKame])

  const mesesAbiertos = useMemo(() => new Set(rem.filter(r => r.abierta).map(r => r.periodo as string)), [rem])
  const hayProyeccion = mes ? mesesAbiertos.has(mes) : mesesAbiertos.size > 0
  const filas = unidades.map(u => {
    const ls = lineas.filter(l => l.unidad_id === u.id && (!mes || (l.documento?.periodo_tributario || l.documento?.fecha_doc?.slice(0, 7)) === mes))
    const as = asi.filter(a => a.unidad_id === u.id && (!mes || String(a.fecha).slice(0, 7) === mes))
    const ventas = hayKame ? as.filter(a => a.cuenta.startsWith('3.')).reduce((t, a) => t + Number(a.haber) - Number(a.debe), 0) : ls.filter(l => l.documento?.sentido === 'venta').reduce((a, l) => a + Number(l.monto), 0)
    const compras = hayKame ? as.filter(a => a.cuenta.startsWith('4.')).reduce((t, a) => t + Number(a.debe) - Number(a.haber), 0) : ls.filter(l => l.documento?.sentido === 'compra').reduce((a, l) => a + Number(l.monto), 0)
    const sueldos = rem.filter(r => r.unidad_id === u.id && (!mes || r.periodo === mes)).reduce((a, r) => a + Number(r.costo_empresa), 0)
    const contrato = contr.filter(v => v.unidad_id === u.id).reduce((a, v) => a + Number(v.monto), 0)
    const margen = ventas - compras - (hayKame ? 0 : sueldos)
    return { u, ventas, compras, sueldos, margen, pct: ventas ? (margen / ventas) * 100 : null, contrato }
  }).filter(f => f.ventas || f.compras || f.sueldos || f.contrato)
  const tot = filas.reduce((a, f) => ({ v: a.v + f.ventas, c: a.c + f.compras, s: a.s + f.sueldos }), { v: 0, c: 0, s: 0 })
  const uSel = unidades.find(u => u.id === proyecto)

  return (
    <>
      <div style={card}>
        <span style={{ fontSize: 13, marginRight: 8 }}>Período:</span>
        <select value={mes} onChange={e => setMes(e.target.value)} style={inp}><option value="">Acumulado</option>{meses.map(m => <option key={m} value={m}>{m}{mesesAbiertos.has(m) ? ' (proyectado)' : ''}</option>)}</select>
        <p style={{ fontSize: 12, color: '#667085', margin: '8px 0 0' }}>{hayKame ? 'Fuente: contabilidad de Kame (Libro Diario), por fecha del asiento. Ingresos = cuentas 3.x, costos = cuentas 4.x (esta tabla incluye los sueldos que Kame tenga contabilizados). Haz clic en un proyecto para ver su detalle.' : 'Fuente: archivos importados. Los documentos con libro del SII cargado se ubican en su período tributario; los demás, en el mes de su fecha. Montos netos.'}</p>
      </div>
      {hayProyeccion && <div style={{ ...card, background: '#fff7ed' }}><p style={{ fontSize: 13, margin: 0 }}>⚠ {mes ? `Las remuneraciones de ${mes}` : `Las remuneraciones de ${[...mesesAbiertos].sort().join(', ')}`} son una <b>proyección de BUK</b>: las liquidaciones aún no están cerradas y los montos pueden cambiar hasta el cierre.</p></div>}
      <div style={card}>
        {cargando ? <p style={{ fontSize: 13, color: '#999' }}>Cargando…</p> : filas.length === 0 ? <p style={{ fontSize: 13 }}>Aún no hay datos. Sincroniza con Kame en «Conexión Kame» y marca las unidades activas.</p> :
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Proyecto</th><th style={{ ...th, textAlign: 'right' }}>Contrato</th><th style={{ ...th, textAlign: 'right' }}>Ventas</th><th style={{ ...th, textAlign: 'right' }}>{hayKame ? 'Costos (contabilidad)' : 'Compras'}</th><th style={{ ...th, textAlign: 'right' }}>{hayKame ? 'Rem. planilla (ref.)' : 'Remuneraciones'}</th><th style={{ ...th, textAlign: 'right' }}>Margen</th><th style={{ ...th, textAlign: 'right' }}>%</th></tr></thead>
            <tbody>{filas.map(f => <tr key={f.u.id} onClick={() => setProyecto(f.u.id)} style={{ cursor: 'pointer', background: f.u.id === proyecto ? '#eef4ff' : undefined }}><td style={td}>{f.u.nombre}</td><td style={der}>{f.contrato ? $(f.contrato) : '—'}</td><td style={der}>{$(f.ventas)}</td><td style={der}>{$(f.compras)}</td><td style={der}>{$(f.sueldos)}</td>
              <td style={{ ...der, color: f.margen < 0 ? '#b42318' : '#067647', fontWeight: 600 }}>{$(f.margen)}</td><td style={der}>{f.pct == null ? '—' : f.pct.toFixed(1) + '%'}</td></tr>)}
              <tr><td style={{ ...td, fontWeight: 600 }}>Total</td><td style={der} /><td style={{ ...der, fontWeight: 600 }}>{$(tot.v)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.c)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.s)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.v - tot.c - (hayKame ? 0 : tot.s))}</td><td style={der} /></tr></tbody></table></div>}
      </div>
      {uSel && hayKame && <DetalleProyecto key={uSel.id} unidad={uSel} mes={mes} asiU={asi.filter(a => a.unidad_id === uSel.id)} remU={rem.filter(r => r.unidad_id === uSel.id)} />}
      {tardias.length > 0 && <div style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Documentos que caen en otro mes ({tardias.length} líneas)</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>La fecha del documento y el período en que se declaró al SII no coinciden.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Proveedor / cliente</th><th style={th}>Folio</th><th style={th}>Fecha doc.</th><th style={th}>Período SII</th></tr></thead>
          <tbody>{tardias.slice(0, 30).map(t => <tr key={t.id}><td style={td}>{t.documento.razon_social}</td><td style={td}>{t.documento.folio}</td><td style={td}>{t.documento.fecha_doc}</td><td style={td}>{t.documento.periodo_tributario}</td></tr>)}</tbody></table>
      </div>}
    </>
  )
}

// Dashboard de un proyecto: cuenta contable → subpartidas → proveedores → documentos, con asignación y reasignación de costos
function DetalleProyecto({ unidad, mes, asiU, remU }: { unidad: Unidad, mes: string, asiU: any[], remU: any[] }) {
  const I = useIngresos(unidad.id)
  const [partidas, setPartidas] = useState<any[]>([]); const [items, setItems] = useState<any[]>([]); const [asigs, setAsigs] = useState<any[]>([]); const [cuentas, setCuentas] = useState<Record<string, string>>({})
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({}); const [sel, setSel] = useState<Record<string, string>>({}); const [monto, setMonto] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState(''); const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const [p, v, k] = await Promise.all([
      supabase.from('fin_partidas').select('*, catalogo:fin_catalogo_partidas(nombre,cuenta,fuente)').eq('unidad_id', unidad.id).order('orden'),
      supabase.from('fin_versiones').select('id').eq('unidad_id', unidad.id),
      supabase.from('fin_cuentas').select('*'),
    ])
    const ps = p.data || []; setPartidas(ps); setCuentas(Object.fromEntries((k.data || []).map((x: any) => [x.cuenta, x.nombre_cuenta])))
    const vids = (v.data || []).map(x => x.id)
    if (vids.length) { const { data } = await supabase.from('fin_version_items').select('partida_id,mes,delta').in('version_id', vids).limit(20000); setItems(data || []) } else setItems([])
    const pids = ps.map(x => x.id)
    if (pids.length) { const { data } = await supabase.from('fin_asignaciones').select('*').in('partida_id', pids).limit(20000); setAsigs(data || []) } else setAsigs([])
  }, [unidad.id])
  useEffect(() => { cargar() }, [cargar])

  const inMes = (f: string) => !mes || String(f).slice(0, 7) === mes
  const monto$ = (a: any) => Number(a.debe) - Number(a.haber)
  const costos = useMemo(() => asiU.filter(a => a.cuenta.startsWith('4.') && !a.cuenta.startsWith(CUENTA_REM)), [asiU])
  const asiMap = useMemo(() => new Map(asiU.map(a => [Number(a.kame_id), a])), [asiU])
  const porKame = useMemo(() => { const m = new Map<number, any[]>(); asigs.forEach(x => { const k = Number(x.kame_id); m.set(k, [...(m.get(k) || []), x]) }); return m }, [asigs])
  const pendiente = (a: any) => monto$(a) - (porKame.get(Number(a.kame_id)) || []).reduce((t, x) => t + Number(x.monto), 0)

  const pptoDe = (p: any) => items.filter(i => i.partida_id === p.id && (!mes || i.mes === mes)).reduce((t, i) => t + Number(i.delta), 0)
  const asigDe = (p: any) => asigs.filter(x => x.partida_id === p.id && asiMap.has(Number(x.kame_id)) && inMes(asiMap.get(Number(x.kame_id)).fecha))
  const realDe = (p: any) => p.catalogo?.fuente === 'remuneraciones' ? remU.filter(r => !mes || r.periodo === mes).reduce((t, r) => t + Number(r.costo_empresa), 0) : asigDe(p).reduce((t, x) => t + Number(x.monto), 0)

  // Cuentas del proyecto: las de sus subpartidas + todas las que tengan costo en Kame
  const codigos = useMemo(() => { const s = new Set<string>(); partidas.forEach(p => { if (p.catalogo?.fuente !== 'remuneraciones' && p.catalogo?.cuenta) s.add(p.catalogo.cuenta) }); costos.forEach(a => s.add(a.cuenta)); return [...s].sort() }, [partidas, costos])
  const partRem = partidas.find(p => p.catalogo?.fuente === 'remuneraciones')
  const hayRem = !!partRem || remU.length > 0

  const grupos = codigos.map(c => {
    const ps = partidas.filter(p => p.catalogo?.cuenta === c && p.catalogo?.fuente !== 'remuneraciones')
    const lineas = costos.filter(a => a.cuenta === c && inMes(a.fecha))
    const real = lineas.reduce((t, a) => t + monto$(a), 0)
    const ppto = ps.reduce((t, p) => t + pptoDe(p), 0)
    const pend = lineas.filter(a => Math.abs(pendiente(a)) > 0.5)
    return { c, ps, lineas, real, ppto, pend, pendTotal: pend.reduce((t, a) => t + pendiente(a), 0) }
  }).filter(g => g.real || g.ppto || g.ps.length)
  const remReal = hayRem ? remU.filter(r => !mes || r.periodo === mes).reduce((t, r) => t + Number(r.costo_empresa), 0) : 0
  const remPpto = partRem ? pptoDe(partRem) : 0
  const pptoTot = grupos.reduce((t, g) => t + g.ppto, 0) + remPpto
  const realTot = grupos.reduce((t, g) => t + g.real, 0) + remReal
  const pendTot = grupos.reduce((t, g) => t + g.pendTotal, 0)
  const ventas = asiU.filter(a => a.cuenta.startsWith('3.') && inMes(a.fecha)).reduce((t, a) => t + Number(a.haber) - Number(a.debe), 0)
  const contrato = I.contratado

  const toggle = (k: string) => setAbiertos(a => ({ ...a, [k]: !a[k] }))
  const nombreDoc = (a: any) => a.doc_tipo ? `${a.doc_tipo} ${a.doc_folio || ''}` : (a.comentario_det || a.comentario || 'Asiento manual')
  const claveProv = (a: any) => a.doc_rut || a.doc_nombre || '(sin proveedor)'
  const nombreProv = (a: any) => a.doc_nombre || a.doc_rut || 'Sin proveedor (asiento manual)'

  // ---- operaciones (todas pasan por fin_asignaciones, única por línea y subpartida: no se duplica) ----
  const guardar = async (rows: { kame_id: number, partida_id: string, monto: number }[]) => {
    const { error } = await supabase.from('fin_asignaciones').upsert(rows, { onConflict: 'kame_id,partida_id' })
    if (error) setMsg('No se pudo guardar: ' + error.message)
  }
  const asignar = async (a: any, partidaId: string, montoTxt: string) => {
    if (!partidaId) { setMsg('Elige la subpartida.'); return }
    const pend = pendiente(a); const m = montoTxt === '' ? pend : Number(montoTxt)
    if (!m || isNaN(m) || Math.sign(m) !== Math.sign(pend) || Math.abs(m) > Math.abs(pend) + 0.5) { setMsg(`El monto debe ser del mismo signo y no superar lo pendiente (${$(pend)}).`); return }
    setOcupado(true); const ex = (porKame.get(Number(a.kame_id)) || []).find(x => x.partida_id === partidaId)
    await guardar([{ kame_id: Number(a.kame_id), partida_id: partidaId, monto: (ex ? Number(ex.monto) : 0) + m }]); setMsg(''); await cargar(); setOcupado(false)
  }
  const asignarTodos = async (lineas: any[], partidaId: string) => {
    if (!partidaId) { setMsg('Elige la subpartida.'); return }
    setOcupado(true)
    const rows = lineas.map(a => { const ex = (porKame.get(Number(a.kame_id)) || []).find(x => x.partida_id === partidaId); return { kame_id: Number(a.kame_id), partida_id: partidaId, monto: (ex ? Number(ex.monto) : 0) + pendiente(a) } })
    await guardar(rows); setMsg(`${rows.length} movimiento(s) asignados.`); await cargar(); setOcupado(false)
  }
  const reasignar = async (x: any, nuevo: string) => {
    if (!nuevo || nuevo === x.partida_id) return
    setOcupado(true)
    const destino = (porKame.get(Number(x.kame_id)) || []).find(y => y.partida_id === nuevo)
    if (destino) { await supabase.from('fin_asignaciones').update({ monto: Number(destino.monto) + Number(x.monto) }).eq('id', destino.id); await supabase.from('fin_asignaciones').delete().eq('id', x.id) }
    else await supabase.from('fin_asignaciones').update({ partida_id: nuevo }).eq('id', x.id)
    setMsg('Asignación cambiada.'); await cargar(); setOcupado(false)
  }
  const quitar = async (x: any) => { setOcupado(true); await supabase.from('fin_asignaciones').delete().eq('id', x.id); setMsg('Asignación quitada: el costo vuelve a «por asignar».'); await cargar(); setOcupado(false) }

  // ---- piezas de dibujo ----
  const Fila = ({ nivel, k, nombre, real, ppto, extra, fuerte }: { nivel: number, k?: string, nombre: React.ReactNode, real: number, ppto: number | null, extra?: React.ReactNode, fuerte?: boolean }) => (
    <div onClick={k ? () => toggle(k) : undefined} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', padding: '6px 8px', paddingLeft: 8 + nivel * 22, borderBottom: '1px solid #f2f4f7', cursor: k ? 'pointer' : 'default', background: fuerte ? '#f2f4f7' : undefined, fontWeight: fuerte ? 600 : 400, fontSize: 13 }}>
      <div>{k && <span style={{ color: '#98a2b3' }}>{abiertos[k] ? '▾' : '▸'} </span>}{nombre}{extra}</div>
      {ppto == null ? <div /> : <Barra real={real} ppto={ppto} />}
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{$(real)}</div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#667085' }}>{ppto == null ? '' : $(ppto)}</div>
    </div>
  )
  const grupoProv = (rows: any[]) => { const m: Record<string, { n: string, rows: any[] }> = {}; rows.forEach(a => { const k = claveProv(a.a || a); m[k] = m[k] || { n: nombreProv(a.a || a), rows: [] }; m[k].rows.push(a) }); return Object.entries(m) }

  return (
    <div style={card}>
      <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>{unidad.nombre}</h2>
      <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>{mes ? `Mes ${mes}: presupuesto del mes vs costo del mes.` : 'Acumulado: presupuesto total vs costo a la fecha.'} Montos netos.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
        <Tarjeta t="Contrato vigente" v={'$' + $(contrato)} s={contrato > 0 ? `${I.contratos.length} contrato(s) y adicionales` : 'Regístralo en Ingresos'} />
        <Tarjeta t="Facturado (Kame)" v={'$' + $(ventas)} s={contrato > 0 ? Math.round(ventas / contrato * 100) + '% del contrato' : ''} />
        <Tarjeta t="EDP por cobrar" v={'$' + $(I.porFacturar + I.porAprobar)} s={`${'$' + $(I.porFacturar)} aprobados · ${'$' + $(I.porAprobar)} por aprobar`} />
        <Tarjeta t="Presupuesto de costos" v={'$' + $(pptoTot)} s={contrato > 0 && pptoTot > 0 ? 'Margen presup. ' + ((contrato - pptoTot) / contrato * 100).toFixed(1) + '%' : ''} />
        <Tarjeta t="Costo real" v={'$' + $(realTot)} s={pptoTot > 0 ? Math.round(realTot / pptoTot * 100) + '% del presupuesto' : ''} />
        <Tarjeta t="Margen a la fecha" v={'$' + $(ventas - realTot)} s={ventas > 0 ? ((ventas - realTot) / ventas * 100).toFixed(1) + '% de lo facturado' : ''} color={ventas - realTot < 0 ? '#b42318' : undefined} />
      </div>

      <h3 style={{ fontSize: 14, margin: '4px 0 6px' }}>Contratos</h3>
      {I.contratos.length === 0 ? <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Aún no hay contrato registrado: ingrésalo en la pestaña Ingresos.</p> :
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}><tbody>
          {I.contratos.map(c => <tr key={c.id}><td style={td}>{c.tipo === 'original' ? 'Contrato original' : 'Adicional'}{c.descripcion && c.tipo === 'adicional' ? ` · ${c.descripcion}` : ''}{c.orden_compra ? ` · OC ${c.orden_compra}` : ''}</td><td style={der}>{$(Number(c.monto))}</td></tr>)}
          <tr><td style={{ ...td, fontWeight: 600 }}>Total contrato vigente</td><td style={{ ...der, fontWeight: 600 }}>{$(contrato)}</td></tr></tbody></table>}

      <h3 style={{ fontSize: 14, margin: '4px 0 6px' }}>Ingresos <span style={{ fontWeight: 400, fontSize: 12, color: '#667085' }}>(acumulado, desde los EDP y las ventas reales de Kame)</span></h3>
      {I.edps.length === 0 && I.docs.length === 0 ? <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Aún no hay EDP ni ventas en Kame para este proyecto.</p> :
        <div style={{ overflowX: 'auto', marginBottom: 14 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>EDP</th><th style={th}>Estado</th><th style={{ ...th, textAlign: 'right' }}>Valor neto</th><th style={{ ...th, textAlign: 'right' }}>Facturado (Kame)</th><th style={{ ...th, textAlign: 'right' }}>Por facturar</th></tr></thead>
          <tbody>{I.edps.map(x => { const fac = I.facturadoDe(x.id); const dif = Number(x.monto) - fac; const docsX = I.docs.filter(d => d.edp_id === x.id); const k = 'edp:' + x.id
            return [<tr key={x.id} onClick={() => docsX.length && toggle(k)} style={{ cursor: docsX.length ? 'pointer' : 'default' }}><td style={td}>{docsX.length > 0 && <span style={{ color: '#98a2b3' }}>{abiertos[k] ? '▾' : '▸'} </span>}N°{x.numero}{x.descripcion ? ` · ${x.descripcion}` : ''}{x.avance_pct != null ? <span style={{ color: '#98a2b3' }}> · {Number(x.avance_pct)}% avance</span> : null}</td>
              <td style={td}><span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99, background: x.estado === 'aprobado' ? '#d1fae5' : '#fef3c7', color: x.estado === 'aprobado' ? '#065f46' : '#92400e' }}>{x.estado === 'aprobado' ? 'Aprobado' : 'Presentado'}</span></td><td style={der}>{$(Number(x.monto))}</td><td style={der}>{fac ? $(fac) : '—'}</td><td style={der}>{Math.abs(dif) < 1 ? <span style={{ color: '#067647' }}>Facturado</span> : $(dif)}</td></tr>,
              ...(abiertos[k] ? docsX.map(d => <tr key={x.id + d.key} style={{ background: '#fafafa' }}><td style={{ ...td, fontSize: 12, paddingLeft: 24 }} colSpan={3}>{d.tipo ? `${d.tipo} ${d.folio || ''}` : 'Asiento sin documento'} · {fechaCL(d.fecha)} · {d.nombre || ''}</td><td style={{ ...der, fontSize: 12 }}>{$(d.monto)}</td><td style={td} /></tr>) : [])] })}
            {I.sinEdp.length > 0 && <tr><td style={{ ...td, color: '#92400e' }}>Ventas de Kame sin EDP ({I.sinEdp.length} doc.)</td><td style={td} /><td style={der} /><td style={{ ...der, color: '#92400e' }}>{$(I.sinEdp.reduce((t, d) => t + d.monto, 0))}</td><td style={td} /></tr>}
            <tr><td style={{ ...td, fontWeight: 600 }}>Total</td><td style={td} /><td style={{ ...der, fontWeight: 600 }}>{$(I.edpTot)}</td><td style={{ ...der, fontWeight: 600 }}>{$(I.facturadoTot)}</td><td style={{ ...der, fontWeight: 600 }}>{$(I.porFacturar + I.porAprobar)}</td></tr></tbody></table>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#475467', marginTop: 6 }}>
            <span>EDP aprobados por facturar: <b>${$(I.porFacturar)}</b></span><span>EDP por aprobar: <b>${$(I.porAprobar)}</b></span>
            <span>Contrato aún sin EDP: <b style={{ color: I.sinPresentar < 0 ? '#b42318' : undefined }}>${$(I.sinPresentar)}</b></span>
            <span>Órdenes de compra del cliente por facturar: <b>${$(I.ocPend)}</b>{I.ordenes.filter(o => o.estado === 'pendiente').length ? ` (${I.ordenes.filter(o => o.estado === 'pendiente').map(o => o.numero || 's/n').join(', ')})` : ''}</span>
          </div></div>}

      <h3 style={{ fontSize: 14, margin: '4px 0 6px' }}>Costos: presupuesto vs real</h3>
      {pendTot !== 0 && <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 8px' }}>Hay ${$(pendTot)} de costos por asignar a una subpartida (se ven en cada cuenta, fila «Por asignar»).</p>}
      {msg && <p style={{ fontSize: 12, margin: '0 0 8px', color: /^(No|El|Elige)/.test(msg) ? '#b42318' : '#067647' }}>{msg}</p>}
      {partidas.length === 0 && <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Este proyecto aún no tiene subpartidas ni presupuesto: defínelos en la pestaña Presupuesto. Mientras tanto ves el costo por cuenta contable.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '4px 8px', fontSize: 11, color: '#667085', fontWeight: 600, borderBottom: '1px solid #eaecf0' }}><div>Cuenta / subpartida</div><div>Avance</div><div style={{ textAlign: 'right' }}>Real</div><div style={{ textAlign: 'right' }}>Presupuesto</div></div>
      <div style={{ opacity: ocupado ? 0.6 : 1 }}>
        {grupos.map(g => <div key={g.c}>
          <Fila nivel={0} k={'c:' + g.c} fuerte nombre={<>{g.c} · {nomCuenta(cuentas, g.c)}</>} real={g.real} ppto={g.ppto} />
          {abiertos['c:' + g.c] && <>
            {g.ps.map(p => {
              const dp = asigDe(p); const pk = 'p:' + p.id
              return <div key={p.id}>
                <Fila nivel={1} k={pk} nombre={p.nombre} real={realDe(p)} ppto={pptoDe(p)} extra={<span style={{ color: '#98a2b3' }}> · {dp.length} mov.</span>} />
                {abiertos[pk] && grupoProv(dp.map(x => ({ x, a: asiMap.get(Number(x.kame_id)) }))).map(([k, pv]) => {
                  const vk = pk + '|' + k
                  return <div key={vk}>
                    <Fila nivel={2} k={vk} nombre={pv.n} real={pv.rows.reduce((t: number, r: any) => t + Number(r.x.monto), 0)} ppto={null} extra={<span style={{ color: '#98a2b3' }}> · {pv.rows.length} doc.</span>} />
                    {abiertos[vk] && pv.rows.sort((r: any, s: any) => String(r.a.fecha).localeCompare(String(s.a.fecha))).map((r: any) => <div key={r.x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', paddingLeft: 8 + 3 * 22, fontSize: 12, color: '#475467', borderBottom: '1px solid #f9fafb' }}>
                      <span style={{ width: 80 }}>{String(r.a.fecha).slice(0, 10)}</span><span style={{ flex: 1 }}>{nombreDoc(r.a)}</span><span style={{ width: 100, textAlign: 'right' }}>{$(Number(r.x.monto))}</span>
                      <select value="" onChange={e => reasignar(r.x, e.target.value)} style={{ ...inp, padding: '3px 6px', fontSize: 12 }}><option value="">Cambiar a…</option>{g.ps.filter(q => q.id !== p.id).map(q => <option key={q.id} value={q.id}>{q.nombre}</option>)}</select>
                      <button onClick={() => quitar(r.x)} style={{ ...btn(false), padding: '3px 8px', fontSize: 12 }}>Quitar</button></div>)}
                  </div>
                })}
              </div>
            })}
            {Math.abs(g.pendTotal) > 0.5 && (() => {
              const pk = 'pen:' + g.c
              return <div>
                <Fila nivel={1} k={pk} nombre={<span style={{ color: '#92400e' }}>Por asignar</span>} real={g.pendTotal} ppto={null} extra={<span style={{ color: '#98a2b3' }}> · {g.pend.length} mov.</span>} />
                {abiertos[pk] && (g.ps.length === 0 ? <p style={{ fontSize: 12, color: '#667085', padding: '6px 8px', paddingLeft: 8 + 2 * 22 }}>Para asignar estos costos, agrega primero subpartidas de esta cuenta al proyecto (pestaña Presupuesto).</p> :
                  grupoProv(g.pend).map(([k, pv]) => {
                    const vk = pk + '|' + k; const sk = 'sel|' + vk
                    return <div key={vk}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', paddingLeft: 8 + 2 * 22, fontSize: 13, borderBottom: '1px solid #f2f4f7' }}>
                        <span onClick={() => toggle(vk)} style={{ cursor: 'pointer', flex: 1 }}><span style={{ color: '#98a2b3' }}>{abiertos[vk] ? '▾' : '▸'} </span>{pv.n} <span style={{ color: '#98a2b3' }}>· {pv.rows.length} mov.</span></span>
                        <span style={{ width: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{$(pv.rows.reduce((t: number, a: any) => t + pendiente(a), 0))}</span>
                        <select value={sel[sk] || ''} onChange={e => setSel(s => ({ ...s, [sk]: e.target.value }))} style={{ ...inp, padding: '3px 6px', fontSize: 12 }}><option value="">Subpartida…</option>{g.ps.map(q => <option key={q.id} value={q.id}>{q.nombre}</option>)}</select>
                        <button disabled={ocupado} onClick={() => asignarTodos(pv.rows, sel[sk] || '')} style={{ ...btn(true, ocupado), padding: '3px 8px', fontSize: 12 }}>Asignar todos</button>
                      </div>
                      {abiertos[vk] && pv.rows.sort((r: any, s: any) => String(r.fecha).localeCompare(String(s.fecha))).map((a: any) => {
                        const dk = 'sel|d|' + a.kame_id
                        return <div key={a.kame_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', paddingLeft: 8 + 3 * 22, fontSize: 12, color: '#475467', borderBottom: '1px solid #f9fafb' }}>
                          <span style={{ width: 80 }}>{String(a.fecha).slice(0, 10)}</span><span style={{ flex: 1 }}>{nombreDoc(a)}</span>
                          <input type="number" value={monto[dk] ?? ''} placeholder={String(Math.round(pendiente(a)))} onChange={e => setMonto(m => ({ ...m, [dk]: e.target.value }))} style={{ ...inp, width: 100, padding: '3px 6px', fontSize: 12, textAlign: 'right' }} />
                          <select value={sel[dk] || sel[sk] || ''} onChange={e => setSel(s => ({ ...s, [dk]: e.target.value }))} style={{ ...inp, padding: '3px 6px', fontSize: 12 }}><option value="">Subpartida…</option>{g.ps.map(q => <option key={q.id} value={q.id}>{q.nombre}</option>)}</select>
                          <button disabled={ocupado} onClick={() => asignar(a, sel[dk] || sel[sk] || '', monto[dk] ?? '')} style={{ ...btn(true, ocupado), padding: '3px 8px', fontSize: 12 }}>Asignar</button></div>
                      })}
                    </div>
                  }))}
              </div>
            })()}
          </>}
        </div>)}
        {hayRem && <div>
          <Fila nivel={0} k="c:rem" fuerte nombre={<>{CUENTA_REM} · {nomCuenta(cuentas, CUENTA_REM)}</>} real={remReal} ppto={remPpto} />
          {abiertos['c:rem'] && (() => {
            const m: Record<string, { n: string, cargo: string, v: number }> = {}
            remU.filter(r => !mes || r.periodo === mes).forEach(r => { m[r.rut] = m[r.rut] || { n: r.nombre, cargo: r.cargo, v: 0 }; m[r.rut].v += Number(r.costo_empresa) })
            return Object.values(m).sort((a, b) => b.v - a.v).map((x, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 8px', paddingLeft: 8 + 2 * 22, fontSize: 12, color: '#475467', borderBottom: '1px solid #f9fafb' }}><span style={{ flex: 1 }}>{x.n} · {x.cargo}</span><span>{$(x.v)}</span></div>)
          })()}
        </div>}
        <Fila nivel={0} fuerte nombre="TOTAL COSTOS: real vs proyectado" real={realTot} ppto={pptoTot} />
      </div>

      {(() => {
        const costoFinal = realTot + Math.max(0, pptoTot - realTot)   // lo ya gastado + lo que falta del presupuesto (si hay sobregasto, es lo gastado)
        const fila = (n: string, a: number | null, b: number, pct: boolean) => {
          const dif = a == null ? null : b - a
          return <tr key={n}><td style={td}>{n}</td><td style={der}>{a == null ? '—' : pct ? a.toFixed(1) + '%' : $(a)}</td><td style={der}>{pct ? b.toFixed(1) + '%' : $(b)}</td><td style={{ ...der, color: dif == null ? undefined : dif < 0 ? '#b42318' : '#067647' }}>{dif == null ? '' : pct ? (dif >= 0 ? '+' : '') + dif.toFixed(1) + ' pts' : (dif >= 0 ? '+' : '') + $(dif)}</td></tr>
        }
        const mp = contrato - pptoTot, mr = ventas - realTot
        return <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>Márgenes: presupuestado vs real{mes ? ` (${mes})` : ''}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th} /><th style={{ ...th, textAlign: 'right' }}>Presupuestado</th><th style={{ ...th, textAlign: 'right' }}>Real a la fecha</th><th style={{ ...th, textAlign: 'right' }}>Diferencia</th></tr></thead>
            <tbody>
              {fila('Ingresos (contrato vs facturado)', mes ? null : contrato, ventas, false)}
              {fila('Costos', pptoTot, realTot, false)}
              {fila('Margen $', mes ? null : mp, mr, false)}
              {fila('Margen %', mes || contrato <= 0 ? null : mp / contrato * 100, ventas > 0 ? mr / ventas * 100 : 0, true)}
            </tbody></table>
          {!mes && contrato > 0 && <p style={{ fontSize: 12, color: '#475467', margin: '8px 0 0' }}>Proyección al término del proyecto: costo final estimado <b>${$(costoFinal)}</b> (lo gastado más lo que falta del presupuesto) · margen proyectado <b style={{ color: contrato - costoFinal < 0 ? '#b42318' : undefined }}>${$(contrato - costoFinal)} ({((contrato - costoFinal) / contrato * 100).toFixed(1)}%)</b>.</p>}
        </div>
      })()}
    </div>
  )
}

// ───────────────────────── Conexión Kame ─────────────────────────
const SUGERIDOS = ['/api/getInformeVentas', '/api/getInformeCompras', '/api/getCuentaxCobrar', '/api/getCuentaxPagar', '/api/getInformeCobros', '/api/getInformePagos', '/api/getListFicha']
function ConexionKame() {
  const [ruta, setRuta] = useState('/api/getInformeVentas'); const [metodo, setMetodo] = useState<'GET' | 'POST'>('GET')
  const [query, setQuery] = useState('{}'); const [cuerpo, setCuerpo] = useState('{}')
  const [pref, setPref] = useState('/api/Contabilidad,/api/Compras,/api/Ventas,/api/Tesoreria,/api/Informes,/api/Maestros')
  const [nom, setNom] = useState('getInformeCompras,getInformeVentas,getLibroCompras,getLibroVentas,getLibroMayor,getLibroDiario,getBalance,getComprobantes,getAsientos,getCentrosCosto,getUnidadesNegocio,getListUnidadNegocio,getListCentroCosto,getListFicha,getListCuentas,getPlanCuentas,getDocumentosCompra,getDocumentosVenta,getCompras,getVentas')
  const [rutaBuk, setRutaBuk] = useState('/api/v1/chile/employees')
  const [mesBuk, setMesBuk] = useState('2026-10')
  const [salida, setSalida] = useState(''); const [ocupado, setOcupado] = useState(false)
  const llamar = async (payload: any) => {
    setOcupado(true); setSalida('Consultando…')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/finanzas/kame', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (j.estructura !== undefined) setSalida(`HTTP ${j.status} · ${j.largo} caracteres\n\n${j.estructura}`)
      else if (j.resumen) setSalida(j.resumen)
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
      const meses: string[] = []
      for (let [y, m] = mDesde.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= mHasta; m++) { if (m > 12) { m = 1; y++ } meses.push(`${y}-${String(m).padStart(2, '0')}`); if (meses.length > 36) break }
      for (const mes of meses) {
        const [y, m] = mes.split('-').map(Number); const fin = new Date(y, m, 0).getDate()
        let total = 0, guardadas = 0
        for (let page = 1; page <= 40; page++) {
          setLog(l => [...l.filter(x => !x.startsWith(mes + ':')), `${mes}: página ${page}…`])
          const { data: { session } } = await supabase.auth.getSession()
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
  const [bDesde, setBDesde] = useState('2026-01'); const [bHasta, setBHasta] = useState(mesActual); const [logB, setLogB] = useState<string[]>([])
  const sincronizarBuk = async () => {
    setOcupado(true); setLogB([])
    try {
      const meses: string[] = []
      for (let [y, m] = bDesde.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= bHasta; m++) { if (m > 12) { m = 1; y++ } meses.push(`${y}-${String(m).padStart(2, '0')}`); if (meses.length > 24) break }
      for (const mes of meses) {
        setLogB(l => [...l, `${mes}: leyendo BUK…`])
        const pedir = async (forzar: boolean) => {
          const { data: { session } } = forzar ? await supabase.auth.refreshSession() : await supabase.auth.getSession()
          return fetch('/api/finanzas/kame', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ accion: 'buk_sync_mes', mes }) })
        }
        let r = await pedir(false)
        if (r.status === 401) r = await pedir(true)
        const j = await r.json().catch(() => ({ error: 'respuesta inválida (¿tiempo agotado?)' }))
        const fmt = (n: number) => miles(String(Math.round(n)))
        setLogB(l => [...l.filter(x => !x.startsWith(mes + ':')), r.ok
          ? `${mes}: listo · ${j.personas} personas · haberes $${fmt(j.haberes)} · aportes $${fmt(j.aporte_patronal)} · costo empresa $${fmt(j.costo_empresa)}${j.abiertas ? ` · ⚠ ${j.abiertas} liquidaciones aún abiertas` : ''}${j.omitidas ? ` · ${j.omitidas} personas de otros centros omitidas (${(j.centrosSinUnidad || []).join(', ')})` : ''}`
          : `${mes}: ${r.status === 404 ? 'BUK no tiene liquidaciones (se omite)' : 'error: ' + (j.error || r.status)}`])
      }
    } catch (e: any) { setLogB(l => [...l, 'Error: ' + e.message]) }
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
      <div style={{ background: '#fff7ed', borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <b style={{ fontSize: 14 }}>Sincronizar remuneraciones desde BUK</b>
        <p style={{ fontSize: 12, color: '#667085', margin: '4px 0 8px' }}>Reemplaza las remuneraciones de cada mes elegido con lo que hay en BUK (haberes + aportes patronales, centro de costo vigente en el mes). Volver a sincronizar no duplica.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          Desde <input type="month" value={bDesde} onChange={e => setBDesde(e.target.value)} style={inp} /> hasta <input type="month" value={bHasta} onChange={e => setBHasta(e.target.value)} style={inp} />
          <button disabled={ocupado} onClick={sincronizarBuk} style={btn(true, ocupado)}>Sincronizar desde BUK</button>
        </div>
        {logB.length > 0 && <pre style={{ fontSize: 12, margin: '8px 0 12px', whiteSpace: 'pre-wrap' }}>{logB.join('\n')}</pre>}
        <hr style={{ border: 0, borderTop: '1px solid #fed7aa', margin: '12px 0' }} />
        <b style={{ fontSize: 14 }}>BUK (herramientas de diagnóstico)</b>
        <p style={{ fontSize: 12, color: '#667085', margin: '4px 0 8px' }}>Usa la variable BUK_API_TOKEN del servidor. Solo muestra la estructura de los datos (nombres de campos), nunca sueldos ni datos personales.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button disabled={ocupado} onClick={() => llamar({ accion: 'buk_descubrir' })} style={btn(true, ocupado)}>Descubrir endpoints BUK</button>
          <input value={rutaBuk} onChange={e => setRutaBuk(e.target.value)} style={{ ...inp, width: 380 }} />
          <button disabled={ocupado} onClick={() => llamar({ accion: 'buk_llamar', ruta: rutaBuk })} style={btn(false, ocupado)}>Ver estructura</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <input value={mesBuk} onChange={e => setMesBuk(e.target.value)} placeholder="AAAA-MM" style={{ ...inp, width: 110 }} />
          <button disabled={ocupado} onClick={() => llamar({ accion: 'buk_conciliar', mes: mesBuk })} style={btn(true, ocupado)}>Conciliar mes con la planilla</button>
          <span style={{ fontSize: 12, color: '#667085' }}>Suma todo el mes en BUK y lo compara con la planilla (solo totales).</span>
        </div>
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

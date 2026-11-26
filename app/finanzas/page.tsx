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
  const cambiar = async (id: string, campos: Partial<Unidad>) => { await supabase.from('fin_unidades').update(campos).eq('id', id); recargar() }
  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Unidades de negocio (centros de costo)</h2>
      <p style={{ fontSize: 12, color: '#667085', margin: '0 0 12px' }}>Se crean solas al sincronizar con Kame. Deja activas solo las que quieres controlar; las demás no aparecen en Presupuesto ni en Resultado.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Activa</th><th style={th}>Nombre en Kame</th><th style={th}>Contrato base ($ neto)</th></tr></thead>
        <tbody>{unidades.map(u => <tr key={u.id} style={{ opacity: u.activa ? 1 : 0.5 }}>
          <td style={td}><input type="checkbox" checked={u.activa} onChange={e => cambiar(u.id, { activa: e.target.checked })} /></td>
          <td style={td}>{u.nombre}</td>
          <td style={td}><input type="number" defaultValue={u.monto_contrato_base} onBlur={e => Number(e.target.value) !== u.monto_contrato_base && cambiar(u.id, { monto_contrato_base: Number(e.target.value) })} style={{ ...inp, width: 150 }} /></td>
        </tr>)}</tbody></table>
    </div>
  )
}

// ───────────────────────── Presupuesto ─────────────────────────
// Nombre normalizado para impedir duplicados tipo "Cubierta" / "cubiertas" / "CUBIERTAS "
const normNombre = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ').split(' ').map(w => w.length > 4 ? w.replace(/(es|s)$/, '') : w).join(' ')
const nombreMes = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }).replace('.', '') }
const rangoMeses = (d?: string | null, h?: string | null) => { const out: string[] = []; if (!d || !h) return out; let [y, m] = d.slice(0, 7).split('-').map(Number); const [yh, mh] = h.slice(0, 7).split('-').map(Number); while ((y < yh || (y === yh && m <= mh)) && out.length < 60) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } } return out }
const CUENTA_REM = '4.02.04'
const nomCuenta = (mapa: Record<string, string>, c: string) => c === CUENTA_REM ? 'Remuneraciones (planilla BUK)' : (mapa[c] || 'Cuenta sin nombre')
const agruparPorCuenta = (partidas: any[]) => { const g: Record<string, any[]> = {}; partidas.forEach(p => { const c = p.catalogo?.cuenta || '(sin cuenta)'; (g[c] = g[c] || []).push(p) }); return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0])) }

function Presupuesto({ unidades, recargar }: { unidades: Unidad[], recargar: () => void }) {
  const [uid, setUid] = useState('')
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<Record<string, string>>({})
  const [partidas, setPartidas] = useState<any[]>([])
  const [versiones, setVersiones] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [elegida, setElegida] = useState('')
  const [vTipo, setVTipo] = useState<'base' | 'adicional'>('base'); const [vDesc, setVDesc] = useState(''); const [vContrato, setVContrato] = useState(''); const [draft, setDraft] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState(''); const [guardando, setGuardando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState(''); const [nuevaCuenta, setNuevaCuenta] = useState('')
  const unidad = unidades.find(u => u.id === uid)
  const meses = useMemo(() => rangoMeses(unidad?.presupuesto_desde, unidad?.presupuesto_hasta), [unidad])

  const cargarCatalogo = useCallback(async () => {
    const [c, k] = await Promise.all([supabase.from('fin_catalogo_partidas').select('*').order('orden').order('nombre'), supabase.from('fin_cuentas').select('*').order('cuenta')])
    setCatalogo(c.data || []); setCuentas(Object.fromEntries((k.data || []).map((x: any) => [x.cuenta, x.nombre_cuenta])))
  }, [])
  useEffect(() => { cargarCatalogo() }, [cargarCatalogo])

  const cargar = useCallback(async () => {
    if (!uid) return
    const [p, v] = await Promise.all([
      supabase.from('fin_partidas').select('*, catalogo:fin_catalogo_partidas(nombre,cuenta,fuente)').eq('unidad_id', uid).order('orden').order('nombre'),
      supabase.from('fin_versiones').select('*').eq('unidad_id', uid).order('numero'),
    ])
    setPartidas(p.data || []); setVersiones(v.data || [])
    const ids = (v.data || []).map(x => x.id)
    if (ids.length) { const { data } = await supabase.from('fin_version_items').select('*').in('version_id', ids).limit(20000); setItems(data || []) } else setItems([])
  }, [uid])
  useEffect(() => { cargar() }, [cargar])

  const pres = useMemo(() => { const m: Record<string, number> = {}; items.forEach(i => { const k = i.partida_id + '|' + i.mes; m[k] = (m[k] || 0) + Number(i.delta) }); return m }, [items])
  const grupos = useMemo(() => agruparPorCuenta(partidas), [partidas])
  const contrato = (unidad?.monto_contrato_base || 0) + versiones.reduce((a, v) => a + Number(v.delta_contrato), 0)
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

  // Catálogo oficial de subpartidas (cada una pertenece a UNA cuenta contable de Kame)
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
    await supabase.from('fin_catalogo_partidas').update({ cuenta, cuentas: cuenta }).eq('id', c.id); cargarCatalogo(); cargar()
  }
  const cuentasOpc = Object.keys(cuentas).filter(c => !c.startsWith(CUENTA_REM)).sort()
  const dispo = catalogo.filter(c => !partidas.some(p => p.catalogo_id === c.id))
  const celda: React.CSSProperties = { ...td, padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12 }
  const cabCuenta: React.CSSProperties = { ...td, background: '#f2f4f7', fontWeight: 600, whiteSpace: 'nowrap' }

  return (
    <>
      <div style={card}>
        <select value={uid} onChange={e => { setUid(e.target.value); setDraft({}); setMsg('') }} style={{ ...inp, minWidth: 320 }}><option value="">Elegir proyecto…</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        {unidad && <span style={{ marginLeft: 16, fontSize: 13 }}>Contrato vigente: <b>${$(contrato)}</b> · Presupuesto de costos: <b>${$(totPres)}</b>{contrato > 0 && totPres > 0 && <> · Margen presupuestado: <b>{(((contrato - totPres) / contrato) * 100).toFixed(1)}%</b></>}</span>}
        {msg && <p style={{ fontSize: 12, margin: '8px 0 0', color: /^(No|Ya|Escribe|Elige)/.test(msg) ? '#b42318' : '#067647' }}>{msg}</p>}
      </div>

      <details style={card}>
        <summary style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Catálogo oficial de subpartidas ({catalogo.length})</summary>
        <p style={{ fontSize: 12, color: '#667085', margin: '8px 0' }}>Kame solo tiene la cuenta contable (ej. «Costos Materiales de Construcción»). Aquí definimos las subpartidas que la abren (Hormigón, Cubiertas, Fierro…). Todos los proyectos usan esta lista, así nadie escribe «Cubierta» y otro «Cubiertas». El presupuesto de una cuenta es la suma de sus subpartidas.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Subpartida</th><th style={th}>Cuenta contable de Kame</th><th style={th}>Costo real desde</th></tr></thead>
          <tbody>{[...catalogo].sort((a, b) => a.cuenta.localeCompare(b.cuenta) || a.nombre.localeCompare(b.nombre)).map(c => <tr key={c.id}><td style={td}>{c.nombre}</td>
            <td style={td}>{c.fuente === 'remuneraciones' ? <span style={{ color: '#667085' }}>{nomCuenta(cuentas, CUENTA_REM)}</span> :
              <select value={c.cuenta} onChange={e => cambiarCuentaCatalogo(c, e.target.value)} style={{ ...inp, padding: '4px 6px', maxWidth: 380 }}>{!cuentasOpc.includes(c.cuenta) && <option value={c.cuenta}>{c.cuenta || 'Elegir cuenta…'}</option>}{cuentasOpc.map(k => <option key={k} value={k}>{k} · {cuentas[k]}</option>)}</select>}</td>
            <td style={td}>{c.fuente === 'remuneraciones' ? 'Planilla RR.HH. (BUK)' : 'Facturas de Kame asignadas'}</td></tr>)}</tbody></table>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nueva subpartida (ej. Fierro)" style={{ ...inp, width: 220 }} />
          <select value={nuevaCuenta} onChange={e => setNuevaCuenta(e.target.value)} style={{ ...inp, maxWidth: 380 }}><option value="">Cuenta contable de Kame…</option>{cuentasOpc.map(k => <option key={k} value={k}>{k} · {cuentas[k]}</option>)}</select>
          <button onClick={agregarCatalogo} style={btn()}>Crear subpartida</button>
        </div>
      </details>

      {unidad && <>
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>1. Período del proyecto</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
            Inicio <input type="date" defaultValue={(unidad.presupuesto_desde || '').length === 10 ? unidad.presupuesto_desde! : ''} onBlur={e => e.target.value !== (unidad.presupuesto_desde || '') && guardarPeriodo('presupuesto_desde', e.target.value)} style={inp} />
            Término <input type="date" defaultValue={(unidad.presupuesto_hasta || '').length === 10 ? unidad.presupuesto_hasta! : ''} onBlur={e => e.target.value !== (unidad.presupuesto_hasta || '') && guardarPeriodo('presupuesto_hasta', e.target.value)} style={inp} />
            <span style={{ color: '#667085', fontSize: 12 }}>{meses.length ? `${meses.length} meses de presupuesto` : 'Elige fecha de inicio y de término para generar las columnas de meses.'}</span>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>2. Subpartidas de este proyecto</h2>
          {grupos.length === 0 && <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Aún no hay subpartidas. Agrega las que necesitas desde el catálogo.</p>}
          {grupos.map(([c, ps]) => <div key={c} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#344054' }}>{c} · {nomCuenta(cuentas, c)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>{ps.map(p => <span key={p.id} style={{ background: '#eef4ff', borderRadius: 99, padding: '4px 10px', fontSize: 13 }}>{p.nombre} <button onClick={() => quitarPartida(p)} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#667085' }}>✕</button></span>)}</div>
          </div>)}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <select value={elegida} onChange={e => setElegida(e.target.value)} style={{ ...inp, minWidth: 300 }}><option value="">Agregar subpartida del catálogo…</option>{dispo.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.cuenta}</option>)}</select>
            <button onClick={agregarPartida} disabled={!elegida} style={btn(true, !elegida)}>Agregar</button>
          </div>
        </div>

        {partidas.length > 0 && meses.length > 0 && <>
          <div style={card}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>3. Ingresar presupuesto por mes</h2>
            <p style={{ fontSize: 12, color: '#667085', margin: '0 0 8px' }}>Escribe el monto neto de cada subpartida en cada mes; la cuenta contable suma sola. Primero guarda el <b>presupuesto base</b>. Si el proyecto gana un adicional (ej. +$500.000 de fierro), guarda una versión <b>adicional</b> con la <b>variación</b> en la subpartida y mes que corresponda, y la variación del contrato.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={vTipo} onChange={e => setVTipo(e.target.value as any)} style={inp}><option value="base">Presupuesto base</option><option value="adicional">Adicional / nota de venta</option></select>
              <input value={vDesc} onChange={e => setVDesc(e.target.value)} placeholder="Descripción (ej. Adicional fierro)" style={{ ...inp, width: 280 }} />
              <MontoInput value={vContrato} onChange={setVContrato} placeholder={vTipo === 'base' ? 'Valor del contrato $' : 'Variación del contrato $'} style={{ ...inp, width: 220, textAlign: 'right' }} />
            </div>
            <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse' }}><thead><tr><th style={th}>Cuenta / subpartida</th>{meses.map(m => <th key={m} style={{ ...th, textAlign: 'right' }}>{nombreMes(m)}</th>)}<th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>{grupos.flatMap(([c, ps]) => [
                <tr key={c}><td style={cabCuenta}>{c} · {nomCuenta(cuentas, c)}</td>{meses.map(m => <td key={m} style={{ ...celda, background: '#f2f4f7', fontWeight: 600 }}>{(() => { const v = ps.reduce((a, p) => a + (Number(draft[p.id + '|' + m]) || 0), 0); return v ? $(v) : '' })()}</td>)}<td style={{ ...celda, background: '#f2f4f7', fontWeight: 600 }}>{$(ps.reduce((a, p) => a + meses.reduce((b, m) => b + (Number(draft[p.id + '|' + m]) || 0), 0), 0))}</td></tr>,
                ...ps.map(p => <tr key={p.id}><td style={{ ...td, whiteSpace: 'nowrap', paddingLeft: 24 }}>{p.nombre}</td>{meses.map(m => <td key={m} style={{ ...td, padding: 3 }}>
                  <MontoInput value={draft[p.id + '|' + m] ?? ''} onChange={v => setDraft(d => ({ ...d, [p.id + '|' + m]: v }))} style={{ ...inp, width: 110, padding: '5px 6px', textAlign: 'right' }} /></td>)}
                  <td style={celda}>{$(meses.reduce((b, m) => b + (Number(draft[p.id + '|' + m]) || 0), 0))}</td></tr>),
              ])}</tbody></table></div>
            <button onClick={guardarVersion} disabled={guardando} style={{ ...btn(true, guardando), marginTop: 12 }}>{guardando ? 'Guardando…' : `Guardar ${vTipo === 'base' ? 'presupuesto base' : 'adicional'}`}</button>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>4. Presupuesto vigente (base + adicionales)</h2>
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
  const [lineas, setLineas] = useState<any[]>([]); const [rem, setRem] = useState<any[]>([]); const [vers, setVers] = useState<any[]>([]); const [asi, setAsi] = useState<any[]>([])
  const [cargando, setCargando] = useState(true); const [tardias, setTardias] = useState<any[]>([]); const [proyecto, setProyecto] = useState('')
  useEffect(() => {
    (async () => {
      setCargando(true)
      const [l, r, v, a] = await Promise.all([
        traerTodo('fin_lineas', 'id,monto,unidad_id,documento:fin_documentos(sentido,fecha_doc,periodo_tributario,razon_social,folio,tipo_doc)'),
        traerTodo('fin_remuneraciones', 'id,periodo,unidad_id,rut,nombre,cargo,costo_empresa'),
        traerTodo('fin_versiones', 'id,unidad_id,delta_contrato'),
        traerTodo('fin_asientos', 'kame_id,fecha,cuenta,nombre_cuenta,debe,haber,unidad_id,doc_tipo,doc_folio,doc_rut,doc_nombre,comentario_det,comentario', 'kame_id'),
      ])
      setLineas(l); setRem(r); setVers(v); setAsi(a)
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
  const uSel = unidades.find(u => u.id === proyecto)

  return (
    <>
      <div style={card}>
        <span style={{ fontSize: 13, marginRight: 8 }}>Período:</span>
        <select value={mes} onChange={e => setMes(e.target.value)} style={inp}><option value="">Acumulado</option>{meses.map(m => <option key={m} value={m}>{m}</option>)}</select>
        <p style={{ fontSize: 12, color: '#667085', margin: '8px 0 0' }}>{hayKame ? 'Fuente: contabilidad de Kame (Libro Diario), por fecha del asiento. Ingresos = cuentas 3.x, costos = cuentas 4.x (esta tabla incluye los sueldos que Kame tenga contabilizados). Haz clic en un proyecto para ver su detalle.' : 'Fuente: archivos importados. Los documentos con libro del SII cargado se ubican en su período tributario; los demás, en el mes de su fecha. Montos netos.'}</p>
      </div>
      <div style={card}>
        {cargando ? <p style={{ fontSize: 13, color: '#999' }}>Cargando…</p> : filas.length === 0 ? <p style={{ fontSize: 13 }}>Aún no hay datos. Sincroniza con Kame en «Conexión Kame» y marca las unidades activas.</p> :
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Proyecto</th><th style={{ ...th, textAlign: 'right' }}>Contrato</th><th style={{ ...th, textAlign: 'right' }}>Ventas</th><th style={{ ...th, textAlign: 'right' }}>{hayKame ? 'Costos (contabilidad)' : 'Compras'}</th><th style={{ ...th, textAlign: 'right' }}>{hayKame ? 'Rem. planilla (ref.)' : 'Remuneraciones'}</th><th style={{ ...th, textAlign: 'right' }}>Margen</th><th style={{ ...th, textAlign: 'right' }}>%</th></tr></thead>
            <tbody>{filas.map(f => <tr key={f.u.id} onClick={() => setProyecto(f.u.id)} style={{ cursor: 'pointer', background: f.u.id === proyecto ? '#eef4ff' : undefined }}><td style={td}>{f.u.nombre}</td><td style={der}>{f.contrato ? $(f.contrato) : '—'}</td><td style={der}>{$(f.ventas)}</td><td style={der}>{$(f.compras)}</td><td style={der}>{$(f.sueldos)}</td>
              <td style={{ ...der, color: f.margen < 0 ? '#b42318' : '#067647', fontWeight: 600 }}>{$(f.margen)}</td><td style={der}>{f.pct == null ? '—' : f.pct.toFixed(1) + '%'}</td></tr>)}
              <tr><td style={{ ...td, fontWeight: 600 }}>Total</td><td style={der} /><td style={{ ...der, fontWeight: 600 }}>{$(tot.v)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.c)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.s)}</td><td style={{ ...der, fontWeight: 600 }}>{$(tot.v - tot.c - (hayKame ? 0 : tot.s))}</td><td style={der} /></tr></tbody></table></div>}
      </div>
      {uSel && hayKame && <DetalleProyecto key={uSel.id} unidad={uSel} mes={mes} asiU={asi.filter(a => a.unidad_id === uSel.id)} remU={rem.filter(r => r.unidad_id === uSel.id)} contratoDeltas={vers.filter(v => v.unidad_id === uSel.id).reduce((a, v) => a + Number(v.delta_contrato), 0)} />}
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
function DetalleProyecto({ unidad, mes, asiU, remU, contratoDeltas }: { unidad: Unidad, mes: string, asiU: any[], remU: any[], contratoDeltas: number }) {
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
  const contrato = Number(unidad.monto_contrato_base) + contratoDeltas

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
        {[
          ['Contrato vigente', $(contrato), ''],
          ['Facturado', $(ventas), contrato > 0 ? Math.round(ventas / contrato * 100) + '% del contrato' : ''],
          ['Presupuesto de costos', $(pptoTot), contrato > 0 && pptoTot > 0 ? 'Margen presup. ' + ((contrato - pptoTot) / contrato * 100).toFixed(1) + '%' : ''],
          ['Costo real', $(realTot), pptoTot > 0 ? Math.round(realTot / pptoTot * 100) + '% del presupuesto' : ''],
          ['Margen a la fecha', $(ventas - realTot), ventas > 0 ? ((ventas - realTot) / ventas * 100).toFixed(1) + '% de lo facturado' : ''],
        ].map(([t, v, s]) => <div key={t} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}><div style={{ fontSize: 11, color: '#667085' }}>{t}</div><div style={{ fontSize: 18, fontWeight: 600 }}>${v}</div><div style={{ fontSize: 11, color: '#667085' }}>{s}</div></div>)}
      </div>
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
      <div style={{ background: '#fff7ed', borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <b style={{ fontSize: 14 }}>BUK (remuneraciones)</b>
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

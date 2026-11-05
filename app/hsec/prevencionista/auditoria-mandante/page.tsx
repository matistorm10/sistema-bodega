'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label, Barra } from '@/components/programa/ui'
import { etiquetaContrato } from '@/lib/contratos'
import { hoyISO } from '@/lib/estadoPlan'
import { AudItem, AudResp, AudDoc, AudTrab, resumen, vigencia, docValido, calificacion, estadoTrab, difCompleta, resumenTrabajadores, trabActivos, estadoEpp } from '@/lib/auditoriaMandante'
import { formatearRut, rutValido } from '@/lib/rut'
import { P3_ITEMS, P3_SECCIONES, COLOR_CAL, DESC_CAL } from '@/lib/p3'
import { generarEstadoAuditoria } from '@/lib/generarAuditoriaMandante'
import { abrirVentanaPDF } from '@/lib/abrirPDF'

const fcl = (f?: string | null) => f ? f.split('-').reverse().join('-') : ''
const ESTADOS = [{ v: 'cumple', t: 'Cumple', col: '#1e8e4e' }, { v: 'no_cumple', t: 'No cumple', col: '#c0392b' }, { v: 'na', t: 'N/A', col: '#667085' }] as const
const VIG_COL: Record<string, [string, string, string]> = { vigente: ['#e7f6ec', '#14532d', 'Vigente'], por_vencer: ['#fef7e0', '#986a00', 'Por vencer'], vencido: ['#fde8e8', '#9b1c1c', 'Vencido'], sin_fecha: ['#f1f3f7', '#667085', 'Sin vencimiento'] }
const REV_COL: Record<string, [string, string, string]> = { pendiente: ['#efe7fd', '#5b3aa6', '⏳ Por revisar'], aprobado: ['#d7efe0', '#14532d', '✓ Aprobado'], rechazado: ['#fde8e8', '#9b1c1c', '✗ Rechazado'] }

type Vista = { t: 'lista' } | { t: 'lev', id: string } | { t: 'formatos' } | { t: 'formato', id: string }

export default function AuditoriaMandante() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esJefe = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const puede = esJefe || !!usuario?.esPrevencionista
  const [vista, setVista] = useState<Vista>({ t: 'lista' })
  const [formatos, setFormatos] = useState<any[]>([])
  const [items, setItems] = useState<AudItem[]>([])
  const [levs, setLevs] = useState<any[]>([])
  const [resps, setResps] = useState<AudResp[]>([])
  const [docs, setDocs] = useState<AudDoc[]>([])
  const [trabs, setTrabs] = useState<AudTrab[]>([])
  const [eppCat, setEppCat] = useState<any[]>([])
  const [eppCerts, setEppCerts] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    const [f, it, lv, rs, dc, ct, cl, us, tr, dt, ec, ek] = await Promise.all([
      supabase.from('aud_formatos').select('*').order('nombre'),
      supabase.from('aud_items').select('*').order('orden'),
      supabase.from('aud_levantamientos').select('*').order('created_at'),
      supabase.from('aud_respuestas').select('*'),
      supabase.from('aud_documentos').select('*').order('subido_at'),
      supabase.from('pr_contratos').select('*').eq('activo', true).order('nombre'),
      supabase.from('pr_clientes_informe').select('id,nombre'),
      supabase.from('usuarios').select('id,nombre'),
      supabase.from('aud_trabajadores').select('*').order('nombre'),
      supabase.from('aud_doc_trabajadores').select('documento_id,trabajador_id'),
      supabase.from('pr_epp_catalogo').select('id,nombre,activo,requiere_certificado').order('nombre'),
      supabase.from('pr_epp_certificados').select('*'),
    ])
    setEppCat(ec.data || []); setEppCerts(ek.data || [])
    const links: Record<string, string[]> = {}
    ;(dt.data || []).forEach((x: any) => { (links[x.documento_id] ||= []).push(x.trabajador_id) })
    setTrabs((tr.data || []) as AudTrab[])
    setFormatos(f.data || []); setItems((it.data || []) as AudItem[]); setLevs(lv.data || []); setResps((rs.data || []) as AudResp[]); setDocs(((dc.data || []) as AudDoc[]).map(d => ({ ...d, trab_ids: links[d.id] || [] })))
    setContratos(ct.data || []); setClientes(cl.data || []); setUsuarios(us.data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const eppEst = estadoEpp(eppCat, eppCerts)
  const nombreDe = (id: string | null) => usuarios.find(u => u.id === id)?.nombre || '—'
  const ctEtiqueta = (id: string) => { const c = contratos.find(x => x.id === id); return c ? etiquetaContrato(c, clientes) : '—' }
  const abrirArchivo = async (path: string) => {
    const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
    if (error || !data) { alert('No se pudo abrir el archivo'); return }
    window.open(data.signedUrl, '_blank')
  }

  const cab = (volver: { txt: string, f: () => void } | null) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      {volver ? <button onClick={volver.f} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: AZUL, padding: 0 }}>← {volver.txt}</button>
        : <Link href="/hsec/prevencionista/sso" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← SSO Faena</Link>}
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Auditoría Mandante</h1>
    </div>
  )
  const wrap = (c: React.ReactNode, volver: { txt: string, f: () => void } | null = null) => <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '860px', margin: '0 auto' }}>{cab(volver)}{c}</div></main>
  if (cargandoUsuario) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)
  if (!puede) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p>)
  if (cargando) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)

  // ═════════ Levantamiento (checklist de un contrato) ═════════
  if (vista.t === 'lev') {
    const lev = levs.find(l => l.id === vista.id)
    const fm = lev && formatos.find(f => f.id === lev.formato_id)
    if (!lev || !fm) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>No se encontró el levantamiento.</p>, { txt: 'Volver', f: () => setVista({ t: 'lista' }) })
    return <Levantamiento lev={lev} fm={fm} items={items.filter(i => i.formato_id === fm.id)} resps={resps.filter(r => r.levantamiento_id === lev.id)} docs={docs.filter(d => d.levantamiento_id === lev.id)} trabs={trabs.filter(t => t.levantamiento_id === lev.id)}
      eppEst={eppEst} contratoTxt={ctEtiqueta(lev.contrato_id)} esJefe={esJefe} usuarioId={usuario!.id} nombreDe={nombreDe} abrirArchivo={abrirArchivo} recargar={cargar} wrap={wrap} volver={() => { setVista({ t: 'lista' }); cargar() }} />
  }

  // ═════════ Formatos (solo Jefe) ═════════
  if (vista.t === 'formatos' || vista.t === 'formato') {
    if (!esJefe) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Solo el Jefe administra los formatos.</p>, { txt: 'Volver', f: () => setVista({ t: 'lista' }) })
    return <Formatos formatos={formatos} items={items} sel={vista.t === 'formato' ? vista.id : null} setVista={setVista} recargar={cargar} wrap={wrap} />
  }

  // ═════════ Lista de levantamientos ═════════
  const misLevs = levs
  return wrap(<>
    <div style={{ ...card, marginBottom: '12px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#344054' }}><b>Los clientes pueden auditarnos en cualquier momento.</b> Aquí mantenemos al día, por contrato, el checklist de cada cliente (SQM, Engie, Eurohinca, otros): el Jefe y el APR suben los documentos de respaldo a cada ítem y todo queda ordenado en la nube.</p>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Regla: un ítem solo se marca «Cumple» si tiene al menos un documento vigente. El Jefe revisa y aprueba cada documento.</p>
      {esJefe && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <NuevoLev formatos={formatos.filter(f => f.activo)} contratos={contratos} levs={levs} clientes={clientes} usuarioId={usuario!.id} onCreado={async id => { await cargar(); setVista({ t: 'lev', id }) }} />
        <button onClick={() => setVista({ t: 'formatos' })} style={btn(false)}>⚙️ Formatos de clientes</button>
      </div>}
    </div>
    {msg && <p style={{ fontSize: '12.5px', color: '#c5221f' }}>{msg}</p>}
    {misLevs.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>{esJefe ? (formatos.length === 0 ? 'Primero crea o carga un formato de cliente en «Formatos de clientes».' : 'Aún no hay levantamientos. Crea uno eligiendo el formato del cliente y el contrato.') : 'Todavía no tienes checklists asignados. El Jefe los asocia a tus contratos.'}</p>}
    <div style={{ display: 'grid', gap: '8px' }}>
      {misLevs.map(l => {
        const fm = formatos.find(f => f.id === l.formato_id); if (!fm) return null
        const its = items.filter(i => i.formato_id === fm.id)
        const rm: Record<string, AudResp> = {}; resps.filter(r => r.levantamiento_id === l.id).forEach(r => { rm[r.item_id] = r })
        const ds = docs.filter(d => d.levantamiento_id === l.id), tb = trabs.filter(t => t.levantamiento_id === l.id)
        const r = resumen(its, rm, ds, !!fm.usa_puntaje, tb, eppEst.ok)
        const rt = resumenTrabajadores(its, tb, ds)
        const cal = calificacion(r.pct)
        return (
          <div key={l.id} style={{ ...card, cursor: 'pointer' }} onClick={() => setVista({ t: 'lev', id: l.id })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '14.5px', color: '#16213E' }}>{fm.nombre}</p>
              <span style={{ fontSize: '12.5px', color: '#667085' }}>{ctEtiqueta(l.contrato_id)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 6px' }}>
              <div style={{ flex: 1 }}><Barra valor={r.pct} /></div>
              <strong style={{ fontSize: '14px' }}>{r.pct.toFixed(0)}%</strong>
              {fm.usa_puntaje && <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '20px', background: COLOR_CAL[cal][0], color: COLOR_CAL[cal][1] }}>{cal}</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px' }}>
              <span style={{ padding: '2px 9px', borderRadius: '20px', background: '#e7f6ec', color: '#14532d' }}>✓ {r.nCumple} cumple</span>
              <span style={{ padding: '2px 9px', borderRadius: '20px', background: '#fde8e8', color: '#9b1c1c' }}>✗ {r.nNo} no cumple</span>
              <span style={{ padding: '2px 9px', borderRadius: '20px', background: '#f1f3f7', color: '#475467' }}>{r.pend} pendientes de {r.n}</span>
              {rt.its.length > 0 && <span style={{ padding: '2px 9px', borderRadius: '20px', background: rt.total > 0 && rt.completos === rt.total ? '#e7f6ec' : '#fef7e0', color: rt.total > 0 && rt.completos === rt.total ? '#14532d' : '#986a00', fontWeight: 700 }}>👷 {rt.completos}/{rt.total} trabajadores con respaldo completo</span>}
              {r.porRevisar > 0 && <span style={{ padding: '2px 9px', borderRadius: '20px', background: '#efe7fd', color: '#5b3aa6', fontWeight: 700 }}>⏳ {r.porRevisar} doc. por revisar</span>}
              {r.vencidos > 0 && <span style={{ padding: '2px 9px', borderRadius: '20px', background: '#fde8e8', color: '#9b1c1c', fontWeight: 700 }}>⚠️ {r.vencidos} doc. vencido(s)</span>}
              {r.porVencer > 0 && <span style={{ padding: '2px 9px', borderRadius: '20px', background: '#fef7e0', color: '#986a00', fontWeight: 700 }}>{r.porVencer} por vencer</span>}
            </div>
          </div>
        )
      })}
    </div>
  </>)
}

// ───────── Crear levantamiento ─────────
function NuevoLev({ formatos, contratos, levs, clientes, usuarioId, onCreado }: { formatos: any[], contratos: any[], levs: any[], clientes: any[], usuarioId: string, onCreado: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState(''); const [c, setC] = useState(''); const [err, setErr] = useState('')
  if (!abierto) return <button onClick={() => setAbierto(true)} style={btn()}>+ Nuevo levantamiento</button>
  const libres = contratos.filter(x => !levs.some(l => l.formato_id === f && l.contrato_id === x.id))
  return (
    <div style={{ flex: '1 1 100%', border: '1px solid #cfe0f5', background: '#f4f8fd', borderRadius: '10px', padding: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 200px' }}><label style={label}>Formato del cliente</label><select value={f} onChange={e => { setF(e.target.value); setC('') }} style={input}><option value="">— elegir —</option>{formatos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
      <div style={{ flex: '2 1 260px' }}><label style={label}>Contrato</label><select value={c} onChange={e => setC(e.target.value)} style={input} disabled={!f}><option value="">— elegir —</option>{libres.map(x => <option key={x.id} value={x.id}>{etiquetaContrato(x, clientes)}</option>)}</select></div>
      <button onClick={async () => {
        if (!f || !c) { setErr('Elige el formato y el contrato.'); return }
        const { data, error } = await supabase.from('aud_levantamientos').insert({ formato_id: f, contrato_id: c, creado_por: usuarioId }).select().maybeSingle()
        if (error || !data) { setErr(error?.code === '23505' ? 'Ese contrato ya tiene este formato.' : (error?.message || 'No se pudo crear')); return }
        onCreado(data.id)
      }} style={btn()}>Crear</button>
      <button onClick={() => setAbierto(false)} style={btn(false)}>Cancelar</button>
      {err && <span style={{ fontSize: '12.5px', color: '#c5221f', flex: '1 1 100%' }}>{err}</span>}
    </div>
  )
}

// ───────── Checklist de un contrato ─────────
function Levantamiento({ lev, fm, items, resps, docs, trabs, eppEst, contratoTxt, esJefe, usuarioId, nombreDe, abrirArchivo, recargar, wrap, volver }: {
  lev: any, fm: any, items: AudItem[], resps: AudResp[], docs: AudDoc[], trabs: AudTrab[], eppEst: ReturnType<typeof estadoEpp>, contratoTxt: string, esJefe: boolean, usuarioId: string,
  nombreDe: (id: string | null) => string, abrirArchivo: (p: string) => void, recargar: () => Promise<void>, wrap: (c: React.ReactNode, v?: any) => React.ReactNode, volver: () => void,
}) {
  const [filtro, setFiltro] = useState<'todos' | 'pendientes' | 'no_cumple' | 'revisar' | 'vencidos'>('todos')
  const [abierta, setAbierta] = useState<Record<string, boolean>>({})
  const [orient, setOrient] = useState<Record<string, boolean>>({})
  const [venceNuevo, setVenceNuevo] = useState<Record<string, string>>({})
  const [subiendo, setSubiendo] = useState('')
  const [msg, setMsg] = useState('')
  const [auto, setAuto] = useState<any>(null)
  // MIPER (matrices) cargadas por el Jefe en Contratos y documentos para este contrato
  const [matrices, setMatrices] = useState<any[] | null>(null)
  useEffect(() => { supabase.from('pr_contrato_documentos').select('id,nombre,estado,rev,path,archivo_nombre').eq('contrato_id', lev.contrato_id).eq('categoria', 'Matriz').order('nombre').then(({ data }) => setMatrices((data || []).filter((m: any) => !!m.path))) }, [lev.contrato_id])
  const miperOk = (matrices || []).some(m => m.estado === 'Aprobado')
  const rm = useMemo(() => { const m: Record<string, AudResp> = {}; resps.forEach(r => { m[r.item_id] = r }); return m }, [resps])
  const dpor = (id: string) => docs.filter(d => d.item_id === id)
  const r = resumen(items, rm, docs, !!fm.usa_puntaje, trabs, eppEst.ok)
  const rt = resumenTrabajadores(items, trabs, docs)
  const cal = calificacion(r.pct)
  const secciones = Array.from(new Set(items.map(i => i.seccion)))

  const cumpleFiltro = (it: AudItem) => {
    const e = rm[it.id]?.estado || 'pendiente'; const ds = dpor(it.id)
    return filtro === 'todos' ? true : filtro === 'pendientes' ? e === 'pendiente' : filtro === 'no_cumple' ? e === 'no_cumple'
      : filtro === 'revisar' ? ds.some(d => d.revision === 'pendiente') : ds.some(d => d.revision !== 'rechazado' && vigencia(d.vence) === 'vencido')
  }
  const guardar = async (it: AudItem, patch: Partial<AudResp>) => {
    setMsg('')
    const { error } = await supabase.from('aud_respuestas').upsert({ levantamiento_id: lev.id, item_id: it.id, estado: rm[it.id]?.estado || 'pendiente', ...patch, updated_by: usuarioId, updated_at: new Date().toISOString() }, { onConflict: 'levantamiento_id,item_id' })
    if (error) { setMsg('No se pudo guardar: ' + error.message); return }
    await recargar()
  }
  // Ítems que se responden solos con datos que el sistema ya tiene (solo si aún están pendientes)
  const evaluarAuto = (it: AudItem): { ok: boolean, txt: string } | null => {
    if (!auto) return null
    if (it.fuente === 'trabajadores') return { ok: auto.trab_total > 0, txt: `${auto.trab_total} trabajador(es) activo(s) en el listado del contrato.` }
    if (it.fuente === 'liderazgo') return { ok: auto.lider_total > 0 && auto.lider_aprobados === auto.lider_total, txt: `Programa de liderazgo de ${auto.mes}: ${auto.lider_aprobados} de ${auto.lider_total} aprobados por el Jefe.` }
    if (it.fuente === 'epp_entrega') return { ok: auto.trab_total > 0 && auto.trab_con_entrega === auto.trab_total, txt: `${auto.trab_con_entrega} de ${auto.trab_total} trabajadores tienen entrega de EPP registrada en el módulo EPP.` }
    return null
  }
  useEffect(() => { supabase.rpc('aud_auto', { p_lev: lev.id }).then(({ data }) => setAuto(data || null)) }, [lev.id, resps.length])
  useEffect(() => {
    if (!auto) return
    items.forEach(it => {
      const ev = evaluarAuto(it)
      if (ev?.ok && !rm[it.id]) guardar(it, { estado: 'cumple', obs: 'Completado automáticamente: ' + ev.txt })
    })
  }, [auto]) // eslint-disable-line react-hooks/exhaustive-deps
  const marcar = async (it: AudItem, v: AudResp['estado']) => {
    const actual = rm[it.id]?.estado
    if (v === 'cumple' && actual !== 'cumple' && it.fuente === 'miper' && !miperOk) { setMsg(`Ítem ${it.numero || ''}: la MIPER debe estar cargada y aprobada en Contratos y documentos.`); return }
    if (v === 'cumple' && actual !== 'cumple' && it.requiere_trabajador) {
      const c = difCompleta(it.id, trabs, docs)
      if (c.total === 0) { setMsg(`Ítem ${it.numero || ''}: primero agrega a los trabajadores del contrato.`); return }
      if (!c.ok) { setMsg(`Ítem ${it.numero || ''}: faltan los documentos firmados de ${c.faltan} trabajador(es).`); return }
    } else if (v === 'cumple' && actual !== 'cumple' && it.fuente === 'epp') {
      if (eppEst.total === 0) { setMsg(`Ítem ${it.numero || ''}: el Jefe aún no define qué EPP aplican ni carga sus certificados en el módulo EPP.`); return }
      if (!eppEst.ok) { setMsg(`Ítem ${it.numero || ''}: faltan certificados vigentes de ${eppEst.total - eppEst.conCert} EPP (los carga el Jefe en el módulo EPP).`); return }
    } else if (v === 'cumple' && actual !== 'cumple' && evaluarAuto(it)?.ok) {
      // respaldado por datos del sistema
    } else if (v === 'cumple' && actual !== 'cumple' && !dpor(it.id).some(docValido)) { setMsg(`Ítem ${it.numero || ''}: para marcarlo «Cumple» sube primero un documento de respaldo vigente.`); return }
    await guardar(it, { estado: actual === v ? 'pendiente' : v })
  }
  const subir = async (it: AudItem, f: File) => {
    if (f.size > 15 * 1024 * 1024) { setMsg('El archivo supera 15 MB.'); return }
    setSubiendo(it.id); setMsg('')
    const path = `auditoria/${lev.id}/${it.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
    if (up.error) { setSubiendo(''); setMsg('No se pudo subir: ' + up.error.message); return }
    const { error } = await supabase.from('aud_documentos').insert({ levantamiento_id: lev.id, item_id: it.id, path, nombre: f.name, vence: venceNuevo[it.id] || null, subido_por: usuarioId })
    setSubiendo('')
    if (error) { setMsg('No se pudo registrar: ' + error.message); return }
    setVenceNuevo({ ...venceNuevo, [it.id]: '' }); await recargar()
  }
  // Un solo documento puede respaldar a varios trabajadores: se suben N vínculos
  const subirVarios = async (it: AudItem, ids: string[], f: File): Promise<boolean> => {
    if (!ids.length) { setMsg('Marca al menos un trabajador.'); return false }
    if (f.size > 15 * 1024 * 1024) { setMsg('El archivo supera 15 MB.'); return false }
    setSubiendo(it.id); setMsg('')
    const path = `auditoria/${lev.id}/${it.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
    if (up.error) { setSubiendo(''); setMsg('No se pudo subir: ' + up.error.message); return false }
    const { data, error } = await supabase.from('aud_documentos').insert({ levantamiento_id: lev.id, item_id: it.id, path, nombre: f.name, subido_por: usuarioId }).select('id').maybeSingle()
    if (error || !data) { setSubiendo(''); setMsg('No se pudo registrar: ' + (error?.message || '')); return false }
    const { error: e2 } = await supabase.from('aud_doc_trabajadores').insert(ids.map(t => ({ documento_id: data.id, trabajador_id: t, levantamiento_id: lev.id })))
    setSubiendo('')
    if (e2) { setMsg('Se subió el archivo pero no se asignaron los trabajadores: ' + e2.message); await recargar(); return false }
    await recargar(); return true
  }
  const cambiarTrab = async (d: AudDoc, tid: string, poner: boolean) => {
    const q = poner
      ? supabase.from('aud_doc_trabajadores').insert({ documento_id: d.id, trabajador_id: tid, levantamiento_id: lev.id })
      : supabase.from('aud_doc_trabajadores').delete().eq('documento_id', d.id).eq('trabajador_id', tid)
    const { error } = await q
    if (error) { setMsg(error.message); return }
    await recargar()
  }
  const revisarDoc = async (d: AudDoc, revision: 'aprobado' | 'rechazado') => {
    let comentario: string | null = null
    if (revision === 'rechazado') { comentario = (prompt('Motivo del rechazo (el APR lo verá):') || '').trim(); if (!comentario) return }
    const { error } = await supabase.from('aud_documentos').update({ revision, comentario, revisado_por: usuarioId, revisado_at: new Date().toISOString() }).eq('id', d.id)
    if (error) { setMsg(error.message); return }
    await recargar()
  }
  const borrarDoc = async (d: AudDoc) => {
    if (!confirm(`¿Eliminar el documento «${d.nombre}»?`)) return
    const { error } = await supabase.from('aud_documentos').delete().eq('id', d.id)
    if (error) { setMsg(error.message); return }
    await recargar()
  }
  const pdf = async () => {
    const v = abrirVentanaPDF()
    try { await generarEstadoAuditoria({ formato: fm, contrato: contratoTxt, items, resp: rm, docs, trabs, eppOk: eppEst.ok }, v) } catch (e: any) { v?.close(); alert('No se pudo generar el PDF: ' + (e?.message || e)) }
  }
  const kpi = (v: string | number, t: string, col = '#16213E') => <div style={{ ...card, padding: '10px 12px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '21px', fontWeight: 800, color: col }}>{v}</p><p style={{ margin: '2px 0 0', fontSize: '11px', color: '#667085' }}>{t}</p></div>
  const chip = (k: typeof filtro, t: string, n?: number) => <button key={k} onClick={() => setFiltro(k)} style={{ ...btn(filtro === k), padding: '5px 11px', fontSize: '12px' }}>{t}{n !== undefined ? ` (${n})` : ''}</button>

  return wrap(<>
    <div style={{ ...card, marginBottom: '10px' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#16213E' }}>{fm.nombre}{fm.codigo ? <span style={{ fontWeight: 400, color: '#667085' }}> · {fm.codigo}</span> : null}</p>
      <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#667085' }}>Contrato: {contratoTxt}</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '8px', marginBottom: '10px' }}>
      {kpi(`${r.pct.toFixed(0)}%`, fm.usa_puntaje ? `Cumplimiento · ${cal}` : 'Cumplimiento', r.pct >= 95 ? '#1e8e4e' : r.pct >= 80 ? '#b7791f' : '#c0392b')}
      {kpi(`${r.nCumple}/${r.n}`, 'Ítems que cumplen', '#1e8e4e')}
      {kpi(r.pend, 'Pendientes', r.pend ? '#986a00' : '#1e8e4e')}
      {kpi(r.vencidos, 'Docs vencidos', r.vencidos ? '#c0392b' : '#1e8e4e')}
      {kpi(r.porRevisar, 'Docs por revisar', r.porRevisar ? '#5b3aa6' : '#1e8e4e')}
    </div>
    {fm.usa_puntaje && <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#667085' }}>{DESC_CAL[cal].desc} <b>Escala:</b> Preferente 95–100% · Condicional 80–94% · Restringido bajo 80%.</p>}
    {rt.its.length > 0 && <PanelTrabajadores lev={lev} trabs={trabs} docs={docs} rt={rt} esJefe={esJefe} usuarioId={usuarioId} abrirArchivo={abrirArchivo} recargar={recargar} setMsg={setMsg} />}
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
      {chip('todos', 'Todos')}{chip('pendientes', 'Pendientes', r.pend)}{chip('no_cumple', 'No cumple', r.nNo)}{chip('revisar', 'Docs por revisar', r.porRevisar)}{chip('vencidos', 'Docs vencidos', r.vencidos)}
      <button onClick={pdf} style={{ ...btn(false), padding: '5px 11px', fontSize: '12px', marginLeft: 'auto' }}>📄 Informe de estado (PDF)</button>
    </div>
    {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 8px' }}>{msg}</p>}

    {secciones.map(sec => {
      const its = items.filter(i => i.seccion === sec)
      const vis = its.filter(cumpleFiltro)
      if (!vis.length) return null
      const listos = its.filter(i => ['cumple', 'na'].includes(rm[i.id]?.estado || '')).length
      const abre = abierta[sec] ?? (filtro !== 'todos')
      return (
        <div key={sec} style={{ ...card, marginBottom: '8px' }}>
          <button type="button" onClick={() => setAbierta({ ...abierta, [sec]: !abre })} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', justifyContent: 'space-between', gap: '8px', fontFamily: 'inherit' }}>
            <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>{sec}</span>
            <span style={{ fontSize: '11.5px', color: listos === its.length ? '#14532d' : '#667085', whiteSpace: 'nowrap' }}>{listos === its.length ? '✓ ' : ''}{listos}/{its.length} {abre ? '▲' : '▼'}</span>
          </button>
          {abre && vis.map(it => {
            const rs = rm[it.id]; const e = rs?.estado || 'pendiente'; const ds = dpor(it.id)
            return (
              <div key={it.id} style={{ borderTop: '1px solid #eef1f6', marginTop: '10px', paddingTop: '10px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', whiteSpace: 'pre-line' }}><strong>{it.numero ? it.numero + '. ' : ''}</strong>{it.texto}{fm.usa_puntaje ? <span style={{ color: '#98a2b3', fontSize: '11.5px' }}> ({it.puntaje} pts)</span> : null}</p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {ESTADOS.map(o => <button key={o.v} type="button" onClick={() => marcar(it, o.v)} style={{ padding: '5px 14px', borderRadius: '8px', border: `1.5px solid ${o.col}`, background: e === o.v ? o.col : '#fff', color: e === o.v ? '#fff' : o.col, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>{o.t}</button>)}
                  {e === 'pendiente' && <span style={{ fontSize: '11.5px', color: '#986a00' }}>Pendiente</span>}
                  {it.orientacion && <button type="button" onClick={() => setOrient({ ...orient, [it.id]: !orient[it.id] })} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>{orient[it.id] ? 'Ocultar' : 'Ver'} orientación</button>}
                </div>
                {orient[it.id] && it.orientacion && <p style={{ margin: '0 0 6px', fontSize: '12px', background: '#f4f8fd', border: '1px solid #cfe0f5', borderRadius: '8px', padding: '8px 10px', whiteSpace: 'pre-line', color: '#344054' }}>{it.orientacion}</p>}

                {(() => { const ev = evaluarAuto(it); return ev ? <p style={{ margin: '0 0 6px', fontSize: '12px', padding: '7px 10px', borderRadius: '8px', background: ev.ok ? '#f3fbf6' : '#fff8e5', border: `1px solid ${ev.ok ? '#b9e2c8' : '#f0d98a'}`, color: ev.ok ? '#14532d' : '#7a5600' }}>{ev.ok ? '✓ Se completa solo con datos del sistema: ' : '⏳ Se completará solo cuando se cumpla: '}{ev.txt}</p> : null })()}
                {it.fuente === 'miper' && matrices && (matrices.length === 0
                  ? <p style={{ margin: '0 0 6px', fontSize: '12px', padding: '8px 10px', borderRadius: '8px', background: '#fff8e5', border: '1px solid #f0d98a', color: '#7a5600' }}>⏳ <strong>Pendiente por cargar la MIPER.</strong> Solo se puede cargar desde <strong>Contratos y documentos</strong> (categoría Matriz) para respetar el proceso. {esJefe ? <Link href="/hsec/jefatura/contratos" style={{ color: AZUL, fontWeight: 600 }}>Ir a Contratos y documentos →</Link> : 'Avisa al Jefe para que la cargue.'}</p>
                  : <div style={{ margin: '0 0 6px', padding: '8px 10px', borderRadius: '8px', background: miperOk ? '#f3fbf6' : '#fff8e5', border: `1px solid ${miperOk ? '#b9e2c8' : '#f0d98a'}` }}>
                    <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: miperOk ? '#14532d' : '#7a5600' }}>{miperOk ? '✓ MIPER cargada y aprobada en Contratos y documentos' : '⏳ MIPER cargada, pendiente de aprobación del Jefe en Contratos y documentos'}</p>
                    {matrices.map(m => <div key={m.id} style={{ fontSize: '12.5px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => abrirArchivo(m.path)} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '12.5px', textAlign: 'left' }}>📎 {m.nombre}</button>
                      <span style={{ fontSize: '10.5px', color: '#667085' }}>Rev. {m.rev} · {m.estado}</span>
                    </div>)}
                  </div>)}
                {it.fuente === 'epp' && <BloqueEpp est={eppEst} abrirArchivo={abrirArchivo} />}
                {it.requiere_trabajador && <SelectorTrab it={it} trabs={trabs} docs={docs} subiendo={subiendo === it.id} subirVarios={subirVarios} />}
                {/* Documentos */}
                {ds.map(d => {
                  const [vb, vf, vt] = VIG_COL[vigencia(d.vence)], [rb, rf, rt] = REV_COL[d.revision]
                  return (
                    <div key={d.id} style={{ background: '#fafbfd', border: '1px solid #eef1f6', borderRadius: '8px', padding: '6px 9px', marginBottom: '5px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => abrirArchivo(d.path)} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '12.5px', textAlign: 'left' }}>📎 {d.nombre}</button>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: rb, color: rf }}>{rt}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: vb, color: vf }}>{d.vence ? `${vt} · ${fcl(d.vence)}` : vt}</span>
                        <span style={{ fontSize: '11px', color: '#98a2b3' }}>{nombreDe(d.subido_por)} · {new Date(d.subido_at).toLocaleDateString('es-CL')}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                          {esJefe && d.revision !== 'aprobado' && <button type="button" onClick={() => revisarDoc(d, 'aprobado')} style={{ ...btn(), padding: '3px 9px', fontSize: '11.5px' }}>✓ Aprobar</button>}
                          {esJefe && d.revision !== 'rechazado' && <button type="button" onClick={() => revisarDoc(d, 'rechazado')} style={{ ...btn(false, true), padding: '3px 9px', fontSize: '11.5px' }}>✗ Rechazar</button>}
                          {(esJefe || (d.subido_por === usuarioId && d.revision === 'pendiente')) && <button type="button" onClick={() => borrarDoc(d)} title="Eliminar" style={{ ...btn(false, true), padding: '3px 8px', fontSize: '11.5px' }}>🗑</button>}
                        </span>
                      </div>
                      {it.requiere_trabajador && <TrabsDoc d={d} trabs={trabs} puedeEditar={esJefe || (d.subido_por === usuarioId && d.revision === 'pendiente')} cambiar={cambiarTrab} />}
                      {d.revision === 'rechazado' && d.comentario && <p style={{ margin: '4px 0 0', color: '#9b1c1c' }}>💬 {d.comentario}</p>}
                    </div>
                  )
                })}
                {!it.requiere_trabajador && it.fuente !== 'miper' && <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <label style={{ ...btn(false), padding: '5px 12px', fontSize: '12px', display: 'inline-block', cursor: 'pointer' }}>
                    {subiendo === it.id ? 'Subiendo...' : '📎 Subir documento'}
                    <input type="file" style={{ display: 'none' }} disabled={subiendo === it.id} onChange={ev => { const f = ev.target.files?.[0]; if (f) subir(it, f); ev.target.value = '' }} />
                  </label>
                  <span style={{ fontSize: '11.5px', color: '#667085' }}>Vence (si aplica):</span>
                  <input type="date" value={venceNuevo[it.id] || ''} onChange={ev => setVenceNuevo({ ...venceNuevo, [it.id]: ev.target.value })} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: '12px' }} />
                </div>}

                {e === 'no_cumple' && (
                  <div style={{ background: '#fff5f5', borderRadius: '8px', padding: '8px', margin: '6px 0', display: 'grid', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#9b1c1c' }}>No cumple: plan de acción</p>
                    <input defaultValue={rs?.accion || ''} placeholder="Acción a realizar" onBlur={ev => { if (ev.target.value !== (rs?.accion || '')) guardar(it, { accion: ev.target.value }) }} style={input} />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <input defaultValue={rs?.responsable || ''} placeholder="Responsable" onBlur={ev => { if (ev.target.value !== (rs?.responsable || '')) guardar(it, { responsable: ev.target.value }) }} style={{ ...input, flex: '1 1 140px', width: 'auto' }} />
                      <input type="date" min={hoyISO()} defaultValue={rs?.plazo || ''} onBlur={ev => { const v = ev.target.value; if (v !== (rs?.plazo || '')) guardar(it, { plazo: v && v < hoyISO() ? hoyISO() : (v || null) }) }} title="Plazo" style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
                      <select value={rs?.plan_estado === 'Ejecutado' ? 'Ejecutado' : 'En ejecución'} onChange={ev => guardar(it, { plan_estado: ev.target.value })} style={{ ...input, flex: '1 1 120px', width: 'auto' }}><option>En ejecución</option><option>Ejecutado</option></select>
                    </div>
                  </div>
                )}
                <input defaultValue={rs?.obs || ''} placeholder="Observaciones" onBlur={ev => { if (ev.target.value !== (rs?.obs || '')) guardar(it, { obs: ev.target.value }) }} style={input} />
              </div>
            )
          })}
        </div>
      )
    })}
    {items.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Este formato todavía no tiene ítems.</p>}
  </>, { txt: 'Volver a la lista', f: volver })
}

// ───────── Certificados de EPP traídos automáticamente del módulo EPP (solo lectura) ─────────
function BloqueEpp({ est, abrirArchivo }: { est: ReturnType<typeof estadoEpp>, abrirArchivo: (p: string) => void }) {
  return (
    <div style={{ background: '#f7f9fd', border: '1px solid #dfe7f5', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: est.ok ? '#14532d' : '#986a00' }}>🦺 Certificados de calidad de EPP (vienen del módulo EPP) · {est.conCert}/{est.total} EPP con certificado vigente</p>
      {est.total === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#98a2b3' }}>Aún no hay EPP con certificados. El Jefe los carga en Prevención de Riesgo → Stock de EPP.</p>}
      {est.filas.map(f => (
        <div key={f.c.id} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', padding: '3px 0', fontSize: '12.5px' }}>
          <span style={{ fontWeight: 600, minWidth: '110px' }}>{f.ok ? '✓' : '✗'} {f.c.nombre}</span>
          {f.cs.length === 0 && <span style={{ color: '#9b1c1c', fontSize: '12px' }}>sin certificado</span>}
          {f.cs.map((c: any) => { const v = vigencia(c.vence); return (
            <button key={c.id} type="button" onClick={() => abrirArchivo(c.path)} title={c.nombre} style={{ border: 'none', borderRadius: '20px', padding: '2px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, background: v === 'vencido' ? '#fde8e8' : v === 'por_vencer' ? '#fef7e0' : '#e7f6ec', color: v === 'vencido' ? '#9b1c1c' : v === 'por_vencer' ? '#986a00' : '#14532d' }}>📎 {c.proveedor || 'Certificado'}{c.vence ? ` · vence ${fcl(c.vence)}` : ''}</button>) })}
        </div>))}
    </div>
  )
}

// ───────── Celda de respaldo de un trabajador en un ítem ─────────
const CEL: Record<string, [string, string, string]> = { falta: ['#fff', '#9b1c1c', 'Falta'], revisar: ['#efe7fd', '#5b3aa6', '⏳'], ok: ['#d7efe0', '#14532d', '✓'], rechazado: ['#fde8e8', '#9b1c1c', '✗'] }
function CeldaDif({ docs, t, it, abrirArchivo }: { docs: AudDoc[], t: AudTrab, it: AudItem, abrirArchivo: (p: string) => void }) {
  const { e, doc } = estadoTrab(docs, t.id, it.id)
  const [bg, fg, tx] = CEL[e]
  if (!doc) return <span style={{ fontSize: '11px', fontWeight: 700, color: fg }}>{tx}</span>
  return <button type="button" onClick={() => abrirArchivo(doc.path)} title={`${doc.nombre} · ${e === 'ok' ? 'aprobado' : e === 'revisar' ? 'por revisar' : 'rechazado'}${doc.comentario ? ' · ' + doc.comentario : ''}`} style={{ border: 'none', background: bg, color: fg, borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>📎 {tx}</button>
}

// ───────── Selector por clicks: un documento → varios trabajadores ─────────
function SelectorTrab({ it, trabs, docs, subiendo, subirVarios }: { it: AudItem, trabs: AudTrab[], docs: AudDoc[], subiendo: boolean, subirVarios: (it: AudItem, ids: string[], f: File) => Promise<boolean> }) {
  const [sel, setSel] = useState<string[]>([])
  const act = trabActivos(trabs)
  const c = difCompleta(it.id, trabs, docs)
  const falta = (t: AudTrab) => { const e = estadoTrab(docs, t.id, it.id).e; return e === 'falta' || e === 'rechazado' }
  const ordenados = [...act.filter(falta), ...act.filter(t => !falta(t))]
  const alt = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  return (
    <div style={{ background: '#f7f9fd', border: '1px solid #dfe7f5', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: c.ok ? '#14532d' : '#986a00' }}>👷 Documento firmado por trabajador · {c.total - c.faltan}/{c.total} con respaldo{c.total === 0 ? ' (agrega los trabajadores en el panel de arriba)' : ''}</p>
      {act.length > 0 && <>
        <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: '#667085' }}>Marca con un click a quienes firmaron el documento que vas a subir (puede ser 1 o varios) y luego sube el archivo.</p>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {ordenados.map(t => {
            const f = falta(t), on = sel.includes(t.id)
            return <button key={t.id} type="button" onClick={() => alt(t.id)} title={t.rut} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: `1.5px solid ${on ? AZUL : f ? '#e0b4b4' : '#bfe3cb'}`, background: on ? AZUL : f ? '#fff' : '#eefaf2', color: on ? '#fff' : f ? '#9b1c1c' : '#14532d', fontWeight: on ? 700 : 500 }}>{on ? '☑' : f ? '☐' : '✓'} {t.nombre}</button>
          })}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setSel(act.filter(falta).map(t => t.id))} style={{ ...btn(false), padding: '3px 10px', fontSize: '11.5px' }}>Los que faltan ({c.faltan})</button>
          <button type="button" onClick={() => setSel(act.map(t => t.id))} style={{ ...btn(false), padding: '3px 10px', fontSize: '11.5px' }}>Todos</button>
          <button type="button" onClick={() => setSel([])} style={{ ...btn(false), padding: '3px 10px', fontSize: '11.5px' }}>Ninguno</button>
          <label style={{ ...btn(sel.length > 0), padding: '5px 12px', fontSize: '12px', display: 'inline-block', cursor: sel.length && !subiendo ? 'pointer' : 'not-allowed', opacity: sel.length ? 1 : 0.5, marginLeft: 'auto' }}>
            {subiendo ? 'Subiendo...' : `📎 Subir documento (${sel.length} seleccionado${sel.length === 1 ? '' : 's'})`}
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={!sel.length || subiendo} onChange={async ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f && await subirVarios(it, sel, f)) setSel([]) }} />
          </label>
        </div>
      </>}
    </div>
  )
}

// ───────── Trabajadores cubiertos por un documento ─────────
function TrabsDoc({ d, trabs, puedeEditar, cambiar }: { d: AudDoc, trabs: AudTrab[], puedeEditar: boolean, cambiar: (d: AudDoc, tid: string, poner: boolean) => void }) {
  const [edit, setEdit] = useState(false)
  const ids = d.trab_ids || []
  const cubiertos = trabs.filter(t => ids.includes(t.id))
  return (
    <div style={{ marginTop: '5px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '11px', color: '#667085' }}>👷 {cubiertos.length} trabajador(es):</span>
      {(edit ? trabs.filter(t => t.activo || ids.includes(t.id)) : cubiertos).map(t => {
        const on = ids.includes(t.id)
        return edit
          ? <button key={t.id} type="button" onClick={() => cambiar(d, t.id, !on)} style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', border: `1px solid ${on ? AZUL : '#d0d5dd'}`, background: on ? AZUL : '#fff', color: on ? '#fff' : '#667085' }}>{on ? '☑' : '☐'} {t.nombre}</button>
          : <span key={t.id} style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: '#eef3fb', color: '#344054' }}>{t.nombre}</span>
      })}
      {puedeEditar && <button type="button" onClick={() => setEdit(e => !e)} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}>{edit ? 'Listo' : 'editar trabajadores'}</button>}
    </div>
  )
}

// ───────── Panel: trabajadores del contrato y su respaldo ─────────
function PanelTrabajadores({ lev, trabs, docs, rt, esJefe, usuarioId, abrirArchivo, recargar, setMsg }: {
  lev: any, trabs: AudTrab[], docs: AudDoc[], rt: ReturnType<typeof resumenTrabajadores>, esJefe: boolean, usuarioId: string,
  abrirArchivo: (p: string) => void, recargar: () => Promise<void>, setMsg: (m: string) => void,
}) {
  const [abierto, setAbierto] = useState(true)
  const [soloInc, setSoloInc] = useState(false)
  const [nom, setNom] = useState(''); const [rut, setRut] = useState(''); const [ing, setIng] = useState('')
  const [pegar, setPegar] = useState('')
  const [err, setErr] = useState('')
  const bajas = trabs.filter(t => !t.activo)
  const agregar = async (filas: { nombre: string, rut: string, fecha_ingreso?: string | null }[]) => {
    const { error } = await supabase.from('aud_trabajadores').insert(filas.map(f => ({ levantamiento_id: lev.id, nombre: f.nombre, rut: f.rut, fecha_ingreso: f.fecha_ingreso || null, creado_por: usuarioId })))
    if (error) { setErr(error.code === '23505' ? 'Alguno de esos RUT ya está en la nómina.' : error.code === '42501' ? 'No se pudo agregar: este levantamiento ya no existe o no tienes asignado el contrato. Actualizo la lista; si sigue igual, pídele al Jefe que te asigne el contrato.' : error.message); if (error.code === '42501') await recargar(); return false }
    setErr(''); await recargar(); return true
  }
  const filas = soloInc ? rt.filas.filter(f => !f.completo) : rt.filas
  return (
    <div style={{ ...card, marginBottom: '10px' }}>
      <button type="button" onClick={() => setAbierto(a => !a)} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', fontFamily: 'inherit' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#16213E' }}>👷 Trabajadores y respaldo firmado</span>
        <span style={{ fontSize: '12px', color: rt.total > 0 && rt.completos === rt.total ? '#14532d' : '#986a00', fontWeight: 700 }}>{rt.completos}/{rt.total} con respaldo completo {abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && <>
        <p style={{ margin: '6px 0 8px', fontSize: '12px', color: '#667085' }}>Cada vez que se contrata a alguien, agrégalo aquí. Imprime en terreno el documento de difusión, haz que el trabajador lo firme, escanéalo y súbelo dentro de cada ítem, marcando con un click a los trabajadores que firmaron ese documento (un mismo archivo puede cubrir a varios; ítems {rt.its.map(i => i.numero).join(' · ')}).</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div style={{ flex: '2 1 200px' }}><label style={label}>Nombre completo</label><input value={nom} onChange={e => setNom(e.target.value)} style={input} /></div>
          <div style={{ flex: '1 1 140px' }}><label style={label}>RUT</label><input value={rut} maxLength={12} onChange={e => setRut(formatearRut(e.target.value))} placeholder="12.345.678-9" style={input} /></div>
          <div style={{ flex: '1 1 130px' }}><label style={label}>Fecha de ingreso</label><input type="date" value={ing} max={new Date().toISOString().slice(0, 10)} onChange={e => setIng(e.target.value)} style={input} /></div>
          <div style={{ alignSelf: 'flex-end' }}><button onClick={async () => {
            if (!nom.trim()) { setErr('Escribe el nombre.'); return }
            if (!rutValido(rut)) { setErr('El RUT no es válido.'); return }
            if (await agregar([{ nombre: nom.trim(), rut, fecha_ingreso: ing || null }])) { setNom(''); setRut(''); setIng('') }
          }} style={btn()}>+ Agregar</button></div>
        </div>
        <details style={{ marginBottom: '8px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: AZUL, fontWeight: 600 }}>Agregar varios a la vez</summary>
          <textarea value={pegar} onChange={e => setPegar(e.target.value)} rows={4} placeholder={'Una persona por línea: Nombre; RUT\nJuan Pérez Soto; 12.345.678-5\nMaría Rojas Díaz; 9.876.543-3'} style={{ ...input, resize: 'vertical', marginTop: '6px' }} />
          <button onClick={async () => {
            const lineas = pegar.split('\n').map(l => l.trim()).filter(Boolean)
            const out: { nombre: string, rut: string }[] = []
            for (const l of lineas) { const [n, r] = l.split(/[;\t,]/).map(x => x.trim()); if (!n || !r || !rutValido(r)) { setErr(`Línea inválida: «${l}» (formato: Nombre; RUT)`); return } out.push({ nombre: n, rut: formatearRut(r) }) }
            if (!out.length) { setErr('Pega al menos una línea.'); return }
            if (await agregar(out)) setPegar('')
          }} style={{ ...btn(), marginTop: '6px' }}>Agregar lista</button>
        </details>
        {err && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 8px' }}>{err}</p>}

        {rt.total === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#98a2b3' }}>Aún no hay trabajadores en este contrato.</p> : <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span style={{ fontSize: '12.5px' }}><b>{rt.completos}</b> de <b>{rt.total}</b> con todo el respaldo cargado · <b>{rt.aprobados}</b> aprobados por el Jefe</span>
            <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center', marginLeft: 'auto' }}><input type="checkbox" checked={soloInc} onChange={e => setSoloInc(e.target.checked)} /> Solo incompletos</label>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead><tr style={{ textAlign: 'left', color: '#667085', fontSize: '11px' }}>
                <th style={{ padding: '4px 6px' }}>Trabajador</th>
                {rt.its.map(i => <th key={i.id} title={i.texto} style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Ítem {i.numero}</th>)}
                <th style={{ padding: '4px 6px' }}></th>
              </tr></thead>
              <tbody>{filas.map(f => (
                <tr key={f.t.id} style={{ borderTop: '1px solid #eef1f6' }}>
                  <td style={{ padding: '6px', minWidth: '150px' }}>
                    <span style={{ fontWeight: 600 }}>{f.t.nombre}</span> {f.completo && <span title="Respaldo completo" style={{ color: '#14532d' }}>✅</span>}
                    <br /><span style={{ color: '#98a2b3', fontSize: '11px' }}>{f.t.rut}{f.t.fecha_ingreso ? ` · ingreso ${fcl(f.t.fecha_ingreso)}` : ''}</span>
                  </td>
                  {rt.its.map(i => <td key={i.id} style={{ padding: '6px' }}><CeldaDif docs={docs} t={f.t} it={i} abrirArchivo={abrirArchivo} /></td>)}
                  <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                    <button type="button" title="Dar de baja (ya no se le exige respaldo)" onClick={async () => { if (!confirm(`¿Dar de baja a ${f.t.nombre}? Sus documentos se conservan.`)) return; const { error } = await supabase.from('aud_trabajadores').update({ activo: false }).eq('id', f.t.id); if (error) { setMsg(error.message); return } await recargar() }} style={{ ...btn(false), padding: '2px 8px', fontSize: '11px' }}>Baja</button>
                    {esJefe && <button type="button" title="Eliminar de la nómina (borra también sus documentos)" onClick={async () => { if (!confirm(`¿Eliminar a ${f.t.nombre} y todos sus documentos?`)) return; const { error } = await supabase.from('aud_trabajadores').delete().eq('id', f.t.id); if (error) { setMsg(error.message); return } await recargar() }} style={{ ...btn(false, true), padding: '2px 8px', fontSize: '11px', marginLeft: '4px' }}>🗑</button>}
                  </td>
                </tr>))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#98a2b3' }}>Falta = sin documento · ⏳ cargado, por revisar · ✓ aprobado · ✗ rechazado o vencido.</p>
        </>}
        {bajas.length > 0 && <details style={{ marginTop: '8px' }}><summary style={{ cursor: 'pointer', fontSize: '12px', color: '#667085' }}>Dados de baja ({bajas.length})</summary>
          {bajas.map(t => <p key={t.id} style={{ margin: '4px 0 0', fontSize: '12px' }}>{t.nombre} <span style={{ color: '#98a2b3' }}>{t.rut}</span> <button type="button" onClick={async () => { const { error } = await supabase.from('aud_trabajadores').update({ activo: true }).eq('id', t.id); if (error) { setMsg(error.message); return } await recargar() }} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Reactivar</button></p>)}
        </details>}
      </>}
    </div>
  )
}

// ───────── Formatos de clientes (Jefe) ─────────
function Formatos({ formatos, items, sel, setVista, recargar, wrap }: { formatos: any[], items: AudItem[], sel: string | null, setVista: (v: Vista) => void, recargar: () => Promise<void>, wrap: (c: React.ReactNode, v?: any) => React.ReactNode }) {
  const [nom, setNom] = useState(''); const [cod, setCod] = useState(''); const [punt, setPunt] = useState(false)
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const [nuevo, setNuevo] = useState({ seccion: '', texto: '', orientacion: '', puntaje: '1' })
  const [pegar, setPegar] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [ed, setEd] = useState({ seccion: '', texto: '', orientacion: '', puntaje: '1' })
  const err = (e: any) => setMsg(e?.code === '23505' ? 'Ya existe un formato con ese nombre.' : (e?.message || 'No se pudo guardar'))

  if (!sel) {
    const hayDefault = formatos.some(f => f.codigo?.startsWith('REG-PR-004'))
    return wrap(<>
      <div style={{ ...card, marginBottom: '12px' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Nuevo formato de cliente</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 220px' }}><label style={label}>Nombre (ej. Engie · Checklist contratistas)</label><input value={nom} onChange={e => setNom(e.target.value)} style={input} /></div>
          <div style={{ flex: '1 1 140px' }}><label style={label}>Código del formato</label><input value={cod} onChange={e => setCod(e.target.value)} style={input} /></div>
          <label style={{ fontSize: '12px', display: 'flex', gap: '4px', alignItems: 'center' }}><input type="checkbox" checked={punt} onChange={e => setPunt(e.target.checked)} /> Con puntaje y calificación</label>
          <button disabled={busy} onClick={async () => {
            if (!nom.trim()) { setMsg('Escribe el nombre.'); return }
            const { data, error } = await supabase.from('aud_formatos').insert({ nombre: nom.trim(), codigo: cod.trim() || null, usa_puntaje: punt }).select().maybeSingle()
            if (error || !data) { err(error); return }
            setNom(''); setCod(''); setPunt(false); setMsg(''); await recargar(); setVista({ t: 'formato', id: data.id })
          }} style={btn()}>Crear formato</button>
        </div>
        {!hayDefault && <div style={{ marginTop: '10px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
          <button disabled={busy} onClick={async () => {
            setBusy(true); setMsg('')
            const { data, error } = await supabase.from('aud_formatos').insert({ nombre: 'SQM · Auditoría de Calificación P3', codigo: 'REG-PR-004 v002', descripcion: 'Reglamento de Contratistas y Subcontratistas SQM', usa_puntaje: true }).select().maybeSingle()
            if (error || !data) { setBusy(false); err(error); return }
            const filas = P3_ITEMS.map(i => ({ formato_id: data.id, orden: i.n, seccion: P3_SECCIONES[i.s], numero: String(i.n), texto: i.t, orientacion: i.o, puntaje: i.p, requiere_trabajador: [9, 16, 23, 29, 31].includes(i.n), fuente: i.n === 21 ? 'epp' : i.n === 1 ? 'trabajadores' : i.n === 7 ? 'liderazgo' : i.n === 19 ? 'epp_entrega' : i.n === 9 ? 'miper' : null }))
            const r = await supabase.from('aud_items').insert(filas)
            setBusy(false); if (r.error) { err(r.error); return }
            await recargar()
          }} style={btn(false)}>📥 Cargar formato SQM (REG-PR-004, 56 ítems con puntaje)</button>
          <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#667085' }}>Carga lista la auditoría de calificación de SQM. Los de Engie, Eurohinca y otros se crean arriba y se llenan pegando su lista.</p>
        </div>}
        {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {formatos.map(f => (
          <div key={f.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap', opacity: f.activo ? 1 : 0.6 }}>
            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>{f.nombre}</p><p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{f.codigo ? f.codigo + ' · ' : ''}{items.filter(i => i.formato_id === f.id).length} ítems{f.usa_puntaje ? ' · con puntaje' : ''}{f.activo ? '' : ' · desactivado'}</p></div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setVista({ t: 'formato', id: f.id })} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>Editar ítems</button>
              <button onClick={async () => { const { error } = await supabase.from('aud_formatos').update({ activo: !f.activo }).eq('id', f.id); if (error) { err(error); return } await recargar() }} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>{f.activo ? 'Desactivar' : 'Reactivar'}</button>
            </div>
          </div>
        ))}
        {formatos.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay formatos.</p>}
      </div>
    </>, { txt: 'Volver', f: () => setVista({ t: 'lista' }) })
  }

  const f = formatos.find(x => x.id === sel)
  const its = items.filter(i => i.formato_id === sel)
  if (!f) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Formato no encontrado.</p>, { txt: 'Volver', f: () => setVista({ t: 'formatos' }) })
  const sigOrden = (its.reduce((m, i) => Math.max(m, i.orden), 0)) + 1
  const secs = Array.from(new Set(its.map(i => i.seccion)))
  const agregar = async () => {
    if (!nuevo.texto.trim()) { setMsg('Escribe el ítem.'); return }
    const { error } = await supabase.from('aud_items').insert({ formato_id: sel, orden: sigOrden, seccion: nuevo.seccion.trim() || 'General', numero: String(its.length + 1), texto: nuevo.texto.trim(), orientacion: nuevo.orientacion.trim() || null, puntaje: Number(nuevo.puntaje) || 1 })
    if (error) { err(error); return }
    setNuevo({ ...nuevo, texto: '', orientacion: '' }); setMsg(''); await recargar()
  }
  const importar = async () => {
    // Una línea por ítem. Las líneas que empiezan con # son títulos de sección. Opcional: «texto | puntaje».
    let seccion = nuevo.seccion.trim() || 'General', orden = sigOrden, num = its.length
    const filas: any[] = []
    for (const lineaRaw of pegar.split('\n')) {
      const linea = lineaRaw.trim(); if (!linea) continue
      if (linea.startsWith('#')) { seccion = linea.replace(/^#+\s*/, ''); continue }
      const [t, p] = linea.split('|').map(x => x.trim())
      num++; filas.push({ formato_id: sel, orden: orden++, seccion, numero: String(num), texto: t, puntaje: Number(p) || 1 })
    }
    if (!filas.length) { setMsg('Pega al menos una línea.'); return }
    const { error } = await supabase.from('aud_items').insert(filas)
    if (error) { err(error); return }
    setPegar(''); setMsg(`${filas.length} ítems agregados ✓`); await recargar()
  }
  return wrap(<>
    <div style={{ ...card, marginBottom: '12px' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>{f.nombre}{f.codigo ? <span style={{ fontWeight: 400, color: '#667085' }}> · {f.codigo}</span> : null}</p>
      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{its.length} ítems en {secs.length} sección(es){f.usa_puntaje ? ' · con puntaje y calificación' : ' · sin puntaje (todos pesan igual)'}. Los cambios aplican a todos los contratos que usan este formato.</p>
    </div>
    <div style={{ ...card, marginBottom: '12px' }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px' }}>Agregar ítem</p>
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <input list="secs" value={nuevo.seccion} onChange={e => setNuevo({ ...nuevo, seccion: e.target.value })} placeholder="Sección (ej. Documentación legal)" style={{ ...input, flex: '2 1 200px', width: 'auto' }} />
          <datalist id="secs">{secs.map(s => <option key={s} value={s} />)}</datalist>
          {f.usa_puntaje && <input value={nuevo.puntaje} onChange={e => setNuevo({ ...nuevo, puntaje: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Puntaje" style={{ ...input, flex: '0 1 90px', width: 'auto' }} />}
        </div>
        <textarea value={nuevo.texto} onChange={e => setNuevo({ ...nuevo, texto: e.target.value })} rows={2} placeholder="Texto del ítem / requisito" style={{ ...input, resize: 'vertical' }} />
        <textarea value={nuevo.orientacion} onChange={e => setNuevo({ ...nuevo, orientacion: e.target.value })} rows={2} placeholder="Orientación para el cumplimiento (opcional)" style={{ ...input, resize: 'vertical' }} />
        <div><button onClick={agregar} style={btn()}>+ Agregar</button></div>
      </div>
      <details style={{ marginTop: '10px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: AZUL, fontWeight: 600 }}>Pegar una lista completa (desde Excel o Word)</summary>
        <p style={{ margin: '6px 0', fontSize: '11.5px', color: '#667085' }}>Una línea por ítem. Una línea que empiece con # es el título de una sección{f.usa_puntaje ? '. Para dar puntaje escribe «texto | 10»' : ''}. Se agregan al final de los existentes.</p>
        <textarea value={pegar} onChange={e => setPegar(e.target.value)} rows={7} placeholder={'# Documentación legal\nContrato de trabajo firmado\nRegistro de entrega de EPP\n# Capacitación\nIRL de cada trabajador'} style={{ ...input, resize: 'vertical' }} />
        <button onClick={importar} style={{ ...btn(), marginTop: '6px' }}>Importar lista</button>
      </details>
      {msg && <p style={{ fontSize: '12.5px', color: msg.endsWith('✓') ? '#1e8e4e' : '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
    </div>
    {secs.map(s => (
      <div key={s} style={{ ...card, marginBottom: '8px' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>{s}</p>
        {its.filter(i => i.seccion === s).map(i => editId === i.id ? (
          <div key={i.id} style={{ borderTop: '1px solid #eef1f6', padding: '8px 0', display: 'grid', gap: '6px' }}>
            <input value={ed.seccion} onChange={e => setEd({ ...ed, seccion: e.target.value })} style={input} />
            <textarea value={ed.texto} onChange={e => setEd({ ...ed, texto: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} />
            <textarea value={ed.orientacion} onChange={e => setEd({ ...ed, orientacion: e.target.value })} rows={2} placeholder="Orientación" style={{ ...input, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              {f.usa_puntaje && <input value={ed.puntaje} onChange={e => setEd({ ...ed, puntaje: e.target.value.replace(/[^0-9.]/g, '') })} style={{ ...input, width: '90px' }} />}
              <button onClick={async () => { const { error } = await supabase.from('aud_items').update({ seccion: ed.seccion.trim() || 'General', texto: ed.texto.trim(), orientacion: ed.orientacion.trim() || null, puntaje: Number(ed.puntaje) || 1 }).eq('id', i.id); if (error) { err(error); return } setEditId(null); await recargar() }} style={btn()}>Guardar</button>
              <button onClick={() => setEditId(null)} style={btn(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div key={i.id} style={{ borderTop: '1px solid #eef1f6', padding: '7px 0', display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, fontSize: '12.5px', whiteSpace: 'pre-line', flex: 1 }}><b>{i.numero}.</b> {i.texto}{f.usa_puntaje ? <span style={{ color: '#98a2b3' }}> ({i.puntaje} pts)</span> : null}</p>
            <span style={{ display: 'flex', gap: '4px' }}>
              <button onClick={async () => { const { error } = await supabase.from('aud_items').update({ requiere_trabajador: !i.requiere_trabajador }).eq('id', i.id); if (error) { err(error); return } await recargar() }} title="Pide un documento firmado por cada trabajador" style={{ ...btn(false), padding: '3px 9px', fontSize: '11.5px', background: i.requiere_trabajador ? '#e8f0fe' : '#fff' }}>{i.requiere_trabajador ? '👷 Por trabajador' : '👷'}</button>
              <button onClick={() => { setEditId(i.id); setEd({ seccion: i.seccion, texto: i.texto, orientacion: i.orientacion || '', puntaje: String(i.puntaje) }) }} style={{ ...btn(false), padding: '3px 9px', fontSize: '11.5px' }}>Editar</button>
              <button onClick={async () => { if (!confirm('¿Quitar este ítem? Se pierden las respuestas y documentos asociados a él en todos los contratos.')) return; const { error } = await supabase.from('aud_items').delete().eq('id', i.id); if (error) { err(error); return } await recargar() }} style={{ ...btn(false, true), padding: '3px 9px', fontSize: '11.5px' }}>Quitar</button>
            </span>
          </div>
        ))}
      </div>
    ))}
  </>, { txt: 'Volver a formatos', f: () => setVista({ t: 'formatos' }) })
}

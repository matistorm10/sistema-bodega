'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { fechaCL } from '@/lib/prevencion'
import { etiquetaContrato } from '@/lib/contratos'
import { estadoPlan, COLOR_PLAN, hoyISO } from '@/lib/estadoPlan'
import { P3_ITEMS, P3_SECCIONES, P3_TOTAL_PUNTOS, resultadoP3, COLOR_CAL, DESC_CAL } from '@/lib/p3'
import { DatosP3, p3Nuevo, generarAuditoriaP3 } from '@/lib/generarAuditoriaP3'
import { abrirVentanaPDF } from '@/lib/abrirPDF'

const sumaMeses = (f: string, n: number) => { const [y, m, d] = f.split('-').map(Number); const t = new Date(y, m - 1 + n, d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const fcl = (f: string) => f.split('-').reverse().join('-')
const dif = (a: string, b: string) => Math.round((new Date(a + 'T00:00').getTime() - new Date(b + 'T00:00').getTime()) / 86400000)

const RESP = [{ v: 'SI', col: '#1e8e4e' }, { v: 'NO', col: '#c0392b' }, { v: 'NA', col: '#667085' }]

export default function AuditoriaP3() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const verTodos = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const puede = verTodos || !!usuario?.esPrevencionista
  const [lista, setLista] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [edit, setEdit] = useState<{ id?: string, fecha: string, contrato_id: string, estado: string, d: DatosP3 } | null>(null)
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abierta, setAbierta] = useState<Record<number, boolean>>({})
  const [orient, setOrient] = useState<Record<number, boolean>>({})
  const [comentRev, setComentRev] = useState('')
  const [subiendo, setSubiendo] = useState('')

  const cargar = useCallback(async () => {
    const [l, ct, cl, us] = await Promise.all([
      supabase.from('pr_auditorias_p3').select('*').order('fecha', { ascending: false }),
      supabase.from('pr_contratos').select('*').eq('activo', true).order('nombre'),
      supabase.from('pr_clientes_informe').select('id,nombre'),
      supabase.from('usuarios').select('id,nombre'),
    ])
    setLista(l.data || []); setContratos(ct.data || []); setClientes(cl.data || []); setUsuarios(us.data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const nombreDe = (id: string) => usuarios.find(u => u.id === id)?.nombre || '—'
  const mias = lista.filter(r => r.creado_por === usuario?.id)

  const nuevo = () => {
    const prev = mias[0]?.datos as DatosP3 | undefined // se reutilizan los datos de la empresa y del contrato de la auditoría anterior
    const d = p3Nuevo()
    if (prev) { d.ident = { ...prev.ident }; d.cont = { ...prev.cont } }
    d.ident.nomApr = d.ident.nomApr || usuario?.nombre || ''; d.ident.mailApr = d.ident.mailApr || usuario?.email || ''
    setComentRev(''); setMsg(''); setAbierta({ 0: true }); setEdit({ fecha: hoyISO(), contrato_id: mias[0]?.contrato_id || '', estado: 'borrador', d })
  }
  const abrir = (r: any) => { setComentRev(''); setMsg(''); setAbierta({}); setEdit({ id: r.id, fecha: r.fecha, contrato_id: r.contrato_id || '', estado: r.estado, d: { ...p3Nuevo(), ...r.datos } }) }

  const subirEvidencia = async (f: File) => {
    if (!usuario) throw new Error('Sin sesión')
    if (f.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB')
    const path = `evidencias/${usuario.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
    if (error) throw error
    return { path, nombre: f.name }
  }

  const guardar = async (cerrar: boolean) => {
    if (!usuario || !edit) return
    const { d } = edit
    const res = resultadoP3(d.resp)
    if (cerrar) {
      if (!edit.contrato_id) { setMsg('Elige el contrato.'); return }
      if (!d.ident.rutEmp?.trim() || !d.ident.razon?.trim()) { setMsg('Completa RUT y razón social de la empresa evaluada.'); return }
      if (res.sinResp > 0) { setMsg(`Faltan ${res.sinResp} ítem(s) por responder (SI / NO / NA).`); return }
      const faltaPlan = P3_ITEMS.find(x => d.resp[x.n]?.r === 'NO' && (() => { const p = d.plan[x.n] || {}; return !p.accion?.trim() || !p.responsable?.trim() || (p.status !== 'Ejecutado' && !p.fecha) || (p.status === 'Ejecutado' && !p.evidencia) })())
      if (faltaPlan) { setMsg(`Ítem ${faltaPlan.n} (NO): completa el plan de acción (acción, responsable y fecha; si está Ejecutado, adjunta el respaldo).`); return }
      if (!confirm('Al cerrar, la auditoría se envía al Jefe para su aprobación y ya no podrás editarla (salvo que la rechace). ¿Enviarla?')) return
    }
    setGuardando(true); setMsg('')
    const cuerpo: any = { fecha: edit.fecha, contrato_id: edit.contrato_id || null, datos: d, resultado_pct: Number(res.pct.toFixed(2)), calificacion: res.cal }
    if (cerrar) { cuerpo.estado = 'cerrado'; cuerpo.cerrado_at = new Date().toISOString() }
    const { data, error } = edit.id
      ? await supabase.from('pr_auditorias_p3').update(cuerpo).eq('id', edit.id).select().maybeSingle()
      : await supabase.from('pr_auditorias_p3').insert({ ...cuerpo, creado_por: usuario.id }).select().maybeSingle()
    setGuardando(false)
    if (error) { setMsg('No se pudo guardar: ' + error.message); return }
    if (cerrar) { setEdit(null) } else { setEdit({ ...edit, id: data?.id }); setMsg('Borrador guardado ✓') }
    await cargar()
  }
  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este borrador?')) return
    const { error } = await supabase.from('pr_auditorias_p3').delete().eq('id', id)
    if (error) { alert(error.message); return }
    if (edit?.id === id) setEdit(null)
    await cargar()
  }
  const revisar = async (revision: 'aprobado' | 'rechazado') => {
    if (!edit?.id) return
    if (revision === 'rechazado' && !comentRev.trim()) { setMsg('Escribe el motivo del rechazo para que el APR sepa qué corregir.'); return }
    if (revision === 'aprobado' && !confirm('¿Aprobar esta auditoría? Quedará registrada como aprobada.')) return
    const { error } = await supabase.rpc('revisar_auditoria_p3', { p_id: edit.id, p_revision: revision, p_comentario: comentRev.trim() || null })
    if (error) { setMsg('No se pudo registrar: ' + error.message); return }
    setComentRev(''); setMsg(''); setEdit(null); await cargar()
  }
  const pdf = async (r: { fecha: string, contrato_id: string | null, datos: DatosP3, cerrado_at?: string | null, creado_por: string }) => {
    const v = abrirVentanaPDF()
    try {
      const fi = await supabase.from('firmas_usuario').select('imagen,consentimiento_at').eq('usuario_id', r.creado_por).maybeSingle()
      const ct = contratos.find(c => c.id === r.contrato_id)
      await generarAuditoriaP3({ fecha: r.fecha, contrato: ct ? etiquetaContrato(ct, clientes) : '', d: { ...p3Nuevo(), ...r.datos }, aprNombre: nombreDe(r.creado_por), cerradoAt: r.cerrado_at, firma: r.cerrado_at && fi.data?.consentimiento_at ? fi.data.imagen : null }, v)
    } catch (e: any) { v?.close(); alert('No se pudo generar el PDF: ' + (e?.message || e)) }
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/prevencionista/sso" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← SSO Faena</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Auditoría Mandante</h1>
    </div>
  )
  const wrap = (c: React.ReactNode) => <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>{cab}{c}</div></main>
  if (cargandoUsuario) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)
  if (!puede) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p>)
  if (cargando) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)

  // ───────── Edición ─────────
  if (edit) {
    const { d } = edit
    const reg = edit.id ? lista.find(x => x.id === edit.id) : null
    const soyAutor = !reg || reg.creado_por === usuario?.id
    const rechazado = !!reg && reg.estado === 'cerrado' && reg.revision === 'rechazado'
    const ro = !soyAutor || (edit.estado === 'cerrado' && !rechazado)
    const revisor = verTodos && !soyAutor && !!reg && reg.estado === 'cerrado'
    const res = resultadoP3(d.resp)
    const nCont = P3_ITEMS.length - res.sinResp
    const setD = (p: Partial<DatosP3>) => setEdit({ ...edit, d: { ...d, ...p } })
    const setI = (k: string, v: string) => setD({ ident: { ...d.ident, [k]: v } })
    const setC = (k: string, v: string) => setD({ cont: { ...d.cont, [k]: v } })
    const setR = (n: number, p: { r?: string, obs?: string }) => setD({ resp: { ...d.resp, [n]: { ...d.resp[n], ...p } } })
    const setP = (n: number, p: Record<string, string>) => setD({ plan: { ...d.plan, [n]: { ...d.plan[n], ...p } } })
    const T = (k: string, t: string, ancho?: string) => <div style={{ flex: `1 1 ${ancho || '200px'}` }}><label style={label}>{t}</label><input value={d.ident[k] || ''} onChange={e => setI(k, e.target.value)} style={input} /></div>
    const TC = (k: string, t: string, tipo = 'text') => <div style={{ flex: '1 1 200px' }}><label style={label}>{t}</label><input type={tipo} value={d.cont[k] || ''} onChange={e => setC(k, e.target.value)} style={input} /></div>
    const noItems = P3_ITEMS.filter(x => d.resp[x.n]?.r === 'NO')
    const [cbg, cfg] = COLOR_CAL[res.cal]

    return wrap(<>
      {reg && reg.estado === 'cerrado' && (
        <div style={{ ...card, marginBottom: '12px', borderColor: reg.revision === 'aprobado' ? '#9bd3b0' : reg.revision === 'rechazado' ? '#f3b4b4' : '#c9b8ee', background: reg.revision === 'aprobado' ? '#f1faf4' : reg.revision === 'rechazado' ? '#fff5f5' : '#f7f3fe' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px' }}>
            {reg.revision === 'aprobado' ? `✅ Aprobada por ${nombreDe(reg.revisado_por)}` : reg.revision === 'rechazado' ? '↩ Rechazada: corrígela y vuelve a enviarla' : '⏳ Enviada al Jefe: esperando aprobación'}
            {reg.revisado_at && reg.revision !== 'pendiente' ? <span style={{ fontWeight: 400, color: '#667085' }}> · {new Date(reg.revisado_at).toLocaleDateString('es-CL')}</span> : null}
          </p>
          {reg.revision_comentario && <p style={{ margin: '6px 0 0', fontSize: '13px' }}>💬 {reg.revision_comentario}</p>}
          {revisor && reg.revision === 'pendiente' && (
            <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>Solo puedes aprobar o rechazar; el contenido lo modifica únicamente el APR.</p>
              <textarea value={comentRev} onChange={e => setComentRev(e.target.value)} rows={2} placeholder="Comentario (obligatorio si rechazas)" style={{ ...input, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => revisar('aprobado')} style={btn()}>✓ Aprobar</button>
                <button type="button" onClick={() => revisar('rechazado')} style={btn(false, true)}>✗ Rechazar</button>
              </div>
              {msg && <p style={{ margin: 0, fontSize: '12.5px', color: '#c5221f' }}>{msg}</p>}
            </div>
          )}
        </div>
      )}

      <fieldset disabled={ro} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
        <div style={card}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Identificación de la empresa evaluada</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>{T('rutEmp', 'RUT *')}{T('razon', 'Razón social *')}{T('fantasia', 'Nombre de fantasía')}</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>{T('rutAdm', 'RUT administrador')}{T('nomAdm', 'Nombre y apellidos')}{T('mailAdm', 'Correo electrónico')}</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>{T('rutApr', 'RUT APR')}{T('nomApr', 'Nombre y apellidos APR')}{T('mailApr', 'Correo electrónico APR')}</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{T('telEmp', 'Teléfonos empresa')}{T('dirEmp', 'Dirección empresa')}{T('mailEmp', 'Correo electrónico empresa')}</div>
        </div>
        <div style={card}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Antecedentes del contrato</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div style={{ flex: '2 1 280px' }}><label style={label}>Contrato *</label>
              <select value={edit.contrato_id} onChange={e => setEdit({ ...edit, contrato_id: e.target.value })} style={input}><option value="">— elegir —</option>{contratos.map(c => <option key={c.id} value={c.id}>{etiquetaContrato(c, clientes)}</option>)}</select></div>
            <div style={{ flex: '1 1 150px' }}><label style={label}>Fecha de la auditoría</label><input type="date" max={hoyISO()} value={edit.fecha} onChange={e => setEdit({ ...edit, fecha: e.target.value })} style={input} /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>{TC('dotacion', 'Dotación actual en faena')}{TC('ini', 'Fecha inicio contrato', 'date')}{TC('fin', 'Fecha término contrato', 'date')}</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>{TC('vp', 'Vicepresidencia')}{TC('ger', 'Gerencia')}{TC('sup', 'Superintendencia')}</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{TC('contacto', 'Contacto contratos SQM')}{TC('ito', 'ITO SQM')}{TC('aprSqm', 'APR SQM')}</div>
        </div>

        <div style={{ ...card, position: 'sticky', top: 0, zIndex: 5, display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>Avance: {nCont}/{P3_ITEMS.length} ítems</span>
          <span style={{ fontSize: '12.5px' }}>Cumplimiento actual: <strong>{res.pct.toFixed(1)}%</strong> <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: cbg, color: cfg }}>{res.cal}</span></span>
        </div>

        {P3_SECCIONES.map((sec, si) => {
          const its = P3_ITEMS.filter(x => x.s === si)
          const resp = its.filter(x => d.resp[x.n]?.r).length
          const abre = abierta[si] ?? false
          return (
            <div key={si} style={card}>
              <button type="button" onClick={() => setAbierta({ ...abierta, [si]: !abre })} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', fontFamily: 'inherit' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>{sec}</span>
                <span style={{ fontSize: '11.5px', color: resp === its.length ? '#14532d' : '#667085', whiteSpace: 'nowrap' }}>{resp === its.length ? '✓ ' : ''}{resp}/{its.length} {abre ? '▲' : '▼'}</span>
              </button>
              {abre && its.map(it => {
                const r = d.resp[it.n]?.r
                return (
                  <div key={it.n} style={{ borderTop: '1px solid #eef1f6', marginTop: '10px', paddingTop: '10px' }}>
                    <p style={{ margin: '0 0 6px', fontSize: '13px', whiteSpace: 'pre-line' }}><strong>{it.n}.</strong> {it.t} <span style={{ color: '#98a2b3', fontSize: '11.5px' }}>({it.p} pts)</span></p>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {RESP.map(o => <button key={o.v} type="button" disabled={ro} onClick={() => setR(it.n, { r: r === o.v ? '' : o.v })} style={{ padding: '6px 16px', borderRadius: '8px', border: `1.5px solid ${o.col}`, background: r === o.v ? o.col : '#fff', color: r === o.v ? '#fff' : o.col, fontWeight: 700, fontSize: '12.5px', cursor: ro ? 'default' : 'pointer' }}>{o.v}</button>)}
                      <button type="button" onClick={() => setOrient({ ...orient, [it.n]: !orient[it.n] })} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>{orient[it.n] ? 'Ocultar' : 'Ver'} orientación para el cumplimiento</button>
                    </div>
                    {orient[it.n] && <p style={{ margin: '0 0 6px', fontSize: '12px', background: '#f4f8fd', border: '1px solid #cfe0f5', borderRadius: '8px', padding: '8px 10px', whiteSpace: 'pre-line', color: '#344054' }}>{it.o}</p>}
                    <input value={d.resp[it.n]?.obs || ''} onChange={e => setR(it.n, { obs: e.target.value })} placeholder="Observaciones" style={input} />
                  </div>
                )
              })}
            </div>
          )
        })}

        <div style={{ ...card, background: cbg + '55' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '14px' }}>Resultado de la auditoría</p>
          <p style={{ margin: '0 0 4px', fontSize: '13px' }}>SI: <b>{P3_ITEMS.filter(x => d.resp[x.n]?.r === 'SI').length}</b> · NO: <b>{noItems.length}</b> · NA: <b>{P3_ITEMS.filter(x => d.resp[x.n]?.r === 'NA').length}</b> · Puntos {res.obt} de {P3_TOTAL_PUNTOS - res.na} (NA descontados)</p>
          <p style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: cfg }}>{res.pct.toFixed(1)}% · {res.cal}</p>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#344054' }}>{DESC_CAL[res.cal].desc}<br /><b>Acciones:</b> {DESC_CAL[res.cal].acc}</p>
          <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#667085' }}>Preferente 95–100% · Condicional 80–94% · Restringido 0–79%. La calificación es de la empresa (corporativa) y se mantiene hasta la próxima evaluación, entre 3 y 4 meses después.</p>
        </div>

        <div style={card}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '14px' }}>Plan de acción {noItems.length ? `(${noItems.length} ítem${noItems.length === 1 ? '' : 's'} con NO)` : ''}</p>
          {noItems.length === 0 && <p style={{ margin: 0, fontSize: '12.5px', color: '#667085' }}>Aquí aparecerá un recuadro por cada ítem que marques como NO, para definir la acción, el responsable y la fecha.</p>}
          {noItems.map(it => {
            const p = d.plan[it.n] || {}
            const e = estadoPlan(p.status, p.fecha)
            return (
              <div key={it.n} style={{ background: '#fff5f5', borderRadius: '10px', padding: '10px', marginTop: '8px', display: 'grid', gap: '6px' }}>
                <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#9b1c1c' }}>Ítem {it.n} · {it.t.split('\n')[0].slice(0, 140)}{it.t.length > 140 ? '…' : ''}</p>
                <input value={p.accion || ''} onChange={ev => setP(it.n, { accion: ev.target.value })} placeholder="Acción de mejoramiento propuesta *" style={input} />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={p.responsable || ''} onChange={ev => setP(it.n, { responsable: ev.target.value })} placeholder="Responsable *" style={{ ...input, flex: '1 1 150px', width: 'auto' }} />
                  {p.status !== 'Ejecutado' && <input type="date" min={hoyISO()} value={p.fecha || ''} onChange={ev => setP(it.n, { fecha: ev.target.value && ev.target.value < hoyISO() ? hoyISO() : ev.target.value })} title="Fecha de cumplimiento (desde hoy)" style={{ ...input, flex: '1 1 140px', width: 'auto' }} />}
                  <select value={p.status === 'Ejecutado' ? 'Ejecutado' : 'En ejecución'} onChange={ev => setP(it.n, { status: ev.target.value })} style={{ ...input, flex: '1 1 120px', width: 'auto' }}><option>En ejecución</option><option>Ejecutado</option></select>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: COLOR_PLAN[e][0], color: COLOR_PLAN[e][1] }}>{e}</span>
                </div>
                {p.status === 'Ejecutado' && (
                  <div style={{ background: '#f4f8fd', border: '1px dashed #9db8e0', borderRadius: '8px', padding: '6px 10px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 700, color: AZUL }}>📎 Respaldo de lo ejecutado *</span>{' '}
                    {p.evidenciaNombre ? <span style={{ color: '#14532d', fontWeight: 600 }}>{p.evidenciaNombre} ✓ </span> : <span style={{ color: '#9b1c1c' }}>obligatorio (foto o PDF). </span>}
                    <input type="file" accept="image/*,application/pdf" disabled={subiendo === String(it.n)} onChange={async ev => {
                      const f = ev.target.files?.[0]; if (!f) return
                      setSubiendo(String(it.n))
                      try { const r = await subirEvidencia(f); setP(it.n, { evidencia: r.path, evidenciaNombre: r.nombre }) } catch (x: any) { setMsg('No se pudo subir: ' + (x?.message || x)) }
                      setSubiendo('')
                    }} style={{ fontSize: '12px' }} />
                  </div>)}
              </div>
            )
          })}
        </div>

        <div style={card}>
          <label style={label}>Notas / observaciones</label>
          <textarea value={d.notas} onChange={e => setD({ notas: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} />
          <p style={{ margin: '12px 0 6px', fontWeight: 700, fontSize: '13px' }}>Revisión / aprobación (nombre y cargo de los participantes)</p>
          <div style={{ display: 'grid', gap: '8px' }}>
            {([['auditor', 'Auditor Gestión de Riesgos SQM'], ['rep', 'Representante Empresa Ctta.'], ['ito', 'Toma conocimiento ITO SQM']] as const).map(([k, t]) => (
              <div key={k} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 220px' }}><label style={label}>{t}</label><input value={d.part[k]?.nombre || ''} onChange={e => setD({ part: { ...d.part, [k]: { ...d.part[k], nombre: e.target.value } } })} placeholder="Nombre / Cargo" style={input} /></div>
                <div style={{ flex: '1 1 140px' }}><label style={label}>Fecha</label><input type="date" value={d.part[k]?.fecha || ''} onChange={e => setD({ part: { ...d.part, [k]: { ...d.part[k], fecha: e.target.value } } })} style={input} /></div>
              </div>))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#667085' }}>Tu firma de APR se agrega sola al cerrar. Las firmas de SQM y del representante de la empresa se estampan en el PDF impreso.</p>
        </div>
      </fieldset>

      {msg && !revisor && <p style={{ fontSize: '12.5px', color: msg.endsWith('✓') ? '#1e8e4e' : '#c5221f', margin: '12px 0 0' }}>{msg}</p>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        {!ro && edit.estado !== 'cerrado' && <button type="button" onClick={() => guardar(false)} disabled={guardando} style={btn(false)}>Guardar borrador</button>}
        {!ro && <button type="button" onClick={() => guardar(true)} disabled={guardando} style={btn()}>{rechazado ? 'Corregir y reenviar al Jefe' : 'Cerrar y enviar al Jefe'}</button>}
        {edit.id && reg && <button type="button" onClick={() => pdf({ fecha: edit.fecha, contrato_id: edit.contrato_id, datos: d, cerrado_at: reg.cerrado_at, creado_por: reg.creado_por })} style={btn(false)}>📄 Ver PDF</button>}
        <button type="button" onClick={() => { setEdit(null); setMsg('') }} style={btn(false)}>Volver</button>
      </div>
    </>)
  }

  // ───────── Lista ─────────
  const ultima = mias.find(r => r.estado === 'cerrado')
  let aviso: React.ReactNode = null
  if (ultima && usuario?.esPrevencionista) {
    const desde = sumaMeses(ultima.fecha, 3), hasta = sumaMeses(ultima.fecha, 4), hoy = hoyISO()
    const [bg, fg, txt] = hoy < desde ? ['#e8f0fe', AZUL, `Próxima auditoría: entre el ${fcl(desde)} y el ${fcl(hasta)} (faltan ${dif(desde, hoy)} días para que se abra la ventana).`]
      : hoy <= hasta ? ['#fef7e0', '#986a00', `⏰ Toca realizar la nueva auditoría: la ventana cierra el ${fcl(hasta)} (${dif(hasta, hoy)} días).`]
      : ['#fde8e8', '#9b1c1c', `⚠️ La nueva auditoría está atrasada: debía hacerse antes del ${fcl(hasta)}.`]
    aviso = <div style={{ ...card, background: bg, borderColor: fg + '55', color: fg, fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>{txt}<span style={{ display: 'block', fontWeight: 400, fontSize: '11.5px', marginTop: '2px' }}>Regla SQM: la evaluación se repite a no menos de 3 ni más de 4 meses de la anterior (última: {fcl(ultima.fecha)}).</span></div>
  }
  return wrap(<>
    <div style={{ ...card, marginBottom: '12px' }}>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#667085' }}>{verTodos ? 'Aprueba o rechaza con comentarios las auditorías mandante que envían los APR. Solo su autor las modifica.' : 'Auditoría del mandante (REG-PR-004, SQM): responde los 56 ítems, el sistema calcula el % y la calificación, y genera el plan de acción de lo que no cumple. Al cerrarla se envía al Jefe para su aprobación.'}</p>
      {!!usuario?.esPrevencionista && <button onClick={nuevo} style={btn()}>+ Nueva auditoría mandante</button>}
    </div>
    {aviso}
    {verTodos && lista.some(r => r.estado === 'cerrado' && r.revision === 'pendiente') && (
      <div style={{ ...card, background: '#f7f3fe', borderColor: '#c9b8ee', marginBottom: '10px' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px', color: '#5b3aa6' }}>⏳ Por aprobar ({lista.filter(r => r.estado === 'cerrado' && r.revision === 'pendiente').length})</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{lista.filter(r => r.estado === 'cerrado' && r.revision === 'pendiente').map(r => <button key={r.id} onClick={() => abrir(r)} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>{fechaCL(r.fecha)} · {nombreDe(r.creado_por)}</button>)}</div>
      </div>
    )}
    {lista.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay auditorías.</p>}
    <div style={{ display: 'grid', gap: '8px' }}>
      {lista.map(r => {
        const ct = contratos.find(c => c.id === r.contrato_id)
        const cal = r.calificacion as keyof typeof COLOR_CAL | null
        return (
          <div key={r.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: '14px' }}>{fechaCL(r.fecha)}{ct ? ` · ${etiquetaContrato(ct, clientes)}` : ''}{verTodos ? <span style={{ fontWeight: 400, color: '#667085' }}> · {nombreDe(r.creado_por)}</span> : null}</p>
              <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', fontWeight: 600, marginRight: '6px', ...(r.estado !== 'cerrado' ? { background: '#fef7e0', color: '#986a00' } : r.revision === 'aprobado' ? { background: '#d7efe0', color: '#14532d' } : r.revision === 'rechazado' ? { background: '#fde8e8', color: '#9b1c1c' } : { background: '#efe7fd', color: '#5b3aa6' }) }}>{r.estado !== 'cerrado' ? 'Borrador' : r.revision === 'aprobado' ? 'Aprobada' : r.revision === 'rechazado' ? 'Rechazada · corregir' : verTodos ? 'Por aprobar' : 'Enviada al Jefe'}</span>
              {cal && COLOR_CAL[cal] && <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', fontWeight: 700, background: COLOR_CAL[cal][0], color: COLOR_CAL[cal][1] }}>{Number(r.resultado_pct).toFixed(1)}% · {cal}</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => abrir(r)} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>{r.estado === 'cerrado' ? (verTodos && r.revision === 'pendiente' ? 'Revisar' : r.revision === 'rechazado' && r.creado_por === usuario?.id ? 'Corregir' : 'Ver') : r.creado_por === usuario?.id ? 'Continuar' : 'Ver'}</button>
              <button onClick={() => pdf(r)} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>PDF</button>
              {r.estado === 'borrador' && r.creado_por === usuario?.id && <button onClick={() => eliminar(r.id)} style={{ ...btn(false, true), padding: '6px 12px', fontSize: '12.5px' }}>Eliminar</button>}
            </div>
          </div>
        )
      })}
    </div>
  </>)
}

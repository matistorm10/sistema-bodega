import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Conexión con la API de Kame (solo administradores).
// Las credenciales viven únicamente en variables de entorno del servidor: KAME_CLIENT_ID y KAME_CLIENT_SECRET.
const BASE = 'https://api.kameone.cl'
let cache: { token: string, vence: number } | null = null

async function obtenerToken(): Promise<string> {
  if (cache && cache.vence > Date.now() + 60_000) return cache.token
  const id = process.env.KAME_CLIENT_ID, secret = process.env.KAME_CLIENT_SECRET
  if (!id || !secret) throw new Error('Faltan las variables KAME_CLIENT_ID y KAME_CLIENT_SECRET en Vercel.')
  const r = await fetch(`${BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret, audience: `${BASE}/api`, grant_type: 'client_credentials' }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error(`Kame no entregó token (HTTP ${r.status}): ${j.error_description || j.error || JSON.stringify(j).slice(0, 200)}`)
  cache = { token: j.access_token, vence: Date.now() + (j.expires_in || 3600) * 1000 }
  return cache.token
}

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!jwt) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    const { data: { user }, error: eAuth } = await supabaseAdmin.auth.getUser(jwt)
    if (eAuth || !user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })
    const { data: perfil } = await supabaseAdmin.from('usuarios').select('rol').eq('auth_id', user.id).single()
    if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores.' }, { status: 403 })

    const b = await req.json()
    if (b.accion === 'token') {
      const t = await obtenerToken()
      return NextResponse.json({ ok: true, mensaje: `Token obtenido correctamente (${t.length} caracteres).` })
    }
    if (b.accion === 'llamar') {
      const ruta = String(b.ruta || '')
      if (!ruta.startsWith('/') || ruta.includes('..') || ruta.includes('//')) return NextResponse.json({ error: 'Ruta inválida (debe empezar con /).' }, { status: 400 })
      const metodo = b.metodo === 'POST' ? 'POST' : 'GET'
      const qs = b.query ? '?' + new URLSearchParams(b.query as Record<string, string>).toString() : ''
      const t = await obtenerToken()
      const r = await fetch(`${BASE}${ruta}${qs}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: metodo === 'POST' ? JSON.stringify(b.cuerpo || {}) : undefined,
      })
      const texto = await r.text()
      return NextResponse.json({ ok: r.ok, status: r.status, tipo: r.headers.get('content-type'), largo: texto.length, respuesta: texto.slice(0, 20000) })
    }
    if (b.accion === 'descubrir') {
      const t = await obtenerToken()
      const lim = (x: any, def: string[]) => (Array.isArray(x) && x.length ? x : def).map(String).filter(v => /^[A-Za-z0-9_/]*$/.test(v)).slice(0, 40)
      const prefijos = lim(b.prefijos, ['/api/Contabilidad'])
      const nombres = lim(b.nombres, ['getInformeCompras'])
      const rutas = prefijos.flatMap(p => nombres.map(n => `${p}/${n}`)).slice(0, 160)
      const out: { ruta: string, status: number }[] = []
      for (let i = 0; i < rutas.length; i += 10) {
        const res = await Promise.all(rutas.slice(i, i + 10).map(async ruta => {
          try { const r = await fetch(`${BASE}${ruta}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } }); return { ruta, status: r.status } }
          catch { return { ruta, status: 0 } }
        }))
        out.push(...res)
      }
      return NextResponse.json({ ok: true, probadas: out.length, distintas: out.filter(x => x.status !== 404) })
    }
    if (b.accion === 'resumen_diario') {
      const t = await obtenerToken()
      const d = String(b.desde || '2026-10-01'), h = String(b.hasta || '2026-10-31')
      const r = await fetch(`${BASE}/api/Contabilidad/getLibroDiario?${new URLSearchParams({ fechaDesde: d, fechaHasta: h })}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } })
      const j: any = await r.json().catch(() => null)
      const items: any[] = j?.items || []
      if (!items.length) return NextResponse.json({ ok: false, status: r.status, resumen: 'Sin items. Respuesta: ' + JSON.stringify(j).slice(0, 500) })
      const campos = Object.keys(items[0])
      const claves = campos.filter(c => /unidad|centro|costo|ceco|proyecto|glosa|rut|documento|folio/i.test(c))
      const distintos: Record<string, any> = {}
      claves.forEach(c => { const v = [...new Set(items.map(x => x[c]))]; distintos[c] = { cantidad: v.length, ejemplos: v.slice(0, 8) } })
      const tipos: Record<string, number> = {}; items.forEach(x => { tipos[x.TipoComprobante] = (tipos[x.TipoComprobante] || 0) + 1 })
      const gastos = items.filter(x => /^[5-6]/.test(String(x.Cuenta))).slice(0, 6)
      return NextResponse.json({ ok: true, status: r.status, resumen: JSON.stringify({ totalLineas: items.length, campos, tiposComprobante: tipos, camposClave: distintos, ejemploPrimeraLinea: items[0], ejemplosGasto: gastos }, null, 2) })
    }
    if (b.accion === 'buk_descubrir' || b.accion === 'buk_llamar') {
      // BUK: token en BUK_API_TOKEN (header auth_token). Solo se devuelve la ESTRUCTURA de los datos, no los valores.
      const tk = process.env.BUK_API_TOKEN; const dom = process.env.BUK_DOMINIO || 'indeli.buk.cl'
      if (!tk) return NextResponse.json({ error: 'Falta la variable BUK_API_TOKEN en Vercel (y hacer Redeploy).' }, { status: 400 })
      const pedir = async (ruta: string) => fetch(`https://${dom}${ruta}`, { headers: { auth_token: tk, Accept: 'application/json' } })
      const forma = (v: any, d = 0): any => Array.isArray(v) ? [`lista de ${v.length}`, v.length && d < 7 ? forma(v[0], d + 1) : null] : (v && typeof v === 'object') ? (d >= 7 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, forma(x, d + 1)]))) : (v === null ? 'null' : typeof v)
      if (b.accion === 'buk_llamar') {
        const ruta = String(b.ruta || ''); if (!ruta.startsWith('/api/') || ruta.includes('..')) return NextResponse.json({ error: 'La ruta debe empezar con /api/' }, { status: 400 })
        const r = await pedir(ruta); const txt = await r.text(); let j: any = null; try { j = JSON.parse(txt) } catch {}
        return NextResponse.json({ ok: r.ok, status: r.status, largo: txt.length, estructura: j ? JSON.stringify(forma(j), null, 2).slice(0, 12000) : txt.slice(0, 300) })
      }
      const rutas = ['/api/v1/chile/employees', '/api/v1/chile/employees/active', '/api/v1/chile/payroll_detail/month?date=01-10-2026', '/api/v1/chile/payroll_detail/month', '/api/v1/chile/payroll_detail', '/api/v1/chile/payrolls', '/api/v1/chile/payroll/month?date=01-10-2026', '/api/v1/chile/accounting/payroll?date=01-10-2026', '/api/v1/chile/accounting', '/api/v1/chile/accounting_integration', '/api/v1/chile/cost_centers', '/api/v1/chile/organization/cost_centers', '/api/v1/chile/organization/areas', '/api/v1/chile/organization/company', '/api/v1/chile/jobs', '/api/v1/chile/companies', '/api/v1/chile/payroll_detail/month/export?date=01-10-2026', '/api/v1/chile/liquidations?date=01-10-2026', '/api/v1/chile/employees/payroll_detail']
      const out = await Promise.all(rutas.map(async ruta => { try { const r = await pedir(ruta); return { ruta, status: r.status } } catch { return { ruta, status: 0 } } }))
      return NextResponse.json({ ok: true, probadas: out.length, distintas: out.filter(x => x.status !== 404) })
    }
    if (b.accion === 'buk_sync_mes') {
      // Trae un mes completo de BUK y REEMPLAZA ese período en fin_remuneraciones (haberes + aportes patronales; centro vigente en el mes).
      const tk = process.env.BUK_API_TOKEN; const dom = process.env.BUK_DOMINIO || 'indeli.buk.cl'
      if (!tk) return NextResponse.json({ error: 'Falta la variable BUK_API_TOKEN en Vercel.' }, { status: 400 })
      const mes = String(b.mes || '')
      if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: 'Mes inválido (AAAA-MM).' }, { status: 400 })
      const pedir = async (ruta: string) => { const r = await fetch(`https://${dom}${ruta}`, { headers: { auth_token: tk, Accept: 'application/json' } }); if (!r.ok) throw new Error(`BUK HTTP ${r.status} en ${ruta.split('?')[0]}`); return r.json() as Promise<any> }
      const todas = async (ruta: string) => {
        const sep = ruta.includes('?') ? '&' : '?'
        const p1 = await pedir(ruta); const total = Number(p1?.pagination?.total_pages) || 1
        let datos: any[] = [...(p1.data || [])]
        const resto = Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 2)
        for (let i = 0; i < resto.length; i += 4) {
          const res = await Promise.all(resto.slice(i, i + 4).map(p => pedir(`${ruta}${sep}page=${p}`)))
          res.forEach(x => { datos = datos.concat(x.data || []) })
        }
        return datos
      }
      const [y, m] = mes.split('-')
      const [liqs, emps] = await Promise.all([todas(`/api/v1/chile/payroll_detail/month?date=01-${m}-${y}`), todas('/api/v1/chile/employees')])
      if (!liqs.length) return NextResponse.json({ error: `BUK no tiene liquidaciones para ${mes}; no se modificó nada.` }, { status: 404 })
      const ini = `${y}-${m}-01`, fin = `${y}-${m}-${String(new Date(Number(y), Number(m), 0).getDate()).padStart(2, '0')}`
      const ficha = new Map<string, { nombre: string, cargo: string, centro: string }>()
      emps.forEach(e => {
        const js: any[] = (Array.isArray(e.jobs) && e.jobs.length ? e.jobs : [e.current_job]).filter(Boolean)
        const vig = js.filter(j => String(j.start_date || '0000') <= fin && (!j.end_date || String(j.end_date) >= ini)).sort((a, c) => String(c.start_date).localeCompare(String(a.start_date)))
        const j = vig[0] || e.current_job
        ficha.set(String(e.rut || ''), { nombre: String(e.full_name || ''), cargo: String(j?.role?.name || ''), centro: String(j?.cost_center || '').trim() })
      })
      const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
      const { data: us } = await supabaseAdmin.from('fin_unidades').select('id,nombre')
      const { data: al } = await supabaseAdmin.from('fin_alias_centro').select('centro_texto,unidad_id')
      const mapa = new Map<string, string>((us || []).map(u => [norm(u.nombre), u.id as string]))
      ;(al || []).forEach(a => { if (a.unidad_id) mapa.set(norm(a.centro_texto), a.unidad_id) })
      const sinMapa = new Set<string>()
      const filas = liqs.map(x => {
        const f = ficha.get(String(x.rut || ''))
        const haberes = Number(x.income_gross) || 0
        const aporte = (x.lines_settlement || []).filter((l: any) => l.type === 'aporte').reduce((a: number, l: any) => a + (Number(l.amount) || 0), 0)
        const centro = f?.centro || ''
        const unidad_id = centro ? (mapa.get(norm(centro)) || null) : null
        if (!unidad_id) sinMapa.add(centro || '(sin centro)')
        return { periodo: mes, rut: String(x.rut || ''), nombre: f?.nombre || null, cargo: f?.cargo || null, centro_texto: centro || null, unidad_id, haberes, aporte_patronal: aporte, costo_empresa: haberes + aporte }
      })
      const { error: eDel } = await supabaseAdmin.from('fin_remuneraciones').delete().eq('periodo', mes)
      if (eDel) return NextResponse.json({ error: 'No se pudo limpiar el período: ' + eDel.message }, { status: 500 })
      for (let i = 0; i < filas.length; i += 300) {
        const { error } = await supabaseAdmin.from('fin_remuneraciones').insert(filas.slice(i, i + 300))
        if (error) return NextResponse.json({ error: 'No se pudo guardar: ' + error.message }, { status: 500 })
      }
      const tot = filas.reduce((a, f) => ({ h: a.h + f.haberes, ap: a.ap + f.aporte_patronal, c: a.c + f.costo_empresa }), { h: 0, ap: 0, c: 0 })
      return NextResponse.json({ ok: true, mes, personas: filas.length, haberes: Math.round(tot.h), aporte_patronal: Math.round(tot.ap), costo_empresa: Math.round(tot.c), abiertas: liqs.filter(x => x.closed === false).length, centrosSinUnidad: [...sinMapa] })
    }
    if (b.accion === 'buk_conciliar') {
      // Trae TODAS las páginas de un mes de BUK y lo compara con la planilla guardada. Solo devuelve totales (sin datos personales).
      const tk = process.env.BUK_API_TOKEN; const dom = process.env.BUK_DOMINIO || 'indeli.buk.cl'
      if (!tk) return NextResponse.json({ error: 'Falta la variable BUK_API_TOKEN en Vercel.' }, { status: 400 })
      const mes = String(b.mes || '')
      if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: 'Mes inválido (AAAA-MM).' }, { status: 400 })
      const pedir = async (ruta: string) => { const r = await fetch(`https://${dom}${ruta}`, { headers: { auth_token: tk, Accept: 'application/json' } }); if (!r.ok) throw new Error(`BUK HTTP ${r.status} en ${ruta.split('?')[0]}`); return r.json() as Promise<any> }
      const todas = async (ruta: string) => {
        const sep = ruta.includes('?') ? '&' : '?'
        const p1 = await pedir(ruta); const total = Number(p1?.pagination?.total_pages) || 1
        let datos: any[] = [...(p1.data || [])]
        const resto = Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 2)
        for (let i = 0; i < resto.length; i += 4) {
          const res = await Promise.all(resto.slice(i, i + 4).map(p => pedir(`${ruta}${sep}page=${p}`)))
          res.forEach(x => { datos = datos.concat(x.data || []) })
        }
        return { datos, total }
      }
      const [y, m] = mes.split('-')
      const [liq, emp] = await Promise.all([todas(`/api/v1/chile/payroll_detail/month?date=01-${m}-${y}`), todas('/api/v1/chile/employees')])
      const liqs = liq.datos
      const suma = (k: string) => Math.round(liqs.reduce((a, x) => a + (Number(x[k]) || 0), 0))
      const conceptos: Record<string, { n: number, monto: number }> = {}
      liqs.forEach(x => (x.lines_settlement || []).forEach((l: any) => {
        const k = `${l.type} | ${l.income_type ?? '-'} | ${l.name} | ${l.taxable ? 'trib' : 'no trib'} | ${l.imponible ? 'imp' : 'no imp'}`
        const c = conceptos[k] || (conceptos[k] = { n: 0, monto: 0 }); c.n++; c.monto += Number(l.amount) || 0
      }))
      const porConcepto = Object.entries(conceptos).map(([k, v]) => ({ concepto: k, personas: v.n, monto: Math.round(v.monto) })).sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto))
      const centroDe = new Map<string, string>(); const centros: Record<string, number> = {}
      // Centro vigente EN ese mes (historial de cargos), no el actual de la ficha
      const ini = `${y}-${m}-01`, fin = `${y}-${m}-${String(new Date(Number(y), Number(m), 0).getDate()).padStart(2, '0')}`
      emp.datos.forEach(e => {
        const js: any[] = (Array.isArray(e.jobs) && e.jobs.length ? e.jobs : [e.current_job]).filter(Boolean)
        const vig = js.filter(j => String(j.start_date || '0000') <= fin && (!j.end_date || String(j.end_date) >= ini)).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))
        const j = vig[0] || e.current_job
        centroDe.set(String(e.rut || ''), String(j?.cost_center || '(vacío)'))
      })
      const porCentro: Record<string, { personas: number, ingreso: number }> = {}; let sinFicha = 0
      liqs.forEach(x => { const c = centroDe.get(String(x.rut || '')); if (!c) sinFicha++; const k = c || '(sin ficha)'; const o = porCentro[k] || (porCentro[k] = { personas: 0, ingreso: 0 }); o.personas++; o.ingreso += Number(x.income_gross) || 0 })
      void centros
      const { data: pl } = await supabaseAdmin.from('fin_remuneraciones').select('haberes,aporte_patronal,costo_empresa,rut,centro_texto').eq('periodo', mes)
      const plCentro: Record<string, { personas: number, haberes: number }> = {}
      ;(pl || []).forEach((x: any) => { const k = x.centro_texto || '(vacío)'; const o = plCentro[k] || (plCentro[k] = { personas: 0, haberes: 0 }); o.personas++; o.haberes += Number(x.haberes || 0) })
      const normC = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '').trim()
      const bukPorCentro: Record<string, number> = {}; Object.entries(porCentro).forEach(([k, v]) => { bukPorCentro[normC(k)] = (bukPorCentro[normC(k)] || 0) + v.ingreso })
      const compCentros = Object.entries(plCentro).map(([k, v]) => ({ centro: k, planilla: Math.round(v.haberes), bukPorFecha: Math.round(bukPorCentro[normC(k)] || 0), diferencia: Math.round((bukPorCentro[normC(k)] || 0) - v.haberes) })).sort((a, b) => b.planilla - a.planilla)
      const plan = (pl || []).reduce((a, x: any) => ({ n: a.n + 1, haberes: a.haberes + Number(x.haberes || 0), aporte: a.aporte + Number(x.aporte_patronal || 0), costo: a.costo + Number(x.costo_empresa || 0) }), { n: 0, haberes: 0, aporte: 0, costo: 0 })
      const { data: alias } = await supabaseAdmin.from('fin_alias_centro').select('*')
      return NextResponse.json({ ok: true, resumen: JSON.stringify({
        mes, paginasLiquidaciones: liq.total, liquidaciones: liqs.length, fichasEmpleados: emp.datos.length, liquidacionesSinFicha: sinFicha,
        buk: { income_gross: suma('income_gross'), income_net: suma('income_net'), imponible_afp: suma('income_afp'), total_income_taxable: suma('total_income_taxable'), total_income_notaxable: suma('total_income_notaxable') },
        planilla: { filas: plan.n, haberes: Math.round(plan.haberes), aporte_patronal: Math.round(plan.aporte), costo_empresa: Math.round(plan.costo) },
        porCentroBUK: Object.entries(porCentro).map(([c, v]) => ({ centro: c, personas: v.personas, ingreso: Math.round(v.ingreso) })).sort((a, b) => b.ingreso - a.ingreso),
        comparacionPorCentro: compCentros,
        aliasGuardados: (alias || []).length,
        conceptos: porConcepto,
      }, null, 2).slice(0, 20000) })
    }
    if (b.accion === 'sync_pagina') {
      // Trae UNA página (1000 líneas) del Libro Diario y guarda las cuentas de ingresos (3.x) y egresos (4.x).
      const desde = String(b.desde || ''), hasta = String(b.hasta || ''), page = Math.max(1, Number(b.page) || 1)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return NextResponse.json({ error: 'Fechas inválidas.' }, { status: 400 })
      const t = await obtenerToken()
      const r = await fetch(`${BASE}/api/Contabilidad/getLibroDiario?${new URLSearchParams({ fechaDesde: desde, fechaHasta: hasta, page: String(page), per_page: '1000' })}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } })
      const j: any = await r.json().catch(() => null)
      if (!r.ok || !j || j.Estado === 'Error') return NextResponse.json({ error: 'Kame respondió con error: ' + JSON.stringify(j).slice(0, 300) }, { status: 502 })
      const items: any[] = j.items || []
      if (page === 1) {
        const { error } = await supabaseAdmin.from('fin_asientos').delete().gte('fecha', desde).lte('fecha', hasta)
        if (error) return NextResponse.json({ error: 'No se pudo limpiar el rango: ' + error.message }, { status: 500 })
      }
      const utiles = items.filter(x => /^[34]\./.test(String(x.Cuenta)))
      const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
      // Unidades de negocio: se crean las que falten
      const nombres = [...new Set(utiles.map(x => String(x.UnidadNegocio || '').trim()).filter(Boolean))]
      const { data: us } = await supabaseAdmin.from('fin_unidades').select('id,nombre')
      const mapa = new Map((us || []).map(u => [norm(u.nombre), u.id as string]))
      const faltan = nombres.filter(n => !mapa.has(norm(n)))
      if (faltan.length) {
        const { data: nu, error } = await supabaseAdmin.from('fin_unidades').insert(faltan.map(nombre => ({ nombre }))).select('id,nombre')
        if (error) return NextResponse.json({ error: 'No se pudieron crear unidades: ' + error.message }, { status: 500 })
        ;(nu || []).forEach(u => mapa.set(norm(u.nombre), u.id))
      }
      const filas = utiles.map(x => {
        // El comentario trae el documento: "Factura Electrónica #21053 Ficha 76.340.983-K PROVEEDOR"
        const m = String(x.Comentario || '').match(/^(.*?)\s*#\s*(\d+)\s*,?\s*ficha\s+([0-9.]+-[0-9kK])\s*(.*)$/i)
        const u = String(x.UnidadNegocio || '').trim()
        return {
          kame_id: Math.round(Number(x.Id)), fecha: String(x.Fecha).slice(0, 10), tipo_comprobante: x.TipoComprobante || null, folio_comprobante: x.Folio ?? null,
          cuenta: String(x.Cuenta), nombre_cuenta: x.NombreCuenta || null, debe: Number(x.Debe) || 0, haber: Number(x.Haber) || 0,
          comentario: x.Comentario || null, comentario_det: x.ComentarioDet || null, unidad_texto: u || null, unidad_id: u ? (mapa.get(norm(u)) || null) : null,
          doc_tipo: m ? norm(m[1]) : null, doc_folio: m ? m[2] : null, doc_rut: m ? m[3].replace(/\./g, '').toUpperCase() : null, doc_nombre: m ? m[4].trim() : null,
          sincronizado_en: new Date().toISOString(),
        }
      })
      for (let i = 0; i < filas.length; i += 500) {
        const { error } = await supabaseAdmin.from('fin_asientos').upsert(filas.slice(i, i + 500), { onConflict: 'kame_id' })
        if (error) return NextResponse.json({ error: 'No se pudo guardar: ' + error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, lineas: items.length, guardadas: filas.length, hayMas: items.length >= 1000, unidadesNuevas: faltan.length })
    }
    if (b.accion === 'paginar') {
      const t = await obtenerToken()
      const base = { fechaDesde: String(b.desde || '2026-10-01'), fechaHasta: String(b.hasta || '2026-10-31') }
      const pedir = async (extra: Record<string, string>) => {
        const r = await fetch(`${BASE}/api/Contabilidad/getLibroDiario?${new URLSearchParams({ ...base, ...extra })}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } })
        const j: any = await r.json().catch(() => null)
        return { status: r.status, j, items: (j?.items || []) as any[] }
      }
      const b0 = await pedir({})
      const otros = Object.fromEntries(Object.entries(b0.j || {}).filter(([k]) => k !== 'items'))
      const id0 = b0.items[0]?.Id, idN = b0.items[b0.items.length - 1]?.Id
      const variantes: Record<string, string>[] = [
        { pagina: '2' }, { page: '2' }, { nroPagina: '2' }, { numeroPagina: '2' }, { pageNumber: '2' }, { skip: '1000' }, { offset: '1000' },
        { pagina: '2', registrosPorPagina: '1000' }, { pagina: '2', tamanoPagina: '1000' }, { page: '2', pageSize: '1000' }, { desde: '1000' }, { start: '1000' },
      ]
      const pruebas: any[] = []
      for (const v of variantes) {
        const r = await pedir(v)
        pruebas.push({ parametros: JSON.stringify(v), status: r.status, lineas: r.items.length, primerId: r.items[0]?.Id, distinto: r.items[0]?.Id !== id0, msg: r.items.length ? '' : JSON.stringify(r.j).slice(0, 200) })
      }
      const gastos = b0.items.filter(x => /^4\./.test(String(x.Cuenta))).slice(0, 5)
      const ingresos = b0.items.filter(x => /^3\./.test(String(x.Cuenta))).slice(0, 3)
      const porUnidad: Record<string, number> = {}; b0.items.filter(x => /^4\./.test(String(x.Cuenta))).forEach(x => { porUnidad[x.UnidadNegocio || '(vacía)'] = (porUnidad[x.UnidadNegocio || '(vacía)'] || 0) + x.Debe - x.Haber })
      const fechas = b0.items.map(x => String(x.Fecha).slice(0, 10)).sort()
      return NextResponse.json({ ok: true, resumen: JSON.stringify({ otrosCamposRespuesta: otros, lineas: b0.items.length, primerId: id0, ultimoId: idN, fechaMin: fechas[0], fechaMax: fechas[fechas.length - 1], pruebas, ejemplosCuenta4: gastos, ejemplosCuenta3: ingresos, costos4PorUnidad_enEstaPagina: porUnidad }, null, 2) })
    }
    if (b.accion === 'parametros') {
      const ruta = String(b.ruta || ''); if (!ruta.startsWith('/') || ruta.includes('..')) return NextResponse.json({ error: 'Ruta inválida.' }, { status: 400 })
      const t = await obtenerToken()
      const d = String(b.desde || '2026-10-01'), h = String(b.hasta || '2026-10-31')
      const pares: [string, string][] = [['fechaDesde', 'fechaHasta'], ['fechaInicio', 'fechaFin'], ['fechaInicial', 'fechaFinal'], ['desde', 'hasta'], ['fecha_desde', 'fecha_hasta'], ['FechaDesde', 'FechaHasta'], ['fechaIni', 'fechaFin'], ['fechaEmisionDesde', 'fechaEmisionHasta'], ['fechaContableDesde', 'fechaContableHasta'], ['fechaVencimientoDesde', 'fechaVencimientoHasta']]
      const out: any[] = []
      for (const [a1, a2] of pares) {
        const r = await fetch(`${BASE}${ruta}?${new URLSearchParams({ [a1]: d, [a2]: h })}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } })
        const txt = await r.text()
        let estado = ''; try { estado = JSON.parse(txt).Estado || '' } catch {}
        const msg = txt.includes('SqlDateTime') ? 'sigue faltando fecha' : txt.slice(0, 250)
        out.push({ parametros: `${a1} / ${a2}`, status: r.status, estado, largo: txt.length, msg })
        if (r.ok && !txt.includes('SqlDateTime') && estado !== 'Error') break
      }
      return NextResponse.json({ ok: true, intentos: out })
    }
    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 })
  }
}

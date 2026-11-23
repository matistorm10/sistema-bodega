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

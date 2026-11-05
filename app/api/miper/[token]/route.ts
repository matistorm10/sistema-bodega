import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Acceso público (sin usuario) a la MIPER aprobada de un contrato, mediante el código del QR.
// GET            -> datos del contrato y lista de matrices aprobadas
// GET ?d=<id>    -> redirige al archivo (enlace firmado de corta vida, se genera en cada consulta)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!/^[a-f0-9]{32,80}$/.test(token)) return NextResponse.json({ error: 'Código no válido.' }, { status: 404 })
  const { data: c } = await supabaseAdmin.from('pr_contratos').select('id,nombre,referencia,activo,cliente:pr_clientes_informe(nombre)').eq('miper_token', token).maybeSingle()
  if (!c) return NextResponse.json({ error: 'Código no válido.' }, { status: 404 })
  const { data: docs } = await supabaseAdmin.from('pr_contrato_documentos').select('id,nombre,rev,path,archivo_nombre,fecha_aprobacion,updated_at').eq('contrato_id', c.id).eq('categoria', 'Matriz').eq('estado', 'Aprobado').not('path', 'is', null).order('nombre')
  const d = req.nextUrl.searchParams.get('d')
  if (d) {
    const doc = (docs || []).find(x => x.id === d)
    if (!doc) return NextResponse.json({ error: 'Documento no disponible.' }, { status: 404 })
    const { data } = await supabaseAdmin.storage.from('hsec-documentos').createSignedUrl(doc.path, 300)
    if (!data) return NextResponse.json({ error: 'No se pudo abrir el archivo.' }, { status: 500 })
    return NextResponse.redirect(data.signedUrl)
  }
  const cli: any = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente
  return NextResponse.json({
    contrato: { nombre: c.nombre, referencia: c.referencia, cliente: cli?.nombre || null },
    docs: (docs || []).map(x => ({ id: x.id, nombre: x.nombre, rev: x.rev, fecha: x.fecha_aprobacion || x.updated_at })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

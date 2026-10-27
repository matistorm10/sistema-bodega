import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: { user: llamante }, error: errAuth } = await supabaseAdmin.auth.getUser(token)
    if (errAuth || !llamante) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const { data: perfilLlamante } = await supabaseAdmin.from('usuarios').select('rol').eq('auth_id', llamante.id).single()
    if (!perfilLlamante || perfilLlamante.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo un administrador puede cambiar contraseñas.' }, { status: 403 })
    }

    const { usuarioId, password } = await req.json()
    if (!usuarioId || typeof password !== 'string') return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 })

    const { data: objetivo } = await supabaseAdmin.from('usuarios').select('auth_id, nombre').eq('id', usuarioId).single()
    if (!objetivo?.auth_id) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

    const { error } = await supabaseAdmin.auth.admin.updateUserById(objetivo.auth_id, { password })
    if (error) return NextResponse.json({ error: 'No se pudo cambiar la contraseña: ' + error.message }, { status: 400 })

    return NextResponse.json({ ok: true, nombre: objetivo.nombre })
  } catch (e: any) {
    return NextResponse.json({ error: 'Error inesperado: ' + e.message }, { status: 500 })
  }
}

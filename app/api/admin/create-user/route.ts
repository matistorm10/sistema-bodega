import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: { user: llamante }, error: errAuth } = await supabaseAdmin.auth.getUser(token)
    if (errAuth || !llamante) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const { data: perfilLlamante } = await supabaseAdmin.from('usuarios').select('rol').eq('auth_id', llamante.id).single()
    if (!perfilLlamante || perfilLlamante.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo un administrador puede crear usuarios.' }, { status: 403 })
    }

    const body = await req.json()
    const { nombre, cargo, telefono, email, password, rol, permisos } = body
    if (!nombre || !email || !password || !rol) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 })
    }

    const { data: nuevoAuth, error: errCreate } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    })
    if (errCreate || !nuevoAuth.user) {
      return NextResponse.json({ error: 'No se pudo crear la cuenta: ' + (errCreate?.message || 'error desconocido') }, { status: 400 })
    }

    const { data: perfil, error: errPerfil } = await supabaseAdmin.from('usuarios').insert({
      auth_id: nuevoAuth.user.id, nombre, cargo: cargo || null, telefono: telefono || null, email, rol
    }).select().single()
    if (errPerfil || !perfil) {
      await supabaseAdmin.auth.admin.deleteUser(nuevoAuth.user.id)
      return NextResponse.json({ error: 'No se pudo crear el perfil: ' + errPerfil?.message }, { status: 400 })
    }

    if (Array.isArray(permisos) && permisos.length > 0) {
      const filas = permisos.map((p: any) => ({
        usuario_id: perfil.id, ubicacion_id: p.ubicacion_id, puede_origen: !!p.puede_origen, puede_destino: !!p.puede_destino
      }))
      const { error: errPermisos } = await supabaseAdmin.from('usuario_ubicaciones').insert(filas)
      if (errPermisos) return NextResponse.json({ error: 'Usuario creado, pero no se pudieron guardar los permisos: ' + errPermisos.message }, { status: 207 })
    }

    return NextResponse.json({ ok: true, usuario: perfil })
  } catch (e: any) {
    return NextResponse.json({ error: 'Error inesperado: ' + e.message }, { status: 500 })
  }
}
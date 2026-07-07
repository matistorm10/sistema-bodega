'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Permiso = { ubicacion_id: string, puede_origen: boolean, puede_destino: boolean }
export type UsuarioActual = {
  id: string, nombre: string, cargo: string | null, telefono: string | null, email: string, rol: 'admin' | 'bodeguero',
  permisos: Permiso[]
}

export function useUsuarioActual() {
  const [usuario, setUsuario] = useState<UsuarioActual | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sinSesion, setSinSesion] = useState(false)

  const cargar = async () => {
    setCargando(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUsuario(null); setSinSesion(true); setCargando(false); return }
    const { data: perfil, error } = await supabase
      .from('usuarios')
      .select('*, usuario_ubicaciones(ubicacion_id, puede_origen, puede_destino)')
      .eq('auth_id', session.user.id)
      .single()
    if (error || !perfil) { setUsuario(null); setSinSesion(true); setCargando(false); return }
    setUsuario({
      id: perfil.id, nombre: perfil.nombre, cargo: perfil.cargo, telefono: perfil.telefono, email: perfil.email, rol: perfil.rol,
      permisos: perfil.usuario_ubicaciones || []
    })
    setSinSesion(false)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    const { data: sub } = supabase.auth.onAuthStateChange(() => { cargar() })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { usuario, cargando, sinSesion }
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Permiso = { ubicacion_id: string, puede_origen: boolean, puede_destino: boolean }
export type UsuarioActual = {
  id: string, nombre: string, cargo: string | null, telefono: string | null, email: string, rol: string,
  accesoBodega: boolean, accesoVehiculos: boolean, accesoLicitaciones: boolean,
  accesoContabilidad: boolean, accesoHsec: boolean, puedeAprobar: boolean, esRevisor: boolean,
  permisos: Permiso[]
}

export function useUsuarioActual() {
  const [usuario, setUsuario] = useState<UsuarioActual | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sinSesion, setSinSesion] = useState(false)

  // silencioso=true: refresco en segundo plano (p. ej. al volver a la pestaña del navegador).
  // No muestra "Cargando..." ni cambia el usuario si no cambió nada, para no reiniciar formularios a medias.
  const cargar = async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUsuario(null); setSinSesion(true); setCargando(false); return }
    const { data: perfil, error } = await supabase
      .from('usuarios')
      .select('*, usuario_ubicaciones(ubicacion_id, puede_origen, puede_destino)')
      .eq('auth_id', session.user.id)
      .single()
    if (error || !perfil) {
      if (silencioso) return // fallo de red momentáneo: conservar la sesión actual
      setUsuario(null); setSinSesion(true); setCargando(false); return
    }
    const nuevo: UsuarioActual = {
      id: perfil.id, nombre: perfil.nombre, cargo: perfil.cargo, telefono: perfil.telefono, email: perfil.email, rol: perfil.rol,
      accesoBodega: perfil.acceso_bodega !== false, accesoVehiculos: !!perfil.acceso_vehiculos, accesoLicitaciones: !!perfil.acceso_licitaciones,
      accesoContabilidad: !!perfil.acceso_contabilidad, accesoHsec: !!perfil.acceso_hsec,
      puedeAprobar: !!perfil.puede_aprobar_contabilidad, esRevisor: !!perfil.es_revisor_contabilidad,
      permisos: perfil.usuario_ubicaciones || []
    }
    setUsuario(prev => (prev && JSON.stringify(prev) === JSON.stringify(nuevo)) ? prev : nuevo)
    setSinSesion(false)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'INITIAL_SESSION') return
      cargar(evento !== 'SIGNED_OUT')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { usuario, cargando, sinSesion }
}

'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Ciudad = { id: string, nombre: string, aeropuerto: string | null }
// Ciudades de origen (tabla op_ciudades), ordenadas alfabéticamente
export function useCiudades() {
  const [ciudades, setCiudades] = useState<Ciudad[]>([])
  const recargar = useCallback(async () => {
    const { data } = await supabase.from('op_ciudades').select('id,nombre,aeropuerto')
    setCiudades(((data || []) as Ciudad[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
  }, [])
  useEffect(() => { recargar() }, [recargar])
  const nombres = ciudades.map(c => c.nombre)
  const aeropuertoDe = (n?: string | null) => ciudades.find(c => c.nombre === n)?.aeropuerto || ''
  return { ciudades, nombres, aeropuertoDe, recargar }
}

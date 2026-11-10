'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type VersionCap = {
  id: string, numero: number, revision?: string | null, estado: 'pendiente' | 'vigente', motivo: string | null, desde: string | null, snapshot: any[] | null, creado_at: string,
  elabora_por: string | null, elabora_nombre: string | null, elabora_cargo: string | null, elabora_firma: string | null, elabora_at: string | null,
  revisa_por: string | null, revisa_nombre: string | null, revisa_cargo: string | null, revisa_firma: string | null, revisa_at: string | null,
  aprueba_por: string | null, aprueba_nombre: string | null, aprueba_cargo: string | null, aprueba_firma: string | null, aprueba_at: string | null,
  revisiones?: Revision[],
}
export type Revision = { version_id: string, usuario_id: string, nombre: string | null, cargo: string | null, firma: string | null, firmado_at: string | null }
export type Requerido = { usuario_id: string, nombre: string, contratos: string, firmado: boolean }
// Orden de firmas del calendario: el Jefe elabora → el Administrador de Faena revisa → el Gerente General aprueba
export const FIRMAS_CAP = [
  { k: 'elabora', t: 'Elabora', cargo: 'Jefe de Prevención de Riesgos' },
  { k: 'revisa', t: 'Revisa', cargo: 'Administrador de Faena' },
  { k: 'aprueba', t: 'Aprueba', cargo: 'Gerente General' },
] as const
export type RolFirma = typeof FIRMAS_CAP[number]['k']

export const firmaDe = (v: VersionCap, k: RolFirma) => ({ por: v[`${k}_por`], nombre: v[`${k}_nombre`], cargo: v[`${k}_cargo`], firma: v[`${k}_firma`], at: v[`${k}_at`] })
// Siguiente firma que falta en una versión pendiente
export const siguienteFirma = (v: VersionCap): RolFirma | null => !v.elabora_at ? 'elabora' : !v.revisa_at ? 'revisa' : !v.aprueba_at ? 'aprueba' : null
// Qué firma puede poner este usuario (según su perfil)
export const rolQuePuedeFirmar = (u: { rol?: string, esJefeHsec?: boolean, cargoPrograma?: string | null } | null | undefined): RolFirma | null => {
  if (!u) return null
  if (u.cargoPrograma === 'gerente_general') return 'aprueba'
  if (u.cargoPrograma === 'administrador_faena') return 'revisa'
  if (u.rol === 'admin' || u.esJefeHsec) return 'elabora'
  return null
}

export function useVersionesCap(activo = true) {
  const [versiones, setVersiones] = useState<VersionCap[]>([])
  const [cargado, setCargado] = useState(false)
  const [requeridos, setRequeridos] = useState<Requerido[]>([])
  const recargar = useCallback(async () => {
    const [{ data }, { data: revs }] = await Promise.all([
      supabase.from('pr_cap_versiones').select('*').order('numero', { ascending: false }),
      supabase.from('pr_cap_revisiones').select('*').order('firmado_at'),
    ])
    const vs = ((data || []) as VersionCap[]).map(v => ({ ...v, revisiones: ((revs || []) as Revision[]).filter(r => r.version_id === v.id) }))
    setVersiones(vs); setCargado(true)
    if (vs.some(v => v.estado === 'pendiente')) { const { data: rq } = await supabase.rpc('cap_revisores_requeridos'); setRequeridos((rq || []) as Requerido[]) } else setRequeridos([])
  }, [])
  useEffect(() => { if (activo) recargar() }, [activo, recargar])
  const pendiente = versiones.find(v => v.estado === 'pendiente') || null
  const vigente = versiones.find(v => v.estado === 'vigente') || null
  return { versiones, pendiente, vigente, cargado, recargar, requeridos }
}

// Revisión que escribe el Jefe al enviar el calendario a firma (ya no se numera sola)
export const revCap = (v?: { numero: number, revision?: string | null } | null) => v ? ((v.revision || '').trim() || String(v.numero)) : ''

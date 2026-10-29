export const TIPOS_CHARLA: Record<string, string> = {
  charla_5min: 'Charla de 5 minutos',
  induccion: 'Inducción',
  capacitacion: 'Capacitación',
  otra: 'Otra',
}
export const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''

// Ítems del programa "SSO Faena" (según el documento de instrucciones). El ítem 1 desbloquea los demás.
export const ITEMS_SSO: { n: string, titulo: string, detalle: string, listo: boolean }[] = [
  { n: '1', titulo: 'Descriptor de cargo', detalle: 'Cada prevencionista firma su descriptor y la jefatura verifica la firma.', listo: true },
  { n: '2', titulo: 'Programa de liderazgo percibido', detalle: 'Programa mensual de actividades (confirmación de procesos, ABC, reglas, rol, EPP, bloqueo, DS 594, comunicación, charlas, DS 132).', listo: true },
  { n: '3', titulo: 'Informes diarios', detalle: 'Informe diario SSO completado día a día por el prevencionista de terreno.', listo: true },
  { n: '4', titulo: 'Informes semanales', detalle: 'Carga del informe semanal (formato del mandante) con semáforo y recordatorio.', listo: true },
  { n: '5', titulo: 'Capacitaciones', detalle: 'Cumplimiento del programa anual de capacitaciones.', listo: true },
  { n: '6', titulo: 'Charlas y capacitaciones', detalle: 'Registro de charlas y capacitaciones con lista de asistentes.', listo: true },
]
export const DOC_DESCRIPTOR = 'descriptor_apr'

// Ubicaciones/faenas que le corresponden a un prevencionista (descriptor, EPP o cliente semanal).
import { supabase } from '@/lib/supabase'
export async function misUbicacionesIds(usuarioId: string): Promise<Set<string>> {
  const { data } = await supabase.from('pr_epp_ubicaciones').select('ubicacion_id').eq('usuario_id', usuarioId)
  return new Set((data || []).map((x: any) => x.ubicacion_id).filter(Boolean))
}

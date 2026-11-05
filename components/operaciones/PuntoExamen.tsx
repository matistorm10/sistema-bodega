import { COLOR_EXAMEN, EXAMENES } from '@/lib/operaciones'

// Círculo chico con el estatus de exámenes (sin texto): verde aprobado, ámbar pendiente, rojo rechazado
export default function PuntoExamen({ estado }: { estado?: string | null }) {
  const e = estado || 'pendiente'
  return <span title={`Exámenes: ${EXAMENES[e] || e}`} style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: COLOR_EXAMEN[e] || '#98a2b3', marginRight: '6px', flexShrink: 0, verticalAlign: 'middle' }} />
}

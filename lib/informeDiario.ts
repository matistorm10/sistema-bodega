export type Fila = Record<string, string>
export type DatosInforme = {
  contrato: string; turno: string; mandante: string; dotH: string; dotM: string; cargo: string
  area: string; tarea: string; criticos: string; pts: string
  actividades: Fila[]       // actividad, cantidad, area, resultado
  condiciones: Fila[]       // item, estado (C/NC/NA), obs
  incidentes: string; atenciones: string; descIncidente: string   // 'si' | 'no' | ''
  mejoras: Fila[]           // oportunidad, accion, compromiso, responsable, plazo
  coordinaciones: Fila[]    // hora, con, tema
  pendientes: Fila[]        // pendiente, responsable, fecha
  sinNovedades: string; reporteCliente: string; horaCierre: string; proximoTurno: string
  observaciones: string; supervisor: string
}
export const SUGERENCIAS_ACTIVIDAD = ['Charla de 5 minutos', 'Inspección de área', 'Observación conductual', 'Verificación de permisos', 'Difusión de PTS', 'Control de EPP', 'Inspección de herramientas / equipos', 'Charla de inducción']
export const CONDICIONES_BASE = ['Orden y aseo', 'Uso correcto de EPP', 'Señalización y delimitación', 'Herramientas y equipos en buen estado', 'Trabajos en altura / protección contra caídas', 'Bloqueo y energías', 'Instalaciones de faena (baños, comedor, agua)']
export const vacias = (n: number, claves: string[]): Fila[] => Array.from({ length: n }, () => Object.fromEntries(claves.map(c => [c, ''])))
export const COLS = {
  actividades: ['actividad', 'cantidad', 'area', 'resultado'],
  condiciones: ['item', 'estado', 'obs'],
  mejoras: ['oportunidad', 'accion', 'compromiso', 'responsable', 'plazo'],
  coordinaciones: ['hora', 'con', 'tema'],
  pendientes: ['pendiente', 'responsable', 'fecha'],
}
export function informeNuevo(cargo: string): DatosInforme {
  return {
    contrato: '', turno: '', mandante: '', dotH: '', dotM: '', cargo,
    area: '', tarea: '', criticos: '', pts: '',
    actividades: vacias(3, COLS.actividades),
    condiciones: CONDICIONES_BASE.map(item => ({ item, estado: '', obs: '' })),
    incidentes: '', atenciones: '', descIncidente: '',
    mejoras: vacias(2, COLS.mejoras), coordinaciones: vacias(2, COLS.coordinaciones), pendientes: vacias(2, COLS.pendientes),
    sinNovedades: '', reporteCliente: '', horaCierre: '', proximoTurno: '', observaciones: '', supervisor: '',
  }
}

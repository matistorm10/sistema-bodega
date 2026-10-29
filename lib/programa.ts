export const CARGOS_PROGRAMA: Record<string, string> = {
  administrador_faena: 'Administrador de faena / contrato',
  jefe_prevencion: 'Jefe de prevención de riesgos',
  supervisor: 'Supervisor',
  asesor_prl: 'Asesor en prevención de riesgos (APR)',
  gerente_general: 'Gerente general',
}

// Actividades del programa personalizado (IDL-SSO-PLP-001)
export type TipoAct = 'formulario' | 'archivo' | 'pendiente'
export const ACTIVIDADES: Record<string, { nombre: string, corto: string, tipo: TipoAct }> = {
  confirmacion_rol: { nombre: 'Confirmación de rol', corto: 'CdR', tipo: 'formulario' },
  comunicacion_grupal: { nombre: 'Comunicación grupal de sensibilización y/o reflexión', corto: 'Comunicación grupal', tipo: 'archivo' },
  cdp_tarea_critica: { nombre: 'CdP Tarea crítica (CdP / SOP tareas)', corto: 'CdP Tarea crítica', tipo: 'formulario' },
  charlas_grupales: { nombre: 'Charlas grupales (charlas operacionales)', corto: 'Charlas grupales', tipo: 'archivo' },
  confirmacion_abc: { nombre: 'Confirmación ABC', corto: 'ABC', tipo: 'formulario' },
  cdp_rbs: { nombre: 'CdP RBS (reglas básicas de seguridad)', corto: 'CdP RBS', tipo: 'formulario' },
  inspeccion_epp: { nombre: 'Inspección grupal de EPP', corto: 'Inspección EPP', tipo: 'formulario' },
  inspeccion_bloqueo: { nombre: 'Inspección de elementos de bloqueo', corto: 'Elementos de bloqueo', tipo: 'formulario' },
  verificacion_ds594: { nombre: 'Lista de verificación DS 594', corto: 'DS 594', tipo: 'formulario' },
  verificacion_ds132: { nombre: 'Lista de verificación DS 132 (cuando aplique)', corto: 'DS 132', tipo: 'formulario' },
}

export const ORDEN_ACTIVIDADES = Object.keys(ACTIVIDADES)

export type Resp = 'si' | 'no' | 'na'

// Ítems SI / NO / N/A
export const ITEMS_CDR = [
  '1.1 Al llegar al punto de trabajo, área o sector se comunica con el supervisor, líder, capataz o trabajador responsable de la tarea y explica el alcance de su actividad.',
  '2.1 Durante la observación espera que el encargado le explique el detalle del trabajo (observa acciones seguras, inseguras y las condiciones del área).',
  '2.2 Se preocupa de la documentación contractual que debería existir.',
  '2.3 Interviene si observa alguna acción que exponga a los trabajadores; la intervención es controlada y tiende a generar confianza y aprendizaje.',
  '3.1 Explica el alcance de su visita a los trabajadores.',
  '3.2 Utiliza un lenguaje amigable que permita la apertura al diálogo al interactuar con los trabajadores.',
  '4.1 Refuerza de manera positiva los comportamientos seguros observados.',
  '4.2 Trabaja las oportunidades de mejora buscando generar impacto en las personas y analizando las causas raíces de los actos inseguros.',
  '4.3 Colabora al establecer compromisos a corto plazo, relacionados con las causas raíces.',
  '5.1 El mensaje final es creíble y deja claridad de lo que busca la actividad.',
]
export const ITEMS_ABC: { grupo: string, items: string[] }[] = [
  { grupo: '1. Inicio del ABC', items: [
    'Moderador consulta a trabajadores cómo clasifican el día anterior',
    'Si fue seguro se identifica y refuerza comportamientos seguros',
    'Si el día no fue seguro, se identifica la oportunidad de mejora y plan de acción',
    'Moderador profundiza en los «por qué» para encontrar causa raíz según la clasificación del día anterior',
  ] },
  { grupo: '2. Analizar un ejemplo positivo de seguridad de ayer', items: [
    'El equipo logra identificar comportamientos seguros, buenas prácticas o iniciativas en otros compañeros',
    'El moderador refuerza positivamente los comportamientos seguros, buenas prácticas o iniciativas',
    'Se comenta la CdP a la RBS del día anterior',
  ] },
  { grupo: '3. Completar el tablero', items: [
    'Se completa el tablero con las letras A, B o C',
    'Se revisan los planes de acción y su estatus vencidos',
    'Se actualizan en color rojo los días de atraso de oportunidades con fechas vencidas',
  ] },
  { grupo: '4. Distribuir trabajos y discutir puntos de seguridad', items: [
    'Pregunta o indica qué tareas críticas tenemos hoy',
    'Se pregunta a un integrante del equipo qué comportamientos seguros debe realizar hoy, anclándolos a RBS',
    'Se completa el tablero con la identificación de RBS que apliquen a la tarea a realizar',
    'Se designa responsable para las CdP RBS analizadas',
  ] },
]

// Matrices C / NC / NA por trabajador
export type Cnc = 'C' | 'NC' | 'NA'
export const COLS_EPP = ['Casco', 'Ojos / cara', 'Auditiva', 'Respiratoria', 'Guantes', 'Calzado', 'Ropa / alta vis.', 'Altura', 'EPP tarea']
export const COLS_BLOQUEO = ['Candado personal', 'Tarjeta personal', 'Identificación coincidente', 'Estado del candado', 'Llave bajo control', 'Dispositivo de bloqueo', 'Accesorio grupal (si aplica)']

export const ARCHIVO_INFO: Record<string, string> = {
  comunicacion_grupal: 'Imprime el Registro de comunicación (IDL-RDC-001), sácale las firmas en terreno y sube aquí una foto o el PDF escaneado.',
  charlas_grupales: 'Imprime el Registro de comunicación (IDL-RDC-001), sácale las firmas en terreno y sube aquí una foto o el PDF escaneado.',
}

export const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : null

export const mesActual = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7)
export const nombreMes = (m: string) => {
  const [a, mm] = m.split('-')
  return ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(mm) - 1] + ' ' + a
}
export const mesesRecientes = (n = 12) => {
  const h = new Date(); const out: string[] = []
  for (let i = 0; i < n; i++) { const d = new Date(h.getFullYear(), h.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  return out
}

// Plazo para informar el programa de un mes: hasta el día 5 (inclusive) del mes siguiente.
export const DIA_LIMITE = 5
export const mesSiguiente = (m: string) => { const [a, mm] = m.split('-').map(Number); const d = new Date(a, mm, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export const mesAnterior = (m: string) => { const [a, mm] = m.split('-').map(Number); const d = new Date(a, mm - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export const finPlazo = (m: string) => { const [a, mm] = mesSiguiente(m).split('-').map(Number); return new Date(a, mm - 1, DIA_LIMITE, 23, 59, 59) }
export const textoPlazo = (m: string) => `${DIA_LIMITE} de ${nombreMes(mesSiguiente(m))}`

// Semáforo del plazo: 'ok' (a tiempo), 'atraso' (venció sin enviar o enviado tarde), 'vigente' (aún en plazo o mes en curso)
export function estadoPlazo(m: string, estado: string | undefined, enviadoAt?: string | null) {
  const fin = finPlazo(m), ahora = new Date()
  const enviado = estado === 'enviado' || estado === 'aprobado'
  if (enviado) return enviadoAt && new Date(enviadoAt) > fin ? { tipo: 'atraso' as const, texto: 'Enviado con atraso' } : { tipo: 'ok' as const, texto: 'Enviado a tiempo' }
  if (ahora > fin) return { tipo: 'atraso' as const, texto: `Atrasado · el plazo venció el ${textoPlazo(m)}` }
  const dias = Math.ceil((fin.getTime() - ahora.getTime()) / 86400000)
  return { tipo: 'vigente' as const, texto: m === mesActual() ? `Se informa a más tardar el ${textoPlazo(m)}` : `Plazo: ${textoPlazo(m)} · quedan ${dias} día${dias === 1 ? '' : 's'}` }
}

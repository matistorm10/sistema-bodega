// Reglas Básicas de Seguridad (RBS) del formato «CdP RBS». Cada una trae sus comportamientos a verificar.
export const RBS: { n: number, titulo: string, items: string[] }[] = [
 {
  "n": 1,
  "titulo": "Aspectos fundamentales",
  "items": [
   "Se Identifican los peligros y se controlan por medio de los comportamientos seguros antes y durante cada tarea.",
   "Dichos controles se establecen en la HCR y reevaluarlos si las condiciones cambian",
   "Equipos de apoyo, materiales y herramientas son apropiados para cada tarea y se encuentran codificadas de acuerdo a estándar .",
   "Conocen los procedimientos y estándares para cada tarea",
   "Comprobar que los equipos y herramientas estén en condición de energía cero",
   "El área de trabajo y tránsito, se encuentra limpia , ordenada y despejada",
   "Utilizar en todo momento los Equipos de Protección Personal (EPP)"
  ]
 },
 {
  "n": 2,
  "titulo": "Equipos y vehículos de transporte",
  "items": [
   "Portar licencia interna al día",
   "Conduce vehículos autorizados según la licencia",
   "Usa cinturón de seguridad, verificar su uso por parte de todos los pasajeros.",
   "Usa tres puntos de apoyo al subir y bajar del vehículo",
   "Que velocidad máxima estipula esta área",
   "Al retroceder verificar la inexistencia de peatones y obstáculos.",
   "Apaga el motor y quita las llaves cada vez que baja del vehículo",
   "La carga la lleva en lugares destinados para ello y no con los pasajeros",
   "Detener vehículo si necesita hablar por teléfono",
   "Caminar sólo por zonas destinadas para tránsito peatonal",
   "Solicitar autorización para transitar cerca de vehículos y/o equipos",
   "Estacionar aculatado y usar cuñas en pendiente"
  ]
 },
 {
  "n": 3,
  "titulo": "Operaciones mineras",
  "items": [
   "Portar radio comunicación programada en frecuencias de la mina.",
   "Delimitar área trabajo: bulldozer, perforadoras con pretiles o conos.",
   "Para cambiar el bits, deben bajar la viga dejarla en posición horizontal y apoyarla en su soporte, operador debe usar guantes adecuados para prevenir quemaduras (soldadores).",
   "Nunca deben perforar dos perforadoras en la misma línea o columna",
   "El camión, deberá aculatar siempre al lado izquierdo del cargador, cuando éste tenga el balde levantado y cargado..",
   "Cuando el camión este cargado, debe tocar bocina el cargador",
   "Para subir en rampa (cambio de pista) y corona de pilas, se debe desplazar por lado izquierdo.",
   "Altura de pretil en pila igual o sobre 1,5 m, es referencia sin chocarlo",
   "Para el giro antes del pretil, deben estar instalados, conos formando cajones de 15 x 30 m., indicaran la distancia de giro a 15 m del pretil.",
   "La cuadratura de pila se descarga el mineral a piso, a 2 m. del pretil.",
   "Ingreso en Mina letreros indican fecha, horario y lugar de tronadura"
  ]
 },
 {
  "n": 4,
  "titulo": "Sustancias peligrosas",
  "items": [
   "Revisa hoja de datos de seguridad (HDS) antes de realizar la tarea.",
   "Conoce el significado del rombo de seguridad y las medidas que se debe optar en que caso con contacto?",
   "Conoce los riesgos de su manipulación, almacenamiento, transporte y desechos",
   "Cuenta con los EPP necesarios para la manipulación de sustancias peligrosas utilizadas en el proceso?",
   "Conoce con los elementos necesarios para mitigar alguna emergencia en caso de derrames y/o fugas?",
   "Se delimito el área en caso de la tarea fuera solo para trabajo de Sust. Pel.?",
   "Se chequeo ducha de emergencia con lavaojos?",
   "Conoce la manera correcta de manipular los EPP, accesorios y materiales contaminados con sustancias peligrosas?",
   "Conoce la manera en como debe actuar en caso de emergencia según el Sub plan de Emergencia?"
  ]
 },
 {
  "n": 5,
  "titulo": "Trabajos de alta temperatura en planta",
  "items": [
   "El personal está debidamente instruido respecto a los peligros del área y equipos con los cuales trabajará",
   "El personal cuenta con el EPP adecuado según procedimiento",
   "El personal conoce los procedimientos de emergencia y vías de evacuación",
   "Cuentan con los elementos para controlar, contener y descontaminar en caso de derrames",
   "Los operadores de caldera poseen acreditación del MINSAL"
  ]
 },
 {
  "n": 6,
  "titulo": "Sistema de bloqueo de energías",
  "items": [
   "Se identifican y aíslan todos los tipos de energías",
   "Se aíslan las energías en su fuente",
   "Se instalan los dispositivos físicos de bloqueo",
   "Comprobó que esta bloqueado el equipo correcto",
   "Verifique que las personas que ejecuten los trabajos hayan bloqueado",
   "Se verifico energía cero previo a los trabajos",
   "Las herramientas eléctricas que están en desuso están desconectadas"
  ]
 },
 {
  "n": 7,
  "titulo": "Protección partes móviles",
  "items": [
   "Empresa cuenta con personal capacitado en el equipo a intervenir y este reconoce los peligros y riesgos que se generan al remover y/o alterar las protección de los equipos intervenidos.",
   "Los interventores conocen los dispositivos de seguridad y paradas de emergencia disponibles",
   "Los interventores utilizan prendas o elementos susceptibles de ser atrapados",
   "El equipo intervenido cuenta con dispositivos necesarios para detener su operación en forma inmediata ante una emergencia",
   "Las protecciones de los equipos retiradas fueron repuestas al finalizar la intervención"
  ]
 },
 {
  "n": 8,
  "titulo": "Trabajo en altura",
  "items": [
   "Se encuentra capacitado para trabajo en altura según el estándar de SQM, además este curso se encuentra vigente?",
   "El trabajador al instalar una escalera verifica que estas se encuentren aseguradas, posean una ángulo 1 a 4 y sobrepase 1 metro en la parte superior.",
   "Utiliza los 3 puntos de apoyo para ascender y descender en escaleras o escalas?",
   "Se verificó que el sistema de protección para trabajos en altura o de restricción detendrá su caída antes de impactar niveles inferiores?",
   "Se realizar checklist de los sistemas y equipos verificando que se encuentren operativos antes y después de cada uso.",
   "Se delimitan y señalizan los sector de trabajo y sus niveles inferiores.",
   "El trabajador se preocupa de que las plataformas y medios de acceso del andamio se encuentren despejados y cuenten con baranda superior, intermedia y rodapiés.",
   "Al desplazarse (andamios, pasarelas o escalas) en altura se encuentra conectado el 100% del tiempo utilizando 2 enganches a diferentes estructuras.",
   "Utiliza bolsos resistentes (de lona, cuero u otro similar) para subir y bajar herramientas por escalas.",
   "Sabe como actuar en caso de emergencia según el sub plan de emergencia?"
  ]
 },
 {
  "n": 9,
  "titulo": "Operaciones de levante",
  "items": [
   "Conoce el peso de la carga a levantar y confecciona protocolo de izaje",
   "Se cuenta con Rigger certificado e identificado",
   "Los equipos y accesorios cuentan con check list",
   "Accesorios se encuentran con el código de colores del mes",
   "Las maniobras se realizan con la velocidad del viento inferior a 30 Km/h",
   "Se cuenta con vientos (cuerda) para controlar la carga",
   "Los trabajadores se ubican fuera de la zona roja durante la operación de izaje",
   "Se delimita el área como zona roja, considerando el largo de la pluma"
  ]
 },
 {
  "n": 10,
  "titulo": "Espacios confinados",
  "items": [
   "Se cuenta con el permiso aprobado por el personal responsable del área",
   "Mide gases previo al ingreso del personal?",
   "Se encuentra capacitado e instruido en el procedimiento de trabajo, los peligros a los que esta expuesto y equipos para trabajo en espacios confinados?",
   "Se realiza el bloqueo de energías que conecten con el espacio confinado a intervenir?",
   "Cuenta con iluminación anti explosiva?",
   "Realiza checklist de los equipos a utilizar para trabajar e ingresar a espacios confinados?",
   "Cuenta con los EPP necesarios para ejecutar el trabajo?",
   "Existen y están operativos los elementos de respaldo frente a emergencias específicas de a cuerdo al permiso (traje autónomo, equipos de extracción, radios, etc)",
   "Conoce la manera en como debe actuar en caso de emergencia según el Sub plan de Emergencia?",
   "Existe un vigilante del trabajo, quien está debidamente entrenado y equipado ante un evento no deseado?",
   "Posee conocimiento sobre que problemas médicos influyen al momento de realizar trabajos en espacios confinados?"
  ]
 },
 {
  "n": 11,
  "titulo": "Trabajos en caliente",
  "items": [
   "Se cuenta con el permiso de trabajo en caliente en terreno con todas las firmas correspondientes",
   "Realizar checklist de los equipos a utilizar.",
   "Se bloquea toda fuente de gases inflamables y oxigeno antes de operar.",
   "Materiales combustibles e inflamables se reubican al menos a 10 metros del área de trabajo.",
   "Verificar que el equipamiento y EPP se encuentren en buenas condiciones de uso.",
   "En caso de esmerilado y soldadura se toman precauciones para que las chispas, escoria incandescentes, pedazos calientes, etc., no expongan a personas, materiales ni equipos.",
   "Los pisos y paredes están limpios de sustancias inflamables",
   "Existe un vigilante del trabajo, quien está debidamente entrenado y equipado",
   "Se cuenta con elementos de mitigación de amagos (extintores adecuados y vigentes, biombos, mantas ignifugas, red contra incendio habilitada, agua, etc) y estos se encuentran al alcance de los operadores",
   "Conoce la manera en como debe actuar en caso de emergencia según el Sub plan de Emergencia?"
  ]
 },
 {
  "n": 12,
  "titulo": "Zona roja",
  "items": [
   "Informar a todo el personal las áreas definidas como Zona Roja (croquis, mapas, letreros, correo electrónico u otros).",
   "Delimitar y señalizar áreas (letreros, pretiles, barreras y otros)",
   "Verificar que se encuentre en el área sólo personal autorizado en el trabajo o proceso a ejecutar",
   "Verificar que los equipos y trabajadores estén equipados con radiotransmisores, para comunicación expedita entre ellos",
   "Al ingresar un trabajador a una zona roja, informa y coordina su ingreso con la supervisión, y lo hace solo si ha recibido la autorización correspondiente.",
   "En caso que la Zona Roja sea invadida por personal ajeno a las operaciones, se debe detener operación e instruir al personal.",
   "El área de movimiento equipos se considera Zona Roja",
   "El área de tronadura se considera Zona Roja."
  ]
 },
 {
  "n": 13,
  "titulo": "Trabajos cruzados",
  "items": [
   "Realiza una planificación y coordinación conjunta antes del inicio de las tareas.",
   "Delimita cada uno de los trabajos que se ejecutan en paralelo",
   "Verifica que las zonas de tránsito peatonal y evacuación se encuentren expeditas y no interfieran en la ejecución de las tareas",
   "Verificar que no se ejecuten trabajos cruzados en un misma vertical",
   "Las maniobras con grúas se realizan en áreas delimitadas como zona roja y fuera del radio de acción de los trabajadores"
  ]
 }
]

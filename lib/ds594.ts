// Check-list de autoevaluación de cumplimiento legal DS 594 (formato «Auditoría DS 594»).
export type ItemDS594 = { n: string, t: string, norma: string, sub: string }
export const DS594: { titulo: string, items: ItemDS594[] }[] = [
 {
  "titulo": "I Aspectos legales",
  "items": [
   {
    "n": "I.1",
    "t": "Los estanques de Almacenamiento de combustible están autorizados (SEC)",
    "norma": "Art. 39 DS 594",
    "sub": "I.A  Condiciones Generales"
   },
   {
    "n": "I.2",
    "t": "Las Instalaciones eléctricas y gas están autorizadas (SEC)",
    "norma": "Art. 39 DS 594",
    "sub": "I.A  Condiciones Generales"
   },
   {
    "n": "I.3",
    "t": "Los Generadores de vapor están autorizados",
    "norma": "Art. 41 DS 594",
    "sub": "I.A  Condiciones Generales"
   },
   {
    "n": "I.4",
    "t": "Los Operadores de Caldera cuentan con autorización",
    "norma": "Art. 41 DS 594",
    "sub": "I.A  Condiciones Generales"
   },
   {
    "n": "I.5",
    "t": "Las calderas cuentan con Libro de vida, registros de pruebas y mantenciones.",
    "norma": "Art. 41 DS 594",
    "sub": "I.A  Condiciones Generales"
   },
   {
    "n": "I.6",
    "t": "Las Instalaciones radiactivas están autorizadas",
    "norma": "Art. 41 DS 594",
    "sub": "I.A  Condiciones Generales"
   },
   {
    "n": "I.7",
    "t": "Los Operadores de equipos radiact. Autorizados",
    "norma": "Art. 41 DS 594",
    "sub": "I.A  Condiciones Generales"
   }
  ]
 },
 {
  "titulo": "II Saneamiento Básico",
  "items": [
   {
    "n": "II.1.1",
    "t": "Existe agua potable",
    "norma": "Art. 12 DS 594",
    "sub": "II.A   Agua Potable"
   },
   {
    "n": "II.1.2",
    "t": "El suministro particular de agua tiene autorización sanitaria",
    "norma": "Art. 14 DS 594",
    "sub": "II.A   Agua Potable"
   },
   {
    "n": "II.1.3",
    "t": "Existen muestreos de calidad del agua y de cloro residual conforme a la frecuencia establecida en la autorización.",
    "norma": "Art. 13 DS 594",
    "sub": "II.A   Agua Potable"
   },
   {
    "n": "II.1.4",
    "t": "Son remitidos a la SEREMI de Salud en forma mensual los resultados de los análisis indicados anteriormente.",
    "norma": "Art. 15 DS 594",
    "sub": "II.A   Agua Potable"
   },
   {
    "n": "II.1.5",
    "t": "El almacenamiento en estanques es adecuado tanto en la cantidad por N° de Trabajadores y calidad (control cloro residual).",
    "norma": "Art. 15 DS 594",
    "sub": "II.A   Agua Potable"
   },
   {
    "n": "II.6",
    "t": "Cuenta con disposición de aguas servidas",
    "norma": "Art. 26 DS 594",
    "sub": "II.B   Aguas Servidas"
   },
   {
    "n": "II.7",
    "t": "La Red Particular de aguas servidas esta autorizada",
    "norma": "Art. 26 DS 594",
    "sub": "II.B   Aguas Servidas"
   },
   {
    "n": "II.8",
    "t": "El sistema de Red esta buen estado de funcionamiento",
    "norma": "Art. 26 DS 594",
    "sub": "II.B   Aguas Servidas"
   },
   {
    "n": "II.9",
    "t": "Existen muestreos de calidad del efluente de las plantas de tratamiento agua conforme a la frecuencia establecida en la autorización.",
    "norma": "Art. 26 DS 594",
    "sub": "II.B   Aguas Servidas"
   },
   {
    "n": "II.10",
    "t": "Son remitidos a la SEREMI de Salud en forma mensual los resultados de los análisis indicados anteriormente.",
    "norma": "Art. 26 DS 594",
    "sub": "II.B   Aguas Servidas"
   },
   {
    "n": "II.11",
    "t": "La Disposición Final esta Autorizada",
    "norma": "",
    "sub": "II.C   Residuos Sólidos Domésticos"
   },
   {
    "n": "II.12",
    "t": "La Disposición esta de acuerdo a lo autorizado",
    "norma": "",
    "sub": "II.C   Residuos Sólidos Domésticos"
   },
   {
    "n": "II.13",
    "t": "Están en cantidad suficiente",
    "norma": "Art. 23 DS 594",
    "sub": "II.D   Servicios higiénicos"
   },
   {
    "n": "II.14",
    "t": "Están en buen estado de funcionamiento",
    "norma": "Art. 22 DS 594",
    "sub": "II.D   Servicios higiénicos"
   },
   {
    "n": "II.15",
    "t": "Se encuentran separados por sexo",
    "norma": "Art. 22 DS 594",
    "sub": "II.D   Servicios higiénicos"
   },
   {
    "n": "II.16",
    "t": "Existen letrinas o baño químico en cantidad suficiente",
    "norma": "Art. 24 DS 594",
    "sub": "II.D   Servicios higiénicos"
   },
   {
    "n": "II.17",
    "t": "Están en cantidad suficiente",
    "norma": "Art. 23 DS 594",
    "sub": "II.E   Duchas"
   },
   {
    "n": "II.18",
    "t": "Están en buen estado de funcionamiento",
    "norma": "Art. 22 DS 594",
    "sub": "II.E   Duchas"
   },
   {
    "n": "II.19",
    "t": "Tienen con agua caliente",
    "norma": "Art. 21 DS 594",
    "sub": "II.E   Duchas"
   },
   {
    "n": "II.20",
    "t": "Están separadas por sexo",
    "norma": "Art. 22 DS 594",
    "sub": "II.E   Duchas"
   },
   {
    "n": "II.21",
    "t": "Salas o Módulos separados por sexo",
    "norma": "Art. 27 DS 594",
    "sub": "II.E   Salas y guadarropas"
   },
   {
    "n": "II.22",
    "t": "Está protegida de las condiciones climáticas externas",
    "norma": "Art. 27 DS 594",
    "sub": "II.E   Salas y guadarropas"
   },
   {
    "n": "II.23",
    "t": "Tiene un casillero guardarropas para cada trabajador",
    "norma": "Art. 27 DS 594",
    "sub": "II.E   Salas y guadarropas"
   },
   {
    "n": "II.24",
    "t": "Casilleros dobles para cada trabajador que manipula o está expuesto a sustancias tóxicas e infecciosas.",
    "norma": "Art. 27 DS 594",
    "sub": "II.E   Salas y guadarropas"
   },
   {
    "n": "II.25",
    "t": "Está aislado del área de trabajo",
    "norma": "Art. 28 DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.26",
    "t": "La cubierta de la mesa es lavable",
    "norma": "Art. 28 DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.27",
    "t": "Condición adecuada de sillas o asientos.",
    "norma": "Art. 28 DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.28",
    "t": "Dispone de lavaplatos",
    "norma": "Art. 28DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.29",
    "t": "Posee agua potable",
    "norma": "Art. 28 DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.30",
    "t": "Dispone de Cocinillas",
    "norma": "Art. 28 DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.31",
    "t": "Tiene medio de refrigeración de alimentos",
    "norma": "Art. 28 DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.32",
    "t": "Si es un comedor móvil, cumple con los requisitos",
    "norma": "Art. 30 DS 594",
    "sub": "II.F   Comedor"
   },
   {
    "n": "II.33",
    "t": "Se dispone de alojamiento en el lugar",
    "norma": "Art. 9° D.S. 594",
    "sub": "II.G  Alojamiento"
   },
   {
    "n": "II.34",
    "t": "Es de construcción adecuada (aislado de condiciones climáticas externas)",
    "norma": "Art. 9° D.S. 594",
    "sub": "II.G  Alojamiento"
   },
   {
    "n": "II.35",
    "t": "Los pisos y paredes están en buen estado",
    "norma": "Art. 9° D.S. 594",
    "sub": "II.G  Alojamiento"
   },
   {
    "n": "II.36",
    "t": "Hay buena ventilación",
    "norma": "Art. 9° D.S. 594",
    "sub": "II.G  Alojamiento"
   },
   {
    "n": "II.37",
    "t": "El casino cuenta con autorización sanitaria",
    "norma": "Art. 31° D.S. 594",
    "sub": "II.G Casinos"
   }
  ]
 },
 {
  "titulo": "III Manejo de residuos industriales (RILES y RISES)",
  "items": [
   {
    "n": "III.1",
    "t": "El Manejo y disposición final de residuos industriales líquidos y sólidos esta autorizado",
    "norma": "Art. 18° D.S. 594",
    "sub": ""
   },
   {
    "n": "III.2",
    "t": "La Acumulación, tratamiento y disposición final se ajusta a lo autorizado",
    "norma": "Art. 18° D.S. 594",
    "sub": ""
   },
   {
    "n": "III.3",
    "t": "Existen controles o registros sobre ingreso y salidas de residuos peligrosos y no peligrosos hacia los vertederos.",
    "norma": "Art. 18° D.S. 594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "IV Condiciones estructurales",
  "items": [
   {
    "n": "IV.1",
    "t": "Los pisos son de material sólido no resbaladizo",
    "norma": "Art. 5 DS 594",
    "sub": ""
   },
   {
    "n": "IV.2",
    "t": "El espacio de trabajo es adecuado al número de trabajadores",
    "norma": "Art. 8 DS 594",
    "sub": ""
   },
   {
    "n": "IV.3",
    "t": "Pisos limpios, sin desperdicios o residuos líquidos o sólidos.",
    "norma": "Art. 7 DS 594",
    "sub": ""
   },
   {
    "n": "IV.4",
    "t": "Las paredes están en buen estado mantenimiento",
    "norma": "Art. 6 DS 594",
    "sub": ""
   },
   {
    "n": "IV.5",
    "t": "Pasillos de circulación libres de obstáculos",
    "norma": "Art. 37 DS 594",
    "sub": ""
   },
   {
    "n": "IV.6",
    "t": "Vías de escapes despejadas y señalizadas",
    "norma": "Art. 6 DS 594",
    "sub": ""
   },
   {
    "n": "IV.7",
    "t": "El lugar tiene buena ventilación",
    "norma": "Art. 32 DS 594",
    "sub": ""
   },
   {
    "n": "IV.8",
    "t": "El lugar tiene buena iluminación",
    "norma": "Art. 103 DS 594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "V Elementos de protección personal",
  "items": [
   {
    "n": "V.1",
    "t": "Utiliza los EPP adecuados al riesgo ( Acc. y Enf. Prof.)",
    "norma": "Art. 53 DS 594",
    "sub": ""
   },
   {
    "n": "V.2",
    "t": "Están en buen estado mantención",
    "norma": "Art. 53 DS 594",
    "sub": ""
   },
   {
    "n": "V.3",
    "t": "Se disponen en cantidad suficiente según numero de trabajadores",
    "norma": "Art. 53 DS 594",
    "sub": ""
   },
   {
    "n": "V.4",
    "t": "Los EPP son certificados (Los que corresponda)",
    "norma": "Art. 54 DS 594",
    "sub": ""
   },
   {
    "n": "V.5",
    "t": "Son usados por trabajadores cuando están expuestos al riesgo.",
    "norma": "Art. 53 DS 594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "VI Maquinaria automotriz",
  "items": [
   {
    "n": "VI.1",
    "t": "El conductores poseen licencias de conducir exigidas por la ley de transito",
    "norma": "Art. 43 D.S.594",
    "sub": ""
   },
   {
    "n": "VI.2",
    "t": "Los vehículos cuentan con certificación interna SQM",
    "norma": "Art. 43 D.S.594",
    "sub": ""
   },
   {
    "n": "VI.3",
    "t": "Los conductores poseen exámenes psicosensotécnicos",
    "norma": "Art. 43 D.S.594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "VII Maquinaria o equipos estacionarios",
  "items": [
   {
    "n": "VII.1",
    "t": "Posee las protecciones necesarias (en partes móviles, calientes, cortantes,etc).",
    "norma": "Art. 38 D.S.594",
    "sub": ""
   },
   {
    "n": "VII.2",
    "t": "Tiene dispositivos de seguridad ( botón de parada automática)",
    "norma": "Art. 36 D.S. 594",
    "sub": ""
   },
   {
    "n": "VII.3",
    "t": "Existe espacio suficiente entre un equipo y otro (para movimiento seguro de trabajadores).",
    "norma": "Art. 8 D.S. 594",
    "sub": ""
   },
   {
    "n": "VII.4",
    "t": "Hay avisos de seguridad (idioma español e ingles) en el lugar donde están las máquinas y se identifica la necesidad de elementos de protección.",
    "norma": "Art. 37 D.S. 594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "VIII Protección contra incendios",
  "items": [
   {
    "n": "VIII.1",
    "t": "Existen extintores de incendios en cantidad suficiente según norma",
    "norma": "Art. 44 D.S. 594",
    "sub": ""
   },
   {
    "n": "VIII.2",
    "t": "Son adecuados al tipo de combustible",
    "norma": "Art. 45 y 50 D.S. 594",
    "sub": ""
   },
   {
    "n": "VIII.3",
    "t": "Está bien ubicado",
    "norma": "Art. 47D.S. 594",
    "sub": ""
   },
   {
    "n": "VIII.4",
    "t": "Está en buen estado de funcionamiento, con revisión técnica vigente",
    "norma": "Art. 51 D.S. 594",
    "sub": ""
   },
   {
    "n": "VIII.5",
    "t": "Tiene la etiqueta completa, en buen estado",
    "norma": "Art. 45 D.S. 594",
    "sub": ""
   },
   {
    "n": "VIII.6",
    "t": "Los trabajadores han sido capacitados en el uso de extintores",
    "norma": "Art. 48 D.S. 594",
    "sub": ""
   },
   {
    "n": "VIII.7",
    "t": "Las redes contra incendio se encuentran en buen estado de funcionamiento",
    "norma": "Art. 48 D.S. 594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "IX Sustancias peligrosas",
  "items": [
   {
    "n": "IX.1",
    "t": "Son Almacenados en recintos específicos destinados para tales efectos, en las condiciones adecuadas a las características de cada sustancia.",
    "norma": "Art. 42 D.S. 594",
    "sub": ""
   },
   {
    "n": "IX.2",
    "t": "Se encuentran identificadas de acuerdo a las normas chilenas oficiales",
    "norma": "Art. 42 D.S. 594",
    "sub": ""
   },
   {
    "n": "IX.3",
    "t": "Existen Planes de emergencias",
    "norma": "Art. 42 D.S. 594",
    "sub": ""
   },
   {
    "n": "IX.4",
    "t": "Se encuentran disponibles las HDS de los productos.",
    "norma": "Art. 42 D.S. 594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "X Higiene ocupacional",
  "items": [
   {
    "n": "X.1",
    "t": "Los trabajadores han sido informados acerca de los riesgos que conlleva la exposición a agentes del tipo físico, químico y biológico, de las medidas preventivas y de los métodos de trabajo correctos",
    "norma": "Art. 57 D.S. 594",
    "sub": ""
   },
   {
    "n": "X.2",
    "t": "Las operaciones que emiten aerosoles o gases nocivos para la salud, se realizan en áreas bien ventiladas o con aspiración forzada",
    "norma": "Art. 32 D.S. 594",
    "sub": ""
   },
   {
    "n": "X.3",
    "t": "Cuando los Trabajadores se exponen a agentes químicos (Polvos, humos, Gases y vapores) usan protección personal adecuada al riesgo.",
    "norma": "Art. 53 D.S. 594",
    "sub": ""
   },
   {
    "n": "X.4",
    "t": "Cuando existe exposición a bajas temperaturas los trabajadores usan ropa térmica.",
    "norma": "Art. 100 D.S. 594",
    "sub": ""
   },
   {
    "n": "X.5",
    "t": "Cuando existe exposición a altas temperaturas se realizan pausas de no exposición.",
    "norma": "Art. 96 D.S. 594",
    "sub": ""
   },
   {
    "n": "X.6",
    "t": "Los Trabajadores expuestos a altas temperaturas disponen de agua y sales para su consumo",
    "norma": "Art. 96 D.S. 594",
    "sub": ""
   },
   {
    "n": "X.7",
    "t": "Cuando los Trabajadores se exponen a ruido cuyo nivel no permite la comunicación hablada a un metro de distancia usan protección auditiva personal.",
    "norma": "Art. 82 D.S. 594",
    "sub": ""
   }
  ]
 },
 {
  "titulo": "XI Radiación ultravioleta (UV)",
  "items": [
   {
    "n": "XI.1",
    "t": "Se informa a los trabajadores sobre los riesgos específicos de exposición laboral a radiación UV de origen solar y sus medidas de control.",
    "norma": "Art. 109 b - D.S. 594",
    "sub": ""
   },
   {
    "n": "XI.2",
    "t": "Se publica diariamente en un lugar visible el índice UV estimado, señalado por la Dirección Meteorologica de Chile y las medidas de control que se deben aplicar, incluidos los elementos de protección personal.",
    "norma": "Art. 109 b - D.S. 594",
    "sub": ""
   },
   {
    "n": "XI.3",
    "t": "Se identifican los trabajadores expuestos; detectando los puestos de trabajo e individuos que requieran medidas de protección adicionales y se verifica la efectividad de las medidas implementadas a su respecto.",
    "norma": "Art. 109 b - D.S. 594",
    "sub": ""
   },
   {
    "n": "XI.4",
    "t": "En los Lugares de Trabajo fijos al intemperie, se realiza un adecuado sombraje para disminuir la exposición directa a la radiación UV tales como techar, arborizar, mallas oscuras y de trama tupida, parabrisas adecuados.",
    "norma": "Art. 109 b - D.S. 594",
    "sub": ""
   },
   {
    "n": "XI.5",
    "t": "Si la labor lo permite, se calendarizan faenas, horarios de colación entre 13:00 y las 15:00 hrs. en lugares con sombraje adecuado, rotación de puestos de trabajo con la disminución de tiempo de exposición.",
    "norma": "Art. 109 b - D.S. 594",
    "sub": ""
   },
   {
    "n": "XI.6",
    "t": "Se dispone de elementos de protección personal, según el grado de exposición, tales como gorros, lentes, factor de protección solar; y el personal ha sido instruido para su correcto uso.",
    "norma": "Art. 109 b - D.S. 594",
    "sub": ""
   },
   {
    "n": "XI.7",
    "t": "Se mantiene un programa, por escrito, de instrucción teórico práctico para los trabajadores, de duración mínima de una hora cronológica semestral, sobre el riesgo y consecuencias para la salud por la exposición a radiación UV solar y medidas preventivas a considerar, entre otros.",
    "norma": "Art. 109 b - D.S. 594",
    "sub": ""
   }
  ]
 }
]
export const TOTAL_DS594 = DS594.reduce((s, x) => s + x.items.length, 0)

// hce_seed.js
(function () {
  db = db.getSiblingDB("hce_hospitalizacion");
  const F = s => ISODate(s + ":00Z");
  const oid = { bsonType: "objectId" }, str = { bsonType: "string" }, dt = { bsonType: "date" }, num = { bsonType: "number" };
  // Borrado previo de colecciones para poder re-ejecutar
  ["signos_vitales", "notas_enfermeria", "evoluciones", "hospitalizaciones", "medicamentos", "profesionales", "diagnosticos_cie10", "pacientes"].forEach(c => db.getCollection(c).drop());
  // Colecciones con validadores $jsonSchema e índices
  db.createCollection("pacientes", { validator: { $jsonSchema: {
    bsonType: "object",
    required: ["tipo_documento", "numero_documento", "nombres", "apellidos", "fecha_nacimiento", "sexo"],
    properties: {
      tipo_documento: { enum: ["CC", "TI", "CE", "PA", "RC"] }, numero_documento: str,
      nombres: str, apellidos: str, fecha_nacimiento: dt, sexo: { enum: ["M", "F", "O"] },
      telefono: str, direccion: str, eps: str } } } });
  db.pacientes.createIndex({ tipo_documento: 1, numero_documento: 1 }, { unique: true });
  db.createCollection("profesionales", { validator: { $jsonSchema: {
    bsonType: "object", required: ["registro_medico", "nombres", "apellidos", "rol"],
    properties: { registro_medico: str, nombres: str, apellidos: str,
      rol: { enum: ["medico", "enfermero", "especialista"] }, especialidad: str } } } });
  db.profesionales.createIndex({ registro_medico: 1 }, { unique: true });
  db.createCollection("medicamentos", { validator: { $jsonSchema: {
    bsonType: "object", required: ["codigo", "nombre_generico", "forma", "concentracion", "activo"],
    properties: { codigo: str, nombre_generico: str, forma: str, concentracion: str, activo: { bsonType: "bool" } } } } });
  db.medicamentos.createIndex({ codigo: 1 }, { unique: true });
  db.medicamentos.createIndex({ nombre_generico: "text" });
  db.createCollection("diagnosticos_cie10", { validator: { $jsonSchema: {
    bsonType: "object", required: ["_id", "descripcion"],
    properties: { _id: str, descripcion: str, capitulo: str } } } });
  db.diagnosticos_cie10.createIndex({ descripcion: "text" });
  db.createCollection("hospitalizaciones", { validator: { $jsonSchema: {
    bsonType: "object", required: ["paciente_id", "numero_ingreso", "estado", "admision", "diagnosticos"],
    properties: {
      paciente_id: oid, numero_ingreso: str, estado: { enum: ["activa", "alta"] },
      admision: { bsonType: "object",
        required: ["fecha", "via_ingreso", "servicio", "cama", "motivo_consulta", "profesional_id"],
        properties: { fecha: dt, via_ingreso: { enum: ["urgencias", "consulta_externa", "remision"] },
          servicio: str, cama: str, motivo_consulta: str, profesional_id: oid } },
      diagnosticos: { bsonType: "array", minItems: 1, maxItems: 20, items: { bsonType: "object",
        required: ["cie10_codigo", "tipo", "fecha"],
        properties: { cie10_codigo: str, tipo: { enum: ["ingreso", "principal", "secundario", "egreso"] }, fecha: dt } } },
      tratamientos: { bsonType: "array", maxItems: 100, items: { bsonType: "object",
        required: ["medicamento_id", "dosis", "via", "frecuencia", "fecha_inicio", "prescribe_id"],
        properties: { medicamento_id: oid, dosis: str, via: { enum: ["oral", "IV", "IM", "SC", "topica", "inhalada"] },
          frecuencia: str, fecha_inicio: dt, fecha_fin: dt, prescribe_id: oid } } },
      alta: { bsonType: "object", required: ["fecha", "tipo", "diagnostico_egreso", "profesional_id"],
        properties: { fecha: dt, tipo: { enum: ["mejoria", "remision", "voluntaria", "fallecimiento"] },
          diagnostico_egreso: str, indicaciones: str, profesional_id: oid } } } } } });
  db.hospitalizaciones.createIndex({ paciente_id: 1, "admision.fecha": -1 });
  db.hospitalizaciones.createIndex({ numero_ingreso: 1 }, { unique: true });
  db.hospitalizaciones.createIndex({ estado: 1, "admision.servicio": 1 });
  db.hospitalizaciones.createIndex({ "diagnosticos.cie10_codigo": 1 });
  const hijo = (extra, req) => ({ validator: { $jsonSchema: { bsonType: "object",
    required: ["hospitalizacion_id", "fecha", "profesional_id", ...req],
    properties: { hospitalizacion_id: oid, fecha: dt, profesional_id: oid, ...extra } } } });
  db.createCollection("signos_vitales", hijo({ fc: num, fr: num, temp: num, sat_o2: num, ta_sis: num, ta_dia: num }, ["fc", "fr", "temp", "sat_o2", "ta_sis", "ta_dia"]));
  db.createCollection("notas_enfermeria", hijo({ nota: str, turno: { enum: ["manana", "tarde", "noche"] } }, ["nota", "turno"]));
  db.createCollection("evoluciones", hijo({ subjetivo: str, objetivo: str, analisis: str, plan: str }, ["subjetivo", "objetivo", "analisis", "plan"]));
  ["signos_vitales", "notas_enfermeria", "evoluciones"].forEach(c => db.getCollection(c).createIndex({ hospitalizacion_id: 1, fecha: -1 }));
  // Identificadores compartidos entre colecciones
  const pa = Array.from({ length: 6 }, () => ObjectId());
  const pr = Array.from({ length: 7 }, () => ObjectId());
  const me = Array.from({ length: 12 }, () => ObjectId());
  const ho = Array.from({ length: 6 }, () => ObjectId());
  // Catálogos
  db.diagnosticos_cie10.insertMany([
    { _id: "J18.9", descripcion: "Neumonía, no especificada", capitulo: "X" },
    { _id: "I50.9", descripcion: "Insuficiencia cardíaca, no especificada", capitulo: "IX" },
    { _id: "E11.1", descripcion: "Diabetes mellitus tipo 2 con cetoacidosis", capitulo: "IV" },
    { _id: "N39.0", descripcion: "Infección de vías urinarias, sitio no especificado", capitulo: "XIV" },
    { _id: "J44.1", descripcion: "Enfermedad pulmonar obstructiva crónica con exacerbación aguda", capitulo: "X" },
    { _id: "I10", descripcion: "Hipertensión esencial (primaria)", capitulo: "IX" },
    { _id: "R50.9", descripcion: "Fiebre, no especificada", capitulo: "XVIII" },
    { _id: "A09", descripcion: "Diarrea y gastroenteritis de presunto origen infeccioso", capitulo: "I" },
    { _id: "K35.8", descripcion: "Apendicitis aguda, otra y la no especificada", capitulo: "XI" },
    { _id: "I21.9", descripcion: "Infarto agudo del miocardio, sin otra especificación", capitulo: "IX" }]);
  db.profesionales.insertMany([
    { _id: pr[0], registro_medico: "RM-0001", nombres: "Laura", apellidos: "Restrepo Vélez", rol: "medico", especialidad: "Medicina interna" },
    { _id: pr[1], registro_medico: "RM-0002", nombres: "Andrés", apellidos: "Villegas Toro", rol: "especialista", especialidad: "Cardiología" },
    { _id: pr[2], registro_medico: "RM-0003", nombres: "Marcela", apellidos: "Ospina Duque", rol: "especialista", especialidad: "Neumología" },
    { _id: pr[3], registro_medico: "RM-0004", nombres: "Hernán", apellidos: "Quintero Pareja", rol: "medico", especialidad: "Urgencias" },
    { _id: pr[4], registro_medico: "RE-0005", nombres: "Carlos", apellidos: "Mejía Uribe", rol: "enfermero" },
    { _id: pr[5], registro_medico: "RE-0006", nombres: "Diana", apellidos: "Zapata Gil", rol: "enfermero" },
    { _id: pr[6], registro_medico: "RE-0007", nombres: "Julián", apellidos: "Cardona Ruiz", rol: "enfermero" }]);
  db.medicamentos.insertMany([
    { _id: me[0], codigo: "MED-001", nombre_generico: "Ceftriaxona", forma: "Inyectable", concentracion: "1 g", activo: true },
    { _id: me[1], codigo: "MED-002", nombre_generico: "Azitromicina", forma: "Tableta", concentracion: "500 mg", activo: true },
    { _id: me[2], codigo: "MED-003", nombre_generico: "Paracetamol", forma: "Tableta", concentracion: "500 mg", activo: true },
    { _id: me[3], codigo: "MED-004", nombre_generico: "Enoxaparina", forma: "Jeringa prellenada", concentracion: "40 mg/0.4 mL", activo: true },
    { _id: me[4], codigo: "MED-005", nombre_generico: "Furosemida", forma: "Ampolla inyectable", concentracion: "20 mg/2 mL", activo: true },
    { _id: me[5], codigo: "MED-006", nombre_generico: "Insulina glargina", forma: "Solución inyectable", concentracion: "100 UI/mL", activo: true },
    { _id: me[6], codigo: "MED-007", nombre_generico: "Omeprazol", forma: "Cápsula", concentracion: "20 mg", activo: true },
    { _id: me[7], codigo: "MED-008", nombre_generico: "Salbutamol", forma: "Inhalador", concentracion: "100 mcg/dosis", activo: true },
    { _id: me[8], codigo: "MED-009", nombre_generico: "Metoprolol", forma: "Tableta", concentracion: "50 mg", activo: true },
    { _id: me[9], codigo: "MED-010", nombre_generico: "Ácido acetilsalicílico", forma: "Tableta", concentracion: "100 mg", activo: true },
    { _id: me[10], codigo: "MED-011", nombre_generico: "Dexametasona", forma: "Solución inyectable", concentracion: "4 mg/mL", activo: true },
    { _id: me[11], codigo: "MED-012", nombre_generico: "Insulina regular", forma: "Solución inyectable", concentracion: "100 UI/mL", activo: true }]);
  db.pacientes.insertMany([
    { _id: pa[0], tipo_documento: "CC", numero_documento: "1000000001", nombres: "Juan Camilo", apellidos: "Pérez Gómez", fecha_nacimiento: F("1985-03-12T00:00"), sexo: "M", telefono: "3000000001", direccion: "Calle 1 # 2-3, Medellín", eps: "EPS Ficticia Sur" },
    { _id: pa[1], tipo_documento: "CC", numero_documento: "1000000002", nombres: "María Fernanda", apellidos: "Gómez Ruiz", fecha_nacimiento: F("1979-07-25T00:00"), sexo: "F", telefono: "3000000002", direccion: "Carrera 10 # 20-30, Bello", eps: "EPS Ficticia Norte" },
    { _id: pa[2], tipo_documento: "CC", numero_documento: "1000000003", nombres: "Luis Alberto", apellidos: "Torres Mora", fecha_nacimiento: F("1958-11-02T00:00"), sexo: "M", telefono: "3000000003", direccion: "Calle 50 # 40-10, Envigado", eps: "EPS Ficticia Sur" },
    { _id: pa[3], tipo_documento: "CC", numero_documento: "1000000004", nombres: "Ana Sofía", apellidos: "Cardona Londoño", fecha_nacimiento: F("1992-05-19T00:00"), sexo: "F", telefono: "3000000004", direccion: "Carrera 70 # 30-15, Medellín", eps: "EPS Ficticia Centro" },
    { _id: pa[4], tipo_documento: "CC", numero_documento: "1000000005", nombres: "Pedro Pablo", apellidos: "Salazar Henao", fecha_nacimiento: F("1950-01-30T00:00"), sexo: "M", telefono: "3000000005", direccion: "Calle 30 # 55-20, Itagüí", eps: "EPS Ficticia Norte" },
    { _id: pa[5], tipo_documento: "CC", numero_documento: "1000000006", nombres: "Valentina", apellidos: "Ríos Arango", fecha_nacimiento: F("2001-09-14T00:00"), sexo: "F", telefono: "3000000006", direccion: "Carrera 43A # 10-5, Medellín", eps: "EPS Ficticia Centro" }]);
  // Funciones auxiliares para construir hospitalizaciones y registros hijos
  const ad = (f, via, serv, cama, mot, prof) => ({ fecha: F(f), via_ingreso: via, servicio: serv, cama: cama, motivo_consulta: mot, profesional_id: prof });
  const al = (f, tipo, dg, ind, prof) => ({ fecha: F(f), tipo: tipo, diagnostico_egreso: dg, indicaciones: ind, profesional_id: prof });
  const dx = rows => rows.map(r => ({ cie10_codigo: r[0], tipo: r[1], fecha: F(r[2]) }));
  const tx = rows => rows.map(r => { const o = { medicamento_id: r[0], dosis: r[1], via: r[2], frecuencia: r[3], fecha_inicio: F(r[4]), prescribe_id: r[6] }; if (r[5]) o.fecha_fin = F(r[5]); return o; });
  const hs = (id, pac, num, estado, adm, diag, trat, alta) => { const d = { _id: id, paciente_id: pac, numero_ingreso: num, estado: estado, admision: adm, diagnosticos: diag, tratamientos: trat }; if (alta) d.alta = alta; db.hospitalizaciones.insertOne(d); };
  const sv = (h, rows) => db.signos_vitales.insertMany(rows.map(r => ({ hospitalizacion_id: h, fecha: F(r[0]), profesional_id: r[1], fc: r[2], fr: r[3], temp: r[4], sat_o2: r[5], ta_sis: r[6], ta_dia: r[7] })));
  const nt = (h, rows) => db.notas_enfermeria.insertMany(rows.map(r => ({ hospitalizacion_id: h, fecha: F(r[0]), profesional_id: r[1], turno: r[2], nota: r[3] })));
  const ev = (h, rows) => db.evoluciones.insertMany(rows.map(r => ({ hospitalizacion_id: h, fecha: F(r[0]), profesional_id: r[1], subjetivo: r[2], objetivo: r[3], analisis: r[4], plan: r[5] })));
  // Hospitalización 1: neumonía (Juan Camilo), con alta
  hs(ho[0], pa[0], "HOS-2026-0001", "alta",
    ad("2026-10-01T08:30", "urgencias", "Medicina interna", "M-12", "Fiebre y tos productiva de 4 días", pr[3]),
    dx([["J18.9", "ingreso", "2026-10-01T09:00"], ["R50.9", "secundario", "2026-10-01T09:00"], ["J18.9", "principal", "2026-10-02T08:00"], ["J18.9", "egreso", "2026-10-06T10:00"]]),
    tx([[me[0], "1 g", "IV", "cada 24 h", "2026-10-01T10:00", "2026-10-06T10:00", pr[0]], [me[1], "500 mg", "oral", "cada 24 h", "2026-10-01T10:30", "2026-10-04T10:30", pr[0]], [me[2], "500 mg", "oral", "cada 8 h si fiebre", "2026-10-01T10:00", "2026-10-03T10:00", pr[0]]]),
    al("2026-10-06T11:00", "mejoria", "J18.9", "Control ambulatorio en 7 días y signos de alarma respiratoria", pr[0]));
  ev(ho[0], [
    ["2026-10-01T16:00", pr[0], "Tos con expectoración, fiebre y malestar general.", "T 38.4 °C, FR 22, estertores en base derecha, SatO2 93%.", "Neumonía adquirida en comunidad moderada.", "Ceftriaxona IV, azitromicina y oxígeno si hay desaturación."],
    ["2026-10-03T08:00", pr[0], "Menos tos, sin disnea.", "Afebril 24 h, SatO2 95% en aire ambiente.", "Respuesta clínica favorable.", "Continuar antibiótico y vigilar signos vitales."],
    ["2026-10-05T08:00", pr[0], "Asintomático, tolera vía oral.", "Afebril, SatO2 96%, murmullo vesicular conservado.", "Neumonía en resolución.", "Programar egreso al completar el esquema."]]);
  sv(ho[0], [
    ["2026-10-01T12:00", pr[4], 92, 22, 38.4, 93, 120, 80], ["2026-10-01T20:00", pr[5], 96, 24, 38.9, 92, 118, 76],
    ["2026-10-02T08:00", pr[4], 88, 20, 37.8, 94, 122, 78], ["2026-10-03T08:00", pr[4], 82, 18, 37.1, 95, 120, 80],
    ["2026-10-04T08:00", pr[4], 78, 18, 36.8, 96, 118, 76], ["2026-10-05T08:00", pr[5], 76, 16, 36.6, 97, 116, 74]]);
  nt(ho[0], [
    ["2026-10-01T14:00", pr[4], "tarde", "Ingresa febril, se administra primera dosis de antibiótico y se inicia oxígeno por cánula."],
    ["2026-10-02T22:00", pr[5], "noche", "Paciente descansa, sin picos febriles, tolera dieta."],
    ["2026-10-04T09:00", pr[4], "manana", "Deambula con apoyo, saturación estable en aire ambiente."]]);
  // Hospitalización 2: neumonía (María Fernanda), mismo diagnóstico principal, con alta
  hs(ho[1], pa[1], "HOS-2026-0002", "alta",
    ad("2026-10-03T14:10", "urgencias", "Medicina interna", "M-14", "Tos, fiebre y dificultad respiratoria de 3 días", pr[3]),
    dx([["J18.9", "ingreso", "2026-10-03T14:40"], ["J18.9", "principal", "2026-10-04T08:00"], ["I10", "secundario", "2026-10-04T08:00"], ["J18.9", "egreso", "2026-10-09T10:00"]]),
    tx([[me[0], "1 g", "IV", "cada 24 h", "2026-10-03T15:00", "2026-10-08T15:00", pr[2]], [me[1], "500 mg", "oral", "cada 24 h", "2026-10-03T15:30", "2026-10-06T15:30", pr[2]], [me[8], "50 mg", "oral", "cada 12 h", "2026-10-04T09:00", "2026-10-09T09:00", pr[0]]]),
    al("2026-10-09T11:30", "mejoria", "J18.9", "Control por consulta externa en 8 días y continuar antihipertensivo", pr[2]));
  ev(ho[1], [
    ["2026-10-04T08:00", pr[2], "Persisten tos y disnea de esfuerzo.", "FR 24, SatO2 92%, crépitos en base izquierda.", "Neumonía adquirida en comunidad en paciente hipertensa.", "Antibioticoterapia IV, oxígeno suplementario y continuar antihipertensivo."],
    ["2026-10-06T08:00", pr[2], "Mejoría de la disnea, tos menos frecuente.", "Afebril, SatO2 95% en aire ambiente.", "Evolución favorable.", "Continuar ceftriaxona IV y retirar oxígeno."],
    ["2026-10-08T08:00", pr[0], "Sin disnea, buen apetito.", "Afebril, SatO2 96%, TA 124/80.", "Neumonía resuelta clínicamente.", "Egreso programado en 24 horas."]]);
  sv(ho[1], [
    ["2026-10-03T16:00", pr[4], 100, 24, 38.6, 91, 150, 92], ["2026-10-03T22:00", pr[6], 98, 24, 38.2, 92, 146, 90],
    ["2026-10-04T08:00", pr[4], 90, 22, 37.5, 92, 142, 88], ["2026-10-05T08:00", pr[5], 84, 20, 37, 94, 134, 84],
    ["2026-10-07T08:00", pr[4], 78, 18, 36.7, 96, 126, 80], ["2026-10-08T08:00", pr[5], 76, 16, 36.6, 96, 124, 80]]);
  nt(ho[1], [
    ["2026-10-03T18:00", pr[5], "tarde", "Se inicia oxígeno por cánula a 2 L/min, tolera bien."],
    ["2026-10-05T07:30", pr[6], "manana", "Refiere tos nocturna, se eleva cabecera y se administra medicación según orden."],
    ["2026-10-07T21:00", pr[6], "noche", "Sueño continuo, sin disnea, signos vitales estables."]]);
  // Hospitalización 3: insuficiencia cardíaca (Luis Alberto), ACTIVA sin alta
  hs(ho[2], pa[2], "HOS-2026-0003", "activa",
    ad("2026-10-22T19:20", "urgencias", "Cardiología", "C-05", "Disnea progresiva y edema de miembros inferiores", pr[3]),
    dx([["I50.9", "ingreso", "2026-10-22T20:00"], ["I50.9", "principal", "2026-10-23T08:00"], ["I10", "secundario", "2026-10-23T08:00"]]),
    tx([[me[4], "40 mg", "IV", "cada 12 h", "2026-10-22T21:00", null, pr[1]], [me[3], "40 mg", "SC", "cada 24 h", "2026-10-23T09:00", null, pr[1]], [me[8], "50 mg", "oral", "cada 12 h", "2026-10-24T09:00", null, pr[1]], [me[6], "20 mg", "oral", "cada 24 h", "2026-10-23T09:00", null, pr[1]]]),
    null);
  ev(ho[2], [
    ["2026-10-23T08:00", pr[1], "Disnea de reposo mejor, ortopnea de dos almohadas.", "Edema grado II, crépitos bibasales, SatO2 91% en aire ambiente.", "Insuficiencia cardíaca descompensada.", "Diuresis IV, balance hídrico estricto y restricción de sodio."],
    ["2026-10-24T08:00", pr[1], "Menos disnea, orinó abundante durante la noche.", "Peso -2 kg, SatO2 94%, edema grado I.", "Respuesta adecuada al diurético.", "Continuar furosemida IV e iniciar betabloqueador."],
    ["2026-10-25T08:00", pr[0], "Sin ortopnea, duerme bien.", "Edema leve, SatO2 95%, TA 118/72.", "Mejoría progresiva, continúa hospitalizado.", "Valorar paso a diurético oral en 24 a 48 horas."]]);
  sv(ho[2], [
    ["2026-10-22T20:00", pr[6], 104, 26, 36.8, 90, 158, 96], ["2026-10-23T08:00", pr[4], 98, 24, 36.7, 91, 150, 92],
    ["2026-10-23T20:00", pr[6], 92, 22, 36.6, 93, 142, 88], ["2026-10-24T08:00", pr[4], 88, 20, 36.6, 94, 134, 84],
    ["2026-10-24T20:00", pr[6], 84, 18, 36.5, 95, 126, 78], ["2026-10-25T08:00", pr[4], 80, 18, 36.6, 95, 118, 72]]);
  nt(ho[2], [
    ["2026-10-22T22:00", pr[6], "noche", "Ingresa con edema de miembros inferiores, se inicia monitoreo y control de líquidos."],
    ["2026-10-23T15:00", pr[4], "tarde", "Diuresis de 1800 mL en 8 horas, tolera dieta hiposódica."],
    ["2026-10-24T10:00", pr[5], "manana", "Se pesa al paciente, disminución de 2 kg, sin disnea en reposo."]]);
  // Hospitalización 4: infección urinaria (Ana Sofía), con alta
  hs(ho[3], pa[3], "HOS-2026-0004", "alta",
    ad("2026-10-08T10:15", "urgencias", "Medicina interna", "M-07", "Fiebre, disuria y dolor lumbar de 2 días", pr[3]),
    dx([["N39.0", "ingreso", "2026-10-08T10:45"], ["R50.9", "secundario", "2026-10-08T10:45"], ["N39.0", "principal", "2026-10-08T16:00"], ["N39.0", "egreso", "2026-10-11T10:00"]]),
    tx([[me[0], "1 g", "IV", "cada 24 h", "2026-10-08T11:00", "2026-10-11T11:00", pr[0]], [me[2], "500 mg", "oral", "cada 8 h", "2026-10-08T11:00", "2026-10-10T11:00", pr[0]]]),
    al("2026-10-11T12:00", "mejoria", "N39.0", "Completar tratamiento oral ambulatorio y aumentar ingesta de líquidos", pr[0]));
  ev(ho[3], [
    ["2026-10-08T16:00", pr[0], "Disuria, fiebre y dolor lumbar derecho.", "T 38.7 °C, puñopercusión positiva derecha.", "Infección urinaria alta, pielonefritis probable.", "Ceftriaxona IV, urocultivo e hidratación."],
    ["2026-10-09T08:00", pr[0], "Fiebre menor, dolor lumbar leve.", "T 37.6 °C, hemodinámicamente estable.", "Respuesta inicial adecuada.", "Continuar manejo intravenoso."],
    ["2026-10-10T08:00", pr[0], "Sin fiebre, sin disuria.", "Afebril 24 h, tolera vía oral.", "Mejoría clínica.", "Planear egreso con terapia oral."]]);
  sv(ho[3], [
    ["2026-10-08T12:00", pr[5], 102, 20, 38.7, 97, 108, 68], ["2026-10-08T20:00", pr[6], 98, 20, 38.3, 97, 106, 66],
    ["2026-10-09T08:00", pr[4], 90, 18, 37.6, 98, 110, 70], ["2026-10-09T20:00", pr[6], 84, 16, 37, 98, 112, 72],
    ["2026-10-10T08:00", pr[4], 78, 16, 36.7, 99, 114, 72], ["2026-10-10T20:00", pr[6], 76, 16, 36.6, 99, 112, 70]]);
  nt(ho[3], [
    ["2026-10-08T13:00", pr[5], "tarde", "Se toma muestra de orina para cultivo y se inicia hidratación IV."],
    ["2026-10-09T09:00", pr[4], "manana", "Refiere dolor lumbar leve, se administra analgésico según orden."],
    ["2026-10-10T22:00", pr[6], "noche", "Duerme sin fiebre, diuresis espontánea clara."]]);
  // Hospitalización 5: EPOC exacerbado (Pedro Pablo), con alta
  hs(ho[4], pa[4], "HOS-2026-0005", "alta",
    ad("2026-10-12T05:50", "urgencias", "Neumología", "N-03", "Disnea y sibilancias de 2 días", pr[3]),
    dx([["J44.1", "ingreso", "2026-10-12T06:20"], ["I10", "secundario", "2026-10-12T09:00"], ["J44.1", "principal", "2026-10-12T09:00"], ["J44.1", "egreso", "2026-10-17T10:00"]]),
    tx([[me[7], "2 inhalaciones", "inhalada", "cada 4 h", "2026-10-12T06:30", "2026-10-17T06:30", pr[2]], [me[10], "8 mg", "IV", "cada 24 h", "2026-10-12T07:00", "2026-10-16T07:00", pr[2]], [me[1], "500 mg", "oral", "cada 24 h", "2026-10-12T09:30", "2026-10-15T09:30", pr[2]]]),
    al("2026-10-17T11:00", "mejoria", "J44.1", "Inhaladores de mantenimiento, abstinencia de tabaco y control en 10 días", pr[2]));
  ev(ho[4], [
    ["2026-10-12T09:00", pr[2], "Disnea marcada con sibilancias y tos con esputo.", "FR 28, SatO2 88% en aire ambiente, sibilancias difusas.", "EPOC exacerbado.", "Broncodilatador, corticoide, oxígeno controlado y antibiótico."],
    ["2026-10-14T08:00", pr[2], "Disnea menor, tos productiva.", "SatO2 93% con oxígeno a 2 L/min, sibilancias escasas.", "Mejoría parcial.", "Continuar manejo y retirar oxígeno según tolerancia."],
    ["2026-10-16T08:00", pr[2], "Sin disnea en reposo.", "SatO2 94% en aire ambiente, sin sibilancias.", "Exacerbación resuelta.", "Educación en inhaladores y egreso al día siguiente."]]);
  sv(ho[4], [
    ["2026-10-12T07:00", pr[4], 110, 28, 37.2, 88, 148, 90], ["2026-10-12T15:00", pr[5], 104, 26, 37, 90, 144, 88],
    ["2026-10-13T08:00", pr[4], 96, 24, 36.9, 92, 140, 86], ["2026-10-14T08:00", pr[4], 90, 22, 36.8, 93, 136, 84],
    ["2026-10-15T08:00", pr[4], 84, 20, 36.7, 94, 132, 82], ["2026-10-16T08:00", pr[4], 80, 18, 36.6, 94, 128, 80]]);
  nt(ho[4], [
    ["2026-10-12T08:00", pr[4], "manana", "Se inicia oxígeno por cánula y nebulización, ansiedad leve por la disnea."],
    ["2026-10-13T14:00", pr[5], "tarde", "Tolera dieta, expectoración mucosa moderada."],
    ["2026-10-15T21:00", pr[6], "noche", "Duerme sin oxígeno suplementario, sin disnea nocturna."]]);
  // Hospitalización 6: cetoacidosis diabética (Valentina), con alta
  hs(ho[5], pa[5], "HOS-2026-0006", "alta",
    ad("2026-10-15T21:40", "urgencias", "Medicina interna", "M-09", "Poliuria, polidipsia y vómito de 24 horas", pr[3]),
    dx([["E11.1", "ingreso", "2026-10-15T22:10"], ["A09", "secundario", "2026-10-15T22:10"], ["E11.1", "principal", "2026-10-16T08:00"], ["E11.1", "egreso", "2026-10-20T10:00"]]),
    tx([[me[11], "0.1 UI/kg/h", "IV", "infusión continua", "2026-10-15T22:30", "2026-10-16T20:00", pr[0]], [me[5], "20 UI", "SC", "cada 24 h", "2026-10-16T20:30", "2026-10-20T11:00", pr[0]], [me[6], "20 mg", "oral", "cada 24 h", "2026-10-16T09:00", "2026-10-20T09:00", pr[0]]]),
    al("2026-10-20T11:00", "mejoria", "E11.1", "Control con endocrinología, insulina basal y educación en glucometría", pr[0]));
  ev(ho[5], [
    ["2026-10-16T08:00", pr[0], "Náuseas, sed intensa, mejoría parcial del dolor abdominal.", "Respiración profunda, mucosas secas, glucemia 410 mg/dL.", "Cetoacidosis diabética en manejo.", "Infusión de insulina, líquidos IV y control de gases y electrolitos."],
    ["2026-10-17T08:00", pr[0], "Sin vómito, tolera líquidos.", "Glucemia 180 mg/dL, anión gap normalizado.", "Cetoacidosis resuelta.", "Transición a insulina subcutánea."],
    ["2026-10-19T08:00", pr[0], "Asintomática, apetito conservado.", "Glucemias entre 110 y 160 mg/dL, signos vitales estables.", "Diabetes controlada con esquema basal.", "Educación diabetológica y egreso programado."]]);
  sv(ho[5], [
    ["2026-10-15T22:30", pr[6], 118, 28, 37, 97, 98, 60], ["2026-10-16T02:00", pr[6], 110, 26, 36.9, 98, 102, 64],
    ["2026-10-16T08:00", pr[4], 100, 22, 36.8, 98, 108, 68], ["2026-10-17T08:00", pr[4], 88, 18, 36.7, 99, 112, 70],
    ["2026-10-18T08:00", pr[5], 82, 16, 36.6, 99, 114, 72], ["2026-10-19T08:00", pr[4], 78, 16, 36.6, 99, 116, 74]]);
  nt(ho[5], [
    ["2026-10-15T23:00", pr[6], "noche", "Se instala acceso venoso y líquidos IV, glucometrías horarias."],
    ["2026-10-16T10:00", pr[4], "manana", "Persisten náuseas leves, se mantiene en ayuno y monitoreo de glucemia."],
    ["2026-10-18T15:00", pr[5], "tarde", "Inicia dieta para diabético, tolera completa."]]);
  // Verificación de integridad referencial y de estado
  const hex = x => x.toHexString();
  const chk = { "Hospitalizaciones con paciente_id inexistente": [], "Tratamientos con medicamento_id inexistente": [], "Diagnósticos con cie10_codigo ausente del catálogo": [], "Registros hijos con hospitalizacion_id huérfano": [], "Estado inconsistente con objeto alta": [] };
  const kP = "Hospitalizaciones con paciente_id inexistente", kM = "Tratamientos con medicamento_id inexistente", kD = "Diagnósticos con cie10_codigo ausente del catálogo", kH = "Registros hijos con hospitalizacion_id huérfano", kE = "Estado inconsistente con objeto alta";
  const idsPac = new Set(db.pacientes.distinct("_id").map(hex));
  const idsMed = new Set(db.medicamentos.distinct("_id").map(hex));
  const idsHos = new Set(db.hospitalizaciones.distinct("_id").map(hex));
  const codigos = new Set(db.diagnosticos_cie10.distinct("_id"));
  db.hospitalizaciones.find().forEach(h => {
    if (!idsPac.has(hex(h.paciente_id))) chk[kP].push(h.numero_ingreso);
    (h.tratamientos || []).forEach(t => { if (!idsMed.has(hex(t.medicamento_id))) chk[kM].push(h.numero_ingreso + " -> " + hex(t.medicamento_id)); });
    (h.diagnosticos || []).forEach(d => { if (!codigos.has(d.cie10_codigo)) chk[kD].push(h.numero_ingreso + " -> " + d.cie10_codigo); });
    if (h.estado === "activa" && h.alta) chk[kE].push(h.numero_ingreso + ": activa con alta");
    if (h.estado === "alta" && !h.alta) chk[kE].push(h.numero_ingreso + ": alta sin objeto alta");
  });
  ["signos_vitales", "notas_enfermeria", "evoluciones"].forEach(c => db.getCollection(c).find().forEach(x => { if (!idsHos.has(hex(x.hospitalizacion_id))) chk[kH].push(c + " " + hex(x._id)); }));
  Object.keys(chk).forEach(k => print(k + ": " + (chk[k].length ? "\n  - " + chk[k].join("\n  - ") : "OK")));
  // Conteo de documentos por colección
  print("--- Conteo de documentos ---");
  ["pacientes", "profesionales", "medicamentos", "diagnosticos_cie10", "hospitalizaciones", "signos_vitales", "notas_enfermeria", "evoluciones"].forEach(c => print(c + ": " + db.getCollection(c).countDocuments()));
})();
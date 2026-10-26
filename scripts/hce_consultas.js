// hce_consultas.js
(function () {
  db = db.getSiblingDB("hce_hospitalizacion");
  // Consulta 1: pacientes por diagnóstico
  print("\n=== 1. Pacientes por diagnóstico | Objetivo: listar quién tiene cada CIE-10 | Valida: $unwind de array embebido y referencias a catálogo y pacientes ===");
  db.hospitalizaciones.aggregate([
    { $unwind: "$diagnosticos" },
    { $match: { "diagnosticos.tipo": "principal" } },
    { $lookup: { from: "diagnosticos_cie10", localField: "diagnosticos.cie10_codigo", foreignField: "_id", as: "dx" } },
    { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "pac" } },
    { $unwind: "$dx" },
    { $unwind: "$pac" },
    { $group: { _id: { codigo: "$dx._id", descripcion: "$dx.descripcion" }, pacientes: { $addToSet: { nombre: { $concat: ["$pac.nombres", " ", "$pac.apellidos"] }, documento: { $concat: ["$pac.tipo_documento", " ", "$pac.numero_documento"] } } } } },
    { $project: { _id: 0, codigo: "$_id.codigo", descripcion: "$_id.descripcion", pacientes: 1 } },
    { $sort: { codigo: 1 } }
  ]).forEach(printjson);
  // Consulta 2: evolución clínica cronológica de la hospitalización del primer paciente
  print("\n=== 2. Evolución SOAP cronológica | Objetivo: línea de tiempo médica del primer paciente | Valida: colección referenciada evoluciones, índice (hospitalizacion_id, fecha) y catálogo profesionales ===");
  const p1 = db.pacientes.find().sort({ numero_documento: 1 }).limit(1).toArray()[0];
  const h1 = db.hospitalizaciones.findOne({ paciente_id: p1._id });
  print("Hospitalización: " + h1.numero_ingreso);
  db.evoluciones.aggregate([
    { $match: { hospitalizacion_id: h1._id } },
    { $sort: { fecha: 1 } },
    { $lookup: { from: "profesionales", localField: "profesional_id", foreignField: "_id", as: "prof" } },
    { $unwind: "$prof" },
    { $project: { _id: 0, fecha: 1, profesional: { $concat: ["$prof.nombres", " ", "$prof.apellidos"] }, subjetivo: 1, objetivo: 1, analisis: 1, plan: 1 } }
  ]).forEach(printjson);
  // Consulta 3: medicamentos asignados a un paciente
  print("\n=== 3. Medicamentos de un paciente | Objetivo: tratamientos con datos del catálogo | Valida: tratamientos embebidos con medicamento_id referenciado ===");
  print("Paciente: " + p1.nombres + " " + p1.apellidos);
  db.hospitalizaciones.aggregate([
    { $match: { paciente_id: p1._id } },
    { $unwind: "$tratamientos" },
    { $lookup: { from: "medicamentos", localField: "tratamientos.medicamento_id", foreignField: "_id", as: "med" } },
    { $unwind: "$med" },
    { $project: { _id: 0, ingreso: "$numero_ingreso", medicamento: "$med.nombre_generico", dosis: "$tratamientos.dosis", via: "$tratamientos.via", frecuencia: "$tratamientos.frecuencia", fecha_inicio: "$tratamientos.fecha_inicio", fecha_fin: "$tratamientos.fecha_fin" } },
    { $sort: { fecha_inicio: 1 } }
  ]).forEach(printjson);
  // Consulta 4: hospitalizaciones activas con último signo vital
  print("\n=== 4. Activas con último signo vital | Objetivo: estado actual de pacientes hospitalizados | Valida: $lookup con sub-pipeline sobre colección referenciada e índice (hospitalizacion_id, fecha desc) ===");
  db.hospitalizaciones.aggregate([
    { $match: { estado: "activa" } },
    { $lookup: { from: "signos_vitales", let: { hid: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$hospitalizacion_id", "$$hid"] } } },
      { $sort: { fecha: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, fecha: 1, fc: 1, fr: 1, temp: 1, sat_o2: 1, ta_sis: 1, ta_dia: 1 } }
    ], as: "ultimo_signo_vital" } },
    { $unwind: { path: "$ultimo_signo_vital", preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, numero_ingreso: 1, estado: 1, servicio: "$admision.servicio", cama: "$admision.cama", ultimo_signo_vital: 1 } }
  ]).forEach(printjson);
  // Consulta 5: explain de búsqueda por código CIE-10
  print("\n=== 5. Explain por diagnosticos.cie10_codigo | Objetivo: comprobar uso de índice | Valida: índice multikey sobre array embebido de diagnósticos ===");
  const ex = db.hospitalizaciones.find({ "diagnosticos.cie10_codigo": "J18.9" }).explain("executionStats");
  const plan = ex.queryPlanner.winningPlan;
  const nodo = plan.inputStage || (plan.queryPlan && plan.queryPlan.inputStage) || plan;
  const raiz = plan.queryPlan || plan;
  printjson({
    "winningPlan.stage": raiz.stage,
    indexName: nodo.indexName || (nodo.inputStage && nodo.inputStage.indexName),
    totalDocsExamined: ex.executionStats.totalDocsExamined,
    nReturned: ex.executionStats.nReturned
  });
  // Consulta 6: vista de auditoría sin identidad
  print("\n=== 6. Auditoría sin identidad | Objetivo: datos clínicos anonimizados | Valida: separación de privacidad entre hospitalizaciones y pacientes ===");
  db.hospitalizaciones.aggregate([
    { $project: { _id: 0, numero_ingreso: 1, estado: 1, servicio: "$admision.servicio", fecha_admision: "$admision.fecha", fecha_alta: "$alta.fecha", diagnosticos: 1 } },
    { $sort: { numero_ingreso: 1 } }
  ]).forEach(printjson);
})();
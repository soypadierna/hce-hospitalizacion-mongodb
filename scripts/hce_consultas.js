// hce_consultas.js
(function () {
  db = db.getSiblingDB("hce_hospitalizacion");
  // Filtro de soft delete: excluye las hospitalizaciones marcadas como eliminadas
  const NO_ELIMINADO = { $ne: true };
  // Consulta 1: pacientes por diagnóstico
  print("\n=== 1. Pacientes por diagnóstico [4 etapas] | Objetivo: listar quién tiene cada CIE-10 | Valida: $unwind de array embebido y referencia a pacientes ===");
  db.hospitalizaciones.aggregate([
    { $unwind: "$diagnosticos" },
    { $match: { "diagnosticos.tipo": "principal", eliminado: NO_ELIMINADO } },
    { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "pac" } },
    { $group: { _id: "$diagnosticos.cie10_codigo", total: { $sum: 1 }, pacientes: { $addToSet: { $concat: [{ $first: "$pac.nombres" }, " ", { $first: "$pac.apellidos" }] } } } }
  ]).forEach(printjson);
  // Consulta 2: evolución clínica cronológica de la hospitalización del primer paciente
  print("\n=== 2. Evolución SOAP cronológica [4 etapas] | Objetivo: línea de tiempo médica del primer paciente | Valida: colección referenciada evoluciones, índice (hospitalizacion_id, fecha) y catálogo profesionales ===");
  const p1 = db.pacientes.find().sort({ numero_documento: 1 }).limit(1).toArray()[0];
  const h1 = db.hospitalizaciones.findOne({ paciente_id: p1._id, eliminado: NO_ELIMINADO });
  print("Hospitalización: " + h1.numero_ingreso);
  db.evoluciones.aggregate([
    { $match: { hospitalizacion_id: h1._id } },
    { $sort: { fecha: 1 } },
    { $lookup: { from: "profesionales", localField: "profesional_id", foreignField: "_id", as: "prof" } },
    { $project: { _id: 0, fecha: 1, profesional: { $concat: [{ $first: "$prof.nombres" }, " ", { $first: "$prof.apellidos" }] }, subjetivo: 1, objetivo: 1, analisis: 1, plan: 1 } }
  ]).forEach(printjson);
  // Consulta 3: medicamentos asignados a un paciente
  print("\n=== 3. Medicamentos de un paciente [4 etapas] | Objetivo: tratamientos con datos del catálogo | Valida: tratamientos embebidos con medicamento_id referenciado ===");
  print("Paciente: " + p1.nombres + " " + p1.apellidos);
  db.hospitalizaciones.aggregate([
    { $match: { paciente_id: p1._id, eliminado: NO_ELIMINADO } },
    { $unwind: "$tratamientos" },
    { $lookup: { from: "medicamentos", localField: "tratamientos.medicamento_id", foreignField: "_id", as: "med" } },
    { $project: { _id: 0, ingreso: "$numero_ingreso", medicamento: { $first: "$med.nombre_generico" }, dosis: "$tratamientos.dosis", via: "$tratamientos.via", frecuencia: "$tratamientos.frecuencia", fecha_inicio: "$tratamientos.fecha_inicio", fecha_fin: "$tratamientos.fecha_fin" } }
  ]).forEach(printjson);
  // Consulta 4: hospitalizaciones activas con último signo vital
  print("\n=== 4. Activas con último signo vital [4 etapas] | Objetivo: estado actual de pacientes hospitalizados | Valida: $lookup con sub-pipeline sobre colección referenciada e índice (hospitalizacion_id, fecha desc) ===");
  db.hospitalizaciones.aggregate([
    { $match: { estado: "activa", eliminado: NO_ELIMINADO } },
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
  print("\n=== 6. Auditoría sin identidad [3 etapas] | Objetivo: datos clínicos anonimizados | Valida: separación de privacidad entre hospitalizaciones y pacientes ===");
  db.hospitalizaciones.aggregate([
    { $match: { eliminado: NO_ELIMINADO } },
    { $project: { _id: 0, numero_ingreso: 1, estado: 1, servicio: "$admision.servicio", fecha_admision: "$admision.fecha", fecha_alta: "$alta.fecha", diagnosticos: 1 } },
    { $sort: { numero_ingreso: 1 } }
  ]).forEach(printjson);
  // Consulta 7 (propia: Santiago Padierna): ocupación de camas por servicio
  print("\n=== 7. Ocupación de camas por servicio [3 etapas] | Objetivo: porcentaje de ocupación por servicio | Valida: catálogo de camas, $group con $cond y cálculo con $subtract/$divide/$multiply ===");
  db.camas.aggregate([
    { $group: { _id: "$servicio", total_camas: { $sum: 1 }, ocupadas: { $sum: { $cond: [{ $eq: ["$estado", "ocupada"] }, 1, 0] } } } },
    { $project: { _id: 0, servicio: "$_id", total_camas: 1, ocupadas: 1, libres: { $subtract: ["$total_camas", "$ocupadas"] }, ocupacion_pct: { $round: [{ $multiply: [{ $divide: ["$ocupadas", "$total_camas"] }, 100] }, 1] } } },
    { $sort: { ocupacion_pct: -1, servicio: 1 } }
  ]).forEach(printjson);
})();

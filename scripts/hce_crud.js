// hce_crud.js
// Operaciones CRUD sobre registros de prueba (HOS-2026-0007).
// Requisito: haber ejecutado antes hce_seed.js. Al terminar, la base queda igual que tras el seed.
(function () {
  db = db.getSiblingDB("hce_hospitalizacion");
  const F = s => ISODate(s + ":00Z");
  const T = t => print("\n=== CRUD | " + t + " ===");
  const estadoCamas = () => printjson(db.camas.find({ _id: { $in: ["M-20", "M-22"] } }).sort({ _id: 1 }).toArray());
  // Identificadores tomados de la base ya sembrada
  const urg = db.profesionales.findOne({ registro_medico: "RM-0004" });
  const int = db.profesionales.findOne({ registro_medico: "RM-0001" });
  const cef = db.medicamentos.findOne({ codigo: "MED-001" });
  if (!urg || !int || !cef) { print("Faltan datos base: ejecuta primero hce_seed.js"); return; }
  // Limpieza previa por si una ejecución anterior se interrumpió a la mitad
  db.hospitalizaciones.deleteMany({ numero_ingreso: "HOS-2026-0007" });
  db.pacientes.deleteMany({ numero_documento: "1000000099" });
  db.camas.updateMany({ _id: { $in: ["M-20", "M-22"] } }, { $set: { estado: "libre" } });

  T("CREATE: insertar paciente, hospitalización y ocupar la cama M-20");
  const pacNuevo = ObjectId();
  db.pacientes.insertOne({ _id: pacNuevo, tipo_documento: "CC", numero_documento: "1000000099", nombres: "Sofía", apellidos: "Ramírez Cano", fecha_nacimiento: F("1992-07-20T00:00"), sexo: "F", telefono: "3000000099", direccion: "Carrera 10 # 5-20, Medellín", eps: "EPS Ficticia Sur" });
  db.hospitalizaciones.insertOne({
    paciente_id: pacNuevo, numero_ingreso: "HOS-2026-0007", estado: "activa",
    admision: { fecha: F("2026-11-05T09:00"), via_ingreso: "urgencias", servicio: "Medicina interna", cama: "M-20", motivo_consulta: "Diarrea y dolor abdominal de 2 días", profesional_id: urg._id },
    diagnosticos: [{ cie10_codigo: "A09", tipo: "ingreso", fecha: F("2026-11-05T09:30") }],
    tratamientos: [{ medicamento_id: cef._id, dosis: "1 g", via: "IV", frecuencia: "cada 24 h", fecha_inicio: F("2026-11-05T10:00"), prescribe_id: int._id }]
  });
  db.camas.updateOne({ _id: "M-20" }, { $set: { estado: "ocupada" } });
  estadoCamas();

  T("READ: consultar el registro creado");
  printjson(db.hospitalizaciones.findOne({ numero_ingreso: "HOS-2026-0007" }, { _id: 0, numero_ingreso: 1, estado: 1, admision: 1, diagnosticos: 1 }));

  T("UPDATE 1: campo simple (teléfono del paciente)");
  db.pacientes.updateOne({ _id: pacNuevo }, { $set: { telefono: "3100000099" } });
  printjson(db.pacientes.findOne({ _id: pacNuevo }, { _id: 0, nombres: 1, telefono: 1 }));

  T("UPDATE 2: campo anidado admision.cama y cambio de estado de las camas");
  db.hospitalizaciones.updateOne({ numero_ingreso: "HOS-2026-0007" }, { $set: { "admision.cama": "M-22" } });
  db.camas.updateOne({ _id: "M-20" }, { $set: { estado: "libre" } });
  db.camas.updateOne({ _id: "M-22" }, { $set: { estado: "ocupada" } });
  printjson(db.hospitalizaciones.findOne({ numero_ingreso: "HOS-2026-0007" }, { _id: 0, "admision.cama": 1 }));
  estadoCamas();

  T("UPDATE 3: agregar un elemento al vector diagnosticos ($push)");
  db.hospitalizaciones.updateOne({ numero_ingreso: "HOS-2026-0007" }, { $push: { diagnosticos: { cie10_codigo: "A09", tipo: "principal", fecha: new Date() } } });
  printjson(db.hospitalizaciones.findOne({ numero_ingreso: "HOS-2026-0007" }, { _id: 0, diagnosticos: 1 }));

  T("UPDATE 4: campo anidado dentro de un vector (arrayFilters)");
  db.hospitalizaciones.updateOne({ numero_ingreso: "HOS-2026-0007" }, { $set: { "tratamientos.$[t].dosis": "2 g" } }, { arrayFilters: [{ "t.via": "IV" }] });
  printjson(db.hospitalizaciones.findOne({ numero_ingreso: "HOS-2026-0007" }, { _id: 0, tratamientos: 1 }));

  T("DELETE lógico (soft delete): marcar como eliminado y liberar la cama");
  db.hospitalizaciones.updateOne({ numero_ingreso: "HOS-2026-0007" }, { $set: { eliminado: true, fecha_eliminacion: new Date(), motivo_eliminacion: "Registro creado por error" } });
  db.camas.updateOne({ _id: "M-22" }, { $set: { estado: "libre" } });
  print("Total en la colección: " + db.hospitalizaciones.countDocuments());
  print("Visibles (sin eliminar): " + db.hospitalizaciones.countDocuments({ eliminado: { $ne: true } }));

  T("DELETE definitivo: borrar hospitalización y paciente de prueba");
  db.hospitalizaciones.deleteOne({ numero_ingreso: "HOS-2026-0007" });
  db.pacientes.deleteOne({ _id: pacNuevo });
  print("hospitalizaciones: " + db.hospitalizaciones.countDocuments() + " | pacientes: " + db.pacientes.countDocuments());
  estadoCamas();
})();

# HCE Hospitalización — Modelo documental en MongoDB

Proyecto de aula **Bases de Datos II** (Institución Universitaria Pascual Bravo).
Subsistema de hospitalización de la Historia Clínica Electrónica (HCE) para el proyecto piloto de la Gobernación de Antioquia, implementado como base documental en MongoDB.

**Autor:** Santiago Padierna Suarez
**Base de datos:** `hce_hospitalizacion`
**Motor:** MongoDB Atlas, consultado con Compass y mongosh

## Enlaces de la entrega

- Informe técnico (PDF): `docs/informe.pdf`
- Video demostrativo: [PEGAR ENLACE]
- Evidencia de uso de IA (conversación completa): [PEGAR ENLACE DEL CHAT]

## Estructura del repositorio

```
hce-nosql-mongodb/
├── README.md
├── scripts/
│   ├── hce_seed.js        Creación de colecciones, validadores e índices; inserción de datos de prueba
│   ├── hce_crud.js        Operaciones CRUD (insertar, leer, actualizar, eliminar)
│   └── hce_consultas.js   Consultas avanzadas (Aggregation Framework)
├── data/                  Datos de prueba exportados en JSON, una colección por archivo
├── capturas/              Capturas de ejecución (seed, CRUD y consultas)
└── docs/
    └── informe.pdf
```

## Modelo de datos

| Colección | Rol | Relación |
|---|---|---|
| `pacientes` | Datos demográficos y EPS | Referenciada desde `hospitalizaciones.paciente_id` |
| `profesionales` | Médicos, especialistas y enfermeros | Referenciada por admisión, tratamientos, alta y registros hijos |
| `medicamentos` | Catálogo de medicamentos | Referenciada desde `tratamientos.medicamento_id` |
| `diagnosticos_cie10` | Catálogo CIE-10 (`_id` = código) | Referenciada desde `diagnosticos.cie10_codigo` |
| `camas` | Catálogo de camas (`_id` = código, estado libre/ocupada/mantenimiento) | Referenciada desde `admision.cama` |
| `hospitalizaciones` | Documento central del episodio | Embebe `admision`, `diagnosticos[]`, `tratamientos[]` y `alta` |
| `signos_vitales`, `notas_enfermeria`, `evoluciones` | Registros clínicos de alto volumen | Referenciadas por `hospitalizacion_id` |

**Criterio de diseño:** se embebe lo que nace y se consulta junto con la hospitalización y tiene tamaño acotado (admisión, diagnósticos, tratamientos, alta). Se referencia lo que crece sin límite (signos vitales, notas, evoluciones) o se comparte entre episodios (pacientes, catálogos). Las colecciones tienen validadores `$jsonSchema` e índices.

## Cómo ejecutar

1. Conectarse a la base con mongosh:
   ```
   mongosh "<cadena de conexión de Atlas>"
   ```
2. Crear y sembrar la base:
   ```
   load("scripts/hce_seed.js")
   ```
3. Ejecutar las operaciones CRUD:
   ```
   load("scripts/hce_crud.js")
   ```
4. Ejecutar las consultas avanzadas:
   ```
   load("scripts/hce_consultas.js")
   ```

`hce_seed.js` borra y recrea las colecciones, por lo que se puede volver a ejecutar. Al final verifica la integridad referencial y muestra el conteo de documentos.

## Datos de prueba

6 pacientes, 7 profesionales, 12 medicamentos, 10 diagnósticos CIE-10, 11 camas, 6 hospitalizaciones (5 con alta y 1 activa), 36 registros de signos vitales, 18 notas de enfermería y 18 evoluciones. Todos son datos simulados y ficticios.

## Operaciones CRUD (`hce_crud.js`)

Se ejecutan sobre un registro de prueba (`HOS-2026-0007`) y dejan la base como estaba. Requieren haber corrido antes `hce_seed.js`.

| Operación | Qué se muestra |
|---|---|
| Create | Inserción de paciente y hospitalización, y ocupación de la cama |
| Read | Consulta del documento recién creado |
| Update simple | Teléfono del paciente (`$set`) |
| Update anidado | `admision.cama` y cambio de estado de las camas (`$set` con ruta de subdocumento) |
| Update en vector | Nuevo diagnóstico con `$push` |
| Update dentro de vector | Dosis de un tratamiento con `arrayFilters` |
| Delete lógico | `eliminado: true` con fecha y motivo (soft delete) |
| Delete definitivo | `deleteOne` sobre hospitalización y paciente de prueba |

## Consultas avanzadas (`hce_consultas.js`)

Todas usan pipelines de 2 a 4 etapas y excluyen los registros eliminados lógicamente.

| # | Consulta | Etapas |
|---|---|---|
| 1 | Pacientes por diagnóstico principal | 4 |
| 2 | Evolución SOAP cronológica de una hospitalización | 4 |
| 3 | Medicamentos de un paciente con datos del catálogo | 4 |
| 4 | Hospitalizaciones activas con su último signo vital | 4 |
| 5 | `explain` de la búsqueda por código CIE-10 (uso de índice) | — |
| 6 | Auditoría sin identidad del paciente | 3 |
| 7 | Ocupación de camas por servicio (consulta propia) | 3 |

## Capturas

Las capturas de ejecución están en `capturas/`, nombradas según el paso: `01_seed.png`, `02_crud_create.png`, `03_crud_update.png`, `04_crud_delete.png`, `05_consulta_1.png`, etc.
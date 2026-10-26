# HCE Hospitalización: modelo documental híbrido en MongoDB

Actividad de Bases de Datos II, Institución Universitaria Pascual Bravo. Piloto de Historia Clínica Electrónica, Gobernación de Antioquia. Modela el proceso de hospitalización (admisión, diagnóstico, evolución, signos vitales, notas de enfermería, tratamientos y alta) con diseño híbrido embebido + referenciado. Todos los datos son ficticios.

## Requisitos
- Docker Desktop (o una cuenta en MongoDB Atlas)
- mongosh (si no usas `docker exec`)

## Instalación de MongoDB

**Opción A: Docker**
```bash
docker compose up -d
docker ps
```
- MongoDB: `localhost:27017`
- mongo-express: http://localhost:8081 (usuario `admin`, clave `admin123`)

**Opción B: Atlas**
1. Crea un clúster gratuito.
2. Agrega tu IP en *Network Access*.
3. Crea un usuario en *Database Access*.
4. Conéctate:
```bash
mongosh "mongodb+srv://<cluster>.mongodb.net/" --username <usuario>
```

## Ejecución (en orden)
1. Abrir mongosh:
```bash
docker exec -it hce-mongo mongosh
```
2. Pegar completo `scripts/creacion_y_carga.js`.
3. Pegar completo `scripts/consultas.js`.

Ambos scripts se pueden pegar varias veces: el primero borra y recrea las colecciones.

## Verificación
```js
db = db.getSiblingDB("hce_hospitalizacion")
db.getCollectionNames().forEach(c => print(c + ": " + db.getCollection(c).countDocuments()))
```
Conteos esperados: pacientes 6, profesionales 7, medicamentos 12, diagnosticos_cie10 10, hospitalizaciones 6, signos_vitales 36, notas_enfermeria 18, evoluciones 18.

## Uso de IA
| Herramienta | Prompt resumido | Qué aportó | Qué corregí manualmente |
|---|---|---|---|
| Claude | Diseñar el modelo híbrido (embebido + referenciado) con tablas, JSON, `$jsonSchema`, índices y Mermaid | Esquema, validadores, índices y diagrama | (completar) |
| Claude | Script único de creación y carga con datos ficticios y verificación de integridad | `creacion_y_carga.js` | (completar) |
| Claude | 6 consultas de validación con `$lookup`, sub-pipeline y `explain` | `consultas.js` | (completar) |
| Claude | Estructura del repositorio, README, Docker y guía de capturas | Este repositorio | (completar) |
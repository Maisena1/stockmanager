# Issues — Importación desde Excel

>RF-40 a RF-45 (REQUERIMIENTOS.md §E5, milestone M3). Estados verificados contra el código actual.

---

## Issue 1 — Infra de importación (preview base)

**Estado:** Hecho

**Descripción**
Instalar `xlsx`, crear `import.routes.ts`/`import.controller.ts`, montar en `app.ts` y exponer `POST /api/import/preview`.

**Tareas**
- [x] Instalar dependencia `xlsx`
- [x] Crear `src/routes/import.routes.ts`
- [x] Crear `src/controllers/import.controller.ts` con `preview`
- [x] Montar `app.use("/api/import", importRoutes)` en `app.ts`
- [x] Usar middleware `uploadExcelPhoto` para recibir `.xlsx`

**Referencias**
- RF-40: `POST /api/import/preview` recibe `.xlsx` y devuelve hojas detectadas + vista previa (sin persistir nada)
- RNF-23: Validación de tamaño/tipo de archivo

**Notas**
`preview` lee el buffer con `XLSX.read` y devuelve `sheets` con las filas de cada hoja (`sheet_to_json({ header: 1 })`).

---

## Issue 2 — Seguridad y validaciones de import

**Estado:** Hecho (con un ajuste menor pendiente)

**Descripción**
Asegurar que la importación cumple restricciones de rol y validaciones de upload.

**Tareas**
- [x] Solo admin puede acceder a `/api/import/preview` y a `/api/import` (403 para empleado) — `requireRole("ADMIN")` en las rutas
- [x] Empleado no recibe `purchasePrice`/`minStock` por endpoints de import (RNF-22). Ni `preview` ni `/api/import` devuelven artículos de la BD, así que no exponen costos
- [x] Validación de tipo/tamaño de archivo (.xlsx, `limits.fileSize`)
- [x] Corregir el mensaje de error de límite: ahora se deriva de `MAX_MB` en `src/middlewares/upload.ts` y dice 10 MB, que es el límite real

**Referencias**
- RF-14: Importar Excel es solo admin
- RNF-22: El empleado no puede obtener precio de compra ni stock mínimo por ningún endpoint (incluido import)
- RNF-23: Validación de tamaño/tipo en uploads
- RF-44: Límite de tamaño y validación de formato con error claro

---

## Issue 3 — Backend: importación transaccional completa (POST /api/import)

**Estado:** Hecho

**Descripción**
Implementar `POST /api/import` con configuración completa, manejo de artículos existentes, ejecución transaccional y reporte final.

**Tareas**
- [x] Handler `runImport` en `src/controllers/import.controller.ts`
- [x] Ruta `POST /api/import` con `requireRole("ADMIN")` + `uploadExcelPhoto`
- [x] Configuración: proveedor, modelo de moto, % de ganancia, usar precio del Excel vs recalcular, incluir filas con precio/cantidad 0, stock mínimo, cantidad estándar, selección de hojas y columnas
- [x] Artículos existentes (por código): `sumStock` / `updatePrice` / `skip`
- [x] Transaccional (`prisma.$transaction`): todo o nada
- [x] Reporte final: creados, actualizados, salteados y errores por fila
- [x] Errores claros y en español (400 validación, 403 rol, 500 inesperado)
- [x] Reusar `calculateSalePrice()` y `generateCodes()`

**Referencias**
- RF-41: Configuración de importación
- RF-42: Artículos existentes: sumar stock / actualizar precio / saltear
- RF-43: Transaccionalidad + reporte final
- RF-44: Límite/tipo con error claro
- RNF-11: Importación de 5.000 filas < 60 s
- RNF-30: Operaciones atómicas (nunca stock inconsistente)

**Contrato del endpoint**

`POST /api/import` es `multipart/form-data`:

| Campo | Formato | Default |
|---|---|---|
| `config` | JSON en string | obligatorio |
| `sheets` | array JSON o lista separada por comas | todas las hojas |
| `file` | `.xlsx` | obligatorio |

> **Multer solo lee los campos de texto que llegan antes del archivo.** El frontend tiene que hacer `append("config")` y `append("sheets")` **antes** de `append("file")`.

`config`:

```jsonc
{
  "supplier": "Repuestos Norte",   // obligatorio
  "motorcycleModel": "",           // si vacío, usa la columna y si no "Universal"
  "percentage": 50,                // % ganancia (obligatorio, >= 0)
  "useExcelPrice": false,          // true = usar la columna de precio de venta del Excel
  "includeZeroRows": false,        // true = no saltear filas con precio o cantidad 0
  "minStock": 0,
  "defaultQuantity": 1,            // stock cuando la columna viene vacía
  "existing": "sumStock",          // sumStock | updatePrice | skip
  "hasHeader": true,               // la primera fila es encabezado
  "columns": {                     // índices de columna, 0-based
    "code": 0, "name": 1, "category": 2, "motorcycleModel": 3,
    "purchasePrice": 4, "salePrice": 5, "stock": 6, "barcode": 7
  }
}
```

- `columns.name` es obligatorio. Si `useExcelPrice` es `true` también hace falta mapear `columns.salePrice`; si no, se devuelve 400.
- `columns.code` es opcional: si está mapeado y el código existe en la base se aplica la política `existing`; si no está mapeado, el código se autogenera con `generateCodes()`.
- Números: acepta `2500`, `"2.500"`, `"1.800,50"`, `"12,50"`, `"$3.200"`.

Respuesta `201`:

```jsonc
{
  "report": { "created": 2, "updated": 0, "skipped": 1, "errors": [] },
  "imported": true,
  "skipped": [{ "sheet": "Stock", "row": 4, "reason": "Fila con precio o cantidad en 0" }]
}
```

Si alguna fila es inválida se devuelve **400** con `"imported": false`, el detalle de cada error por fila y `created`/`updated` en 0: no se persiste nada (todo o nada, RNF-30).

**Códigos repetidos dentro del mismo archivo**
Un mismo código en dos filas es un error por fila (`El código ACE-001 aparece más de una vez en el archivo`) y cancela toda la importación, sin importar la política de artículos existentes: es un problema del archivo, así que se le pide que lo corrija en vez de saltear o fusionar filas en silencio. La comparación ignora acentos y mayúsculas (`normalizeUpperCase`), igual que la generación de códigos.

Si no se detectara, las dos filas llegarían a `article.create()` con la misma primary key y Prisma devolvería P2002, que el backend terminaba reportando como **500** en vez de 400. Cubierto por `src/utils/importar.test.ts`.

**Notas**
La lógica de mapeo/validación/planificación vive en `src/utils/importar.ts` ( pura y cubierta por `src/utils/importar.test.ts`); el controlador solo lee el Excel, carga los existentes en una query y escribe dentro de la transacción. `generateCodes()` (`src/utils/codigo.ts`) genera el lote con una sola consulta en lugar de una por fila.

Los artículos existentes se indexan por `normalizeUpperCase(code)` para que un código guardado sin acentos se encuentre aunque el Excel lo mande acentuado; con `toUpperCase` la búsqueda fallaba y el `create` reventaba con P2002.

Un `sheets` vacío o ausente significa "todas las hojas" (`selectSheets`), no "ninguna": el wizard igual valida del lado del cliente que haya al menos una elegida.

---

## Issue 4 — Frontend: asistente de importación (wizard de 2 pasos)

**Estado:** Hecho

**Descripción**
Wizard de 2 pasos: subir y previsualizar → configurar y confirmar, solo admin, con resumen del resultado.

**Tareas**
- [x] `frontend/src/pages/ImportPage.tsx` es un stub: hoy solo muestra el título y un texto
- [x] Paso 1: subir `.xlsx`, `POST /api/import/preview`, mostrar hojas detectadas, cantidad de filas y vista previa
- [x] Paso 2: formulario de configuración con los campos del contrato de `POST /api/import`
- [x] Botón "Importar" → `POST /api/import` (recordar: `config` y `sheets` **antes** de `file` en el FormData)
- [x] Mostrar resultado: creados, actualizados, salteados, errores; lista desplegable con el detalle por fila (viene en `report.errors` y `skipped`)
- [x] Manejar el 400 con `"imported": false` mostrando el error de cabecera y el detalle por fila
- [x] Botón "Volver a importar" para reiniciar el wizard
- [x] Loading states durante upload y procesamiento
- [x] Error handling: archivo inválido, formato no soportado, errores del backend
- [x] Solo admin: si un empleado entra, redirigir o mostrar "No tienes permisos" (ya lo cubría `ProtectedRoute` en `App.tsx`; el backend además responde 403)

**Referencias**
- RF-45: Asistente de 2 pasos con resumen del resultado
- RF-14: Importar Excel es solo admin

**Notas**
El cliente de importación tipado vive en `frontend/src/lib/importar.ts` (contratos, `previewImport`, `runImport`, `guessColumns` y `validateFile`), separado de la página para no mezclarla con el JSX. `guessColumns` sugiere el mapeo de columnas a partir de la fila de encabezado, pero todo es editable.

`frontend/src/lib/api.ts` ahora detecta `FormData` en `request()` y omite el `Content-Type` (si lo fuerza, el boundary se pierde y multer no parsea el archivo); `api.upload()` es el helper multipart. `ApiError` pasó a guardar el body de la respuesta en `err.body`, que es lo que permite leer `report.errors` del 400 de importación.

La página muestra 3 estados (subir, configurar, resultado) aunque el requisito pida 2 pasos: el resumen es un estado aparte porque es la pantalla de errores por fila.

**Verificación:** `npm --prefix frontend run lint` (solo 2 warnings preexistentes, ninguno del wizard), `run build` OK, `npx tsc --noEmit` OK. El contrato multipart se validó end-to-end contra el backend (preview, 401 sin token, 403 como empleado, importación, rollback y validaciones). El frontend no tiene test runner, así que el recorrido de la UI quedó verificado por lint/build y por el E2E del contrato, no clickeando la pantalla.

---

## Pendientes sueltos

- [x] Unificar el límite de upload: el mensaje de Excel decía "50 MB" y ahora sale de `MAX_MB` (10 MB, el valor real). Si el negocio quiere 100 MB (RF-44), cambiar `MAX_MB` en `src/middlewares/upload.ts` y listo.
- [x] Issue 4: conectar el wizard del frontend con `POST /api/import` (ya está el contrato documentado arriba).
- [ ] Clickear el wizard a mano una vez con un `.xlsx` real: no hay test runner en el frontend y la UI no se recorrió en navegador.
- [ ] `ApiError` expone el body crudo del 500, que para errores de Prisma es un volcado interno en inglés. Se decidió dejarlo así; si molesta, el detalle queda en el log del servidor.

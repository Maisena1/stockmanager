# StockManager — Documentación y Requerimientos

| Campo | Valor |
|---|---|
| Proyecto | StockManager — sistema de stock y punto de venta para repuestos de motos |
| Repo | `Maisena1/stockmanager` |
| Basado en | CachitoMotos (misma familia de features, backend reescrito) |
| Versión del doc | 1.1 — Septiembre 2026 |
| Estado | Referencia viva: los RF/RNF se citan desde las issues del repo |

---

## 1. Visión del proyecto

Sistema de gestión de stock y punto de venta para un negocio de repuestos de motos, que corre en una **PC servidor dentro de la LAN del local** y se usa desde cualquier navegador de las demás computadoras de la red, sin instalar nada en los clientes.

Reemplaza el control en papel/planillas por:

- Catálogo de artículos con precios, stock y proveedores.
- Venta rápida con carrito y descuento automático de stock.
- Historial y balance de ventas.
- Importación masiva de artículos desde planillas Excel.
- Dos perfiles de uso claramente separados: **admin** (dueño) y **empleado** (mostrador), con una **única sesión de admin activa a la vez en la red**.

### Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express 5 + TypeScript |
| Base de datos | PostgreSQL + Prisma 7 (driver adapter `PrismaPg`) |
| Autenticación | JWT + bcrypt, login por código único |
| Frontend | React + Vite + Tailwind CSS + TypeScript |
| Archivos | Multer (fotos), xlsx (importación Excel) |

---

## 2. Alcance

**Dentro del alcance:** API backend completa, frontend web (SPA), autenticación por código con roles, sesión única de admin, artículos con foto, venta rápida, historial y balance, importación Excel.

**Fuera del alcance (por ahora):** facturación fiscal, multi-sucursal, app móvil, pedidos a proveedores *(backlog, ver §8)*, operación fuera de LAN.

---

## 3. Glosario

- **Código único:** clave de acceso (ej. `admin123`) que reemplaza a usuario+contraseña. Cada rol tiene su código.
- **Venta rápida:** flujo de POS: buscar artículo → cantidad → carrito → confirmar.
- **Sesión admin activa:** admin autenticado cuyo token está vigente y con heartbeat.
- **LAN:** red local del negocio, sin dependencia de internet.

---

## 4. Requisitos funcionales (RF)

Prioridades: **A** = debe estar (Must), **B** = debería estar (Should), **C** = podría estar (Could).

### E1 — Rectificación del backend (base sana)

> Poner la rama `ventas-balance` consistente con `main` y sin errores de compilación antes de seguir agregando features.

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Integrar `origin/main` (ventas, PR #5) en `ventas-balance` y resolver la referencia rota a `sales.routes` | A |
| RF-02 | Commitear la migración pendiente `add_payment_method` (ENUM `PaymentMethod` + columna en `Sale`) | A |
| RF-03 | `POST /api/sales` debe aceptar y validar `paymentMethod` contra el ENUM (`EFECTIVO` \| `TARJETA` \| `TRANSFERENCIA`), rechazando valores inváliles con 400 | A |
| RF-04 | Corregir los 5 errores de tipos de `articles.controller` (en Express 5, `req.params` es `string \| string[]`; el `code` se pasaba directo a los `where` de Prisma) | A |
| RF-05 | `tsc --noEmit` y `npm run dev` deben pasar/levantar sin errores en la rama de trabajo | A |
| RF-06 | Manejo de errores HTTP consistente (400 validación, 401 no autenticado, 403 sin rol, 404 no existe,500 inesperado) con cuerpo `{ error }` | B |
| RF-07 | Endpoint `GET /api/health` con estado de DB (ya existe; mantenerlo) | B |

### E2 — Autenticación por código único y roles separados

> Migrar del modelo `User` (username+password) al esquema de código único tipo CachitoMotos, con separación estricta admin/empleado.

| ID | Requisito | Prioridad |
|---|---|---|
| RF-10 | Login con **código único** por rol (`POST /api/auth/login` recibe `{ codigo }`); se compara con bcrypt contra el hash de cada usuario conocido | A |
| RF-11 | Migración de modelo: reemplazar `username`/`password` por código(s) con hash; seed con `admin` (`admin123`) y `empleado` (`empleado123`) | A |
| RF-12 | JWT firmado con `JWT_SECRET`, expiración 8 h, payload `{ userId, rol }` | A |
| RF-13 | Middleware `authenticate` en todas las rutas de negocio; 401 si falta/es inválido/expiró | A |
| RF-14 | Middleware de rol: crear/editar/borrar artículos, importar Excel y gestionar usuarios son **solo admin** (403 para empleado) | A |
| RF-15 | El empleado **no recibe** `purchasePrice` ni `minStock` en las respuestas de artículos (serialización por rol) | A |
| RF-16 | `GET /api/auth/me` devuelve rol y usuario del token | B |
| RF-17 | Cambio de códigos de acceso por parte del admin | C |

### E3 — Sesión única de admin en LAN

> Solo puede haber **un admin autenticado a la vez** en toda la red. Empleados: sesiones simultáneas ilimitadas.

| ID | Requisito | Prioridad |
|---|---|---|
| RF-20 | Registro de sesión activa (tabla o almacenamiento en memoria del server) con rol, emisión del token y última señal | A |
| RF-21 | Si un segundo admin intenta loguearse habiendo sesión admin activa → **409** con mensaje claro ("Ya hay una sesión de administrador activa"); el login es rechazado y la sesión existente no se modifica | A |
| RF-22 | Logout del admin (`POST /api/auth/logout`) libera la sesión | A |
| RF-23 | Expiración por inactividad: heartbeat periódico del frontend; si no hay señal durante un TTL configurable (default 5 min), la sesión se libera (cubre caída/cierre del navegador del admin) | A |
| RF-24 | Al expirar el JWT (8 h) la sesión se libera automáticamente | A |
| RF-25 | El empleado puede loguearse siempre; su logout solo cierra su propio token | A |
| RF-26 | Pantalla admin con indicador "sesión activa desde <hora/IP>" y botón desconectar | C |

### E4 — Artículos

| ID | Requisito | Prioridad |
|---|---|---|
| RF-30 | CRUD de artículos: nombre, categoría, modelo de moto, precio de compra, precio de venta, stock, stock mínimo, proveedor, código de barras (opcional) | A |
| RF-31 | Código autogenerado e **inmutable**: 3 letras del nombre (sin tildes) + secuencial de 3 dígitos (`FIL-001`); es primary key | A |
| RF-32 | Precio de venta calculado desde precio de compra + % de ganancia, redondeado **hacia arriba** al múltiplo de 100 más cercano | A |
| RF-33 | Búsqueda por nombre, categoría, modelo, código o código de barras (parcial, insensible a mayúsculas) | A |
| RF-34 | Foto por artículo: upload desde el formulario (Multer), servida en `/uploads`, eliminar | B |
| RF-35 | Listado con indicador de stock bajo (≤ stock mínimo) | B |

### E5 — Importación desde Excel

> Feature heredada de CachitoMotos. Solo admin.

| ID | Requisito | Prioridad |
|---|---|---|
| RF-40 | `POST /api/import/preview`: recibe `.xlsx` (Multer) y devuelve hojas detectadas y vista previa de filas sin persistir nada | A |
| RF-41 | `POST /api/import`: importa con configuración: proveedor, modelo de moto (tipo de prenda o uso), % de ganancia, usar precio del Excel vs recalcular, incluir filas con precio/cantidad 0, stock mínimo, cantidad estándar, selección de hojas y columnas | A |
| RF-42 | Artículos existentes (por código): opción de sumar stock / actualizar precio / saltear | A |
| RF-43 | Importación **transaccional**: o se aplica todo o nada; reporte final con creados, actualizados, salteados y errores por fila | A |
| RF-44 | Límite de tamaño de archivo (ej. 100 MB) y validación de formato con error claro | B |
| RF-45 | Asistente frontend de 2 pasos: subir y previsualizar → configurar y confirmar, con resumen del resultado | A |

### E6 — Venta rápida (POS)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-50 | Carrito: agregar artículos buscando por código, nombre o código de barras; editar cantidades; quitar líneas | A |
| RF-51 | Subtotal por línea y total general en tiempo real | A |
| RF-52 | Tipo de pago obligatorio al confirmar: EFECTIVO, TARJETA o TRANSFERENCIA | A |
| RF-53 | `POST /api/sales` transaccional: crea venta + items y descuenta stock; si algo falla, rollback | A |
| RF-54 | Si la cantidad excede el stock, la venta no se permite y se muestra un **warning** por artículo (stock no puede quedar negativo) | B |
| RF-55 | Cada venta registra: fecha, usuario vendedor (admin - 19:04 - x producto - n $ - tipo de pago), items (artículo, cantidad, precio unitario, total), total y tipo de pago | A |
| RF-56 | UI de venta operable con MnK (búsqueda + Enter + cantidad + F-keys) | B |
| RF-57 | Vaciar carrito / cancelar venta antes de confirmar sin dejar rastro | A |

### E7 — Historial y balance de ventas

| ID | Requisito | Prioridad |
|---|---|---|
| RF-60 | Lista de ventas: fecha, vendedor, cantidad de artículos, total y tipo de pago, orden descendente | A |
| RF-61 | Detalle de venta: items con nombre, cantidad, precio unitario y subtotal | A |
| RF-62 | Filtro por rango de fechas (`from`/`to`) | A |
| RF-63 | Balance del día y por rango: total facturado y desglose por tipo de pago (extender `balance.controller` existente) | A |
| RF-64 | Ver historial: admin ve todas las ventas tanto las suyas como la de los empleados; empleado solo sus propias ventas | B |

---

## 5. Requisitos no funcionales (RNF)

### Operación

| ID | Requisito |
|---|---|
| RNF-01 | **LAN sin internet**: todo funciona con red local; ninguna feature requiere servicios externos (CDN, APIs cloud) |
| RNF-02 | Acceso desde cualquier PC del local vía `http://<IP-servidor>:<puerto>` sin instalación en clientes |
| RNF-03 | Servidor arranca con `npm run dev` (desarrollo) y un solo comando en producción; levanta aunque haya datos previos |

### Rendimiento

| ID | Requisito |
|---|---|
| RNF-10 | Búsqueda de artículos < 500 ms con 10.000 artículos cargados |
| RNF-11 | Confirmación de venta < 1 s; importación de 5.000 filas < 60 s |
| RNF-12 | Heartbeat de sesión: tráfico insignificante (< 1 req/30 s por sesión) |

### Seguridad

| ID | Requisito |
|---|---|
| RNF-20 | Códigos almacenados solo con bcrypt (costo ≥ 10); nunca en texto plano ni en logs |
| RNF-21 | JWT firmado con secreto desde `.env`; expiración máxima 8 h |
| RNF-22 | El empleado no puede obtener precio de compra ni stock mínimo por ningún endpoint (incluido detalle, búsqueda e import) |
| RNF-23 | CORS restringido a la red local; validación de tamaño/tipo en todo upload (fotos y Excel) |
| RNF-24 | Tokens de sesión admin revocables en el server (logout/inactividad) — no basta con que expiren en el cliente |

### Fiabilidad y datos

| ID | Requisito |
|---|---|
| RNF-30 | Ventas e importaciones atómicas (transacciones SQL): nunca stock inconsistente por error a mitad de operación |
| RNF-31 | Si el server se reinicia, la sesión admin muerta no bloquea logins (persistir TTL o liberar al arrancar) |
| RNF-32 | Respaldo: script/documentación de `pg_dump` de la base `stockmanager` y de la carpeta `uploads` |

### Usabilidad

| ID | Requisito |
|---|---|
| RNF-40 | Venta rápida completa en < 30 s usando teclado y mouse|
| RNF-41 | Interfaz en español, tema claro, optimizada para monitor de escritorio (≥ 1366 px) |
| RNF-42 | Mensajes de error accionables ("Ya hay una sesión de admin activa", no códigos crípticos) |

### Mantenibilidad

| ID | Requisito |
|---|---|
| RNF-50 | `tsc --noEmit` sin errores como criterio de merge en toda rama |
| RNF-51 | Migraciones de Prisma siempre commiteadas junto al cambio de schema (nunca untracked) |
| RNF-52 | Convención de commits `feat:`/`fix:`/`chore:` y una feature por rama/PR (como hasta ahora) |
| RNF-53 | Navegadores: últimas 2 versiones de Firefox y Chromium |

---

## 6. Mapa de issues para el repo

> **Actualización (septiembre 2026):** este mapa ya se ejecutó en GitHub. M0 se resolvió con los PR #9/#10/#11; M1 y M2 son las issues #12–#18 con sus milestones. La sección queda como registro del plan original.

Milestones en orden de ejecución. Cada issue lista sus RF/RNF de aceptación.

### M0 — Rectificación backend (E1)

| Issue propuesta | Labels | Aceptación |
|---|---|---|
| `fix: integrar main (sales) en ventas-balance y commitear migración paymentMethod` | `backend`, `fix` | RF-01, RF-02, RF-05 |
| `feat: validar paymentMethod en POST /api/sales` | `backend`, `feat` | RF-03, RNF-50 |
| `fix: tipar query params de Express 5 en articles.controller` | `backend`, `fix` | RF-04, RNF-50 |
| `chore: estandarizar códigos y cuerpos de error HTTP` | `backend`, `chore` | RF-06, RF-07 |

### M1 — Auth código único + sesión admin única (E2, E3)

| Issue propuesta | Labels | Aceptación |
|---|---|---|
| `feat: login por código único (migración de User + seed)` | `backend`, `feat`, `breaking` | RF-10, RF-11, RF-12 |
| `feat: middleware de roles y serialización por rol (ocultar costos al empleado)` | `backend`, `feat` | RF-13, RF-14, RF-15, RNF-22 |
| `feat: registro de sesión y bloqueo de segundo login admin (409)` | `backend`, `feat` | RF-20, RF-21, RF-22, RNF-24 |
| `feat: TTL de sesión admin por heartbeat y liberación al expirar JWT` | `backend`, `feat` | RF-23, RF-24, RF-25, RNF-31 |
| `feat: pantalla de login (frontend) con manejo de 409 de sesión admin` | `frontend`, `feat` | RF-21, RNF-42 |
| `feat: pantalla admin con estado de sesión y desconectar` | `frontend`, `feat`, `C` | RF-26 |

### M2 — Artículos + venta rápida + historial (E4, E6, E7)

| Issue propuesta | Labels | Aceptación |
|---|---|---|
| `feat: generación de código XXX-NNN y cálculo de precio con redondeo a 100` | `backend`, `feat` | RF-31, RF-32 |
| `feat: búsqueda parcial de artículos por nombre/categoría/modelo/barras` | `backend`, `feat` | RF-33, RNF-10 |
| `feat: upload de foto de artículo con Multer` | `backend`, `feat` | RF-34, RNF-23 |
| `feat: UI de artículos (ABM admin, consulta empleado)` | `frontend`, `feat` | RF-30, RF-35, RF-15 |
| `feat: UI de venta rápida con carrito y tipo de pago` | `frontend`, `feat` | RF-50–RF-52, RF-56, RF-57, RNF-40 |
| `feat: warnings de stock en venta y registro completo de la venta` | `backend`, `feat` | RF-53–RF-55, RNF-30 |
| `feat: UI de historial con filtros y detalle` | `frontend`, `feat` | RF-60–RF-62, RF-64 |
| `feat: balance por tipo de pago (día y rango)` | `backend`, `feat` | RF-63 |

### M3 — Importación Excel (E5)

| Issue propuesta | Labels | Aceptación |
|---|---|---|
| `feat: endpoint preview de Excel (hojas y filas)` | `backend`, `feat` | RF-40, RF-44 |
| `feat: importación transaccional con configuración completa` | `backend`, `feat` | RF-41–RF-43, RNF-11, RNF-30 |
| `feat: asistente de importación de 2 pasos (solo admin)` | `frontend`, `feat` | RF-45, RF-14 |

### Reglas de cierre

- Una issue se cierra cuando todos sus RF/RNF de aceptación están verificados (manual o por script).
- Toda rama debe pasar `tsc --noEmit` antes del PR (RNF-50).
- Migraciones Prisma siempre incluidas en el PR que cambia el schema (RNF-51).

---

## 7. Datos de acceso y ejecución

### Códigos de acceso (seed)

| Rol | Código |
|---|---|
| Admin | `admin123` |
| Empleado | `empleado123` |

### Ejecutar en desarrollo

```bash
# 1. Dependencias
npm install

# 2. Base de datos (PostgreSQL local, DB "stockmanager")
npx prisma migrate dev
npx prisma generate

# 3. Datos iniciales (usuarios y artículos de ejemplo)
npm run seed

# 4. Levantar (backend en el puerto de .env, default 2060)
npm run dev

# Frontend (cuando exista): seguir el patrón de CachitoMotos
# npm run dev:frontend   # Vite en 5174 con proxy /api -> backend
```

### Variables de entorno (`.env`)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | String PostgreSQL |
| `PORT` | Puerto del backend |
| `JWT_SECRET` | Firma de tokens |
| `JWT_EXPIRES_IN` | Default `8h` |
| `ADMIN_SESSION_TTL_MIN` | Default `5` (RF-23) |

---

## 8. Backlog / futuro

- **Pedidos a proveedores**: detectar stock ≤ mínimo y agrupar por proveedor con cantidades a pedir (ya existe en CachitoMotos, migrar como M4 si el negocio lo pide).
- Cambio de códigos de acceso desde la UI (RF-17).
- Exportación del historial a Excel/CSV.
- Métricas: artículos más vendidos, ventas por empleado.

---

*Documento de trabajo: ajustar IDs/prioridades a medida que se abran las issues en el repo.*

*Hay 41 issues en 7 Epicas o issues más grandes*

+ logs o registro para el admin para controlar la venta

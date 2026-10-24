# Sistema de Seguridad, Autenticación y Transacciones Confiables de Inventario

Plan de implementación integral para proteger el panel de administración con Google Auth (`djgamer802@gmail.com` y `supposimon@gmail.com`), habilitar catálogo público con pedidos vía WhatsApp para clientes, garantizar transacciones atómicas de stock y ventas (previniendo sobreventa), reemplazar eliminación por anulación de ventas con reposición, registrar entradas con motivo, incorporar papelera de reciclaje y blindar las reglas de Firestore.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas en la fase de aclaración:**
> - **Nivel de permisos:** Ambos correos (`djgamer802@gmail.com` y `supposimon@gmail.com`) tendrán facultades totales de administración (gestión completa de inventario, ventas, reportes, anulaciones, papelera y respaldos).
> - **Vista pública para clientes:** Cualquier usuario sin sesión abierta accederá directamente a un catálogo público limpio, con precios actualizados, buscador, filtros por categoría y botón de pedido directo por WhatsApp. Los costos de compra, márgenes de ganancia, deudores, panel de ventas y botones de edición permanecen ocultos e inaccesibles sin autenticación.
> - **Atribución de acciones:** Cada venta, ajuste de mercadería, anulación de venta, importación o eliminación a papelera registrará automáticamente el correo y nombre del operador logueado.

---

### 1. Overview & Core Concept

- **Qué hace:** Transforma la aplicación en un sistema dual:
  1. **Panel de Gestión Protegido:** Espacio privado exclusivo para los dos administradores con inicio de sesión de Google (persistente entre visitas), control atómico de stock, anulación formal de ventas, trazabilidad de ajustes con motivos, papelera de productos y respaldos blindados.
  2. **Catálogo Digital para Clientes:** Vista pública optimizada para celular y escritorio donde los clientes exploran artículos disponibles y envían su carrito o pedido vía WhatsApp con un solo toque.
- **Público objetivo:**
  - *Administradores:* Vos (`djgamer802@gmail.com`) y tu hermano (`supposimon@gmail.com`) gestionando el negocio en tiempo real desde el celular o computadora.
  - *Clientes:* Personas interesadas en ver productos y consultar o comprar por WhatsApp sin necesidad de registrarse.
- **Valor clave:** Seguridad absoluta de los datos contables y de stock frente a accesos externos, eliminación de errores de inventario mediante operaciones atómicas de Firestore (imposible vender más de lo disponible o desincronizar registros) y auditoría clara de quién realizó cada acción.

---

### 2. User Experience & Visual Design

#### A. Flujos Principales de Usuario

1. **Ingreso de Administradores:**
   - Al tocar el botón "Panel Admin" o ingresar como administrador, se despliega la autenticación con Google (`signInWithPopup`).
   - Si el correo coincide con `djgamer802@gmail.com` o `supposimon@gmail.com`, ingresa al panel completo y la sesión permanece activa en el navegador.
   - Si un usuario no autorizado intenta ingresar con otra cuenta de Google, se muestra una pantalla de "Acceso Restringido" con opción de cambiar de cuenta o regresar al catálogo público.
2. **Flujo de Venta Atómica:**
   - Al marcar una venta, el modal valida inmediatamente que la cantidad solicitada no supere el stock disponible.
   - Se ejecuta una transacción atómica (`runTransaction` de Firestore): descuenta el inventario, registra la venta con el operador y guarda la bitácora de actividad simultáneamente. Si el stock cambió en milisegundos previos, la transacción aborta con mensaje claro y evita saldo negativo.
3. **Flujo de Anulación de Venta (en lugar de borrar):**
   - En el reporte de ventas, el botón "Eliminar" se sustituye por "Anular Venta".
   - Abre un modal que solicita obligatoriamente el motivo de la anulación (ej. "Cliente canceló el pedido", "Error de tipeo de cantidad", "Devolución de mercadería").
   - Transacción atómica: marca la venta como `status: 'anulada'`, repone automáticamente las unidades al stock del producto y deja constancia en la bitácora con el nombre de quien anuló.
4. **Entrada de Mercadería & Ajustes con Motivo:**
   - En cada tarjeta de producto y en el modal de stock, el botón rápido `+` y el ajuste manual permiten indicar motivo (ej. "Compra a proveedor", "Reposición de depósito", "Ajuste por conteo físico").
5. **Papelera de Reciclaje (Soft Delete):**
   - Borrar un producto no lo destruye de inmediato; lo mueve a la sección "Papelera" (`isDeleted: true`).
   - Desde la Papelera es posible restaurar el producto con un clic o realizar un vaciado permanente con doble confirmación de seguridad.
6. **Catálogo Público de Clientes:**
   - Vista limpia sin cifras de costo, margen ni deudas.
   - Cada producto muestra foto (o icono estilizado), marca, nombre, precio de venta y botón "Pedir por WhatsApp".

#### B. Identidad Visual y Diseño (Anti-Slop & Mobile First)

- **Dirección estética:** Tablero de operaciones profesional y contemporáneo. Tipografía sans pulcra y de alto rendimiento (`Plus Jakarta Sans`), con cifras financieras en números tabulares (`font-mono tabular-nums`).
- **Gama cromática 60-30-10:**
  - *Canvas (60%):* Blanco puro y gris neutro ultra sutil (`#F8FAFC` / `#FFFFFF`).
  - *Estructura (30%):* Superficies con bordes de 1px sutiles (`border-slate-200`), tarjetas de elevación única y tipografía grafito (`#0F172A`, `#475569`).
  - *Acentos (10%):* Verde esmeralda para ventas y acciones comerciales (`#059669`), azul pizarra para acciones del sistema y ámbar suave para estados de deuda o anulaciones.
- **Disciplina tipográfica:** Sin textos entre corchetes mecánicos ni pills genéricos apilados. Metadatos limpios con separadores tipográficos (`·`).

---

### 3. Key Product Decisions & Trade-Offs

- **Autenticación con Google vía Popup (`signInWithPopup`):**
  - *Decisión:* Usar ventana emergente emergente de Google Auth en lugar de redirección completa.
  - *Por qué:* El entorno de iframe de AI Studio mantiene de forma segura el origen en popup y evita roturas de redirección en navegadores móviles modernos.
  - *Persistencia:* `browserLocalPersistence` para que al volver a abrir la página en su teléfono o PC no requiera autenticarse nuevamente.
- **Transacciones Atómicas de Firestore (`runTransaction`):**
  - *Decisión:* Unificar descuento de stock, creación de venta y bitácora en una única transacción de Firestore.
  - *Por qué:* Previene condiciones de carrera cuando ambos hermanos registran ventas al mismo tiempo o si se pierde la conexión a mitad de proceso. El stock jamás queda en discordancia con las ventas.
- **Anulación en lugar de borrado físico de ventas:**
  - *Decisión:* Conservar el histórico con estado `anulada: true` y devolver stock.
  - *Por qué:* Mantiene integridad contable, auditoría clara para ambos socios y evita pérdidas misteriosas de dinero o stock.
- **Papelera de Reciclaje (Soft-Delete) para Productos:**
  - *Decisión:* Marcar `isDeleted: true` con `deletedAt` y `deletedBy` en lugar de `deleteDoc` inmediato.
  - *Por qué:* Previene borrados accidentales de productos con ventas históricas vinculadas y permite restaurar artículos sin tener que volver a cargarlos.
- **Importación Segura por Lotes con Validación Previa:**
  - *Decisión:* Pre-validar filas de Excel/JSON antes de escribir en Firestore con `writeBatch` (máximo 450 ops por lote).
  - *Por qué:* Evita que un archivo dañado deje el catálogo a medio importar.

---

### 4. Technical Architecture & Data Strategy

#### Diagrama de Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Navegador / Dispositivo                         │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   Catálogo Público    │             │   Panel Admin Autorizado   │  │
│  │ (Sin Login Requerido) │             │  (Google Auth Persistente) │  │
│  │                       │             │                            │  │
│  │ · Lista de Productos  │             │ · djgamer802@gmail.com     │  │
│  │ · Precio de Venta     │             │ · supposimon@gmail.com     │  │
│  │ · Búsqueda y Filtros  │             │                            │  │
│  │ · Pedido por WhatsApp │             │ · Stock / Costos / Ganancia│  │
│  └───────────┬───────────┘             │ · Ventas & Anulaciones     │  │
│              │                         │ · Papelera & Respaldos     │  │
│              │                         └─────────────┬──────────────┘  │
└──────────────┼───────────────────────────────────────┼─────────────────┘
               │ (Lectura pública)                     │ (Transacciones atómicas)
               ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Firebase Firestore + Auth                         │
│                                                                        │
│  ┌─────────────────────────┐          ┌─────────────────────────────┐  │
│  │      /productos         │          │          /ventas            │  │
│  │ (stock, precio, costo)  │          │ (venta, anulada, operador)  │  │
│  └───────────┬─────────────┘          └──────────────┬──────────────┘  │
│              │                                       │                 │
│              ├───────────────────┬───────────────────┤                 │
│              ▼                   ▼                   ▼                 │
│  ┌─────────────────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │      /activityLogs      │ │  /admins (o) │ │ /categoryThresholds │  │
│  │ (movimientos, operador) │ │ Reglas Email │ │ (configuración)     │  │
│  └─────────────────────────┘ └──────────────┘ └─────────────────────┘  │
│                                                                        │
│  Reglas de Seguridad (firestore.rules):                                │
│  - allow read en productos activos para todos.                         │
│  - allow write, ventas y logs sólo para djgamer802 y supposimon.       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Modelo de Datos Actualizado

- **Producto (`Product`):**
  - `id`: string
  - `name`: string, `brand`: string, `category`: string, `sku`: string
  - `stock`: number, `minStock`: number
  - `costPrice`: number, `sellingPrice`: number
  - `notes`?: string
  - `isDeleted`?: boolean *(soft delete)*
  - `deletedAt`?: number, `deletedBy`?: string
  - `createdAt`: number, `updatedAt`: number, `updatedBy`?: string
- **Venta (`Venta`):**
  - `id`: string, `productId`: string, `productName`: string, `brand`: string
  - `sellingPrice`: number, `costPrice`: number, `quantity`: number, `profit`: number
  - `paymentMethod`: `'Efectivo' | 'Transferencia' | 'Crédito'`
  - `debtorName`?: string, `isPaid`?: boolean, `debtAmount`?: number
  - `timestamp`: number, `deviceModel`: string
  - `operatorEmail`: string, `operatorName`: string *(quién registró la venta)*
  - `status`: `'completada' | 'anulada'`
  - `voidReason`?: string, `voidTimestamp`?: number, `voidBy`?: string *(quién anuló)*
- **Bitácora (`ActivityLog`):**
  - `id`: string, `productId`: string, `productName`: string
  - `type`: `'sale' | 'restock' | 'adjustment' | 'void_sale' | 'trash' | 'restore'`
  - `quantity`: number, `prevStock`: number, `newStock`: number
  - `reason`?: string *(motivo de entrada/ajuste/anulación)*
  - `operatorEmail`: string, `operatorName`: string
  - `timestamp`: number

#### Componentes e Interacciones a Desarrollar

1. **`src/context/AuthContext.tsx`:** Hook `useAuth` para gestionar sesión de Google, estado de carga, detección de si es administrador autorizado (`isAuthorizedAdmin`) y métodos `loginWithGoogle` / `logout`.
2. **`src/components/AdminGateModal.tsx`:** Modal de ingreso para los administradores y mensaje elegante de rechazo si se inicia sesión con una cuenta no autorizada.
3. **`src/components/PublicCatalogView.tsx`:** Interfaz limpia del catálogo para clientes, con carrito flotante opcional y generación de mensaje listo para WhatsApp.
4. **`src/components/VoidSaleModal.tsx`:** Modal para anulación de venta con campo obligatorio de motivo y vista previa de devolución al stock.
5. **`src/components/StockAdjustmentModal.tsx`:** Modal para registrar entradas de mercadería o ajustes con motivo y operador.
6. **`src/components/TrashModal.tsx`:** Gestión de papelera de reciclaje con opción de restaurar o purgar permanentemente.
7. **`src/services/dbService.ts`:** Funciones de transacciones seguras con `runTransaction` y control de concurrencia.
8. **`firestore.rules`:** Reglas auditadas según la especificación del skill de Firebase, desplegadas con `fax:DeployRules`.

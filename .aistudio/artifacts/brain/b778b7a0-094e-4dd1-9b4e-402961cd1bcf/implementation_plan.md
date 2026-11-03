# Plan y Estado de Implementación: Cambio de Precios por Marca

## Funcionalidad Solicitada
Permitir a los administradores actualizar masivamente los precios de los productos según su marca para agilizar la gestión de stock y ventas.

## Cambios Implementados

1. **Servicio de Base de Datos (`src/services/dbService.ts`)**:
   - Se añadió `updatePricesByBrand` con procesamiento por lotes (`writeBatch`) de hasta 400 operaciones simultáneas.
   - Actualiza tanto `sellingPrice` como `precio`, y opcionalmente `costPrice` y `precioCosto`.
   - Registra auditoría automática en la colección `activityLogs` con el motivo y cantidad de productos modificados.

2. **Componente Modal (`src/components/BulkBrandPriceModal.tsx`)**:
   - **Selector de Marca**: Muestra las marcas registradas en el catálogo con el conteo de artículos disponibles.
   - **3 Modos de Actualización**:
     - *Precio Fijo*: Define un monto exacto de venta (ej: $28.000) con opción de actualizar precio de costo.
     - *Porcentaje (%)*: Ajustes como +5%, +10%, +15%, +20%, etc., con regla de redondeo a $500 o $1.000.
     - *Sumar o Restar Monto ($)*: Incrementos o descuentos fijos (ej: +$2.000 o -$1.000).
   - **Vista Previa en Tiempo Real**: Lista interactiva con casillas para incluir/excluir artículos individuales, mostrando precios anteriores vs nuevos precios con etiquetas de variación.

3. **Integración en la Interfaz (`src/App.tsx`)**:
   - Botón directo **"Precios por Marca"** en la barra de herramientas superior.
   - Botón de acceso rápido **"Precios"** junto al filtro de marca cuando hay una marca seleccionada.
   - Notificación emergente toast tras cada actualización exitosa.

4. **Depuración de Pantalla de Acceso (`src/components/AdminLoginView.tsx`)**:
   - Se removió el bloque explicativo con los correos y mensajes informativos en la tarjeta de inicio de sesión para mantener una pantalla limpia y directa con el botón de Google.

5. **Reglas de Seguridad Firestore (`firestore.rules`)**:
   - Actualizado el permiso de escritura para `catalogo_publico` a `isAuthorizedAdmin()` y desplegado a producción mediante `deploy_firebase`.

6. **Solución y Sincronización Automática con `catalogo_publico` (Web de Clientes)**:
   - **Causa identificada**: Cuando se aplicaba el cambio de precio por lote o cuando los productos se cargaron inicialmente, `catalogo_publico` se actualizaba solo con el precio sin incluir la marca (`marca` / `brand`) ni el nombre (`nombre` / `name`), o no se escribía directamente en las operaciones individuales (ventas, entradas de stock, edición).
   - **Formato bilingüe completo (`buildPublicProductData`)**: Ahora cada documento en `catalogo_publico` contiene simultáneamente los campos en español e inglés (`nombre` + `name`, `marca` + `brand`, `categoria` + `category`, `precio` + `price` + `sellingPrice`, `disponible` + `stock` + `cantidad`), garantizando que cualquier página externa los lea sin importar la propiedad que busque.
   - **Sincronización directa en cada operación**: `addProduct`, `updateProduct`, `adjustStockWithReason`, `executeSaleTransaction`, `voidSaleTransaction`, `moveToTrashProduct`, `restoreProductFromTrash`, `permanentDeleteProduct`, `emptyTrash`, `seedOfficialCatalog` y `updatePricesByBrand` actualizan de forma instantánea y atómica ambas colecciones (`productos` y `catalogo_publico`).
   - **Sincronización masiva automática y botón en panel**: Al iniciar sesión o cargar el inventario, se ejecuta una sincronización automática en segundo plano de todos los productos hacia `catalogo_publico`, y se integró el botón **"Sincronizar Web"** en la barra superior para forzar la sincronización en cualquier momento con un solo clic.

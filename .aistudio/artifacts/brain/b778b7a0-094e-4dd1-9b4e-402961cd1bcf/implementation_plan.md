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

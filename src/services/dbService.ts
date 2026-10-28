import {
  collection,
  type DocumentData,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product, ActivityLog, ProductInput, Venta } from '../types';
import { sampleProducts } from '../data/sampleProducts';

// Collection constants
const PRODUCTS_COLLECTION = 'productos';
const VENTAS_COLLECTION = 'ventas';
const LOGS_COLLECTION = 'activityLogs';
const CATEGORY_SETTINGS_COLLECTION = 'categoryThresholds';
const PUBLIC_CATALOG_COLLECTION = 'catalogo_publico';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function syncPublicCatalogProduct(productId: string, data: DocumentData) {
  const publicProduct: Record<string, unknown> = {
    nombre: data.nombre ?? data.name ?? '',
    marca: data.marca ?? data.brand ?? '',
    categoria: data.category ?? data.categoria ?? 'Vapes',
    precio: Number(data.precio ?? data.sellingPrice ?? 0),
    disponible: Number(data.cantidad ?? data.stock ?? 0) > 0,
    inventorySource: true,
    inventoryDeleted: data.isDeleted === true,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  };
  const description = data.notes ?? data.notas ?? data.description ?? data.descripcion;
  if (typeof description === 'string' && description.trim()) {
    publicProduct.descripcion = description;
  }
  const imageUrl = data.imagenUrl ?? data.imageUrl ?? data.image;
  if (typeof imageUrl === 'string' && imageUrl.trim()) {
    publicProduct.imagenUrl = imageUrl;
  }
  const variants = data.variantes ?? data.variants ?? data.flavors;
  if (Array.isArray(variants)) {
    publicProduct.variantes = variants.filter(
      (variant): variant is string => typeof variant === 'string'
    );
  }

  await setDoc(
    doc(db, PUBLIC_CATALOG_COLLECTION, productId),
    publicProduct,
    { merge: true }
  );
}

async function removePublicCatalogProduct(productId: string) {
  const publicProductRef = doc(db, PUBLIC_CATALOG_COLLECTION, productId);
  const publicProduct = await getDoc(publicProductRef);
  if (publicProduct.exists() && publicProduct.data().inventorySource === true) {
    await deleteDoc(publicProductRef);
  }
}

// Subscribe to real-time products
// We do not use orderBy('createdAt') in the query because Firestore strictly excludes
// any documents that lack that field. Instead, we query the collection and sort in memory.
export function subscribeToProducts(
  callback: (products: Product[]) => void,
  onCatalogSyncError?: (error: Error) => void
) {
  const q = collection(db, PRODUCTS_COLLECTION);
  
  return onSnapshot(q, (snapshot) => {
    try {
      const catalogSync = snapshot.docChanges().map((change) =>
        change.type === 'removed'
          ? removePublicCatalogProduct(change.doc.id)
          : syncPublicCatalogProduct(change.doc.id, change.doc.data())
      );
      void Promise.all(catalogSync).catch((error: unknown) => {
        const syncError = error instanceof Error
          ? error
          : new Error(String(error));
        console.error('Error sincronizando el catálogo público:', syncError);
        onCatalogSyncError?.(syncError);
      });

      const products: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        products.push({
          id: doc.id,
          name: data.nombre !== undefined ? data.nombre : (data.name ?? ''),
          brand: data.marca !== undefined ? data.marca : (data.brand ?? ''),
          category: data.category ?? data.categoria ?? 'Vapes',
          stock: Number(data.cantidad !== undefined ? data.cantidad : (data.stock ?? 0)),
          minStock: Number(data.minStock !== undefined ? data.minStock : (data.stockMinimo ?? 5)),
          useCategoryThreshold: !!data.useCategoryThreshold,
          costPrice: Number(data.costPrice ?? data.precioCosto ?? 0),
          sellingPrice: Number(data.precio !== undefined ? data.precio : (data.sellingPrice ?? 0)),
          sku: data.sku ?? '',
          notes: data.notes ?? data.notas ?? '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
          isDeleted: !!data.isDeleted,
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
          updatedBy: data.updatedBy
        } as Product);
      });
      // Sort products safely in memory by createdAt descending
      products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(products);
    } catch (error) {
      console.warn('Error procesando snapshot de productos:', error);
    }
  }, (error) => {
    console.warn('Alerta en suscripción a productos (esperando autenticación si aplica):', error?.message || error);
    onCatalogSyncError?.(error);
  });
}

// Add a new product
export async function addProduct(
  productInput: ProductInput, 
  operatorEmail: string = '', 
  operatorName: string = ''
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      name: productInput.name,
      nombre: productInput.name,
      brand: productInput.brand,
      marca: productInput.brand,
      category: productInput.category,
      stock: productInput.stock,
      cantidad: productInput.stock,
      minStock: productInput.minStock,
      costPrice: productInput.costPrice,
      sellingPrice: productInput.sellingPrice,
      precio: productInput.sellingPrice,
      sku: productInput.sku,
      notes: productInput.notes || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: operatorEmail,
      isDeleted: false
    });
    
    // Log activity
    await logActivity({
      productId: docRef.id,
      productName: productInput.name,
      type: 'restock',
      quantity: productInput.stock,
      prevStock: 0,
      newStock: productInput.stock,
      costPrice: productInput.costPrice,
      sellingPrice: productInput.sellingPrice,
      reason: 'Creación de producto nuevo',
      operatorEmail,
      operatorName
    });

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
  }
}

// Update an existing product
export async function updateProduct(
  id: string, 
  updates: Partial<ProductInput> & { previousState?: Product },
  operatorEmail: string = '',
  operatorName: string = ''
): Promise<void> {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    const dataToUpdate: Record<string, any> = {
      ...updates,
      updatedAt: Date.now(),
      updatedBy: operatorEmail
    };
    
    if (updates.name !== undefined) dataToUpdate.nombre = updates.name;
    if (updates.brand !== undefined) dataToUpdate.marca = updates.brand;
    if (updates.stock !== undefined) dataToUpdate.cantidad = updates.stock;
    if (updates.sellingPrice !== undefined) dataToUpdate.precio = updates.sellingPrice;

    delete dataToUpdate.previousState;
    
    await updateDoc(docRef, dataToUpdate);

    if (updates.previousState && updates.stock !== undefined && updates.stock !== updates.previousState.stock) {
      const diff = updates.stock - updates.previousState.stock;
      await logActivity({
        productId: id,
        productName: updates.name || updates.previousState.name,
        type: diff > 0 ? 'restock' : 'adjustment',
        quantity: Math.abs(diff),
        prevStock: updates.previousState.stock,
        newStock: updates.stock,
        costPrice: updates.costPrice !== undefined ? updates.costPrice : updates.previousState.costPrice,
        sellingPrice: updates.sellingPrice !== undefined ? updates.sellingPrice : updates.previousState.sellingPrice,
        reason: 'Edición directa de datos de producto',
        operatorEmail,
        operatorName
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

// Soft Delete (Mover a la papelera)
export async function moveToTrashProduct(
  id: string, 
  name: string,
  operatorEmail: string = '',
  operatorName: string = ''
): Promise<void> {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: operatorName || operatorEmail || 'Administrador',
      updatedAt: Date.now(),
      updatedBy: operatorEmail
    });

    await logActivity({
      productId: id,
      productName: name,
      type: 'trash',
      quantity: 0,
      prevStock: 0,
      newStock: 0,
      costPrice: 0,
      sellingPrice: 0,
      reason: 'Producto enviado a la papelera de reciclaje',
      operatorEmail,
      operatorName
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

// Restaurar producto de la papelera
export async function restoreProductFromTrash(
  id: string, 
  name: string,
  operatorEmail: string = '',
  operatorName: string = ''
): Promise<void> {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedAt: Date.now(),
      updatedBy: operatorEmail
    });

    await logActivity({
      productId: id,
      productName: name,
      type: 'restore',
      quantity: 0,
      prevStock: 0,
      newStock: 0,
      costPrice: 0,
      sellingPrice: 0,
      reason: 'Producto restaurado desde la papelera',
      operatorEmail,
      operatorName
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

// Borrado permanente definitivo (desde la papelera con doble confirmación)
export async function permanentDeleteProduct(
  id: string, 
  name: string,
  operatorEmail: string = '',
  operatorName: string = ''
): Promise<void> {
  try {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, id));
    
    await logActivity({
      productId: id,
      productName: name,
      type: 'adjustment',
      quantity: 0,
      prevStock: 0,
      newStock: 0,
      costPrice: 0,
      sellingPrice: 0,
      reason: 'Eliminado permanentemente de la papelera de reciclaje',
      operatorEmail,
      operatorName
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

// Legacy alias for compatibility
export async function deleteProduct(id: string, name: string): Promise<void> {
  return moveToTrashProduct(id, name);
}

// Realizar ajustes o entradas de stock con motivo y operador
export async function adjustStockWithReason(
  product: Product, 
  amount: number, 
  type: 'restock' | 'adjustment',
  reason: string,
  operatorEmail: string = '',
  operatorName: string = ''
): Promise<void> {
  if (amount === 0) return;
  
  try {
    const newStock = Math.max(0, product.stock + amount);
    const docRef = doc(db, PRODUCTS_COLLECTION, product.id);
    
    await updateDoc(docRef, {
      stock: newStock,
      cantidad: newStock,
      updatedAt: Date.now(),
      updatedBy: operatorEmail
    });

    await logActivity({
      productId: product.id,
      productName: product.name,
      type: type,
      quantity: Math.abs(amount),
      prevStock: product.stock,
      newStock: newStock,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      reason: reason || (amount > 0 ? 'Entrada de mercadería' : 'Ajuste de inventario'),
      operatorEmail,
      operatorName
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${product.id}`);
  }
}

// Quick adjust stock fallback
export async function adjustStock(
  product: Product, 
  amount: number, 
  type: 'sale' | 'restock'
): Promise<void> {
  return adjustStockWithReason(
    product, 
    amount, 
    type === 'sale' ? 'adjustment' : 'restock',
    type === 'sale' ? 'Venta rápida' : 'Entrada rápida'
  );
}

// =========================================================================
// ATOMIC SALES TRANSACTIONS (RUNTRANSACTION)
// =========================================================================

export interface SaleTransactionInput {
  productId: string;
  productName: string;
  brand: string;
  sellingPrice: number;
  costPrice: number;
  quantity: number;
  profit: number;
  paymentMethod: 'Efectivo' | 'Transferencia' | 'Crédito';
  deviceModel: string;
  debtorName?: string;
  isPaid?: boolean;
  debtAmount?: number;
  operatorEmail: string;
  operatorName: string;
}

/**
 * Transacción atómica:
 * 1. Verifica en el servidor que haya suficiente stock disponible.
 * 2. Si no hay suficiente stock, rechaza y cancela sin modificar nada.
 * 3. Descuenta las unidades del producto.
 * 4. Crea el registro de venta con estado 'completada'.
 * 5. Registra la actividad en la bitácora vinculada al operador.
 */
export async function executeSaleTransaction(input: SaleTransactionInput): Promise<string> {
  const productRef = doc(db, PRODUCTS_COLLECTION, input.productId);
  const ventaRef = doc(collection(db, VENTAS_COLLECTION));
  const logRef = doc(collection(db, LOGS_COLLECTION));

  try {
    await runTransaction(db, async (transaction) => {
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) {
        throw new Error(`El producto "${input.productName}" no existe en el catálogo.`);
      }

      const pData = productSnap.data();
      if (pData.isDeleted) {
        throw new Error(`El producto "${input.productName}" se encuentra en la papelera y no se puede vender.`);
      }

      const currentStock = Number(pData.cantidad !== undefined ? pData.cantidad : (pData.stock ?? 0));
      if (currentStock < input.quantity) {
        throw new Error(
          `Stock insuficiente para vender ${input.quantity} unidad(es). Stock actual disponible: ${currentStock}.`
        );
      }

      const newStock = currentStock - input.quantity;

      // 1. Actualizar producto
      transaction.update(productRef, {
        stock: newStock,
        cantidad: newStock,
        updatedAt: Date.now(),
        updatedBy: input.operatorEmail
      });

      // 2. Crear documento de Venta
      const debtAmountVal = input.debtAmount !== undefined 
        ? input.debtAmount 
        : (input.isPaid ? 0 : (input.sellingPrice * input.quantity));

      transaction.set(ventaRef, {
        productId: input.productId,
        productName: input.productName,
        brand: input.brand,
        sellingPrice: input.sellingPrice,
        costPrice: input.costPrice,
        quantity: input.quantity,
        profit: input.profit,
        paymentMethod: input.paymentMethod,
        timestamp: Date.now(),
        deviceModel: input.deviceModel,
        debtorName: input.debtorName || '',
        isPaid: input.isPaid !== undefined ? input.isPaid : true,
        debtAmount: debtAmountVal,
        status: 'completada',
        operatorEmail: input.operatorEmail,
        operatorName: input.operatorName,
        // Compatibilidad Kotlin Android
        marca: input.brand,
        nombreProducto: input.productName,
        precioVenta: input.sellingPrice,
        cantidadVendida: input.quantity,
        precioCosto: input.costPrice,
        clienteDeudor: input.debtorName || '',
        pagado: input.isPaid !== undefined ? input.isPaid : true,
        montoDeuda: debtAmountVal
      });

      // 3. Crear registro en bitácora
      transaction.set(logRef, {
        productId: input.productId,
        productName: input.productName,
        type: 'sale',
        quantity: input.quantity,
        prevStock: currentStock,
        newStock: newStock,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        reason: `Venta registrada (${input.paymentMethod})`,
        operatorEmail: input.operatorEmail,
        operatorName: input.operatorName,
        timestamp: Date.now()
      });
    });

    return ventaRef.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Stock insuficiente')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, VENTAS_COLLECTION);
  }
}

/**
 * Transacción atómica de Anulación de Venta:
 * 1. Verifica que la venta exista y que no esté anulada previamente.
 * 2. Si el producto aún existe, le restituye las unidades vendidas al stock.
 * 3. Marca la venta como status: 'anulada' con motivo, timestamp y operador.
 * 4. Deja constancia en la bitácora de actividad.
 */
export async function voidSaleTransaction(
  ventaId: string, 
  reason: string,
  operatorEmail: string = '',
  operatorName: string = ''
): Promise<void> {
  const ventaRef = doc(db, VENTAS_COLLECTION, ventaId);
  const logRef = doc(collection(db, LOGS_COLLECTION));

  try {
    await runTransaction(db, async (transaction) => {
      const ventaSnap = await transaction.get(ventaRef);
      if (!ventaSnap.exists()) {
        throw new Error('La venta que intentas anular no existe.');
      }

      const vData = ventaSnap.data();
      if (vData.status === 'anulada') {
        throw new Error('Esta venta ya fue anulada anteriormente.');
      }

      const quantityToReturn = Number(vData.cantidadVendida !== undefined ? vData.cantidadVendida : (vData.quantity ?? 1));
      const productId = vData.productId;

      let prevStock = 0;
      let newStock = 0;

      // Restituir stock si el producto existe
      if (productId) {
        const productRef = doc(db, PRODUCTS_COLLECTION, productId);
        const productSnap = await transaction.get(productRef);
        
        if (productSnap.exists()) {
          const pData = productSnap.data();
          prevStock = Number(pData.cantidad !== undefined ? pData.cantidad : (pData.stock ?? 0));
          newStock = prevStock + quantityToReturn;

          transaction.update(productRef, {
            stock: newStock,
            cantidad: newStock,
            updatedAt: Date.now(),
            updatedBy: operatorEmail
          });
        }
      }

      // 2. Marcar la venta como anulada
      transaction.update(ventaRef, {
        status: 'anulada',
        voidReason: reason || 'Anulación solicitada por el administrador',
        voidTimestamp: Date.now(),
        voidBy: operatorName || operatorEmail || 'Administrador',
        updatedAt: Date.now()
      });

      // 3. Registrar en bitácora
      transaction.set(logRef, {
        productId: productId || 'unknown',
        productName: vData.nombreProducto || vData.productName || 'Producto',
        type: 'void_sale',
        quantity: quantityToReturn,
        prevStock,
        newStock,
        costPrice: Number(vData.precioCosto || vData.costPrice || 0),
        sellingPrice: Number(vData.precioVenta || vData.sellingPrice || 0),
        reason: `Venta anulada: ${reason}`,
        operatorEmail,
        operatorName,
        timestamp: Date.now()
      });
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('ya fue anulada') || error.message.includes('no existe'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `${VENTAS_COLLECTION}/${ventaId}`);
  }
}

// Legacy addVenta wrapper
export async function addVenta(ventaInput: Omit<Venta, 'id'>): Promise<string> {
  return executeSaleTransaction({
    productId: ventaInput.productId,
    productName: ventaInput.productName,
    brand: ventaInput.brand,
    sellingPrice: ventaInput.sellingPrice,
    costPrice: ventaInput.costPrice,
    quantity: ventaInput.quantity,
    profit: ventaInput.profit,
    paymentMethod: ventaInput.paymentMethod,
    deviceModel: ventaInput.deviceModel,
    debtorName: ventaInput.debtorName,
    isPaid: ventaInput.isPaid,
    debtAmount: ventaInput.debtAmount,
    operatorEmail: ventaInput.operatorEmail || '',
    operatorName: ventaInput.operatorName || 'Administrador'
  });
}

// Log activity helper
interface ActivityLogInput {
  productId: string;
  productName: string;
  type: 'sale' | 'restock' | 'adjustment' | 'void_sale' | 'trash' | 'restore';
  quantity: number;
  prevStock: number;
  newStock: number;
  costPrice: number;
  sellingPrice: number;
  reason?: string;
  operatorEmail?: string;
  operatorName?: string;
}

export async function logActivity(log: ActivityLogInput): Promise<void> {
  try {
    await addDoc(collection(db, LOGS_COLLECTION), {
      ...log,
      timestamp: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, LOGS_COLLECTION);
  }
}

// Subscribe to activity logs
export function subscribeToActivityLogs(callback: (logs: ActivityLog[]) => void, maxCount: number = 50) {
  const q = collection(db, LOGS_COLLECTION);

  return onSnapshot(q, (snapshot) => {
    try {
      const logs: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data()
        } as ActivityLog);
      });
      // Sort in memory by timestamp descending and take maxCount
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(logs.slice(0, maxCount));
    } catch (error) {
      console.warn('Error procesando snapshot de bitácora:', error);
    }
  }, (error) => {
    console.warn('Alerta en suscripción a bitácora:', error?.message || error);
  });
}

// Clear all activity logs
export async function clearAllActivityLogs(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, LOGS_COLLECTION));
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, LOGS_COLLECTION);
  }
}

// Subscribe to category thresholds
export function subscribeToCategoryThresholds(callback: (thresholds: Record<string, number>) => void) {
  const q = query(collection(db, CATEGORY_SETTINGS_COLLECTION));
  
  return onSnapshot(q, (snapshot) => {
    try {
      const thresholds: Record<string, number> = {};
      snapshot.forEach((doc) => {
        thresholds[doc.id] = doc.data().minStock || 5;
      });
      callback(thresholds);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, CATEGORY_SETTINGS_COLLECTION);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, CATEGORY_SETTINGS_COLLECTION);
  });
}

// Update category threshold
export async function updateCategoryThreshold(category: string, minStock: number): Promise<void> {
  try {
    const docRef = doc(db, CATEGORY_SETTINGS_COLLECTION, category);
    await setDoc(docRef, { minStock, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CATEGORY_SETTINGS_COLLECTION}/${category}`);
  }
}

// Subscribe to real-time sales
export function subscribeToVentas(callback: (ventas: Venta[]) => void) {
  const q = collection(db, VENTAS_COLLECTION);
  
  return onSnapshot(q, (snapshot) => {
    try {
      const ventas: Venta[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        ventas.push({
          id: doc.id,
          productId: data.productId ?? '',
          productName: data.nombreProducto !== undefined ? data.nombreProducto : (data.productName ?? ''),
          brand: data.marca !== undefined ? data.marca : (data.brand ?? ''),
          sellingPrice: Number(data.precioVenta !== undefined ? data.precioVenta : (data.sellingPrice ?? 0)),
          costPrice: Number(data.costPrice !== undefined ? data.costPrice : (data.precioCosto ?? 0)),
          quantity: Number(data.cantidadVendida !== undefined ? data.cantidadVendida : (data.quantity ?? 1)),
          profit: Number(data.profit !== undefined ? data.profit : 0),
          paymentMethod: data.paymentMethod ?? 'Efectivo',
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : (data.fecha ?? Date.now()),
          deviceModel: data.deviceModel ?? 'Web App',
          debtorName: data.debtorName ?? data.clienteDeudor ?? '',
          isPaid: data.isPaid !== undefined ? data.isPaid : (data.pagado ?? true),
          debtAmount: data.debtAmount !== undefined ? Number(data.debtAmount) : (data.montoDeuda !== undefined ? Number(data.montoDeuda) : undefined),
          status: data.status || 'completada',
          operatorEmail: data.operatorEmail ?? '',
          operatorName: data.operatorName ?? '',
          voidReason: data.voidReason,
          voidTimestamp: data.voidTimestamp,
          voidBy: data.voidBy
        } as Venta);
      });
      // Sort in memory by timestamp descending
      ventas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(ventas);
    } catch (error) {
      console.warn('Error procesando snapshot de ventas:', error);
    }
  }, (error) => {
    console.warn('Alerta en suscripción a ventas:', error?.message || error);
  });
}

// Update a sale record (e.g. paying debt)
export async function updateVenta(id: string, updates: Partial<Venta>): Promise<void> {
  try {
    const docRef = doc(db, VENTAS_COLLECTION, id);
    const dataToUpdate: Record<string, any> = {
      ...updates,
      updatedAt: Date.now()
    };
    
    if (updates.debtorName !== undefined) {
      dataToUpdate.clienteDeudor = updates.debtorName;
    }
    if (updates.isPaid !== undefined) {
      dataToUpdate.pagado = updates.isPaid;
    }
    if (updates.debtAmount !== undefined) {
      dataToUpdate.montoDeuda = updates.debtAmount;
    }

    await updateDoc(docRef, dataToUpdate);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${VENTAS_COLLECTION}/${id}`);
  }
}

// Delete individual sale (Legacy, now mapped to voidSale if reason not provided)
export async function deleteVenta(id: string, reason: string = 'Eliminación manual'): Promise<void> {
  return voidSaleTransaction(id, reason);
}

// Clear all sales
export async function clearAllVentas(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, VENTAS_COLLECTION));
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, VENTAS_COLLECTION);
  }
}

// Clear all products
export async function clearAllProducts(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PRODUCTS_COLLECTION);
  }
}

// Empty Trash (Vaciar papelera permanentemente)
export async function emptyTrash(operatorEmail: string = '', operatorName: string = ''): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const batch = writeBatch(db);
    let count = 0;
    querySnapshot.forEach((docSnap) => {
      if (docSnap.data().isDeleted) {
        batch.delete(docSnap.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
      await logActivity({
        productId: 'batch',
        productName: `${count} productos`,
        type: 'trash',
        quantity: count,
        prevStock: 0,
        newStock: 0,
        costPrice: 0,
        sellingPrice: 0,
        reason: `Vaciado total de papelera (${count} artículos eliminados definitivamente)`,
        operatorEmail,
        operatorName
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PRODUCTS_COLLECTION);
  }
}

// Safe Full Backup Export
export async function exportAllDataAsJson(): Promise<string> {
  try {
    const [productsSnap, ventasSnap, logsSnap] = await Promise.all([
      getDocs(collection(db, PRODUCTS_COLLECTION)),
      getDocs(collection(db, VENTAS_COLLECTION)),
      getDocs(collection(db, LOGS_COLLECTION))
    ]);

    const backup = {
      exportDate: new Date().toISOString(),
      timestamp: Date.now(),
      version: '2.0',
      products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      ventas: ventasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      logs: logsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    };

    return JSON.stringify(backup, null, 2);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'backup');
  }
}

// Safe Batch Import of Products
export async function importProductsSafely(
  productsList: ProductInput[], 
  operatorEmail: string = '', 
  operatorName: string = ''
): Promise<{ added: number }> {
  if (!productsList || productsList.length === 0) {
    return { added: 0 };
  }

  // Pre-validate all items
  for (let i = 0; i < productsList.length; i++) {
    const item = productsList[i];
    if (!item.name || !item.name.trim()) {
      throw new Error(`Fila ${i + 1}: El nombre del producto es obligatorio.`);
    }
  }

  try {
    // Process in batches of 400
    const chunkSize = 400;
    let totalAdded = 0;

    for (let i = 0; i < productsList.length; i += chunkSize) {
      const chunk = productsList.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach((p) => {
        const docRef = doc(collection(db, PRODUCTS_COLLECTION));
        batch.set(docRef, {
          name: p.name.trim(),
          nombre: p.name.trim(),
          brand: (p.brand || 'General').trim(),
          marca: (p.brand || 'General').trim(),
          category: (p.category || 'General').trim(),
          stock: Math.max(0, Number(p.stock || 0)),
          cantidad: Math.max(0, Number(p.stock || 0)),
          minStock: Math.max(0, Number(p.minStock || 5)),
          costPrice: Math.max(0, Number(p.costPrice || 0)),
          sellingPrice: Math.max(0, Number(p.sellingPrice || 0)),
          precio: Math.max(0, Number(p.sellingPrice || 0)),
          sku: p.sku || '',
          notes: p.notes || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: operatorEmail,
          isDeleted: false
        });
        totalAdded++;
      });

      await batch.commit();
    }

    await logActivity({
      productId: 'batch-import',
      productName: `${totalAdded} productos importados`,
      type: 'restock',
      quantity: totalAdded,
      prevStock: 0,
      newStock: totalAdded,
      costPrice: 0,
      sellingPrice: 0,
      reason: `Importación masiva segura de ${totalAdded} productos`,
      operatorEmail,
      operatorName
    });

    return { added: totalAdded };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
  }
}

/**
 * Ported of Kotlin's:
 *   fun generarMensajeStock(callback: (String) -> Unit)
 */
export function generarMensajeStock(products: Product[]): string {
  const available = products.filter((p) => !p.isDeleted && p.stock > 0);
  
  const grouped: Record<string, Product[]> = {};
  available.forEach((p) => {
    const b = p.brand ? p.brand.trim() : 'Sin Marca';
    if (!grouped[b]) {
      grouped[b] = [];
    }
    grouped[b].push(p);
  });

  const sortedBrands = Object.keys(grouped).sort();

  let message = '';
  sortedBrands.forEach((brand) => {
    if (message.length > 0) {
      message += '\n';
    }
    message += `--- ${brand.toUpperCase()} ---\n`;
    
    const sortedProds = grouped[brand].sort((a, b) => {
      const nameA = String(a?.name || '');
      const nameB = String(b?.name || '');
      return nameA.localeCompare(nameB);
    });
    
    sortedProds.forEach((p) => {
      const price = typeof p?.sellingPrice === 'number' ? p.sellingPrice : Number(p?.sellingPrice || 0);
      const priceFormatted = price % 1 === 0 
        ? Math.floor(price).toString() 
        : price.toString();
        
      message += `${p?.name || 'Producto sin nombre'} - $${priceFormatted}\n___\n`;
    });
  });

  return message;
}

/**
 * Ported of Kotlin's:
 *   fun generarPedidoProveedor(callback: (String) -> Unit)
 */
export async function generarPedidoProveedor(): Promise<string> {
  try {
    const querySnapshot = await getDocs(collection(db, VENTAS_COLLECTION));
    if (querySnapshot.empty) {
      return "No hay ventas registradas para generar un pedido";
    }

    const ventas: Venta[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Solo contar ventas no anuladas
      if (data.status !== 'anulada') {
        ventas.push({
          id: doc.id,
          productId: data.productId ?? '',
          productName: data.nombreProducto !== undefined ? data.nombreProducto : (data.productName ?? ''),
          brand: data.marca !== undefined ? data.marca : (data.brand ?? ''),
          sellingPrice: Number(data.precioVenta !== undefined ? data.precioVenta : (data.sellingPrice ?? 0)),
          costPrice: Number(data.costPrice !== undefined ? data.costPrice : (data.precioCosto ?? 0)),
          quantity: Number(data.cantidadVendida !== undefined ? data.cantidadVendida : (data.quantity ?? 1)),
          profit: Number(data.profit ?? 0),
          paymentMethod: data.paymentMethod ?? 'Efectivo',
          timestamp: data.timestamp ?? Date.now(),
          deviceModel: data.deviceModel ?? 'Web App'
        } as Venta);
      }
    });

    const counts: Record<string, { brand: string; name: string; price: number; quantity: number }> = {};
    
    ventas.forEach((venta) => {
      const key = `${venta.brand.toLowerCase()}|||${venta.productName.toLowerCase()}|||${venta.sellingPrice}`;
      if (!counts[key]) {
        counts[key] = {
          brand: venta.brand,
          name: venta.productName,
          price: venta.sellingPrice,
          quantity: 0
        };
      }
      counts[key].quantity += venta.quantity;
    });

    let message = "Pedido para Proveedor:\n\n";
    Object.values(counts).forEach((item) => {
      const brandStr = item.brand ? `${item.brand} ` : '';
      message += `- ${brandStr}${item.name}: ${item.quantity} unidades\n`;
    });

    return message;
  } catch (error) {
    console.error(error);
    return "Error al generar el pedido";
  }
}

// Cargar o restaurar el catálogo oficial de 129 productos desde sampleProducts
export async function seedOfficialCatalog(
  operatorEmail: string = '', 
  operatorName: string = ''
): Promise<{ created: number; updated: number }> {
  try {
    const existingSnap = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const existingMap = new Map<string, { id: string; stock: number; sku?: string }>();
    
    existingSnap.forEach((d) => {
      const data = d.data();
      const n = String(data.name || data.nombre || '').toLowerCase().trim();
      const b = String(data.brand || data.marca || '').toLowerCase().trim();
      existingMap.set(`${n}:::${b}`, {
        id: d.id,
        stock: Number(data.stock ?? data.cantidad ?? 0),
        sku: data.sku
      });
    });

    let created = 0;
    let updated = 0;

    // Procesar en lotes seguros de 40 productos
    const chunkSize = 40;
    for (let i = 0; i < sampleProducts.length; i += chunkSize) {
      const chunk = sampleProducts.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const key = `${item.name.toLowerCase().trim()}:::${item.brand.toLowerCase().trim()}`;
        const existing = existingMap.get(key);

        if (existing) {
          const docRef = doc(db, PRODUCTS_COLLECTION, existing.id);
          batch.update(docRef, {
            sellingPrice: item.sellingPrice,
            precio: item.sellingPrice,
            costPrice: item.costPrice,
            category: 'Vapes',
            updatedAt: Date.now(),
            updatedBy: operatorEmail || 'Sistema',
            isDeleted: false
          });
          updated++;
        } else {
          const docRef = doc(collection(db, PRODUCTS_COLLECTION));
          const sku = item.brand.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5) + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
          batch.set(docRef, {
            name: item.name,
            nombre: item.name,
            brand: item.brand,
            marca: item.brand,
            category: 'Vapes',
            stock: item.stock,
            cantidad: item.stock,
            minStock: 5,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            precio: item.sellingPrice,
            sku,
            notes: 'Catálogo oficial de vapes cargado',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updatedBy: operatorEmail || 'Sistema',
            isDeleted: false
          });
          created++;
        }
      }

      await batch.commit();
    }

    await logActivity({
      productId: 'catalog-seed',
      productName: 'Catálogo Oficial (129 Productos)',
      type: 'restock',
      quantity: sampleProducts.length,
      prevStock: 0,
      newStock: sampleProducts.reduce((acc, curr) => acc + curr.stock, 0),
      costPrice: 0,
      sellingPrice: 0,
      reason: `Carga del catálogo oficial (${created} nuevos, ${updated} actualizados)`,
      operatorEmail,
      operatorName
    });

    return { created, updated };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PRODUCTS_COLLECTION);
  }
}

export interface BulkBrandPriceUpdateItem {
  id: string;
  name: string;
  brand: string;
  oldSellingPrice: number;
  newSellingPrice: number;
  oldCostPrice: number;
  newCostPrice: number;
}

// Actualización masiva de precios por marca
export async function updatePricesByBrand(
  items: BulkBrandPriceUpdateItem[],
  brandName: string,
  summaryReason: string,
  operatorEmail: string = '',
  operatorName: string = ''
): Promise<{ updatedCount: number }> {
  try {
    if (!items || items.length === 0) {
      return { updatedCount: 0 };
    }

    // Limit chunk to 200 items because each item writes to 'productos' and 'catalogo_publico' (400 ops <= 500 max)
    const CHUNK_SIZE = 200;
    let updatedCount = 0;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        // 1. Actualizar en colección principal de inventario 'productos'
        const docRef = doc(db, PRODUCTS_COLLECTION, item.id);
        batch.update(docRef, {
          sellingPrice: item.newSellingPrice,
          precio: item.newSellingPrice,
          costPrice: item.newCostPrice,
          precioCosto: item.newCostPrice,
          updatedAt: Date.now(),
          updatedBy: operatorEmail || 'Administrador'
        });

        // 2. Sincronizar inmediatamente en la colección de 'catalogo_publico'
        const publicDocRef = doc(db, PUBLIC_CATALOG_COLLECTION, item.id);
        batch.set(publicDocRef, {
          precio: item.newSellingPrice,
          updatedAt: Date.now()
        }, { merge: true });

        updatedCount++;
      }

      await batch.commit();
    }

    // Registrar en bitácora de auditoría
    await logActivity({
      productId: 'batch-price-update',
      productName: `Marca: ${brandName}`,
      type: 'adjustment',
      quantity: updatedCount,
      prevStock: 0,
      newStock: 0,
      costPrice: 0,
      sellingPrice: 0,
      reason: summaryReason || `Actualización masiva de precios para "${brandName}" (${updatedCount} artículos)`,
      operatorEmail,
      operatorName
    });

    return { updatedCount };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PRODUCTS_COLLECTION);
  }
}


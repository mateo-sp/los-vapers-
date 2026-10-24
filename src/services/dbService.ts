import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Product, ActivityLog, ProductInput, Venta } from '../types';

// Use same collection names as the Kotlin Android app
const PRODUCTS_COLLECTION = 'productos';
const VENTAS_COLLECTION = 'ventas';
const LOGS_COLLECTION = 'activityLogs';
const CATEGORY_SETTINGS_COLLECTION = 'categoryThresholds';

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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Subscribe to real-time products (NO SEEDING, Starts 100% clean and empty!)
export function subscribeToProducts(callback: (products: Product[]) => void) {
  const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    try {
      const products: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Map Spanish properties from Kotlin and English properties from Web
        products.push({
          id: doc.id,
          name: data.nombre !== undefined ? data.nombre : (data.name ?? ''),
          brand: data.marca !== undefined ? data.marca : (data.brand ?? ''),
          category: data.category ?? data.categoria ?? 'General',
          stock: Number(data.cantidad !== undefined ? data.cantidad : (data.stock ?? 0)),
          minStock: Number(data.minStock !== undefined ? data.minStock : (data.stockMinimo ?? 5)),
          useCategoryThreshold: !!data.useCategoryThreshold,
          costPrice: Number(data.costPrice ?? data.precioCosto ?? 0),
          sellingPrice: Number(data.precio !== undefined ? data.precio : (data.sellingPrice ?? 0)),
          sku: data.sku ?? '',
          notes: data.notes ?? data.notas ?? '',
          createdAt: data.createdAt ?? Date.now(),
          updatedAt: data.updatedAt ?? Date.now()
        } as Product);
      });
      callback(products);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, PRODUCTS_COLLECTION);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, PRODUCTS_COLLECTION);
  });
}

// Add a new product (Writes BOTH English and Spanish fields for absolute safety & sync)
export async function addProduct(productInput: ProductInput): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      name: productInput.name,
      nombre: productInput.name, // Kotlin compat
      brand: productInput.brand,
      marca: productInput.brand, // Kotlin compat
      category: productInput.category,
      stock: productInput.stock,
      cantidad: productInput.stock, // Kotlin compat
      minStock: productInput.minStock,
      costPrice: productInput.costPrice,
      sellingPrice: productInput.sellingPrice,
      precio: productInput.sellingPrice, // Kotlin compat
      sku: productInput.sku,
      notes: productInput.notes || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    });

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
  }
}

// Update an existing product (Updates BOTH English and Spanish fields)
export async function updateProduct(id: string, updates: Partial<ProductInput> & { previousState?: Product }): Promise<void> {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    const dataToUpdate: Record<string, any> = {
      ...updates,
      updatedAt: Date.now()
    };
    
    if (updates.name !== undefined) dataToUpdate.nombre = updates.name;
    if (updates.brand !== undefined) dataToUpdate.marca = updates.brand;
    if (updates.stock !== undefined) dataToUpdate.cantidad = updates.stock;
    if (updates.sellingPrice !== undefined) dataToUpdate.precio = updates.sellingPrice;

    delete dataToUpdate.previousState; // Clean helper key
    
    await updateDoc(docRef, dataToUpdate);

    // If stock changed, log the change
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
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

// Delete a product
export async function deleteProduct(id: string, name: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, id));
    
    // Log the deletion
    await logActivity({
      productId: id,
      productName: name,
      type: 'adjustment',
      quantity: 0,
      prevStock: 0,
      newStock: 0,
      costPrice: 0,
      sellingPrice: 0,
      customMessage: `Producto eliminado del catálogo.`
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

// Perform inline quick stock adjustments (Updates BOTH fields)
export async function adjustStock(product: Product, amount: number, type: 'sale' | 'restock'): Promise<void> {
  if (amount === 0) return;
  
  try {
    const newStock = Math.max(0, product.stock + amount);
    const docRef = doc(db, PRODUCTS_COLLECTION, product.id);
    
    await updateDoc(docRef, {
      stock: newStock,
      cantidad: newStock, // Kotlin compat
      updatedAt: Date.now()
    });

    await logActivity({
      productId: product.id,
      productName: product.name,
      type: type,
      quantity: Math.abs(amount),
      prevStock: product.stock,
      newStock: newStock,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${product.id}`);
  }
}

// Utility to log activities
interface ActivityLogInput {
  productId: string;
  productName: string;
  type: 'sale' | 'restock' | 'adjustment';
  quantity: number;
  prevStock: number;
  newStock: number;
  costPrice: number;
  sellingPrice: number;
  customMessage?: string;
}

async function logActivity(log: ActivityLogInput): Promise<void> {
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
export function subscribeToActivityLogs(callback: (logs: ActivityLog[]) => void, maxCount: number = 30) {
  const q = query(
    collection(db, LOGS_COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(maxCount)
  );

  return onSnapshot(q, (snapshot) => {
    try {
      const logs: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data()
        } as ActivityLog);
      });
      callback(logs);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, LOGS_COLLECTION);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, LOGS_COLLECTION);
  });
}

// Clear all logs helper
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

// Subscribe to category thresholds in real-time
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

// Update or set category threshold
export async function updateCategoryThreshold(category: string, minStock: number): Promise<void> {
  try {
    const docRef = doc(db, CATEGORY_SETTINGS_COLLECTION, category);
    await setDoc(docRef, { minStock, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CATEGORY_SETTINGS_COLLECTION}/${category}`);
  }
}

// Subscribe to real-time sales (ventas)
export function subscribeToVentas(callback: (ventas: Venta[]) => void) {
  const q = query(collection(db, VENTAS_COLLECTION), orderBy('timestamp', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    try {
      const ventas: Venta[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Map both Kotlin Spanish properties and English web properties
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
          timestamp: data.timestamp ?? Date.now(),
          deviceModel: data.deviceModel ?? 'Web App',
          debtorName: data.debtorName ?? data.clienteDeudor ?? '',
          isPaid: data.isPaid !== undefined ? data.isPaid : (data.pagado ?? true),
          debtAmount: data.debtAmount !== undefined ? Number(data.debtAmount) : (data.montoDeuda !== undefined ? Number(data.montoDeuda) : undefined)
        } as Venta);
      });
      callback(ventas);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, VENTAS_COLLECTION);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, VENTAS_COLLECTION);
  });
}

// Add a transaction to ventas (Writes BOTH English and Spanish fields for full compatibility)
export async function addVenta(ventaInput: Omit<Venta, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, VENTAS_COLLECTION), {
      ...ventaInput,
      // Kotlin Android model compatibility fields
      marca: ventaInput.brand,
      nombreProducto: ventaInput.productName,
      precioVenta: ventaInput.sellingPrice,
      cantidadVendida: ventaInput.quantity,
      precioCosto: ventaInput.costPrice,
      clienteDeudor: ventaInput.debtorName || '',
      pagado: ventaInput.isPaid !== undefined ? ventaInput.isPaid : true,
      montoDeuda: ventaInput.debtAmount !== undefined ? ventaInput.debtAmount : (ventaInput.isPaid ? 0 : (ventaInput.sellingPrice * ventaInput.quantity))
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, VENTAS_COLLECTION);
  }
}

// Update a venta record (useful for marking debtor records as paid)
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

// Delete individual sale
export async function deleteVenta(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, VENTAS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${VENTAS_COLLECTION}/${id}`);
  }
}

// Clear all sales history
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

// Clear all products in the database (Fulfills clearing user products)
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


/**
 * =========================================================================
 * PORTED KOTLIN VIEWMODEL REPLICA FUNCTIONS
 * =========================================================================
 */

/**
 * Ported of Kotlin's:
 *   fun generarMensajeStock(callback: (String) -> Unit)
 * Generates stock message grouped by brand (all brand keys sorted), inside each
 * brand sorted alphabetical by name. Price format: if x % 1 == 0, print as integer, else decimal.
 */
export function generarMensajeStock(products: Product[]): string {
  // val productosPorMarca = productosValue.filter { it.cantidad > 0 }.groupBy { it.marca }.toSortedMap()
  const available = products.filter((p) => p.stock > 0);
  
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
    
    // productosDeMarca.sortedBy { it.nombre }
    const sortedProds = grouped[brand].sort((a, b) => {
      const nameA = String(a?.name || '');
      const nameB = String(b?.name || '');
      return nameA.localeCompare(nameB);
    });
    
    sortedProds.forEach((p) => {
      // val precioFormateado = if (producto.precio % 1 == 0.0) producto.precio.toInt().toString() else producto.precio.toString()
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
 * Loads raw database collection 'ventas' in real time / dynamically. Groups sales by
 * Triple(brand, productName, priceVenta) and sums up units sold.
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
    });

    // Grouping by Triple equivalent (marca, nombreProducto, precioVenta)
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

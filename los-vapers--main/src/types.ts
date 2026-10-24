export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  stock: number;
  minStock: number;
  useCategoryThreshold?: boolean;
  costPrice: number;
  sellingPrice: number;
  sku: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
  updatedBy?: string;
}

export interface ActivityLog {
  id: string;
  productId: string;
  productName: string;
  type: 'sale' | 'restock' | 'adjustment' | 'void_sale' | 'trash' | 'restore';
  quantity: number;
  prevStock: number;
  newStock: number;
  costPrice: number;
  sellingPrice: number;
  timestamp: number;
  reason?: string;
  operatorEmail?: string;
  operatorName?: string;
}

export interface Venta {
  id: string;
  productId: string;
  productName: string;
  brand: string;
  sellingPrice: number;
  costPrice: number;
  quantity: number;
  profit: number;
  paymentMethod: 'Efectivo' | 'Transferencia' | 'Crédito';
  timestamp: number;
  deviceModel: string;
  debtorName?: string;
  isPaid?: boolean;
  debtAmount?: number;
  status?: 'completada' | 'anulada';
  operatorEmail?: string;
  operatorName?: string;
  voidReason?: string;
  voidTimestamp?: number;
  voidBy?: string;
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt' | 'deletedBy'>;


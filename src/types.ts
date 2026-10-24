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
}

export interface ActivityLog {
  id: string;
  productId: string;
  productName: string;
  type: 'sale' | 'restock' | 'adjustment';
  quantity: number;
  prevStock: number;
  newStock: number;
  costPrice: number;
  sellingPrice: number;
  timestamp: number;
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
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

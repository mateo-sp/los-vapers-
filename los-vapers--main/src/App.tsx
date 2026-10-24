/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  Package,
  TrendingUp,
  DollarSign,
  History,
  FileSpreadsheet,
  MessageSquare,
  Trash2,
  Download,
  LogOut,
  ShieldCheck,
  UserCheck,
  Layers
} from 'lucide-react';

import {
  subscribeToProducts,
  addProduct,
  updateProduct,
  moveToTrashProduct,
  restoreProductFromTrash,
  permanentDeleteProduct,
  emptyTrash,
  adjustStockWithReason,
  executeSaleTransaction,
  voidSaleTransaction,
  subscribeToActivityLogs,
  clearAllActivityLogs,
  subscribeToVentas,
  clearAllVentas,
  updateVenta,
  exportAllDataAsJson,
  seedOfficialCatalog
} from './services/dbService';
import { Product, ProductInput, ActivityLog, Venta } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import StatsCard from './components/StatsCard';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import ActivityLogsPanel from './components/ActivityLogsPanel';
import WhatsAppModal from './components/WhatsAppModal';
import ConfirmSaleModal from './components/ConfirmSaleModal';
import SalesReportPanel from './components/SalesReportPanel';
import FloatingToolsMenu from './components/FloatingToolsMenu';
import ErrorBoundary from './components/ErrorBoundary';
import ImportExcelModal from './components/ImportExcelModal';
import ConfirmModal from './components/ConfirmModal';
import AdminLoginView from './components/AdminLoginView';
import VoidSaleModal from './components/VoidSaleModal';
import StockAdjustmentModal from './components/StockAdjustmentModal';
import TrashModal from './components/TrashModal';

function MainApp() {
  const { user, isAuthorizedAdmin, operatorEmail, operatorName, logout, loading: authLoading } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'reports'>('inventory');

  // Real-time Firestore state
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'price_asc'>('name_asc');

  // UI Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Action Modals State
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  const [voidingVenta, setVoidingVenta] = useState<Venta | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);

  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Trash product confirmation
  const [productToTrash, setProductToTrash] = useState<Product | null>(null);
  const [isConfirmTrashOpen, setIsConfirmTrashOpen] = useState(false);

  // Catalog initialization loading state & feedback
  const [isSeeding, setIsSeeding] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const hasAutoSeededRef = useRef(false);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const handleSeedCatalog = async () => {
    if (isSeeding) return;
    try {
      setIsSeeding(true);
      const res = await seedOfficialCatalog(operatorEmail, operatorName);
      showToast('success', `¡Catálogo oficial cargado con éxito! Se cargaron/actualizaron ${res.created + res.updated} productos.`);
    } catch (err: any) {
      console.error('Error al inicializar catálogo:', err);
      showToast('error', 'Error al cargar el catálogo oficial: ' + (err?.message || 'Verifica los permisos de conexión.'));
    } finally {
      setIsSeeding(false);
    }
  };

  // Load products, logs, and sales in real-time ONLY once authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthorizedAdmin) {
      setProducts([]);
      setLogs([]);
      setVentas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const unsubscribeProducts = subscribeToProducts(
      (loadedProducts) => {
        setProducts(loadedProducts);
        setLoading(false);
      },
      (error) => showToast(
        'error',
        `No se pudo actualizar el catálogo público: ${error.message}`
      )
    );

    const unsubscribeLogs = subscribeToActivityLogs((loadedLogs) => {
      setLogs(loadedLogs);
    }, 50);

    const unsubscribeVentas = subscribeToVentas((loadedVentas) => {
      setVentas(loadedVentas);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeLogs();
      unsubscribeVentas();
    };
  }, [authLoading, isAuthorizedAdmin]);

  // If catalog is empty upon admin login, automatically seed official products once
  useEffect(() => {
    if (!loading && isAuthorizedAdmin && products.length === 0 && !hasAutoSeededRef.current && !isSeeding) {
      hasAutoSeededRef.current = true;
      handleSeedCatalog();
    }
  }, [loading, isAuthorizedAdmin, products.length, isSeeding]);

  // Split active and trash products
  const activeProducts = useMemo(() => {
    return products.filter((p) => !p.isDeleted);
  }, [products]);

  const deletedProducts = useMemo(() => {
    return products.filter((p) => p.isDeleted);
  }, [products]);

  // Compute stats metrics dynamically (active products only)
  const stats = useMemo(() => {
    const totalProducts = activeProducts.length;
    const totalUnits = activeProducts.reduce((sum, p) => sum + Math.max(0, p.stock), 0);
    const totalCostValue = activeProducts.reduce((sum, p) => sum + (Math.max(0, p.stock) * p.costPrice), 0);
    const totalSellingValue = activeProducts.reduce((sum, p) => sum + (Math.max(0, p.stock) * p.sellingPrice), 0);
    const estimatedProfit = totalSellingValue - totalCostValue;

    return {
      totalProducts,
      totalUnits,
      totalCostValue,
      totalSellingValue,
      estimatedProfit,
    };
  }, [activeProducts]);

  // Unique categories and brands
  const categories = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [activeProducts]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set).sort();
  }, [activeProducts]);

  // Filter & Sort Logic for Admin Inventory
  const filteredProducts = useMemo(() => {
    let result = [...activeProducts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (selectedBrand) {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    if (stockFilter === 'in_stock') {
      result = result.filter((p) => p.stock > 0);
    } else if (stockFilter === 'out_of_stock') {
      result = result.filter((p) => p.stock === 0);
    }

    result.sort((a, b) => {
      const nameA = String(a?.name || '');
      const nameB = String(b?.name || '');
      switch (sortBy) {
        case 'name_desc':
          return nameB.localeCompare(nameA);
        case 'stock_asc':
          return (a.stock || 0) - (b.stock || 0);
        case 'stock_desc':
          return (b.stock || 0) - (a.stock || 0);
        case 'price_asc':
          return (a.sellingPrice || 0) - (b.sellingPrice || 0);
        case 'price_desc':
          return (b.sellingPrice || 0) - (a.sellingPrice || 0);
        case 'name_asc':
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return result;
  }, [activeProducts, searchQuery, selectedCategory, selectedBrand, stockFilter, sortBy]);

  // Product CRUD handlers
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (productInput: ProductInput) => {
    if (editingProduct) {
      await updateProduct(
        editingProduct.id, 
        { ...productInput, previousState: editingProduct },
        operatorEmail,
        operatorName
      );
    } else {
      await addProduct(productInput, operatorEmail, operatorName);
    }
  };

  // Soft Delete / Move to Trash Handlers
  const handleRequestTrashProduct = (product: Product) => {
    setProductToTrash(product);
    setIsConfirmTrashOpen(true);
  };

  const handleExecuteMoveToTrash = async () => {
    if (productToTrash) {
      await moveToTrashProduct(productToTrash.id, productToTrash.name, operatorEmail, operatorName);
      setProductToTrash(null);
    }
  };

  const handleRestoreProduct = async (product: Product) => {
    await restoreProductFromTrash(product.id, product.name, operatorEmail, operatorName);
  };

  const handlePermanentDelete = async (product: Product) => {
    await permanentDeleteProduct(product.id, product.name, operatorEmail, operatorName);
  };

  const handleEmptyTrashAll = async () => {
    await emptyTrash(operatorEmail, operatorName);
  };

  // Stock Adjustment & Restock Handlers
  const handleTriggerQuickSale = (product: Product) => {
    setSaleProduct(product);
    setSaleQuantity(1);
    setIsSaleModalOpen(true);
  };

  const handleTriggerQuickRestock = (product: Product) => {
    setAdjustingProduct(product);
    setIsAdjustModalOpen(true);
  };

  const handleExecuteStockAdjustment = async (
    amount: number, 
    type: 'restock' | 'adjustment', 
    reason: string
  ) => {
    if (!adjustingProduct) return;
    await adjustStockWithReason(
      adjustingProduct,
      amount,
      type,
      reason,
      operatorEmail,
      operatorName
    );
  };

  // Atomic Sale Execution Handler
  const handleConfirmSale = async (
    paymentMethod: 'Efectivo' | 'Transferencia' | 'Crédito', 
    deviceModel: string, 
    debtorName?: string,
    debtAmount?: number,
    confirmedQuantity?: number
  ) => {
    if (!saleProduct) return;
    
    const qty = confirmedQuantity || saleQuantity;
    const profitPerUnit = saleProduct.sellingPrice - saleProduct.costPrice;
    const totalProfit = profitPerUnit * qty;

    await executeSaleTransaction({
      productId: saleProduct.id,
      productName: saleProduct.name,
      brand: saleProduct.brand,
      sellingPrice: saleProduct.sellingPrice,
      costPrice: saleProduct.costPrice,
      quantity: qty,
      profit: totalProfit,
      paymentMethod,
      deviceModel,
      debtorName,
      isPaid: paymentMethod !== 'Crédito',
      debtAmount,
      operatorEmail,
      operatorName
    });

    setSaleProduct(null);
  };

  // Void Sale Handler (Replaces Delete Sale)
  const handleOpenVoidModal = (venta: Venta) => {
    setVoidingVenta(venta);
    setIsVoidModalOpen(true);
  };

  const handleExecuteVoidSale = async (reason: string) => {
    if (!voidingVenta) return;
    await voidSaleTransaction(voidingVenta.id, reason, operatorEmail, operatorName);
    setVoidingVenta(null);
  };

  // Full Backup JSON download
  const handleDownloadBackup = async () => {
    try {
      const jsonStr = await exportAllDataAsJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_inventario_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showToast('error', 'Error al generar el respaldo de datos.');
    }
  };

  // Guard: If user is not authorized, render the Admin Login View
  if (!isAuthorizedAdmin) {
    return (
      <ErrorBoundary>
        <AdminLoginView />
      </ErrorBoundary>
    );
  }

  // RENDER: Full Dark Admin Panel
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 pb-20 relative">
        {/* Subtle background glow */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))] pointer-events-none" />

        {/* Top Header bar */}
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Brand Zone */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm sm:text-base tracking-tight">
                    Panel de Gestión
                  </span>
                  <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                    Admin Seguro
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Operador: <strong className="text-white font-medium">{operatorName}</strong></span>
                </div>
              </div>
            </div>

            {/* Actions Zone */}
            <div className="flex items-center gap-2">
              {activeProducts.length < 129 && (
                <button
                  type="button"
                  onClick={handleSeedCatalog}
                  disabled={isSeeding}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  title="Cargar o restaurar los 129 productos del catálogo oficial"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden md:inline">Cargar Catálogo ({activeProducts.length}/129)</span>
                  <span className="md:hidden">129 Vapes</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsTrashModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-medium transition-colors relative cursor-pointer"
                title="Abrir papelera de reciclaje"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Papelera</span>
                {deletedProducts.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-bold">
                    {deletedProducts.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                title="Descargar copia de seguridad completa en JSON"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Respaldo JSON</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/40 text-rose-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Workspace Toolbar & Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          {/* Segmented Tab Controls */}
          <div className="flex p-1 bg-slate-900/80 border border-white/10 rounded-2xl text-xs font-medium w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📦 Inventario ({activeProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 Ventas, Cobros & Reportes ({ventas.length})
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Lista WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Importar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 space-y-6">
          {activeTab === 'inventory' ? (
            <>
              {/* Stats Overview Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatsCard
                  title="Artículos Activos"
                  value={stats.totalProducts}
                  icon={<Package className="w-5 h-5 text-indigo-400" />}
                  colorClass="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                />
                <StatsCard
                  title="Unidades en Stock"
                  value={stats.totalUnits}
                  icon={<Package className="w-5 h-5 text-emerald-400" />}
                  colorClass="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                />
                <StatsCard
                  title="Valor en Costo"
                  value={`$${stats.totalCostValue.toLocaleString('es-CL')}`}
                  icon={<DollarSign className="w-5 h-5 text-slate-300" />}
                  colorClass="bg-slate-800 text-slate-300 border border-white/10"
                />
                <StatsCard
                  title="Valor Venta Total"
                  value={`$${stats.totalSellingValue.toLocaleString('es-CL')}`}
                  icon={<DollarSign className="w-5 h-5 text-amber-400" />}
                  colorClass="bg-amber-500/20 text-amber-400 border border-amber-500/30"
                />
                <StatsCard
                  title="Ganancia Estimada"
                  value={`$${stats.estimatedProfit.toLocaleString('es-CL')}`}
                  icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                  colorClass="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                />
              </div>

              {/* Search, Filter & Sort Controls */}
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, SKU, marca o categoría..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Brand Filter */}
                  {brands.length > 0 && (
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      aria-label="Filtrar por marca"
                      className="py-2 px-3 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">Todas las marcas</option>
                      {brands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Category Filter */}
                  {categories.length > 0 && (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      aria-label="Filtrar por categoría"
                      className="py-2 px-3 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Stock Level Filter */}
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as any)}
                    aria-label="Filtrar por stock"
                    className="py-2 px-3 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="all">Todo el stock</option>
                    <option value="in_stock">Solo disponibles</option>
                    <option value="out_of_stock">Solo agotados</option>
                  </select>

                  {/* Sorting */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    aria-label="Ordenar productos"
                    className="py-2 px-3 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="name_asc">Nombre: A - Z</option>
                    <option value="name_desc">Nombre: Z - A</option>
                    <option value="stock_desc">Mayor Stock</option>
                    <option value="stock_asc">Menor Stock</option>
                    <option value="price_desc">Mayor Precio</option>
                    <option value="price_asc">Menor Precio</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>
                    Mostrando <strong className="text-white">{filteredProducts.length}</strong> de {activeProducts.length} productos activos
                  </span>
                  {(searchQuery || selectedBrand || selectedCategory || stockFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedBrand('');
                        setSelectedCategory('');
                        setStockFilter('all');
                      }}
                      className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Products Grid & Sidebar Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Grid (3 columns) */}
                <div className="lg:col-span-3">
                  {filteredProducts.length === 0 ? (
                    activeProducts.length === 0 ? (
                      <div className="py-14 px-6 text-center bg-white/5 rounded-2xl border border-white/10 shadow-xl max-w-xl mx-auto my-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/10">
                          <Package className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-bold text-white tracking-tight">Catálogo Oficial Listo para Cargar</h4>
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                          Tu inventario oficial tiene los <strong className="text-white">129 productos de vapes</strong> preparados (IGNITE, ELFBAR, LOST MARY, BC, etc.) con sus precios de venta y existencias.
                        </p>
                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={handleSeedCatalog}
                            disabled={isSeeding}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isSeeding ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Cargando 129 productos...</span>
                              </>
                            ) : (
                              <>
                                <Layers className="w-4 h-4" />
                                <span>Cargar los 129 Productos Oficiales</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenAddModal}
                            className="w-full sm:w-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Crear Producto Manual
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-16 text-center bg-white/5 rounded-2xl border border-white/10 shadow-lg">
                        <Package className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                        <h4 className="text-sm font-semibold text-white">No se encontraron productos coincidentes</h4>
                        <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros de búsqueda o categoría.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedBrand('');
                            setSelectedCategory('');
                            setStockFilter('all');
                          }}
                          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Limpiar Filtros
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onEdit={handleOpenEditModal}
                          onDelete={handleRequestTrashProduct}
                          onQuickSale={handleTriggerQuickSale}
                          onQuickRestock={handleTriggerQuickRestock}
                          onCustomAdjust={(p) => {
                            setAdjustingProduct(p);
                            setIsAdjustModalOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Sidebar Activity Logs (1 column on desktop) */}
                <div className="lg:col-span-1 space-y-4">
                  <ActivityLogsPanel
                    logs={logs}
                    onClearLogs={clearAllActivityLogs}
                  />
                </div>
              </div>
            </>
          ) : (
            /* Reports & Sales Tab */
            <SalesReportPanel
              ventas={ventas}
              products={products}
              onVoidVenta={handleOpenVoidModal}
              onClearAllVentas={clearAllVentas}
              onUpdateVenta={updateVenta}
              currentOperatorName={operatorName}
            />
          )}
        </main>

        {/* Floating Tools Menu */}
        <FloatingToolsMenu
          products={activeProducts}
          ventas={ventas}
        />

        {/* MODALS */}

        {/* Product Add/Edit Modal */}
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveProduct}
          product={editingProduct}
          brands={brands}
        />

        {/* WhatsApp Export Modal */}
        <WhatsAppModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          products={activeProducts}
        />

        {/* Confirm Sale Modal (Atomic) */}
        <ConfirmSaleModal
          isOpen={isSaleModalOpen}
          onClose={() => {
            setIsSaleModalOpen(false);
            setSaleProduct(null);
          }}
          product={saleProduct}
          quantity={saleQuantity}
          operatorName={operatorName}
          onConfirm={handleConfirmSale}
        />

        {/* Void Sale Modal (Atomic Void & Restock) */}
        <VoidSaleModal
          isOpen={isVoidModalOpen}
          onClose={() => {
            setIsVoidModalOpen(false);
            setVoidingVenta(null);
          }}
          venta={voidingVenta}
          onConfirm={handleExecuteVoidSale}
          operatorName={operatorName}
        />

        {/* Stock Adjustment & Merchandise Entry Modal */}
        <StockAdjustmentModal
          isOpen={isAdjustModalOpen}
          onClose={() => {
            setIsAdjustModalOpen(false);
            setAdjustingProduct(null);
          }}
          product={adjustingProduct}
          operatorName={operatorName}
          onConfirm={handleExecuteStockAdjustment}
        />

        {/* Trash Recycle Bin Modal */}
        <TrashModal
          isOpen={isTrashModalOpen}
          onClose={() => setIsTrashModalOpen(false)}
          deletedProducts={deletedProducts}
          onRestore={handleRestoreProduct}
          onPermanentDelete={handlePermanentDelete}
          onEmptyTrash={handleEmptyTrashAll}
        />

        {/* Import Excel Modal */}
        <ImportExcelModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          existingProducts={activeProducts}
        />

        {/* Move to Trash Confirm Modal */}
        <ConfirmModal
          isOpen={isConfirmTrashOpen}
          onClose={() => {
            setIsConfirmTrashOpen(false);
            setProductToTrash(null);
          }}
          onConfirm={handleExecuteMoveToTrash}
          title="¿Mover producto a la papelera?"
          message={
            productToTrash
              ? `El producto "${productToTrash.name}" será enviado a la papelera de reciclaje. Podrás restaurarlo en cualquier momento o vaciarlo definitivamente desde la papelera.`
              : ''
          }
          confirmText="Mover a Papelera"
          cancelText="Cancelar"
          type="warning"
        />

        {/* Global In-App Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md animate-fade-in">
            <div className={`p-4 rounded-xl border shadow-xl flex items-center justify-between gap-3 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/40 text-rose-200 shadow-rose-950/50'
                : 'bg-indigo-950/95 border-indigo-500/40 text-indigo-200 shadow-indigo-950/50'
            }`}>
              <span className="text-xs sm:text-sm font-medium">{toastMessage.text}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

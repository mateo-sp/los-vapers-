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
  AlertTriangle,
  Download,
  SlidersHorizontal,
  DollarSign,
  Briefcase,
  History,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  Bell,
  Sliders,
  MessageSquare,
} from 'lucide-react';

import {
  subscribeToProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  subscribeToActivityLogs,
  clearAllActivityLogs,
  subscribeToCategoryThresholds,
  subscribeToVentas,
  addVenta,
  deleteVenta,
  clearAllVentas,
  updateVenta
} from './services/dbService';
import { Product, ProductInput, ActivityLog, Venta } from './types';
import StatsCard from './components/StatsCard';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import ActivityLogsPanel from './components/ActivityLogsPanel';
import CategorySettingsModal from './components/CategorySettingsModal';
import WhatsAppModal from './components/WhatsAppModal';
import ConfirmSaleModal from './components/ConfirmSaleModal';
import SalesReportPanel from './components/SalesReportPanel';
import FloatingToolsMenu from './components/FloatingToolsMenu';
import ErrorBoundary from './components/ErrorBoundary';
import ImportExcelModal from './components/ImportExcelModal';
import ConfirmModal from './components/ConfirmModal';

export default function App() {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'inventory' | 'reports'>('inventory');

  // Real-time Firestore state
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [categoryThresholds, setCategoryThresholds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Search, Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out_of_stock' | 'healthy'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'price_asc'>('name_asc');

  // UI Panels / Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showLogsMobile, setShowLogsMobile] = useState(false);

  // Confirm Sale modal states
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleModalOpen, setSaleModalOpen] = useState(false);

  // Deletion confirmation state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Live Real-Time Toast Alerts
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; productName: string; stock: number; threshold: number }>>([]);
  const prevProductsRef = useRef<Record<string, number>>({});

  const addToast = (productName: string, stock: number, threshold: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [
      ...prev,
      { id, productName, stock, threshold, message: `⚠️ Bajo Stock: ¡"${productName}" cayó por debajo del límite (${stock}/${threshold} u)!` }
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load products, logs, sales, and category thresholds in real-time
  useEffect(() => {
    setLoading(true);
    
    // Subscribe to products (seeds demo products automatically if Firestore is empty)
    const unsubscribeProducts = subscribeToProducts((loadedProducts) => {
      setProducts(loadedProducts);
      setLoading(false);
    });

    // Subscribe to logs
    const unsubscribeLogs = subscribeToActivityLogs((loadedLogs) => {
      setLogs(loadedLogs);
    }, 45); // Load up to 45 logs

    // Subscribe to sales (ventas)
    const unsubscribeVentas = subscribeToVentas((loadedVentas) => {
      setVentas(loadedVentas);
    });

    // Subscribe to category thresholds alerts
    const unsubscribeCategoryThresholds = subscribeToCategoryThresholds((loadedRules) => {
      setCategoryThresholds(loadedRules);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeLogs();
      unsubscribeVentas();
      unsubscribeCategoryThresholds();
    };
  }, []);

  // Track stock level transitions to trigger notifications on action triggers
  useEffect(() => {
    if (products.length === 0 || loading) return;

    const hasPreviousData = Object.keys(prevProductsRef.current).length > 0;
    const currentStocks: Record<string, number> = {};

    products.forEach((p) => {
      const threshold = p.useCategoryThreshold ? (categoryThresholds[p.category] ?? 5) : p.minStock;
      const prevStock = prevProductsRef.current[p.id];
      const wasAbove = prevStock === undefined || prevStock > threshold;
      const isBelow = p.stock <= threshold;

      if (hasPreviousData && prevStock !== undefined && p.stock < prevStock && wasAbove && isBelow) {
        addToast(p.name, p.stock, threshold);
      }
      currentStocks[p.id] = p.stock;
    });

    prevProductsRef.current = currentStocks;
  }, [products, categoryThresholds, loading]);

  // Compute stats metrics dynamically
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalUnits = products.reduce((sum, p) => sum + Math.max(0, p.stock), 0);
    const totalCostValue = products.reduce((sum, p) => sum + (Math.max(0, p.stock) * p.costPrice), 0);
    const totalSellingValue = products.reduce((sum, p) => sum + (Math.max(0, p.stock) * p.sellingPrice), 0);
    const estimatedProfit = totalSellingValue - totalCostValue;
    
    const lowStockCount = products.filter((p) => {
      const threshold = p.useCategoryThreshold ? (categoryThresholds[p.category] ?? 5) : p.minStock;
      return p.stock <= threshold;
    }).length;

    return {
      totalProducts,
      totalUnits,
      totalCostValue,
      totalSellingValue,
      estimatedProfit,
      lowStockCount,
    };
  }, [products, categoryThresholds]);

  // Extract unique categories and brands for filter menus
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      const threshold = p.useCategoryThreshold ? (categoryThresholds[p.category] ?? 5) : p.minStock;
      return p.stock <= threshold;
    });
  }, [products, categoryThresholds]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query constraint
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

    // Category filter
    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Brand filter
    if (selectedBrand) {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    // Stock levels filter
    if (stockFilter === 'low') {
      result = result.filter((p) => {
        const threshold = p.useCategoryThreshold ? (categoryThresholds[p.category] ?? 5) : p.minStock;
        return p.stock > 0 && p.stock <= threshold;
      });
    } else if (stockFilter === 'out_of_stock') {
      result = result.filter((p) => p.stock === 0);
    } else if (stockFilter === 'healthy') {
      result = result.filter((p) => {
        const threshold = p.useCategoryThreshold ? (categoryThresholds[p.category] ?? 5) : p.minStock;
        return p.stock > threshold;
      });
    }

    // Sort order
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
  }, [products, searchQuery, selectedCategory, selectedBrand, stockFilter, sortBy]);

  // Smart suggestions / alerts based on current state
  const smartAlerts = useMemo(() => {
    const alerts: string[] = [];
    const critical = products.filter((p) => p.stock === 0);
    if (critical.length > 0) {
      alerts.push(
        `Atención: Tienes ${critical.length} productos sin existencias en almacén. Se sugiere reabastecer de inmediato.`
      );
    }
    const highMargin = products.filter((p) => {
      const profit = p.sellingPrice - p.costPrice;
      const margin = p.sellingPrice > 0 ? (profit / p.sellingPrice) * 100 : 0;
      return margin >= 50 && p.stock > 0;
    });
    if (highMargin.length > 0) {
      alerts.push(
        `Oportunidad: El producto "${highMargin[0].name}" tiene un margen superior al 50%. Promociona este artículo para maximizar ingresos.`
      );
    }
    return alerts;
  }, [products]);

  // Modal Handlers
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
      // Editing
      await updateProduct(editingProduct.id, {
        ...productInput,
        previousState: editingProduct // Passes current state to calculate the adjustment logs correctly
      });
    } else {
      // Create new
      await addProduct(productInput);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setIsConfirmDeleteOpen(true);
  };

  const handleExecuteDeleteProduct = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id, productToDelete.name);
      setProductToDelete(null);
    }
  };

  const handleQuickAdjust = async (product: Product, amount: number, type: 'sale' | 'restock') => {
    if (type === 'sale') {
      setSaleProduct(product);
      setSaleQuantity(Math.abs(amount));
      setSaleModalOpen(true);
    } else {
      await adjustStock(product, amount, type);
    }
  };

  const handleConfirmSale = async (
    paymentMethod: 'Efectivo' | 'Transferencia' | 'Crédito', 
    deviceModel: string, 
    debtorName?: string,
    debtAmount?: number
  ) => {
    if (!saleProduct) return;
    
    // 1. Descontar las unidades y registrar en la bitácora de actividad
    const qty = saleQuantity;
    await adjustStock(saleProduct, -qty, 'sale');

    // 2. Registrar en la colección "ventas"
    const profit = (saleProduct.sellingPrice - saleProduct.costPrice) * qty;
    await addVenta({
      productId: saleProduct.id,
      productName: saleProduct.name,
      brand: saleProduct.brand,
      sellingPrice: saleProduct.sellingPrice,
      costPrice: saleProduct.costPrice,
      quantity: qty,
      profit: profit,
      paymentMethod,
      timestamp: Date.now(),
      deviceModel,
      debtorName: debtorName || '',
      isPaid: paymentMethod !== 'Crédito',
      debtAmount: debtAmount !== undefined ? debtAmount : (saleProduct.sellingPrice * qty)
    });
  };

  const handleUpdateVentaRecord = async (id: string, updates: Partial<Venta>) => {
    await updateVenta(id, updates);
  };

  const handleDeleteVentaRecord = async (id: string) => {
    await deleteVenta(id);
  };

  const handleClearVentasHistory = async () => {
    await clearAllVentas();
  };

  // Export current inventory state to CSV
  const handleExportCSV = () => {
    // CSV Header representation
    const headers = ['SKU', 'Nombre', 'Marca', 'Categoria', 'Stock', 'Mínimo Alerta', 'Precio Costo', 'Precio Venta', 'Ganancia Unitaria', 'Notas'];
    
    const rows = filteredProducts.map((p) => [
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`,
      p.brand,
      p.category,
      p.stock,
      p.minStock,
      p.costPrice,
      p.sellingPrice,
      p.sellingPrice - p.costPrice,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_reporte_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#070b19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#070b19] to-slate-950 text-slate-100 font-sans relative overflow-x-hidden selection:bg-indigo-500/30 selection:text-white">
        {/* Dynamic graphic glass elements and mesh glow filters */}
        <div className="absolute top-1/4 left-1/3 w-[350px] lg:w-[450px] h-[350px] lg:h-[450px] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-[300px] lg:w-[400px] h-[300px] lg:h-[400px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-[250px] lg:w-[350px] h-[250px] lg:h-[350px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

        {/* Top Navigation Banner */}
        <nav className="bg-white/5 border-b border-white/10 sticky top-0 z-40 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/10">
                  <Package className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                <div>
                  <h1 className="text-sm xs:text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight">
                    Gestor de Inventario
                  </h1>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-semibold tracking-wide mt-0.5">
                    <span className="xs:hidden">Control de existencias y reportes</span>
                    <span className="hidden xs:inline">Control de existencias y reportes en tiempo real</span>
                  </p>
                </div>
              </div>

              {/* Desktop Navigation Links (Middle of NavBar) */}
              <div className="hidden md:flex items-center gap-2.5 border-l border-white/10 pl-6 h-10 my-auto">
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'inventory'
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Inventario</span>
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'reports'
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Reportes & Ventas</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Category thresholds configuration trigger button */}
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="hidden sm:flex items-center gap-2 p-2.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl transition-all cursor-pointer"
                  title="Configurar Alertas por Categoría"
                >
                  <Sliders className="w-4 h-4" />
                  <span className="text-xs font-bold font-sans">Umbrales</span>
                </button>

                {/* Notification Center Popover */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                      showNotifications
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                        : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/15 border-white/10'
                    }`}
                    title="Notificaciones de stock"
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {stats.lowStockCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 border-2 border-[#090e21] rounded-full text-[10px] font-extrabold text-white flex items-center justify-center animate-pulse">
                        {stats.lowStockCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications dropdown list */}
                  <AnimatePresence>
                    {showNotifications && (
                      <>
                        {/* Clicking outside closes the dropdown list */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 text-slate-100 backdrop-blur-xl"
                        >
                          <div className="px-4.5 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                              <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest font-mono">Alertas Críticas</span>
                              <h4 className="text-xs sm:text-sm font-bold leading-tight">Artículos con Bajo Stock</h4>
                            </div>
                            <span className="px-2 py-0.5 bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-md text-[10px] font-bold font-mono">
                              {stats.lowStockCount} alertas
                            </span>
                          </div>

                          <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                            {lowStockProducts.length === 0 ? (
                              <div className="p-8 text-center">
                                <span className="text-2xl">🎉</span>
                                <p className="text-xs text-slate-400 font-semibold mt-2">¡Todo al día! No hay artículos bajo el umbral.</p>
                              </div>
                            ) : (
                              lowStockProducts.map((p) => {
                                const threshold = p.useCategoryThreshold ? (categoryThresholds[p.category] ?? 5) : p.minStock;
                                return (
                                  <div key={p.id} className="p-3.5 hover:bg-white/5 transition-colors flex justify-between items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                      <h5 className="text-xs font-bold text-slate-200 truncate" title={p.name}>
                                        {p.name}
                                      </h5>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                                        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold font-mono uppercase text-[9px] truncate max-w-[100px]">{p.category}</span>
                                        <span>Stock: <strong className={p.stock === 0 ? "text-rose-400" : "text-amber-400 font-bold"}>{p.stock}</strong>/{threshold} u</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => {
                                          setSearchQuery(p.sku);
                                          setShowNotifications(false);
                                        }}
                                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                        title="Buscar este artículo"
                                      >
                                        Encontrar
                                      </button>
                                      <button
                                        onClick={async () => {
                                          await handleQuickAdjust(p, 10, 'restock');
                                        }}
                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                        title="Agregar 10 unidades al stock"
                                      >
                                        +10 u
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <div className="p-3 bg-white/5 border-t border-white/10 flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">¿Deseas cambiar límites?</span>
                            <button
                              onClick={() => {
                                setIsCategoryModalOpen(true);
                                setShowNotifications(false);
                              }}
                              className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer animate-pulse"
                            >
                              <Sliders className="w-3.5 h-3.5" /> Configurar Umbrales
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleOpenAddModal}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden xs:inline">Agregar Producto</span>
                  <span className="xs:hidden">Agregar</span>
                </button>

                {/* Mobile sliders launcher */}
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="sm:hidden p-2.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl transition-all cursor-pointer"
                  title="Configurar Alertas por Categoría"
                >
                  <Sliders className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowLogsMobile(!showLogsMobile)}
                  className="lg:hidden p-2.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl transition-all cursor-pointer"
                  title="Historial de logs"
                >
                  <History className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Tab Bar Header */}
        <div className="md:hidden sticky top-16 z-30 bg-slate-900/90 backdrop-blur-md border-b border-white/10 grid grid-cols-2 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 rounded-xl font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventario</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 rounded-xl font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Reportes & Ventas</span>
          </button>
        </div>

        {/* Main Workspace Frame */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
          
          {/* Swipe gestures to slide between Inventory and Reports */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(e, info) => {
              if (info.offset.x < -120 && activeTab === 'inventory') {
                setActiveTab('reports');
              } else if (info.offset.x > 120 && activeTab === 'reports') {
                setActiveTab('inventory');
              }
            }}
            className="w-full relative touch-pan-y"
          >
            {activeTab === 'inventory' ? (
              <div className="space-y-6">
                {/* Financial KPI Dashboard Bar */}
                <div className="grid grid-cols-1 gap-4 max-w-sm">
                  <StatsCard
                    title="Valor del Inventario"
                    value={`$${stats.totalSellingValue.toLocaleString('es-CL')}`}
                    icon={<DollarSign className="w-5 h-5" />}
                    colorClass="bg-blue-600"
                    description={`Costo: $${stats.totalCostValue.toLocaleString('es-CL')}`}
                    trend={{
                      value: `Ganancia est: $${stats.estimatedProfit.toLocaleString('es-CL')}`,
                      isPositive: stats.estimatedProfit >= 0,
                    }}
                  />
                </div>

                {/* Control Desk & Catalogue section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  {/* Left grid - listings */}
                  <div className="lg:col-span-3 space-y-6">
                    {/* Search & Filters block */}
                    <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-5 rounded-2xl shadow-lg space-y-4">
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por descripción, marca, categoría o SKU..."
                            className="w-full pl-10 pr-10 py-3 rounded-xl border border-white/10 bg-white/5 focus:bg-white/10 transition-all outline-none focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-400 text-xs sm:text-sm text-white placeholder-slate-400 font-medium"
                          />
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3.5 top-3 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/15 transition-colors cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <div className="relative">
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as any)}
                              className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/10 appearance-none pr-8 transition-colors"
                            >
                              <option value="name_asc" className="bg-slate-900 text-white">A - Z (Nombre)</option>
                              <option value="name_desc" className="bg-slate-900 text-white">Z - A (Nombre)</option>
                              <option value="stock_desc" className="bg-slate-900 text-white">Mayor Stock</option>
                              <option value="stock_asc" className="bg-slate-900 text-white">Menor Stock</option>
                              <option value="price_desc" className="bg-slate-900 text-white">Mayor Precio Venta</option>
                              <option value="price_asc" className="bg-slate-900 text-white">Menor Precio Venta</option>
                            </select>
                            <span className="absolute right-3.5 top-3.5 pointer-events-none text-slate-300 text-xs">▼</span>
                          </div>

                          <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 hover:border-indigo-500/30 text-indigo-400 font-semibold px-4 py-3 rounded-xl text-xs transition-all cursor-pointer"
                            title="Importar catálogo e inventario desde un archivo Excel o CSV"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                            <span>Importar Excel</span>
                          </button>

                          <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/20 text-slate-300 font-semibold px-4 py-3 rounded-xl text-xs transition-all cursor-pointer"
                            title="Exportar inventario actual a un archivo CSV para Excel"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                            <span>Exportar Excel</span>
                          </button>

                          <button
                            onClick={() => setIsWhatsAppModalOpen(true)}
                            className="flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-400 hover:border-emerald-500/30 font-semibold px-4 py-3 rounded-xl text-xs transition-all cursor-pointer"
                            title="Generar catálogo en texto para WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4 text-emerald-400" />
                            <span>Catálogo WhatsApp</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2 items-center text-xs">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 shrink-0 mr-1 pt-[1px]">
                          <SlidersHorizontal className="w-3.5 h-3.5" /> Filtrar:
                        </span>

                        <button
                          onClick={() => setStockFilter('all')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                            stockFilter === 'all'
                              ? 'bg-white/15 text-white border border-white/20'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => setStockFilter('low')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            stockFilter === 'low'
                              ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40 font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Bajo Stock
                        </button>
                        <button
                          onClick={() => setStockFilter('out_of_stock')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            stockFilter === 'out_of_stock'
                              ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40 font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Agotado
                        </button>
                        <button
                          onClick={() => setStockFilter('healthy')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            stockFilter === 'healthy'
                              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Stock Estable
                        </button>

                        <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 outline-none cursor-pointer transition-colors"
                        >
                          <option value="" className="bg-slate-900 text-slate-300">Categorías (Todas)</option>
                          {categories.map((c) => (
                            <option key={c} value={c} className="bg-slate-900 text-slate-100">
                              {c}
                            </option>
                          ))}
                        </select>

                        <select
                          value={selectedBrand}
                          onChange={(e) => setSelectedBrand(e.target.value)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 outline-none cursor-pointer transition-colors"
                        >
                          <option value="" className="bg-slate-900 text-slate-300">Marcas (Todas)</option>
                          {brands.map((b) => (
                            <option key={b} value={b} className="bg-slate-900 text-slate-100">
                              {b}
                            </option>
                          ))}
                        </select>

                        {(selectedCategory || selectedBrand || stockFilter !== 'all' || searchQuery) && (
                          <button
                            onClick={() => {
                              setSelectedCategory('');
                              setSelectedBrand('');
                              setStockFilter('all');
                              setSearchQuery('');
                            }}
                            className="text-indigo-400 hover:text-indigo-300 font-bold ml-auto cursor-pointer"
                          >
                            Restaurar Filtros
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Products Grid rendering layout */}
                    {loading ? (
                      <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-20 flex flex-col items-center justify-center space-y-4 rounded-2xl">
                        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                        <p className="text-xs sm:text-sm font-semibold text-slate-400">Conectando a base de datos Firestore...</p>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="bg-white/5 border border-white/10 p-16 text-center rounded-2xl shadow-lg">
                        <div className="w-16 h-16 bg-white/5 text-slate-400 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Package className="w-8 h-8 stroke-1 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-200">No se encontraron productos</h3>
                        <p className="text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mt-1.5 leading-normal">
                          No pudimos hallar coincidencias según los criterios o filtros establecidos.
                        </p>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        layoutRoot
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                      >
                        <AnimatePresence mode="popLayout">
                          {filteredProducts.map((prod) => (
                            <motion.div
                              key={prod.id}
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ProductCard
                                product={prod}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteProduct}
                                onQuickAdjust={handleQuickAdjust}
                                categoryThresholds={categoryThresholds}
                              />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </div>

                  {/* Sidebar logs */}
                  <div className="hidden lg:block lg:col-span-1">
                    <ActivityLogsPanel logs={logs} onClearLogs={clearAllActivityLogs} />
                  </div>
                </div>

                {/* Desktop view tip overlay */}
                <div className="text-center py-2 text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
                  <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-bold text-[9px]">Gesto</span>
                  <span>Desliza con el dedo hacia la izquierda en la lista o usa el nav superior para ver Reportes.</span>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <SalesReportPanel
                  ventas={ventas}
                  products={products}
                  onDeleteVenta={handleDeleteVentaRecord}
                  onClearAllVentas={handleClearVentasHistory}
                  onUpdateVenta={handleUpdateVentaRecord}
                />

                {/* Mobile/Desktop back gesture tip */}
                <div className="text-center py-2 text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
                  <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-bold text-[9px]">Gesto</span>
                  <span>Desliza con el dedo hacia la derecha para volver a tus productos.</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </main>

        {/* Drawer overlay logs for Mobile viewport */}
        <AnimatePresence>
          {showLogsMobile && (
            <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setShowLogsMobile(false)} />
              <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="w-screen max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-white/10 p-4 shadow-2xl flex flex-col h-full"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-400" /> Historial de Actividad
                    </h3>
                    <button
                      onClick={() => setShowLogsMobile(false)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <ActivityLogsPanel logs={logs} onClearLogs={clearAllActivityLogs} />
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Create / Edit product modal dialog form */}
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveProduct}
          product={editingProduct}
          categoryThresholds={categoryThresholds}
          brands={brands}
        />

        {/* Category Minimum thresholds warning rules edit form */}
        <CategorySettingsModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          categories={categories}
          categoryThresholds={categoryThresholds}
        />

        {/* Standard simple WhatsApp message share modal dialog */}
        <WhatsAppModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          products={products}
        />

        {/* Master Excel import companion dialog */}
        <ImportExcelModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          existingProducts={products}
        />

        {/* Elegant sale details submit form dialog */}
        <ConfirmSaleModal
          isOpen={saleModalOpen}
          onClose={() => {
            setSaleModalOpen(false);
            setSaleProduct(null);
          }}
          product={saleProduct}
          quantity={saleQuantity}
          onConfirm={handleConfirmSale}
        />

        {/* Custom Confirmation Modal for Deleting Products */}
        <ConfirmModal
          isOpen={isConfirmDeleteOpen}
          onClose={() => {
            setIsConfirmDeleteOpen(false);
            setProductToDelete(null);
          }}
          onConfirm={handleExecuteDeleteProduct}
          title="¿Eliminar producto?"
          message={productToDelete ? `¿Estás seguro de que deseas eliminar permanentemente "${productToDelete.name}" (${productToDelete.brand})? Esta acción no se puede deshacer.` : ''}
          confirmText="Sí, Eliminar"
          cancelText="No, Cancelar"
          type="danger"
        />

        {/* All-in-one Floating action messaging companion widget */}
        <FloatingToolsMenu products={products} ventas={ventas} />

        {/* Real-Time stock level boundary alerts toasts */}
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none text-slate-100" id="toasts-portal">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-amber-500/30 rounded-xl p-4 shadow-2xl flex items-start gap-3 relative overflow-hidden"
                id={`toast-${t.id}`}
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg ml-1 shrink-0">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-amber-300">¡Alerta de Inventario!</h5>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug font-medium">{t.message}</p>
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ErrorBoundary>
  );
}

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ChevronRight, 
  Clock, 
  Trash2, 
  FileSpreadsheet, 
  Layers, 
  ArrowUpRight, 
  Sparkles,
  Smartphone,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Product, Venta } from '../types';
import ConfirmModal from './ConfirmModal';

interface SalesReportPanelProps {
  ventas: Venta[];
  products: Product[];
  onDeleteVenta: (id: string) => Promise<void>;
  onClearAllVentas: () => Promise<void>;
  onUpdateVenta?: (id: string, updates: Partial<Venta>) => Promise<void>;
}

type TimeFilter = '4h' | '24h' | '7d' | 'all';

export default function SalesReportPanel({
  ventas,
  products,
  onDeleteVenta,
  onClearAllVentas,
  onUpdateVenta,
}: SalesReportPanelProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Debt/Debtor tracking states
  const [subTab, setSubTab] = useState<'ventas' | 'deudores'>('ventas');
  const [debtToPay, setDebtToPay] = useState<Venta | null>(null);

  // Filter sales based on temporal selection
  const filteredSales = useMemo(() => {
    const now = Date.now();
    return ventas.filter((sale) => {
      const diffMs = now - sale.timestamp;
      if (timeFilter === '4h') {
        return diffMs <= 4 * 60 * 60 * 1000;
      }
      if (timeFilter === '24h') {
        return diffMs <= 24 * 60 * 60 * 1000;
      }
      if (timeFilter === '7d') {
        return diffMs <= 7 * 24 * 60 * 60 * 1000;
      }
      return true; // 'all'
    });
  }, [ventas, timeFilter]);

  // Compute stats: Totales, Efectivo, Transferencia, Créditos y Ganancia Total
  const stats = useMemo(() => {
    let totalVendidos = 0;
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalCreditoPendiente = 0;
    let totalCreditoCobrado = 0;
    let totalProfit = 0;

    filteredSales.forEach((sale) => {
      const saleAmount = sale.sellingPrice * sale.quantity;
      totalVendidos += saleAmount;
      if (sale.paymentMethod === 'Efectivo') {
        totalEfectivo += saleAmount;
      } else if (sale.paymentMethod === 'Transferencia') {
        totalTransferencia += saleAmount;
      } else if (sale.paymentMethod === 'Crédito') {
        const debtValue = sale.debtAmount !== undefined ? sale.debtAmount : saleAmount;
        if (!sale.isPaid) {
          totalCreditoPendiente += debtValue;
        } else {
          totalCreditoCobrado += debtValue;
        }
      }
      totalProfit += sale.profit;
    });

    return {
      totalVendidos,
      totalEfectivo,
      totalTransferencia,
      totalCreditoPendiente,
      totalCreditoCobrado,
      totalProfit,
    };
  }, [filteredSales]);

  // Debtor list: pending credit sales (We show all of them regardless of timeFilter so no debt gets lost from view!)
  const deudoresSales = useMemo(() => {
    return ventas.filter((sale) => sale.paymentMethod === 'Crédito' && !sale.isPaid);
  }, [ventas]);

  // Top 5 best selling products
  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; brand: string; quantity: number; revenue: number }> = {};
    filteredSales.forEach((sale) => {
      if (!counts[sale.productId]) {
        counts[sale.productId] = {
          name: sale.productName,
          brand: sale.brand,
          quantity: 0,
          revenue: 0,
        };
      }
      counts[sale.productId].quantity += sale.quantity;
      counts[sale.productId].revenue += sale.sellingPrice * sale.quantity;
    });

    return Object.values(counts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredSales]);

  // Profit by Brand (Ganancia por marca)
  const brandProfits = useMemo(() => {
    const profits: Record<string, { brand: string; profit: number; salesCount: number }> = {};
    filteredSales.forEach((sale) => {
      const b = sale.brand || 'Otros';
      if (!profits[b]) {
        profits[b] = { brand: b, profit: 0, salesCount: 0 };
      }
      profits[b].profit += sale.profit;
      profits[b].salesCount += sale.quantity;
    });

    return Object.values(profits).sort((a, b) => b.profit - a.profit);
  }, [filteredSales]);

  // Export Sales details to CSV
  const handleExportSalesCSV = () => {
    if (filteredSales.length === 0) {
      alert('No hay ventas para exportar en este período.');
      return;
    }

    const headers = [
      'ID Venta',
      'Fecha',
      'Hora',
      'Producto',
      'Marca',
      'Precio Venta',
      'Precio Costo',
      'Cantidad',
      'Ganancia',
      'Método de Pago',
      'Cliente Deudor',
      'Estado Pago',
      'Monto Deuda',
      'Celular Registrado'
    ];

    const rows = filteredSales.map((sale) => {
      const d = new Date(sale.timestamp);
      const dateStr = d.toLocaleDateString('es-CL');
      const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

      return [
        sale.id,
        dateStr,
        timeStr,
        `"${sale.productName.replace(/"/g, '""')}"`,
        sale.brand,
        sale.sellingPrice,
        sale.costPrice,
        sale.quantity,
        sale.profit,
        sale.paymentMethod,
        `"${(sale.debtorName || '').replace(/"/g, '""')}"`,
        sale.paymentMethod === 'Crédito' ? (sale.isPaid ? 'Pagado' : 'Pendiente') : 'Pagado',
        sale.paymentMethod === 'Crédito' ? (sale.debtAmount !== undefined ? sale.debtAmount : (sale.sellingPrice * sale.quantity)) : 0,
        `"${sale.deviceModel.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_reporte_${timeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearHistory = () => {
    setIsConfirmClearAllOpen(true);
  };

  const handleExecuteClearHistory = async () => {
    await onClearAllVentas();
  };

  const handleDeleteIndividual = (id: string, productName: string) => {
    setSaleToDelete({ id, name: productName });
  };

  const handleExecuteDeleteIndividual = async () => {
    if (saleToDelete) {
      await onDeleteVenta(saleToDelete.id);
      setSaleToDelete(null);
    }
  };

  // Mark debt as paid in full
  const handleExecuteConfirmPayDebt = async () => {
    if (debtToPay && onUpdateVenta) {
      await onUpdateVenta(debtToPay.id, { isPaid: true });
      setDebtToPay(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Time filters header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 bg-white/5 border border-white/10 p-4 rounded-2xl relative overflow-hidden backdrop-blur-md">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 font-mono">Panel Estadístico</span>
          <h2 className="text-lg font-bold text-white mt-0.5">Reportes & Estadísticas</h2>
        </div>

        {/* Horizontal scroll time filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {(['4h', '24h', '7d', 'all'] as const).map((filter) => {
            const label = {
              '4h': 'Últimas 4 Horas',
              '24h': 'Últimas 24 Horas',
              '7d': 'Última Semana',
              'all': 'Todo el Historial'
            }[filter];

            return (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  timeFilter === filter
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Money Sold total card */}
        <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-[-20%] right-[-10%] w-24 h-24 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Dinero Vendido Total</span>
              <h3 className="text-2xl font-black text-white mt-1.5 font-mono">
                ${stats.totalVendidos.toLocaleString('es-CL')}
              </h3>
            </div>
            <span className="p-2.5 bg-indigo-500/15 text-indigo-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>

          <div className="pt-4 mt-4 border-t border-white/5 flex flex-wrap gap-x-2 gap-y-1 justify-between text-[10px] text-slate-400 font-semibold font-mono">
            <span className="text-emerald-400">💵 Ef: ${stats.totalEfectivo.toLocaleString('es-CL')}</span>
            <span className="text-indigo-400">🏦 Tr: ${stats.totalTransferencia.toLocaleString('es-CL')}</span>
          </div>
        </div>

        {/* profit total card */}
        <div className="bg-slate-900 border border-emerald-500/20 bg-emerald-950/5 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-[-20%] right-[-10%] w-24 h-24 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Ganancia Estimada Real</span>
              <h3 className="text-2xl font-black text-emerald-400 mt-1.5 font-mono">
                ${stats.totalProfit.toLocaleString('es-CL')}
              </h3>
            </div>
            <span className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>

          <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-bold text-emerald-400 font-mono">
              {stats.totalVendidos > 0 ? ((stats.totalProfit / stats.totalVendidos) * 100).toFixed(1) : 0}%
            </span>
            <span>de margen de ganancia neto.</span>
          </div>
        </div>

        {/* Pending Debts card */}
        <div className={`bg-slate-900 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between border transition-all ${
          deudoresSales.length > 0 
            ? 'border-amber-500/30 bg-amber-500/[0.02]' 
            : 'border-white/10'
        }`}>
          <div className="absolute top-[-20%] right-[-10%] w-24 h-24 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Deudas por Cobrar</span>
              <h3 className={`text-2xl font-black mt-1.5 font-mono ${deudoresSales.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                ${stats.totalCreditoPendiente.toLocaleString('es-CL')}
              </h3>
            </div>
            <span className={`p-2.5 rounded-xl ${deudoresSales.length > 0 ? 'bg-amber-500/15 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              📋
            </span>
          </div>

          <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`font-mono font-bold ${deudoresSales.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {deudoresSales.length} {deudoresSales.length === 1 ? 'deudor' : 'deudores'}
            </span>
            <span>pendientes de pago.</span>
          </div>
        </div>

        {/* Volume of operations */}
        <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-[-20%] right-[-10%] w-24 h-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Transacciones Registradas</span>
              <h3 className="text-2xl font-black text-white mt-1.5 font-mono">
                {filteredSales.length} {filteredSales.length === 1 ? 'Venta' : 'Ventas'}
              </h3>
            </div>
            <span className="p-2.5 bg-indigo-500/10 text-indigo-300 rounded-xl">
              <Clock className="w-5 h-5" />
            </span>
          </div>

          <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Período:</span>
            <span className="text-white font-bold font-mono">
              {timeFilter === '4h' ? 'Últimas 4 horas' : timeFilter === '24h' ? 'Últimas 24 horas' : timeFilter === '7d' ? 'Última semana' : 'Todo el historial'}
            </span>
          </div>
        </div>
      </div>

      {/* Bento content layout: Top 5 and Brand Profits charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 Products list */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Los 5 Productos más Vendidos
            </h3>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Demanda</span>
          </div>

          {topProducts.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-xs">
              Sin registros de ventas en este período temporal.
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black font-mono text-slate-500 w-5 text-center">#{idx + 1}</span>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block truncate max-w-[160px]">{p.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold">{p.brand}</span>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-xs font-bold text-white block">{p.quantity} u</span>
                    <span className="text-[10px] text-slate-400 font-semibold">${p.revenue.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profit by Brand list (Ganancia por marca) */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> Rendimiento de Ganancias por Marca
            </h3>
            <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Margen</span>
          </div>

          {brandProfits.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-xs">
              Sin registros de ganancias o ventas por marca.
            </div>
          ) : (
            <div className="space-y-3.5">
              {brandProfits.map((bp, idx) => {
                const totalProfit = stats.totalProfit;
                const percentageOfTotal = totalProfit > 0 ? (bp.profit / totalProfit) * 100 : 0;

                return (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">{bp.brand}</span>
                      <p className="text-[10px] text-slate-400">
                        {bp.salesCount} {bp.salesCount === 1 ? 'venta' : 'ventas'} registradas
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400 font-mono block">
                        +${bp.profit.toLocaleString('es-CL')}
                      </span>
                      <span className="text-[9px] text-indigo-400 font-bold font-mono">
                        {percentageOfTotal.toFixed(1)}% del total
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Transaction History Table */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 bg-slate-800/40 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <div>
              <h3 className="text-sm font-bold text-white">Historial & Cuentas de Cobro</h3>
              <p className="text-[10px] text-slate-400 leading-normal font-medium mt-0.5">Visualiza el registro histórico de ventas o gestiona las cuentas deudores pendientes.</p>
            </div>
            
            {/* Tab switch inside table */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 shrink-0 self-stretch sm:self-auto justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => setSubTab('ventas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'ventas'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📊 Ventas
              </button>
              <button
                type="button"
                onClick={() => setSubTab('deudores')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
                  subTab === 'deudores'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 Deudores
                {deudoresSales.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white animate-pulse">
                    {deudoresSales.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {subTab === 'ventas' && (
              <>
                {/* Export sales CSV */}
                <button
                  onClick={handleExportSalesCSV}
                  className="flex-1 md:flex-none px-3.5 py-2 hover:bg-emerald-500/10 hover:text-emerald-300 border border-emerald-500/30 text-emerald-400 bg-emerald-500/5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Descargar archivo Excel CSV de ventas"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar XLS</span>
                </button>

                {/* Clear database button */}
                <button
                  onClick={handleClearHistory}
                  className="px-3.5 py-2 hover:bg-rose-500/10 hover:text-rose-300 border border-rose-500/20 text-slate-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Borrar todas las ventas realizadas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpiar Todo</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table View wrapper */}
        <div className="overflow-x-auto">
          {subTab === 'deudores' ? (
            deudoresSales.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs font-semibold">¡Todo al día! No hay clientes con deudas pendientes registradas.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono border-b border-white/5">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cliente Deudor</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">Monto que Debe</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                  {deudoresSales.map((sale) => {
                    const d = new Date(sale.timestamp);
                    const dateStr = d.toLocaleDateString('es-CL', { month: 'short', day: '2-digit' });
                    const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                    const amountOwed = sale.debtAmount !== undefined ? sale.debtAmount : (sale.sellingPrice * sale.quantity);

                    return (
                      <tr key={sale.id} className="hover:bg-white/5 transition-all">
                        <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">
                          <span className="block text-white font-bold">{dateStr}</span>
                          <span>{timeStr}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-amber-300 text-sm flex items-center gap-1.5">
                            👤 {sale.debtorName || 'Cliente Anónimo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-white block truncate max-w-[200px]">{sale.productName}</span>
                          <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded font-bold font-mono inline-block mt-0.5">{sale.brand}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-300">
                          {sale.quantity} u
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400 text-sm">
                          ${amountOwed.toLocaleString('es-CL')}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDebtToPay(sale)}
                              className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white font-bold rounded-lg text-[10px] transition-all flex items-center gap-1 cursor-pointer"
                              title="Registrar cobro de esta deuda"
                            >
                              ✔ Marcar Pagado
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIndividual(sale.id, sale.productName)}
                              className="text-slate-400 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            filteredSales.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-semibold">No se encontraron ventas registradas en el período seleccionado.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono border-b border-white/5">
                    <th className="py-3 px-4">Fecha/Hora</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Pago</th>
                    <th className="py-3 px-4 text-right">Precio unit</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">Ganancia</th>
                    <th className="py-3 px-4">Dispositivo</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                  {filteredSales.map((sale) => {
                    const d = new Date(sale.timestamp);
                    const dateStr = d.toLocaleDateString('es-CL', { month: 'short', day: '2-digit' });
                    const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={sale.id} className="hover:bg-white/5 transition-all">
                        <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">
                          <span className="block text-white font-bold">{dateStr}</span>
                          <span>{timeStr}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-white block truncate max-w-[160px]">{sale.productName}</span>
                          <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded font-bold font-mono inline-block mt-0.5">{sale.brand}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {sale.paymentMethod === 'Crédito' ? (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center justify-center gap-1 w-max ${
                              sale.isPaid 
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse'
                            }`}>
                              📋 {sale.isPaid ? 'Crédito (Pagado)' : `Crédito (${sale.debtorName || 'Deuda'}: $${(sale.debtAmount !== undefined ? sale.debtAmount : (sale.sellingPrice * sale.quantity)).toLocaleString('es-CL')})`}
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              sale.paymentMethod === 'Efectivo' 
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                            }`}>
                              {sale.paymentMethod}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          ${sale.sellingPrice.toLocaleString('es-CL')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-300">
                          {sale.quantity} u
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                          +${sale.profit.toLocaleString('es-CL')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px]">
                          <div className="flex items-center gap-1.5 truncate max-w-[120px]" title={sale.deviceModel}>
                            <Smartphone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span>{sale.deviceModel}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteIndividual(sale.id, sale.productName)}
                            className="text-slate-400 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar registro de venta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Confirm modal for clearing all sales logs */}
      <ConfirmModal
        isOpen={isConfirmClearAllOpen}
        onClose={() => setIsConfirmClearAllOpen(false)}
        onConfirm={handleExecuteClearHistory}
        title="¿Eliminar todo el historial?"
        message="🚨 ¡ATENCIÓN DEFINITIVA! ¿Deseas eliminar TODO el historial de ventas? Esta acción es irreversible y borrará permanentemente todos los registros en Firestore."
        confirmText="Sí, Eliminar Todo"
        cancelText="No, Cancelar"
        type="danger"
      />

      {/* Confirm modal for deleting individual sale log */}
      <ConfirmModal
        isOpen={!!saleToDelete}
        onClose={() => setSaleToDelete(null)}
        onConfirm={handleExecuteDeleteIndividual}
        title="¿Eliminar transacción?"
        message={saleToDelete ? `¿Estás seguro de que deseas quitar la transacción de venta de "${saleToDelete.name}" del historial?` : ''}
        confirmText="Sí, Eliminar"
        cancelText="No, Cancelar"
        type="danger"
      />

      {/* Confirm modal for registering payment of debt */}
      <ConfirmModal
        isOpen={!!debtToPay}
        onClose={() => setDebtToPay(null)}
        onConfirm={handleExecuteConfirmPayDebt}
        title="¿Registrar cobro de deuda?"
        message={debtToPay ? `¿Confirmar que el cliente "${debtToPay.debtorName || 'Anónimo'}" canceló la deuda de $${(debtToPay.debtAmount !== undefined ? debtToPay.debtAmount : (debtToPay.sellingPrice * debtToPay.quantity)).toLocaleString('es-CL')} por el producto "${debtToPay.productName}"?` : ''}
        confirmText="Sí, Cobrado"
        cancelText="No, Cancelar"
        type="info"
      />
    </div>
  );
}

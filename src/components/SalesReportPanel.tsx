import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  DollarSign, 
  FileSpreadsheet, 
  RotateCcw, 
  CheckCircle2,
  XCircle,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Product, Venta } from '../types';
import ConfirmModal from './ConfirmModal';

interface SalesReportPanelProps {
  ventas: Venta[];
  products: Product[];
  onVoidVenta: (venta: Venta) => void;
  onClearAllVentas: () => Promise<void>;
  onUpdateVenta?: (id: string, updates: Partial<Venta>) => Promise<void>;
  currentOperatorName?: string;
}

type TimeFilter = '4h' | '24h' | '7d' | 'all';

export default function SalesReportPanel({
  ventas,
  products,
  onVoidVenta,
  onClearAllVentas,
  onUpdateVenta,
  currentOperatorName = 'Administrador'
}: SalesReportPanelProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [subTab, setSubTab] = useState<'ventas' | 'deudores'>('ventas');
  const [debtToPay, setDebtToPay] = useState<Venta | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completada' | 'anulada'>('all');

  // Filter sales based on temporal selection and status
  const filteredSales = useMemo(() => {
    const now = Date.now();
    return ventas.filter((sale) => {
      const diffMs = now - sale.timestamp;
      let matchesTime = true;
      if (timeFilter === '4h') matchesTime = diffMs <= 4 * 60 * 60 * 1000;
      else if (timeFilter === '24h') matchesTime = diffMs <= 24 * 60 * 60 * 1000;
      else if (timeFilter === '7d') matchesTime = diffMs <= 7 * 24 * 60 * 60 * 1000;

      if (!matchesTime) return false;

      if (statusFilter === 'completada') return sale.status !== 'anulada';
      if (statusFilter === 'anulada') return sale.status === 'anulada';
      return true;
    });
  }, [ventas, timeFilter, statusFilter]);

  // Compute stats ONLY from active completed sales (voided sales do NOT inflate revenue/profit)
  const stats = useMemo(() => {
    let totalVendidos = 0;
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalCreditoPendiente = 0;
    let totalCreditoCobrado = 0;
    let totalProfit = 0;
    let totalAnuladasCount = 0;

    ventas.forEach((sale) => {
      const now = Date.now();
      const diffMs = now - sale.timestamp;
      let inTime = true;
      if (timeFilter === '4h') inTime = diffMs <= 4 * 60 * 60 * 1000;
      else if (timeFilter === '24h') inTime = diffMs <= 24 * 60 * 60 * 1000;
      else if (timeFilter === '7d') inTime = diffMs <= 7 * 24 * 60 * 60 * 1000;
      if (!inTime) return;

      if (sale.status === 'anulada') {
        totalAnuladasCount++;
        return; // Exclude voided from active financial totals
      }

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
      totalAnuladasCount
    };
  }, [ventas, timeFilter]);

  // Debtor list: pending credit sales (only completed, non-voided sales)
  const deudoresSales = useMemo(() => {
    return ventas.filter(
      (sale) => sale.paymentMethod === 'Crédito' && !sale.isPaid && sale.status !== 'anulada'
    );
  }, [ventas]);

  // Top products (only from completed sales)
  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; brand: string; quantity: number; revenue: number }> = {};
    filteredSales.forEach((sale) => {
      if (sale.status === 'anulada') return;
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

  // Profit by Brand
  const brandProfits = useMemo(() => {
    const profits: Record<string, { brand: string; profit: number; salesCount: number }> = {};
    filteredSales.forEach((sale) => {
      if (sale.status === 'anulada') return;
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
      'Estado',
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
      'Operador Registrador',
      'Motivo Anulacion',
      'Anulado Por'
    ];

    const rows = filteredSales.map((sale) => {
      const d = new Date(sale.timestamp);
      const dateStr = d.toLocaleDateString('es-CL');
      const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

      return [
        sale.id,
        sale.status === 'anulada' ? 'ANULADA' : 'COMPLETADA',
        dateStr,
        timeStr,
        `"${sale.productName.replace(/"/g, '""')}"`,
        sale.brand,
        sale.sellingPrice,
        sale.costPrice,
        sale.quantity,
        sale.status === 'anulada' ? 0 : sale.profit,
        sale.paymentMethod,
        `"${(sale.debtorName || '').replace(/"/g, '""')}"`,
        sale.paymentMethod === 'Crédito' ? (sale.isPaid ? 'Pagado' : 'Pendiente') : 'Pagado',
        sale.paymentMethod === 'Crédito' ? (sale.debtAmount !== undefined ? sale.debtAmount : (sale.sellingPrice * sale.quantity)) : 0,
        `"${sale.operatorName || sale.operatorEmail || ''}"`,
        `"${(sale.voidReason || '').replace(/"/g, '""')}"`,
        `"${(sale.voidBy || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_${timeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mark debt as paid
  const handleExecuteConfirmPayDebt = async () => {
    if (debtToPay && onUpdateVenta) {
      await onUpdateVenta(debtToPay.id, { isPaid: true });
      setDebtToPay(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Time filters header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/5 backdrop-blur-lg border border-white/10 p-4 sm:p-5 rounded-2xl shadow-lg">
        <div>
          <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-400 font-mono">
            Panel Estadístico
          </span>
          <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
            Reportes, Ventas & Control de Deudas
          </h2>
        </div>

        {/* Temporal Filters */}
        <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 p-1 rounded-xl">
          {(['4h', '24h', '7d', 'all'] as const).map((filter) => {
            const label = {
              '4h': '4 Horas',
              '24h': '24 Horas',
              '7d': '7 Días',
              'all': 'Histórico',
            }[filter];

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  timeFilter === filter
                    ? 'bg-indigo-600 text-white shadow-md font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturado */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Ingreso Neto (Ventas Activas)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            ${stats.totalVendidos.toLocaleString('es-CL')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Excluye automáticamente ventas anuladas
          </p>
        </div>

        {/* Ganancia Estimada */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Ganancia Real</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            +${stats.totalProfit.toLocaleString('es-CL')}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
            <span>Margen neto sobre costo</span>
          </div>
        </div>

        {/* Efectivo vs Transferencias */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="text-xs text-slate-400 mb-2 font-medium">Medios de Cobro</div>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Efectivo:</span>
              <span className="font-bold text-white tabular-nums">
                ${stats.totalEfectivo.toLocaleString('es-CL')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Transferencia:</span>
              <span className="font-bold text-white tabular-nums">
                ${stats.totalTransferencia.toLocaleString('es-CL')}
              </span>
            </div>
          </div>
        </div>

        {/* Deudas por Cobrar */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Deudas Pendientes</span>
            <span className="text-[11px] font-mono text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-lg">
              {deudoresSales.length} cliente(s)
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400">
            ${stats.totalCreditoPendiente.toLocaleString('es-CL')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Créditos pendientes de cobro</p>
        </div>
      </div>

      {/* Analytics: Top Products and Brand Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 Products */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Top 5 Productos más Vendidos</h3>
          {topProducts.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Sin ventas en este período</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-white/5 rounded-xl text-xs">
                  <div>
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="text-slate-400 ml-2">({p.brand})</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-white">{p.quantity} unid.</span>
                    <span className="text-slate-400 block text-[10px] tabular-nums">
                      ${p.revenue.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Brand Performance */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Ganancia por Marca</h3>
          {brandProfits.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Sin ventas en este período</p>
          ) : (
            <div className="space-y-2">
              {brandProfits.map((bp, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-white/5 rounded-xl text-xs">
                  <div>
                    <span className="font-semibold text-white uppercase font-mono">{bp.brand}</span>
                    <span className="text-slate-400 ml-2 text-[11px]">
                      {bp.salesCount} venta(s)
                    </span>
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-400 tabular-nums">
                    +${bp.profit.toLocaleString('es-CL')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Transaction History Table */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        {/* Controls Bar */}
        <div className="px-5 py-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab('ventas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'ventas'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white bg-white/5 border border-white/5'
              }`}
            >
              Historial de Ventas ({filteredSales.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('deudores')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                subTab === 'deudores'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <span>Clientes Deudores</span>
              {deudoresSales.length > 0 && (
                <span className="px-1.5 py-0.2 bg-white text-amber-900 text-[10px] rounded-full font-bold">
                  {deudoresSales.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {subTab === 'ventas' && (
              <>
                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label="Filtrar por estado"
                  className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">Todas las ventas</option>
                  <option value="completada">Solo completadas</option>
                  <option value="anulada">Solo anuladas</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportSalesCSV}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Descargar CSV</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto">
          {subTab === 'deudores' ? (
            deudoresSales.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-200">¡Al día! No hay clientes con saldos pendientes.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 text-[11px] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold font-mono">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cliente Deudor</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">Monto que Debe</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {deudoresSales.map((sale) => {
                    const d = new Date(sale.timestamp);
                    const dateStr = d.toLocaleDateString('es-CL', { month: 'short', day: '2-digit' });
                    const amountOwed = sale.debtAmount !== undefined ? sale.debtAmount : (sale.sellingPrice * sale.quantity);

                    return (
                      <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{dateStr}</td>
                        <td className="py-3 px-4 font-semibold text-amber-300">
                          👤 {sale.debtorName || 'Cliente Anónimo'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-white">{sale.productName}</span>
                          <span className="text-[11px] text-slate-400 block">{sale.brand}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-300">
                          {sale.quantity} u
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 text-sm tabular-nums">
                          ${amountOwed.toLocaleString('es-CL')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setDebtToPay(sale)}
                            className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            Marcar Pagado
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : filteredSales.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No se encontraron ventas para los filtros seleccionados.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-[11px] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold font-mono">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4 text-right">P. Unitario</th>
                  <th className="py-3 px-4 text-right">Cant.</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Operador</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {filteredSales.map((sale) => {
                  const d = new Date(sale.timestamp);
                  const dateStr = d.toLocaleDateString('es-CL', { month: 'short', day: '2-digit' });
                  const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                  const isVoided = sale.status === 'anulada';
                  const totalSale = sale.sellingPrice * sale.quantity;

                  return (
                    <tr
                      key={sale.id}
                      className={`transition-colors ${
                        isVoided ? 'bg-rose-500/5 text-slate-500' : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        <span className="block text-slate-200 font-medium">{dateStr}</span>
                        <span>{timeStr}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`font-semibold ${isVoided ? 'line-through text-slate-500' : 'text-white'}`}>
                          {sale.productName}
                        </span>
                        <span className="text-[11px] text-slate-400 block">{sale.brand}</span>
                      </td>

                      <td className="py-3 px-4">
                        {isVoided ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/25 px-2 py-0.5 rounded-lg">
                              <XCircle className="w-3 h-3" /> Anulada
                            </span>
                            {sale.voidReason && (
                              <p className="text-[10px] text-rose-400 line-clamp-1 max-w-[180px]" title={sale.voidReason}>
                                {sale.voidReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-lg">
                            <CheckCircle2 className="w-3 h-3" /> Completada
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-300">{sale.paymentMethod}</span>
                        {sale.paymentMethod === 'Crédito' && (
                          <span className="block text-[10px] text-amber-400 font-mono">
                            {sale.isPaid ? 'Cobrado' : `Debe ${sale.debtorName || 'Cliente'}`}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        ${sale.sellingPrice.toLocaleString('es-CL')}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                        {sale.quantity}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                        ${totalSale.toLocaleString('es-CL')}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-400">
                        <span className="font-medium text-slate-200">
                          {sale.operatorName || sale.operatorEmail || 'Administrador'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {!isVoided ? (
                          <button
                            type="button"
                            onClick={() => onVoidVenta(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 rounded-lg font-medium transition-colors cursor-pointer"
                            title="Anular venta y reponer stock"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Anular</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            Repuesto
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pay Debt Modal */}
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

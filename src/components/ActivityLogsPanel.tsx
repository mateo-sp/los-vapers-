import React, { useState } from 'react';
import { motion } from 'motion/react';
import { History, ArrowDownLeft, ArrowUpRight, ShieldCheck, AlertCircle, Trash2, Calendar } from 'lucide-react';
import { ActivityLog } from '../types';
import ConfirmModal from './ConfirmModal';

interface ActivityLogsPanelProps {
  logs: ActivityLog[];
  onClearLogs: () => Promise<void>;
}

export default function ActivityLogsPanel({ logs, onClearLogs }: ActivityLogsPanelProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleClear = () => {
    setIsConfirmOpen(true);
  };

  const executeClear = () => {
    onClearLogs();
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-4 sm:p-6 rounded-2xl shadow-lg flex flex-col h-[650px] max-h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          Historial de Actividad
        </h3>
        {logs.length > 0 && (
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-rose-400 p-1.5 hover:bg-white/5 rounded-lg transition-all text-xs flex items-center gap-1 font-semibold cursor-pointer"
            title="Limpiar historial"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar todo
          </button>
        )}
      </div>

      {/* Logs stack */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-500 stroke-1 mb-2" />
            <p className="text-sm font-medium text-slate-300">No hay registros de actividad aún</p>
            <p className="text-xs text-slate-500 max-w-[200px] mt-1">
              Las modificaciones de stock o nuevos productos aparecerán aquí.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const date = new Date(log.timestamp);
            const timeStr = date.toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const dateStr = date.toLocaleDateString('es-CL', {
              day: '2-digit',
              month: 'short',
            });

            // Status design presets
            const isSale = log.type === 'sale';
            const isRestock = log.type === 'restock';

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-xl border text-xs leading-normal flex items-start gap-2.5 transition-colors ${
                  isSale
                    ? 'border-rose-500/15 bg-rose-500/5 hover:bg-rose-500/10'
                    : isRestock
                      ? 'border-emerald-500/15 bg-emerald-500/5 hover:bg-emerald-500/10'
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
              >
                {/* Icon mapping */}
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    isSale
                      ? 'bg-rose-500/20 text-rose-400'
                      : isRestock
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-indigo-500/20 text-indigo-400'
                  }`}
                >
                  {isSale ? (
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  ) : isRestock ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Content info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-semibold text-slate-100 line-clamp-1">{log.productName}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono flex items-center gap-0.5 whitespace-nowrap">
                      <Calendar className="w-3 h-3" />
                      {dateStr}, {timeStr}
                    </span>
                  </div>

                  <p className="text-slate-300 font-medium md:text-[11px]">
                    {isSale ? (
                      <span>
                        Se vendieron <strong className="text-rose-400">{log.quantity}</strong> unidades.{' '}
                        {log.sellingPrice > 0 && (
                          <span className="text-slate-400 font-normal">
                            (P.V. ${log.sellingPrice.toLocaleString('es-CL')})
                          </span>
                        )}
                      </span>
                    ) : isRestock ? (
                      <span>
                        Se surtieron <strong className="text-emerald-400">+{log.quantity}</strong> unidades.{' '}
                        {log.costPrice > 0 && (
                          <span className="text-slate-400 font-normal">
                            (Costo ${log.costPrice.toLocaleString('es-CL')})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>Ajuste manual de inventario o alta de producto.</span>
                    )}
                  </p>

                  {/* Stock transition indicator */}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span>Stock: {log.prevStock}</span>
                    <span className="text-slate-500">→</span>
                    <span className="font-bold text-slate-200">{log.newStock} u.</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={executeClear}
        title="¿Limpiar historial de actividad?"
        message="¿Estás seguro de que deseas limpiar todo el historial de transacciones de actividad? Esta acción es irreversible."
        confirmText="Limpiar todo"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
}

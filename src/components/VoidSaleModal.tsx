import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, X, AlertTriangle } from 'lucide-react';
import { Venta } from '../types';

interface VoidSaleModalProps {
  isOpen: boolean;
  venta: Venta | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  operatorName: string;
}

const COMMON_REASONS = [
  'Cliente canceló la compra',
  'Error al ingresar la cantidad',
  'Devolución de mercadería por falla',
  'Venta registrada por duplicado',
  'Cambio de producto por otro modelo'
];

export default function VoidSaleModal({
  isOpen,
  venta,
  onClose,
  onConfirm,
  operatorName
}: VoidSaleModalProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !venta) return null;

  const finalReason = reason === 'otro' ? customReason.trim() : (reason || customReason.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalReason) {
      setError('Por favor indica el motivo de la anulación.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onConfirm(finalReason);
      setReason('');
      setCustomReason('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al anular la venta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-slate-900 rounded-2xl shadow-2xl border border-white/15 overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Anular Registro de Venta</h3>
                <p className="text-xs text-slate-400">Repone el inventario y audita el motivo</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Sale Summary Card */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-white/10 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span>Producto:</span>
                <span className="font-semibold text-white text-right">{venta.productName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Marca:</span>
                <span className="text-slate-200">{venta.brand || 'General'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Cantidad vendida:</span>
                <span className="font-bold text-amber-400 font-mono">
                  {venta.quantity} unidades (serán devueltas al stock)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Total venta:</span>
                <span className="font-mono text-white font-semibold">
                  ${(venta.sellingPrice * venta.quantity).toLocaleString('es-CL')} ({venta.paymentMethod})
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/25 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Reasons selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Selecciona el motivo de la anulación:
              </label>
              <div className="space-y-1.5">
                {COMMON_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setReason(r);
                      setError(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition-colors cursor-pointer ${
                      reason === r
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-medium'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setReason('otro');
                    setError(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition-colors cursor-pointer ${
                    reason === 'otro'
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-medium'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  Otro motivo personalizado...
                </button>
              </div>
            </div>

            {/* Custom Reason textarea */}
            {reason === 'otro' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Describe el motivo de la anulación:
                </label>
                <textarea
                  rows={2}
                  required
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Explica por qué se anula esta venta..."
                  className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5">
              <span>Operador auditor: <strong className="text-white font-medium">{operatorName}</strong></span>
              <span>Esta acción repondrá el stock</span>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !finalReason}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 shadow-lg shadow-amber-600/20 cursor-pointer"
              >
                {loading ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PackagePlus, PackageMinus, X } from 'lucide-react';
import { Product } from '../types';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (amount: number, type: 'restock' | 'adjustment', reason: string) => Promise<void>;
  operatorName: string;
}

const RESTOCK_REASONS = [
  'Compra de mercadería a proveedor',
  'Ingreso de lote nuevo',
  'Devolución de cliente por cambio',
  'Reposición desde depósito central',
  'Ajuste por conteo físico (sobrante)'
];

const ADJUST_REASONS = [
  'Ajuste por conteo físico (faltante)',
  'Mercadería dañada o defectuosa',
  'Uso para exhibición o muestra',
  'Error de conteo previo',
  'Vencimiento o merma'
];

export default function StockAdjustmentModal({
  isOpen,
  product,
  onClose,
  onConfirm,
  operatorName
}: StockAdjustmentModalProps) {
  const [mode, setMode] = useState<'restock' | 'adjustment'>('restock');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const currentStock = product.stock;
  const newStock = mode === 'restock' 
    ? currentStock + quantity 
    : Math.max(0, currentStock - quantity);

  const finalReason = selectedReason === 'otro' 
    ? customReason.trim() 
    : (selectedReason || customReason.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (!finalReason) {
      setError('Debes indicar el motivo del movimiento de stock.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const amount = mode === 'restock' ? quantity : -quantity;
      await onConfirm(amount, mode, finalReason);
      setQuantity(1);
      setSelectedReason('');
      setCustomReason('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar el stock.');
    } finally {
      setLoading(false);
    }
  };

  const reasonsList = mode === 'restock' ? RESTOCK_REASONS : ADJUST_REASONS;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-white/15 overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                mode === 'restock' ? 'bg-emerald-600' : 'bg-amber-600'
              }`}>
                {mode === 'restock' ? <PackagePlus className="w-5 h-5" /> : <PackageMinus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {mode === 'restock' ? 'Entrada de Mercadería' : 'Ajuste / Salida de Stock'}
                </h3>
                <p className="text-xs text-slate-400">{product.name}</p>
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
            {/* Mode Segmented Switch */}
            <div className="flex p-1 bg-slate-950/80 border border-white/10 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('restock');
                  setSelectedReason('');
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === 'restock'
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                + Entrada (Surtir)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('adjustment');
                  setSelectedReason('');
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === 'adjustment'
                    ? 'bg-amber-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                - Salida / Ajuste
              </button>
            </div>

            {/* Current vs New stock preview */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-white/10 text-xs">
              <div>
                <span className="text-slate-400 block">Stock actual</span>
                <span className="text-base font-bold font-mono text-white">{currentStock} u</span>
              </div>
              <div>
                <span className="text-slate-400 block">Nuevo stock resultante</span>
                <span className={`text-base font-bold font-mono ${
                  mode === 'restock' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {newStock} u
                </span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 text-xs bg-rose-500/15 border border-rose-500/25 text-rose-300 rounded-xl">
                {error}
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Cantidad a {mode === 'restock' ? 'ingresar' : 'descontar'}
              </label>
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Motivo dropdown/presets */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Motivo del movimiento
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="">Selecciona un motivo estándar...</option>
                {reasonsList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="otro">Otro motivo personalizado...</option>
              </select>
            </div>

            {selectedReason === 'otro' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Escribe el motivo detallado:
                </label>
                <input
                  type="text"
                  required
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Ej. Devolución de garantía por proveedor"
                  className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            )}

            <div className="text-[11px] text-slate-400 pt-1 border-t border-white/5 flex justify-between items-center">
              <span>Operador: <strong className="text-white">{operatorName}</strong></span>
              <span>Quedará registrado en bitácora</span>
            </div>

            {/* Actions */}
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
                disabled={loading}
                className={`px-4 py-2 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg cursor-pointer ${
                  mode === 'restock'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                }`}
              >
                {loading ? 'Guardando...' : 'Aplicar Movimiento'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

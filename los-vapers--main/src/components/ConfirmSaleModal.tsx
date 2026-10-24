import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, DollarSign, Smartphone, ShoppingCart, AlertCircle, UserCheck } from 'lucide-react';
import { Product } from '../types';

interface ConfirmSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  quantity: number;
  operatorName?: string;
  onConfirm: (
    paymentMethod: 'Efectivo' | 'Transferencia' | 'Crédito', 
    deviceModel: string, 
    debtorName?: string, 
    debtAmount?: number,
    confirmedQuantity?: number
  ) => Promise<void>;
}

function detectDeviceModel(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) {
    const matches = ua.match(/Android\s+([^\s;]+(\s+[^\s;]+)*)/);
    const modelMatch = ua.match(/;\s+([^;]+)\s+Build\//);
    if (modelMatch && modelMatch[1]) {
      return modelMatch[1].trim();
    }
    return matches ? `Android (${matches[1]})` : "Celular Android";
  }
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Macintosh/i.test(ua)) return "MacBook / iMac";
  if (/Windows/i.test(ua)) return "PC Windows";
  if (/Linux/i.test(ua)) return "PC Linux";
  return "Dispositivo Móvil";
}

export default function ConfirmSaleModal({
  isOpen,
  onClose,
  product,
  quantity = 1,
  operatorName = 'Administrador',
  onConfirm,
}: ConfirmSaleModalProps) {
  const [saleQty, setSaleQty] = useState(quantity);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia' | 'Crédito'>('Efectivo');
  const [debtorName, setDebtorName] = useState('');
  const [debtAmountInput, setDebtAmountInput] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && product) {
      setSaleQty(quantity);
      setDeviceModel(detectDeviceModel());
      setPaymentMethod('Efectivo');
      setDebtorName('');
      setDebtAmountInput('');
      setError('');
    }
  }, [isOpen, product, quantity]);

  if (!isOpen || !product) return null;

  const currentAvailableStock = product.stock;

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) {
      setSaleQty(1);
    } else {
      setSaleQty(val);
    }
    setError('');
  };

  const handleStepQty = (delta: number) => {
    const next = saleQty + delta;
    if (next >= 1 && next <= currentAvailableStock) {
      setSaleQty(next);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Pre-validate stock availability
    if (saleQty > currentAvailableStock) {
      setError(`Stock insuficiente. Solo quedan ${currentAvailableStock} unidad(es) disponibles.`);
      return;
    }

    if (paymentMethod === 'Crédito' && !debtorName.trim()) {
      setError('Por favor indica el nombre del cliente deudor.');
      return;
    }

    let parsedDebtAmount: number | undefined = undefined;
    if (paymentMethod === 'Crédito') {
      const defaultTotal = product.sellingPrice * saleQty;
      parsedDebtAmount = debtAmountInput.trim() !== '' ? Math.max(0, parseFloat(debtAmountInput) || 0) : defaultTotal;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(paymentMethod, deviceModel, debtorName.trim(), parsedDebtAmount, saleQty);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar la venta. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSale = product.sellingPrice * saleQty;
  const profit = (product.sellingPrice - product.costPrice) * saleQty;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100"
            id="confirm-sale-dialog"
          >
            {/* Header */}
            <div className="bg-slate-800/60 px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Registrar Venta</h2>
                  <p className="text-xs text-slate-400">Transacción atómica de stock y caja</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contents */}
            <div className="p-6 space-y-4">
              {/* Product Info Summary */}
              <div className="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Producto:</span>
                  <span className="font-semibold text-white text-right line-clamp-1">{product.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Marca:</span>
                  <span className="text-slate-200">{product.brand || 'General'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Stock Actual:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {currentAvailableStock} unidades
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Precio Unitario:</span>
                  <span className="font-bold text-white font-mono">
                    ${product.sellingPrice.toLocaleString('es-CL')}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/25 text-rose-300 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Quantity input with stepper */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Cantidad a Vender
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStepQty(-1)}
                      disabled={saleQty <= 1}
                      className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl flex items-center justify-center font-bold text-lg disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={currentAvailableStock}
                      value={saleQty}
                      onChange={handleQtyChange}
                      className="flex-1 h-10 px-3 bg-slate-950/80 border border-white/10 rounded-xl text-center font-mono font-bold text-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepQty(1)}
                      disabled={saleQty >= currentAvailableStock}
                      className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl flex items-center justify-center font-bold text-lg disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  {saleQty > currentAvailableStock && (
                    <p className="text-[11px] text-rose-400 mt-1 font-medium">
                      Excede el stock disponible ({currentAvailableStock}).
                    </p>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Efectivo', 'Transferencia', 'Crédito'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-2 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                          paymentMethod === method
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold shadow-sm'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional Debtor Fields */}
                {paymentMethod === 'Crédito' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3"
                  >
                    <div>
                      <label className="block text-[11px] font-medium text-amber-300 mb-1">
                        Nombre del Cliente Deudor <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={debtorName}
                        onChange={(e) => setDebtorName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="w-full px-3 py-1.5 bg-slate-950/80 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-amber-300 mb-1">
                        Monto de Deuda ($)
                      </label>
                      <input
                        type="number"
                        value={debtAmountInput}
                        onChange={(e) => setDebtAmountInput(e.target.value)}
                        placeholder={`Total venta: $${totalSale}`}
                        className="w-full px-3 py-1.5 bg-slate-950/80 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Financial Summary */}
                <div className="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Total a Cobrar:</span>
                    <span className="text-base font-bold text-white font-mono">
                      ${totalSale.toLocaleString('es-CL')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Ganancia Estimada:</span>
                    <span className="font-semibold text-emerald-400 font-mono">
                      +${profit.toLocaleString('es-CL')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 text-[11px] pt-1 border-t border-white/5">
                    <span>Operador:</span>
                    <span className="text-slate-300 font-medium">{operatorName}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || saleQty > currentAvailableStock || currentAvailableStock <= 0}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Registrando...' : 'Confirmar Venta'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

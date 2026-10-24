import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, DollarSign, Smartphone, ShieldCheck, ShoppingCart, HelpCircle } from 'lucide-react';
import { Product } from '../types';

interface ConfirmSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  quantity: number;
  onConfirm: (paymentMethod: 'Efectivo' | 'Transferencia' | 'Crédito', deviceModel: string, debtorName?: string, debtAmount?: number) => Promise<void>;
}

// Utility to auto-detect device model based on user agent
function detectDeviceModel(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) {
    const matches = ua.match(/Android\s+([^\s;]+(\s+[^\s;]+)*)/);
    const modelMatch = ua.match(/;\s+([^;]+)\s+Build\//);
    if (modelMatch && modelMatch[1]) {
      return modelMatch[1].trim();
    }
    return matches ? `Android (${matches[1]})` : "Android Device";
  }
  if (/iPhone/i.test(ua)) {
    return "iPhone";
  }
  if (/iPad/i.test(ua)) {
    return "iPad";
  }
  if (/Macintosh/i.test(ua)) {
    return "MacBook / iMac";
  }
  if (/Windows/i.test(ua)) {
    return "Windows PC";
  }
  if (/Linux/i.test(ua)) {
    return "Linux PC";
  }
  return "Celular Corporativo";
}

export default function ConfirmSaleModal({
  isOpen,
  onClose,
  product,
  quantity = 1,
  onConfirm,
}: ConfirmSaleModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia' | 'Crédito'>('Efectivo');
  const [debtorName, setDebtorName] = useState('');
  const [debtAmountInput, setDebtAmountInput] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && product) {
      setDeviceModel(detectDeviceModel());
      setPaymentMethod('Efectivo');
      setDebtorName('');
      setDebtAmountInput((product.sellingPrice * quantity).toString());
      setError('');
    }
  }, [isOpen, product, quantity]);

  if (!product) return null;

  const handleConfirm = async () => {
    if (paymentMethod === 'Crédito') {
      if (!debtorName.trim()) {
        setError('Por favor, ingresa el nombre del cliente deudor.');
        return;
      }
      const parsedDebt = parseFloat(debtAmountInput);
      if (isNaN(parsedDebt) || parsedDebt < 0) {
        setError('Por favor, ingresa un monto que debe válido (mayor o igual a 0).');
        return;
      }
    }
    try {
      setIsSubmitting(true);
      setError('');
      
      const parsedDebt = paymentMethod === 'Crédito' ? parseFloat(debtAmountInput) : undefined;
      
      await onConfirm(
        paymentMethod, 
        deviceModel || 'Celular Genérico', 
        paymentMethod === 'Crédito' ? debtorName.trim() : undefined,
        parsedDebt
      );
      onClose();
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al registrar la venta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSale = product.sellingPrice * quantity;
  const profit = (product.sellingPrice - product.costPrice) * quantity;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative text-slate-100"
            id="confirm-sale-dialog"
          >
            {/* Background ambient glow */}
            <div className="absolute top-[-30%] left-[-20%] w-[350px] h-[350px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="bg-slate-800/40 px-6 py-4.5 flex items-center justify-between border-b border-white/10 relative z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="p-2 bg-emerald-500/15 text-emerald-400 rounded-lg">
                  <ShoppingCart className="w-5 h-5" />
                </span>
                Confirmar Venta
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contents */}
            <div className="p-6 space-y-5 relative z-10">
              {/* Product Info Summary */}
              <div className="p-4.5 bg-white/5 rounded-xl border border-white/10 space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">Detalles de Venta</span>
                <h3 className="text-base font-bold text-white leading-snug">{product.name}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Marca: <strong className="text-slate-200">{product.brand}</strong></span>
                  <span className="h-3 w-px bg-white/10" />
                  <span>Cant: <strong className="text-slate-200">{quantity} u</strong></span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-white/5 mt-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-semibold">Total a Cobrar</span>
                    <span className="text-lg font-black text-white font-mono">${totalSale.toLocaleString('es-CL')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-semibold">Ganancia Neta</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">${profit.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector (Efectivo vs. Transferencia vs. Crédito) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Método de Pago <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Efectivo')}
                    className={`px-2 py-3 rounded-xl border transition-all cursor-pointer font-bold text-xs flex flex-col items-center justify-center gap-1.5 ${
                      paymentMethod === 'Efectivo'
                        ? 'bg-emerald-600/15 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/5'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
                    }`}
                  >
                    <span className="text-lg">💵</span>
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Transferencia')}
                    className={`px-2 py-3 rounded-xl border transition-all cursor-pointer font-bold text-xs flex flex-col items-center justify-center gap-1.5 ${
                      paymentMethod === 'Transferencia'
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/5'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
                    }`}
                  >
                    <span className="text-lg">🏦</span>
                    <span>Transf.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Crédito')}
                    className={`px-2 py-3 rounded-xl border transition-all cursor-pointer font-bold text-xs flex flex-col items-center justify-center gap-1.5 ${
                      paymentMethod === 'Crédito'
                        ? 'bg-amber-600/15 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/5'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
                    }`}
                  >
                    <span className="text-lg">📋</span>
                    <span>Crédito</span>
                  </button>
                </div>
              </div>

              {/* Debtor Client Name and Amount Input */}
              {paymentMethod === 'Crédito' && (
                <div className="space-y-3 p-3.5 bg-amber-500/5 rounded-xl border border-amber-500/20">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      Cliente Deudor <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={debtorName}
                      onChange={(e) => {
                        setDebtorName(e.target.value);
                        if (e.target.value.trim()) setError('');
                      }}
                      placeholder="Nombre del cliente"
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-500/20 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all outline-none bg-slate-950 text-white placeholder-slate-500 text-sm font-semibold"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      Monto que Debe ($) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm font-mono">$</span>
                      <input
                        type="number"
                        min="0"
                        value={debtAmountInput}
                        onChange={(e) => {
                          setDebtAmountInput(e.target.value);
                          if (e.target.value.trim()) setError('');
                        }}
                        placeholder="Monto adeudado"
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-amber-500/20 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all outline-none bg-slate-950 text-white placeholder-slate-500 text-sm font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-amber-300/80 font-medium">
                    Se registrará esta venta con una deuda inicial de ${parseFloat(debtAmountInput || '0').toLocaleString('es-CL')}.
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl font-semibold">
                  {error}
                </div>
              )}

              {/* Device identification metadata */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" /> Celular Registrador <span className="text-slate-500">(Metadato)</span>
                </label>
                <input
                  type="text"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  placeholder="Ej. Samsung Galaxy S24 Ultra"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all outline-none bg-white/5 focus:bg-white/10 text-white placeholder-slate-500 text-sm font-semibold"
                  required
                />
                <p className="text-[10px] text-slate-500 font-medium px-1 leading-normal flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Se guardará como registro histórico en la colección de ventas.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-white/15 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4.5 py-2 hover:bg-white/5 text-slate-300 border border-white/5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    'Confirmar Venta'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

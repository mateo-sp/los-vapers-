import { motion } from 'motion/react';
import React, { useState } from 'react';
import { Edit2, Trash2, TrendingUp, AlertTriangle, CheckCircle, Package, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { Product } from '../types';
import ConfirmModal from './ConfirmModal';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onQuickAdjust: (product: Product, amount: number, type: 'sale' | 'restock') => Promise<void>;
  categoryThresholds?: Record<string, number>;
}

export default function ProductCard({
  product,
  onEdit,
  onDelete,
  onQuickAdjust,
  categoryThresholds = {},
}: ProductCardProps) {
  const [customAmount, setCustomAmount] = useState<number | ''>('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [customType, setCustomType] = useState<'sale' | 'restock'>('sale');
  const [isConfirmNegativeOpen, setIsConfirmNegativeOpen] = useState(false);

  const { name, brand, category, stock, minStock, useCategoryThreshold, costPrice, sellingPrice, sku, notes } = product;
  const isOutOfStock = stock === 0;
  
  // Calculate effective threshold based on configurable criteria
  const effectiveThreshold = useCategoryThreshold && categoryThresholds[category] !== undefined
    ? categoryThresholds[category]
    : minStock;
    
  const isLowStock = stock > 0 && stock <= effectiveThreshold;

  // Calculate profit margin
  const profit = sellingPrice - costPrice;
  const marginPercentage = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  // Stock status text & color config
  const getStatusConfig = () => {
    if (isOutOfStock) {
      return {
        text: 'Agotado',
        bg: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
        badge: 'bg-rose-500',
        icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
      };
    }
    if (isLowStock) {
      return {
        text: `Bajo Stock (${stock}/${effectiveThreshold})`,
        bg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        badge: 'bg-amber-500',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      };
    }
    return {
      text: `Disponible (${stock})`,
      bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      badge: 'bg-emerald-500',
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    };
  };

  const statusConfig = getStatusConfig();

  // Handle custom stock logging form submission
  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customAmount === '' || customAmount <= 0) return;
    
    // For sale, ensure we have enough stock, or warn them
    if (customType === 'sale' && customAmount > stock) {
      setIsConfirmNegativeOpen(true);
      return;
    }

    await executeAdjust();
  };

  const executeAdjust = async () => {
    if (customAmount === '' || customAmount <= 0) return;
    const actualAmount = customType === 'sale' ? -customAmount : customAmount;
    await onQuickAdjust(product, actualAmount, customType);
    setCustomAmount('');
    setIsAdjusting(false);
  };

  return (
    <motion.div
      layout
      className={`bg-white/5 backdrop-blur-lg border ${
        isOutOfStock 
          ? 'border-rose-500/20 bg-rose-950/10' 
          : isLowStock 
            ? 'border-amber-500/20 bg-amber-950/10' 
            : 'border-white/10 shadow-lg'
      } p-5 flex flex-col justify-between hover:scale-[1.01] hover:border-white/20 transition-all h-full relative overflow-hidden`}
    >
      {/* Accent corner bar for low/out-of-stock elements */}
      {isOutOfStock && <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />}
      {isLowStock && <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />}

      <div>
        {/* Header line */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2.5 py-1 rounded-md uppercase tracking-wider font-mono">
              {brand}
            </span>
            <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-md uppercase tracking-wide">
              {category}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(product)}
              className="text-slate-400 hover:text-indigo-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Editar producto"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(product)}
              className="text-slate-400 hover:text-rose-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Eliminar producto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Product Title */}
        <h4 className="text-base font-semibold text-white mt-3.5 line-clamp-2 leading-snug tracking-tight" title={name}>
          {name}
        </h4>

        {/* SKU indicator */}
        <p className="text-xs text-slate-400 font-mono mt-1 px-1 flex items-center gap-1.5">
          <span>SKU:</span>
          <span className="font-semibold text-slate-200 select-all">{sku}</span>
        </p>

        {/* Status indicator bar */}
        <div className={`mt-3.5 border text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-2 ${statusConfig.bg}`}>
          {statusConfig.icon}
          <span>{statusConfig.text}</span>
        </div>

        {/* Price specs layout */}
        <div className="grid grid-cols-2 gap-2 mt-4 bg-white/5 p-2.5 rounded-xl border border-white/5">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Precio Costo</span>
            <span className="text-sm font-semibold text-slate-300 font-mono">
              ${costPrice.toLocaleString('es-CL')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Precio Venta</span>
            <span className="text-sm font-bold text-white font-mono">
              ${sellingPrice.toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        {/* Profit margin tag */}
        <div className="mt-3 flex items-center justify-between text-xs px-1">
          <span className="text-slate-400 font-medium">Margen estimado:</span>
          <span className="font-semibold text-emerald-400 flex items-center gap-1 font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            ${profit.toLocaleString('es-CL')} ({marginPercentage.toFixed(0)}%)
          </span>
        </div>

        {/* Optional notes */}
        {notes && (
          <p className="text-[11px] text-slate-400 italic mt-3 bg-white/5 p-2.5 rounded-lg border border-dashed border-white/10 line-clamp-2">
            "{notes}"
          </p>
        )}
      </div>

      {/* Speed Action panel */}
      <div className="mt-5 space-y-2 pt-3 border-t border-white/5">
        {!isAdjusting ? (
          <div className="flex gap-2">
            {/* Quick Sell -1 */}
            <button
              onClick={() => onQuickAdjust(product, -1, 'sale')}
              disabled={stock === 0}
              className="flex-1 text-slate-300 hover:text-white bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-slate-300 py-2 rounded-xl text-xs font-semibold select-none flex items-center justify-center gap-1 border border-white/10 transition-all cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> Vender -1
            </button>

            {/* Quick Restock +1 */}
            <button
              onClick={() => onQuickAdjust(product, 1, 'restock')}
              className="flex-1 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 py-2 rounded-xl text-xs font-semibold select-none flex items-center justify-center gap-1 border border-indigo-500/20 transition-all cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> Surtir +1
            </button>

            {/* More Adjustments Toggle */}
            <button
              onClick={() => setIsAdjusting(true)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer"
              title="Ajuste de cantidad específico"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className="space-y-2 bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 uppercase">
                {customType === 'sale' ? 'Registrar Venta' : 'Registrar Entrada'}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCustomType('sale')}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all ${
                    customType === 'sale' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400'
                  }`}
                >
                  VENTA
                </button>
                <button
                  type="button"
                  onClick={() => setCustomType('restock')}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all ${
                    customType === 'restock' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400'
                  }`}
                >
                  SUTIR
                </button>
              </div>
            </div>

            <div className="flex gap-1.5">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Cant"
                min="1"
                required
                className="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-center outline-none focus:ring-1 focus:ring-indigo-500 text-white"
              />
              <button
                type="submit"
                className={`flex-1 text-white py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                  customType === 'sale' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                } transition-colors`}
              >
                Loguear
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdjusting(false);
                  setCustomAmount('');
                }}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
              >
                X
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmNegativeOpen}
        onClose={() => setIsConfirmNegativeOpen(false)}
        onConfirm={executeAdjust}
        title="¿Forzar stock negativo?"
        message={`Estás vendiendo ${customAmount} unidades de "${name}" pero solo quedan ${stock} en stock. ¿Deseas forzar stock negativo?`}
        confirmText="Sí, Forzar"
        cancelText="No, Cancelar"
        type="warning"
      />
    </motion.div>
  );
}

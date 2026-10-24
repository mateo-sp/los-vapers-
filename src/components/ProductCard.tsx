import React from 'react';
import { motion } from 'motion/react';
import { Edit2, Trash2, TrendingUp, PackagePlus, ArrowDown, Settings } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onQuickSale: (product: Product) => void;
  onQuickRestock: (product: Product) => void;
  onCustomAdjust: (product: Product) => void;
}

export default function ProductCard({
  product,
  onEdit,
  onDelete,
  onQuickSale,
  onQuickRestock,
  onCustomAdjust,
}: ProductCardProps) {
  const { name, brand, category, stock, costPrice, sellingPrice, sku, notes } = product;
  const isOutOfStock = stock <= 0;

  // Calculate profit margin
  const profit = sellingPrice - costPrice;
  const marginPercentage = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return (
    <motion.div
      layout
      className={`bg-white/5 backdrop-blur-lg border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all shadow-lg hover:shadow-indigo-500/5 ${
        isOutOfStock 
          ? 'border-rose-500/30 bg-rose-500/5' 
          : 'border-white/10 hover:border-white/25'
      }`}
    >
      <div>
        {/* Header line */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider font-mono">
              {brand || 'General'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">
              {category}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Editar datos del producto"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(product)}
              className="text-slate-400 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              title="Mover a papelera de reciclaje"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Product Title */}
        <h4 className="text-sm sm:text-base font-semibold text-white mt-2 line-clamp-2 leading-snug">
          {name}
        </h4>

        {/* SKU & Stock Badge */}
        <div className="flex items-center justify-between mt-2.5 text-xs">
          {sku ? (
            <span className="font-mono text-slate-500 text-[11px]">SKU: {sku}</span>
          ) : (
            <span className="text-slate-500 text-[11px]">Sin SKU</span>
          )}

          {isOutOfStock ? (
            <span className="text-[11px] font-medium text-rose-400 bg-rose-500/15 border border-rose-500/25 px-2 py-0.5 rounded-lg">
              Agotado
            </span>
          ) : (
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-lg">
              Stock: <strong className="font-mono">{stock}</strong> u
            </span>
          )}
        </div>

        {/* Price & Cost Grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 bg-slate-900/60 rounded-xl border border-white/5 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Costo</span>
            <span className="font-semibold text-slate-300 font-mono tabular-nums">
              ${costPrice.toLocaleString('es-CL')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Venta</span>
            <span className="font-bold text-white font-mono tabular-nums">
              ${sellingPrice.toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        {/* Profit margin */}
        <div className="mt-2.5 flex items-center justify-between text-xs px-1 text-slate-400">
          <span>Ganancia estimada:</span>
          <span className="font-semibold text-emerald-400 font-mono tabular-nums flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            +${profit.toLocaleString('es-CL')} ({marginPercentage.toFixed(0)}%)
          </span>
        </div>

        {/* Notes */}
        {notes && (
          <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/40 border border-white/5 p-2 rounded-lg line-clamp-2">
            {notes}
          </p>
        )}
      </div>

      {/* Speed Action panel */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
        {/* Quick Sale button */}
        <button
          type="button"
          onClick={() => onQuickSale(product)}
          disabled={isOutOfStock}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md ${
            isOutOfStock
              ? 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95 cursor-pointer'
          }`}
          title={isOutOfStock ? 'No hay stock disponible' : 'Registrar venta de este producto'}
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Vender</span>
        </button>

        {/* Restock button */}
        <button
          type="button"
          onClick={() => onQuickRestock(product)}
          className="flex-1 py-2 px-2.5 bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          title="Registrar ingreso de mercadería"
        >
          <PackagePlus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Surtir</span>
        </button>

        {/* Custom Adjust Settings Toggle */}
        <button
          type="button"
          onClick={() => onCustomAdjust(product)}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer"
          title="Ajuste de inventario con motivo"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

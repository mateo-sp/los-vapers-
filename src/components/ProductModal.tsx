import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Tag, DollarSign, Layers } from 'lucide-react';
import { Product, ProductInput } from '../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: ProductInput) => Promise<void>;
  product?: Product | null; // If editing
  categoryThresholds?: Record<string, number>;
  brands?: string[];
}

export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  product,
  brands = [],
}: ProductModalProps) {
  const isEditing = !!product;
  const [formData, setFormData] = useState<ProductInput>({
    name: '',
    brand: '',
    category: 'Otros',
    stock: 0,
    minStock: 5,
    useCategoryThreshold: false,
    costPrice: 0,
    sellingPrice: 0,
    sku: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bypassPriceWarning, setBypassPriceWarning] = useState(false);

  // Load product data when editing
  useEffect(() => {
    setBypassPriceWarning(false);
    if (isOpen && product) {
      setFormData({
        name: product.name,
        brand: product.brand,
        category: product.category || 'Otros',
        stock: product.stock,
        minStock: product.minStock || 5,
        useCategoryThreshold: !!product.useCategoryThreshold,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        sku: product.sku || '',
        notes: product.notes || '',
      });
    } else {
      setFormData({
        name: '',
        brand: '',
        category: 'Otros',
        stock: 0,
        minStock: 5,
        useCategoryThreshold: false,
        costPrice: 0,
        sellingPrice: 0,
        sku: '',
        notes: '',
      });
    }
    setError('');
  }, [product, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // Parse numeric inputs correctly
    const numericFields = ['stock', 'costPrice', 'sellingPrice'];
    const parsedValue = numericFields.includes(name) 
      ? value === '' ? 0 : Math.max(0, parseFloat(value) || 0)
      : value;

    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!formData.name.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!formData.brand.trim()) {
      setError('La marca es obligatoria.');
      return;
    }

    const finalData = { ...formData };
    
    // Auto-generate SKU if empty
    if (!finalData.sku) {
      const brandCode = (finalData.brand || 'GEN').substring(0, 3).toUpperCase().padEnd(3, 'X');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      finalData.sku = `SKU-${brandCode}-OTH-${randomNum}`;
    }

    if (finalData.sellingPrice < finalData.costPrice && !bypassPriceWarning) {
      setError('Advertencia: El precio de venta es menor que el precio de compra. Para guardar de todas formas, marca la casilla correspondiente abajo.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(finalData);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Hubo un error al guardar el producto. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
          >
            {/* Ambient background glow inside the modal */}
            <div className="absolute top-[-30%] left-[-20%] w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-30%] right-[-20%] w-[350px] h-[350px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="bg-slate-800/40 px-6 py-4.5 flex items-center justify-between border-b border-white/10 relative z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="p-2 bg-indigo-500/15 text-indigo-300 rounded-lg">
                  <Package className="w-5 h-5" />
                </span>
                {isEditing ? 'Editar Producto' : 'Agregar Producto'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 relative z-10" id="product-form">
              {error && (
                <div className="p-3 bg-rose-500/15 text-rose-300 rounded-xl text-xs font-semibold border border-rose-500/25">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> Nombre del producto <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej. Smart TV 55\"
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all outline-none bg-white/5 focus:bg-white/10 text-white placeholder-slate-500 text-sm"
                    required
                  />
                </div>

                {/* Brand Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" /> Marca <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="Escribe o selecciona marca..."
                    list="product-brands-datalist"
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all outline-none bg-white/5 focus:bg-white/10 text-white placeholder-slate-500 text-sm"
                    required
                    autoComplete="off"
                  />
                  <datalist id="product-brands-datalist">
                    {brands.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                {/* Selling Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Precio <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-medium text-sm">$</span>
                    <input
                      type="number"
                      name="sellingPrice"
                      value={formData.sellingPrice || ''}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      step="any"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-white/10 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all outline-none bg-white/5 focus:bg-white/10 text-white placeholder-slate-500 text-sm"
                      required
                    />
                  </div>
                </div>

                 {/* Purchase Price (Cost Price) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-400" /> Precio de Compra <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-medium text-sm">$</span>
                    <input
                      type="number"
                      name="costPrice"
                      value={formData.costPrice || ''}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      step="any"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-white/10 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all outline-none bg-white/5 focus:bg-white/10 text-white placeholder-slate-500 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Warning checkbox if Selling Price < Cost Price */}
                {formData.sellingPrice < formData.costPrice && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="bypass-price-warning-checkbox"
                      checked={bypassPriceWarning}
                      onChange={(e) => setBypassPriceWarning(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-slate-950 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <label htmlFor="bypass-price-warning-checkbox" className="text-xs text-amber-300 font-semibold cursor-pointer select-none leading-relaxed">
                      Confirmar precio de venta menor que el de compra/costo.
                    </label>
                  </div>
                )}

                {/* Initial Quantity (Stock) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-400" /> Cantidad <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    disabled={isEditing}
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all outline-none bg-white/5 disabled:bg-white/5 disabled:border-white/5 text-white disabled:text-slate-500 text-sm"
                    required
                  />
                  {isEditing && (
                    <p className="text-[10px] text-slate-400 font-medium px-1">
                      *La cantidad se edita en la lista mediante las acciones de venta o restock.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-white/15 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4.5 py-2 hover:bg-white/5 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-slate-400 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

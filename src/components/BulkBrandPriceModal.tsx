import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Tag,
  Percent,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { Product } from '../types';
import { updatePricesByBrand, BulkBrandPriceUpdateItem } from '../services/dbService';

interface BulkBrandPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  brands: string[];
  initialBrand?: string;
  operatorEmail?: string;
  operatorName?: string;
  onSuccess: (message: string) => void;
}

export default function BulkBrandPriceModal({
  isOpen,
  onClose,
  products,
  brands,
  initialBrand = '',
  operatorEmail = '',
  operatorName = '',
  onSuccess,
}: BulkBrandPriceModalProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [mode, setMode] = useState<'fixed' | 'percent' | 'offset'>('fixed');
  
  // Fixed mode fields
  const [fixedSellingPrice, setFixedSellingPrice] = useState<string>('');
  const [updateCostInFixed, setUpdateCostInFixed] = useState(false);
  const [fixedCostPrice, setFixedCostPrice] = useState<string>('');

  // Percent mode fields
  const [percentValue, setPercentValue] = useState<number>(10);
  const [percentTarget, setPercentTarget] = useState<'selling_only' | 'both' | 'cost_only'>('selling_only');
  const [roundingRule, setRoundingRule] = useState<'500' | '1000' | 'none'>('500');

  // Fixed offset mode fields
  const [offsetValue, setOffsetValue] = useState<number>(2000);
  const [offsetTarget, setOffsetTarget] = useState<'selling_only' | 'both'>('selling_only');

  // Selection
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize brand and selection on open
  useEffect(() => {
    if (isOpen) {
      const defaultBrand = initialBrand && brands.includes(initialBrand) 
        ? initialBrand 
        : (brands[0] || '');
      setSelectedBrand(defaultBrand);
      setErrorMsg(null);
    }
  }, [isOpen, initialBrand, brands]);

  // Products belonging to the selected brand
  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return products.filter((p) => p.brand === selectedBrand && !p.isDeleted);
  }, [products, selectedBrand]);

  // Pre-select all products when brand changes
  useEffect(() => {
    if (brandProducts.length > 0) {
      setSelectedItemIds(new Set(brandProducts.map((p) => p.id)));
      // Set default fixed price to the first product's selling price if empty
      const firstSelling = brandProducts[0].sellingPrice;
      const firstCost = brandProducts[0].costPrice;
      setFixedSellingPrice(String(firstSelling || ''));
      setFixedCostPrice(String(firstCost || ''));
    } else {
      setSelectedItemIds(new Set());
    }
  }, [selectedBrand, brandProducts.length]);

  // Rounding helper
  const applyRounding = (val: number, rule: '500' | '1000' | 'none') => {
    if (rule === 'none') return Math.max(0, Math.round(val));
    const step = rule === '500' ? 500 : 1000;
    return Math.max(0, Math.round(val / step) * step);
  };

  // Compute calculated preview items
  const previewItems: BulkBrandPriceUpdateItem[] = useMemo(() => {
    return brandProducts.map((p) => {
      let newSelling = p.sellingPrice;
      let newCost = p.costPrice;

      if (mode === 'fixed') {
        const parsedSelling = parseFloat(fixedSellingPrice);
        if (!isNaN(parsedSelling) && parsedSelling >= 0) {
          newSelling = parsedSelling;
        }
        if (updateCostInFixed) {
          const parsedCost = parseFloat(fixedCostPrice);
          if (!isNaN(parsedCost) && parsedCost >= 0) {
            newCost = parsedCost;
          }
        }
      } else if (mode === 'percent') {
        const factor = 1 + (percentValue / 100);
        if (percentTarget === 'selling_only' || percentTarget === 'both') {
          newSelling = applyRounding(p.sellingPrice * factor, roundingRule);
        }
        if (percentTarget === 'cost_only' || percentTarget === 'both') {
          newCost = applyRounding(p.costPrice * factor, roundingRule);
        }
      } else if (mode === 'offset') {
        if (offsetTarget === 'selling_only' || offsetTarget === 'both') {
          newSelling = Math.max(0, p.sellingPrice + offsetValue);
        }
        if (offsetTarget === 'both') {
          newCost = Math.max(0, p.costPrice + offsetValue);
        }
      }

      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        oldSellingPrice: p.sellingPrice,
        newSellingPrice: newSelling,
        oldCostPrice: p.costPrice,
        newCostPrice: newCost,
      };
    });
  }, [
    brandProducts,
    mode,
    fixedSellingPrice,
    updateCostInFixed,
    fixedCostPrice,
    percentValue,
    percentTarget,
    roundingRule,
    offsetValue,
    offsetTarget,
  ]);

  const toggleSelectAll = () => {
    if (selectedItemIds.size === brandProducts.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(brandProducts.map((p) => p.id)));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedCount = selectedItemIds.size;
  const itemsToUpdate = previewItems.filter((item) => selectedItemIds.has(item.id));

  const handleApply = async () => {
    if (itemsToUpdate.length === 0) {
      setErrorMsg('Selecciona al menos un producto para actualizar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    let reasonDetail = '';
    if (mode === 'fixed') {
      reasonDetail = `Nuevo precio fijo de venta: $${Number(fixedSellingPrice).toLocaleString('es-CL')}`;
      if (updateCostInFixed) {
        reasonDetail += ` | Costo: $${Number(fixedCostPrice).toLocaleString('es-CL')}`;
      }
    } else if (mode === 'percent') {
      reasonDetail = `Ajuste porcentual de ${percentValue > 0 ? '+' : ''}${percentValue}% (${percentTarget})`;
    } else {
      reasonDetail = `Ajuste fijo de ${offsetValue > 0 ? '+' : ''}$${offsetValue.toLocaleString('es-CL')}`;
    }

    try {
      const result = await updatePricesByBrand(
        itemsToUpdate,
        selectedBrand,
        `Cambio de precios marca "${selectedBrand}": ${reasonDetail}`,
        operatorEmail,
        operatorName
      );

      onSuccess(`¡Precios actualizados! Se modificaron ${result.updatedCount} productos de la marca "${selectedBrand}".`);
      onClose();
    } catch (err: any) {
      console.error('Error al actualizar precios por marca:', err);
      setErrorMsg(err?.message || 'Error al guardar los cambios en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Cambiar Precios por Marca
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/30">
                    Ajuste Masivo
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Modifica rápidamente los precios de todos o varios productos de una marca
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-5 text-sm">
            {errorMsg && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Select Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-400" />
                  1. Selecciona la Marca
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {brands.length === 0 && <option value="">No hay marcas cargadas</option>}
                  {brands.map((b) => {
                    const count = products.filter((p) => p.brand === b && !p.isDeleted).length;
                    return (
                      <option key={b} value={b}>
                        {b} ({count} productos)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-300">
                <span>Productos en marca:</span>
                <span className="font-bold text-white px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md">
                  {brandProducts.length}
                </span>
              </div>
            </div>

            {/* Step 2: Mode Selector */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                2. Método de Cambio de Precio
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('fixed')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    mode === 'fixed'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Precio Fijo</span>
                  <span className="text-[10px] font-normal text-slate-400">Ej: $28.000</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('percent')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    mode === 'percent'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>Porcentaje %</span>
                  <span className="text-[10px] font-normal text-slate-400">Ej: +15%</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('offset')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    mode === 'offset'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sumar / Restar $</span>
                  <span className="text-[10px] font-normal text-slate-400">Ej: +$2.000</span>
                </button>
              </div>

              {/* Mode-specific configuration inputs */}
              <div className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl space-y-4">
                {mode === 'fixed' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Nuevo Precio de Venta ($)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={fixedSellingPrice}
                            onChange={(e) => setFixedSellingPrice(e.target.value)}
                            placeholder="Ej: 28000"
                            className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-300">
                            Precio de Costo ($)
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={updateCostInFixed}
                              onChange={(e) => setUpdateCostInFixed(e.target.checked)}
                              className="rounded border-white/10 text-indigo-600 focus:ring-0"
                            />
                            <span>Actualizar costo también</span>
                          </label>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            disabled={!updateCostInFixed}
                            value={fixedCostPrice}
                            onChange={(e) => setFixedCostPrice(e.target.value)}
                            placeholder="Ej: 18000"
                            className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {mode === 'percent' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400 mr-1">Preajustes rápidos:</span>
                      {[-10, -5, 5, 10, 15, 20, 25, 30].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPercentValue(val)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            percentValue === val
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {val > 0 ? `+${val}%` : `${val}%`}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Porcentaje (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            value={percentValue}
                            onChange={(e) => setPercentValue(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Aplicar cambio a
                        </label>
                        <select
                          value={percentTarget}
                          onChange={(e) => setPercentTarget(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none"
                        >
                          <option value="selling_only">Solo Precio de Venta</option>
                          <option value="both">Venta y Costo</option>
                          <option value="cost_only">Solo Precio de Costo</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Regla de Redondeo
                        </label>
                        <select
                          value={roundingRule}
                          onChange={(e) => setRoundingRule(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none"
                        >
                          <option value="500">Redondear a $500 (Recomendado)</option>
                          <option value="1000">Redondear a $1.000</option>
                          <option value="none">Sin redondeo exacto</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {mode === 'offset' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Monto a sumar o restar ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                        <input
                          type="number"
                          step="500"
                          value={offsetValue}
                          onChange={(e) => setOffsetValue(parseFloat(e.target.value) || 0)}
                          placeholder="Ej: 2000 o -1000"
                          className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Usa valores positivos (+2000) para aumentar o negativos (-1000) para rebajar
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Aplicar ajuste a
                      </label>
                      <select
                        value={offsetTarget}
                        onChange={(e) => setOffsetTarget(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none"
                      >
                        <option value="selling_only">Solo Precio de Venta</option>
                        <option value="both">Venta y Costo por igual</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Interactive Preview & Selection Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  3. Vista Previa de Productos ({selectedCount} seleccionados de {brandProducts.length})
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
                >
                  {selectedItemIds.size === brandProducts.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-950/80">
                <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                  {brandProducts.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No hay productos asociados a esta marca.
                    </div>
                  ) : (
                    previewItems.map((item) => {
                      const isSelected = selectedItemIds.has(item.id);
                      const diffSelling = item.newSellingPrice - item.oldSellingPrice;
                      const hasChangedSelling = diffSelling !== 0;

                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelected ? 'hover:bg-white/5' : 'opacity-40 hover:opacity-60 bg-slate-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by row onClick
                              className="rounded border-white/20 text-indigo-600 focus:ring-0 shrink-0 cursor-pointer"
                            />
                            <div className="truncate">
                              <p className="font-semibold text-white truncate">{item.name}</p>
                              <p className="text-[11px] text-slate-400">
                                Costo: ${item.newCostPrice.toLocaleString('es-CL')}
                                {item.newCostPrice !== item.oldCostPrice && (
                                  <span className="text-amber-400 ml-1">
                                    (antes ${item.oldCostPrice.toLocaleString('es-CL')})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-slate-400 line-through text-[11px]">
                                ${item.oldSellingPrice.toLocaleString('es-CL')}
                              </span>
                              <span className="font-bold text-white text-sm">
                                ${item.newSellingPrice.toLocaleString('es-CL')}
                              </span>
                            </div>

                            {hasChangedSelling && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  diffSelling > 0
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {diffSelling > 0 ? `+${diffSelling.toLocaleString('es-CL')}` : `${diffSelling.toLocaleString('es-CL')}`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 bg-slate-800/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting || selectedCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Actualizando precios en base de datos...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Aplicar cambio a {selectedCount} productos</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Layers, Save, Sliders, Info, BellRing } from 'lucide-react';
import { updateCategoryThreshold } from '../services/dbService';

interface CategorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  categoryThresholds: Record<string, number>;
}

export default function CategorySettingsModal({
  isOpen,
  onClose,
  categories,
  categoryThresholds,
}: CategorySettingsModalProps) {
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Sychronize thresholds state when opening
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      categories.forEach((cat) => {
        initial[cat] = categoryThresholds[cat] !== undefined ? categoryThresholds[cat] : 5;
      });
      setThresholds(initial);
      setSuccessMsg('');
    }
  }, [isOpen, categories, categoryThresholds]);

  const handleValueChange = (category: string, value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setThresholds((prev) => ({
      ...prev,
      [category]: num,
    }));
  };

  const setQuickDefault = (category: string, value: number) => {
    setThresholds((prev) => ({
      ...prev,
      [category]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');

    try {
      // Save all category configurations sequentially or in Parallel
      const promises = Object.entries(thresholds).map(([cat, val]) =>
        updateCategoryThreshold(cat, Number(val))
      );
      await Promise.all(promises);
      setSuccessMsg('¡Umbrales de categoría guardados correctamente!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop screen filter mask */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            id="category-settings-backdrop"
          />

          {/* Dialog Panel Context */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden relative z-10 text-slate-100 flex flex-col max-h-[90vh]"
            id="category-settings-dialog"
          >
            {/* Header Section */}
            <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-snug">Umbrales por Categoría</h3>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">Reglas de Alerta de Inventario</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Description */}
            <div className="p-4 bg-indigo-500/5 border-b border-indigo-500/10 text-xs text-indigo-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-semibold">
                Define el nivel mínimo general de existencias para alertar sobre stock crítico en cada categoría. Los artículos configurados con "Sincronizar con categoría" heredarán estos límites dinámicamente.
              </p>
            </div>

            {/* Scrollable list form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold text-center"
                >
                  {successMsg}
                </motion.div>
              )}

              <div className="space-y-4">
                {categories.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No se han registrado categorías aún en el catálogo de productos.
                  </p>
                ) : (
                  categories.map((category) => (
                    <div
                      key={category}
                      className="p-3 bg-white/5 border border-white/5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors hover:border-white/10"
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                          <Layers className="w-3.5 h-3.5 text-indigo-400" /> {category}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium leading-none">
                          Umbral de bajo stock activo de su grupo
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Quick preset chips */}
                        <div className="flex gap-1">
                          {[2, 5, 10].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setQuickDefault(category, val)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md font-mono border transition-all cursor-pointer ${
                                thresholds[category] === val
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/5'
                              }`}
                            >
                              {val}u
                            </button>
                          ))}
                        </div>

                        {/* Custom input */}
                        <input
                          type="number"
                          id={`threshold-${category}`}
                          value={thresholds[category] !== undefined ? thresholds[category] : ''}
                          onChange={(e) => handleValueChange(category, e.target.value)}
                          min="0"
                          className="w-20 px-3 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs font-bold font-mono text-center text-white outline-none focus:ring-2 focus:ring-indigo-500/35"
                          required
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </form>

            {/* Footer buttons and actions */}
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || categories.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Todo'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

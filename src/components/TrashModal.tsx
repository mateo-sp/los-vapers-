import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, RotateCcw, AlertOctagon, X, Search } from 'lucide-react';
import { Product } from '../types';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedProducts: Product[];
  onRestore: (product: Product) => Promise<void>;
  onPermanentDelete: (product: Product) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

export default function TrashModal({
  isOpen,
  onClose,
  deletedProducts,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}: TrashModalProps) {
  const [search, setSearch] = useState('');
  const [productToPurge, setProductToPurge] = useState<Product | null>(null);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const filtered = deletedProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand.toLowerCase().includes(search.toLowerCase())
  );

  const handleExecuteRestore = async (p: Product) => {
    try {
      setLoading(true);
      await onRestore(p);
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePurge = async () => {
    if (!productToPurge) return;
    try {
      setLoading(true);
      await onPermanentDelete(productToPurge);
      setProductToPurge(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteEmptyAll = async () => {
    try {
      setLoading(true);
      await onEmptyTrash();
      setConfirmEmptyAll(false);
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
          className="w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl border border-white/15 overflow-hidden flex flex-col max-h-[85vh] text-slate-100"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Papelera de Reciclaje</h3>
                <p className="text-xs text-slate-400">
                  {deletedProducts.length} producto(s) en la papelera
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subheader controls */}
          <div className="p-4 border-b border-white/10 bg-slate-950/40 flex flex-col sm:flex-row gap-2 justify-between items-center">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en papelera..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {deletedProducts.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmEmptyAll(true)}
                className="w-full sm:w-auto px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Vaciar Papelera</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <Trash2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p>La papelera está vacía.</p>
              </div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">({p.brand})</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                      <span>Stock previo: {p.stock} u</span>
                      <span>Precio: ${p.sellingPrice.toLocaleString('es-CL')}</span>
                      {p.deletedBy && <span>Eliminado por: {p.deletedBy}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleExecuteRestore(p)}
                      className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      title="Restaurar al catálogo activo"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Restaurar</span>
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setProductToPurge(p)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Confirm Empty All Inner Alert */}
          {confirmEmptyAll && (
            <div className="p-4 bg-rose-950/60 border-t border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-rose-300 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                <span>¿Estás seguro de vaciar toda la papelera? Esta acción no se puede deshacer.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmEmptyAll(false)}
                  className="px-3 py-1 bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleExecuteEmptyAll}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {loading ? 'Vaciando...' : 'Sí, Vaciar Todo'}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Single Purge Modal */}
          {productToPurge && (
            <div className="p-4 bg-rose-950/60 border-t border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-rose-300 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                <span>¿Eliminar definitivamente &quot;{productToPurge.name}&quot;?</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setProductToPurge(null)}
                  className="px-3 py-1 bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleExecutePurge}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {loading ? 'Eliminando...' : 'Eliminar Definitivo'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

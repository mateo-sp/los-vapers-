import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  ShoppingCart, 
  ClipboardList, 
  Sparkles, 
  MessageSquare,
  Trash2
} from 'lucide-react';
import { Product, Venta } from '../types';
import { generarMensajeStock, generarPedidoProveedor, clearAllProducts } from '../services/dbService';

interface FloatingToolsMenuProps {
  products: Product[];
  ventas: Venta[];
  onClearProducts?: () => void; // Allow triggering a complete reset in App UI
}

export default function FloatingToolsMenu({ products, ventas, onClearProducts }: FloatingToolsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'supplier' | 'stock'>('supplier');
  const [copiedSupplier, setCopiedSupplier] = useState(false);
  const [copiedStock, setCopiedStock] = useState(false);
  const [supplierText, setSupplierText] = useState('Cargando...');
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync supplier order text from Firestore on load/change
  useEffect(() => {
    if (isOpen) {
      setSupplierText('Cargando ventas y calculando pedido...');
      generarPedidoProveedor().then((text) => {
        setSupplierText(text);
      });
    }
  }, [isOpen, ventas]);

  // Synchronous Kotlin-replica stock catalogue generator
  const stockText = generarMensajeStock(products);

  const handleCopySupplier = async () => {
    try {
      await navigator.clipboard.writeText(supplierText);
      setCopiedSupplier(true);
      setTimeout(() => setCopiedSupplier(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyStock = async () => {
    try {
      await navigator.clipboard.writeText(stockText);
      setCopiedStock(true);
      setTimeout(() => setCopiedStock(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearDatabase = async () => {
    setIsClearingDb(true);
    try {
      await clearAllProducts();
      setShowClearConfirm(false);
      if (onClearProducts) onClearProducts();
    } catch (error) {
      console.error(error);
    } finally {
      setIsClearingDb(false);
    }
  };

  return (
    <>
      {/* Trigger floating button */}
      <div className="fixed bottom-6 left-6 z-40">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`h-14 w-14 rounded-full flex items-center justify-center shadow-2xl relative cursor-pointer border ${
            isOpen 
              ? 'bg-rose-600 border-rose-500 text-white' 
              : 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white'
          }`}
          title="Menú Copiar Reportes y Herramientas"
          id="messaging-tools-fab"
        >
          {isOpen ? (
            <X className="w-6 h-6 animate-spin-once" />
          ) : (
            <>
              <motion.div 
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
                className="absolute inset-0 rounded-full bg-indigo-500/30 blur-md -z-10"
              />
              <MessageCircle className="w-6 h-6 text-white" />
            </>
          )}
        </motion.button>
      </div>

      {/* Message Menu expand Sheet Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-30 overflow-hidden pointer-events-none">
            {/* Click backdrop to exit */}
            <div 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs pointer-events-auto" 
              onClick={() => setIsOpen(false)} 
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50, x: -50 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50, x: -50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute bottom-22 left-6 w-[90vw] max-w-md bg-slate-900 border border-white/11 p-5 shadow-2xl rounded-2xl pointer-events-auto flex flex-col space-y-4 max-h-[75vh]"
              id="messaging-action-sheet"
            >
              {/* Header */}
              <div className="flex justify-between items-start pb-2 border-b border-white/10">
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-1.5 font-sans">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Reportes Especiales
                  </h3>
                  <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider font-mono mt-0.5">ViewModel Porting Pack</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 bg-white/5 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveTab('supplier')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'supplier'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Pedido Proveedor
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('stock')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'stock'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Mensaje Stock
                </button>
              </div>

              {/* Tab Contents Preview area */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col space-y-2">
                {activeTab === 'supplier' ? (
                  <div className="flex flex-col flex-1 min-h-0 space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase px-1 font-mono">
                      <span>generarPedidoProveedor()</span>
                      <span className="text-indigo-400">Firestore Active</span>
                    </div>
                    <textarea
                      readOnly
                      value={supplierText}
                      className="w-full h-40 sm:h-48 p-3 bg-slate-950 border border-white/10 rounded-xl leading-relaxed text-[11px] text-slate-300 font-mono outline-none resize-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={handleCopySupplier}
                        className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                      >
                        {copiedSupplier ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSupplier ? '¡Pedido Copiado!' : 'Copiar Texto'}</span>
                      </button>

                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(supplierText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                        <ExternalLink className="w-3 h-3 text-indigo-200" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0 space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase px-1 font-mono">
                      <span>generarMensajeStock()</span>
                      <span className="text-emerald-400">Stock &gt; 0</span>
                    </div>
                    <textarea
                      readOnly
                      value={stockText || "(No hay productos cargados en el inventario actual)"}
                      className="w-full h-40 sm:h-48 p-3 bg-slate-950 border border-white/10 rounded-xl leading-relaxed text-[11px] text-emerald-450 font-mono outline-none resize-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyStock}
                        className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                      >
                        {copiedStock ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedStock ? '¡Stock Copiado!' : 'Copiar Texto'}</span>
                      </button>

                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(stockText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                        <ExternalLink className="w-3 h-3 text-emerald-250" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Database Clean section */}
              <div className="pt-2 border-t border-white/10 relative z-20">
                {showClearConfirm ? (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex flex-col space-y-2">
                    <p className="text-[11px] text-rose-300 font-semibold leading-normal">
                      ⚠️ ¿Estás seguro de que deseas vaciar por completo el inventario de la base de datos Firestore? Esto no se puede deshacer.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleClearDatabase}
                        disabled={isClearingDb}
                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-55 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isClearingDb ? 'Vaciando...' : 'Sí, Vaciar Todo'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full py-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-450 hover:text-rose-400 border border-rose-500/10 hover:border-rose-500/20 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar Base de Datos (Productos)</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Copy, Check, ExternalLink } from 'lucide-react';
import { Product } from '../types';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export default function WhatsAppModal({
  isOpen,
  onClose,
  products,
}: WhatsAppModalProps) {
  const [copied, setCopied] = useState(false);

  // Group stock products (> 0) sorted by Brand
  const stockProducts = products.filter((p) => p.stock > 0);

  const groupedByBrand: Record<string, Product[]> = {};
  stockProducts.forEach((p) => {
    const brandName = p.brand ? p.brand.trim() : 'Otras Marcas';
    if (!groupedByBrand[brandName]) {
      groupedByBrand[brandName] = [];
    }
    groupedByBrand[brandName].push(p);
  });

  const getCatalogText = () => {
    let text = `*📢 CATÁLOGO DE PRODUCTOS DISPONIBLES*\n`;
    text += `_Actualizado el ${new Date().toLocaleDateString('es-ES')}_\n\n`;
    text += `==================================\n\n`;

    const brands = Object.keys(groupedByBrand).sort();

    if (brands.length === 0) {
      text += `No hay productos con stock disponible en este momento.\n`;
    } else {
      brands.forEach((brand) => {
        text += `*📁 ${brand.toUpperCase()}*\n`;
        groupedByBrand[brand]
          .sort((a, b) => {
            const nameA = String(a?.name || '');
            const nameB = String(b?.name || '');
            return nameA.localeCompare(nameB);
          })
          .forEach((prod) => {
            const prodName = prod?.name || 'Producto sin nombre';
            const price = typeof prod?.sellingPrice === 'number' ? prod.sellingPrice : Number(prod?.sellingPrice || 0);
            text += `• ${prodName} - $${price.toLocaleString('es-ES')}\n`;
          });
        text += `\n`;
      });
    }

    text += `==================================\n`;
    text += `📲 *¡Haz tu pedido respondiendo a este mensaje!*`;
    return text;
  };

  const catalogText = getCatalogText();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(catalogText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
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
            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh]"
            id="whatsapp-catalog-dialog"
          >
            {/* Ambient Background glow */}
            <div className="absolute top-[-30%] left-[-20%] w-[250px] h-[250px] rounded-full bg-emerald-500/10 blur-[90px] pointer-events-none" />

            {/* Header */}
            <div className="bg-slate-800/40 px-5.5 py-4 flex items-center justify-between border-b border-white/10 relative z-10">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
                <span className="p-2 bg-emerald-500/15 text-emerald-400 rounded-lg">
                  <MessageSquare className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold leading-none">Ventas por WhatsApp</h3>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-mono mt-1">Catálogo de stock listo</p>
                </div>
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5.5 flex-1 min-h-0 overflow-y-auto space-y-4">
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Este mensaje contiene la lista organizada de todos los productos en catálogo con stock disponible actual (mayor a 0 unidades), ordenados automáticamente por marcas con sus respectivos nombres y precios.
              </p>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Vista previa de mensaje
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">
                    {stockProducts.length} productos con stock
                  </span>
                </div>
                <textarea
                  readOnly
                  value={catalogText}
                  className="w-full h-72 px-4 py-3 bg-slate-950 border border-white/10 rounded-xl leading-relaxed text-xs text-emerald-400 font-mono outline-none resize-none selection:bg-emerald-500/25 focus:ring-1 focus:ring-emerald-500/30"
                  id="catalog-whatsapp-preview"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white/5 border-t border-white/10 flex flex-col sm:flex-row gap-2.5 sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleCopy}
                className="w-full sm:w-auto px-4.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Mensaje'}</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(catalogText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Compartir en WhatsApp</span>
                <ExternalLink className="w-3 h-3 text-emerald-200" />
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

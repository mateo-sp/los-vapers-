import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Check, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}: ConfirmModalProps) {
  
  const getColorScheme = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-rose-500/15 text-rose-400',
          btnBg: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/15 hover:shadow-rose-500/20',
          border: 'border-rose-500/20'
        };
      case 'info':
        return {
          iconBg: 'bg-indigo-500/15 text-indigo-400',
          btnBg: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/15 hover:shadow-indigo-500/20',
          border: 'border-indigo-500/20'
        };
      case 'warning':
      default:
        return {
          iconBg: 'bg-amber-500/15 text-amber-400',
          btnBg: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/15 hover:shadow-amber-500/20',
          border: 'border-amber-500/20'
        };
    }
  };

  const scheme = getColorScheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className={`bg-slate-900 border ${scheme.border} rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative text-slate-100 flex flex-col`}
            id="custom-confirm-modal"
          >
            {/* Header border light */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <span className={`p-3 rounded-xl shrink-0 ${scheme.iconBg}`}>
                  {type === 'danger' ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  )}
                </span>
                
                <div className="space-y-1 my-1">
                  <h3 className="font-bold text-white text-base leading-tight">{title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">{message}</p>
                </div>
              </div>
            </div>

            {/* Footer containing prompt buttons */}
            <div className="bg-slate-800/20 px-6 py-4 border-t border-white/5 flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/10 font-bold text-slate-300 hover:text-white hover:bg-white/5 bg-transparent transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex items-center gap-1.5 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer ${scheme.btnBg}`}
              >
                <span>{confirmText}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

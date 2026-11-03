import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ShieldAlert, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLoginView() {
  const { user, isAuthorizedAdmin, loginWithGoogle, logout, authError, clearAuthError, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-12 h-12 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-mono">Verificando credenciales...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6"
      >
        {/* Brand Icon & Heading */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-500/25">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white pt-1">
            Panel de Gestión & Stock
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Control de inventario, ventas, caja y deudas
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/25 text-rose-300 rounded-xl text-xs">
            {authError}
          </div>
        )}

        {/* State 1: Unauthenticated */}
        {!user && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={async () => {
                clearAuthError();
                await loginWithGoogle();
              }}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Ingresar con Google</span>
            </button>
          </div>
        )}

        {/* State 2: Logged in with unauthorized account */}
        {user && !isAuthorizedAdmin && (
          <div className="space-y-4">
            <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Cuenta no autorizada</span>
              </div>
              <p className="text-slate-300">
                Has iniciado sesión como <strong className="text-white font-mono">{user.email}</strong>, pero esta cuenta no tiene permisos para ver o modificar el inventario y las ventas.
              </p>
              <p className="text-slate-400 text-[11px]">
                Debes usar una de las dos cuentas registradas: <span className="text-slate-300">djgamer802@gmail.com</span> o <span className="text-slate-300">supposimon@gmail.com</span>.
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión / Cambiar de cuenta</span>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-white/5">
          <p className="text-[11px] text-slate-500">
            Sesión protegida mediante Firebase Auth con cifrado de extremo a extremo
          </p>
        </div>
      </motion.div>
    </div>
  );
}

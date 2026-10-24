import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export const AUTHORIZED_ADMIN_EMAILS = [
  'djgamer802@gmail.com',
  'supposimon@gmail.com'
].map(e => e.toLowerCase().trim());

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthorizedAdmin: boolean;
  operatorEmail: string;
  operatorName: string;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAuthorizedAdmin = !!(
    user && 
    user.email && 
    AUTHORIZED_ADMIN_EMAILS.includes(user.email.toLowerCase().trim())
  );

  const getOperatorName = (): string => {
    if (!user) return 'Usuario Invitado';
    if (user.displayName) return user.displayName;
    const email = user.email?.toLowerCase().trim() || '';
    if (email === 'djgamer802@gmail.com') return 'Mateo';
    if (email === 'supposimon@gmail.com') return 'Simón';
    return email.split('@')[0] || 'Administrador';
  };

  const loginWithGoogle = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Error al iniciar sesión con Google:', error);
      if (error?.code === 'auth/popup-blocked') {
        setAuthError('El navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes en esta página para ingresar.');
      } else if (error?.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else if (error?.code !== 'auth/popup-closed-by-user') {
        setAuthError(error?.message || 'Error al conectar con Google. Verifica tu conexión.');
      }
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setAuthError(null);
    } catch (error: any) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthorizedAdmin,
        operatorEmail: user?.email || '',
        operatorName: getOperatorName(),
        loginWithGoogle,
        logout,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}

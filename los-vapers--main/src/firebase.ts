import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBDW4YERGEuskwGseBYMdmLT3zsaiCDD5E",
  authDomain: "united-vim-dmvz5.firebaseapp.com",
  projectId: "united-vim-dmvz5",
  storageBucket: "united-vim-dmvz5.firebasestorage.app",
  messagingSenderId: "856592097661",
  appId: "1:856592097661:web:fa901a9ec507d1ae556c14"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID
export const db = getFirestore(app, "ai-studio-b778b7a0-094e-4dd1-9b4e-402961cd1bcf");

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });


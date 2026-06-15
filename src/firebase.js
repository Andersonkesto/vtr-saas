import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

/**
 * Arquivo Central: firebase.js
 * Propósito: Inicializar os serviços do Firebase Cloud e exportar as instâncias para o resto da aplicação.
 * 
 * Segurança: 
 * As chaves da API (API Keys) nunca são hardcoded no código fonte. 
 * Elas são injetadas no momento do build (Vite) através das variáveis de ambiente (.env).
 * Isso garante que o repositório Open-Source não vaze credenciais sensíveis.
 */

// Objeto de Configuração Padrão do Firebase (Populando com as variáveis do .env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 1. Inicializa o aplicativo Firebase Core com as configurações
const app = initializeApp(firebaseConfig);

// 2. Instancia e exporta o Banco de Dados (Firestore) - Usado para Viaturas, Motoristas, Serviços
export const db = getFirestore(app);

// 3. Instancia e exporta o Storage - Usado para salvar as fotos das avarias/manutenções
export const storage = getStorage(app);

// 4. Instancia e exporta a Autenticação - Usada para logar os administradores (P4)
export const auth = getAuth(app);

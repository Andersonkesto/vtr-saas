/**
 * Módulo: security.js
 * Propósito: Utilitário de segurança para hash de senhas no client-side.
 * Utiliza a Web Crypto API nativa do browser (sem dependência externa).
 * Algoritmo: SHA-256 com salt duplo fixo por aplicação.
 *
 * IMPORTANTE: Para sistemas críticos de alta segurança, o ideal é validar
 * credenciais em uma Cloud Function (server-side). Este hash é uma camada
 * de proteção adicional para o caso de exposição do banco de dados.
 */

// Salt fixo da aplicação — garante que o mesmo hash não sirva para outros sistemas
const APP_SALT = 'vtr-saas-46bpm-brigade-2026';

/**
 * Gera um hash SHA-256 de uma senha com duplo salting.
 * @param {string} password - A senha em texto puro.
 * @returns {Promise<string>} - A senha como hash hexadecimal de 64 chars.
 */
export const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  // Duplo salt: prefixo + senha + sufixo dificulta rainbow table attacks
  const saltedPayload = `${APP_SALT}::${password}::${APP_SALT}`;
  const data = encoder.encode(saltedPayload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

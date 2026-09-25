/**
 * Configuración del frontend (GitHub Pages). Nada de esto es secreto: la seguridad la ponen la sesión y las reglas.
 * API_URL: URL de la implementación de Apps Script (termina en /exec).
 * MODO: 'appsscript' = todo por Apps Script (como hasta ahora).
 *       'firebase'   = fase 1: ingreso por enlace y tickets activos en Firestore (requiere FIREBASE_ACTIVO = SI en la hoja).
 */
window.GTI_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbz5GgZh3chk8eDcznnr6Sh7FOv6xSFNtdELuzB4rl-LvUvTdIWDuwWByrB7hJQJOXHT/exec',
  MODO: 'firebase',
  FIREBASE: {
    apiKey: 'AIzaSyAhRtHMcbYDeULR-QH860C4XU-biIDmM1k',
    authDomain: 'gestion-ti-tcontrol.firebaseapp.com',
    projectId: 'gestion-ti-tcontrol',
    storageBucket: 'gestion-ti-tcontrol.firebasestorage.app',
    messagingSenderId: '690223200141',
    appId: '1:690223200141:web:7e90899ae6c1a170c82fc4'
  }
};

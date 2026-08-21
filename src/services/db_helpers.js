import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Normaliza 'Cena'/'Mediodía' → 'cena'/'mediodia' (datos viejos o del bot).
const normService = (s) => {
  const r = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (r.includes('mediod') || r.includes('almuerzo')) return 'mediodia';
  if (r.includes('cen') || r.includes('noche')) return 'cena';
  return r;
};

/**
 * Suscribe a los cambios en tiempo real de las reservas de una fecha y servicio.
 * Retorna la función unsubscribe para limpiar el listener al desmontar.
 *
 * @param {string} date     - Fecha en formato YYYY-MM-DD.
 * @param {string} service  - 'mediodia' | 'cena'
 * @param {Function} callback - Recibe el array de reservas actualizado.
 * @returns {Function} unsubscribe
 */
export const subscribeToTableStates = (date, service, callback) => {
  const q = query(
    collection(db, 'reservations'),
    where('date', '==', date),
    where('service', '==', service)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const reservations = snapshot.docs
        .map((doc) => ({ ...doc.data(), id: doc.id, service: normService(doc.data().service) }))
        .filter(r => r.source !== 'whatsapp_bot')
        .filter(r => r.tableId != null && !['cancelado', 'no_show', 'ausente'].includes(r.estado));
      callback(reservations);
    },
    (error) => {
      console.error(`[subscribeToTableStates] Error (${date} - ${service}):`, error);
    }
  );
};

/**
 * Suscribe a los cambios en la configuración global del restaurante.
 * Retorna la función unsubscribe para limpiar el listener al desmontar.
 *
 * @param {Function} callback - Recibe el objeto de configuración actualizado.
 * @returns {Function} unsubscribe
 */
export const subscribeToRestaurantConfig = (callback) => {
  return onSnapshot(
    doc(db, 'config', 'restaurant'),
    (snapshot) => {
      if (snapshot.exists()) callback(snapshot.data());
    },
    (error) => {
      // Ignoramos el error EN SILENCIO si es por falta de datos; no crashea la app.
      console.error('[subscribeToRestaurantConfig] Error al leer configuración:', error);
    }
  );
};

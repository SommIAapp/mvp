// utils/secureLogging.ts

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Fonction pour masquer les données sensibles
export function sanitizeForLogging(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'string') {
    // Masquer les emails
    if (data.includes('@')) {
      return data.replace(/([a-zA-Z0-9._-]+)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, '$1@***');
    }
    
    // Masquer les UUIDs
    if (data.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return data.substring(0, 8) + '-****-****-****-************';
    }
    
    // Masquer les base64 (images) - détecte les longues chaînes base64
    if (data.length > 1000) {
      // Vérifier si c'est probablement du base64
      const base64Regex = /^[A-Za-z0-9+/]+=*$/;
      if (base64Regex.test(data.substring(0, 100))) {
        return `[BASE64 DATA - ${data.length} chars]`;
      }
    }
    
    return data;
  }
  
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeForLogging(item));
    }
    
    const sanitized: any = {};
    for (const key in data) {
      // Ne jamais logger ces clés
      if (key === 'dish_image_base64' || key === 'menu_image_base64' || key === 'image_base64') {
        sanitized[key] = '[IMAGE DATA REMOVED]';
      } 
      // Masquer les tokens et clés
      else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('password')) {
        sanitized[key] = '[SENSITIVE DATA REMOVED]';
      }
      // Masquer les emails
      else if (key === 'email' || key.toLowerCase().includes('email')) {
        sanitized[key] = sanitizeForLogging(data[key]);
      }
      // Masquer les IDs
      else if (key === 'user_id' || key === 'id' || key.toLowerCase().includes('_id')) {
        sanitized[key] = sanitizeForLogging(data[key]);
      }
      // Récursif pour les objets imbriqués
      else {
        sanitized[key] = sanitizeForLogging(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
}

// Fonction de log sécurisée
export function secureLog(message: string, ...args: any[]) {
  // En production, on ne log que les erreurs
  if (IS_PRODUCTION && !message.toLowerCase().includes('error')) {
    return;
  }
  
  // Sanitize tous les arguments
  const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
  
  console.log(message, ...sanitizedArgs);
}

// Fonction pour les erreurs (toujours loggées)
export function secureError(message: string, ...args: any[]) {
  const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
  console.error(message, ...sanitizedArgs);
}

// Fonction pour obtenir la taille d'un objet sans le logger
export function logObjectSize(label: string, obj: any) {
  if (IS_PRODUCTION) return;
  
  const size = JSON.stringify(obj).length;
  const sizeKB = (size / 1024).toFixed(2);
  
  console.log(`${label} - Size: ${size} bytes (${sizeKB} KB)`);
}
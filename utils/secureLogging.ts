// utils/secureLogging.ts

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Fonction pour masquer les URLs sensibles
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  // Masquer les project IDs Supabase
  if (url.includes('supabase.co')) {
    return url.replace(/https:\/\/[a-z0-9]+\.supabase\.co/, 'https://*****.supabase.co');
  }
  
  // Masquer les domaines API
  if (url.includes('http')) {
    // Garder seulement le path
    const pathMatch = url.match(/https?:\/\/[^\/]+(\/.*)?$/);
    if (pathMatch && pathMatch[1]) {
      return `[API]${pathMatch[1]}`;
    }
    return '[API URL]';
  }
  
  return url;
}

// Fonction pour masquer les timestamps
export function sanitizeTimestamp(timestamp: string | Date): string {
  if (!timestamp) return '';
  
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    // Retourner seulement la date et l'heure sans millisecondes
    return date.toISOString().split('.')[0] + 'Z';
  } catch {
    return '[Invalid Date]';
  }
}

// Fonction améliorée pour masquer les données sensibles
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
    
    // Masquer les IDs qui ressemblent à des identifiants (plus de 20 caractères)
    if (data.length > 20 && /^[a-zA-Z0-9_-]+$/.test(data)) {
      return data.substring(0, 8) + '...';
    }
    
    // Masquer les URLs
    if (data.startsWith('http')) {
      return sanitizeUrl(data);
    }
    
    // Masquer les base64 (images) - détecte les longues chaînes base64
    if (data.length > 1000) {
      const base64Regex = /^[A-Za-z0-9+/]+=*$/;
      if (base64Regex.test(data.substring(0, 100))) {
        return `[BASE64 DATA - ${data.length} chars]`;
      }
    }
    
    return data;
  }
  
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      // Pour les arrays, juste indiquer la taille
      if (data.length > 10) {
        return `[Array of ${data.length} items]`;
      }
      return data.map(item => sanitizeForLogging(item));
    }
    
    const sanitized: any = {};
    for (const key in data) {
      // Liste des clés à complètement supprimer
      const blacklistedKeys = [
        'dish_image_base64', 'menu_image_base64', 'image_base64',
        'password', 'token', 'secret', 'api_key', 'apiKey',
        'authorization', 'auth', 'cookie', 'session_token'
      ];
      
      if (blacklistedKeys.some(blacklisted => key.toLowerCase().includes(blacklisted))) {
        sanitized[key] = '[REMOVED]';
        continue;
      }
      
      // Masquer les URLs
      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('endpoint')) {
        sanitized[key] = sanitizeUrl(data[key]);
        continue;
      }
      
      // Masquer les emails
      if (key === 'email' || key.toLowerCase().includes('email')) {
        sanitized[key] = sanitizeForLogging(data[key]);
        continue;
      }
      
      // Masquer les IDs
      if (key === 'user_id' || key === 'id' || key.toLowerCase().includes('_id')) {
        sanitized[key] = sanitizeForLogging(data[key]);
        continue;
      }
      
      // Masquer les timestamps
      if (key.toLowerCase().includes('timestamp') || key.toLowerCase().includes('_at') || key === 'date') {
        sanitized[key] = sanitizeTimestamp(data[key]);
        continue;
      }
      
      // Pour les objets user, ne garder que l'essentiel
      if (key === 'user' && typeof data[key] === 'object') {
        sanitized[key] = {
          id: sanitizeForLogging(data[key].id),
          email: sanitizeForLogging(data[key].email),
          authenticated: !!data[key].id
        };
        continue;
      }
      
      // Récursif pour les objets imbriqués
      sanitized[key] = sanitizeForLogging(data[key]);
    }
    return sanitized;
  }
  
  return data;
}

// Fonction de log sécurisée améliorée
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

// Nouvelle fonction pour logger seulement les infos essentielles
export function logMinimal(label: string, info: { count?: number; type?: string; status?: string; id?: string }) {
  if (IS_PRODUCTION) return;
  
  const minimal = {
    ...info,
    id: info.id ? sanitizeForLogging(info.id) : undefined
  };
  
  console.log(label, minimal);
}

// Helper pour logger un profile de manière sécurisée
export function logProfile(label: string, profile: any) {
  if (!profile) {
    console.log(`${label}: null`);
    return;
  }
  
  secureLog(label, {
    id: sanitizeForLogging(profile.id),
    email: sanitizeForLogging(profile.email),
    subscription: profile.subscription_plan,
    daily_count: profile.daily_count,
    trial_active: profile.subscription_plan === 'trial',
    can_recommend: profile.subscription_plan !== 'free'
  });
}

// Helper pour logger un user de manière sécurisée
export function logUser(label: string, user: any) {
  if (!user) {
    console.log(`${label}: null`);
    return;
  }
  
  secureLog(label, {
    id: sanitizeForLogging(user.id),
    email: sanitizeForLogging(user.email),
    authenticated: true
  });
}
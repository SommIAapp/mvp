import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureLog } from './secureLogging';

const CACHE_KEY_PREFIX = 'wine_card_cache_';
const CACHE_EXPIRY_HOURS = 24;

export interface CachedWineCard {
  sessionId: string;
  restaurantName: string;
  wines: any[];
  cachedAt: string;
  imageHash: string;
}

// Créer un hash simple mais efficace de l'image
export function generateImageHash(imageBase64: string): string {
  // Prendre plusieurs échantillons de l'image pour créer un hash unique
  const sample1 = imageBase64.substring(0, 50);
  const sample2 = imageBase64.substring(imageBase64.length / 2, imageBase64.length / 2 + 50);
  const sample3 = imageBase64.substring(imageBase64.length - 50);
  
  // Combiner et nettoyer
  const combined = (sample1 + sample2 + sample3).replace(/[^a-zA-Z0-9]/g, '');
  return combined.substring(0, 32);
}

// Générer la clé de cache
export function generateCacheKey(imageHash: string): string {
  return CACHE_KEY_PREFIX + imageHash;
}

// Vérifier si le cache est expiré
function isCacheExpired(cachedAt: string): boolean {
  const cachedTime = new Date(cachedAt).getTime();
  const now = new Date().getTime();
  const hoursDiff = (now - cachedTime) / (1000 * 60 * 60);
  return hoursDiff > CACHE_EXPIRY_HOURS;
}

// Récupérer depuis le cache
export async function getCachedWineCard(imageBase64: string): Promise<CachedWineCard | null> {
  try {
    const imageHash = generateImageHash(imageBase64);
    const key = generateCacheKey(imageHash);
    const cached = await AsyncStorage.getItem(key);
    
    if (!cached) {
      secureLog('📦 Cache miss - pas de données en cache');
      return null;
    }
    
    const data = JSON.parse(cached) as CachedWineCard;
    
    if (isCacheExpired(data.cachedAt)) {
      secureLog('📦 Cache expiré, suppression...');
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    secureLog('📦 Cache hit! Carte trouvée:', {
      restaurant: data.restaurantName,
      wines: data.wines.length,
      age: `${((Date.now() - new Date(data.cachedAt).getTime()) / (1000 * 60)).toFixed(0)} minutes`
    });
    
    return data;
  } catch (error) {
    console.error('Erreur lecture cache:', error);
    return null;
  }
}

// Sauvegarder dans le cache
export async function setCachedWineCard(
  imageBase64: string, 
  sessionId: string,
  restaurantName: string,
  wines: any[]
): Promise<void> {
  try {
    const imageHash = generateImageHash(imageBase64);
    const key = generateCacheKey(imageHash);
    
    const data: CachedWineCard = {
      sessionId,
      restaurantName,
      wines,
      cachedAt: new Date().toISOString(),
      imageHash
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(data));
    secureLog('💾 Carte mise en cache:', {
      restaurant: restaurantName,
      wines: wines.length
    });
  } catch (error) {
    console.error('Erreur écriture cache:', error);
  }
}

// Nettoyer le vieux cache
export async function cleanOldCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    let cleaned = 0;
    
    for (const key of cacheKeys) {
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const data = JSON.parse(cached) as CachedWineCard;
          if (isCacheExpired(data.cachedAt)) {
            await AsyncStorage.removeItem(key);
            cleaned++;
          }
        }
      } catch (e) {
        // Supprimer les entrées corrompues
        await AsyncStorage.removeItem(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      secureLog(`🧹 Cache nettoyé: ${cleaned} entrées supprimées`);
    }
  } catch (error) {
    console.error('Erreur nettoyage cache:', error);
  }
}

// Obtenir les stats du cache
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalSize: number;
  oldestEntry: string | null;
}> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    let totalSize = 0;
    let oldestDate: Date | null = null;
    
    for (const key of cacheKeys) {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        totalSize += cached.length;
        const data = JSON.parse(cached) as CachedWineCard;
        const date = new Date(data.cachedAt);
        if (!oldestDate || date < oldestDate) {
          oldestDate = date;
        }
      }
    }
    
    return {
      totalEntries: cacheKeys.length,
      totalSize: Math.round(totalSize / 1024), // KB
      oldestEntry: oldestDate ? oldestDate.toISOString() : null
    };
  } catch (error) {
    return { totalEntries: 0, totalSize: 0, oldestEntry: null };
  }
}
// Temporary in-memory store for large data objects
// Used to avoid passing large JSON objects through URL parameters

interface TempStoreData {
  recommendations?: any[];
  extractedWines?: any[];
  timestamp: number;
}

class TempStore {
  private store = new Map<string, TempStoreData>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes TTL

  set(sessionId: string, data: { recommendations?: any[]; extractedWines?: any[] }) {
    console.log('📦 TempStore: Storing data for session:', sessionId);
    this.store.set(sessionId, {
      ...data,
      timestamp: Date.now(),
    });
    
    // Clean up expired entries
    this.cleanup();
  }

  get(sessionId: string): { recommendations?: any[]; extractedWines?: any[] } | null {
    const data = this.store.get(sessionId);
    
    if (!data) {
      console.log('📦 TempStore: No data found for session:', sessionId);
      return null;
    }

    // Check if data has expired
    if (Date.now() - data.timestamp > this.TTL) {
      console.log('📦 TempStore: Data expired for session:', sessionId);
      this.store.delete(sessionId);
      return null;
    }

    console.log('📦 TempStore: Retrieved data for session:', sessionId);
    return {
      recommendations: data.recommendations,
      extractedWines: data.extractedWines,
    };
  }

  clear(sessionId: string) {
    console.log('📦 TempStore: Clearing data for session:', sessionId);
    this.store.delete(sessionId);
  }

  private cleanup() {
    const now = Date.now();
    for (const [sessionId, data] of this.store.entries()) {
      if (now - data.timestamp > this.TTL) {
        console.log('📦 TempStore: Cleaning up expired data for session:', sessionId);
        this.store.delete(sessionId);
      }
    }
  }
}

// Export singleton instance
export const tempStore = new TempStore();
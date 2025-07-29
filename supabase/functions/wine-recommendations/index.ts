import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      dish_description, 
      user_budget, 
      restaurant_mode = false,           // NOUVEAU
      restaurant_session_id,             // NOUVEAU  
      available_wines = []               // NOUVEAU
    } = await req.json();

    console.log('🍷 Wine recommendations request:', {
      dish: dish_description,
      budget: user_budget,
      restaurant_mode,
      available_wines_count: available_wines.length
    });

    // NOUVELLE LOGIQUE POUR MODE RESTAURANT
    if (restaurant_mode && available_wines.length > 0) {
      console.log(`🍽️ Mode restaurant activé avec ${available_wines.length} vins disponibles`);
      
      const restaurantRecommendations = await getRestaurantModeRecommendations(
        dish_description,
        available_wines,
        restaurant_session_id
      );
      
      return new Response(JSON.stringify({
        success: true,
        algorithm: "SOMMIA Restaurant Mode v1.0",
        restaurant_mode: true,
        session_id: restaurant_session_id,
        recommendations: restaurantRecommendations,
        available_wines_count: available_wines.length,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // MODE NORMAL (existant)
    console.log('🏠 Mode normal - recherche dans base de données complète');
    
    const normalRecommendations = await getNormalModeRecommendations(
      dish_description,
      user_budget
    );

    return new Response(JSON.stringify({
      success: true,
      algorithm: "SOMMIA Smart v2.0",
      restaurant_mode: false,
      recommendations: normalRecommendations,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Wine recommendations error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// NOUVELLE FONCTION RECOMMANDATIONS RESTAURANT
async function getRestaurantModeRecommendations(
  dish: string, 
  availableWines: any[], 
  sessionId: string
) {
  if (!MISTRAL_API_KEY) {
    console.log('⚠️ No Mistral API key, using mock restaurant recommendations');
    return getMockRestaurantRecommendations(dish, availableWines);
  }

  const prompt = `Tu es un sommelier expert dans un restaurant. Tu dois recommander les 3 MEILLEURS vins de la carte pour ce plat, en utilisant UNIQUEMENT les vins disponibles.

PLAT: "${dish}"

VINS DISPONIBLES DANS CE RESTAURANT:
${availableWines.map((wine, i) => `${i+1}. ${wine.name} (${wine.type}) - ${wine.price_bottle || wine.price_glass}€ ${wine.region ? `- ${wine.region}` : ''}`).join('\n')}

RÈGLES STRICTES:
- Recommander SEULEMENT des vins de cette liste
- Privilégier l'accord gustatif optimal
- Si aucun vin parfait, choisir les 3 meilleurs disponibles
- Expliquer pourquoi cet accord fonctionne spécifiquement
- Mentionner le prix de la carte du restaurant

Réponse en JSON uniquement:
{
  "recommendations": [
    {
      "wine_id": "uuid_du_vin_extrait",
      "name": "Nom exact comme sur la carte",
      "type": "rouge/blanc/rosé/champagne", 
      "price_display": "45€ la bouteille",
      "match_score": 92,
      "reasoning": "Cet accord fonctionne car... [max 150 mots]",
      "restaurant_availability": true,
      "alternative_if_unavailable": "Suggestion si ce vin n'est plus disponible"
    }
  ]
}`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Nettoyer et parser JSON
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanContent);
    
    return result.recommendations || [];
  } catch (error) {
    console.error('🔄 Mistral restaurant recommendations failed, using mock:', error);
    return getMockRestaurantRecommendations(dish, availableWines);
  }
}

// MODE NORMAL (EXISTANT)
async function getNormalModeRecommendations(dish: string, budget?: number) {
  if (!MISTRAL_API_KEY) {
    console.log('⚠️ No Mistral API key, using database fallback');
    return getDatabaseFallbackRecommendations(dish, budget);
  }

  // Utiliser l'optimiseur de vins pour le mode normal
  const optimizer = new WineOptimizer();
  return await optimizer.getOptimizedRecommendations(dish, budget);
 }

 // CLASSE OPTIMISEUR DE VINS
 class WineOptimizer {
   private wines: any[] = [];
   private readonly DIVERSITY_WEIGHT = 0.3;
   private readonly QUALITY_WEIGHT = 0.4;
   private readonly PRICE_WEIGHT = 0.3;

   async getOptimizedRecommendations(dish: string, budget?: number) {
     console.log('🍷 WineOptimizer: Starting optimization for:', dish);
     
     // Charger et filtrer les vins
     await this.loadAndFilterWines(budget);
     console.log('📊 WineOptimizer: Loaded wines:', this.wines.length);
     
     if (this.wines.length === 0) {
       throw new Error('Aucun vin trouvé pour ces critères');
     }

     // Traiter avec priorité diversité
     const recommendations = await this.processWinesWithDiversityPriority(dish, budget);
     console.log('✅ WineOptimizer: Generated recommendations:', recommendations.length);
     
     return recommendations;
   }

   private async loadAndFilterWines(budget?: number) {
     let query = supabase
       .from('mvp_wines')
       .select('*')
       .order('quality_score', { ascending: false });

     const { data: wines, error } = await query.limit(200);
     
     if (error) {
       console.error('❌ Error loading wines:', error);
       throw error;
     }

     if (!wines || wines.length === 0) {
       throw new Error('Aucun vin disponible');
     }

     // Filtrer par budget si spécifié
     if (budget) {
       const budgetMin = Math.max(1, budget * 0.7);
       const budgetMax = budget * 1.2;
       
       this.wines = wines.filter(wine => 
         wine.carrefour_price && 
         wine.carrefour_price >= budgetMin && 
         wine.carrefour_price <= budgetMax
       );
       
       console.log(`💰 Budget filter: ${wines.length} → ${this.wines.length} wines`);
     } else {
       this.wines = wines;
     }
   }

   private async processWinesWithDiversityPriority(dish: string, budget?: number) {
     // Grouper par couleur pour assurer la diversité
     const winesByColor = this.groupWinesByColor();
     const recommendations: any[] = [];

     // Sélectionner le meilleur de chaque couleur
     for (const [color, colorWines] of Object.entries(winesByColor)) {
       if (recommendations.length >= 3) break;
       
       const bestWine = this.selectBestWineForDish(colorWines as any[], dish, color);
       if (bestWine) {
         recommendations.push(this.formatWineRecommendation(bestWine, dish, color));
       }
     }

     // Compléter avec les meilleurs vins restants si nécessaire
     while (recommendations.length < 3 && this.wines.length > recommendations.length) {
       const remainingWines = this.wines.filter(wine => 
         !recommendations.some(rec => rec.id === wine.id)
       );
       
       if (remainingWines.length === 0) break;
       
       const bestRemaining = this.selectBestWineForDish(remainingWines, dish, 'mixed');
       if (bestRemaining) {
         recommendations.push(this.formatWineRecommendation(bestRemaining, dish, 'mixed'));
       }
     }

     return recommendations.slice(0, 3);
   }

   private groupWinesByColor() {
     const groups: { [key: string]: any[] } = {};
     
     for (const wine of this.wines) {
       const color = wine.color || 'unknown';
       if (!groups[color]) groups[color] = [];
       groups[color].push(wine);
     }
     
     return groups;
   }

   private selectBestWineForDish(wines: any[], dish: string, color: string) {
     if (wines.length === 0) return null;
     
     // Calculer un score composite pour chaque vin
     const scoredWines = wines.map(wine => ({
       ...wine,
       composite_score: this.calculateCompositeScore(wine, dish, color)
     }));
     
     // Trier par score et retourner le meilleur
     scoredWines.sort((a, b) => b.composite_score - a.composite_score);
     return scoredWines[0];
   }

   private calculateCompositeScore(wine: any, dish: string, color: string): number {
     let score = 0;
     
     // Score qualité (40%)
     const qualityScore = (wine.quality_score || 50) / 100;
     score += qualityScore * this.QUALITY_WEIGHT;
     
     // Score accord plat (30%)
     const pairingScore = this.calculatePairingScore(wine, dish, color);
     score += pairingScore * this.DIVERSITY_WEIGHT;
     
     // Score prix (30%) - favoriser les bons rapports qualité/prix
     const priceScore = this.calculateBudgetAwarePrice(wine);
     score += priceScore * this.PRICE_WEIGHT;
     
     return score;
   }

   private calculatePairingScore(wine: any, dish: string, color: string): number {
     const dishLower = dish.toLowerCase();
     let score = 0.5; // Score de base
     
     // Logique d'accord selon la couleur
     if (color === 'rouge') {
       if (dishLower.includes('viande') || dishLower.includes('bœuf') || 
           dishLower.includes('agneau') || dishLower.includes('canard')) {
         score += 0.4;
       } else if (dishLower.includes('fromage') || dishLower.includes('sauce')) {
         score += 0.2;
       }
     } else if (color === 'blanc') {
       if (dishLower.includes('poisson') || dishLower.includes('fruits de mer') ||
           dishLower.includes('volaille')) {
         score += 0.4;
       } else if (dishLower.includes('salade') || dishLower.includes('légume')) {
         score += 0.2;
       }
     } else if (color === 'rosé') {
       if (dishLower.includes('salade') || dishLower.includes('charcuterie') ||
           dishLower.includes('grillé')) {
         score += 0.3;
       }
     }
     
     return Math.min(score, 1.0);
   }

   private calculateBudgetAwarePrice(wine: any): number {
     const price = wine.carrefour_price || 0;
     
     // Favoriser les vins entre 10-30€ (bon rapport qualité/prix)
     if (price >= 10 && price <= 30) {
       return 1.0;
     } else if (price < 10) {
       return 0.7; // Vins économiques
     } else if (price <= 50) {
       return 0.8; // Vins premium
     } else {
       return 0.6; // Vins très chers
     }
   }

   private formatWineRecommendation(wine: any, dish: string, color: string) {
     return {
       id: wine.id,
       name: wine.name,
       producer: wine.producer || 'Producteur inconnu',
       region: wine.region || 'Région inconnue',
       price_estimate: wine.carrefour_price || 0, // Compatibilité frontend
       rating: Math.round((wine.quality_score || 80) / 20) * 20, // Ensure rating is on 100-point scale
       category: this.getCategoryFromPrice(wine.carrefour_price || 0),
       color: this.mapWineColor(wine.color),
       reasoning: this.generateReasoning(dish, wine, color),
       grapeVarieties: [], // Non disponible dans mvp_wines
       foodPairings: [], // Non disponible dans mvp_wines
       vintage: wine.vintage || undefined,
       appellation: undefined, // Non disponible dans mvp_wines
     };
   }

   private getCategoryFromPrice(price: number): string {
     if (price <= 15) return 'economique';
     if (price <= 30) return 'qualite-prix';
     return 'premium';
   }

   private mapWineColor(color: string | null): string {
     switch (color) {
       case 'rouge': return 'rouge';
       case 'blanc': return 'blanc';
       case 'rosé': return 'rose';
       case 'sparkling': return 'sparkling';
       default: return 'rouge';
     }
   }

   private generateReasoning(dish: string, wine: any, color: string): string {
     const price = wine.carrefour_price || 0;
     const category = this.getCategoryFromPrice(price);
     const dishLower = dish.toLowerCase();
     
     // Préfixe selon la catégorie de prix
     let priceIntro = '';
     if (category === 'economique') {
       priceIntro = `Pour moins de ${Math.ceil(price)}€, ce `;
     } else if (category === 'qualite-prix') {
       priceIntro = 'Un excellent rapport qualité-prix, ce ';
     } else {
       priceIntro = 'Une cuvée d\'exception, ce ';
     }
     
     // Caractéristiques selon le type de vin
     let wineCharacteristics = '';
     switch (color) {
       case 'rouge':
         wineCharacteristics = 'rouge aux tanins équilibrés et aux arômes de fruits rouges';
         break;
       case 'blanc':
         wineCharacteristics = 'blanc aux notes minérales et à la fraîcheur élégante';
         break;
       case 'rose':
         wineCharacteristics = 'rosé aux notes fruitées et à la vivacité rafraîchissante';
         break;
       case 'sparkling':
         wineCharacteristics = 'effervescent aux bulles fines et à l\'élégance pétillante';
         break;
       default:
         wineCharacteristics = 'vin aux caractéristiques harmonieuses';
     }
     
     // Accord spécifique selon le plat
     let pairingExplanation = '';
     if (dishLower.includes('saumon') || dishLower.includes('poisson')) {
       if (color === 'blanc') {
         pairingExplanation = 'Sa fraîcheur iodée et ses notes d\'agrumes subliment la chair délicate du poisson.';
       } else if (color === 'rose') {
         pairingExplanation = 'Sa vivacité et ses arômes fruités créent un contraste parfait avec les saveurs marines.';
       } else {
         pairingExplanation = 'Il accompagne délicatement les saveurs marines sans les masquer.';
       }
     } else if (dishLower.includes('viande') || dishLower.includes('bœuf') || dishLower.includes('agneau') || dishLower.includes('entrecôte')) {
       if (color === 'rouge') {
         pairingExplanation = 'Sa structure tannique et ses arômes profonds s\'harmonisent parfaitement avec la richesse de la viande.';
       } else {
         pairingExplanation = 'Il apporte une fraîcheur bienvenue qui équilibre la puissance de la viande.';
       }
     } else if (dishLower.includes('fromage')) {
       if (color === 'rouge') {
         pairingExplanation = 'Son onctuosité et sa structure complètent l\'intensité des fromages affinés.';
       } else if (color === 'blanc') {
         pairingExplanation = 'Sa minéralité et sa fraîcheur créent un équilibre parfait avec l\'onctuosité du fromage.';
       } else {
         pairingExplanation = 'Il crée un équilibre délicat avec les saveurs lactées.';
       }
     } else if (dishLower.includes('volaille') || dishLower.includes('poulet')) {
       if (color === 'blanc') {
         pairingExplanation = 'Sa finesse et son élégance accompagnent parfaitement la délicatesse de la volaille.';
       } else if (color === 'rouge') {
         pairingExplanation = 'Ses tanins souples et ses arômes fruités s\'accordent harmonieusement avec la volaille.';
       } else {
         pairingExplanation = 'Il accompagne avec finesse les saveurs subtiles de la volaille.';
       }
     } else if (dishLower.includes('salade') || dishLower.includes('légume')) {
       pairingExplanation = 'Sa fraîcheur et sa vivacité subliment les saveurs végétales et apportent une belle harmonie.';
     } else if (dishLower.includes('dessert') || dishLower.includes('chocolat')) {
       if (color === 'sparkling') {
         pairingExplanation = 'Ses bulles délicates et son effervescence créent un final gourmand exceptionnel.';
       } else {
         pairingExplanation = 'Sa douceur et ses arômes fruités accompagnent délicatement les saveurs sucrées.';
       }
     } else {
       // Accord générique
       pairingExplanation = `Il s'accorde harmonieusement avec ${dish}, créant un équilibre parfait entre le vin et le plat.`;
     }
     
     return `${priceIntro}${wineCharacteristics} de ${wine.region || 'France'} s'accorde parfaitement avec ${dish}. ${pairingExplanation}`;
   }
 }

function getMockRestaurantRecommendations(dish: string, availableWines: any[]) {
  // Sélectionner les 3 premiers vins et créer des recommandations
  const selectedWines = availableWines.slice(0, 3);
  
  return selectedWines.map((wine, index) => ({
    wine_id: wine.id || crypto.randomUUID(),
    name: wine.name,
    type: wine.type,
    price_display: wine.price_bottle ? `${wine.price_bottle}€ la bouteille` : `${wine.price_glass}€ le verre`,
    match_score: 85 + (index * 5), // Scores décroissants
    reasoning: generateMockReasoning(dish, wine),
    restaurant_availability: true,
    alternative_if_unavailable: `Si indisponible, demandez un ${wine.type} de ${wine.region || 'la région'}`
  }));
}

function generateMockReasoning(dish: string, wine: any): string {
  const reasonings = {
    rouge: `Ce ${wine.name} s'accorde parfaitement avec ${dish}. Ses tanins équilibrés et ses arômes de fruits rouges complètent idéalement les saveurs du plat.`,
    blanc: `L'élégance de ce ${wine.name} sublime ${dish}. Sa fraîcheur et ses notes minérales créent un accord harmonieux avec les saveurs délicates.`,
    rosé: `Ce ${wine.name} apporte la fraîcheur parfaite pour ${dish}. Ses notes fruitées et sa vivacité équilibrent merveilleusement le plat.`,
    champagne: `Les bulles fines de ce ${wine.name} subliment ${dish}. Son effervescence et son élégance créent un moment d'exception.`
  };
  
  return reasonings[wine.type as keyof typeof reasonings] || `Ce ${wine.name} accompagne délicieusement ${dish}.`;
}

// FALLBACK DATABASE (MODE NORMAL)
async function getDatabaseFallbackRecommendations(dish: string, budget?: number) {
  let query = supabase
    .from('mvp_wines')
    .select('*')
    .not('carrefour_price', 'is', null)
    .order('quality_score', { ascending: false });

  if (budget) {
    query = query.lte('carrefour_price', budget);
  }

  const { data: wines, error } = await query.limit(50);
  
  if (error) throw error;
  if (!wines || wines.length === 0) {
    throw new Error('Aucun vin trouvé pour ces critères');
  }

  // Transformer en format recommandation
  return wines.slice(0, 3).map((wine, index) => ({
    id: wine.id,
    name: wine.name,
    producer: wine.producer || 'Producteur inconnu',
    region: wine.region || 'Région inconnue',
    price_estimate: wine.carrefour_price || 0, // Compatibilité frontend
    rating: wine.quality_score || 80,
    category: getCategoryFromPrice(wine.carrefour_price || 0),
    color: mapWineColor(wine.color),
    reasoning: `Ce vin s'accorde parfaitement avec ${dish} grâce à ses caractéristiques uniques.`,
    grapeVarieties: [], // Non disponible dans mvp_wines
    foodPairings: [], // Non disponible dans mvp_wines
    vintage: wine.vintage || undefined,
    appellation: undefined, // Non disponible dans mvp_wines
  }));
}

function getCategoryFromPrice(price: number): string {
  if (price <= 15) return 'economique';
  if (price <= 30) return 'qualite-prix';
  return 'premium';
}

function mapWineColor(color: string | null): string {
  switch (color) {
    case 'rouge': return 'rouge';
    case 'blanc': return 'blanc';
    case 'rosé': return 'rose';
    case 'sparkling': return 'sparkling';
    default: return 'rouge';
  }
}
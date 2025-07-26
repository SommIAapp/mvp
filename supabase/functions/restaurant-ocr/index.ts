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

  const startTime = Date.now();

  try {
    const { image_base64, user_id } = await req.json();
    
    if (!image_base64) {
      throw new Error('Image requise');
    }

    console.log('🔍 Starting OCR analysis for user:', user_id);

    // ÉTAPE 1: OCR avec Mistral Vision
    const ocrResult = await extractWinesFromImage(image_base64);
    console.log('📋 OCR extracted:', ocrResult.wines?.length || 0, 'wines');
    
    // ÉTAPE 2: Créer session restaurant
    const sessionId = await createRestaurantSession(user_id, ocrResult);
    console.log('📝 Created session:', sessionId);
    
    // ÉTAPE 3: Valider et enrichir les vins
    const enrichedWines = await enrichExtractedWines(ocrResult.wines || []);
    console.log('✨ Enriched wines:', enrichedWines.length);

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      restaurant_name: ocrResult.restaurant_name || 'Restaurant détecté',
      extracted_wines: enrichedWines,
      confidence_score: ocrResult.confidence || 0.8,
      processing_time_ms: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ OCR Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// FONCTION OCR AVEC MISTRAL VISION
async function extractWinesFromImage(imageBase64: string) {
  if (!MISTRAL_API_KEY) {
    console.log('⚠️ No Mistral API key, using mock data');
    return getMockOCRResult();
  }

  const prompt = `Analyse cette carte des vins de restaurant et extrait UNIQUEMENT les informations suivantes pour chaque vin:

INSTRUCTIONS STRICTES:
- Nom exact du vin
- Prix (verre ET/OU bouteille) 
- Type (rouge/blanc/rosé/champagne/pétillant)
- Région si mentionnée
- Ignore descriptions marketing
- Ignore accords mets suggestions
- Ignore millésimes si incertains

EXEMPLE FORMAT RÉPONSE:
{
  "restaurant_name": "Le Bistrot du Coin",
  "wines": [
    {
      "name": "Chablis Premier Cru Montmains",
      "type": "blanc",
      "price_glass": 12,
      "price_bottle": 48,
      "region": "Bourgogne"
    },
    {
      "name": "Châteauneuf-du-Pape",
      "type": "rouge", 
      "price_bottle": 65,
      "region": "Rhône"
    }
  ],
  "confidence": 0.85
}

RÉPONDRE UNIQUEMENT EN JSON VALIDE, AUCUN AUTRE TEXTE.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'pixtral-large-latest', // Mistral Vision model
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur OCR: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Nettoyer la réponse JSON
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('🔄 Mistral OCR failed, using mock data:', error);
    return getMockOCRResult();
  }
}

// MOCK DATA POUR DÉVELOPPEMENT
function getMockOCRResult() {
  return {
    restaurant_name: "Le Bistrot Parisien",
    wines: [
      {
        name: "Château Margaux 2018",
        type: "rouge",
        price_bottle: 45,
        price_glass: 12,
        region: "Bordeaux"
      },
      {
        name: "Sancerre Domaine Henri Bourgeois 2022",
        type: "blanc",
        price_bottle: 28,
        price_glass: 8,
        region: "Loire"
      },
      {
        name: "Côtes du Rhône Villages 2021",
        type: "rouge",
        price_bottle: 22,
        price_glass: 6,
        region: "Rhône"
      },
      {
        name: "Champagne Veuve Clicquot",
        type: "champagne",
        price_bottle: 65,
        price_glass: 15,
        region: "Champagne"
      },
      {
        name: "Provence Rosé Château d'Esclans",
        type: "rosé",
        price_bottle: 24,
        price_glass: 7,
        region: "Provence"
      }
    ],
    confidence: 0.85
  };
}

// CRÉATION SESSION RESTAURANT
async function createRestaurantSession(userId: string, ocrResult: any) {
  const { data, error } = await supabase
    .from('restaurant_sessions')
    .insert({
      user_id: userId,
      restaurant_name: ocrResult.restaurant_name,
      extracted_wines: ocrResult.wines || [],
      session_active: true
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error creating session:', error);
    throw error;
  }
  
  return data.id;
}

// ENRICHISSEMENT VINS
async function enrichExtractedWines(extractedWines: any[]) {
  return extractedWines.map(wine => ({
    ...wine,
    id: crypto.randomUUID(),
    match_confidence: calculateMatchConfidence(wine),
    suggested_food_pairings: generateQuickPairings(wine.type),
    price_range: categorizePriceRange(wine.price_bottle || wine.price_glass)
  }));
}

function calculateMatchConfidence(wine: any): number {
  let confidence = 0.5; // Base
  
  if (wine.name && wine.name.length > 5) confidence += 0.2;
  if (wine.region) confidence += 0.15;
  if (wine.price_bottle || wine.price_glass) confidence += 0.15;
  
  return Math.min(confidence, 1.0);
}

function generateQuickPairings(wineType: string): string[] {
  const pairings = {
    rouge: ['Viandes rouges', 'Fromages affinés', 'Plats en sauce'],
    blanc: ['Poissons', 'Fruits de mer', 'Volaille'],
    rosé: ['Salades', 'Charcuterie', 'Grillades'],
    champagne: ['Apéritif', 'Huîtres', 'Desserts']
  };
  
  return pairings[wineType as keyof typeof pairings] || ['Plats variés'];
}

function categorizePriceRange(price: number): string {
  if (!price) return 'Prix non spécifié';
  if (price <= 15) return 'Économique';
  if (price <= 30) return 'Qualité-Prix';
  if (price <= 50) return 'Premium';
  return 'Prestige';
}
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface AvailableWine {
  name: string;
  type: string;
  price_bottle?: number;
  price_glass?: number;
  region?: string;
}

interface RestaurantRecommendation {
  name: string;
  type: string;
  price_bottle?: number;
  price_glass?: number;
  region?: string;
  reasoning: string;
  match_score: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { 
      dish_description, 
      available_wines, 
      user_budget, 
      restaurant_session_id,
      user_id 
    } = await req.json();

    if (!dish_description || !available_wines || !Array.isArray(available_wines)) {
      return new Response(
        JSON.stringify({ error: 'Dish description and available wines are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate restaurant-specific recommendations
    const recommendations = await generateRestaurantRecommendations(
      dish_description,
      available_wines,
      user_budget
    );

    return new Response(
      JSON.stringify({
        recommendations,
        algorithm: 'SOMMIA Restaurant Mode v1.0',
        restaurant_session_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Restaurant recommendations error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generateRestaurantRecommendations(
  dishDescription: string,
  availableWines: AvailableWine[],
  userBudget?: number
): Promise<RestaurantRecommendation[]> {
  // Filter wines by budget if specified
  let filteredWines = availableWines;
  if (userBudget) {
    filteredWines = availableWines.filter(wine => 
      (wine.price_bottle && wine.price_bottle <= userBudget) ||
      (wine.price_glass && wine.price_glass <= userBudget / 3) // Rough estimate for glass vs bottle
    );
  }

  // If no wines match budget, use all available wines
  if (filteredWines.length === 0) {
    filteredWines = availableWines;
  }

  // Generate AI-powered recommendations based on dish and available wines
  const recommendations: RestaurantRecommendation[] = [];

  // Simple matching algorithm (in real implementation, use Mistral AI)
  const dishLower = dishDescription.toLowerCase();
  
  // Score wines based on dish pairing rules
  const scoredWines = filteredWines.map(wine => {
    let score = 0.5; // Base score
    let reasoning = '';

    // Basic pairing logic
    if (wine.type === 'rouge') {
      if (dishLower.includes('viande') || dishLower.includes('bœuf') || 
          dishLower.includes('agneau') || dishLower.includes('canard') ||
          dishLower.includes('entrecôte') || dishLower.includes('magret')) {
        score += 0.4;
        reasoning = `Ce vin rouge s'accorde parfaitement avec ${dishDescription}. Les tanins structurés complètent la richesse de la viande.`;
      } else if (dishLower.includes('fromage') || dishLower.includes('coq au vin')) {
        score += 0.3;
        reasoning = `Un excellent choix pour ${dishDescription}. Ce rouge apporte la structure nécessaire pour équilibrer les saveurs.`;
      } else {
        reasoning = `Ce vin rouge peut accompagner ${dishDescription}, apportant de la profondeur aux saveurs.`;
      }
    }

    if (wine.type === 'blanc') {
      if (dishLower.includes('poisson') || dishLower.includes('saumon') || 
          dishLower.includes('sole') || dishLower.includes('bar') ||
          dishLower.includes('fruits de mer') || dishLower.includes('huître')) {
        score += 0.4;
        reasoning = `Ce vin blanc est idéal avec ${dishDescription}. Sa fraîcheur et ses arômes subliment les saveurs marines.`;
      } else if (dishLower.includes('volaille') || dishLower.includes('poulet') ||
                 dishLower.includes('risotto') || dishLower.includes('pâtes')) {
        score += 0.3;
        reasoning = `Un choix harmonieux pour ${dishDescription}. Ce blanc apporte élégance et finesse à l'accord.`;
      } else {
        reasoning = `Ce vin blanc accompagne délicatement ${dishDescription}, apportant fraîcheur et vivacité.`;
      }
    }

    if (wine.type === 'rosé') {
      if (dishLower.includes('salade') || dishLower.includes('charcuterie') ||
          dishLower.includes('grillé') || dishLower.includes('barbecue')) {
        score += 0.3;
        reasoning = `Ce rosé est parfait pour ${dishDescription}. Sa fraîcheur et ses notes fruitées créent un accord délicat.`;
      } else {
        reasoning = `Ce rosé accompagne agréablement ${dishDescription}, offrant un équilibre entre fraîcheur et caractère.`;
      }
    }

    if (wine.type === 'champagne') {
      if (dishLower.includes('apéritif') || dishLower.includes('huître') ||
          dishLower.includes('caviar') || dishLower.includes('dessert')) {
        score += 0.4;
        reasoning = `Ce champagne sublime ${dishDescription}. Ses bulles fines et son élégance créent un moment d'exception.`;
      } else {
        score += 0.2;
        reasoning = `Ce champagne apporte une touche festive à ${dishDescription}, avec ses bulles raffinées.`;
      }
    }

    // Bonus for premium regions
    if (wine.region) {
      const premiumRegions = ['bordeaux', 'bourgogne', 'champagne', 'châteauneuf'];
      if (premiumRegions.some(region => wine.region!.toLowerCase().includes(region))) {
        score += 0.1;
      }
    }

    return {
      ...wine,
      match_score: Math.min(score, 1.0),
      reasoning,
    };
  });

  // Sort by score and take top 3
  const topWines = scoredWines
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 3);

  return topWines.map(wine => ({
    name: wine.name,
    type: wine.type,
    price_bottle: wine.price_bottle,
    price_glass: wine.price_glass,
    region: wine.region,
    reasoning: wine.reasoning,
    match_score: wine.match_score,
  }));
}
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

interface ExtractedWine {
  name: string;
  type: 'rouge' | 'blanc' | 'rosé' | 'champagne';
  price_glass?: number;
  price_bottle?: number;
  region?: string;
  confidence: number;
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
    const { image_base64, user_id } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'Image base64 is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Simulate OCR processing (in real implementation, you would use a service like Google Vision API)
    const extractedWines = await processWineCardOCR(image_base64);
    
    // Create restaurant session
    const { data: session, error: sessionError } = await supabase
      .from('restaurant_sessions')
      .insert({
        user_id: user_id,
        restaurant_name: 'Restaurant détecté', // Would be extracted from OCR
        wine_list_image_url: null, // Could store the image URL if needed
        extracted_wines: extractedWines,
        session_active: true,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating restaurant session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create restaurant session' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Save individual wines
    if (extractedWines.length > 0) {
      const wineRecords = extractedWines.map(wine => ({
        session_id: session.id,
        wine_name: wine.name,
        wine_price_glass: wine.price_glass,
        wine_price_bottle: wine.price_bottle,
        wine_type: wine.type,
        wine_region: wine.region,
        extracted_from_ocr: true,
        confidence_score: wine.confidence,
      }));

      const { error: winesError } = await supabase
        .from('scanned_restaurant_wines')
        .insert(wineRecords);

      if (winesError) {
        console.error('Error saving scanned wines:', winesError);
        // Continue anyway - session was created
      }
    }

    return new Response(
      JSON.stringify({
        session_id: session.id,
        restaurant_name: session.restaurant_name,
        extracted_wines: extractedWines,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Restaurant wine scan error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processWineCardOCR(imageBase64: string): Promise<ExtractedWine[]> {
  // This is a simulation of OCR processing
  // In a real implementation, you would:
  // 1. Use Google Vision API, AWS Textract, or similar OCR service
  // 2. Parse the extracted text to identify wine names, prices, and types
  // 3. Use AI to clean up and structure the data
  
  // For now, return mock data that simulates a typical restaurant wine list
  const mockWines: ExtractedWine[] = [
    {
      name: 'Château Margaux 2018',
      type: 'rouge',
      price_bottle: 45,
      price_glass: 12,
      region: 'Bordeaux',
      confidence: 0.95,
    },
    {
      name: 'Sancerre Domaine Henri Bourgeois 2022',
      type: 'blanc',
      price_bottle: 28,
      price_glass: 8,
      region: 'Loire',
      confidence: 0.92,
    },
    {
      name: 'Côtes du Rhône Villages 2021',
      type: 'rouge',
      price_bottle: 22,
      price_glass: 6,
      region: 'Rhône',
      confidence: 0.88,
    },
    {
      name: 'Champagne Veuve Clicquot',
      type: 'champagne',
      price_bottle: 65,
      price_glass: 15,
      region: 'Champagne',
      confidence: 0.96,
    },
    {
      name: 'Provence Rosé Château d\'Esclans',
      type: 'rosé',
      price_bottle: 24,
      price_glass: 7,
      region: 'Provence',
      confidence: 0.90,
    },
  ];

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  return mockWines;
}
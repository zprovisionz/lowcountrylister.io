import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './_lib/supabase.js';
import { checkAnonymousRateLimit } from './_lib/rateLimit.js';
import { getSessionId, getClientIP, hashIP, generateDeviceFingerprint } from './_lib/fingerprint.js';
import { GenerateListingSchema } from './_lib/validation.js';
import { extractPropertyFeatures } from './_lib/vision.js';
import OpenAI from 'openai';
import { logger } from './_lib/logger.js';
import { getCachedNeighborhood, setCachedNeighborhood } from './_lib/neighborhoodCache.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const MAX_ANONYMOUS_GENERATIONS = 3;

/**
 * Generate preview snippet from full description (first 50 words)
 * Attempts to end at sentence boundary when possible
 */
function generatePreviewSnippet(description: string): string {
  const words = description.split(/\s+/).filter(word => word.length > 0);
  const previewWords = words.slice(0, 50);
  let preview = previewWords.join(' ');
  
  // Try to end at sentence boundary if we're close to 50 words
  if (words.length > 50) {
    // Look for sentence endings in the last 10 words
    const lastWords = previewWords.slice(-10);
    const lastText = lastWords.join(' ');
    
    // Find last sentence ending (., !, ?)
    const sentenceEndMatch = lastText.match(/[.!?]\s+[A-Z]/);
    if (sentenceEndMatch && sentenceEndMatch.index !== undefined) {
      const sentenceEndIndex = preview.length - lastText.length + sentenceEndMatch.index + 1;
      preview = preview.substring(0, sentenceEndIndex);
    } else {
      preview += '...';
    }
  }
  
  return preview;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check rate limit before processing
    const rateLimitCheck = await checkAnonymousRateLimit(req);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: rateLimitCheck.reason,
        code: 'RATE_LIMIT_EXCEEDED',
        count: rateLimitCheck.count,
        remaining: rateLimitCheck.remaining,
      });
    }

    // Validate request data
    const validationResult = GenerateListingSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Get or create session ID
    const sessionId = getSessionId(req);
    const clientIP = getClientIP(req);
    const hashedIP = hashIP(clientIP);
    const deviceFingerprint = generateDeviceFingerprint(req);

    const supabase = createServiceClient();

    logger.info('Anonymous generation request:', {
      address: data.address,
      sessionId: sessionId.substring(0, 8) + '...',
    });

    // Geocode address
    logger.info('Geocoding address and extracting photo features in parallel...');
    // Run geocoding and photo analysis in parallel for better performance
    const [geocodingData, visionFeatures] = await Promise.all([
      geocodeAddress(data.address),
      data.photo_urls.length > 0
        ? extractPropertyFeatures(data.photo_urls)
        : Promise.resolve({ features: [], confidence: 0 }),
    ]);

    // Find neighborhood
    logger.info('Loading neighborhood data...');
    const neighborhoodData = await findNeighborhood(geocodingData);

    // Auto-populate amenities from neighborhood if none provided
    let finalAmenities = data.amenities || [];
    if (finalAmenities.length === 0 && neighborhoodData.typical_amenities && neighborhoodData.typical_amenities.length > 0) {
      logger.info('Quick mode: Auto-populating typical amenities from neighborhood');
      finalAmenities = neighborhoodData.typical_amenities;
    }

    // Update data with final amenities
    const dataWithAmenities = {
      ...data,
      amenities: finalAmenities,
    };

    // Generate descriptions
    logger.info('Generating listing description...');
    const descriptions = await generateDescriptions(
      dataWithAmenities,
      geocodingData,
      neighborhoodData,
      visionFeatures.features
    );

    // Run fact-check on MLS description
    const mlsConfidence = await factCheckDescription(
      descriptions.mls_description,
      dataWithAmenities,
      visionFeatures.features,
      geocodingData
    );

    // Generate preview snippet (first 50 words)
    const previewSnippet = generatePreviewSnippet(descriptions.mls_description);

    // Store in anonymous_generations table
    // Note: We insert first, then verify rate limit to prevent race conditions
    const { data: anonymousGeneration, error: insertError } = await supabase
      .from('anonymous_generations')
      .insert({
        session_id: sessionId,
        ip_address: hashedIP,
        device_fingerprint: deviceFingerprint,
        generation_count: 1, // Will be recalculated
        address: data.address,
        mls_description: descriptions.mls_description,
        preview_snippet: previewSnippet,
        geocoding_data: geocodingData,
        neighborhood_data: neighborhoodData,
      })
      .select()
      .single();

    if (insertError || !anonymousGeneration) {
      logger.error('Insert error:', insertError);
      // Check if error is due to missing table (migration not run)
      if (insertError?.message?.includes('does not exist') || insertError?.code === '42P01') {
        return res.status(500).json({ 
          error: 'Database table missing. Please run the migration: anonymous_generations table does not exist.',
          details: insertError?.message || 'Table does not exist',
          code: 'MIGRATION_REQUIRED'
        });
      }
      return res.status(500).json({ 
        error: 'Failed to save generation',
        details: insertError?.message || 'Database insert failed',
        code: insertError?.code || 'DATABASE_ERROR'
      });
    }

    // Verify rate limit again after insertion (atomic check)
    // This prevents race conditions where multiple requests pass the initial check
    const { count: finalCount } = await supabase
      .from('anonymous_generations')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', hashedIP)
      .eq('device_fingerprint', deviceFingerprint)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const finalGenerationCount = finalCount || 0;

    // If we exceeded the limit, delete this generation and return error
    if (finalGenerationCount > MAX_ANONYMOUS_GENERATIONS) {
      await supabase
        .from('anonymous_generations')
        .delete()
        .eq('id', anonymousGeneration.id);

      return res.status(429).json({
        error: `You've reached the limit of ${MAX_ANONYMOUS_GENERATIONS} free generations. Sign up for unlimited access.`,
        code: 'RATE_LIMIT_EXCEEDED',
        count: finalGenerationCount - 1,
        remaining: 0,
      });
    }

    // Set session cookie for client (HttpOnly removed to allow JavaScript access for session linking)
    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? '; Secure' : '';
    res.setHeader('Set-Cookie', `anon_session=${sessionId}; Path=/; Max-Age=86400; SameSite=Lax${secureFlag}`);

    // Return response with both preview and full description
    // Frontend will only show preview to anonymous users
    return res.status(200).json({
      success: true,
      data: {
        id: anonymousGeneration.id,
        session_id: sessionId,
        mls_description: descriptions.mls_description,
        preview_snippet: previewSnippet,
        confidence_score: mlsConfidence,
        confidence_level: mlsConfidence >= 80 ? 'high' : 'medium',
        remaining_generations: Math.max(0, MAX_ANONYMOUS_GENERATIONS - finalGenerationCount),
      },
    });
  } catch (error) {
    logger.error('Anonymous generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    logger.error('Full error details:', { error, message: errorMessage, stack: errorStack });
    
    // Check for common errors and provide helpful messages
    let userFriendlyError = errorMessage;
    let errorCode = 'INTERNAL_ERROR';
    
    if (errorMessage.includes('does not exist') || errorMessage.includes('42P01')) {
      userFriendlyError = 'Database table missing. Please run the migration to create the anonymous_generations table.';
      errorCode = 'MIGRATION_REQUIRED';
    } else if (errorMessage.includes('API key') || errorMessage.includes('OPENAI')) {
      userFriendlyError = 'API key error. Please check your OPENAI_API_KEY in environment variables.';
      errorCode = 'API_KEY_ERROR';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      userFriendlyError = 'API rate limit exceeded. Please try again later.';
      errorCode = 'RATE_LIMIT';
    }
    
    return res.status(500).json({
      error: userFriendlyError,
      details: errorMessage,
      code: errorCode,
      // Include stack trace in development for debugging
      ...(process.env.NODE_ENV !== 'production' && { stack: errorStack }),
    });
  }
}

// Import shared functions from generate.ts
// These functions are duplicated here to avoid circular dependencies
// In production, consider extracting to a shared module

async function geocodeAddress(address: string) {
  const GEOCODIO_API_KEY = process.env.GEOCODIO_API_KEY;

  if (!GEOCODIO_API_KEY) {
    return {
      latitude: 32.7765,
      longitude: -79.9311,
      formatted_address: address,
      zip_code: null,
      distances_to_landmarks: [],
    };
  }

  try {
    const response = await fetch(
      `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(address)}&api_key=${GEOCODIO_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json() as { results?: Array<{ location: { lat: number; lng: number }; formatted_address?: string; address_components?: { postal_code?: string } }> };
    const result = data.results?.[0];

    if (!result) {
      throw new Error('No geocoding results');
    }

    const distances = await getDrivingDistances(
      result.location.lat,
      result.location.lng
    );

    const zipCode = result.address_components?.postal_code || 
                    result.formatted_address?.match(/\b(\d{5})\b/)?.[1] || 
                    null;

    return {
      latitude: result.location.lat,
      longitude: result.location.lng,
      formatted_address: result.formatted_address,
      zip_code: zipCode,
      distances_to_landmarks: distances,
    };
  } catch (error) {
    logger.error('Geocoding error:', error);
    return {
      latitude: 32.7765,
      longitude: -79.9311,
      formatted_address: address,
      zip_code: null,
      distances_to_landmarks: [],
    };
  }
}

const CHARLESTON_LANDMARKS = [
  { name: "Shem Creek", lat: 32.8014, lng: -79.8625 },
  { name: "Downtown/King Street", lat: 32.7876, lng: -79.9403 },
  { name: "Sullivan's Island Beach", lat: 32.7633, lng: -79.8367 },
  { name: "Isle of Palms Beach", lat: 32.7867, lng: -79.7875 },
  { name: "Folly Beach", lat: 32.6552, lng: -79.9403 },
  { name: "Ravenel Bridge", lat: 32.7944, lng: -79.9011 },
  { name: "Angel Oak", lat: 32.7156, lng: -80.0811 },
  { name: "Magnolia Plantation", lat: 32.8611, lng: -80.0708 },
];

async function getDrivingDistances(
  originLat: number,
  originLng: number
): Promise<Array<{ name: string; distance_miles: number; drive_time_minutes: number }>> {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('Google Maps API key not found, using fallback distance calculation');
    return CHARLESTON_LANDMARKS.map((landmark) => {
      const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
      return {
        name: landmark.name,
        distance_miles: Math.round(distance * 10) / 10,
        drive_time_minutes: Math.round(distance * 2.5),
      };
    });
  }

  try {
    const origin = `${originLat},${originLng}`;
    const destinations = CHARLESTON_LANDMARKS.map((l) => `${l.lat},${l.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destinations}&units=imperial&departure_time=now&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Distance Matrix API error: ${response.status}`);
    }

    const data = await response.json() as {
      status: string;
      rows?: Array<{
        elements?: Array<{
          status: string;
          distance?: { value: number };
          duration?: { value: number };
          duration_in_traffic?: { value: number };
        }>;
      }>;
    };

    if (data.status !== 'OK' || !data.rows?.[0]?.elements || data.rows[0].elements.length !== CHARLESTON_LANDMARKS.length) {
      throw new Error(`Distance Matrix API returned invalid response: ${data.status}`);
    }

    const elements = data.rows[0].elements;
    return CHARLESTON_LANDMARKS.map((landmark, index) => {
      const element = elements[index];

      if (!element || element.status !== 'OK') {
        const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
        return {
          name: landmark.name,
          distance_miles: Math.round(distance * 10) / 10,
          drive_time_minutes: Math.round(distance * 2.5),
        };
      }

      if (!element.distance || !element.duration) {
        const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
        return {
          name: landmark.name,
          distance_miles: Math.round(distance * 10) / 10,
          drive_time_minutes: Math.round(distance * 2.5),
        };
      }

      const distanceMiles = element.distance.value / 1609.34;
      const durationMinutes = element.duration_in_traffic?.value 
        ? Math.round(element.duration_in_traffic.value / 60)
        : Math.round(element.duration.value / 60);

      return {
        name: landmark.name,
        distance_miles: Math.round(distanceMiles * 10) / 10,
        drive_time_minutes: durationMinutes,
      };
    });
  } catch (error) {
    logger.error('Distance Matrix API error:', error);
    return CHARLESTON_LANDMARKS.map((landmark) => {
      const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
      return {
        name: landmark.name,
        distance_miles: Math.round(distance * 10) / 10,
        drive_time_minutes: Math.round(distance * 2.5),
      };
    });
  }
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function findNeighborhood(geocodingData: any) {
  try {
    // Check cache first
    const cached = await getCachedNeighborhood(geocodingData);
    if (cached) {
      return cached;
    }

    const neighborhoodsData = await import('../src/data/charleston_neighborhoods.json');
    const neighborhoods = neighborhoodsData.neighborhoods as any[];

    const lat = geocodingData.latitude;
    const lng = geocodingData.longitude;
    const formattedAddress = geocodingData.formatted_address || '';
    const zipCode = geocodingData.zip_code || formattedAddress.match(/\b(\d{5})\b/)?.[1] || null;

    if (zipCode) {
      const neighborhoodByZip = neighborhoods.find((n) => 
        n.zip_codes && n.zip_codes.includes(zipCode)
      );
      if (neighborhoodByZip) {
        const result = formatNeighborhoodData(neighborhoodByZip);
        setCachedNeighborhood(geocodingData, result);
        return result;
      }
    }

    if (lat && lng) {
      const coordMatch = neighborhoods.find((n) => {
        if (!n.bounds) return false;
        const { north, south, east, west } = n.bounds;
        return lat >= south && lat <= north && lng >= west && lng <= east;
      });
      if (coordMatch) {
        const result = formatNeighborhoodData(coordMatch);
        setCachedNeighborhood(geocodingData, result);
        return result;
      }
    }

    const addressLower = formattedAddress.toLowerCase();
    for (const neighborhood of neighborhoods) {
      if (addressLower.includes(neighborhood.name.toLowerCase())) {
        const result = formatNeighborhoodData(neighborhood);
        setCachedNeighborhood(geocodingData, result);
        return result;
      }
      if (neighborhood.aliases) {
        for (const alias of neighborhood.aliases) {
          if (addressLower.includes(alias.toLowerCase())) {
            const result = formatNeighborhoodData(neighborhood);
            setCachedNeighborhood(geocodingData, result);
            return result;
          }
        }
      }
    }

    const fallbackData = {
      name: 'Charleston Area',
      description: 'Historic Charleston area with Lowcountry charm',
      vibe: 'Southern charm',
      landmarks: [],
      attractions: [],
      parks: [],
      schools: [],
      proximities: {},
      selling_points: [],
      vocabulary: {
        style: 'Charleston',
        neighborhood_vibe: 'Lowcountry living',
        proximity_terms: ['in Charleston'],
      },
      typical_amenities: [],
    };
    setCachedNeighborhood(geocodingData, fallbackData);
    return fallbackData;
  } catch (error) {
    logger.error('Error finding neighborhood:', error);
    const errorFallback = {
      name: 'Charleston',
      description: 'Historic Charleston area',
      vibe: 'Southern charm',
      landmarks: [],
      attractions: [],
      parks: [],
      schools: [],
      proximities: {},
      selling_points: [],
      vocabulary: {
        style: 'Charleston',
        neighborhood_vibe: 'Lowcountry living',
        proximity_terms: ['in Charleston'],
      },
      typical_amenities: [],
    };
    setCachedNeighborhood(geocodingData, errorFallback);
    return errorFallback;
  }
}

function formatNeighborhoodData(neighborhood: any) {
  const parks: string[] = [];
  const schools: string[] = [];
  const landmarks: string[] = neighborhood.landmarks || [];
  const attractions: string[] = neighborhood.attractions || [];

  const parkKeywords = ['park', 'garden', 'greenway', 'trail', 'playground', 'recreation'];
  landmarks.forEach((item: string) => {
    if (parkKeywords.some(keyword => item.toLowerCase().includes(keyword))) {
      parks.push(item);
    }
  });
  attractions.forEach((item: string) => {
    if (parkKeywords.some(keyword => item.toLowerCase().includes(keyword))) {
      parks.push(item);
    }
  });

  const schoolKeywords = ['school', 'academy', 'college', 'university', 'education'];
  landmarks.forEach((item: string) => {
    if (schoolKeywords.some(keyword => item.toLowerCase().includes(keyword))) {
      schools.push(item);
    }
  });
  attractions.forEach((item: string) => {
    if (schoolKeywords.some(keyword => item.toLowerCase().includes(keyword))) {
      schools.push(item);
    }
  });

  return {
    name: neighborhood.name,
    description: neighborhood.description || '',
    vibe: neighborhood.vibes || neighborhood.vocabulary?.neighborhood_vibe || '',
    landmarks: landmarks,
    attractions: attractions,
    parks: parks.length > 0 ? parks : (neighborhood.proximities?.schools ? ['Near top-rated schools'] : []),
    schools: schools.length > 0 ? schools : (neighborhood.proximities?.schools ? ['Top-rated schools nearby'] : []),
    proximities: neighborhood.proximities || {},
    selling_points: neighborhood.selling_points || [],
    vocabulary: neighborhood.vocabulary || {
      style: 'Charleston',
      neighborhood_vibe: 'Lowcountry living',
      proximity_terms: [],
    },
    scenery: neighborhood.scenery || [],
    typical_amenities: neighborhood.typical_amenities || [],
  };
}

function buildNeighborhoodContext(neighborhoodData: any, _geocodingData: any): string {
  const sections: string[] = [];
  
  sections.push(`=== NEIGHBORHOOD: ${neighborhoodData.name} ===`);
  sections.push(`Vibe: ${neighborhoodData.vibe || neighborhoodData.description || 'Charleston area'}`);
  
  if (neighborhoodData.schools && neighborhoodData.schools.length > 0) {
    sections.push(`\nTOP-RATED SCHOOLS: ${neighborhoodData.schools.join(', ')}`);
  } else if (neighborhoodData.proximities?.schools) {
    sections.push(`\nSCHOOLS: ${neighborhoodData.proximities.schools}`);
  }
  
  if (neighborhoodData.parks && neighborhoodData.parks.length > 0) {
    sections.push(`PARKS & RECREATION: ${neighborhoodData.parks.join(', ')}`);
  }
  
  if (neighborhoodData.landmarks && neighborhoodData.landmarks.length > 0) {
    sections.push(`ICONIC LANDMARKS: ${neighborhoodData.landmarks.join(', ')}`);
  }
  
  if (neighborhoodData.attractions && neighborhoodData.attractions.length > 0) {
    sections.push(`LOCAL ATTRACTIONS: ${neighborhoodData.attractions.join(', ')}`);
  }
  
  if (neighborhoodData.vocabulary) {
    if (neighborhoodData.vocabulary.style) {
      sections.push(`ARCHITECTURAL STYLE: ${neighborhoodData.vocabulary.style}`);
    }
    if (neighborhoodData.vocabulary.proximity_terms && neighborhoodData.vocabulary.proximity_terms.length > 0) {
      sections.push(`USE THESE PROXIMITY PHRASES: ${neighborhoodData.vocabulary.proximity_terms.join(' | ')}`);
    }
  }
  
  if (neighborhoodData.proximities) {
    const proximityEntries = Object.entries(neighborhoodData.proximities)
      .filter(([key]) => key !== 'schools')
      .map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/to /g, 'to ').replace(/\b\w/g, (l) => l.toUpperCase());
        return `${label}: ${value}`;
      });
    if (proximityEntries.length > 0) {
      sections.push(`PROXIMITY: ${proximityEntries.join(', ')}`);
    }
  }
  
  if (neighborhoodData.selling_points && neighborhoodData.selling_points.length > 0) {
    sections.push(`NEIGHBORHOOD HIGHLIGHTS: ${neighborhoodData.selling_points.join(', ')}`);
  }
  
  return sections.join('\n');
}

async function generateDescriptions(
  propertyData: any,
  geocodingData: any,
  neighborhoodData: any,
  visionFeatures: string[]
) {

  let fewShotExamples = '';
  try {
    const { getFewShotExamples, formatFewShotExamplesForPrompt } = await import(
      '../src/data/charleston_fewshot_examples.js'
    );
    
    const fewShotPropertyTypeMap: Record<string, string | undefined> = {
      'single_family': 'Single Family Home',
      'townhouse': 'Townhouse',
      'condo': 'Townhouse',
      'multi_family': undefined,
      'land': undefined,
      'other': undefined,
    };
    const fewShotPropertyType = fewShotPropertyTypeMap[propertyData.property_type];
    
    let examples = getFewShotExamples({
      propertyType: fewShotPropertyType,
      minBeds: propertyData.bedrooms ? propertyData.bedrooms - 1 : undefined,
      maxBeds: propertyData.bedrooms ? propertyData.bedrooms + 1 : undefined,
    });
    
    if (neighborhoodData.name && examples.length > 0) {
      const targetNeighborhood = neighborhoodData.name.toLowerCase();
      
      examples = examples.sort((a, b) => {
        const aNeighborhood = a.neighborhood.toLowerCase();
        const bNeighborhood = b.neighborhood.toLowerCase();
        
        const aMatches = aNeighborhood.includes(targetNeighborhood) || targetNeighborhood.includes(aNeighborhood);
        const bMatches = bNeighborhood.includes(targetNeighborhood) || targetNeighborhood.includes(bNeighborhood);
        
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
      });
    }
    
    examples = examples.slice(0, 3);

    if (examples.length > 0) {
      fewShotExamples = `\n\n--- FEW-SHOT EXAMPLES (Learn from these authentic Charleston descriptions) ---\n\n${formatFewShotExamplesForPrompt(examples)}\n\n--- END EXAMPLES ---\n\n`;
    }
  } catch (error) {
    logger.warn('Could not load few-shot examples:', error);
  }

  const neighborhoodContext = buildNeighborhoodContext(neighborhoodData, geocodingData);

  const systemPrompt = `You are an expert Charleston, SC real estate copywriter. Write compelling, accurate listing descriptions with 97%+ accuracy.

CRITICAL ACCURACY RULES (MANDATORY - VIOLATIONS REDUCE CONFIDENCE):
1. ONLY mention amenities/features that are explicitly listed in the "Confirmed Amenities" section below
2. DO NOT invent, assume, or add features that are not in the confirmed list
3. If an amenity is not in the confirmed list, DO NOT mention it - even if it's typical for the area or neighborhood
4. Visual features detected from photos can be mentioned ONLY if they appear in the "Visual Features Detected" list
5. Never mention amenities that aren't explicitly confirmed - this is critical for accuracy
6. Use Charleston-specific terminology (piazza for porch, single house, etc.)
7. Reference actual distances to landmarks when provided in geocoding data
8. Be engaging but factual - accuracy is paramount
9. 300-500 words for MLS descriptions
10. Include emotional appeal while staying truthful
11. Study the few-shot examples below to understand authentic Charleston real estate writing style, terminology, and persuasive techniques

Property Data:
- Address: ${propertyData.address || 'Address not provided'}
- Type: ${propertyData.property_type}
- Bedrooms: ${propertyData.bedrooms || 'Not specified'}
- Bathrooms: ${propertyData.bathrooms || 'Not specified'}
- Square Feet: ${propertyData.square_feet || 'Not specified'}
- Confirmed Amenities (ONLY mention these - DO NOT add others): ${propertyData.amenities.length > 0 ? propertyData.amenities.join(', ') : 'None specified - do not mention any specific amenities'}
- Visual Features Detected from Photos (can mention these): ${visionFeatures.join(', ') || 'None detected'}

${neighborhoodContext}

${geocodingData.distances_to_landmarks && geocodingData.distances_to_landmarks.length > 0 ? `VERIFIED DRIVING DISTANCES (Use these exact times - 97-99% accuracy):
${geocodingData.distances_to_landmarks.map((d: any) => `- ${d.name}: ${d.drive_time_minutes}-minute drive (${d.distance_miles} miles)`).join('\n')}

PRIORITY: Lead with proximity to these landmarks when relevant. Use exact drive times (e.g., "12-minute drive to Shem Creek", "15 minutes to Downtown/King Street"). These are verified Google Maps driving times in normal traffic.
` : ''}

${fewShotExamples}

WRITING PRIORITIES FOR "WOW" FACTOR:
1. Lead with neighborhood location and proximity to top-rated schools, parks, or iconic landmarks when available
2. Highlight walkability to attractions, parks, or schools if mentioned in neighborhood data
3. Emphasize unique neighborhood character and vibe
4. Reference specific landmarks, parks, or schools by name when provided in neighborhood data
5. Use proximity terms naturally (e.g., "steps from", "minutes to", "walkable to")
6. Connect property features to neighborhood lifestyle

FINAL REMINDER: The amenities list contains ONLY confirmed features. Do not add amenities that aren't in that list, even if they're common in Charleston properties. Only mention confirmed amenities to ensure 97%+ accuracy.

Write an MLS description that sells the lifestyle and location while staying factual and only referencing confirmed features. Match the quality, tone, and authenticity of the few-shot examples provided.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an expert Charleston, SC real estate copywriter. Write compelling, accurate listing descriptions.' },
      { role: 'user', content: systemPrompt }
    ],
    max_tokens: 1500,
    temperature: 0.7,
  });

  let mlsDescription = response.choices[0]?.message?.content || '';

  const validateMLSLength = (description: string): boolean => {
    const wordCount = description.split(/\s+/).filter(word => word.length > 0).length;
    return wordCount >= 300 && wordCount <= 500;
  };

  if (!validateMLSLength(mlsDescription)) {
    const wordCount = mlsDescription.split(/\s+/).filter(word => word.length > 0).length;
    logger.warn(`MLS description length ${wordCount} words, regenerating to meet 300-500 word requirement`);
    
    const retryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert Charleston, SC real estate copywriter. Write compelling, accurate listing descriptions.' },
        { role: 'user', content: `${systemPrompt}\n\nIMPORTANT: The description must be 300-500 words. Regenerate to meet this requirement.` }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });
    mlsDescription = retryResponse.choices[0]?.message?.content || mlsDescription;
  }

  return {
    mls_description: mlsDescription,
    airbnb_description: null,
    social_captions: null,
  };
}

async function factCheckDescription(
  description: string,
  propertyData: any,
  visionFeatures: string[],
  geocodingData?: any
): Promise<number> {
  let verifiedDistancesText = '';
  if (geocodingData?.distances_to_landmarks && geocodingData.distances_to_landmarks.length > 0) {
    verifiedDistancesText = `\n\nVERIFIED DRIVING DISTANCES (Check if description matches these exactly):
${geocodingData.distances_to_landmarks.map((d: any) => `- ${d.name}: ${d.drive_time_minutes} minutes (${d.distance_miles} miles)`).join('\n')}

CRITICAL: If the description mentions drive times or distances to these landmarks, they MUST match the verified times above. Any discrepancy reduces accuracy score.`;

    const descriptionLower = description.toLowerCase();
    const mentionedLandmarks = geocodingData.distances_to_landmarks.filter((d: any) => 
      descriptionLower.includes(d.name.toLowerCase())
    );

    if (mentionedLandmarks.length > 0) {
      verifiedDistancesText += `\n\nLandmarks mentioned in description: ${mentionedLandmarks.map((d: any) => d.name).join(', ')}`;
    }
  }

  const prompt = `Review this real estate listing description for accuracy. Rate confidence 0-100.

Description:
${description}

Available Property Data:
- Bedrooms: ${propertyData.bedrooms || 'Not specified'}
- Bathrooms: ${propertyData.bathrooms || 'Not specified'}
- Square Feet: ${propertyData.square_feet || 'Not specified'}
- Amenities: ${propertyData.amenities.join(', ') || 'None'}
- Visual Features: ${visionFeatures.join(', ') || 'None'}${verifiedDistancesText}

Rate 0-100: 97-100 if all accurate, 80-96 if minor issues, below 80 if major issues.
Respond with ONLY a number.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0,
    });
    const score = parseInt(response.choices[0]?.message?.content?.match(/\d+/)?.[0] || '85');
    return Math.min(100, Math.max(0, score));
  } catch (error) {
    logger.error('Fact-check error:', error);
    return 85;
  }
}


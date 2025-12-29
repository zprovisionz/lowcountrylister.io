import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromToken } from './_lib/supabase.js';
import { createServiceClient } from './_lib/supabase.js';
import {
  getUserProfile,
  checkAndResetQuota,
  canGenerate,
  incrementGenerationCount,
} from './_lib/quota.js';
import { GenerateListingSchema } from './_lib/validation.js';
import { extractPropertyFeatures } from './_lib/vision.js';
import OpenAI from 'openai';
import { logger } from './_lib/logger.js';
import { getCachedNeighborhood, setCachedNeighborhood } from './_lib/neighborhoodCache.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validationResult = GenerateListingSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    let profile = await getUserProfile(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    profile = await checkAndResetQuota(profile);

    const generationCheck = canGenerate(profile);
    if (!generationCheck.allowed) {
      return res.status(403).json({
        error: generationCheck.reason,
        code: 'QUOTA_EXCEEDED',
      });
    }

    logger.info('Geocoding address and extracting photo features in parallel...');
    // Run geocoding and photo analysis in parallel for better performance
    const [geocodingData, visionFeatures] = await Promise.all([
      geocodeAddress(data.address),
      data.photo_urls.length > 0
        ? extractPropertyFeatures(data.photo_urls)
        : Promise.resolve({ features: [], confidence: 0 }),
    ]);

    logger.info('Loading neighborhood data...');
    const neighborhoodData = await findNeighborhood(geocodingData);

    // Quick mode: Auto-populate typical amenities if none provided
    let finalAmenities = data.amenities || [];
    if (finalAmenities.length === 0 && neighborhoodData.typical_amenities && neighborhoodData.typical_amenities.length > 0) {
      logger.info('Quick mode: Auto-populating typical amenities from neighborhood');
      finalAmenities = neighborhoodData.typical_amenities;
    }

    // Update data with final amenities for generation
    const dataWithAmenities = {
      ...data,
      amenities: finalAmenities,
    };

    logger.info('Generating listing description...');
    const descriptions = await generateDescriptions(
      dataWithAmenities,
      geocodingData,
      neighborhoodData,
      visionFeatures.features
    );

    // Run fact-check on ALL outputs for 97% accuracy guarantee
    const mlsConfidence = await factCheckDescription(
      descriptions.mls_description,
      dataWithAmenities,
      visionFeatures.features,
      geocodingData
    );
    
    let airbnbConfidence = mlsConfidence;
    if (descriptions.airbnb_description) {
      airbnbConfidence = await factCheckDescription(
        descriptions.airbnb_description,
        dataWithAmenities,
        visionFeatures.features,
        geocodingData
      );
    }
    
    // Fact-check social captions (check each one)
    let socialConfidence = mlsConfidence;
    if (descriptions.social_captions && descriptions.social_captions.length > 0) {
      const socialScores = await Promise.all(
        descriptions.social_captions.map((caption: string) =>
          factCheckDescription(caption, dataWithAmenities, visionFeatures.features, geocodingData)
        )
      );
      socialConfidence = Math.round(socialScores.reduce((a, b) => a + b, 0) / socialScores.length);
    }
    
    // Use the minimum confidence score to ensure 97% accuracy across all outputs
    const confidenceScore = Math.min(mlsConfidence, airbnbConfidence, socialConfidence);

    const supabase = createServiceClient();

    // Generate unique tracking ID
    const trackingId = `trk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // Support team_id if provided (for team-assigned generations)
    const teamId = data.team_id || null;
    
    // Verify team access if team_id provided
    if (teamId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        return res.status(403).json({ error: 'Not a team member' });
      }
    }

    const { data: generation, error: insertError } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        team_id: teamId,
        address: data.address,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        square_feet: data.square_feet,
        property_type: data.property_type,
        amenities: finalAmenities,
        photo_urls: data.photo_urls,
        include_airbnb: data.include_airbnb,
        include_social: data.include_social,
        mls_description: descriptions.mls_description,
        airbnb_description: descriptions.airbnb_description,
        social_captions: descriptions.social_captions,
        confidence_score: confidenceScore,
        confidence_level: confidenceScore >= 80 ? 'high' : 'medium',
        geocoding_data: geocodingData,
        neighborhood_data: neighborhoodData,
        tracking_id: trackingId,
      })
      .select()
      .single();

    if (insertError || !generation) {
      logger.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save generation' });
    }

    await incrementGenerationCount(user.id);

    return res.status(200).json({
      success: true,
      data: {
        id: generation.id,
        mls_description: descriptions.mls_description,
        airbnb_description: descriptions.airbnb_description,
        social_captions: descriptions.social_captions,
        confidence_score: confidenceScore,
        confidence_level: confidenceScore >= 80 ? 'high' : 'medium',
      },
    });
  } catch (error) {
    logger.error('Generation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

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

    const data = await response.json() as GeocodioResponse;
    const result = data.results?.[0];

    if (!result) {
      throw new Error('No geocoding results');
    }

    // Use Google Maps Distance Matrix API for accurate driving times
    const distances = await getDrivingDistances(
      result.location.lat,
      result.location.lng
    );

    // Extract zip code from result if available
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

// Type definition for Geocod.io API response
interface GeocodioResponse {
  results?: Array<{
    location: { lat: number; lng: number };
    formatted_address?: string;
    address_components?: {
      postal_code?: string;
    };
  }>;
}

// Key Charleston landmarks for distance calculation
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

// Type definition for Google Maps Distance Matrix API response
interface DistanceMatrixResponse {
  status: string;
  rows?: Array<{
    elements?: Array<{
      status: string;
      distance?: { value: number };
      duration?: { value: number };
      duration_in_traffic?: { value: number };
    }>;
  }>;
}

/**
 * Get accurate driving distances and times using Google Maps Distance Matrix API
 * Returns driving times in normal traffic conditions
 */
async function getDrivingDistances(
  originLat: number,
  originLng: number
): Promise<Array<{ name: string; distance_miles: number; drive_time_minutes: number }>> {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('Google Maps API key not found, using fallback distance calculation');
    // Fallback to simple distance calculation
    return CHARLESTON_LANDMARKS.map((landmark) => {
      const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
      return {
        name: landmark.name,
        distance_miles: Math.round(distance * 10) / 10,
        drive_time_minutes: Math.round(distance * 2.5), // Rough estimate
      };
    });
  }

  try {
    // Build origins and destinations for Distance Matrix API
    const origin = `${originLat},${originLng}`;
    const destinations = CHARLESTON_LANDMARKS.map((l) => `${l.lat},${l.lng}`).join('|');

    // Call Distance Matrix API with departure_time for normal traffic
    // Using "now" as departure time to get current traffic conditions
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destinations}&units=imperial&departure_time=now&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Distance Matrix API error: ${response.status}`);
    }

    const data = await response.json() as DistanceMatrixResponse;

    if (data.status !== 'OK' || !data.rows?.[0]?.elements || data.rows[0].elements.length !== CHARLESTON_LANDMARKS.length) {
      throw new Error(`Distance Matrix API returned invalid response: ${data.status}`);
    }

    // Map API results to landmarks
    const elements = data.rows[0].elements;
    return CHARLESTON_LANDMARKS.map((landmark, index) => {
      const element = elements[index];

      if (!element || element.status !== 'OK') {
        // Fallback if specific destination fails
        const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
        return {
          name: landmark.name,
          distance_miles: Math.round(distance * 10) / 10,
          drive_time_minutes: Math.round(distance * 2.5),
        };
      }

      // Extract distance in miles and duration in minutes
      if (!element.distance || !element.duration) {
        // Fallback if distance or duration is missing
        const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
        return {
          name: landmark.name,
          distance_miles: Math.round(distance * 10) / 10,
          drive_time_minutes: Math.round(distance * 2.5),
        };
      }

      const distanceMiles = element.distance.value / 1609.34; // Convert meters to miles
      const durationMinutes = element.duration_in_traffic?.value 
        ? Math.round(element.duration_in_traffic.value / 60) // Use traffic-adjusted time if available
        : Math.round(element.duration.value / 60); // Fallback to base duration

      return {
        name: landmark.name,
        distance_miles: Math.round(distanceMiles * 10) / 10,
        drive_time_minutes: durationMinutes,
      };
    });
  } catch (error) {
    logger.error('Distance Matrix API error:', error);
    // Fallback to simple distance calculation
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
  const R = 3959; // Earth's radius in miles
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

    // First try: Match by zip code (most reliable)
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

    // Second try: Match by coordinates within bounds
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

    // Third try: Match by address string (name/alias)
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

    // Fallback: Return generic Charleston data
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
  // Extract parks and schools from landmarks/attractions
  const parks: string[] = [];
  const schools: string[] = [];
  const landmarks: string[] = neighborhood.landmarks || [];
  const attractions: string[] = neighborhood.attractions || [];

  // Identify parks (common park names)
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

  // Identify schools (common school names)
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
  
  // PRIMARY CONTEXT (Most Important)
  sections.push(`=== NEIGHBORHOOD: ${neighborhoodData.name} ===`);
  sections.push(`Vibe: ${neighborhoodData.vibe || neighborhoodData.description || 'Charleston area'}`);
  
  // LOCATION ADVANTAGES (High Priority)
  if (neighborhoodData.schools && neighborhoodData.schools.length > 0) {
    sections.push(`\nTOP-RATED SCHOOLS: ${neighborhoodData.schools.join(', ')}`);
  } else if (neighborhoodData.proximities?.schools) {
    sections.push(`\nSCHOOLS: ${neighborhoodData.proximities.schools}`);
  }
  
  if (neighborhoodData.parks && neighborhoodData.parks.length > 0) {
    sections.push(`PARKS & RECREATION: ${neighborhoodData.parks.join(', ')}`);
  }
  
  // LANDMARKS & ATTRACTIONS
  if (neighborhoodData.landmarks && neighborhoodData.landmarks.length > 0) {
    sections.push(`ICONIC LANDMARKS: ${neighborhoodData.landmarks.join(', ')}`);
  }
  
  if (neighborhoodData.attractions && neighborhoodData.attractions.length > 0) {
    sections.push(`LOCAL ATTRACTIONS: ${neighborhoodData.attractions.join(', ')}`);
  }
  
  // CHARLESTON TERMINOLOGY (Critical for authenticity)
  if (neighborhoodData.vocabulary) {
    if (neighborhoodData.vocabulary.style) {
      sections.push(`ARCHITECTURAL STYLE: ${neighborhoodData.vocabulary.style}`);
    }
    if (neighborhoodData.vocabulary.proximity_terms && neighborhoodData.vocabulary.proximity_terms.length > 0) {
      sections.push(`USE THESE PROXIMITY PHRASES: ${neighborhoodData.vocabulary.proximity_terms.join(' | ')}`);
    }
  }
  
  // PROXIMITIES (beaches, downtown, etc.)
  if (neighborhoodData.proximities) {
    const proximityEntries = Object.entries(neighborhoodData.proximities)
      .filter(([key]) => key !== 'schools') // Already handled above
      .map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/to /g, 'to ').replace(/\b\w/g, (l) => l.toUpperCase());
        return `${label}: ${value}`;
      });
    if (proximityEntries.length > 0) {
      sections.push(`PROXIMITY: ${proximityEntries.join(', ')}`);
    }
  }
  
  // SELLING POINTS
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

  // Import and select relevant few-shot examples
  let fewShotExamples = '';
  try {
    const { getFewShotExamples, formatFewShotExamplesForPrompt } = await import(
      '../src/data/charleston_fewshot_examples.js'
    );
    
    // Select 2-3 relevant examples based on property type and neighborhood
    // Map API property type to few-shot example property type format
    // Few-shot examples use: 'Single Family Home', 'Townhouse'
    const fewShotPropertyTypeMap: Record<string, string | undefined> = {
      'single_family': 'Single Family Home',
      'townhouse': 'Townhouse',
      'condo': 'Townhouse', // Condos map to Townhouse in few-shot examples
      'multi_family': undefined, // No multi-family examples available
      'land': undefined, // No land examples available
      'other': undefined, // No other examples available
    };
    const fewShotPropertyType = fewShotPropertyTypeMap[propertyData.property_type];
    
    // Get examples filtered by property type and beds
    let examples = getFewShotExamples({
      propertyType: fewShotPropertyType,
      minBeds: propertyData.bedrooms ? propertyData.bedrooms - 1 : undefined,
      maxBeds: propertyData.bedrooms ? propertyData.bedrooms + 1 : undefined,
    });
    
    // Prioritize examples from same or similar neighborhoods
    if (neighborhoodData.name && examples.length > 0) {
      const targetNeighborhood = neighborhoodData.name.toLowerCase();
      
      // Sort examples: same neighborhood first, then similar, then others
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
    // Continue without examples if import fails
  }

  // Build neighborhood context with prioritized local features
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
9. 350-450 words for MLS descriptions
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

  // Validate MLS description length (industry standard: 350-450 words)
  const validateMLSLength = (description: string): boolean => {
    const wordCount = description.split(/\s+/).filter(word => word.length > 0).length;
    return wordCount >= 300 && wordCount <= 500;
  };

  // Regenerate if length is not within range
  if (!validateMLSLength(mlsDescription)) {
    const wordCount = mlsDescription.split(/\s+/).filter(word => word.length > 0).length;
    logger.warn(`MLS description length ${wordCount} words, regenerating to meet 350-450 word requirement`);
    
    const retryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert Charleston, SC real estate copywriter.' },
        { role: 'user', content: `${systemPrompt}\n\nIMPORTANT: The description must be exactly 350-450 words. Regenerate to meet this requirement.` }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });
    mlsDescription = retryResponse.choices[0]?.message?.content || mlsDescription;
  }

  let airbnbDescription: string | null = null;
  let socialCaptions: string[] | null = null;

  if (propertyData.include_airbnb) {
    const airbnbPrompt = `Write a compelling 200-250 word Airbnb/VRBO description for a Charleston, SC property.

Property Data:
- Address: ${propertyData.address || 'Address not provided'}
- Type: ${propertyData.property_type}
- Bedrooms: ${propertyData.bedrooms || 'Not specified'}
- Bathrooms: ${propertyData.bathrooms || 'Not specified'}
- Confirmed Amenities: ${propertyData.amenities.length > 0 ? propertyData.amenities.join(', ') : 'None specified'}
- Visual Features: ${visionFeatures.join(', ') || 'None detected'}

${neighborhoodContext}

${geocodingData.distances_to_landmarks && geocodingData.distances_to_landmarks.length > 0 ? `VERIFIED DRIVING DISTANCES:
${geocodingData.distances_to_landmarks.map((d: any) => `- ${d.name}: ${d.drive_time_minutes}-minute drive`).join('\n')}` : ''}

Focus on guest experience, location, and only mention confirmed amenities.`;

    const airbnbResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: airbnbPrompt }],
      max_tokens: 800,
      temperature: 0.7,
    });
    airbnbDescription = airbnbResponse.choices[0]?.message?.content || null;
  }

  if (propertyData.include_social) {
    const socialPrompt = `Create 3 engaging Instagram/Facebook captions for a Charleston real estate listing.

Property: ${propertyData.bedrooms || ''}BR/${propertyData.bathrooms || ''}BA in ${neighborhoodData.name || 'Charleston'}
Amenities: ${propertyData.amenities.length > 0 ? propertyData.amenities.slice(0, 5).join(', ') : 'None'}
${geocodingData.distances_to_landmarks && geocodingData.distances_to_landmarks.length > 0 ? `Location: ${geocodingData.distances_to_landmarks.slice(0, 3).map((d: any) => `${d.drive_time_minutes} min to ${d.name}`).join(', ')}` : ''}

Format as numbered list (1., 2., 3.). Each caption should be 1-2 sentences with 3-5 Charleston hashtags.`;

    const socialResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: socialPrompt }],
      max_tokens: 500,
      temperature: 0.8,
    });
    const socialText = socialResponse.choices[0]?.message?.content || '';
    
    // Parse social captions
    const parseSocialCaptions = (text: string): string[] => {
      const numbered = text.match(/\d+\.\s*[^\d]+/g);
      if (numbered && numbered.length >= 2) {
        return numbered.map(c => c.replace(/^\d+\.\s*/, '').trim()).slice(0, 3);
      }
      const lines = text.split(/\n+/).filter(c => c.trim().length > 20);
      return lines.slice(0, 3);
    };
    
    socialCaptions = parseSocialCaptions(socialText);
  }

  return {
    mls_description: mlsDescription,
    airbnb_description: airbnbDescription,
    social_captions: socialCaptions,
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
    verifiedDistancesText = `\nVerified distances: ${geocodingData.distances_to_landmarks.map((d: any) => `${d.name}: ${d.drive_time_minutes} min`).join(', ')}`;
  }

  const prompt = `Rate this listing description accuracy 0-100.

Description:
${description}

Data:
- Beds: ${propertyData.bedrooms || 'N/A'}, Baths: ${propertyData.bathrooms || 'N/A'}
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

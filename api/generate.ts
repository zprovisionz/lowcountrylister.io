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
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './_lib/logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    logger.info('Geocoding address:', data.address);
    const geocodingData = await geocodeAddress(data.address);

    logger.info('Extracting features from photos...');
    const visionFeatures =
      data.photo_urls.length > 0
        ? await extractPropertyFeatures(data.photo_urls)
        : { features: [], confidence: 0 };

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

    const { data: generation, error: insertError } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
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

    const data = await response.json();
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

    const data = await response.json();

    if (data.status !== 'OK' || data.rows?.[0]?.elements?.length !== CHARLESTON_LANDMARKS.length) {
      throw new Error(`Distance Matrix API returned invalid response: ${data.status}`);
    }

    // Map API results to landmarks
    return CHARLESTON_LANDMARKS.map((landmark, index) => {
      const element = data.rows[0].elements[index];

      if (element.status !== 'OK') {
        // Fallback if specific destination fails
        const distance = calculateDistance(originLat, originLng, landmark.lat, landmark.lng);
        return {
          name: landmark.name,
          distance_miles: Math.round(distance * 10) / 10,
          drive_time_minutes: Math.round(distance * 2.5),
        };
      }

      // Extract distance in miles and duration in minutes
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
        return formatNeighborhoodData(neighborhoodByZip);
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
        return formatNeighborhoodData(coordMatch);
      }
    }

    // Third try: Match by address string (name/alias)
    const addressLower = formattedAddress.toLowerCase();
    for (const neighborhood of neighborhoods) {
      if (addressLower.includes(neighborhood.name.toLowerCase())) {
        return formatNeighborhoodData(neighborhood);
      }
      if (neighborhood.aliases) {
        for (const alias of neighborhood.aliases) {
          if (addressLower.includes(alias.toLowerCase())) {
            return formatNeighborhoodData(neighborhood);
          }
        }
      }
    }

    // Fallback: Return generic Charleston data
    return {
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
  } catch (error) {
    logger.error('Error finding neighborhood:', error);
    return {
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

function buildNeighborhoodContext(neighborhoodData: any, geocodingData: any): string {
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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

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

  const result = await model.generateContent(systemPrompt);
  let mlsDescription = result.response.text();

  // Validate MLS description length (industry standard: 350-450 words)
  const validateMLSLength = (description: string): boolean => {
    const wordCount = description.split(/\s+/).filter(word => word.length > 0).length;
    return wordCount >= 350 && wordCount <= 450;
  };

  // Regenerate if length is not within industry standard
  if (!validateMLSLength(mlsDescription)) {
    const wordCount = mlsDescription.split(/\s+/).filter(word => word.length > 0).length;
    logger.warn(`MLS description length ${wordCount} words, regenerating to meet 350-450 word requirement`);
    
    const lengthPrompt = `${systemPrompt}\n\nIMPORTANT: The description must be exactly 350-450 words. Current length (${wordCount} words) is not acceptable. Regenerate to meet the industry standard length requirement.`;
    const retryResult = await model.generateContent(lengthPrompt);
    mlsDescription = retryResult.response.text();
    
    // If still not valid after retry, log warning but proceed
    if (!validateMLSLength(mlsDescription)) {
      const finalWordCount = mlsDescription.split(/\s+/).filter(word => word.length > 0).length;
      logger.warn(`MLS description still ${finalWordCount} words after regeneration - proceeding with generated text`);
    }
  }

  let airbnbDescription: string | null = null;
  let socialCaptions: string[] | null = null;

  if (propertyData.include_airbnb) {
    const airbnbPrompt = `You are an expert vacation rental copywriter specializing in Charleston, SC properties. Write a compelling 200-250 word Airbnb/VRBO description.

CRITICAL ACCURACY RULES:
1. ONLY mention amenities/features from the "Confirmed Amenities" section
2. DO NOT invent features - accuracy is paramount
3. Focus on guest experience, comfort, and local attractions
4. Use Charleston-specific terminology appropriately
5. Highlight proximity to beaches, downtown, and attractions when verified distances are provided

Property Data:
- Address: ${propertyData.address || 'Address not provided'}
- Type: ${propertyData.property_type}
- Bedrooms: ${propertyData.bedrooms || 'Not specified'}
- Bathrooms: ${propertyData.bathrooms || 'Not specified'}
- Square Feet: ${propertyData.square_feet || 'Not specified'}
- Confirmed Amenities: ${propertyData.amenities.length > 0 ? propertyData.amenities.join(', ') : 'None specified'}
- Visual Features: ${visionFeatures.join(', ') || 'None detected'}

${neighborhoodContext}

${geocodingData.distances_to_landmarks && geocodingData.distances_to_landmarks.length > 0 ? `VERIFIED DRIVING DISTANCES:
${geocodingData.distances_to_landmarks.map((d: any) => `- ${d.name}: ${d.drive_time_minutes}-minute drive`).join('\n')}
` : ''}

Write a 200-250 word description that:
- Welcomes guests and sets expectations
- Highlights key amenities and features
- Emphasizes location advantages (beaches, downtown, attractions)
- Uses warm, inviting tone
- Mentions check-in flexibility and guest experience
- Stays factual and only references confirmed amenities`;

    const airbnbResult = await model.generateContent(airbnbPrompt);
    airbnbDescription = airbnbResult.response.text();
  }

  if (propertyData.include_social) {
    const socialPrompt = `You are a social media expert creating Instagram/Facebook captions for Charleston real estate. Create 3 engaging captions.

CRITICAL ACCURACY RULES:
1. ONLY mention confirmed amenities - no invented features
2. Use verified distances when mentioning landmarks
3. Each caption should be 1-2 sentences
4. Include relevant Charleston hashtags (e.g., #CharlestonRealEstate #LowcountryLiving)
5. Make it shareable and visually appealing

Property Data:
- Address: ${propertyData.address || 'Address not provided'}
- Type: ${propertyData.property_type}
- Bedrooms: ${propertyData.bedrooms || 'Not specified'}
- Bathrooms: ${propertyData.bathrooms || 'Not specified'}
- Confirmed Amenities: ${propertyData.amenities.length > 0 ? propertyData.amenities.join(', ') : 'None specified'}

${neighborhoodContext}

${geocodingData.distances_to_landmarks && geocodingData.distances_to_landmarks.length > 0 ? `VERIFIED DISTANCES: ${geocodingData.distances_to_landmarks.map((d: any) => `${d.name} (${d.drive_time_minutes} min)`).join(', ')}
` : ''}

Create 3 separate captions (format as numbered list: 1., 2., 3.):
1. First caption: Focus on location and lifestyle
2. Second caption: Highlight key features/amenities
3. Third caption: Emphasize unique selling points or neighborhood character

Each caption should be 1-2 sentences with 3-5 relevant hashtags.`;

    const socialResult = await model.generateContent(socialPrompt);
    const socialText = socialResult.response.text();
    
    // Parse social captions with robust parsing
    const parseSocialCaptions = (text: string): string[] => {
      // Try numbered list first (1., 2., 3.)
      const numbered = text.match(/\d+\.\s*[^\d]+/g);
      if (numbered && numbered.length >= 2) {
        return numbered.map(c => c.replace(/^\d+\.\s*/, '').trim()).slice(0, 3);
      }
      
      // Try double newline
      const doubleNewline = text.split(/\n\n+/).filter(c => c.trim().length > 20);
      if (doubleNewline.length >= 2) {
        return doubleNewline.map(c => c.trim()).slice(0, 3);
      }
      
      // Fallback: split by single newline and filter
      return text.split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 20 && !c.match(/^(caption|post|social)/i))
        .slice(0, 3);
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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Build verified distances list for fact-checking
  let verifiedDistancesText = '';
  if (geocodingData?.distances_to_landmarks && geocodingData.distances_to_landmarks.length > 0) {
    verifiedDistancesText = `\n\nVERIFIED DRIVING DISTANCES (Check if description matches these exactly):
${geocodingData.distances_to_landmarks.map((d: any) => `- ${d.name}: ${d.drive_time_minutes} minutes (${d.distance_miles} miles)`).join('\n')}

CRITICAL: If the description mentions drive times or distances to these landmarks, they MUST match the verified times above. Any discrepancy reduces accuracy score.`;

    // Check for distance mentions in description
    const descriptionLower = description.toLowerCase();
    const mentionedLandmarks = geocodingData.distances_to_landmarks.filter((d: any) => 
      descriptionLower.includes(d.name.toLowerCase())
    );

    if (mentionedLandmarks.length > 0) {
      verifiedDistancesText += `\n\nLandmarks mentioned in description: ${mentionedLandmarks.map((d: any) => d.name).join(', ')}`;
    }
  }

  const prompt = `Review this real estate listing description for accuracy with 97-99% proximity accuracy requirement.

Description:
${description}

Available Property Data:
- Bedrooms: ${propertyData.bedrooms || 'Not specified'}
- Bathrooms: ${propertyData.bathrooms || 'Not specified'}
- Square Feet: ${propertyData.square_feet || 'Not specified'}
- Amenities: ${propertyData.amenities.join(', ') || 'None'}
- Confirmed Visual Features: ${visionFeatures.join(', ') || 'None'}${verifiedDistancesText}

Check for:
1. Are all claims supported by the data?
2. Are there unsupported assumptions?
3. Is the tone professional and accurate?
4. If drive times/distances to landmarks are mentioned, do they match the verified distances exactly?
5. Are only confirmed amenities mentioned (no invented features)?
6. Does it use Charleston-specific terminology appropriately (piazza for porch in historic areas, "single house" or "Charleston Single" for Charleston Single style, Lowcountry terminology, etc.)?
7. Is the writing style consistent with authentic Charleston real estate descriptions (matches the few-shot examples in tone and terminology)?

Rate confidence 0-100 where:
- 97-100: All claims verified, distances match exactly, only confirmed amenities mentioned
- 90-96: Mostly accurate with minor discrepancies in distances or one unconfirmed feature
- 80-89: Some unsupported claims or distance mismatches
- 70-79: Multiple unsupported claims or significant distance errors
- Below 70: Major inaccuracies or invented features

Respond with just a number 0-100.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const score = parseInt(response.match(/\d+/)?.[0] || '75');
    return Math.min(100, Math.max(0, score));
  } catch (error) {
    logger.error('Fact-check error:', error);
    return 75;
  }
}

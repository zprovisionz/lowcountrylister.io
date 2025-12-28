import { logger } from './logger.js';

interface CachedNeighborhood {
  data: any;
  timestamp: number;
}

// In-memory cache for neighborhood data
// Neighborhood data rarely changes, so we cache it for 1 hour
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const neighborhoodCache = new Map<string, CachedNeighborhood>();

/**
 * Get neighborhood data from cache or load it
 * Cache key is based on zip code, coordinates, or address
 */
export async function getCachedNeighborhood(
  geocodingData: any
): Promise<any | null> {
  // Generate cache key from geocoding data
  const cacheKey = generateCacheKey(geocodingData);
  
  // Check cache
  const cached = neighborhoodCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Neighborhood cache hit:', cacheKey);
    return cached.data;
  }

  // Cache miss - return null to indicate data needs to be loaded
  return null;
}

/**
 * Store neighborhood data in cache
 */
export function setCachedNeighborhood(
  geocodingData: any,
  neighborhoodData: any
): void {
  const cacheKey = generateCacheKey(geocodingData);
  neighborhoodCache.set(cacheKey, {
    data: neighborhoodData,
    timestamp: Date.now(),
  });
  logger.debug('Neighborhood cached:', cacheKey);
}

/**
 * Generate cache key from geocoding data
 * Uses zip code (most reliable), then coordinates, then address
 */
function generateCacheKey(geocodingData: any): string {
  if (geocodingData.zip_code) {
    return `zip:${geocodingData.zip_code}`;
  }
  
  if (geocodingData.latitude && geocodingData.longitude) {
    // Round coordinates to 2 decimal places for cache key (approx 1km precision)
    const lat = Math.round(geocodingData.latitude * 100) / 100;
    const lng = Math.round(geocodingData.longitude * 100) / 100;
    return `coord:${lat},${lng}`;
  }
  
  // Fallback to address (less reliable but better than nothing)
  const address = (geocodingData.formatted_address || '').toLowerCase().trim();
  return `addr:${address.substring(0, 50)}`; // Limit length
}

/**
 * Clear expired cache entries
 * Can be called periodically to prevent memory leaks
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  let cleared = 0;
  
  for (const [key, cached] of neighborhoodCache.entries()) {
    if (now - cached.timestamp >= CACHE_TTL) {
      neighborhoodCache.delete(key);
      cleared++;
    }
  }
  
  if (cleared > 0) {
    logger.debug(`Cleared ${cleared} expired neighborhood cache entries`);
  }
}


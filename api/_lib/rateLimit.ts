import { createServiceClient } from './supabase.js';
import { getClientIP, hashIP, generateDeviceFingerprint } from './fingerprint.js';
import type { VercelRequest } from '@vercel/node';
import { logger } from './logger.js';

const MAX_ANONYMOUS_GENERATIONS = 3;
const RATE_LIMIT_WINDOW_HOURS = 24;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  count: number;
  remaining: number;
}

/**
 * Check if anonymous user has exceeded rate limit
 * Uses IP address + device fingerprint combination
 */
export async function checkAnonymousRateLimit(
  req: VercelRequest
): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient();
    
    // Get and hash IP address
    const clientIP = getClientIP(req);
    const hashedIP = hashIP(clientIP);
    
    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // Query for generations in last 24 hours
    const { data, error } = await supabase
      .from('anonymous_generations')
      .select('id', { count: 'exact' })
      .eq('ip_address', hashedIP)
      .eq('device_fingerprint', deviceFingerprint)
      .gte('created_at', new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString());
    
    if (error) {
      logger.error('Rate limit check error:', error);
      // On error, allow the request (graceful degradation)
      return {
        allowed: true,
        count: 0,
        remaining: MAX_ANONYMOUS_GENERATIONS,
      };
    }
    
    const count = data?.length || 0;
    const remaining = Math.max(0, MAX_ANONYMOUS_GENERATIONS - count);
    const allowed = count < MAX_ANONYMOUS_GENERATIONS;
    
    if (!allowed) {
      return {
        allowed: false,
        reason: `You've reached the limit of ${MAX_ANONYMOUS_GENERATIONS} free generations. Sign up for unlimited access.`,
        count,
        remaining: 0,
      };
    }
    
    return {
      allowed: true,
      count,
      remaining,
    };
  } catch (error) {
    logger.error('Rate limit check exception:', error);
    // On exception, allow the request (graceful degradation)
    return {
      allowed: true,
      count: 0,
      remaining: MAX_ANONYMOUS_GENERATIONS,
    };
  }
}

/**
 * Increment generation count for anonymous user
 * Called after successful generation
 */
export async function incrementAnonymousGenerationCount(
  req: VercelRequest,
  sessionId: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    
    const clientIP = getClientIP(req);
    const hashedIP = hashIP(clientIP);
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // This is just for tracking - the actual generation is stored separately
    // We don't need to do anything here as the generation itself increments the count
    logger.info('Anonymous generation tracked', {
      sessionId,
      hashedIP: hashedIP.substring(0, 8) + '...',
      fingerprint: deviceFingerprint.substring(0, 8) + '...',
    });
  } catch (error) {
    logger.error('Failed to increment anonymous generation count:', error);
    // Non-critical, don't throw
  }
}


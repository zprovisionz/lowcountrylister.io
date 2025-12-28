import { createHash } from 'crypto';
import type { VercelRequest } from '@vercel/node';

/**
 * Generate a device fingerprint from request headers and metadata
 * Uses multiple signals to create a unique but privacy-preserving identifier
 */
export function generateDeviceFingerprint(req: VercelRequest): string {
  // Collect fingerprint components
  const components: string[] = [];

  // User-Agent (browser and OS info)
  const userAgent = req.headers['user-agent'] || '';
  components.push(`ua:${userAgent}`);

  // Accept-Language (language preferences)
  const acceptLanguage = req.headers['accept-language'] || '';
  components.push(`lang:${acceptLanguage}`);

  // Accept-Encoding (compression support)
  const acceptEncoding = req.headers['accept-encoding'] || '';
  components.push(`enc:${acceptEncoding}`);

  // Screen resolution (if available in headers - some clients send this)
  const screen = req.headers['x-screen-resolution'] || '';
  if (screen) {
    components.push(`screen:${screen}`);
  }

  // Timezone (if available in headers)
  const timezone = req.headers['x-timezone'] || '';
  if (timezone) {
    components.push(`tz:${timezone}`);
  }

  // Combine all components
  const fingerprintString = components.join('|');

  // Hash with SHA-256 for privacy
  return createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Get IP address from request (handles Vercel proxy headers)
 */
export function getClientIP(req: VercelRequest): string {
  // Vercel provides the real IP in x-forwarded-for or x-vercel-forwarded-for
  const forwardedFor = req.headers['x-forwarded-for'] || req.headers['x-vercel-forwarded-for'];
  
  if (typeof forwardedFor === 'string') {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to connection remote address
  return (req.headers['x-real-ip'] as string) || 
         (req.socket?.remoteAddress) || 
         'unknown';
}

/**
 * Hash IP address for privacy (SHA-256)
 */
export function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Generate anonymous session ID (if not provided in cookie)
 */
export function generateSessionId(): string {
  return createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Get session ID from request (cookie or generate new)
 */
export function getSessionId(req: VercelRequest): string {
  // Check for session cookie
  const cookies = req.headers.cookie || '';
  const sessionMatch = cookies.match(/anon_session=([^;]+)/);
  
  if (sessionMatch && sessionMatch[1]) {
    return sessionMatch[1];
  }

  // Generate new session ID if not found
  return generateSessionId();
}


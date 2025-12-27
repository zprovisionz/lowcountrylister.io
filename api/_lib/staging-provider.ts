import { logger } from './logger';

export interface StagingRequest {
  image_url: string;
  room_type: string;
  style: string;
}

export interface StagingResponse {
  success: boolean;
  job_id?: string;
  status?: string;
  result_url?: string;
  error?: string;
  provider: 'reimagine' | 'virtualstagingai' | 'fallback';
}

const REIMAGINE_API_URL = 'https://api.reimaginehome.ai/api/v1';
const FALLBACK_API_URL = 'https://api.virtualstagingai.app/v1';

const styleMapping: Record<string, string> = {
  coastal_modern: 'modern',
  lowcountry_traditional: 'traditional',
  charleston_classic: 'traditional', // Historic elegance = traditional style
  contemporary_coastal: 'contemporary', // Modern coastal = contemporary
  minimalist: 'modern', // Minimalist = modern/clean
  // Keep existing mappings
  contemporary: 'contemporary',
  transitional: 'transitional',
  farmhouse: 'farmhouse',
  luxury: 'luxury',
};

const roomTypeMapping: Record<string, string> = {
  living_room: 'living_room',
  bedroom: 'bedroom',
  kitchen: 'kitchen',
  dining_room: 'dining_room',
  bathroom: 'bathroom',
  office: 'home_office',
  other: 'living_room',
};

export async function requestStaging(
  request: StagingRequest,
  useFallback: boolean = false
): Promise<StagingResponse> {
  const provider = useFallback ? 'fallback' : 'reimagine';
  const apiKey = useFallback
    ? process.env.STAGING_API_KEY_FALLBACK
    : process.env.STAGING_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'Staging service not configured',
      provider,
    };
  }

  try {
    if (provider === 'reimagine') {
      return await requestREimagineStaging(request, apiKey);
    } else {
      return await requestFallbackStaging(request, apiKey);
    }
  } catch (error) {
    logger.error(`${provider} staging error:`, error);

    if (!useFallback) {
      logger.info('Attempting fallback provider...');
      return requestStaging(request, true);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
    };
  }
}

async function requestREimagineStaging(
  request: StagingRequest,
  apiKey: string
): Promise<StagingResponse> {
  const response = await fetch(`${REIMAGINE_API_URL}/staging`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: request.image_url,
      room_type: roomTypeMapping[request.room_type] || 'living_room',
      style: styleMapping[request.style] || 'modern',
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`REimagine API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    success: true,
    job_id: data.job_id || data.id,
    status: data.status || 'processing',
    provider: 'reimagine',
  };
}

async function requestFallbackStaging(
  request: StagingRequest,
  apiKey: string
): Promise<StagingResponse> {
  const response = await fetch(`${FALLBACK_API_URL}/stage`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: request.image_url,
      room: roomTypeMapping[request.room_type] || 'living_room',
      style: styleMapping[request.style] || 'modern',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Fallback API error: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  return {
    success: true,
    job_id: data.job_id || data.request_id,
    status: data.status || 'processing',
    provider: 'fallback',
  };
}

export async function checkStagingStatus(
  jobId: string,
  provider: 'reimagine' | 'virtualstagingai' | 'fallback'
): Promise<StagingResponse> {
  const apiKey =
    provider === 'reimagine'
      ? process.env.STAGING_API_KEY
      : process.env.STAGING_API_KEY_FALLBACK;

  if (!apiKey) {
    return {
      success: false,
      error: 'Staging service not configured',
      provider,
    };
  }

  try {
    if (provider === 'reimagine') {
      const response = await fetch(`${REIMAGINE_API_URL}/staging/${jobId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        job_id: jobId,
        status: data.status,
        result_url: data.result_url || data.output_url,
        provider,
      };
    } else {
      const response = await fetch(`${FALLBACK_API_URL}/status/${jobId}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        job_id: jobId,
        status: data.status,
        result_url: data.staged_image_url || data.result,
        provider,
      };
    }
  } catch (error) {
    logger.error(`${provider} status check error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
    };
  }
}

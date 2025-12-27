import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface RoomAnalysis {
  is_suitable: boolean;
  room_type?: string;
  confidence: number;
  reason?: string;
}

export async function analyzePhotoForStaging(
  photoUrl: string
): Promise<RoomAnalysis> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze this real estate photo and determine if it's suitable for virtual staging.

Rules:
- ONLY interior rooms that are empty or sparsely furnished are suitable
- Exterior photos, landscaping, or architectural exteriors are NOT suitable
- Already fully furnished rooms are NOT suitable
- Photos with people, animals, or major clutter are NOT suitable

Respond in JSON format:
{
  "is_suitable": boolean,
  "room_type": "living_room" | "bedroom" | "kitchen" | "dining_room" | "bathroom" | "office" | "other" | null,
  "confidence": 0-100,
  "reason": "brief explanation"
}`;

    const imagePart = {
      inlineData: {
        data: await fetchImageAsBase64(photoUrl),
        mimeType: 'image/jpeg',
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return analysis;
    }

    return {
      is_suitable: false,
      confidence: 0,
      reason: 'Unable to analyze photo',
    };
  } catch (error) {
    console.error('Vision API error:', error);
    return {
      is_suitable: false,
      confidence: 0,
      reason: 'Error analyzing photo',
    };
  }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return base64;
}

export async function extractPropertyFeatures(photoUrls: string[]): Promise<{
  features: string[];
  confidence: number;
}> {
  try {
    if (photoUrls.length === 0) {
      return { features: [], confidence: 0 };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze these real estate photos and identify key features visible in the images.

Be CONSERVATIVE - only mention features you can clearly see.

Categories to consider:
- Flooring (hardwood, tile, carpet, etc.)
- Kitchen features (granite counters, stainless appliances, island, etc.)
- Bathroom features (tiled shower, double vanity, etc.)
- Architectural details (crown molding, coffered ceilings, exposed beams, etc.)
- Windows and natural light
- Built-ins and storage
- Outdoor features visible (deck, patio, pool, etc.)

Return JSON array of features:
{
  "features": ["feature1", "feature2", ...],
  "confidence": 0-100
}`;

    const imageParts = await Promise.all(
      photoUrls.slice(0, 5).map(async (url) => ({
        inlineData: {
          data: await fetchImageAsBase64(url),
          mimeType: 'image/jpeg',
        },
      }))
    );

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return analysis;
    }

    return { features: [], confidence: 50 };
  } catch (error) {
    console.error('Feature extraction error:', error);
    return { features: [], confidence: 0 };
  }
}

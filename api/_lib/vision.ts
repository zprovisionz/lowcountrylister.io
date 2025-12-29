import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this real estate photo for virtual staging suitability.

Rules:
- ONLY interior rooms that are empty or sparsely furnished are suitable
- Exterior photos are NOT suitable
- Already fully furnished rooms are NOT suitable

Respond in JSON format:
{"is_suitable": boolean, "room_type": "living_room"|"bedroom"|"kitchen"|"dining_room"|"bathroom"|"office"|"other"|null, "confidence": 0-100, "reason": "brief explanation"}`
            },
            {
              type: 'image_url',
              image_url: { url: photoUrl }
            }
          ]
        }
      ],
      max_tokens: 200,
    });

    const text = response.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { is_suitable: false, confidence: 0, reason: 'Unable to analyze photo' };
  } catch (error) {
    console.error('Vision API error:', error);
    return { is_suitable: false, confidence: 0, reason: 'Error analyzing photo' };
  }
}

export async function extractPropertyFeatures(photoUrls: string[]): Promise<{
  features: string[];
  confidence: number;
}> {
  try {
    if (photoUrls.length === 0) {
      return { features: [], confidence: 0 };
    }

    const imageContents = photoUrls.slice(0, 4).map(url => ({
      type: 'image_url' as const,
      image_url: { url }
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze these real estate photos. List ONLY clearly visible features.

Categories: flooring, kitchen features, bathroom features, architectural details, windows, outdoor features.

Return JSON: {"features": ["feature1", "feature2"], "confidence": 0-100}`
            },
            ...imageContents
          ]
        }
      ],
      max_tokens: 300,
    });

    const text = response.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { features: [], confidence: 50 };
  } catch (error) {
    console.error('Feature extraction error:', error);
    return { features: [], confidence: 0 };
  }
}

import neighborhoodsData from '../data/charleston_neighborhoods.json';

export interface Neighborhood {
  name: string;
  aliases: string[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zip_codes: string[];
  description: string;
  vibes?: string;
  attractions?: string[];
  scenery?: string[];
  proximities?: Record<string, string>;
  typical_amenities: string[];
  vocabulary: {
    porch?: string;
    balcony?: string;
    style: string;
    neighborhood_vibe: string;
    proximity_terms: string[];
  };
  landmarks: string[];
  selling_points: string[];
}

export interface NeighborhoodDetectionResult {
  neighborhood: Neighborhood | null;
  confidence: 'high' | 'medium' | 'low';
  method: 'zip' | 'name' | 'coordinates' | 'none';
}

class NeighborhoodService {
  private neighborhoods: Neighborhood[];

  constructor() {
    this.neighborhoods = neighborhoodsData.neighborhoods as unknown as Neighborhood[];
  }

  detectNeighborhood(address: string): NeighborhoodDetectionResult {
    const addressLower = address.toLowerCase();

    const zipMatch = address.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const zip = zipMatch[1];
      const neighborhood = this.neighborhoods.find((n) =>
        n.zip_codes.includes(zip)
      );
      if (neighborhood) {
        return {
          neighborhood,
          confidence: 'high',
          method: 'zip',
        };
      }
    }

    for (const neighborhood of this.neighborhoods) {
      if (addressLower.includes(neighborhood.name.toLowerCase())) {
        return {
          neighborhood,
          confidence: 'high',
          method: 'name',
        };
      }

      for (const alias of neighborhood.aliases) {
        if (addressLower.includes(alias.toLowerCase())) {
          return {
            neighborhood,
            confidence: 'high',
            method: 'name',
          };
        }
      }
    }

    if (addressLower.includes('charleston') || addressLower.includes('sc')) {
      return {
        neighborhood: null,
        confidence: 'low',
        method: 'none',
      };
    }

    return {
      neighborhood: null,
      confidence: 'low',
      method: 'none',
    };
  }

  getNeighborhoodByName(name: string): Neighborhood | null {
    return (
      this.neighborhoods.find(
        (n) =>
          n.name.toLowerCase() === name.toLowerCase() ||
          n.aliases.some((a) => a.toLowerCase() === name.toLowerCase())
      ) || null
    );
  }

  getAllNeighborhoods(): Neighborhood[] {
    return this.neighborhoods;
  }

  getTypicalAmenities(neighborhood: Neighborhood): string[] {
    return neighborhood.typical_amenities;
  }

  getProximityTerms(neighborhood: Neighborhood): string[] {
    return neighborhood.vocabulary.proximity_terms;
  }

  getLandmarks(neighborhood: Neighborhood): string[] {
    return neighborhood.landmarks;
  }

  getNeighborhoodVibe(neighborhood: Neighborhood): string {
    return neighborhood.vocabulary.neighborhood_vibe;
  }

  getSellingPoints(neighborhood: Neighborhood): string[] {
    return neighborhood.selling_points;
  }

  getArchitecturalStyle(neighborhood: Neighborhood): string {
    return neighborhood.vocabulary.style;
  }

  shouldUsePiazza(neighborhood: Neighborhood): boolean {
    return neighborhood.name === 'Downtown Charleston' ||
           neighborhood.vocabulary.porch === 'piazza';
  }

  generateNeighborhoodContext(
    neighborhood: Neighborhood,
    includeProximity: boolean = true
  ): string {
    const parts = [];

    parts.push(neighborhood.description);

    if (includeProximity && neighborhood.vocabulary.proximity_terms.length > 0) {
      const randomProximity = neighborhood.vocabulary.proximity_terms[
        Math.floor(Math.random() * neighborhood.vocabulary.proximity_terms.length)
      ];
      parts.push(`Located ${randomProximity}.`);
    }

    return parts.join(' ');
  }

  calculateCharlestonAuthenticity(description: string): {
    score: 'high' | 'medium' | 'low';
    hasLocalTerms: boolean;
    hasNeighborhoodMention: boolean;
    suggestions: string[];
  } {
    const descriptionLower = description.toLowerCase();
    const suggestions: string[] = [];

    const localTerms = [
      'lowcountry',
      'holy city',
      'piazza',
      'charleston',
      'marsh',
      'live oak',
      'peninsula',
      'harbor',
    ];

    const hasLocalTerms = localTerms.some((term) =>
      descriptionLower.includes(term)
    );

    const hasNeighborhoodMention = this.neighborhoods.some((n) =>
      descriptionLower.includes(n.name.toLowerCase())
    );

    if (descriptionLower.includes('porch') && !descriptionLower.includes('piazza')) {
      suggestions.push('Consider using "piazza" instead of "porch" for historic properties');
    }

    if (!hasLocalTerms) {
      suggestions.push('Add Charleston-specific terminology like "Lowcountry" or "Holy City"');
    }

    if (!hasNeighborhoodMention) {
      suggestions.push('Reference the specific neighborhood for added local context');
    }

    let score: 'high' | 'medium' | 'low';
    if (hasLocalTerms && hasNeighborhoodMention) {
      score = 'high';
    } else if (hasLocalTerms || hasNeighborhoodMention) {
      score = 'medium';
    } else {
      score = 'low';
    }

    return {
      score,
      hasLocalTerms,
      hasNeighborhoodMention,
      suggestions,
    };
  }
}

export const neighborhoodService = new NeighborhoodService();

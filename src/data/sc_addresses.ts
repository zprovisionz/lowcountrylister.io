export const scLocations = [
  'Downtown Charleston, SC',
  'Mount Pleasant, SC',
  'West Ashley, SC',
  'James Island, SC',
  'Johns Island, SC',
  'Folly Beach, SC',
  'Sullivan\'s Island, SC',
  'Isle of Palms, SC',
  'Daniel Island, SC',
  'North Charleston, SC',
  'Summerville, SC',
  'Goose Creek, SC',
  'Kiawah Island, SC',
  'Seabrook Island, SC',
  'Wadmalaw Island, SC',
  'Edisto Island, SC',
  'Beaufort, SC',
  'Hilton Head Island, SC',
  'Bluffton, SC',
  'Myrtle Beach, SC',
  'Columbia, SC',
  'Greenville, SC',
  'Spartanburg, SC',
  'Rock Hill, SC',
  'Charleston Historic District, SC',
  'French Quarter Charleston, SC',
  'South of Broad Charleston, SC',
  'Harleston Village Charleston, SC',
  'Ansonborough Charleston, SC',
  'Radcliffeborough Charleston, SC',
  'Wagener Terrace Charleston, SC',
  'Hampton Park Terrace Charleston, SC',
  'Avondale Charleston, SC',
  'Park Circle North Charleston, SC',
  'Old Village Mount Pleasant, SC',
  'I\'On Mount Pleasant, SC',
  'Dunes West Mount Pleasant, SC',
  'Rivertowne Mount Pleasant, SC',
];

interface ScoredLocation {
  location: string;
  score: number;
}

const abbreviations: Record<string, string> = {
  'mt': 'mount',
  'st': 'street',
  'ave': 'avenue',
  'blvd': 'boulevard',
  'dr': 'drive',
  'rd': 'road',
  'ln': 'lane',
  'ct': 'court',
};

function normalizeText(text: string): string {
  let normalized = text.toLowerCase().trim();

  Object.entries(abbreviations).forEach(([abbr, full]) => {
    const abbrPattern = new RegExp(`\\b${abbr}\\b`, 'g');
    normalized = normalized.replace(abbrPattern, full);
  });

  return normalized;
}

function scoreMatch(location: string, query: string): number {
  const normalizedLocation = normalizeText(location);
  const normalizedQuery = normalizeText(query);

  if (normalizedLocation === normalizedQuery) return 100;

  if (normalizedLocation.startsWith(normalizedQuery)) return 90;

  const words = normalizedQuery.split(/\s+/);
  const locationWords = normalizedLocation.split(/\s+/);

  let matchedWords = 0;
  let startsWithMatch = false;

  words.forEach(queryWord => {
    locationWords.forEach((locWord, index) => {
      if (locWord.startsWith(queryWord)) {
        matchedWords++;
        if (index === 0) startsWithMatch = true;
      } else if (locWord.includes(queryWord)) {
        matchedWords += 0.5;
      }
    });
  });

  if (matchedWords === words.length && startsWithMatch) return 80;
  if (matchedWords === words.length) return 70;
  if (matchedWords >= words.length * 0.7) return 60;

  if (normalizedLocation.includes(normalizedQuery)) return 50;

  return 0;
}

const popularLocations = [
  'Downtown Charleston, SC',
  'Mount Pleasant, SC',
  'Charleston Historic District, SC',
  'Isle of Palms, SC',
  'Folly Beach, SC',
  'Daniel Island, SC',
  'James Island, SC',
  'Kiawah Island, SC',
];

function extractTextFromQuery(query: string): string {
  const numberMatch = query.match(/^\d+\s*/);
  if (numberMatch) {
    return query.substring(numberMatch[0].length).trim();
  }
  return query;
}

export function filterAddresses(query: string): string[] {
  if (!query || query.length < 1) return [];

  const textQuery = extractTextFromQuery(query);

  if (!textQuery) {
    return popularLocations;
  }

  const scoredLocations: ScoredLocation[] = scLocations
    .map(location => ({
      location,
      score: scoreMatch(location, textQuery),
    }))
    .sort((a, b) => b.score - a.score);

  const matchedLocations = scoredLocations
    .filter(item => item.score > 0)
    .slice(0, 8)
    .map(item => item.location);

  if (matchedLocations.length === 0) {
    return popularLocations;
  }

  return matchedLocations;
}

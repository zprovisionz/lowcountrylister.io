import { useState, useEffect } from 'react';
import { loadGoogleMapsAPI } from '../lib/loadGoogleMaps';

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

interface GooglePlacesAutocompleteResult {
  description: string;
  place_id: string;
}

export function useGooglePlacesAutocomplete(input: string): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Load Google Maps API on mount
  useEffect(() => {
    loadGoogleMapsAPI().then(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleLoaded(true);
      }
    });
  }, []);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // Only use Google Places if API key exists, input is long enough, and API is loaded
    if (!input || input.length < 3 || !apiKey || !isGoogleLoaded) {
      setSuggestions([]);
      return;
    }

    // Debounce API calls
    const timeoutId = setTimeout(() => {
      try {
        const service = new window.google.maps.places.AutocompleteService();
        
        service.getPlacePredictions(
          {
            input,
            componentRestrictions: { 
              country: 'us',
              administrativeArea: 'SC' // South Carolina only
            },
            types: ['address'], // Only return addresses, not establishments or cities
            location: new window.google.maps.LatLng(32.7765, -79.9311), // Charleston center
            radius: 50000, // 50km radius around Charleston
          },
          (predictions: GooglePlacesAutocompleteResult[] | null, status: string) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              predictions &&
              predictions.length > 0
            ) {
              // Filter to ensure results are in South Carolina and are actual addresses
              // Remove the overly restrictive filtering - trust Google's address type
              const scPredictions = predictions
                .filter(p => {
                  const desc = p.description.toLowerCase();
                  // Ensure it's in SC and looks like an address (has street number or common address indicators)
                  return (
                    desc.includes(', sc') || 
                    desc.includes(', south carolina') ||
                    /^\d+\s/.test(p.description) || // Starts with number (street address)
                    desc.includes('street') ||
                    desc.includes('avenue') ||
                    desc.includes('road') ||
                    desc.includes('drive') ||
                    desc.includes('lane') ||
                    desc.includes('court') ||
                    desc.includes('circle') ||
                    desc.includes('way') ||
                    desc.includes('boulevard') ||
                    desc.includes('place')
                  );
                })
                .map(p => p.description)
                .slice(0, 8); // Limit to 8 suggestions
              
              setSuggestions(scPredictions.length > 0 ? scPredictions : []);
            } else {
              // No results - don't show fallback town names
              setSuggestions([]);
            }
          }
        );
      } catch (error) {
        // On error, don't show fallback - just show empty
        console.warn('Google Places API error:', error);
        setSuggestions([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [input, isGoogleLoaded]);

  return suggestions;
}


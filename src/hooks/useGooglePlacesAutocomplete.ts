import { useState, useEffect } from 'react';
import { filterAddresses } from '../data/sc_addresses';
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

    // Fallback to static list if no API key or input too short
    if (!input || input.length < 3 || !apiKey || !isGoogleLoaded) {
      const staticSuggestions = filterAddresses(input);
      setSuggestions(staticSuggestions);
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
            types: ['address'],
          },
          (predictions: GooglePlacesAutocompleteResult[] | null, status: string) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              predictions &&
              predictions.length > 0
            ) {
              // Filter to ensure results are in South Carolina
              const scPredictions = predictions
                .filter(p => 
                  p.description.toLowerCase().includes('sc') ||
                  p.description.toLowerCase().includes('south carolina') ||
                  p.description.toLowerCase().includes('charleston') ||
                  p.description.toLowerCase().includes('mount pleasant') ||
                  p.description.toLowerCase().includes('summerville')
                )
                .map(p => p.description)
                .slice(0, 8); // Limit to 8 suggestions
              
              if (scPredictions.length > 0) {
                setSuggestions(scPredictions);
              } else {
                // Fallback to static list if no SC results
                setSuggestions(filterAddresses(input));
              }
            } else {
              // Fallback to static list on error or no results
              setSuggestions(filterAddresses(input));
            }
          }
        );
      } catch (error) {
        // Fallback to static list on error
        console.warn('Google Places API error, using fallback:', error);
        setSuggestions(filterAddresses(input));
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [input, isGoogleLoaded]);

  return suggestions;
}


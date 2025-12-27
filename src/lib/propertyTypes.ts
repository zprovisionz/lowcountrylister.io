/**
 * Centralized property type definitions and mappings
 * 
 * This file provides a single source of truth for property types
 * used across the application, ensuring consistency between
 * frontend display values and API format.
 */

export type PropertyTypeDisplay = 
  | 'Single Family Home'
  | 'Condo/Townhouse'
  | 'Multi-Family'
  | 'Vacant Land'
  | 'Other';

export type PropertyTypeAPI = 
  | 'single_family'
  | 'townhouse'
  | 'condo'
  | 'multi_family'
  | 'land'
  | 'other';

/**
 * Maps frontend display property type to API format
 */
export function mapPropertyTypeToAPI(
  displayType: string
): PropertyTypeAPI {
  const mapping: Record<string, PropertyTypeAPI> = {
    'Single Family Home': 'single_family',
    'Condo/Townhouse': 'townhouse', // Default to townhouse for combined option
    'Townhouse': 'townhouse',
    'Condo': 'condo',
    'Multi-Family': 'multi_family',
    'Vacant Land': 'land',
    'Land': 'land',
    'Other': 'other',
  };

  return mapping[displayType] || 'other';
}

/**
 * Maps API property type to frontend display format
 */
export function mapPropertyTypeToDisplay(
  apiType: PropertyTypeAPI
): PropertyTypeDisplay {
  const mapping: Record<PropertyTypeAPI, PropertyTypeDisplay> = {
    single_family: 'Single Family Home',
    townhouse: 'Condo/Townhouse',
    condo: 'Condo/Townhouse',
    multi_family: 'Multi-Family',
    land: 'Vacant Land',
    other: 'Other',
  };

  return mapping[apiType] || 'Other';
}

/**
 * All available property types for frontend display
 */
export const PROPERTY_TYPES: Array<{
  id: PropertyTypeDisplay;
  apiValue: PropertyTypeAPI;
  label: string;
}> = [
  { id: 'Single Family Home', apiValue: 'single_family', label: 'Single Family' },
  { id: 'Condo/Townhouse', apiValue: 'townhouse', label: 'Condo / Townhouse' },
  { id: 'Multi-Family', apiValue: 'multi_family', label: 'Multi-Family' },
  { id: 'Vacant Land', apiValue: 'land', label: 'Vacant Land' },
  { id: 'Other', apiValue: 'other', label: 'Other' },
];


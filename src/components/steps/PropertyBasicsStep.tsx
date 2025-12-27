import { CheckCircle2, Info, Home, Building2, TreePine, Users, HelpCircle } from 'lucide-react';
import { NeighborhoodDetectionResult } from '../../services/neighborhoodService';
import AddressAutocompleteInput from '../AddressAutocompleteInput';

const PROPERTY_TYPES = [
  { id: 'Single Family Home', label: 'Single Family', icon: Home, description: 'Detached house' },
  { id: 'Condo/Townhouse', label: 'Condo / Townhouse', icon: Building2, description: 'Attached unit' },
  { id: 'Multi-Family', label: 'Multi-Family', icon: Users, description: '2+ units' },
  { id: 'Vacant Land', label: 'Vacant Land', icon: TreePine, description: 'Lot / Acreage' },
  { id: 'Other', label: 'Other', icon: HelpCircle, description: 'Other type' },
];

const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5', '6+'];
const BATHROOM_OPTIONS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4+'];

interface PropertyBasicsStepProps {
  address: string;
  onAddressChange: (value: string) => void;
  bedrooms: string;
  onBedroomsChange: (value: string) => void;
  bathrooms: string;
  onBathroomsChange: (value: string) => void;
  squareFeet: string;
  onSquareFeetChange: (value: string) => void;
  propertyType: string;
  onPropertyTypeChange: (value: string) => void;
  detectedNeighborhood: NeighborhoodDetectionResult | null;
  onAddressReset: () => void;
}

export default function PropertyBasicsStep({
  address,
  onAddressChange,
  bedrooms,
  onBedroomsChange,
  bathrooms,
  onBathroomsChange,
  squareFeet,
  onSquareFeetChange,
  propertyType,
  onPropertyTypeChange,
  detectedNeighborhood,
}: PropertyBasicsStepProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Property Basics</h2>
        <p className="text-gray-400">Start with your property's location and key details</p>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-2">
            Property Address <span className="text-red-400">*</span>
          </label>
          <AddressAutocompleteInput
            id="address"
            value={address}
            onChange={onAddressChange}
            placeholder="123 Meeting Street, Charleston, SC 29401"
            required
            inputClassName="w-full pl-12 pr-4 py-4 bg-gray-900/50 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-white placeholder-gray-500 text-lg"
          />

          {detectedNeighborhood && detectedNeighborhood.neighborhood && (
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl backdrop-blur-sm animate-fadeIn">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-blue-300">
                      {detectedNeighborhood.neighborhood.name}
                    </p>
                    <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full">
                      Auto-detected
                    </span>
                  </div>
                  <p className="text-sm text-blue-200/80">
                    {detectedNeighborhood.neighborhood.description}
                  </p>
                  <div className="flex items-start gap-2 text-xs text-blue-300/70 mt-2">
                    <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>
                      We'll suggest typical amenities for this area in the next step
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Property Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {PROPERTY_TYPES.map((type) => {
              const TypeIcon = type.icon;
              const isSelected = propertyType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => onPropertyTypeChange(type.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-center group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                  }`}
                  aria-label={`Select ${type.label} property type`}
                  aria-pressed={isSelected}
                >
                  <div
                    className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 group-hover:text-gray-300'
                    }`}
                  >
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-sm font-medium block ${
                      isSelected ? 'text-blue-300' : 'text-gray-300'
                    }`}
                  >
                    {type.label}
                  </span>
                  <span className="text-xs text-gray-500 block mt-0.5">
                    {type.description}
                  </span>
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Bedrooms
            </label>
            <div className="flex flex-wrap gap-2">
              {BEDROOM_OPTIONS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onBedroomsChange(num === bedrooms ? '' : num)}
                  className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                    bedrooms === num
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Bathrooms
            </label>
            <div className="flex flex-wrap gap-2">
              {BATHROOM_OPTIONS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onBathroomsChange(num === bathrooms ? '' : num)}
                  className={`px-3 py-2.5 rounded-lg font-medium transition-all text-sm ${
                    bathrooms === num
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="squareFeet" className="block text-sm font-medium text-gray-300 mb-3">
              Square Feet
            </label>
            <input
              id="squareFeet"
              type="number"
              value={squareFeet}
              onChange={(e) => onSquareFeetChange(e.target.value)}
              min="0"
              placeholder="e.g. 2,400"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-white placeholder-gray-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

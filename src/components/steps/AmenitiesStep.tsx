import { useState, useRef, KeyboardEvent } from 'react';
import {
  Check,
  Plus,
  X,
  RotateCcw,
  Sparkles,
  Sun,
  Armchair,
  MapPin,
  Crown,
  Home,
  TreePine,
  Waves,
  Droplets,
  Utensils,
  Flame,
  Car,
  Anchor,
  Building2,
  DoorOpen,
  GraduationCap,
  Shield,
  Trees,
  Zap,
  Bath,
  LucideIcon,
  ParkingSquare,
} from 'lucide-react';

interface AmenityOption {
  id: string;
  label: string;
  icon: LucideIcon;
  isPopular?: boolean;
  propertyTypes?: string[];
}

interface AmenityCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  amenities: AmenityOption[];
}

const amenityCategories: AmenityCategory[] = [
  {
    id: 'exterior',
    name: 'Outdoor Living',
    icon: Sun,
    color: 'amber',
    amenities: [
      { id: 'piazza-porch', label: 'Piazza / Porch', icon: Home, isPopular: true },
      { id: 'screened-porch', label: 'Screened Porch', icon: Home },
      { id: 'fenced-yard', label: 'Fenced Yard', icon: Home, propertyTypes: ['Single Family Home', 'Multi-Family'] },
      { id: 'live-oaks', label: 'Live Oaks', icon: TreePine, isPopular: true },
      { id: 'marsh-views', label: 'Marsh / Water Views', icon: Waves, isPopular: true },
      { id: 'private-pool', label: 'Private Pool', icon: Droplets, isPopular: true },
      { id: 'community-pool', label: 'Community Pool', icon: Droplets },
      { id: 'patio-deck', label: 'Patio / Deck', icon: Sun },
      { id: 'outdoor-kitchen', label: 'Outdoor Kitchen', icon: Utensils },
      { id: 'fire-pit', label: 'Fire Pit', icon: Flame },
      { id: 'garden', label: 'Landscaped Garden', icon: TreePine },
      { id: 'garage', label: 'Garage', icon: Car },
      { id: 'off-street-parking', label: 'Off-Street Parking', icon: ParkingSquare },
      { id: 'boat-access', label: 'Boat Dock / Access', icon: Anchor, isPopular: true },
    ],
  },
  {
    id: 'interior',
    name: 'Interior Features',
    icon: Armchair,
    color: 'blue',
    amenities: [
      { id: 'hardwood-floors', label: 'Hardwood Floors', icon: Home, isPopular: true },
      { id: 'renovated-kitchen', label: 'Renovated Kitchen', icon: Utensils },
      { id: 'granite-quartz', label: 'Granite / Quartz', icon: Sparkles },
      { id: 'stainless-appliances', label: 'Stainless Appliances', icon: Utensils },
      { id: 'gourmet-kitchen', label: 'Chef\'s Kitchen', icon: Utensils },
      { id: 'open-floor-plan', label: 'Open Floor Plan', icon: DoorOpen },
      { id: 'high-ceilings', label: 'High Ceilings', icon: Building2 },
      { id: 'fireplace', label: 'Fireplace', icon: Flame },
      { id: 'walk-in-closets', label: 'Walk-In Closets', icon: DoorOpen },
      { id: 'primary-downstairs', label: 'Primary Downstairs', icon: Home },
    ],
  },
  {
    id: 'location',
    name: 'Location & Lifestyle',
    icon: MapPin,
    color: 'emerald',
    amenities: [
      { id: 'historic-charm', label: 'Historic Charm', icon: Home, isPopular: true },
      { id: 'move-in-ready', label: 'Move-In Ready', icon: Check },
      { id: 'top-rated-schools', label: 'Top Schools Nearby', icon: GraduationCap },
      { id: 'master-planned', label: 'Master-Planned', icon: Building2 },
      { id: 'walkable-king-street', label: 'Walkable Downtown', icon: MapPin },
      { id: 'golf-access', label: 'Golf Access', icon: Trees },
      { id: 'beach-proximity', label: 'Beach Nearby', icon: Waves, isPopular: true },
      { id: 'flood-zone-safe', label: 'Flood Zone X', icon: Shield },
    ],
  },
  {
    id: 'modern',
    name: 'Modern & Luxury',
    icon: Crown,
    color: 'cyan',
    amenities: [
      { id: 'smart-home', label: 'Smart Home', icon: Zap },
      { id: 'luxury-finishes', label: 'Luxury Finishes', icon: Sparkles },
      { id: 'spa-bath', label: 'Spa-Like Bath', icon: Bath },
      { id: 'home-office', label: 'Home Office', icon: Building2 },
      { id: 'new-construction', label: 'New / Energy Efficient', icon: Building2 },
      { id: 'pet-friendly', label: 'Pet-Friendly', icon: Home },
      { id: 'elevator', label: 'Elevator', icon: Building2 },
      { id: 'guest-suite', label: 'Guest Suite', icon: Home },
    ],
  },
];

const idToLabel: Record<string, string> = {};
amenityCategories.forEach((cat) => {
  cat.amenities.forEach((a) => {
    idToLabel[a.id] = a.label;
  });
});

interface AmenitiesStepProps {
  selectedAmenities: string[];
  onAmenitiesChange: (amenities: string[]) => void;
  customAmenities: string[];
  onCustomAmenitiesChange: (amenities: string[]) => void;
  typicalAmenities?: string[];
  neighborhoodName?: string;
  propertyType?: string;
  onApplyDefaults?: () => void;
}

export default function AmenitiesStep({
  selectedAmenities,
  onAmenitiesChange,
  customAmenities,
  onCustomAmenitiesChange,
  typicalAmenities = [],
  neighborhoodName,
  propertyType,
  onApplyDefaults,
}: AmenitiesStepProps) {
  const [activeCategory, setActiveCategory] = useState<string>('exterior');
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleAmenity = (amenityId: string) => {
    if (selectedAmenities.includes(amenityId)) {
      onAmenitiesChange(selectedAmenities.filter((a) => a !== amenityId));
    } else {
      onAmenitiesChange([...selectedAmenities, amenityId]);
    }
  };

  const clearAll = () => {
    onAmenitiesChange([]);
    onCustomAmenitiesChange([]);
  };

  const addCustomAmenity = () => {
    const trimmed = customInput.trim();
    if (trimmed && !customAmenities.includes(trimmed)) {
      onCustomAmenitiesChange([...customAmenities, trimmed]);
      setCustomInput('');
    }
  };

  const removeCustomAmenity = (amenity: string) => {
    onCustomAmenitiesChange(customAmenities.filter((a) => a !== amenity));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomAmenity();
    }
  };

  const totalSelected = selectedAmenities.length + customAmenities.length;

  const getSelectedCountForCategory = (categoryId: string) => {
    const category = amenityCategories.find((c) => c.id === categoryId);
    if (!category) return 0;
    return category.amenities.filter((a) => selectedAmenities.includes(a.id)).length;
  };

  const isAmenityRelevant = (amenity: AmenityOption) => {
    if (!amenity.propertyTypes || !propertyType) return true;
    return amenity.propertyTypes.includes(propertyType);
  };

  const isTypical = (amenityId: string) => {
    const label = idToLabel[amenityId];
    return label ? typicalAmenities.includes(label) : false;
  };

  const currentCategory = amenityCategories.find((c) => c.id === activeCategory);
  const relevantAmenities = currentCategory?.amenities.filter(isAmenityRelevant) || [];

  const getCategoryColorClasses = (categoryId: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string; icon: string }> = {
      exterior: {
        active: 'bg-amber-500/20 border-amber-500 text-amber-300',
        inactive: 'border-gray-700 hover:border-amber-500/50 text-gray-400 hover:text-amber-400',
        icon: 'text-amber-400',
      },
      interior: {
        active: 'bg-blue-500/20 border-blue-500 text-blue-300',
        inactive: 'border-gray-700 hover:border-blue-500/50 text-gray-400 hover:text-blue-400',
        icon: 'text-blue-400',
      },
      location: {
        active: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
        inactive: 'border-gray-700 hover:border-emerald-500/50 text-gray-400 hover:text-emerald-400',
        icon: 'text-emerald-400',
      },
      modern: {
        active: 'bg-cyan-500/20 border-cyan-500 text-cyan-300',
        inactive: 'border-gray-700 hover:border-cyan-500/50 text-gray-400 hover:text-cyan-400',
        icon: 'text-cyan-400',
      },
    };
    return isActive ? colors[categoryId]?.active : colors[categoryId]?.inactive;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Features & Amenities</h2>
        <p className="text-gray-400">Select the features that make your property special</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{totalSelected}</span>
            <span className="text-gray-400">selected</span>
          </div>
        </div>
        <div className="flex gap-2">
          {onApplyDefaults && neighborhoodName && (
            <button
              type="button"
              onClick={onApplyDefaults}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">{neighborhoodName}</span> Defaults
            </button>
          )}
          {totalSelected > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700 transition"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {neighborhoodName && (
        <div className="flex items-center gap-2 text-sm text-blue-300 bg-blue-500/10 px-4 py-3 rounded-xl border border-blue-500/20">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span>Amenities with a glow are typical for <strong>{neighborhoodName}</strong></span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {amenityCategories.map((category) => {
          const CategoryIcon = category.icon;
          const isActive = activeCategory === category.id;
          const selectedCount = getSelectedCountForCategory(category.id);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${getCategoryColorClasses(
                category.id,
                isActive
              )}`}
            >
              <CategoryIcon className={`w-6 h-6 mb-2 ${isActive ? '' : getCategoryColorClasses(category.id, false).split(' ').find(c => c.startsWith('text-'))}`} />
              <span className="font-medium block text-sm">{category.name}</span>
              {selectedCount > 0 && (
                <span className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-xs font-bold bg-blue-500 text-white rounded-full">
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4 min-h-[280px]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {relevantAmenities.map((amenity) => {
            const isSelected = selectedAmenities.includes(amenity.id);
            const typical = isTypical(amenity.id);
            const AmenityIcon = amenity.icon;

            return (
              <button
                key={amenity.id}
                type="button"
                onClick={() => toggleAmenity(amenity.id)}
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left group ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/20'
                    : typical
                    ? 'border-blue-500/40 bg-blue-500/5 hover:border-blue-500/60 hover:bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/30'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : typical
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'
                  }`}
                >
                  {isSelected ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <AmenityIcon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium leading-tight ${
                    isSelected ? 'text-blue-200' : typical ? 'text-blue-300' : 'text-gray-300'
                  }`}
                >
                  {amenity.label}
                </span>
                {typical && !isSelected && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Add Custom Feature
        </label>

        {customAmenities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {customAmenities.map((amenity) => (
              <span
                key={amenity}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-300 bg-blue-500/20 rounded-lg border border-blue-500/30"
              >
                {amenity}
                <button
                  type="button"
                  onClick={() => removeCustomAmenity(amenity)}
                  className="w-4 h-4 rounded-full bg-blue-500/30 hover:bg-red-500/50 flex items-center justify-center transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Wine cellar, Theater room, Sauna"
            className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-white placeholder-gray-500"
          />
          <button
            type="button"
            onClick={addCustomAmenity}
            disabled={!customInput.trim()}
            className="inline-flex items-center gap-2 px-5 py-3 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export { amenityCategories, idToLabel };

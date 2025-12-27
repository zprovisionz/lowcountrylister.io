import { useState, useRef, KeyboardEvent, useMemo } from 'react';
import {
  Home,
  TreePine,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  RotateCcw,
  Check,
  Waves,
  Building2,
  Sun,
  Shield,
  GraduationCap,
  Utensils,
  Car,
  Droplets,
  Flame,
  Anchor,
  Search,
  Zap,
  Bath,
  LucideIcon,
  ParkingSquare,
  Armchair,
  DoorOpen,
  Crown,
  Trees,
} from 'lucide-react';

interface AmenityCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  amenities: AmenityOption[];
}

interface AmenityOption {
  id: string;
  label: string;
  icon: LucideIcon;
  isPopular?: boolean;
  propertyTypes?: string[];
}

const amenityCategories: AmenityCategory[] = [
  {
    id: 'exterior',
    name: 'Exterior & Outdoor',
    icon: Sun,
    amenities: [
      { id: 'piazza-porch', label: 'Piazza or Porch', icon: Home, isPopular: true },
      { id: 'screened-porch', label: 'Screened Porch', icon: Home },
      { id: 'fenced-yard', label: 'Fenced Yard', icon: Home, propertyTypes: ['Single Family Home', 'Multi-Family'] },
      { id: 'live-oaks', label: 'Mature Live Oaks / Oak-Lined', icon: TreePine, isPopular: true },
      { id: 'marsh-views', label: 'Marsh Views / Waterfront', icon: Waves, isPopular: true },
      { id: 'private-pool', label: 'Private Pool', icon: Droplets, isPopular: true },
      { id: 'community-pool', label: 'Community Pool', icon: Droplets },
      { id: 'patio-deck', label: 'Patio or Deck', icon: Sun },
      { id: 'outdoor-kitchen', label: 'Outdoor Kitchen / Grill Area', icon: Utensils },
      { id: 'fire-pit', label: 'Fire Pit', icon: Flame },
      { id: 'garden', label: 'Garden or Landscaped Yard', icon: TreePine },
      { id: 'garage', label: 'Garage (1-car, 2-car+)', icon: Car },
      { id: 'off-street-parking', label: 'Off-Street Parking', icon: ParkingSquare },
      { id: 'boat-access', label: 'Boat Access / Dock', icon: Anchor, isPopular: true },
    ],
  },
  {
    id: 'interior',
    name: 'Interior & Kitchen',
    icon: Armchair,
    amenities: [
      { id: 'hardwood-floors', label: 'Hardwood Floors', icon: Home, isPopular: true },
      { id: 'renovated-kitchen', label: 'Renovated Kitchen', icon: Utensils },
      { id: 'granite-quartz', label: 'Granite or Quartz Counters', icon: Sparkles },
      { id: 'stainless-appliances', label: 'Stainless Steel Appliances', icon: Utensils },
      { id: 'gourmet-kitchen', label: 'Gourmet or Chef\'s Kitchen', icon: Utensils },
      { id: 'open-floor-plan', label: 'Open Floor Plan', icon: DoorOpen },
      { id: 'high-ceilings', label: 'High Ceilings', icon: Building2 },
      { id: 'fireplace', label: 'Fireplace', icon: Flame },
      { id: 'walk-in-closets', label: 'Walk-In Closets', icon: DoorOpen },
      { id: 'primary-downstairs', label: 'Primary Suite Downstairs', icon: Home },
    ],
  },
  {
    id: 'location',
    name: 'Location & Lifestyle',
    icon: MapPin,
    amenities: [
      { id: 'historic-charm', label: 'Historic Charm / Original Details', icon: Home, isPopular: true },
      { id: 'move-in-ready', label: 'Move-In Ready', icon: Check },
      { id: 'top-rated-schools', label: 'Top-Rated Schools Nearby', icon: GraduationCap },
      { id: 'master-planned', label: 'Master-Planned Amenities', icon: Building2 },
      { id: 'walkable-king-street', label: 'Walkable to King Street / Downtown', icon: MapPin },
      { id: 'golf-access', label: 'Golf Course Access / Community', icon: Trees },
      { id: 'beach-proximity', label: 'Beach Proximity (<15 min)', icon: Waves, isPopular: true },
      { id: 'flood-zone-safe', label: 'Flood Zone Safe (X Zone)', icon: Shield },
    ],
  },
  {
    id: 'modern',
    name: 'Modern & Luxury',
    icon: Crown,
    amenities: [
      { id: 'smart-home', label: 'Smart Home Features', icon: Zap },
      { id: 'luxury-finishes', label: 'Luxury Finishes', icon: Sparkles },
      { id: 'spa-bath', label: 'Spa-Like Primary Bath', icon: Bath },
      { id: 'home-office', label: 'Home Office / Flex Space', icon: Building2 },
      { id: 'new-construction', label: 'Energy Efficient / New Construction', icon: Building2 },
    ],
  },
  {
    id: 'other',
    name: 'Other / Custom',
    icon: Plus,
    amenities: [
      { id: 'pet-friendly', label: 'Pet-Friendly Features', icon: Home },
      { id: 'elevator', label: 'Elevator (for multi-story)', icon: Building2 },
      { id: 'guest-suite', label: 'Guest Suite / In-Law Suite', icon: Home },
    ],
  },
];

const idToLabel: Record<string, string> = {};
amenityCategories.forEach((cat) => {
  cat.amenities.forEach((a) => {
    idToLabel[a.id] = a.label;
  });
});

interface AmenitiesSelectorProps {
  selectedAmenities: string[];
  onAmenitiesChange: (amenities: string[]) => void;
  customAmenities: string[];
  onCustomAmenitiesChange: (amenities: string[]) => void;
  typicalAmenities?: string[];
  neighborhoodName?: string;
  propertyType?: string;
  onApplyDefaults?: () => void;
  userPlan?: 'free' | 'pro' | 'agency';
}

export default function AmenitiesSelector({
  selectedAmenities,
  onAmenitiesChange,
  customAmenities,
  onCustomAmenitiesChange,
  typicalAmenities = [],
  neighborhoodName,
  propertyType,
  onApplyDefaults,
  userPlan = 'free',
}: AmenitiesSelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

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

  const getSelectedCountForCategory = (category: AmenityCategory) => {
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

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return amenityCategories;

    const query = searchQuery.toLowerCase();
    return amenityCategories
      .map((category) => ({
        ...category,
        amenities: category.amenities.filter(
          (amenity) =>
            amenity.label.toLowerCase().includes(query) ||
            amenity.id.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.amenities.length > 0);
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const showProTeaser = userPlan === 'free' && totalSelected >= 8;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
        <span>Select all that apply - these will be highlighted in your description</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type to filter: e.g., pool, oak, porch"
          className="w-full pl-10 pr-10 py-2.5 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm text-white placeholder-gray-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition"
          >
            <X className="w-3 h-3 text-gray-300" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">
            {totalSelected} selected
          </span>
          {totalSelected > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-white bg-blue-600 rounded-full">
              {totalSelected}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onApplyDefaults && neighborhoodName && (
            <button
              type="button"
              onClick={onApplyDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Apply {neighborhoodName} Defaults
            </button>
          )}
          {totalSelected > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700 transition"
            >
              <X className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {neighborhoodName && !isSearching && (
        <p className="text-sm text-blue-300 bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/20">
          Items with a blue highlight are typical for {neighborhoodName}
        </p>
      )}

      <div className="space-y-2">
        {filteredCategories.map((category) => {
          const isExpanded = isSearching || expandedCategories.has(category.id);
          const selectedCount = getSelectedCountForCategory(category);
          const CategoryIcon = category.icon;
          const relevantAmenities = category.amenities.filter(isAmenityRelevant);

          if (relevantAmenities.length === 0) return null;

          return (
            <div
              key={category.id}
              className="border border-gray-700/50 rounded-xl overflow-hidden bg-gray-800/30"
            >
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/30 hover:bg-gray-700/50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-800/50 border border-gray-600 flex items-center justify-center">
                    <CategoryIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="font-medium text-white">{category.name}</span>
                  <span className="text-sm text-gray-400">
                    ({relevantAmenities.length} options)
                  </span>
                  {selectedCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium text-blue-300 bg-blue-500/20 rounded-full border border-blue-500/30">
                      {selectedCount} selected
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {isExpanded && (
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {relevantAmenities.map((amenity) => {
                      const isSelected = selectedAmenities.includes(amenity.id);
                      const typical = isTypical(amenity.id);
                      const AmenityIcon = amenity.icon;

                      return (
                        <button
                          key={amenity.id}
                          type="button"
                          onClick={() => toggleAmenity(amenity.id)}
                          className={`group relative flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200 text-left ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/20 shadow-sm'
                              : typical
                              ? 'border-blue-500/30 bg-blue-500/10 hover:border-blue-500/40 hover:bg-blue-500/15'
                              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : typical
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <AmenityIcon className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span
                            className={`text-sm font-medium leading-tight ${
                              isSelected
                                ? 'text-blue-200'
                                : typical
                                ? 'text-blue-300'
                                : 'text-gray-300'
                            }`}
                          >
                            {amenity.label}
                          </span>
                          {amenity.isPopular && !isSelected && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" title="Popular feature" />
                          )}
                          {typical && !isSelected && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {category.id === 'other' && (
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Add Custom Amenity
                      </label>

                      {customAmenities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {customAmenities.map((amenity) => (
                            <span
                              key={amenity}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-300 bg-blue-500/20 rounded-full border border-blue-500/30"
                            >
                              {amenity}
                              <button
                                type="button"
                                onClick={() => removeCustomAmenity(amenity)}
                                className="w-4 h-4 rounded-full bg-blue-500/30 hover:bg-blue-500/40 flex items-center justify-center transition"
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
                          placeholder="e.g., Wine cellar, Sauna, Theater room"
                          className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm text-white placeholder-gray-500"
                        />
                        <button
                          type="button"
                          onClick={addCustomAmenity}
                          disabled={!customInput.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        Press Enter to add, or click Add
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showProTeaser && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">
              Pro+ unlocks premium phrasing for luxury features
            </p>
            <p className="text-xs text-amber-400 mt-0.5">
              Get enhanced descriptions that highlight your {totalSelected} selected amenities
            </p>
          </div>
        </div>
      )}

      {isSearching && filteredCategories.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No amenities found for "{searchQuery}"</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-blue-400 hover:text-blue-300 text-sm mt-2"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}

export { amenityCategories, idToLabel };

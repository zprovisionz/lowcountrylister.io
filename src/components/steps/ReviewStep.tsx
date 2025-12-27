import { useState } from 'react';
import {
  MapPin,
  Home,
  Bed,
  Bath,
  Square,
  Camera,
  Check,
  Sparkles,
  FileText,
  Instagram,
  Edit3,
  Loader2,
  Crown,
  Lock,
} from 'lucide-react';
import { NeighborhoodDetectionResult } from '../../services/neighborhoodService';
import StagingStylePicker from '../StagingStylePicker';
import StagingPhotoSelector from '../StagingPhotoSelector';

interface ReviewStepProps {
  address: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  selectedAmenities: string[];
  customAmenities: string[];
  photos: File[];
  includeAirbnb: boolean;
  onIncludeAirbnbChange: (value: boolean) => void;
  includeSocial: boolean;
  onIncludeSocialChange: (value: boolean) => void;
  detectedNeighborhood: NeighborhoodDetectionResult | null;
  onEditStep: (stepIndex: number) => void;
  amenityLabels: Record<string, string>;
  subscriptionTier?: 'free' | 'starter' | 'pro' | 'pro_plus';
  onStagePhoto?: (photoIndex: number, style: string, roomType: string) => Promise<void>;
  stagingInProgress?: boolean;
  onUpgradeClick?: () => void;
}

export default function ReviewStep({
  address,
  propertyType,
  bedrooms,
  bathrooms,
  squareFeet,
  selectedAmenities,
  customAmenities,
  photos,
  includeAirbnb,
  onIncludeAirbnbChange,
  includeSocial,
  onIncludeSocialChange,
  detectedNeighborhood,
  onEditStep,
  amenityLabels,
  subscriptionTier = 'free',
  onStagePhoto,
  stagingInProgress = false,
  onUpgradeClick,
}: ReviewStepProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('coastal_modern');
  const [selectedRoomType, setSelectedRoomType] = useState('living_room');

  const allAmenities = [
    ...selectedAmenities.map((id) => amenityLabels[id] || id),
    ...customAmenities,
  ];

  const canStage = subscriptionTier === 'pro' || subscriptionTier === 'pro_plus';
  const isStarter = subscriptionTier === 'starter';
  const isFree = subscriptionTier === 'free';

  const handleStagePhoto = async () => {
    if (!canStage || selectedPhotoIndex === null || !onStagePhoto) return;
    await onStagePhoto(selectedPhotoIndex, selectedStyle, selectedRoomType);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Review & Generate</h2>
        <p className="text-gray-400">Confirm your details and choose output options</p>
      </div>

      <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-5 border-b border-gray-700/50">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{address || 'No address entered'}</h3>
                {detectedNeighborhood?.neighborhood && (
                  <span className="inline-flex items-center gap-1 text-sm text-blue-300 mt-1">
                    <Sparkles className="w-3 h-3" />
                    {detectedNeighborhood.neighborhood.name}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEditStep(0)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 border-b border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Property Details
            </h4>
            <button
              type="button"
              onClick={() => onEditStep(0)}
              className="text-sm text-blue-400 hover:text-blue-300 transition"
            >
              Edit
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center">
                <Home className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="text-sm font-medium text-white">{propertyType}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center">
                <Bed className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Beds</p>
                <p className="text-sm font-medium text-white">{bedrooms || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center">
                <Bath className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Baths</p>
                <p className="text-sm font-medium text-white">{bathrooms || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center">
                <Square className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Sq Ft</p>
                <p className="text-sm font-medium text-white">
                  {squareFeet ? parseInt(squareFeet).toLocaleString() : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-b border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                Selected Features & Amenities ({allAmenities.length})
              </h4>
              {detectedNeighborhood?.neighborhood && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded">
                  <Sparkles className="w-3 h-3" />
                  Based on {detectedNeighborhood.neighborhood.name}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEditStep(2)}
              className="text-sm text-blue-400 hover:text-blue-300 transition"
            >
              Edit
            </button>
          </div>
          {allAmenities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allAmenities.slice(0, 8).map((amenity, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-700/50 text-gray-300 rounded-lg"
                >
                  <Check className="w-3 h-3 text-blue-400" />
                  {amenity}
                </span>
              ))}
              {allAmenities.length > 8 && (
                <span className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-500/20 text-blue-300 rounded-lg">
                  +{allAmenities.length - 8} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No features selected
            </p>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Photos ({photos.length})
            </h4>
            <button
              type="button"
              onClick={() => onEditStep(1)}
              className="text-sm text-blue-400 hover:text-blue-300 transition"
            >
              Edit
            </button>
          </div>
          {photos.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.slice(0, 6).map((photo, index) => (
                <div
                  key={index}
                  className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700"
                >
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {photos.length > 6 && (
                <div className="w-16 h-16 rounded-lg bg-gray-700/50 flex-shrink-0 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-400">+{photos.length - 6}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Camera className="w-4 h-4" />
              <span>No photos uploaded</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Output Options</h3>

        <div className="space-y-3">
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">MLS Description</p>
                  <p className="text-sm text-gray-400">Professional listing copy</p>
                </div>
              </div>
              <div className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">
                Included
              </div>
            </div>
          </div>

          <label className="block p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 cursor-pointer hover:bg-gray-800/70 transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Home className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Airbnb / VRBO Description</p>
                  <p className="text-sm text-gray-400">Guest-focused vacation rental copy</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={includeAirbnb}
                  onChange={(e) => onIncludeAirbnbChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-500 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </div>
          </label>

          <label className="block p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 cursor-pointer hover:bg-gray-800/70 transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Instagram className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Social Media Captions</p>
                  <p className="text-sm text-gray-400">3 ready-to-post captions</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={includeSocial}
                  onChange={(e) => onIncludeSocialChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-500 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Virtual Staging Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Virtual Staging</h3>

        {canStage ? (
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h4 className="font-medium text-white">Stage Your Photos</h4>
              </div>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full border border-blue-500/30">
                {subscriptionTier === 'pro' ? 'Pro' : 'Pro+'}
              </span>
            </div>

            {photos.length > 0 ? (
              <>
                <StagingPhotoSelector
                  photos={photos}
                  selectedPhotoIndex={selectedPhotoIndex}
                  onPhotoSelect={setSelectedPhotoIndex}
                />

                <StagingStylePicker
                  selectedStyle={selectedStyle}
                  onStyleChange={setSelectedStyle}
                  selectedRoomType={selectedRoomType}
                  onRoomTypeChange={setSelectedRoomType}
                />

                <button
                  type="button"
                  onClick={handleStagePhoto}
                  disabled={stagingInProgress || selectedPhotoIndex === null}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {stagingInProgress ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Staging in progress...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Stage Selected Photo
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Upload photos to use virtual staging</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/20 rounded-lg p-3">
                <Crown className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  Virtual Staging - Premium Feature
                  {isStarter && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded border border-amber-500/30">
                      Starter
                    </span>
                  )}
                  {isFree && (
                    <span className="px-2 py-0.5 bg-gray-500/20 text-gray-300 text-xs rounded border border-gray-500/30">
                      Free
                    </span>
                  )}
                </h4>
                <p className="text-gray-300 mb-4 text-sm">
                  Transform empty rooms into beautifully furnished spaces with AI-powered virtual staging.
                  Help buyers visualize the potential of your property.
                </p>

                {/* Teaser Preview */}
                <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    <Lock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase">Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="aspect-video bg-gray-800 rounded border border-gray-700 flex items-center justify-center">
                      <span className="text-xs text-gray-500">Before</span>
                    </div>
                    <div className="aspect-video bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded border border-blue-500/30 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.1)_50%,transparent_75%)] bg-[length:20px_20px]"></div>
                      {/* Watermark overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                            <p className="text-white font-bold text-sm mb-1">Lowcountry Listings</p>
                            <p className="text-white/80 text-xs">Premium Feature</p>
                          </div>
                        </div>
                      </div>
                      <div className="relative z-10 text-center opacity-50">
                        <Crown className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                        <span className="text-xs text-blue-300 font-medium">After</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Interactive before/after slider • 5 design styles • Multiple room types
                  </p>
                </div>

                <ul className="space-y-2 mb-6 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Charleston-inspired design styles (Coastal Modern, Lowcountry Traditional, etc.)
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Multiple room types supported (Living Room, Bedroom, Kitchen, etc.)
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Professional-quality results in 1-2 minutes
                  </li>
                  {isStarter && (
                    <li className="flex items-center gap-2 text-amber-300">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Starter plan includes 3 staging credits/month
                    </li>
                  )}
                </ul>
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition font-semibold shadow-lg"
                >
                  {isFree ? 'Upgrade to Access Virtual Staging' : 'Upgrade to Pro for More Credits'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
        <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <p className="text-sm text-blue-200">
          Your descriptions will be optimized for{' '}
          <strong>{detectedNeighborhood?.neighborhood?.name || 'Charleston'}</strong> with
          hyper-local vocabulary and selling points.
        </p>
      </div>
    </div>
  );
}

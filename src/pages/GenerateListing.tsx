import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { apiCall, parseApiError, AppError } from '../lib/errorHandler';
import {
  Waves,
  LogOut,
  LayoutDashboard,
  Loader2,
  AlertCircle,
  Home,
  Camera,
  Sparkles,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import ResultsDisplay from '../components/ResultsDisplay';
import UpgradeModal from '../components/UpgradeModal';
import StepIndicator, { Step } from '../components/steps/StepIndicator';
import PropertyBasicsStep from '../components/steps/PropertyBasicsStep';
import PhotosStep from '../components/steps/PhotosStep';
import AmenitiesSelector, { idToLabel } from '../components/AmenitiesSelector';
import ReviewStep from '../components/steps/ReviewStep';
import { NotificationContainer, NotificationType } from '../components/Notification';
import { neighborhoodService, Neighborhood, NeighborhoodDetectionResult } from '../services/neighborhoodService';
import { mapPropertyTypeToAPI } from '../lib/propertyTypes';
import { logger } from '../lib/logger';

const STEPS: Step[] = [
  { id: 'basics', title: 'Property Basics', shortTitle: 'Basics', icon: Home },
  { id: 'photos', title: 'Photos', shortTitle: 'Photos', icon: Camera },
  { id: 'amenities', title: 'Features & Amenities', shortTitle: 'Amenities', icon: Sparkles },
  { id: 'review', title: 'Review & Generate', shortTitle: 'Review', icon: FileCheck },
];

export default function GenerateListing() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const [currentStep, setCurrentStep] = useState(0);

  const [address, setAddress] = useState(() => {
    const state = window.history.state;
    return state?.address || '';
  });
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [squareFeet, setSquareFeet] = useState('');
  const [propertyType, setPropertyType] = useState('Single Family Home');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenities, setCustomAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [includeAirbnb, setIncludeAirbnb] = useState(false);
  const [includeSocial, setIncludeSocial] = useState(false);
  const [detectedNeighborhood, setDetectedNeighborhood] = useState<NeighborhoodDetectionResult | null>(null);
  const [hasAppliedDefaults, setHasAppliedDefaults] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{
    mls: string;
    airbnb?: string;
    social?: string[];
    confidence: 'high' | 'medium';
    generationId?: string;
    authenticity?: {
      score: 'high' | 'medium' | 'low';
      suggestions: string[];
    };
    stagedImages?: Array<{
      original_url: string;
      staged_url: string;
      style: string;
      room_type: string;
      created_at: string;
    }>;
  } | null>(null);
  const [stagingInProgress, setStagingInProgress] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: NotificationType;
    duration?: number;
  }>>([]);

  useEffect(() => {
    if (address.length > 10) {
      const result = neighborhoodService.detectNeighborhood(address);
      setDetectedNeighborhood(result);

      if (result.neighborhood && !hasAppliedDefaults && selectedAmenities.length === 0) {
        const typicalLabels = neighborhoodService.getTypicalAmenities(result.neighborhood);
        const localLabelToId: Record<string, string> = {};
        Object.entries(idToLabel).forEach(([id, label]) => {
          localLabelToId[label] = id;
        });
        const typicalIds = typicalLabels.map((label) => localLabelToId[label]).filter(Boolean);
        setSelectedAmenities(typicalIds);
        setHasAppliedDefaults(true);
      }
    } else {
      setDetectedNeighborhood(null);
    }
  }, [address, hasAppliedDefaults, selectedAmenities.length]);

  const labelToId: Record<string, string> = {};
  Object.entries(idToLabel).forEach(([id, label]) => {
    labelToId[label] = id;
  });

  const applyNeighborhoodDefaults = () => {
    if (detectedNeighborhood?.neighborhood) {
      const typicalLabels = neighborhoodService.getTypicalAmenities(detectedNeighborhood.neighborhood);
      const typicalIds = typicalLabels.map((label) => labelToId[label]).filter(Boolean);
      setSelectedAmenities(typicalIds);
      setCustomAmenities([]);
    }
  };

  // Enhanced quota checking with proper tier limits
  const generationsRemaining = profile
    ? profile.subscription_tier === 'free'
      ? 3 - profile.generations_this_month
      : profile.subscription_tier === 'starter'
      ? 50 - profile.generations_this_month
      : Infinity // Pro and Pro+ have unlimited
    : Infinity;

  const canGenerate = user ? generationsRemaining > 0 : true;
  
  // Show warning when free tier user has used 2 of 3 monthly generations
  const showWarning = profile?.subscription_tier === 'free' && profile.generations_this_month >= 2;
  
  // Show warning for starter tier when approaching limit (45+ of 50)
  const showStarterWarning = profile?.subscription_tier === 'starter' && profile.generations_this_month >= 45;

  const showNotification = (message: string, type: NotificationType = 'info', duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    setNotifications((prev: Array<{ id: string; message: string; type: NotificationType; duration?: number }>) => 
      [...prev, { id, message, type, duration }]
    );
  };

  const removeNotification = (id: string) => {
    setNotifications((prev: Array<{ id: string; message: string; type: NotificationType; duration?: number }>) => 
      prev.filter((n: { id: string }) => n.id !== id)
    );
  };

  const canProceedToNext = () => {
    if (currentStep === 0) {
      return address.trim().length > 5;
    }
    if (currentStep === 2) {
      // Amenities step - require at least one amenity selected
      return selectedAmenities.length > 0 || customAmenities.length > 0;
    }
    return true;
  };

  const goToNextStep = () => {
    if (currentStep < STEPS.length - 1 && canProceedToNext()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (user && !canGenerate) {
      setShowUpgradeModal(true);
      return;
    }

    // Validate amenities are selected
    if (selectedAmenities.length === 0 && customAmenities.length === 0) {
      setCurrentStep(2); // Go back to amenities step
      showNotification(
        'Please select at least one feature or amenity before generating your listing.',
        'warning',
        6000
      );
      return;
    }

    setGenerating(true);

    try {
      // Convert amenity IDs to labels
      const amenityLabels = selectedAmenities.map((id) => idToLabel[id]).filter(Boolean);
      const allAmenities = [...amenityLabels, ...customAmenities];

      // Upload photos if any (gracefully handle failures)
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        try {
          // Attempt to upload photos - if bucket doesn't exist, upload will fail gracefully
          // We don't check bucket existence first because:
          // 1. User might not have permission to list buckets
          // 2. It's more efficient to try upload and handle errors
          const uploadPromises = photos.map(async (photo: File) => {
            try {
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${photo.name}`;
              const { error } = await supabase.storage
                .from('property-photos')
                .upload(fileName, photo, {
                  cacheControl: '3600',
                  upsert: false,
                });

              if (error) {
                // Check if error is due to missing bucket
                if (error.message?.includes('Bucket') || error.message?.includes('not found')) {
                  logger.warn('Property photos bucket not found:', error);
                  return null;
                }
                logger.warn('Photo upload error:', error);
                return null;
              }

              const { data: { publicUrl } } = supabase.storage
                .from('property-photos')
                .getPublicUrl(fileName);

              return publicUrl;
            } catch (err) {
              logger.warn('Photo upload failed:', err);
              return null;
            }
          });

          const uploadedUrls = await Promise.all(uploadPromises);
          photoUrls = uploadedUrls.filter((url: string | null): url is string => url !== null);
          
          if (photoUrls.length === 0 && photos.length > 0) {
            // All photos failed - likely bucket doesn't exist
            showNotification(
              'Photo storage not available. Generating listing without photos.',
              'warning',
              5000
            );
          } else if (photoUrls.length < photos.length) {
            const failedCount = photos.length - photoUrls.length;
            showNotification(
              `${failedCount} of ${photos.length} photo${failedCount > 1 ? 's' : ''} failed to upload. Continuing with available photos.`,
              'warning',
              5000
            );
          }
        } catch (error) {
          logger.warn('Photo upload process failed:', error);
          showNotification(
            'Photo upload failed. Generating listing without photos.',
            'warning',
            5000
          );
          // Continue without photos rather than failing the entire request
        }
      }

      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the API with retry logic and error handling
      const result = await apiCall<{
        success: boolean;
        data?: {
          id: string;
          mls_description: string;
          airbnb_description?: string;
          social_captions?: string[];
          confidence_level: 'high' | 'medium';
        };
        error?: string;
        code?: string;
      }>(
        '/api/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            address,
            bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
            bathrooms: bathrooms ? parseFloat(bathrooms) : undefined,
            square_feet: squareFeet ? parseInt(squareFeet) : undefined,
            property_type: mapPropertyTypeToAPI(propertyType),
            amenities: allAmenities,
            photo_urls: photoUrls,
            include_airbnb: includeAirbnb,
            include_social: includeSocial,
          }),
        },
        2 // 2 retries
      );

      if (!result.success || !result.data) {
        throw new Error('Invalid response from server');
      }

      // Calculate authenticity for display
      const authenticity = neighborhoodService.calculateCharlestonAuthenticity(result.data.mls_description);

      setResults({
        mls: result.data.mls_description,
        airbnb: result.data.airbnb_description || undefined,
        social: result.data.social_captions || undefined,
        confidence: result.data.confidence_level || 'medium',
        generationId: result.data.id,
        authenticity: {
          score: authenticity.score,
          suggestions: authenticity.suggestions,
        },
      });

      await refreshProfile();
      showNotification('Listing generated successfully!', 'success');
    } catch (error) {
      const parsedError = parseApiError(error);
      
      // Handle specific error codes
      if (error instanceof AppError && error.code === 'QUOTA_EXCEEDED') {
        setShowUpgradeModal(true);
        showNotification('You\'ve reached your monthly generation limit. Upgrade to continue.', 'warning', 7000);
        return;
      }
      
      if (parsedError.code === 'NETWORK_ERROR' || parsedError.retryable) {
        showNotification(
          `${parsedError.message} Would you like to retry?`,
          'error',
          8000
        );
      } else if (parsedError.code === 'TIMEOUT') {
        showNotification(
          'Request timed out. The listing generation may still be processing. Please check your dashboard.',
          'warning',
          8000
        );
      } else {
        showNotification(parsedError.message, 'error', 7000);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleStagePhoto = async (photoIndex: number, style: string, roomType: string) => {
    if (!user || !profile) {
      setShowLoginPrompt(true);
      return;
    }

    if (profile.subscription_tier !== 'pro' && profile.subscription_tier !== 'pro_plus') {
      setShowUpgradeModal(true);
      return;
    }

    setStagingInProgress(true);

    try {
      const selectedPhoto = photos[photoIndex];
      if (!selectedPhoto) {
        throw new Error('Photo not found');
      }

      // Upload photo to staging bucket
      const fileName = `${user.id}/${Date.now()}-${selectedPhoto.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('staging-photos')
        .upload(fileName, selectedPhoto, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('staging-photos')
        .getPublicUrl(uploadData.path);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call staging API
      const response = await fetch('/api/stage-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          photo_url: publicUrl,
          room_type: roomType,
          style: style,
          generation_id: results?.generationId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'UPGRADE_REQUIRED') {
          setShowUpgradeModal(true);
          return;
        }
        throw new Error(result.error || 'Failed to stage photo');
      }

      const queueId = result.data.queue_id;

      // Poll for completion - wrap in Promise to properly await completion
      const pollStatus = (): Promise<void> => {
        return new Promise(async (resolve, reject) => {
          const checkStatus = async (): Promise<void> => {
            try {
              const statusResponse = await fetch(`/api/staging-status?queue_id=${queueId}`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
              });

              const statusResult = await statusResponse.json();

              if (statusResult.success && statusResult.data.status === 'completed') {
                const newStagedImage = {
                  original_url: publicUrl,
                  staged_url: statusResult.data.staged_url,
                  style: style,
                  room_type: roomType,
                  created_at: new Date().toISOString(),
                };

                // Update results with staged image
                setResults((prev) => ({
                  ...prev!,
                  stagedImages: [...(prev?.stagedImages || []), newStagedImage],
                }));

                setStagingInProgress(false);
                showNotification('Photo staged successfully!', 'success');
                await refreshProfile();
                resolve();
              } else if (statusResult.data.status === 'failed') {
                setStagingInProgress(false);
                reject(new Error(statusResult.data.error_message || 'Staging failed'));
              } else {
                // Still processing, poll again after delay
                setTimeout(() => {
                  checkStatus().catch(reject);
                }, 5000);
              }
            } catch (error) {
              setStagingInProgress(false);
              reject(error);
            }
          };

          // Start polling
          checkStatus().catch(reject);
        });
      };

      await pollStatus();
    } catch (error) {
      logger.error('Staging error:', error);
      showNotification(
        error instanceof Error ? error.message : 'Failed to stage photo',
        'error',
        7000
      );
      setStagingInProgress(false);
    }
  };

  const handleSaveToHistory = () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    // Generation is already saved automatically in /api/generate
    showNotification('Listing saved to your history!', 'success');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleGoToLogin = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <PropertyBasicsStep
            address={address}
            onAddressChange={(value) => {
              setAddress(value);
              setHasAppliedDefaults(false);
            }}
            bedrooms={bedrooms}
            onBedroomsChange={setBedrooms}
            bathrooms={bathrooms}
            onBathroomsChange={setBathrooms}
            squareFeet={squareFeet}
            onSquareFeetChange={setSquareFeet}
            propertyType={propertyType}
            onPropertyTypeChange={setPropertyType}
            detectedNeighborhood={detectedNeighborhood}
            onAddressReset={() => setHasAppliedDefaults(false)}
          />
        );
      case 1:
        return (
          <PhotosStep
            photos={photos}
            onChange={setPhotos}
            maxPhotos={10}
            onSkip={goToNextStep}
          />
        );
      case 2:
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Features & Amenities</h2>
              <p className="text-gray-400">
                Select the features that make your property special. Only selected features will be mentioned in your listing.
              </p>
            </div>
            <AmenitiesSelector
              selectedAmenities={selectedAmenities}
              onAmenitiesChange={setSelectedAmenities}
              customAmenities={customAmenities}
              onCustomAmenitiesChange={setCustomAmenities}
              typicalAmenities={
                detectedNeighborhood?.neighborhood
                  ? neighborhoodService.getTypicalAmenities(detectedNeighborhood.neighborhood)
                  : []
              }
              neighborhoodName={detectedNeighborhood?.neighborhood?.name}
              propertyType={propertyType}
              onApplyDefaults={applyNeighborhoodDefaults}
              userPlan={profile?.subscription_tier || 'free'}
            />
            {(selectedAmenities.length === 0 && customAmenities.length === 0) && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-300">No amenities selected</p>
                  <p className="text-sm text-yellow-400/80 mt-1">
                    Please select at least one feature or amenity to continue. This ensures your listing description is accurate and highlights the property's best features.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <ReviewStep
            address={address}
            propertyType={propertyType}
            bedrooms={bedrooms}
            bathrooms={bathrooms}
            squareFeet={squareFeet}
            selectedAmenities={selectedAmenities}
            customAmenities={customAmenities}
            photos={photos}
            includeAirbnb={includeAirbnb}
            onIncludeAirbnbChange={setIncludeAirbnb}
            includeSocial={includeSocial}
            onIncludeSocialChange={setIncludeSocial}
            detectedNeighborhood={detectedNeighborhood}
            onEditStep={setCurrentStep}
            amenityLabels={idToLabel}
            subscriptionTier={profile?.subscription_tier}
            onStagePhoto={handleStagePhoto}
            stagingInProgress={stagingInProgress}
            onUpgradeClick={() => setShowUpgradeModal(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-gray-900"></div>
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-blue-500/10 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>

      <header className="bg-gray-900/50 border-b border-gray-800/50 shadow-lg sticky top-0 z-40 backdrop-blur-sm relative">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="flex items-center gap-3 hover:opacity-80 transition"
          >
            <Waves className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Lowcountry Listings AI</h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                Hyper-local Charleston listing descriptions in seconds
              </p>
            </div>
          </button>

          <div className="relative">
            {user ? (
              <>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800/50 transition"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {profile?.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-300 hidden sm:block">{profile?.email}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700/50 py-2">
                    <div className="px-4 py-2 border-b border-gray-700/50">
                      <p className="text-xs text-gray-400">Plan</p>
                      <p className="font-semibold text-white capitalize">{profile?.subscription_tier?.replace(/_/g, ' ')}</p>
                      {profile?.subscription_tier === 'free' && (
                        <p className="text-xs text-gray-400 mt-1">
                          {generationsRemaining} generations left
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        window.history.pushState({}, '', '/dashboard');
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 text-gray-300 transition text-left"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 text-red-400 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={handleGoToLogin}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-semibold"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 relative z-10">
        {showWarning && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-300">
                {generationsRemaining} generation{generationsRemaining !== 1 ? 's' : ''} left this month
              </p>
              <p className="text-yellow-300/70 text-sm mt-1">
                You've used {profile?.generations_this_month} of 3 free generations this month.
              </p>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-yellow-400 hover:text-yellow-300 font-medium text-sm underline mt-2"
              >
                Upgrade for unlimited generations →
              </button>
            </div>
          </div>
        )}
        
        {showStarterWarning && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-300">
                Approaching monthly limit: {generationsRemaining} generations remaining
              </p>
              <p className="text-amber-300/70 text-sm mt-1">
                You've used {profile?.generations_this_month} of 50 Starter plan generations.
              </p>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-amber-400 hover:text-amber-300 font-medium text-sm underline mt-2"
              >
                Upgrade to Pro for unlimited →
              </button>
            </div>
          </div>
        )}
        
        {!canGenerate && user && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">
                Monthly generation limit reached
              </p>
              <p className="text-red-300/70 text-sm mt-1">
                You've used all {profile?.subscription_tier === 'free' ? '3' : '50'} of your monthly generations.
              </p>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
              >
                Upgrade to Continue Generating
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 p-6 md:p-8">
            <div className="mb-8">
              <StepIndicator
                steps={STEPS}
                currentStep={currentStep}
                onStepClick={setCurrentStep}
              />
            </div>

            <div className="min-h-[400px]">
              {renderCurrentStep()}
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-700/50">
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={currentStep === 0}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition ${
                  currentStep === 0
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>

              {currentStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  disabled={!canProceedToNext()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={generating || !canGenerate || !address.trim()}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : !canGenerate ? (
                    'Upgrade to Generate'
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Descriptions
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {results && (
            <ResultsDisplay
              mlsDescription={results.mls}
              airbnbDescription={results.airbnb}
              socialCaptions={results.social}
              confidenceLevel={results.confidence}
              onSave={handleSaveToHistory}
              authenticity={results.authenticity}
              photos={photos}
              generationId={results.generationId}
              onUpgradeClick={() => setShowUpgradeModal(true)}
              stagedImages={results.stagedImages}
              subscriptionTier={profile?.subscription_tier || 'free'}
            />
          )}
        </form>
      </main>

      <footer className="bg-gray-900/50 border-t border-gray-800/50 mt-12 backdrop-blur-sm relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-6 text-sm text-gray-400">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="hover:text-white transition"
            >
              Pricing
            </button>
            <button
              onClick={() => window.history.pushState({}, '', '/dashboard')}
              className="hover:text-white transition"
            >
              Dashboard
            </button>
            <a href="#" className="hover:text-white transition">
              Support
            </a>
          </div>
          <p className="text-sm text-gray-500">Made for Charleston real estate pros</p>
        </div>
      </footer>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />

      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Waves className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Sign in to save your listings
              </h3>
              <p className="text-gray-400">
                Create an account to save your generated listings, access them anytime, and track your history.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleGoToLogin}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
              >
                Sign In / Create Account
              </button>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition font-medium"
              >
                Continue Without Saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateMLSDescription(data: {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  propertyType: string;
  amenities: string[];
  neighborhood: Neighborhood | null;
}): string {
  const parts = [];

  if (data.neighborhood) {
    const proximityTerm = data.neighborhood.vocabulary.proximity_terms[0] || 'in Charleston';
    parts.push(
      `Discover exceptional Lowcountry living at ${data.address}, ${proximityTerm}. This ${data.propertyType.toLowerCase()} embodies ${data.neighborhood.vocabulary.neighborhood_vibe} with ${data.neighborhood.vocabulary.style} design.`
    );
  } else {
    parts.push(
      `Discover Charleston living at its finest at ${data.address}. This ${data.propertyType.toLowerCase()} offers the perfect blend of Lowcountry charm and modern convenience.`
    );
  }

  if (data.bedrooms || data.bathrooms || data.squareFeet) {
    const specs = [];
    if (data.bedrooms) specs.push(`${data.bedrooms} bedroom${data.bedrooms > 1 ? 's' : ''}`);
    if (data.bathrooms) specs.push(`${data.bathrooms} bath${data.bathrooms > 1 ? 's' : ''}`);
    if (data.squareFeet) specs.push(`${data.squareFeet.toLocaleString()} sq ft`);
    parts.push(`Featuring ${specs.join(', ')}, this property is designed for comfortable living.`);
  }

  if (data.amenities.length > 0) {
    const amenitiesDisplay = data.amenities.slice(0, 5).map((a) => {
      if (a.toLowerCase().includes('porch') && data.neighborhood?.name === 'Downtown Charleston') {
        return 'charming piazza';
      }
      return a.toLowerCase();
    });
    parts.push(
      `Highlights include ${amenitiesDisplay.join(', ')}${
        data.amenities.length > 5 ? ', and more' : ''
      }.`
    );
  }

  if (data.neighborhood) {
    const sellingPoint = data.neighborhood.selling_points[0];
    parts.push(`${sellingPoint} in this highly sought-after neighborhood.`);

    if (data.neighborhood.landmarks.length > 0) {
      const landmark = data.neighborhood.landmarks[0];
      parts.push(`Conveniently located near ${landmark}.`);
    }
  } else {
    parts.push(
      `Ideally located in the heart of the Charleston area, you'll enjoy easy access to world-class dining, historic attractions, pristine beaches, and the vibrant culture that makes the Lowcountry so special.`
    );
  }

  parts.push(`Don't miss this opportunity to own a piece of Charleston paradise!`);

  return parts.join(' ');
}

function generateAirbnbDescription(data: {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  amenities: string[];
  neighborhood: Neighborhood | null;
}): string {
  const parts = [];

  if (data.neighborhood) {
    parts.push(
      `Welcome to your Charleston getaway in beautiful ${data.neighborhood.name}! This charming property is perfectly positioned to help you experience all that the Holy City has to offer.`
    );
  } else {
    parts.push(
      `Welcome to your Charleston getaway! This charming property is perfectly positioned to help you experience all that the Holy City has to offer.`
    );
  }

  if (data.bedrooms || data.bathrooms) {
    const specs = [];
    if (data.bedrooms) specs.push(`${data.bedrooms} bedroom${data.bedrooms > 1 ? 's' : ''}`);
    if (data.bathrooms) specs.push(`${data.bathrooms} bath${data.bathrooms > 1 ? 's' : ''}`);
    parts.push(`With ${specs.join(' and ')}, our home comfortably accommodates your group.`);
  }

  if (data.amenities.length > 0) {
    parts.push(
      `Enjoy amenities like ${data.amenities.slice(0, 4).map((a) => a.toLowerCase()).join(', ')}.`
    );
  }

  if (data.neighborhood && data.neighborhood.landmarks.length > 1) {
    const landmarks = data.neighborhood.landmarks.slice(0, 3).join(', ');
    parts.push(
      `You're perfectly located near ${landmarks}, and all the iconic Charleston sights. We've included a local's guide to our favorite spots!`
    );
  } else {
    parts.push(
      `You're minutes from King Street's shopping and dining, the historic waterfront, Rainbow Row, and all the iconic Charleston sights. We've included a local's guide to our favorite spots!`
    );
  }

  parts.push(
    `Whether you're here for a romantic weekend, family vacation, or exploring the Lowcountry, our place is your perfect home base. Book now and get ready to fall in love with Charleston!`
  );

  return parts.join(' ');
}

function generateSocialCaptions(data: {
  address: string;
  propertyType: string;
  amenities: string[];
  neighborhood: Neighborhood | null;
}): string[] {
  const locationTag = data.neighborhood ? `in ${data.neighborhood.name}` : 'in Charleston';
  const neighborhoodHashtag = data.neighborhood
    ? `#${data.neighborhood.name.replace(/\s+/g, '')}`
    : '#CharlestonSC';

  return [
    `Just listed ${locationTag}! This stunning ${data.propertyType.toLowerCase()} captures everything we love about Lowcountry living. DM for details or click the link in bio to schedule your showing. #CharlestonRealEstate #LowcountryLiving ${neighborhoodHashtag}`,
    `New listing alert ${locationTag}! Fall in love with this ${data.propertyType.toLowerCase()} featuring ${data.amenities.slice(0, 2).join(' and ').toLowerCase()}. The Charleston lifestyle you've been dreaming of awaits. Link in bio! ${neighborhoodHashtag} #DreamHome #RealEstate`,
    `Charleston charm meets modern living ${locationTag}. We're excited to present this exceptional ${data.propertyType.toLowerCase()} in one of the area's most sought-after locations. Contact us today to learn more. #CharlestonHomes ${neighborhoodHashtag} #LuxuryRealEstate`,
  ];
}

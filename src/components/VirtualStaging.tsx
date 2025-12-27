import { useState } from 'react';
import { Loader2, Sparkles, AlertCircle, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import StagingStylePicker, { STAGING_STYLES } from './StagingStylePicker';
import StagingPhotoSelector from './StagingPhotoSelector';
import StagingResults from './StagingResults';
import { logger } from '../lib/logger';

interface StagedImage {
  original_url: string;
  staged_url: string;
  style: string;
  room_type: string;
  created_at: string;
}

interface VirtualStagingProps {
  photos: File[];
  generationId?: string;
  onUpgradeClick: () => void;
}

export default function VirtualStaging({
  photos,
  generationId,
  onUpgradeClick,
}: VirtualStagingProps) {
  const { user, profile } = useAuth();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(STAGING_STYLES[0].id);
  const [selectedRoomType, setSelectedRoomType] = useState('living_room');
  const [isStaging, setIsStaging] = useState(false);
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stagingProgress, setStagingProgress] = useState<string>('');

  const canStage = profile && profile.subscription_tier !== 'free';
  const stagingCreditsUsed = profile?.staging_credits_used_this_month || 0;
  const stagingCreditsLimit = getCreditsLimit(profile?.subscription_tier);

  function getCreditsLimit(tier?: string): number {
    switch (tier) {
      case 'starter':
        return 3;
      case 'pro':
        return 10; // Updated: Pro gets 10/mo
      case 'pro_plus':
        return -1; // -1 means unlimited
      default:
        return 0;
    }
  }

  // Handle unlimited credits (-1) before calculating remaining
  const isUnlimited = stagingCreditsLimit === -1;
  const creditsRemaining = isUnlimited ? Infinity : stagingCreditsLimit - stagingCreditsUsed;

  const handleStagePhoto = async () => {
    if (!canStage) {
      onUpgradeClick();
      return;
    }

    if (selectedPhotoIndex === null) {
      setError('Please select a photo to stage');
      return;
    }

    // Check credits (skip check for unlimited)
    if (!isUnlimited && creditsRemaining <= 0) {
      setError('You have used all your staging credits for this month');
      return;
    }

    setIsStaging(true);
    setError(null);
    setStagingProgress('Uploading photo...');

    try {
      const selectedPhoto = photos[selectedPhotoIndex];
      const fileName = `${user?.id}/${Date.now()}-${selectedPhoto.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('staging-photos')
        .upload(fileName, selectedPhoto, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('staging-photos').getPublicUrl(uploadData.path);

      setStagingProgress('Requesting virtual staging...');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const stageResponse = await fetch('/api/stage-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          photo_url: publicUrl,
          room_type: selectedRoomType,
          style: selectedStyle,
          generation_id: generationId,
        }),
      });

      const stageResult = await stageResponse.json();

      if (!stageResponse.ok) {
        if (stageResult.code === 'UPGRADE_REQUIRED') {
          onUpgradeClick();
          return;
        }
        throw new Error(stageResult.error || 'Failed to start staging');
      }

      const queueId = stageResult.data.queue_id;
      setStagingProgress('Queued for processing...');

      let pollCount = 0;
      const maxPolls = 60; // 5 minutes max (60 * 5 seconds)

      const pollStatus = async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
          setError('Staging is taking longer than expected. Please check back in a few minutes.');
          setIsStaging(false);
          setStagingProgress('');
          return;
        }

        try {
          const statusResponse = await fetch(`/api/staging-status?queue_id=${queueId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const statusResult = await statusResponse.json();

          if (!statusResult.success) {
            throw new Error(statusResult.error || 'Failed to check status');
          }

          const status = statusResult.data.status;

          // Update progress message based on status
          switch (status) {
            case 'pending':
              setStagingProgress('Queued for processing...');
              break;
            case 'processing':
              setStagingProgress(`Processing staging... (${pollCount * 5}s)`);
              break;
            case 'completed':
              const newStagedImage: StagedImage = {
                original_url: publicUrl,
                staged_url: statusResult.data.staged_url,
                style: selectedStyle,
                room_type: selectedRoomType,
                created_at: new Date().toISOString(),
              };

              setStagedImages([...stagedImages, newStagedImage]);
              setIsStaging(false);
              setStagingProgress('');
              setSelectedPhotoIndex(null);
              setError(null);
              return; // Stop polling
            case 'failed':
              throw new Error(statusResult.data.error_message || 'Staging failed');
            default:
              setStagingProgress(`Processing... (${pollCount * 5}s)`);
          }

          // Continue polling if not completed or failed
          if (status !== 'completed' && status !== 'failed') {
            setTimeout(pollStatus, 5000);
          }
        } catch (err) {
          logger.error('Polling error:', err);
          setError(err instanceof Error ? err.message : 'Failed to check staging status');
          setIsStaging(false);
          setStagingProgress('');
        }
      };

      // Start polling after a short delay
      setTimeout(pollStatus, 2000);
    } catch (err) {
      logger.error('Staging error:', err);
      setError(err instanceof Error ? err.message : 'Failed to stage photo');
      setIsStaging(false);
      setStagingProgress('');
    }
  };

  if (!user) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <p className="text-gray-400 text-center">
          Sign in to use virtual staging features
        </p>
      </div>
    );
  }

  if (!canStage) {
    return (
      <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-500/20 rounded-lg p-3">
            <Crown className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">
              Virtual Staging - Premium Feature
            </h3>
            <p className="text-gray-300 mb-4">
              Transform empty rooms into beautifully furnished spaces. Virtual staging helps
              buyers visualize the potential of your property.
            </p>
            <ul className="space-y-2 mb-6 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Charleston-inspired design styles
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Multiple room types supported
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Professional-quality results in minutes
              </li>
            </ul>
            <button
              onClick={onUpgradeClick}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Upgrade to Access Virtual Staging
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          Virtual Staging
        </h3>
        <div className="text-sm text-gray-400">
          {stagingCreditsLimit === -1 ? (
            <span className="font-medium text-green-400">Unlimited credits</span>
          ) : (
            <>
              <span className="font-medium text-white">{creditsRemaining}</span> /{' '}
              {stagingCreditsLimit} credits remaining
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {stagedImages.length > 0 && <StagingResults stagedImages={stagedImages} />}

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6">
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
          onClick={handleStagePhoto}
          disabled={isStaging || selectedPhotoIndex === null || (!isUnlimited && creditsRemaining <= 0)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isStaging ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {stagingProgress}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Stage Selected Photo
            </>
          )}
        </button>
      </div>
    </div>
  );
}

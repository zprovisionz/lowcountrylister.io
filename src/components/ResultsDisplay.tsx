import { useState } from 'react';
import { Copy, Check, Edit2, ShieldCheck, AlertCircle } from 'lucide-react';
import VirtualStaging from './VirtualStaging';
import StagingResults from './StagingResults';

interface StagedImage {
  original_url: string;
  staged_url: string;
  style: string;
  room_type: string;
  created_at: string;
}

interface ResultsDisplayProps {
  mlsDescription: string;
  airbnbDescription?: string;
  socialCaptions?: string[];
  confidenceLevel: 'high' | 'medium';
  onSave: () => void;
  authenticity?: {
    score: 'high' | 'medium' | 'low';
    suggestions: string[];
  };
  photos?: File[];
  generationId?: string;
  onUpgradeClick: () => void;
  stagedImages?: StagedImage[];
  subscriptionTier?: 'free' | 'starter' | 'pro' | 'pro_plus';
}

export default function ResultsDisplay({
  mlsDescription,
  airbnbDescription,
  socialCaptions,
  confidenceLevel,
  onSave,
  authenticity,
  photos = [],
  generationId,
  onUpgradeClick,
  stagedImages = [],
  subscriptionTier = 'free',
}: ResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState<'mls' | 'airbnb' | 'social' | 'staging'>('mls');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const tabs: Array<{
    id: 'mls' | 'airbnb' | 'social' | 'staging';
    label: string;
    show: boolean;
    badge?: number;
  }> = [
    { id: 'mls', label: 'MLS/Zillow Description', show: true },
    { id: 'airbnb', label: 'Airbnb/VRBO Description', show: !!airbnbDescription },
    { id: 'social', label: 'Social Media Captions', show: !!socialCaptions },
    { id: 'staging', label: 'Virtual Staging', show: true, badge: stagedImages.length > 0 ? stagedImages.length : undefined },
  ].filter((tab) => tab.show);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 p-6 md:p-8 space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              confidenceLevel === 'high'
                ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                : 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
            }`}
          >
            {confidenceLevel === 'high' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium text-sm">
              {confidenceLevel === 'high'
                ? 'High Confidence — Verified against Charleston sources'
                : 'Medium Confidence — Minor edits suggested'}
            </span>
          </div>
        </div>

        {authenticity && (
          <div
            className={`p-4 rounded-lg border ${
              authenticity.score === 'high'
                ? 'bg-blue-500/10 border-blue-500/20'
                : authenticity.score === 'medium'
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-orange-500/10 border-orange-500/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  authenticity.score === 'high'
                    ? 'text-blue-400'
                    : authenticity.score === 'medium'
                    ? 'text-yellow-400'
                    : 'text-orange-400'
                }`}
              />
              <div className="flex-1">
                <p
                  className={`font-semibold text-sm mb-1 ${
                    authenticity.score === 'high'
                      ? 'text-blue-300'
                      : authenticity.score === 'medium'
                      ? 'text-yellow-300'
                      : 'text-orange-300'
                  }`}
                >
                  Charleston Authenticity:{' '}
                  {authenticity.score === 'high'
                    ? 'Excellent'
                    : authenticity.score === 'medium'
                    ? 'Good'
                    : 'Fair'}
                </p>
                {authenticity.suggestions.length > 0 && (
                  <ul
                    className={`text-xs space-y-1 ${
                      authenticity.score === 'high'
                        ? 'text-blue-200'
                        : authenticity.score === 'medium'
                        ? 'text-yellow-200'
                        : 'text-orange-200'
                    }`}
                  >
                    {authenticity.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span>•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-gray-700/50" role="tablist" aria-label="Description types">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 rounded-t-lg ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
              aria-selected={activeTab === tab.id}
              role="tab"
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              {tab.label}
              {tab.badge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center" aria-label={`${tab.badge} items`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {activeTab === 'mls' && (
          <div className="space-y-4">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/50 relative">
              <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                {subscriptionTier === 'free' 
                  ? `${mlsDescription}\n\n---\nGenerated by Lowcountry Listings AI - Upgrade for more generations and no watermark`
                  : mlsDescription}
              </p>
              {subscriptionTier === 'free' && (
                <div className="absolute bottom-2 right-2 bg-blue-600/20 border border-blue-500/30 rounded px-2 py-1">
                  <p className="text-xs text-blue-300">Free Tier</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(mlsDescription, 'mls')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                aria-label={copiedIndex === 'mls' ? 'MLS description copied to clipboard' : 'Copy MLS description to clipboard'}
              >
                {copiedIndex === 'mls' ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                aria-label="Edit MLS description"
              >
                <Edit2 className="w-4 h-4" aria-hidden="true" />
                Edit
              </button>
            </div>
          </div>
        )}

        {activeTab === 'airbnb' && airbnbDescription && (
          <div id="tabpanel-airbnb" className="space-y-4" role="tabpanel" aria-labelledby="tab-airbnb">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/50 relative">
              <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                {subscriptionTier === 'free'
                  ? `${airbnbDescription}\n\n---\nGenerated by Lowcountry Listings AI - Upgrade for more generations and no watermark`
                  : airbnbDescription}
              </p>
              {subscriptionTier === 'free' && (
                <div className="absolute bottom-2 right-2 bg-blue-600/20 border border-blue-500/30 rounded px-2 py-1">
                  <p className="text-xs text-blue-300">Free Tier</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(airbnbDescription, 'airbnb')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                aria-label={copiedIndex === 'airbnb' ? 'Airbnb description copied to clipboard' : 'Copy Airbnb description to clipboard'}
              >
                {copiedIndex === 'airbnb' ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                aria-label="Edit Airbnb description"
              >
                <Edit2 className="w-4 h-4" aria-hidden="true" />
                Edit
              </button>
            </div>
          </div>
        )}

        {activeTab === 'social' && socialCaptions && (
          <div id="tabpanel-social" className="space-y-4" role="tabpanel" aria-labelledby="tab-social">
            {socialCaptions.map((caption, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-300">Caption {index + 1}</h4>
                  <button
                    onClick={() => copyToClipboard(caption, `social-${index}`)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    aria-label={copiedIndex === `social-${index}` ? `Social caption ${index + 1} copied to clipboard` : `Copy social caption ${index + 1} to clipboard`}
                  >
                    {copiedIndex === `social-${index}` ? (
                      <>
                        <Check className="w-3 h-3" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 relative">
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                    {subscriptionTier === 'free'
                      ? `${caption}\n\n---\nGenerated by Lowcountry Listings AI - Upgrade for more`
                      : caption}
                  </p>
                  {subscriptionTier === 'free' && (
                    <div className="absolute bottom-2 right-2 bg-blue-600/20 border border-blue-500/30 rounded px-2 py-1">
                      <p className="text-xs text-blue-300">Free</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'staging' && (
          <div className="space-y-6">
            {stagedImages.length > 0 ? (
              <StagingResults stagedImages={stagedImages} />
            ) : (
              <VirtualStaging
                photos={photos}
                generationId={generationId}
                onUpgradeClick={onUpgradeClick}
              />
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-700/50 pt-6 space-y-4">
        {subscriptionTier === 'free' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              Generated by Lowcountry Listings AI (free tier) — Upgrade for no watermark + unlimited generations
            </p>
            <button
              onClick={onUpgradeClick}
              className="mt-2 text-blue-400 hover:text-blue-300 font-medium text-sm underline"
            >
              Upgrade Now
            </button>
          </div>
        )}

        <button
          onClick={() => {
            onSave();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          }}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2"
          aria-label={saved ? 'Saved to history' : 'Save listing to history'}
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" aria-hidden="true" />
              Saved to History!
            </>
          ) : (
            'Save to History'
          )}
        </button>
      </div>
    </div>
  );
}

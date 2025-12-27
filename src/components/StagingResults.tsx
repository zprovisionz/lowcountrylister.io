import { useState } from 'react';
import { Download, ArrowLeftRight } from 'lucide-react';

interface StagedImage {
  original_url: string;
  staged_url: string;
  style: string;
  room_type: string;
  created_at: string;
}

interface StagingResultsProps {
  stagedImages: StagedImage[];
}

export default function StagingResults({ stagedImages }: StagingResultsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  if (stagedImages.length === 0) {
    return null;
  }

  const activeStagedImage = stagedImages[activeIndex];

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Staged Photos</h3>
        {stagedImages.length > 1 && (
          <div className="flex gap-2">
            {stagedImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-2 h-2 rounded-full transition ${
                  activeIndex === index ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700 select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <div className="absolute inset-0">
          <img
            src={activeStagedImage.staged_url}
            alt="Staged"
            className="w-full h-full object-cover"
          />
        </div>

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            src={activeStagedImage.original_url}
            alt="Original"
            className="w-full h-full object-cover"
          />
        </div>

        <div
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize"
          style={{ left: `${sliderPosition}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={() => setIsDragging(true)}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg">
            <ArrowLeftRight className="w-4 h-4 text-gray-900" />
          </div>
        </div>

        <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
          Before
        </div>
        <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
          After
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          <span className="font-medium text-gray-300">Style:</span>{' '}
          {activeStagedImage.style.replace(/_/g, ' ')} •{' '}
          <span className="font-medium text-gray-300">Room:</span>{' '}
          {activeStagedImage.room_type.replace(/_/g, ' ')}
        </div>
        <button
          onClick={() =>
            handleDownload(
              activeStagedImage.staged_url,
              `staged-${activeStagedImage.style}-${Date.now()}.jpg`
            )
          }
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
}

import { Check } from 'lucide-react';

interface StagingPhotoSelectorProps {
  photos: File[];
  selectedPhotoIndex: number | null;
  onPhotoSelect: (index: number) => void;
}

export default function StagingPhotoSelector({
  photos,
  selectedPhotoIndex,
  onPhotoSelect,
}: StagingPhotoSelectorProps) {
  if (photos.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400">
          No photos uploaded. Upload photos in the generation form to use virtual staging.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-300 mb-3 block">
        Select Photo to Stage
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((photo, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onPhotoSelect(index)}
            className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition ${
              selectedPhotoIndex === index
                ? 'border-blue-500 ring-2 ring-blue-500/50'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <img
              src={URL.createObjectURL(photo)}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {selectedPhotoIndex === index && (
              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                <div className="bg-blue-500 rounded-full p-2">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              Photo {index + 1}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Upload, X, Camera, Image as ImageIcon, Sparkles, ArrowRight } from 'lucide-react';

interface PhotosStepProps {
  photos: File[];
  onChange: (photos: File[]) => void;
  maxPhotos?: number;
  onSkip?: () => void;
}

export default function PhotosStep({ photos, onChange, maxPhotos = 10, onSkip }: PhotosStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    addPhotos(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addPhotos(files);
    }
  };

  const addPhotos = (newFiles: File[]) => {
    const remaining = maxPhotos - photos.length;
    const filesToAdd = newFiles.slice(0, remaining);
    onChange([...photos, ...filesToAdd]);
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Add Photos</h2>
        <p className="text-gray-400">
          Upload property photos for AI-enhanced descriptions
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-all duration-300 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
            : 'border-gray-600 hover:border-blue-400 hover:bg-gray-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
          <Camera className="w-10 h-10 text-blue-400" />
        </div>

        <h3 className="text-xl font-semibold text-white mb-2">
          Drag photos here or click to upload
        </h3>
        <p className="text-gray-400 mb-6">
          Up to {maxPhotos} images - JPG, PNG, or WebP
        </p>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={photos.length >= maxPhotos}
          className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
        >
          <Upload className="w-5 h-5" />
          Choose Files
        </button>

        {photos.length > 0 && (
          <div className="mt-4 text-sm text-gray-400">
            {photos.length} of {maxPhotos} photos uploaded
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Your Photos ({photos.length})
            </h3>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-sm text-gray-400 hover:text-red-400 transition"
            >
              Remove all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative group animate-scaleIn">
                <div className="aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:bg-red-600 hover:scale-110"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-lg backdrop-blur-sm">
                  {index + 1}
                </div>
              </div>
            ))}

            {photos.length < maxPhotos && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm">Add more</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="font-medium text-gray-200">AI Photo Analysis</p>
          <p className="text-sm text-gray-400 mt-0.5">
            Photos help our AI identify features like hardwood floors, granite counters,
            and architectural details for more accurate descriptions.
          </p>
        </div>
      </div>

      {photos.length === 0 && onSkip && (
        <div className="text-center">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition group"
          >
            <span>Skip for now</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-xs text-gray-500 mt-1">You can add photos later</p>
        </div>
      )}
    </div>
  );
}

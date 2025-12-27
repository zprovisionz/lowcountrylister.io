import { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface PhotoUploaderProps {
  photos: File[];
  onChange: (photos: File[]) => void;
  maxPhotos?: number;
}

export default function PhotoUploader({ photos, onChange, maxPhotos = 10 }: PhotoUploaderProps) {
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
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 hover:border-blue-400 hover:bg-gray-700/30'
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

        <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-300 font-medium mb-2">
          Drag and drop photos here, or click to browse
        </p>
        <p className="text-sm text-gray-400 mb-4">
          Up to {maxPhotos} images ({photos.length} uploaded)
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={photos.length >= maxPhotos}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Choose Files
        </button>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <img
                  src={URL.createObjectURL(photo)}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-lg"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 italic flex items-start gap-2">
        <ImageIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Upload key photos — AI will analyze visible features for accurate description
      </p>
    </div>
  );
}

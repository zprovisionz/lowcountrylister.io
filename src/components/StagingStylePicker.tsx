import { Palette } from 'lucide-react';

export const STAGING_STYLES = [
  {
    id: 'coastal_modern',
    name: 'Coastal Modern',
    description: 'Clean lines with natural textures and ocean-inspired colors',
  },
  {
    id: 'lowcountry_traditional',
    name: 'Lowcountry Traditional',
    description: 'Classic Southern charm with comfortable elegance',
  },
  {
    id: 'charleston_classic',
    name: 'Charleston Classic',
    description: 'Historic elegance with refined period details',
  },
  {
    id: 'contemporary_coastal',
    name: 'Contemporary Coastal',
    description: 'Modern sophistication with beach-inspired accents',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Simple and uncluttered with functional beauty',
  },
] as const;

export const ROOM_TYPES = [
  { id: 'living_room', name: 'Living Room' },
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'dining_room', name: 'Dining Room' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'bathroom', name: 'Bathroom' },
  { id: 'office', name: 'Office' },
  { id: 'outdoor', name: 'Outdoor/Patio' },
] as const;

interface StagingStylePickerProps {
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  selectedRoomType: string;
  onRoomTypeChange: (roomType: string) => void;
}

export default function StagingStylePicker({
  selectedStyle,
  onStyleChange,
  selectedRoomType,
  onRoomTypeChange,
}: StagingStylePickerProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
          <Palette className="w-4 h-4" />
          Staging Style
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STAGING_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => onStyleChange(style.id)}
              className={`text-left p-4 rounded-lg border-2 transition ${
                selectedStyle === style.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
              }`}
            >
              <div className="font-semibold text-white mb-1">{style.name}</div>
              <div className="text-xs text-gray-400">{style.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300 mb-3 block">
          Room Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROOM_TYPES.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => onRoomTypeChange(room.id)}
              className={`p-3 rounded-lg border-2 font-medium text-sm transition ${
                selectedRoomType === room.id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500'
              }`}
            >
              {room.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

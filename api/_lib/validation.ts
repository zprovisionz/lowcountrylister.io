import { z } from 'zod';

export const GenerateListingSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  square_feet: z.number().int().min(0).optional(),
  property_type: z.enum([
    'single_family',
    'townhouse',
    'condo',
    'multi_family',
    'land',
    'other',
  ]),
  amenities: z.array(z.string()).default([]),
  photo_urls: z.array(z.string().url()).default([]),
  include_airbnb: z.boolean().default(false),
  include_social: z.boolean().default(false),
  photos_to_stage: z
    .array(
      z.object({
        url: z.string().url(),
        room_type: z.string(),
        style: z.string(),
      })
    )
    .optional(),
  team_id: z.string().uuid().optional(),
});

export const StagePhotoSchema = z.object({
  photo_url: z.string().url('Valid photo URL is required'),
  room_type: z.enum([
    'living_room',
    'bedroom',
    'kitchen',
    'dining_room',
    'bathroom',
    'office',
    'exterior',
    'other',
  ]),
  style: z.enum([
    'coastal_modern',
    'lowcountry_traditional',
    'contemporary',
    'transitional',
    'farmhouse',
    'luxury',
  ]),
  generation_id: z.string().uuid().optional(),
});

export const CreateCheckoutSchema = z.object({
  price_id: z.string().min(1, 'Price ID is required'),
  success_url: z.string().url('Valid success URL is required'),
  cancel_url: z.string().url('Valid cancel URL is required'),
});

export function validateImageUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const parsedUrl = new URL(url);

    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const hasValidExtension = validExtensions.some((ext) =>
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return {
        valid: false,
        error:
          'Image must be in JPG, PNG, or WebP format',
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid image URL' };
  }
}

export function isValidRoomType(roomType: string): boolean {
  const validTypes = [
    'living_room',
    'bedroom',
    'kitchen',
    'dining_room',
    'bathroom',
    'office',
  ];
  return validTypes.includes(roomType);
}

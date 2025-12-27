/**
 * Few-Shot Library for Charleston Area Real Estate Descriptions
 * 
 * Collected on December 16, 2025 from active Zillow listings
 * 
 * This library contains 10 diverse, high-quality real estate descriptions
 * covering various neighborhoods, property types, and styles. These examples
 * are used to train the AI model on authentic Charleston real estate writing
 * patterns, terminology, and persuasive techniques.
 */

export interface FewShotExample {
  id: string;
  neighborhood: string;
  address: string;
  propertyType: string;
  beds: number;
  baths: number;
  squareFeet: number;
  yearBuilt?: number;
  keyAmenities: string[];
  description: string;
  style: 'family' | 'historic' | 'modern' | 'luxury' | 'vacation' | 'townhouse';
  priceRange?: 'affordable' | 'mid-range' | 'luxury';
}

export const CHARLESTON_FEWSHOT_EXAMPLES: FewShotExample[] = [
  {
    id: 'mp-park-west-1',
    neighborhood: 'Mount Pleasant - Park West',
    address: '2651 Park West Blvd, Mount Pleasant, SC 29466',
    propertyType: 'Single Family Home',
    beds: 5,
    baths: 4,
    squareFeet: 3002,
    yearBuilt: 2018,
    style: 'family',
    priceRange: 'mid-range',
    keyAmenities: [
      'Cozy gas fireplace',
      'Classic Charleston-style piazzas',
      'Gourmet kitchen with premium stainless steel appliances',
      'Elegant quartz countertops',
      'Designer glass tile backsplash',
      'Walk-in pantry',
      'Luxurious primary suite with tray ceiling',
      'Spa-inspired ensuite with walk-in shower',
      'Soaking tub',
      'Dual vanity',
      'Expansive walk-in closet',
      'Versatile first-floor room (office/guest suite)',
      'Neighborhood pool',
      'Tennis courts',
      'Clubhouse',
    ],
    description: `Experience the timeless charm of Lowcountry living in this stunning two-story residence featuring classic Charleston-style piazzas. This exceptional home offers 5 bedrooms, 4 full bathrooms, and sophisticated finishes throughout all enhanced by the location in the highly sought Park West community. Natural light accents beautiful flooring throughout. The gourmet kitchen showcases premium stainless steel appliances, elegant quartz countertops, designer glass tile backsplash, and a walk-in pantry for optimal storage. The inviting living room features a cozy gas fireplace, perfect for relaxing evenings. The versatile first-floor front room serves beautifully as a home office or guest suite. The luxurious primary suite boasts a sophisticated tray ceiling and spa-inspired ensuite with walk-in shower, soaking tub, dual vanity sinks, and expansive walk-in closet. Two additional bedrooms share a full bathroom, while the fifth bedroom offers flexibility as a media room, playroom, or additional ensuite. Neighborhood amenities include a pool, tennis courts, and clubhouse. Premier shopping, diverse dining, and pristine beaches are all within easy reach. 2651 Park West Boulevard seamlessly blends Charleston architectural tradition with modern luxury. The combination of versatile living spaces, premium finishes, and protected natural surroundings creates an exceptional offering in today's market.`,
  },
  {
    id: 'mp-park-west-2',
    neighborhood: 'Mount Pleasant - Park West',
    address: '2666 Park West Blvd, Mount Pleasant, SC 29466',
    propertyType: 'Townhouse',
    beds: 4,
    baths: 3,
    squareFeet: 2871,
    yearBuilt: 2019,
    style: 'townhouse',
    priceRange: 'mid-range',
    keyAmenities: [
      'Primary suite downstairs with sitting area',
      'Large bath',
      'Walk-in closet',
      'Gourmet kitchen with upgraded quartz',
      'Gas stove',
      'Island bar',
      'Stainless appliances',
      'Big pantry',
      'Huge loft',
      'Extra cove office area upstairs',
      'Open floor plan',
      'Laundry and powder room main level',
    ],
    description: `This like-new duplex townhouse feels more like a SFD home. It's MUCH larger than it appears from the exterior. Back on the market at no fault of the seller & not related to the property conditions. PRIMARY DOWN w/ OPEN floor plan. The gourmet kitchen features upgraded quartz, gas stove, island with a bar, stainless steel appliances,& big pantry. Downstairs showcases the owners' suite w/ sitting area, plus a large bath (separate potty), & walk-in closet. The family room, eat-in kitchen, laundry, & powder rooms complete the main level. Upstairs offers 3 spacious BR's, HUGE LOFT, & EXTRA COVE AREA for an office. A full bath, big storage closet, & attic complete the upstairs.`,
  },
  {
    id: 'mp-old-village',
    neighborhood: 'Mount Pleasant - Old Village',
    address: '1504 Old Village Dr, Mount Pleasant, SC 29464',
    propertyType: 'Single Family Home',
    beds: 3,
    baths: 2,
    squareFeet: 1554,
    yearBuilt: 1994,
    style: 'historic',
    priceRange: 'mid-range',
    keyAmenities: [
      'Vaulted ceiling living room with fireplace',
      'Open floor plan',
      'Hardwood floors',
      'French doors to deck',
      'Eat-in kitchen with granite',
      'Stainless appliances',
      'Gas range',
      "Owner's suite with tray ceiling",
      'Walk-in closet',
      'En suite with dual vanities',
      'Soaking tub',
      'Separate shower',
      'Fenced backyard with fruit trees',
      'New HVAC',
      'Encapsulated crawlspace',
    ],
    description: `In the heart of Old Village, where time slows and Charleston's coastal charm lingers beneath centuries-old oaks, this single-story home offers a rare opportunity to live in Mount Pleasant's most sought-after neighborhood. Here, the essence of Lowcountry living unfolds--historic character, walkable streets, a true sense of community, and an unhurried connection to the water. Inside, this light-filled, airy home features an open floor plan designed for effortless entertaining and everyday comfort. The vaulted ceiling draws the eye upward in the living room, where a fireplace adds warmth and character. French doors open to a generous deck overlooking a fenced backyard with lemon, olive, and Asian pear trees -a peaceful setting for morning coffee or evening gatherings. Wainscoting lends charm to the dining area, while the eat-in kitchen offers granite countertops, stainless appliances, and a gas range. Hardwood floors flow throughout, adding cohesion and warmth. The split-bedroom layout ensures privacy for the owner's suite, complete with a tray ceiling, walk-in closet, and en suite bath featuring dual vanities, soaking tub, and separate shower. Recent improvements include a new HVAC system with ductwork and a professionally encapsulated, dehumidified crawlspace, providing lasting comfort and peace of mind. Beyond the walls, the setting defines the home. The Old Village - a National Historic District since 1973 - is celebrated for its historic architecture, oak-lined streets, and walkable coastal lifestyle. Neighbors gather at local cafés and boutiques, and sunsets are best enjoyed from the Pitt Street Bridge or along Shem Creek's waterfront. Top-rated Mt. Pleasant Academy is just blocks away, with Downtown Charleston and Sullivan's Island beaches only minutes from your doorstep. Schedule your private showing to experience the unmatched blend of history, character, and coastal charm that defines life in the Old Village.`,
  },
  {
    id: 'summerville-nexton',
    neighborhood: 'Summerville - Nexton',
    address: 'Nexton community, Summerville, SC 29486',
    propertyType: 'Single Family Home',
    beds: 3,
    baths: 2,
    squareFeet: 1700,
    style: 'modern',
    priceRange: 'mid-range',
    keyAmenities: [
      'Pool',
      'Playground',
      'Pond',
      'Trails',
      'Charleston-style homes with modern design',
      'Access to restaurants, shops, services in Central District',
    ],
    description: `Love where you live at Nexton by Pulte Homes in Summerville, SC. Just three miles off I-26, Nexton features five distinct villages and a lively Central District with restaurants, shops, and services. Explore our Charleston-style homes, thoughtfully designed for modern living with access to trails, parks, and top-tier amenities. Discover the lifestyle you've been looking for!`,
  },
  {
    id: 'summerville-cane-bay',
    neighborhood: 'Summerville - Cane Bay',
    address: 'The Coves at Lakes of Cane Bay, Summerville, SC 29486',
    propertyType: 'Single Family Home',
    beds: 3,
    baths: 2,
    squareFeet: 1700,
    style: 'modern',
    priceRange: 'mid-range',
    keyAmenities: [
      'Energy-efficient designs',
      'Situated around 300-acre lake',
      'Designer finishes',
      'Whirlpool appliances',
      'Whole-home blinds',
    ],
    description: `Enjoy industry-leading, energy-efficient homes at Cane Bay. Situated around a sparkling 300-acre lake, discover one- and two-story floorplans with designer finishes. Plus, every homes comes with a full suite of new Whirlpool® appliances and whole home blinds. This master-planned community is easily accessible to Hwy 17, I-26, downtown Summerville, and Lake Moultrie offering a lifestyle of comfort and convenience.`,
  },
  {
    id: 'downtown-south-of-broad-1',
    neighborhood: 'Downtown Charleston - South of Broad',
    address: '54 Gibbes St, Charleston, SC 29401',
    propertyType: 'Single Family Home',
    beds: 4,
    baths: 5,
    squareFeet: 4374,
    yearBuilt: 1910,
    style: 'historic',
    priceRange: 'luxury',
    keyAmenities: [
      'Inviting front porch',
      'Parquet floors',
      'Original fireplace',
      'Detailed moldings',
      "Chef's kitchen with marble counters",
      'La Cornue range',
      'Coffered ceilings',
      'Luxurious primary suite with spa-like bath',
      'Versatile lower level (media/gym/wine room)',
      'Off-street parking',
    ],
    description: `Welcome to 54 Gibbes Street, a chic Charleston home located in the coveted South of Broad neighborhood. Built in 1910, this timeless single-family home spans approximately 4,374 square feet, showcasing classic architectural features while perfectly blending historic charm with modern luxury. The spacious, inviting front porch provides an ideal spot to welcome your guests and enjoy a morning coffee or evening cocktail. As you enter the home, you are greeted with preserved historic details such as parquet floors, French glass doors, original fire place, detailed moldings and transoms throughout. The main level offers formal living and dining rooms, along with a spacious sitting room featuring a built-in bar and powder room. The well-appointed kitchen is fully equipped with marble counter--tops, custom cabinetry, and high-end appliances, including a La Cornue range along with coffered ceilings and built-in seating along the wall of windows, offering stunning light. The handsome primary bedroom suite is situated on the first floor with multiple windows, a walk-in closet, and an expansive ensuite bath adorned with dual marble vanities and spa-like shower. A dramatic staircase leads you upstairs where you will find three additional designer bedrooms, also accompanied by two gorgeous bathrooms. Your guests will never want to leave! The lower level provides versatile space suitable for a media/recreation room, gym, or wine room, complete with a full bathroom, storage room and a separate entrance. The property also includes the convenience of off-street parking with a spacious driveway. This prime location is just footsteps or golf cart away to the area's iconic attractions such as Colonial Lake, parks, tennis & pickle ball courts, the Battery, shops, renowned restaurants, and art galleries. Don't miss this special opportunity to effortlessly enjoy the rich culture and vibrant Charleston lifestyle here at 54 Gibbes.`,
  },
  {
    id: 'downtown-south-of-broad-2',
    neighborhood: 'Downtown Charleston - South of Broad',
    address: '69 King St, Charleston, SC 29401',
    propertyType: 'Single Family Home',
    beds: 4,
    baths: 4,
    squareFeet: 3554,
    yearBuilt: 1792,
    style: 'historic',
    priceRange: 'luxury',
    keyAmenities: [
      'Iconic piazza',
      'Soaring ceilings',
      'Restored heart pine floors',
      "Chef's kitchen (2022) with bespoke cabinetry",
      'Premium appliances',
      'Wine fridge',
      'Private walled garden with firepit',
      'Fountain',
      'Built-in grill',
      'Off-street parking',
      'Slate/copper roof',
    ],
    description: `Originally built in 1792 and reconstructed in 1851, 69 King Street is a masterfully restored Charleston Single blending historic charm with modern luxury--nestled just steps from The Battery in the heart of South of Broad. Framed by gas lanterns and blooming window boxes, this solid brick home welcomes you through its iconic piazza and into a flexible floor plan featuring soaring ceilings, custom millwork, and restored heart pine floors. Renowned interior designer Tammy Connor lent her timeless Southern elegance to the home's restoration, ensuring every detail reflects refined Lowcountry charm. The chef's kitchen, fully renovated in 2022, is adorned with bespoke cabinetry, premium appliances, and a wine fridge--while all bathrooms have been thoughtfully remodeled with timeless finishes. The third floor features two charming guest suites with mini-split HVAC systems and captivating rooftop views. Outside, a 2022 redesign by landscape architect Robert Chesnut transformed the private walled garden into a true Lowcountry retreat complete with ambient moonlighting, gas firepit, water fountain, and built-in grill. Notable updates include a 2012 slate and copper roof, a poured concrete basement base for storage (2022), all-new plumbing, electrical, and insulation, plus a termite bond and flood policy in place (Zone X, no flood insurance required). BAR-approved plans to enclose the rear piazza convey along with a commissioned house history. With off-street parking and every modern comfort discretely integrated into the home's historic fabric, 69 King Street is a rare turnkey opportunity in Charleston's most storied neighborhood.`,
  },
  {
    id: 'daniel-island',
    neighborhood: 'Daniel Island',
    address: '2205 Daniel Island Dr, Charleston, SC 29492',
    propertyType: 'Single Family Home',
    beds: 3,
    baths: 3,
    squareFeet: 2490,
    yearBuilt: 2001,
    style: 'modern',
    priceRange: 'mid-range',
    keyAmenities: [
      'Gourmet kitchen with custom cabinetry',
      '48" professional gas range',
      'Quartz counters',
      'Luxurious primary bath with freestanding tub',
      'Smart features',
      'New roof',
      'Landscaping',
      'Trex deck',
      'Herringbone driveway',
      'Potential 4th bedroom (FROG)',
    ],
    description: `A masterpiece of renovation and modern comfort! Step into this meticulously renovated home, where luxury meets thoughtful design. No detail has been overlooked in transforming this home into a true gem with unparalleled comfort and style. The heart of this home is undoubtedly the gourmet kitchen, a chef's dream come true. It features all-new floor-to-ceiling custom cabinetry, a stylish commercial grade hood, an expansive island with integrated lighting and spacious pantry. Culinary enthusiasts will delight in the 48'' 140 K BTU natural gas double oven, boasting 8 Italian-made Defendi burners, dual 20K burners, and a 650 BTU simmering station. The kitchen also includes a commercial-grade ducted ventilation system, a convenient pot filler, and elegant backsplash. A coffee station with extra-large built-in microwave and a spacious refrigerator with dual auto ice maker complete this impressive space, all complemented by exquisite quartz countertops throughout. The entire first floor has been recently redone with porcelain wood-look tile floors installed over leveled cement board subflooring. Indulge in the serene escape of the newly updated primary bathroom, designed with luxury and relaxation in mind. The fully renovated shower showcases Schluter Waterproofing Systems with digital temperature displays, elegant quartz vanities, smart mirror lighting and a large, freestanding soaking tub. Upstairs you'll find commercial-grade, waterproof luxury vinyl flooring, fresh Sherwin Williams paint and a new laundry room with shiplap throughout and an extra deep utility sink. There is also a spacious FROG that could easily be used as a 4th bedroom. A smart fire alarm system with heat sensor has also been added to this home. The exterior of this home features all new golf-course grade Zeon Zoysia grass, new landscaping, a new roof (2021), RainBird Sprinkler Controller, new herringbone driveway, and a Trex composite deck. The list of upgrades goes on!`,
  },
  {
    id: 'mp-old-village-deepwater',
    neighborhood: 'Mount Pleasant - Old Village',
    address: '104 Beach St, Mount Pleasant, SC 29464',
    propertyType: 'Single Family Home',
    beds: 4,
    baths: 3.5,
    squareFeet: 4200,
    yearBuilt: 2007,
    style: 'luxury',
    priceRange: 'luxury',
    keyAmenities: [
      'Private deepwater dock',
      'Panoramic harbor views',
      'Renovated saltwater pool/spa',
      'Elevator',
      'Terraced gardens',
      'Three-car garage',
    ],
    description: `Experience refined deepwater living at this private Legacy Estate in Mount Pleasant's historic Old Village. Privately gated and elevated on a 0.51-acre homesite overlooking Charleston Harbor, this residence captures panoramic views of the downtown skyline, Fort Sumter, Sullivan's Island, and Castle Pinckney. The 4,200-sq-ft home features 4 bedrooms, 3.5 baths, and an elevator for convenient access to all levels. Expansive windows and open living areas are oriented to frame the water from nearly every room. Outdoor living includes a newly renovated saltwater pool and spa, terraced gardens, and multiple entertaining areas designed to enjoy harbor sunsets. A private deepwater dock provides direct boating access for cruising, fishing, or sailing across the harbor. The gated drive leads to a detached three-car garage, lush landscaping, and complete privacy. Shem Creek's waterfront dining and entertainment are just steps or a golf-cart ride away, with beaches and downtown Charleston minutes beyond. A rare Old Village offering combining deepwater access, timeless architecture, and the Charleston Harbor lifestyle.`,
  },
  {
    id: 'sullivans-island',
    neighborhood: "Sullivan's Island",
    address: '409 Station 22 1/2 St, Sullivans Island, SC 29482',
    propertyType: 'Single Family Home',
    beds: 2,
    baths: 1,
    squareFeet: 1000,
    yearBuilt: 1930,
    style: 'vacation',
    priceRange: 'mid-range',
    keyAmenities: [
      'Screened porch',
      'Metal roof',
      'Beadboard and wood-paneled interiors',
      'Short stroll to beach and dining',
    ],
    description: `A Rare Sullivan's Island Offering -- charming coastal cottage offered at a fraction of typical island prices. Just a short stroll to the beach and local dining, the home features a screened porch, metal roof, and timeless beadboard and wood-paneled interiors. Casual, coastal living with coveted access to Charleston's best island community creates the ideal weekend getaway, second home or beach bungalow. This an opportunity seldom found on Sullivan's Island.`,
  },
];

/**
 * Get few-shot examples matching specific criteria
 */
export function getFewShotExamples(filters?: {
  style?: FewShotExample['style'];
  neighborhood?: string;
  propertyType?: string;
  minBeds?: number;
  maxBeds?: number;
  priceRange?: FewShotExample['priceRange'];
}): FewShotExample[] {
  let examples = [...CHARLESTON_FEWSHOT_EXAMPLES];

  if (filters) {
    if (filters.style) {
      examples = examples.filter((e) => e.style === filters.style);
    }
    if (filters.neighborhood) {
      examples = examples.filter((e) =>
        e.neighborhood.toLowerCase().includes(filters.neighborhood!.toLowerCase())
      );
    }
    if (filters.propertyType) {
      examples = examples.filter((e) => e.propertyType === filters.propertyType);
    }
    if (filters.minBeds) {
      examples = examples.filter((e) => e.beds >= filters.minBeds!);
    }
    if (filters.maxBeds) {
      examples = examples.filter((e) => e.beds <= filters.maxBeds!);
    }
    if (filters.priceRange) {
      examples = examples.filter((e) => e.priceRange === filters.priceRange);
    }
  }

  return examples;
}

/**
 * Get a random subset of few-shot examples
 */
export function getRandomFewShotExamples(count: number = 3): FewShotExample[] {
  const shuffled = [...CHARLESTON_FEWSHOT_EXAMPLES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Format few-shot examples for AI prompt
 */
export function formatFewShotExamplesForPrompt(examples: FewShotExample[]): string {
  return examples
    .map((example, index) => {
      return `Example ${index + 1}:
Address: ${example.address}
Property: ${example.beds} beds / ${example.baths} baths / ${example.squareFeet.toLocaleString()} sqft
Neighborhood: ${example.neighborhood}
Amenities: ${example.keyAmenities.join(', ')}
Description:
${example.description}`;
    })
    .join('\n\n---\n\n');
}


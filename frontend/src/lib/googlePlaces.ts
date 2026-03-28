/**
 * Google Places JS SDK utilities.
 *
 * Provides:
 *   - loadGoogleMapsScript()  — lazy-loads the Maps JS API (idempotent)
 *   - getPlacePredictions()   — wraps AutocompleteService
 *   - getPlaceDetails()       — wraps PlacesService.getDetails()
 *   - PlacePrediction / PlaceDetails types
 *
 * Uses ambient typings to avoid requiring @types/google.maps as a dev dependency.
 */

/** Minimal ambient types for the Google Maps Places JS SDK */
interface GMAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

interface GMPlaceResult {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat(): number;
      lng(): number;
    };
  };
  types?: string[];
}

interface GMAutocompleteService {
  getPlacePredictions(
    request: { input: string; types?: string[] },
    callback: (results: GMAutocompletePrediction[] | null, status: string) => void
  ): void;
}

interface GMPlacesService {
  getDetails(
    request: { placeId: string; fields: string[] },
    callback: (result: GMPlaceResult | null, status: string) => void
  ): void;
}

declare global {
  interface Window {
    google: {
      maps: {
        places: {
          AutocompleteService: new () => GMAutocompleteService;
          PlacesService: new (el: HTMLElement) => GMPlacesService;
          PlacesServiceStatus: {
            OK: string;
            [key: string]: string;
          };
        };
      };
    };
    __googleMapsLoaded?: boolean;
    __googleMapsLoading?: Promise<void>;
  }
}

export interface PlacePrediction {
  place_id: string;
  description: string;
  /** First structured token — usually the business name */
  main_text: string;
  /** Everything after the first token — usually address */
  secondary_text: string;
  types: string[];
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
  /** First Google type, mapped to a friendly category */
  category: string;
  types: string[];
}

const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/js';

/**
 * Lazy-load the Google Maps JS API (places library).
 * Safe to call multiple times — resolves immediately once loaded.
 */
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.__googleMapsLoaded) return Promise.resolve();

  if (window.__googleMapsLoading) return window.__googleMapsLoading;

  window.__googleMapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${GOOGLE_MAPS_API_URL}?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.__googleMapsLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps JS API'));
    document.head.appendChild(script);
  });

  return window.__googleMapsLoading;
}

/**
 * Map a raw Google Place type to a friendlier category string.
 */
export function mapGoogleTypeToCategory(types: string[]): string {
  const typeMap: Record<string, string> = {
    restaurant: 'Restaurant',
    food: 'Food & Dining',
    cafe: 'Café',
    bar: 'Bar',
    bakery: 'Bakery',
    meal_takeaway: 'Takeaway',
    meal_delivery: 'Delivery',
    lodging: 'Hotel',
    hotel: 'Hotel',
    store: 'Store',
    shopping_mall: 'Shopping',
    supermarket: 'Supermarket',
    grocery_or_supermarket: 'Grocery',
    gym: 'Gym',
    health: 'Health',
    spa: 'Spa',
    beauty_salon: 'Beauty',
    hair_care: 'Hair Care',
    doctor: 'Healthcare',
    hospital: 'Hospital',
    pharmacy: 'Pharmacy',
    bank: 'Bank',
    atm: 'ATM',
    gas_station: 'Gas Station',
    car_wash: 'Car Wash',
    car_repair: 'Auto Repair',
    movie_theater: 'Cinema',
    night_club: 'Nightclub',
    park: 'Park',
    museum: 'Museum',
    library: 'Library',
    school: 'School',
    university: 'University',
    place_of_worship: 'Place of Worship',
    laundry: 'Laundry',
    pet_store: 'Pet Store',
    veterinary_care: 'Vet',
    electronics_store: 'Electronics',
    clothing_store: 'Clothing',
    furniture_store: 'Furniture',
    hardware_store: 'Hardware',
    book_store: 'Bookstore',
    florist: 'Florist',
    jewelry_store: 'Jewelry',
    real_estate_agency: 'Real Estate',
    travel_agency: 'Travel',
    lawyer: 'Legal',
    accounting: 'Accounting',
    insurance_agency: 'Insurance',
    moving_company: 'Moving',
    painter: 'Painter',
    plumber: 'Plumber',
    electrician: 'Electrician',
    locksmith: 'Locksmith',
    roofing_contractor: 'Roofing',
  };

  for (const type of types) {
    if (typeMap[type]) return typeMap[type];
  }
  return 'Business';
}

/**
 * Fetch autocomplete predictions for a query.
 * Returns an empty array when the API key is absent or loading fails.
 */
export async function getPlacePredictions(
  query: string,
  apiKey: string
): Promise<PlacePrediction[]> {
  if (!apiKey || query.length < 2) return [];

  await loadGoogleMapsScript(apiKey);

  return new Promise((resolve) => {
    const gmaps = window.google.maps;
    const service = new gmaps.places.AutocompleteService();
    service.getPlacePredictions(
      {
        input: query,
        types: ['establishment'],
      },
      (predictions: GMAutocompletePrediction[] | null, status: string) => {
        if (
          status !== gmaps.places.PlacesServiceStatus.OK ||
          !predictions
        ) {
          resolve([]);
          return;
        }

        resolve(
          predictions.map((p: GMAutocompletePrediction) => ({
            place_id: p.place_id,
            description: p.description,
            main_text: p.structured_formatting.main_text,
            secondary_text: p.structured_formatting.secondary_text,
            types: p.types ?? [],
          }))
        );
      }
    );
  });
}

/**
 * Fetch full place details for a given place_id.
 */
export async function getPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceDetails | null> {
  if (!apiKey) return null;

  await loadGoogleMapsScript(apiKey);

  return new Promise((resolve) => {
    // PlacesService requires a map or a DOM element
    const gmaps = window.google.maps;
    const el = document.createElement('div');
    const service = new gmaps.places.PlacesService(el);

    service.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_address', 'geometry', 'types', 'place_id'],
      },
      (place: GMPlaceResult | null, status: string) => {
        if (
          status !== gmaps.places.PlacesServiceStatus.OK ||
          !place
        ) {
          resolve(null);
          return;
        }

        const lat = place.geometry?.location?.lat() ?? 0;
        const lng = place.geometry?.location?.lng() ?? 0;
        const types = place.types ?? [];

        resolve({
          place_id: place.place_id ?? placeId,
          name: place.name ?? '',
          formatted_address: place.formatted_address ?? '',
          lat,
          lng,
          category: mapGoogleTypeToCategory(types),
          types,
        });
      }
    );
  });
}

/**
 * Bold the matching portion of a text string.
 * Returns an array of { text, bold } segments.
 */
export function highlightMatch(
  text: string,
  query: string
): { text: string; bold: boolean }[] {
  if (!query) return [{ text, bold: false }];

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return [{ text, bold: false }];

  return [
    { text: text.slice(0, idx), bold: false },
    { text: text.slice(idx, idx + query.length), bold: true },
    { text: text.slice(idx + query.length), bold: false },
  ].filter((s) => s.text.length > 0);
}

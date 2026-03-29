import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get('input');
  const lat = req.nextUrl.searchParams.get('lat');
  const lng = req.nextUrl.searchParams.get('lng');

  if (!input || input.length < 1) {
    return NextResponse.json({ predictions: [] });
  }

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) {
    return NextResponse.json({ predictions: [], error: 'Places API not configured' });
  }

  try {
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=establishment&key=${key}`;

    // Bias results within ~50 miles (80km) of user's home location
    if (lat && lng) {
      url += `&location=${lat},${lng}&radius=80000`;
    }

    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ predictions: [], error: 'Search failed' });
  }
}

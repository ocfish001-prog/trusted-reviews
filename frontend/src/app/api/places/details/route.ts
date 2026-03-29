import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id');
  if (!placeId) {
    return NextResponse.json({ result: null });
  }

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) {
    return NextResponse.json({ result: null, error: 'Places API not configured' });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_address,geometry,types&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ result: null, error: 'Details fetch failed' });
  }
}

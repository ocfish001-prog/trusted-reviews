import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get('input');
  if (!input || input.length < 1) {
    return NextResponse.json({ predictions: [] });
  }

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) {
    return NextResponse.json({ predictions: [], error: 'Places API not configured' });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=establishment&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ predictions: [], error: 'Search failed' });
  }
}

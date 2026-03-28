'use client';

import { useState, useCallback } from 'react';

export interface GeolocationState {
  coords: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
  requested: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    loading: false,
    error: null,
    requested: false,
  });

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation is not supported by your browser', requested: true }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null, requested: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          loading: false,
          error: null,
          requested: true,
        });
      },
      (err) => {
        let message = 'Unable to retrieve your location';
        if (err.code === err.PERMISSION_DENIED) message = 'Location access denied';
        if (err.code === err.POSITION_UNAVAILABLE) message = 'Location unavailable';
        if (err.code === err.TIMEOUT) message = 'Location request timed out';
        setState({ coords: null, loading: false, error: message, requested: true });
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const clear = useCallback(() => {
    setState({ coords: null, loading: false, error: null, requested: false });
  }, []);

  return { ...state, request, clear };
}

/** Haversine distance in km between two lat/lng points */
export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

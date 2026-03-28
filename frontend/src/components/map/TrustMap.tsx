'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import type { MapBusiness } from '@/lib/api';
import { getTrustPinColor } from '@/lib/utils';
import BusinessCard from './BusinessCard';
import BusinessPin from './BusinessPin';

// Dynamic import of mapbox-gl to avoid SSR issues
let mapboxgl: typeof import('mapbox-gl') | null = null;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const LA_CENTER: [number, number] = [-118.2437, 34.0522];

interface TrustMapProps {
  businesses: MapBusiness[];
  userLocation: { lat: number; lng: number } | null;
  loading?: boolean;
}

interface MarkerRef {
  marker: import('mapbox-gl').Marker;
  businessId: string;
  root: ReturnType<typeof createRoot>;
  container: HTMLDivElement;
}

export default function TrustMap({ businesses, userLocation, loading }: TrustMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const markersRef = useRef<MarkerRef[]>([]);
  const userMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<MapBusiness | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const handlePinClick = useCallback((business: MapBusiness) => {
    setSelectedBusiness(business);
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      const mgl = await import('mapbox-gl');
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled || !mapContainerRef.current) return;

      mapboxgl = mgl;
      mgl.default.accessToken = MAPBOX_TOKEN;

      const center: [number, number] = userLocation
        ? [userLocation.lng, userLocation.lat]
        : LA_CENTER;

      const map = new mgl.default.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center,
        zoom: 12,
        attributionControl: false,
      });

      map.addControl(new mgl.default.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new mgl.default.NavigationControl({ showCompass: false }), 'top-right');

      mapRef.current = map;

      map.on('load', () => {
        if (!cancelled) setMapReady(true);
      });
    }

    initMap();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update business pins whenever businesses or mapReady changes
  useEffect(() => {
    if (!mapRef.current || !mapboxgl || !mapReady) return;
    const mgl = mapboxgl;

    // Remove old markers
    markersRef.current.forEach(({ marker, root }) => {
      marker.remove();
      setTimeout(() => root.unmount(), 0);
    });
    markersRef.current = [];

    // Add new markers
    businesses.forEach((biz) => {
      if (biz.lat == null || biz.lng == null) return;

      const container = document.createElement('div');
      const root = createRoot(container);

      const renderPin = (selected: boolean) => {
        root.render(
          <BusinessPin
            trustDistance={biz.trust_distance}
            selected={selected}
            onClick={() => {
              handlePinClick(biz);
              renderPin(true);
            }}
          />
        );
      };
      renderPin(false);

      const marker = new mgl.default.Marker({ element: container, anchor: 'bottom' })
        .setLngLat([biz.lng, biz.lat])
        .addTo(mapRef.current!);

      markersRef.current.push({ marker, businessId: biz.id, root, container });
    });

    // Cluster source (GeoJSON approach for visual clustering at zoom-out)
    if (mapRef.current.getSource('businesses-cluster')) {
      (mapRef.current.getSource('businesses-cluster') as import('mapbox-gl').GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: businesses
          .filter((b) => b.lat != null && b.lng != null)
          .map((b) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [b.lng!, b.lat!] },
            properties: {
              id: b.id,
              trust_distance: b.trust_distance,
              color: getTrustPinColor(b.trust_distance),
            },
          })),
      });
    } else {
      mapRef.current.addSource('businesses-cluster', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: businesses
            .filter((b) => b.lat != null && b.lng != null)
            .map((b) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [b.lng!, b.lat!] },
              properties: {
                id: b.id,
                trust_distance: b.trust_distance,
                color: getTrustPinColor(b.trust_distance),
              },
            })),
        },
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 50,
      });

      // Cluster circles
      mapRef.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'businesses-cluster',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#f59e0b', 10, '#f59e0b', 30, '#d97706'],
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 30, 36],
          'circle-opacity': 0.9,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff',
        },
      });

      // Cluster count labels
      mapRef.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'businesses-cluster',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Click cluster to zoom in
      mapRef.current.on('click', 'clusters', (e) => {
        const features = mapRef.current!.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        (mapRef.current!.getSource('businesses-cluster') as import('mapbox-gl').GeoJSONSource)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .getClusterExpansionZoom(clusterId, (err: any, zoom: any) => {
            if (err || zoom == null) return;
            const geom = features[0].geometry as GeoJSON.Point;
            mapRef.current!.easeTo({ center: [geom.coordinates[0], geom.coordinates[1]], zoom });
          });
      });

      mapRef.current.on('mouseenter', 'clusters', () => {
        mapRef.current!.getCanvas().style.cursor = 'pointer';
      });
      mapRef.current.on('mouseleave', 'clusters', () => {
        mapRef.current!.getCanvas().style.cursor = '';
      });
    }
  }, [businesses, mapReady, handlePinClick]);

  // User location dot
  useEffect(() => {
    if (!mapRef.current || !mapboxgl || !mapReady) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userLocation) return;

    const el = document.createElement('div');
    el.className = 'user-location-dot';
    el.style.cssText = `
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #3b82f6;
      border: 3px solid white;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.35), 0 2px 8px rgba(0,0,0,0.3);
    `;

    userMarkerRef.current = new mapboxgl.default.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(mapRef.current);

    mapRef.current.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: 13, duration: 800 });
  }, [userLocation, mapReady]);

  // Close card on map click
  useEffect(() => {
    if (!mapRef.current) return;
    const handler = () => setSelectedBusiness(null);
    mapRef.current.on('click', handler);
    return () => { mapRef.current?.off('click', handler); };
  }, [mapReady]);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {(loading || !mapReady) && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 font-medium">Loading map…</p>
          </div>
        </div>
      )}

      {/* Slide-up business card */}
      <BusinessCard business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
    </div>
  );
}

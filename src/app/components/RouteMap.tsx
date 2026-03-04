import { useEffect, useState } from 'react';

interface RouteMapProps {
  from: string;
  to: string;
  onRouteChange?: (info: { distanceKm: number; durationMinutes: number }) => void;
}

// OpenStreetMap integration disabled - users must enter distance manually
export function RouteMap({ from, to, onRouteChange }: RouteMapProps) {
  return null;
}



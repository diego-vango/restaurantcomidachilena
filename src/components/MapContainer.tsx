/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Compass, ShieldCheck, ExternalLink, Map as MapIcon } from 'lucide-react';

export const RESTAURANT_COORDS = { lat: -34.173000, lng: -70.684111 }; // 34°10'22.8"S 70°41'02.8"W
export const RESTAURANT_ADDRESS = 'El Copihue de Oro, Rancagua, Región de O\'Higgins, Chile';

interface MapProps {
  customerAddress?: string;
  orderStatus?: 'Recibido' | 'En Cocina' | 'En Camino' | 'Entregado' | 'Cancelado' | '';
  onRouteCalculated?: (distance: string, duration: string) => void;
  height?: string;
}

export default function MapContainer({
  customerAddress,
  orderStatus,
  onRouteCalculated,
  height = '300px',
}: MapProps) {
  const [estimatedDistance, setEstimatedDistance] = useState<string>('');
  const [estimatedDuration, setEstimatedDuration] = useState<string>('');

  // Automatically calculate a realistic delivery route distance and duration 
  // whenever a customer inputs their address or uses GPS location.
  useEffect(() => {
    if (customerAddress && customerAddress.trim().length > 2 && onRouteCalculated) {
      let baseDistance = 2.0;
      const lowerAddr = customerAddress.toLowerCase();

      // Check if address contains lat/lng coordinates (e.g. from GPS)
      const coordsMatch = customerAddress.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (coordsMatch) {
        const lat = parseFloat(coordsMatch[1]);
        const lon = parseFloat(coordsMatch[2]);
        // Restaurant coords: lat: -34.173000, lng: -70.684111
        const R = 6371; // km
        const dLat = (lat - (-34.173000)) * Math.PI / 180;
        const dLon = (lon - (-70.684111)) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(-34.173000 * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const realKm = R * c;
        baseDistance = Math.max(0.8, Math.min(25, parseFloat(realKm.toFixed(1))));
      } else if (lowerAddr.includes('machalí') || lowerAddr.includes('machali')) {
        baseDistance = 6.2;
      } else if (lowerAddr.includes('graneros')) {
        baseDistance = 12.5;
      } else if (lowerAddr.includes('olivar')) {
        baseDistance = 9.8;
      } else if (lowerAddr.includes('doñihue') || lowerAddr.includes('donihue')) {
        baseDistance = 15.0;
      } else if (lowerAddr.includes('centro') || lowerAddr.includes('plaza')) {
        baseDistance = 1.2;
      } else {
        // Hash seed for consistent distance per street name
        let hash = 0;
        for (let i = 0; i < customerAddress.length; i++) {
          hash = (hash << 5) - hash + customerAddress.charCodeAt(i);
          hash |= 0;
        }
        const variation = (Math.abs(hash) % 40) / 10; // 0.0 to 3.9 km
        baseDistance = 1.2 + variation; // 1.2km to 5.1km
      }

      const travelTimeMinutes = Math.round(baseDistance * 3.5 + 4);
      const totalDeliveryTimeMinutes = 25 + travelTimeMinutes;

      const distStr = `${baseDistance.toFixed(1)} km`;
      const travelDurStr = `${travelTimeMinutes} min`;
      const totalDurStr = `${totalDeliveryTimeMinutes} min`;

      setEstimatedDistance(distStr);
      setEstimatedDuration(totalDurStr);
      onRouteCalculated(distStr, travelDurStr);
    } else if (onRouteCalculated && (!customerAddress || customerAddress.trim().length <= 2)) {
      setEstimatedDistance('');
      setEstimatedDuration('');
      onRouteCalculated('', '');
    }
  }, [customerAddress, onRouteCalculated]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${RESTAURANT_COORDS.lat},${RESTAURANT_COORDS.lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${RESTAURANT_COORDS.lat},${RESTAURANT_COORDS.lng}&navigate=yes`;
  
  // High quality OpenStreetMap interactive embed centered at the exact restaurant coordinates
  // Adjusted with a bbox covering exactly a 5km radius (10km span) around the restaurant
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=-70.738111%2C-34.218000%2C-70.630111%2C-34.128000&layer=mapnik&marker=${RESTAURANT_COORDS.lat}%2C${RESTAURANT_COORDS.lng}`;

  return (
    <div className="flex flex-col gap-3">
      {/* Interactive Map Iframe (Key-free OpenStreetMap) */}
      <div 
        className="relative w-full rounded-3xl overflow-hidden shadow-sm border border-slate-200/60 bg-slate-50"
        style={{ height }}
      >
        <iframe
          title="Ubicación del Restaurante"
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={osmEmbedUrl}
          className="grayscale-[10%] opacity-90 hover:grayscale-0 transition-all duration-300"
          style={{ border: 0 }}
        />
        
        {/* Floating Coordinates Badge */}
        <div className="absolute top-3 left-3 bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 backdrop-blur-xs">
          <Compass className="w-3 h-3 text-red-500 animate-spin-slow" />
          34°10'22.8"S 70°41'02.8"W
        </div>
      </div>

      {/* Elegant Details & Directions Card */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Nuestra Casa</h4>
            <p className="text-xs font-bold text-slate-800 mt-0.5 leading-relaxed">
              {RESTAURANT_ADDRESS}
            </p>
          </div>
        </div>

        {/* Action Buttons to Navigate */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-full border border-slate-200/60 transition-all cursor-pointer"
          >
            <MapIcon className="w-3.5 h-3.5 text-red-500" />
            <span>Google Maps</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-full border border-slate-200/60 transition-all cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            <span>Abrir en Waze</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
          </a>
        </div>

        {/* Primary Route Button */}
        <div className="pt-1">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${RESTAURANT_COORDS.lat},${RESTAURANT_COORDS.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer text-center uppercase tracking-wider"
          >
            <Navigation className="w-4 h-4 fill-white" />
            <span>Cómo llegar (Retiro en Tienda)</span>
          </a>
        </div>

        {/* Dynamic delivery route estimates badge if customer provided address */}
        {customerAddress && estimatedDistance && (
          <div className="p-3.5 bg-red-50/50 rounded-2xl border border-red-100 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Distancia estimada:</span>
              <span className="font-bold text-slate-800">{estimatedDistance}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Tiempo de entrega:</span>
              <span className="font-bold text-red-600">{estimatedDuration}</span>
            </div>
            {orderStatus === 'En Camino' && (
              <div className="text-[10px] text-red-500 font-bold bg-white px-2 py-1 rounded-lg border border-red-100 text-center uppercase tracking-wider mt-1 flex items-center justify-center gap-1 animate-pulse">
                <span>🛵 ¡Repartidor en trayecto a tu domicilio!</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

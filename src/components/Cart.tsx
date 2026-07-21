/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CartItem, Dish, Order } from '../types';
import { formatCLP } from './DishCard';
import { MapPin, ShoppingBag, Trash2, User, Phone, Mail, Loader2, ArrowRight, Navigation, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface CartProps {
  cartItems: CartItem[];
  onUpdateQuantity: (dishId: string, delta: number) => void;
  onRemoveItem: (dishId: string) => void;
  onSubmitOrder: (formData: {
    name: string;
    email: string;
    phone: string;
    address: string;
  }) => Promise<void>;
  onAddressChange?: (address: string) => void;
  isSubmitting: boolean;
  routeDistance: string;
  routeDuration: string;
  isKitchenOpen?: boolean;
}

export default function Cart({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onSubmitOrder,
  onAddressChange,
  isSubmitting,
  routeDistance,
  routeDuration,
  isKitchenOpen = true
}: CartProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [formError, setFormError] = useState('');

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Tu navegador no soporta geolocalización por GPS.');
      return;
    }
    setIsLocating(true);
    setFormError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        let formattedAddress = `Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.address) {
              const road = data.address.road || data.address.pedestrian || data.address.suburb || '';
              const houseNumber = data.address.house_number || '';
              const city = data.address.city || data.address.town || data.address.village || data.address.county || 'Rancagua';
              if (road) {
                formattedAddress = `${road} ${houseNumber}`.trim() + `, ${city}`;
              } else if (data.display_name) {
                formattedAddress = data.display_name.split(',').slice(0, 3).join(',');
              }
            }
          }
        } catch (e) {
          console.log('Reverse geocoding fallback:', e);
        }

        setAddress(formattedAddress);
        if (onAddressChange) {
          onAddressChange(formattedAddress);
        }
        setIsLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setIsLocating(false);
        setFormError('No se pudo obtener tu ubicación automáticamente. Por favor escribe tu dirección manualmente.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const parseDistanceKm = (distStr: string): number => {
    if (!distStr) return 0;
    const cleanStr = distStr.replace(/[^\d.,]/g, '').replace(',', '.');
    return parseFloat(cleanStr) || 0;
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.dish.price * item.quantity, 0);

  const getDeliveryFee = (): number => {
    if (subtotal === 0) return 0;
    const parsedDistance = parseDistanceKm(routeDistance);
    if (!routeDistance || parsedDistance <= 1) {
      return 1000;
    }
    const extraDistance = parsedDistance - 1;
    const extraFee = Math.ceil(extraDistance) * 500;
    return 1000 + extraFee;
  };

  const parsedDistance = parseDistanceKm(routeDistance);
  const isOutOfRange = routeDistance !== '' && parsedDistance > 5.0;

  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!isKitchenOpen) {
      setFormError('Lo sentimos, la cocina está cerrada en este momento (Horario: 11:00 a 20:00 Chile).');
      return;
    }

    if (cartItems.length === 0) {
      setFormError('El carro de compras está vacío.');
      return;
    }

    if (!name.trim() || !email.trim() || !phone.trim() || !address.trim()) {
      setFormError('Por favor complete todos los campos de despacho.');
      return;
    }

    if (isOutOfRange) {
      setFormError(`La dirección ingresada (${routeDistance}) está fuera de nuestro rango de reparto de 5.0 km.`);
      return;
    }

    try {
      await onSubmitOrder({ name, email, phone, address });
    } catch (err: any) {
      setFormError(err.message || 'Error al procesar el pedido. Reintente.');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 pb-4 border-b border-slate-100 mb-4 uppercase tracking-wider">
        <ShoppingBag className="w-5 h-5 text-red-600" />
        Carro de Pedidos
      </h2>

      {cartItems.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ShoppingBag className="w-12 h-12 mx-auto stroke-1 mb-3 text-slate-300" />
          <p className="text-xs">Aún no agregas platos a tu pedido</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cart items */}
          <div className="max-h-60 overflow-y-auto pr-1 space-y-3 divide-y divide-slate-50">
            {cartItems.map((item) => (
              <div key={item.dish.id} className="flex items-start justify-between gap-3 pt-3 first:pt-0">
                <div className="min-w-0 flex-grow">
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mr-2">
                    {item.quantity}x
                  </span>
                  <span className="font-bold text-slate-800 text-sm">{item.dish.name}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatCLP(item.dish.price)} c/u</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-100 rounded-full overflow-hidden bg-slate-50/50">
                    <button
                      onClick={() => onUpdateQuantity(item.dish.id, -1)}
                      className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 text-xs transition-colors font-bold"
                    >
                      -
                    </button>
                    <span className="px-2 text-xs font-bold text-slate-700">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.dish.id, 1)}
                      className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 text-xs transition-colors font-bold"
                    >
                      +
                    </button>
                  </div>
                  
                  <button
                    onClick={() => onRemoveItem(item.dish.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Checkout Form */}
          <form onSubmit={handleSubmit} className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Datos de Despacho</h3>
            
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Nombre Completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isKitchenOpen}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-full py-2.5 pl-10 pr-4 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 focus:bg-white transition-all disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isKitchenOpen}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-full py-2.5 pl-10 pr-4 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 focus:bg-white transition-all disabled:opacity-60"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isKitchenOpen}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-full py-2.5 pl-10 pr-4 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 focus:bg-white transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Dirección (ej. Av. España 450, Rancagua)"
                  value={address}
                  onChange={(e) => {
                    const newAddr = e.target.value;
                    setAddress(newAddr);
                    if (onAddressChange) onAddressChange(newAddr);
                  }}
                  disabled={!isKitchenOpen}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-full py-2.5 pl-10 pr-24 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 focus:bg-white transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isLocating || !isKitchenOpen}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-full flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="Detectar mi ubicación por GPS"
                >
                  {isLocating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 fill-red-600" />
                  )}
                  <span className="hidden sm:inline">{isLocating ? 'Buscando...' : 'Mi GPS'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 px-3 flex items-center gap-1">
                💡 Ingresa tu calle y número o usa <strong>Mi GPS</strong> para calcular tu envío.
              </p>
            </div>

            {/* Route calculations info if available */}
            {routeDistance && routeDuration && (
              <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-600" />
                  Ruta Estimada:
                </span>
                <span className="font-medium">
                  {routeDistance} • {routeDuration} de viaje
                </span>
              </div>
            )}

            {/* Price breakdown */}
            <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs mt-2">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-700">{formatCLP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Despacho:</span>
                <span className="font-semibold text-slate-700">{formatCLP(deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-dashed border-slate-200 pt-2 text-sm">
                <span>Total:</span>
                <span className="text-red-600 font-extrabold text-base">{formatCLP(total)}</span>
              </div>
            </div>

            {isOutOfRange && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-rose-900">Fuera de Cobertura de Despacho</p>
                  <p className="text-[11px] text-rose-800 mt-0.5 leading-snug">
                    Tu dirección está a <strong>{routeDistance}</strong>. Nuestro servicio de reparto sólo cubre hasta <strong>5.0 km</strong> de distancia en Rancagua.
                  </p>
                </div>
              </div>
            )}

            {!isKitchenOpen && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-2xl text-center">
                🚫 Cocina Cerrada en este momento.<br/>El horario de pedidos es de 11:00 a 20:00 (Hora de Chile).
              </div>
            )}

            {formError && (
              <p className="text-xs font-semibold text-rose-500 text-center">{formError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !isKitchenOpen || isOutOfRange}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-200/80 disabled:bg-slate-300 disabled:shadow-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando Pedido...
                </>
              ) : !isKitchenOpen ? (
                <>
                  Cocina Cerrada (11:00 a 20:00)
                </>
              ) : isOutOfRange ? (
                <>
                  Fuera de Rango (Máx 5.0 km)
                </>
              ) : (
                <>
                  Realizar Pedido
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

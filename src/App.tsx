/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken
} from './lib/firebase';
import {
  initializeSpreadsheet,
  fetchDishesFromSheet,
  createOrderInSheet,
  fetchOrdersFromSheet,
  SPREADSHEET_ID
} from './lib/sheets';
import { Dish, CartItem, Order, OrderStatus, NotificationMessage } from './types';
import DishCard, { formatCLP } from './components/DishCard';
import Cart from './components/Cart';
import MapContainer from './components/MapContainer';
import AdminPanel from './components/AdminPanel';
import NotificationManager, {
  playNotificationSound,
  requestNativeNotificationPermission,
  sendNativePushNotification
} from './components/NotificationManager';
import {
  LogOut,
  UtensilsCrossed,
  Settings,
  ShoppingBag,
  Bell,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  Compass,
  MapPin,
  CheckCircle2,
  Plus,
  Phone,
  Mail,
  MessageCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const isKitchenOpen = (): boolean => {
  try {
    const formatter = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const formatted = formatter.format(new Date());
    const [hourStr, minuteStr] = formatted.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const totalMinutes = hour * 60 + minute;
    // 11:00 is 11 * 60 = 660. 20:00 is 20 * 60 = 1200.
    return totalMinutes >= 660 && totalMinutes < 1200;
  } catch (e) {
    const localHour = new Date().getHours();
    return localHour >= 11 && localHour < 20;
  }
};

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Kitchen schedule state
  const [isKitchenOpenState, setIsKitchenOpenState] = useState(isKitchenOpen());

  useEffect(() => {
    const interval = setInterval(() => {
      setIsKitchenOpenState(isKitchenOpen());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sheets state
  const [sheet1Name, setSheet1Name] = useState('');
  const [sheet2Name, setSheet2Name] = useState('');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  // App UI states
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Route / Delivery info
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [activeAddress, setActiveAddress] = useState('');
  const [routeDistance, setRouteDistance] = useState('');
  const [routeDuration, setRouteDuration] = useState('');

  // Active tracking order
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  // Refs for tracking previous states to trigger push notifications on status change
  const previousStatusRef = useRef<Record<string, OrderStatus>>({});
  const initialLoadRef = useRef(true);

  // Add an in-app notification helper
  const triggerNotification = useCallback((title: string, body: string, type: NotificationMessage['type'] = 'info') => {
    const newNotif: NotificationMessage = {
      id: Math.random().toString(36).substring(7),
      title,
      body,
      timestamp: new Date(),
      type
    };
    setNotifications((prev) => [...prev, newNotif]);
    playNotificationSound();
    sendNativePushNotification(title, body);
  }, []);

  // Dismiss a notification
  const handleDismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Sign in handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        triggerNotification(
          '¡Sesión Iniciada!',
          `Bienvenido a El Copihue de Oro, ${result.user.displayName || 'Admin'}.`,
          'success'
        );
        // Request desktop notifications
        await requestNativeNotificationPermission();
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setAuthErrorMessage(
        'Google Auth no se pudo abrir (es posible que las llaves de Firebase sean marcadores de posición o que el navegador haya bloqueado la ventana emergente). Puedes ingresar usando el Acceso Directo de Administrador.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Direct Admin Login (bypass popup block)
  const handleDirectAdminLogin = () => {
    const mockAdminUser = {
      uid: 'admin-local-session',
      displayName: 'Administrador Restaurante',
      email: 'admin@elcopihuedeoro.cl',
    } as any;
    setUser(mockAdminUser);
    setNeedsAuth(false);
    setAuthErrorMessage(null);
    triggerNotification(
      '¡Acceso Administrador Activo!',
      'Bienvenido al Panel de Control del Restaurante.',
      'success'
    );
  };

  // Logout handler
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(false);
    // Refresh to get dishes and orders as a public guest
    await refreshAllSheetsData('', sheet1Name, sheet2Name);
  };

  // Initialize Auth state on load
  useEffect(() => {
    const unsubscribe = initAuth(
      async (firebaseUser, cachedToken) => {
        setUser(firebaseUser);
        setToken(cachedToken);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch full data from Sheets
  const refreshAllSheetsData = useCallback(async (accessToken: string, s1: string, s2: string) => {
    const activeToken = accessToken || '';
    const activeS1 = s1 || 'Ordenes';
    const activeS2 = s2 || 'Multimedia';
    try {
      // 1. Fetch menu dishes
      const fetchedDishes = await fetchDishesFromSheet(activeToken, activeS2);
      setDishes(fetchedDishes);

      // 2. Fetch recent orders
      const fetchedOrders = await fetchOrdersFromSheet(activeToken, activeS1);
      setOrders(fetchedOrders);

      // 3. Sync active order status
      if (activeOrder) {
        const matchingLiveOrder = fetchedOrders.find(o => o.id === activeOrder.id);
        if (matchingLiveOrder) {
          const prevStatus = previousStatusRef.current[activeOrder.id] || 'Recibido';
          const newStatus = matchingLiveOrder.status;

          if (newStatus !== prevStatus) {
            previousStatusRef.current[activeOrder.id] = newStatus;
            
            // Format status message beautifully
            let statusText = '';
            if (newStatus === 'Pedido en preparación' || newStatus === 'En Cocina') {
              statusText = '👨‍🍳 Tu pedido se encuentra en preparación en nuestra cocina.';
            } else if (newStatus === 'Pedido listo para retiro') {
              statusText = '🛍️ ¡Tu pedido está listo para retiro en nuestro local!';
            } else if (newStatus === 'Pedido en reparto' || newStatus === 'En Camino') {
              statusText = '🛵 ¡Tu pedido va en reparto hacia tu dirección!';
            } else if (newStatus === 'Entregado') {
              statusText = '🎉 ¡Entregado! Esperamos que disfrutes del sabor tradicional de El Copihue de Oro.';
            } else if (newStatus === 'Cancelado') {
              statusText = '❌ Lo sentimos, tu pedido ha sido cancelado por el restaurante.';
            } else {
              statusText = `Tu pedido ha cambiado de estado a: ${newStatus}`;
            }

            triggerNotification(
              `Estado de Pedido: ¡${newStatus}!`,
              statusText,
              'status'
            );
            setActiveOrder(matchingLiveOrder);
          }
        }
      }

      // If we are loading for the very first time, seed the ref with current order statuses
      if (initialLoadRef.current) {
        fetchedOrders.forEach(o => {
          previousStatusRef.current[o.id] = o.status;
        });
        initialLoadRef.current = false;
      }
    } catch (err) {
      console.error('Error fetching sheets data:', err);
    }
  }, [activeOrder, triggerNotification]);

  // Load and configure sheets once authenticated (or on mount for public view)
  useEffect(() => {
    const setupAndLoad = async () => {
      setIsLoadingSheets(true);
      try {
        const activeToken = token || '';
        const { sheet1Name: s1, sheet2Name: s2 } = await initializeSpreadsheet(activeToken);
        setSheet1Name(s1);
        setSheet2Name(s2);
        await refreshAllSheetsData(activeToken, s1, s2);
      } catch (err) {
        console.error('Spreadsheet initialization failed:', err);
        // Fallback to loading whatever the backend has cached
        await refreshAllSheetsData('', 'Ordenes', 'Multimedia');
      } finally {
        setIsLoadingSheets(false);
      }
    };

    setupAndLoad();
  }, [token, refreshAllSheetsData]);

  // Real-time polling loop (checks local backend/Sheets every 12 seconds for updates)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAllSheetsData(token || '', sheet1Name || 'Ordenes', sheet2Name || 'Multimedia');
    }, 12000);

    return () => clearInterval(interval);
  }, [token, sheet1Name, sheet2Name, refreshAllSheetsData]);

  // Cart actions
  const handleAddToCart = (dish: Dish) => {
    if (!isKitchenOpenState) {
      triggerNotification(
        'Cocina Cerrada',
        'Lo sentimos, la cocina está cerrada en este momento (Horario: 11:00 a 20:00 Chile).',
        'warning'
      );
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.dish.id === dish.id);
      if (existing) {
        return prev.map((item) =>
          item.dish.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { dish, quantity: 1 }];
    });
    triggerNotification('Plato Añadido', `Se agregó "${dish.name}" a tu orden.`);
  };

  const handleUpdateQuantity = (dishId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.dish.id === dishId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (dishId: string) => {
    setCart((prev) => prev.filter((item) => item.dish.id !== dishId));
  };

  // Submit/Checkout order
  const handleSubmitOrder = async (formData: {
    name: string;
    email: string;
    phone: string;
    address: string;
  }) => {
    if (!isKitchenOpenState) {
      throw new Error('La cocina está cerrada en este momento (Horario: 11:00 a 20:00 Chile).');
    }
    const activeToken = token || '';
    const activeSheetName = sheet1Name || 'Ordenes';

    setIsPlacingOrder(true);
    try {
      // 1. Format order details
      const orderId = 'PED' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const itemsSummary = cart.map(item => `${item.quantity}x ${item.dish.name}`).join(', ');
      const subtotal = cart.reduce((acc, item) => acc + item.dish.price * item.quantity, 0);

      const parseDistanceKm = (distStr: string): number => {
        if (!distStr) return 0;
        const cleanStr = distStr.replace(/[^\d.,]/g, '').replace(',', '.');
        return parseFloat(cleanStr) || 0;
      };

      const parsedDistance = parseDistanceKm(routeDistance);
      const getDeliveryFee = (): number => {
        if (subtotal === 0) return 0;
        if (!routeDistance || parsedDistance <= 1) {
          return 1000;
        }
        const extraDistance = parsedDistance - 1;
        const extraFee = Math.ceil(extraDistance) * 500;
        return 1000 + extraFee;
      };

      const deliveryFee = getDeliveryFee();
      const totalAmount = subtotal + deliveryFee;

      const newOrder: Order = {
        id: orderId,
        timestamp: new Date().toLocaleDateString('es-CL') + ' ' + new Date().toLocaleTimeString('es-CL'),
        customerName: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        items: itemsSummary,
        total: totalAmount,
        status: 'Pedido en preparación',
        routeDistance,
        routeDuration
      };

      // 2. Append to backend (will write to Google Sheets if admin token is cached)
      await createOrderInSheet(activeToken, activeSheetName, newOrder);

      // 3. Update state
      setActiveOrder(newOrder);
      previousStatusRef.current[orderId] = 'Recibido';
      setCart([]); // Clear cart
      setActiveAddress(formData.address);

      triggerNotification(
        '¡Pedido Recibido!',
        'Tu orden fue enviada y registrada con éxito. Sigue su estado en tiempo real.',
        'success'
      );

      // Force refreshing data in background
      refreshAllSheetsData(activeToken, activeSheetName, sheet2Name || 'Multimedia').catch((e) => {
        console.warn('Background refresh after order completed:', e);
      });
    } catch (err: any) {
      console.error('Error placing order:', err);
      throw new Error(err?.message || 'No se pudo registrar tu orden.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Filter menu categories
  const categories = ['Todos', ...Array.from(new Set(dishes.map((d) => d.category)))];
  const filteredDishes = dishes.filter(
    (d) => activeCategory === 'Todos' || d.category === activeCategory
  );

  // Trigger route preview when address changes
  const handleAddressBlur = (addressInput: string) => {
    setDeliveryAddress(addressInput);
  };

  // Render Login page if needs authentication
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-100 rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto text-teal-600 shadow-inner">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
              🇨🇱 Sabores Criollos
            </span>
            <h1 className="text-2xl font-black text-slate-800 mt-2">El Copihue de Oro</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
              Bienvenido al sistema inteligente de pedidos chilenos sincronizado directamente con tu Google Sheets.
            </p>
          </div>

          <div className="border-t border-slate-50 pt-6">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button w-full flex items-center justify-center cursor-pointer shadow-sm hover:shadow-md border border-slate-200"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper flex items-center gap-2">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents font-bold text-slate-700 text-sm">
                  {isLoggingIn ? 'Iniciando sesión...' : 'Ingresar con Google Sheets'}
                </span>
              </div>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            * Se requiere acceso para leer y actualizar la multimedia y guardar tus pedidos en el link indicado.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-red-100 selection:text-red-800">
      {/* Toast Push Notifications Area */}
      <NotificationManager notifications={notifications} onDismiss={handleDismissNotification} />

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 sm:px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-red-100">
            C
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-1.5">
              El Copihue de Oro
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
            </h1>
            {isKitchenOpenState ? (
              <p className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Cocina Activa • Pedidos en Línea
              </p>
            ) : (
              <p className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                Cocina Cerrada
              </p>
            )}
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-3">
          {isLoadingSheets && (
            <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-xs font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
              <span>Actualizando menú...</span>
            </div>
          )}

          <a
            href="https://wa.me/56912345678?text=Hola%20El%20Copihue%20de%20Oro,%20tengo%20una%20consulta"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp Directo</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full">
        {/* CUSTOMER WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Category navigation and menu list */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Category tabs */}
              <div className="flex justify-between items-end pb-2">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Nuestra Carta</h2>
                <span className="text-[10px] bg-slate-200 px-2.5 py-1 rounded-md uppercase font-bold text-slate-500 tracking-wider">
                  Tradición Chilena
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-red-600 text-white shadow-sm shadow-red-100'
                        : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Menu grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {filteredDishes.length === 0 ? (
                  <div className="col-span-2 text-center py-24 text-slate-400">
                    <Clock className="w-12 h-12 mx-auto stroke-1 text-slate-300 animate-spin text-red-600" />
                    <p className="mt-2 text-sm font-semibold">Cargando exquisito menú chileno...</p>
                  </div>
                ) : (
                  filteredDishes.map((dish) => (
                    <DishCard key={dish.id} dish={dish} onAddToCart={handleAddToCart} />
                  ))
                )}
              </div>

              {/* Special highlight box */}
              {(() => {
                const offerDish: Dish = dishes.find(
                  (d) => d.id === 'mote-con-huesillo' || d.name.toLowerCase().includes('mote')
                ) || {
                  id: 'mote-con-huesillo',
                  name: 'Mote con Huesillo XL',
                  category: 'Postres',
                  price: 3200,
                  description: 'Refrescante postre típico para acompañar tu orden tradicional.',
                  ingredients: ['Huesillos (duraznos deshidratados)', 'Mote de trigo', 'Chancaca o azúcar'],
                  image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
                  available: true
                };

                return (
                  <div className="p-5 bg-gradient-to-r from-red-600 to-red-700 rounded-3xl text-white shadow-lg shadow-red-100/55 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                          Oferta del Día
                        </span>
                        <span className="text-xs font-extrabold text-amber-300 bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-300/30">
                          {formatCLP(offerDish.price)}
                        </span>
                      </div>
                      <h4 className="text-base font-bold">{offerDish.name}</h4>
                      <p className="text-xs opacity-90 mt-0.5">{offerDish.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(offerDish)}
                      className="px-4 py-2.5 bg-white hover:bg-amber-50 active:scale-95 text-red-600 font-extrabold text-xs rounded-full shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-red-600 stroke-[3]" />
                      <span>Añadir ({formatCLP(offerDish.price)})</span>
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Right Column: Tracking / Checkout */}
            <div className="space-y-6">
              
              {/* Active tracking display if user has placed an order */}
              <AnimatePresence>
                {activeOrder && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-3xl border border-red-100 shadow-md p-6 relative overflow-hidden"
                  >
                    {/* Corner close */}
                    <button
                      onClick={() => setActiveOrder(null)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full transition-colors cursor-pointer"
                      title="Cerrar seguimiento"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1.5">
                      <Clock className="w-4.5 h-4.5 text-red-600" />
                      Seguimiento en Tiempo Real
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mb-4">
                      ID: <span className="font-bold text-slate-600">#{activeOrder.id}</span>
                    </p>

                    {/* Progress timeline */}
                    {(() => {
                      const steps = [
                        { key: 'Pedido en preparación', icon: '👨‍🍳', label: 'En preparación' },
                        { key: 'Pedido listo para retiro', icon: '🛍️', label: 'Listo para retiro' },
                        { key: 'Pedido en reparto', icon: '🛵', label: 'En reparto' },
                        { key: 'Entregado', icon: '🎉', label: 'Entregado' }
                      ];

                      const getStepIdx = (statusStr: string) => {
                        const s = (statusStr || '').toLowerCase();
                        if (s.includes('preparaci') || s.includes('preparacion') || s.includes('recibido') || s.includes('cocina')) return 0;
                        if (s.includes('listo') || s.includes('retiro')) return 1;
                        if (s.includes('reparto') || s.includes('camino')) return 2;
                        if (s.includes('entregado') || s.includes('entrega')) return 3;
                        return 0;
                      };

                      const currentIdx = getStepIdx(activeOrder.status);
                      const widthPercent = (currentIdx / 3) * 100;

                      return (
                        <div className="flex justify-between items-center gap-1 relative mb-6">
                          <div className="absolute left-1 right-1 top-[11px] h-0.5 bg-slate-100 -z-10" />
                          <div
                            className="absolute left-1 top-[11px] h-0.5 bg-red-500 -z-10 transition-all duration-1000"
                            style={{ width: `${widthPercent}%` }}
                          />

                          {steps.map((step, idx) => {
                            const isDone = currentIdx >= idx;
                            const isCurrent = currentIdx === idx;

                            return (
                              <div key={step.key} className="flex flex-col items-center text-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shadow-xs border transition-all ${
                                  isCurrent ? 'bg-red-600 border-red-600 text-white scale-110 ring-4 ring-red-50 animate-pulse' :
                                  isDone ? 'bg-red-500 border-red-500 text-white' :
                                  'bg-white border-slate-200 text-slate-400'
                                }`}>
                                  {step.icon}
                                </div>
                                <span className={`text-[8px] font-bold mt-1 tracking-tight uppercase max-w-[65px] leading-tight ${
                                  isCurrent ? 'text-red-600' : isDone ? 'text-slate-800' : 'text-slate-400'
                                }`}>
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <div className="p-4 bg-slate-50 rounded-2xl text-xs space-y-2">
                      <div className="flex justify-between text-slate-500">
                        <span>Lugar:</span>
                        <span className="font-bold text-slate-800">{activeOrder.address}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Menú solicitado:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[140px]" title={activeOrder.items}>
                          {activeOrder.items}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 border-t border-dashed mt-2 pt-2">
                        <span className="font-bold text-slate-700">Total pagado:</span>
                        <span className="font-extrabold text-red-600">{formatCLP(activeOrder.total)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Delivery Map display */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400 font-bold uppercase tracking-wider px-1">
                  <span className="flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-red-600 animate-spin-slow" />
                    Cobertura de Entrega
                  </span>
                  <span>Rancagua</span>
                </div>

                <MapContainer
                  customerAddress={activeAddress || deliveryAddress}
                  orderStatus={activeOrder ? activeOrder.status : ''}
                  onRouteCalculated={(dist, dur) => {
                    setRouteDistance(dist);
                    setRouteDuration(dur);
                  }}
                  height="300px"
                />
              </div>

              {/* Order Cart list */}
              <Cart
                cartItems={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onSubmitOrder={handleSubmitOrder}
                onAddressChange={(addr) => setDeliveryAddress(addr)}
                isSubmitting={isPlacingOrder}
                routeDistance={routeDistance}
                routeDuration={routeDuration}
                isKitchenOpen={isKitchenOpenState}
              />
            </div>
          </div>

          {/* Restaurant Contact & Information Card */}
          <section className="mt-12 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-lg">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full">
                  <Phone className="w-3.5 h-3.5" />
                  Contacto y Atencion al Cliente
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  ¿Tienes alguna duda con tu pedido?
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Estamos disponibles para atender tus consultas sobre el menú, ingredientes o entregas especiales.
                </p>
              </div>

              {/* Direct WhatsApp Action Button */}
              <div className="flex-shrink-0">
                <a
                  href="https://wa.me/56912345678?text=Hola%20El%20Copihue%20de%20Oro,%20quisiera%20consultar%20sobre%20mi%20pedido"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-emerald-100 hover:shadow-lg cursor-pointer w-full md:w-auto"
                >
                  <MessageCircle className="w-5 h-5 fill-white/20" />
                  <span>Enviar WhatsApp Directo</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100 text-xs">
              <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl">
                <div className="p-2 bg-white rounded-xl shadow-2xs text-red-600">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Teléfono</span>
                  <a href="tel:+56912345678" className="font-bold text-slate-800 hover:text-red-600 transition-colors">
                    +56 9 1234 5678
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl">
                <div className="p-2 bg-white rounded-xl shadow-2xs text-red-600">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correo Electrónico</span>
                  <a href="mailto:contacto@elcopihuedeoro.cl" className="font-bold text-slate-800 hover:text-red-600 transition-colors">
                    contacto@elcopihuedeoro.cl
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl">
                <div className="p-2 bg-white rounded-xl shadow-2xs text-red-600">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ubicación</span>
                  <span className="font-semibold text-slate-800">
                    Av. O'Higgins 450, Rancagua
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl">
                <div className="p-2 bg-white rounded-xl shadow-2xs text-red-600">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horario de Atención</span>
                  <span className="font-semibold text-slate-800">
                    Lun - Dom: 12:00 - 22:30 hrs
                  </span>
                </div>
              </div>
            </div>
          </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 text-center text-xs text-slate-500 font-medium space-y-2">
        <div className="flex items-center justify-center gap-4 text-slate-600 font-semibold mb-2">
          <a href="tel:+56912345678" className="hover:text-red-600 transition-colors flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" /> +56 9 1234 5678
          </a>
          <span>•</span>
          <a href="mailto:contacto@elcopihuedeoro.cl" className="hover:text-red-600 transition-colors flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> contacto@elcopihuedeoro.cl
          </a>
        </div>
        <div>El Copihue de Oro © 2026 • Comida Chilena Tradicional • Rancagua, Región de O'Higgins, Chile</div>
      </footer>
    </div>
  );
}

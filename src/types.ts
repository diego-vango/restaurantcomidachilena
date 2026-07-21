/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Dish {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  ingredients: string[];
  image: string;
  available: boolean;
}

export type OrderStatus =
  | 'Retiro en tienda'
  | 'Pedido en preparación'
  | 'Pedido listo para retiro'
  | 'Pedido en reparto'
  | 'Entregado'
  | 'Recibido'
  | 'En Cocina'
  | 'En Camino'
  | 'Cancelado';

export interface Order {
  id: string;
  timestamp: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  items: string; // JSON string or text summary of items
  total: number;
  status: OrderStatus;
  routeDistance?: string;
  routeDuration?: string;
}

export interface CartItem {
  dish: Dish;
  quantity: number;
}

export interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'status';
}

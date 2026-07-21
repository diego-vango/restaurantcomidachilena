/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dish, Order, OrderStatus } from '../types';

export const SPREADSHEET_ID = '1FRWWdb28nT8NHV0Wt1mfMiUGcMN2RValX5D2HBQX8mg';

import {
  DEFAULT_DISHES,
  initializeSpreadsheet as directInitializeSpreadsheet,
  fetchDishesFromSheet as directFetchDishesFromSheet,
  createOrderInSheet as directCreateOrderInSheet,
  fetchOrdersFromSheet as directFetchOrdersFromSheet,
  updateOrderStatusInSheet as directUpdateOrderStatusInSheet,
  updateDishInSheet as directUpdateDishInSheet,
  fetchSheetNames as directFetchSheetNames,
} from './sheets_api';

export { DEFAULT_DISHES };

// Helper to make API requests to the Express server
async function apiRequest(endpoint: string, method: string, body?: any) {
  const url = `/api${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error || (response.statusText ? `Error: ${response.statusText}` : `Error de servidor (${response.status})`);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function fetchSheetNames(accessToken: string): Promise<string[]> {
  try {
    const data = await apiRequest('/admin/sheet-names', 'POST', { accessToken });
    return data.sheetNames || [];
  } catch (error) {
    console.warn('Backend /admin/sheet-names unavailable, attempting direct Google Sheets call:', error);
    if (accessToken) {
      return directFetchSheetNames(accessToken).catch(() => []);
    }
    return [];
  }
}

export async function initializeSpreadsheet(accessToken: string): Promise<{ sheet1Name: string; sheet2Name: string }> {
  try {
    const data = await apiRequest('/admin/init', 'POST', { accessToken });
    return {
      sheet1Name: data.sheet1Name || 'Ordenes',
      sheet2Name: data.sheet2Name || 'Multimedia'
    };
  } catch (error) {
    console.warn('Backend /admin/init unavailable, attempting direct Google Sheets call:', error);
    if (accessToken) {
      try {
        return await directInitializeSpreadsheet(accessToken);
      } catch (directErr) {
        console.error('Direct Google Sheets init failed:', directErr);
      }
    }
    return {
      sheet1Name: 'Ordenes',
      sheet2Name: 'Multimedia'
    };
  }
}

export async function fetchDishesFromSheet(accessToken: string, sheet2Name: string): Promise<Dish[]> {
  // 1. Direct call to Google Sheets if token available
  if (accessToken) {
    try {
      const dishes = await directFetchDishesFromSheet(accessToken, sheet2Name);
      if (dishes && dishes.length > 0) return dishes;
    } catch (e) {
      console.warn('Direct fetchDishesFromSheet failed, trying server endpoint:', e);
    }
  }

  // 2. Server API fallback
  try {
    const data = await apiRequest('/dishes', 'GET');
    if (data && Array.isArray(data.dishes) && data.dishes.length > 0) {
      return data.dishes;
    }
  } catch (error) {
    console.warn('Server /dishes unavailable, returning local default menu:', error);
  }

  return DEFAULT_DISHES;
}

export async function createOrderInSheet(accessToken: string, sheet1Name: string, order: Order): Promise<void> {
  // 1. Always persist in browser localStorage so the order is never lost
  try {
    const existingStr = localStorage.getItem('local_orders');
    const existingOrders: Order[] = existingStr ? JSON.parse(existingStr) : [];
    existingOrders.push(order);
    localStorage.setItem('local_orders', JSON.stringify(existingOrders));
  } catch (e) {
    console.warn('Could not save order to localStorage:', e);
  }

  // 2. Attempt push via backend server endpoint
  let backendSuccess = false;
  try {
    await apiRequest('/orders', 'POST', { order, accessToken, sheet1Name });
    backendSuccess = true;
  } catch (error: any) {
    console.warn('Backend /orders POST failed (static host/405), attempting direct Google Sheets write:', error);
  }

  // 3. Fallback to direct client Google Sheets REST API call if backend didn't handle it
  if (!backendSuccess && accessToken) {
    try {
      await directCreateOrderInSheet(accessToken, sheet1Name, order);
      backendSuccess = true;
    } catch (directErr) {
      console.error('Direct Google Sheets append failed:', directErr);
    }
  }

  // If order is stored locally, we successfully complete the checkout flow!
}

export async function fetchOrdersFromSheet(accessToken: string, sheet1Name: string): Promise<Order[]> {
  let orders: Order[] = [];

  // 1. Direct call to Google Sheets if token available
  if (accessToken) {
    try {
      const directOrders = await directFetchOrdersFromSheet(accessToken, sheet1Name);
      if (directOrders && directOrders.length > 0) {
        orders = directOrders;
      }
    } catch (e) {
      console.warn('Direct fetchOrdersFromSheet failed, trying server endpoint:', e);
    }
  }

  // 2. Server endpoint fallback if needed
  if (orders.length === 0) {
    try {
      const data = await apiRequest('/orders', 'GET');
      if (data && Array.isArray(data.orders)) {
        orders = data.orders;
      }
    } catch (error) {
      console.warn('Server /orders GET failed:', error);
    }
  }

  // 3. Merge with local storage orders
  try {
    const localStr = localStorage.getItem('local_orders');
    if (localStr) {
      const localOrders: Order[] = JSON.parse(localStr);
      const existingIds = new Set(orders.map(o => o.id));
      for (const lo of localOrders) {
        if (!existingIds.has(lo.id)) {
          orders.unshift(lo);
        }
      }
    }
  } catch (e) {
    console.warn('Error merging local_orders:', e);
  }

  return orders;
}

export async function updateOrderStatusInSheet(
  accessToken: string,
  sheet1Name: string,
  orderId: string,
  newStatus: OrderStatus
): Promise<void> {
  let updated = false;
  try {
    await apiRequest('/orders/status', 'POST', { accessToken, orderId, newStatus });
    updated = true;
  } catch (error) {
    console.warn('Backend status update failed, attempting direct Sheets call:', error);
  }

  if (!updated && accessToken) {
    await directUpdateOrderStatusInSheet(accessToken, sheet1Name, orderId, newStatus);
  }
}

export async function updateDishInSheet(
  accessToken: string,
  sheet2Name: string,
  dishId: string,
  updatedFields: Partial<Dish>
): Promise<void> {
  let updated = false;
  try {
    await apiRequest('/dishes/update', 'POST', { accessToken, dishId, updatedFields });
    updated = true;
  } catch (error) {
    console.warn('Backend dish update failed, attempting direct Sheets call:', error);
  }

  if (!updated && accessToken) {
    await directUpdateDishInSheet(accessToken, sheet2Name, dishId, updatedFields);
  }
}

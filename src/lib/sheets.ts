/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dish, Order, OrderStatus } from '../types';

export const SPREADSHEET_ID = '1FRWWdb28nT8NHV0Wt1mfMiUGcMN2RValX5D2HBQX8mg';

import { DEFAULT_DISHES } from './sheets_api';

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
    // Talk to our backend which handles the token caching
    const data = await apiRequest('/admin/sheet-names', 'POST', { accessToken });
    return data.sheetNames || [];
  } catch (error) {
    console.error('Error fetching sheet names from backend:', error);
    return [];
  }
}

export async function initializeSpreadsheet(accessToken: string): Promise<{ sheet1Name: string; sheet2Name: string }> {
  try {
    // Sends token to backend to cache and initialize the spreadsheet
    const data = await apiRequest('/admin/init', 'POST', { accessToken });
    return {
      sheet1Name: data.sheet1Name || 'Ordenes',
      sheet2Name: data.sheet2Name || 'Multimedia'
    };
  } catch (error) {
    console.error('Error initializing spreadsheet from backend:', error);
    return {
      sheet1Name: 'Ordenes',
      sheet2Name: 'Multimedia'
    };
  }
}

export async function fetchDishesFromSheet(accessToken: string, sheet2Name: string): Promise<Dish[]> {
  try {
    // Call public API to get dishes (the backend will use the cached admin token if available)
    const data = await apiRequest('/dishes', 'GET');
    if (data && Array.isArray(data.dishes) && data.dishes.length > 0) {
      return data.dishes;
    }
    return DEFAULT_DISHES;
  } catch (error) {
    console.error('Error in client fetchDishesFromSheet, returning local default menu:', error);
    return DEFAULT_DISHES;
  }
}

export async function createOrderInSheet(accessToken: string, sheet1Name: string, order: Order): Promise<void> {
  try {
    // Call public API to submit order
    await apiRequest('/orders', 'POST', { order, accessToken, sheet1Name });
  } catch (error: any) {
    console.error('Failed to submit order to backend:', error);
    throw new Error(error?.message || 'No se pudo registrar tu orden.');
  }
}

export async function fetchOrdersFromSheet(accessToken: string, sheet1Name: string): Promise<Order[]> {
  try {
    // Get recent orders from the server
    const data = await apiRequest('/orders', 'GET');
    return data.orders || [];
  } catch (error) {
    console.error('Error fetching orders from server:', error);
    return [];
  }
}

export async function updateOrderStatusInSheet(
  accessToken: string,
  sheet1Name: string,
  orderId: string,
  newStatus: OrderStatus
): Promise<void> {
  // Call administrative endpoint to update status
  await apiRequest('/orders/status', 'POST', { accessToken, orderId, newStatus });
}

export async function updateDishInSheet(
  accessToken: string,
  sheet2Name: string,
  dishId: string,
  updatedFields: Partial<Dish>
): Promise<void> {
  // Call administrative endpoint to update dish
  await apiRequest('/dishes/update', 'POST', { accessToken, dishId, updatedFields });
}

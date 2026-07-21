/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dish, Order, OrderStatus } from '../types';

export const SPREADSHEET_ID = '1FRWWdb28nT8NHV0Wt1mfMiUGcMN2RValX5D2HBQX8mg';

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
    throw new Error(errorData.error || `Error: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchSheetNames(accessToken: string): Promise<string[]> {
  // Talk to our backend which handles the token caching
  const data = await apiRequest('/admin/sheet-names', 'POST', { accessToken });
  return data.sheetNames || [];
}

export async function initializeSpreadsheet(accessToken: string): Promise<{ sheet1Name: string; sheet2Name: string }> {
  // Sends token to backend to cache and initialize the spreadsheet
  const data = await apiRequest('/admin/init', 'POST', { accessToken });
  return {
    sheet1Name: data.sheet1Name || 'Hoja 1',
    sheet2Name: data.sheet2Name || 'Hoja2'
  };
}

export async function fetchDishesFromSheet(accessToken: string, sheet2Name: string): Promise<Dish[]> {
  // Call public API to get dishes (the backend will use the cached admin token if available)
  const data = await apiRequest('/dishes', 'GET');
  return data.dishes || [];
}

export async function createOrderInSheet(accessToken: string, sheet1Name: string, order: Order): Promise<void> {
  // Call public API to submit order
  await apiRequest('/orders', 'POST', { order });
}

export async function fetchOrdersFromSheet(accessToken: string, sheet1Name: string): Promise<Order[]> {
  // Get recent orders from the server
  const data = await apiRequest('/orders', 'GET');
  return data.orders || [];
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

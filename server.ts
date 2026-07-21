/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

// Import our raw sheets API functions and types
import * as sheetsApi from './src/lib/sheets_api.js';
import { Order, Dish, OrderStatus } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent storage files in workspace
const TOKENS_FILE = path.join(__dirname, 'data-tokens.json');
const ORDERS_FILE = path.join(__dirname, 'data-orders.json');
const DISHES_FILE = path.join(__dirname, 'data-dishes.json');

// Safely read JSON file
function readJsonFile<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T;
    }
  } catch (e) {
    console.error(`Error reading file ${filePath}:`, e);
  }
  return defaultVal;
}

// Safely write JSON file
function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error writing file ${filePath}:`, e);
  }
}

// Cache admin token in memory/file on startup
let cachedAdminToken: string | null = readJsonFile<string | null>(TOKENS_FILE, null);

// Initialize data files if empty
if (!fs.existsSync(ORDERS_FILE)) {
  writeJsonFile<Order[]>(ORDERS_FILE, []);
}
if (!fs.existsSync(DISHES_FILE)) {
  writeJsonFile<Dish[]>(DISHES_FILE, sheetsApi.DEFAULT_DISHES);
}

// Helper to push offline local orders to Google Sheets
async function syncOfflineOrders(token: string, sheet1Name: string) {
  try {
    const localOrders = readJsonFile<Order[]>(ORDERS_FILE, []);
    if (localOrders.length === 0) return;

    // Fetch existing order IDs from Sheet to prevent duplicates
    const sheetOrders = await sheetsApi.fetchOrdersFromSheet(token, sheet1Name).catch(() => [] as Order[]);
    const sheetOrderIds = new Set(sheetOrders.map(o => o.id));

    console.log(`Syncing offline orders... Total local: ${localOrders.length}, already in sheets: ${sheetOrderIds.size}`);

    for (const order of localOrders) {
      if (!sheetOrderIds.has(order.id)) {
        console.log(`Pushing unsynced order ${order.id} to Google Sheets...`);
        await sheetsApi.createOrderInSheet(token, sheet1Name, order).catch(err => {
          console.error(`Failed to push order ${order.id} during sync:`, err);
        });
      }
    }
  } catch (error) {
    console.error('Error syncing offline orders:', error);
  }
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Initial admin registration / token caching
app.post('/api/admin/init', async (req, res) => {
  const { accessToken } = req.body;

  if (accessToken) {
    cachedAdminToken = accessToken;
    writeJsonFile<string>(TOKENS_FILE, accessToken);
  }

  const tokenToUse = cachedAdminToken || accessToken;

  if (!tokenToUse) {
    // If no token is available at all, return default sheet names
    return res.json({
      sheet1Name: 'Ordenes',
      sheet2Name: 'Multimedia',
      message: 'Running in standalone local-caching mode'
    });
  }

  try {
    const { sheet1Name, sheet2Name } = await sheetsApi.initializeSpreadsheet(tokenToUse);
    
    // Fetch and save fresh dishes from sheets to keep cache updated
    try {
      const dishes = await sheetsApi.fetchDishesFromSheet(tokenToUse, sheet2Name);
      writeJsonFile<Dish[]>(DISHES_FILE, dishes);
    } catch (e) {
      console.warn('Failed to fetch/cache dishes during init, using cached version:', e);
    }

    // Try to sync any local/offline orders that were placed while worker was logged out
    await syncOfflineOrders(tokenToUse, sheet1Name);

    res.json({ sheet1Name, sheet2Name, message: 'Google Sheets synced and initialized successfully' });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403 || String(err?.message).includes('invalid authentication credentials')) {
      cachedAdminToken = null;
      try { fs.unlinkSync(TOKENS_FILE); } catch (_) {}
      console.warn('Cached Google Sheets OAuth token expired or invalid. Cleared cached token.');
    } else {
      console.warn('Warning during spreadsheet init:', err?.message || err);
    }
    res.json({
      sheet1Name: 'Ordenes',
      sheet2Name: 'Multimedia',
      error: err?.message || 'Failed to sync with Google Sheets, running in fallback mode'
    });
  }
});

// 2. Fetch dishes (Public - always fetches live from Google Sheets)
app.get('/api/dishes', async (req, res) => {
  let dishes = readJsonFile<Dish[]>(DISHES_FILE, sheetsApi.DEFAULT_DISHES);

  try {
    const tokenToUse = cachedAdminToken || '';
    const freshDishes = await sheetsApi.fetchDishesFromSheet(tokenToUse, 'Multimedia');
    if (freshDishes && freshDishes.length > 0) {
      dishes = freshDishes;
      writeJsonFile<Dish[]>(DISHES_FILE, dishes);
    }
  } catch (e) {
    console.warn('Google Sheets unreachable for dishes fetch, serving cached dishes:', e);
  }

  res.json({ dishes });
});

// 3. Create/Submit order (Public)
app.post('/api/orders', async (req, res) => {
  try {
    const { order, accessToken, sheet1Name } = req.body || {};
    if (!order || !order.id) {
      return res.status(400).json({ error: 'Pedido inválido o incompleto.' });
    }

    // 1. Save locally in-memory/file first (failsafe)
    const localOrders = readJsonFile<Order[]>(ORDERS_FILE, []);
    localOrders.push(order);
    writeJsonFile<Order[]>(ORDERS_FILE, localOrders);

    // 2. Try to append to Google Sheets immediately via Apps Script or token
    let synced = false;
    const tokenToUse = accessToken || cachedAdminToken || '';
    const sheetToUse = sheet1Name || 'Ordenes';

    try {
      await sheetsApi.createOrderInSheet(tokenToUse, sheetToUse, order);
      synced = true;
      console.log(`Order ${order.id} pushed successfully to Google Sheets.`);
    } catch (e: any) {
      console.error(`Failed to push order ${order.id} to Sheets immediately (will sync later):`, e?.message || e);
    }

    return res.json({ success: true, order, synced });
  } catch (err: any) {
    console.error('Error in /api/orders endpoint:', err);
    return res.status(500).json({ error: err?.message || 'Error interno al procesar el pedido.' });
  }
});

// 4. Fetch orders (Public / Admin)
app.get('/api/orders', async (req, res) => {
  const localOrders = readJsonFile<Order[]>(ORDERS_FILE, []);

  if (!cachedAdminToken) {
    return res.json({ orders: localOrders });
  }

  try {
    const sheetOrders = await sheetsApi.fetchOrdersFromSheet(cachedAdminToken, 'Ordenes');
    
    // Merge orders: Sheet is the source of truth for statuses updated by Admin.
    // Local orders that haven't been synced or have some delay are also included.
    const mergedMap = new Map<string, Order>();

    // Add local ones first
    localOrders.forEach(o => mergedMap.set(o.id, o));

    // Overwrite/Add sheet ones (since Sheet has the updated statuses)
    sheetOrders.forEach(o => {
      mergedMap.set(o.id, o);
    });

    const mergedOrders = Array.from(mergedMap.values());
    
    // Keep local file updated with any status updates from Google Sheets
    writeJsonFile<Order[]>(ORDERS_FILE, mergedOrders);

    res.json({ orders: mergedOrders });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403 || String(err?.message).includes('invalid authentication credentials')) {
      cachedAdminToken = null;
      try { fs.unlinkSync(TOKENS_FILE); } catch (_) {}
    }
    console.warn('Failed to fetch orders from Google Sheets, returning local cache:', err?.message || err);
    res.json({ orders: localOrders });
  }
});

// 5. Update order status (Admin)
app.post('/api/orders/status', async (req, res) => {
  const { accessToken, orderId, newStatus } = req.body;
  const tokenToUse = accessToken || cachedAdminToken;

  // 1. Update local DB
  const localOrders = readJsonFile<Order[]>(ORDERS_FILE, []);
  const index = localOrders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    localOrders[index].status = newStatus;
    writeJsonFile<Order[]>(ORDERS_FILE, localOrders);
  }

  // 2. Push update to Google Sheets
  if (tokenToUse) {
    try {
      await sheetsApi.updateOrderStatusInSheet(tokenToUse, 'Ordenes', orderId, newStatus);
      return res.json({ success: true });
    } catch (err: any) {
      console.error(`Failed to update order status ${orderId} in Sheets:`, err);
      return res.status(500).json({ error: err.message || 'Error updating Sheets' });
    }
  }

  res.json({ success: true, message: 'Updated locally only (no active Sheets token)' });
});

// 6. Update dish (Admin)
app.post('/api/dishes/update', async (req, res) => {
  const { accessToken, dishId, updatedFields } = req.body;
  const tokenToUse = accessToken || cachedAdminToken;

  // 1. Update local DB
  const localDishes = readJsonFile<Dish[]>(DISHES_FILE, sheetsApi.DEFAULT_DISHES);
  const index = localDishes.findIndex(d => d.id === dishId);
  if (index !== -1) {
    localDishes[index] = { ...localDishes[index], ...updatedFields };
    writeJsonFile<Dish[]>(DISHES_FILE, localDishes);
  }

  // 2. Push update to Google Sheets
  if (tokenToUse) {
    try {
      await sheetsApi.updateDishInSheet(tokenToUse, 'Multimedia', dishId, updatedFields);
      return res.json({ success: true });
    } catch (err: any) {
      console.error(`Failed to update dish ${dishId} in Sheets:`, err);
      return res.status(500).json({ error: err.message || 'Error updating Sheets' });
    }
  }

  res.json({ success: true, message: 'Updated locally only (no active Sheets token)' });
});

// 7. Get sheet names (Admin)
app.post('/api/admin/sheet-names', async (req, res) => {
  const { accessToken } = req.body;
  const tokenToUse = accessToken || cachedAdminToken;

  if (!tokenToUse) {
    return res.status(401).json({ error: 'No authentication token available' });
  }

  try {
    const sheetNames = await sheetsApi.fetchSheetNames(tokenToUse);
    res.json({ sheetNames });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch sheet names' });
  }
});

// ==========================================
// VITE OR STATIC FILES SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

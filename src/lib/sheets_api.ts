/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dish, Order, OrderStatus } from '../types';

export const SPREADSHEET_ID = '1FRWWdb28nT8NHV0Wt1mfMiUGcMN2RValX5D2HBQX8mg';

export const DEFAULT_DISHES: Dish[] = [
  {
    id: 'pastel-de-choclo',
    name: 'Pastel de Choclo',
    category: 'Platos Principales',
    price: 9500,
    description: 'Tradicional pastel chileno con pino de carne picada jugosa, pollo tierno, huevo duro, aceitunas y pasas, cubierto con una capa de pastelera de choclo tierno y azúcar dorada al horno de greda.',
    ingredients: ['Choclo', 'Carne de vacuno', 'Pollo', 'Cebolla', 'Huevo duro', 'Aceitunas', 'Pasas', 'Condimentos chilenos'],
    image: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&auto=format&fit=crop&q=80',
    available: true
  },
  {
    id: 'empanada-de-pino',
    name: 'Empanada de Pino',
    category: 'Entradas',
    price: 2800,
    description: 'La clásica empanada chilena al horno, rellena con un sabroso y jugoso pino de carne de vacuno picada, cebollas caramelizadas, una aceituna entera, pasas y un trozo de huevo duro.',
    ingredients: ['Carne de vacuno picada', 'Cebolla', 'Huevo duro', 'Aceituna', 'Pasas', 'Harina de trigo', 'Manteca'],
    image: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=600&auto=format&fit=crop&q=80',
    available: true
  },
  {
    id: 'cazuela-de-vacuno',
    name: 'Cazuela de Vacuno',
    category: 'Platos Principales',
    price: 8900,
    description: 'Un caldo reponedor y casero que contiene un tierno trozo de tapapecho de vacuno, una papa entera dorada, un trozo de choclo dulce, zapallo camote, arroz y un toque aromático de cilantro y orégano fresco.',
    ingredients: ['Tapa de pecho de vacuno', 'Papa', 'Choclo dulce', 'Zapallo camote', 'Arroz', 'Zanahoria', 'Porotos verdes', 'Cilantro'],
    image: 'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=600&auto=format&fit=crop&q=80',
    available: true
  },
  {
    id: 'mote-con-huesillo',
    name: 'Mote con Huesillo',
    category: 'Postres',
    price: 3200,
    description: 'La bebida y postre nacional chileno. Huesillos (duraznos deshidratados) cocidos en un almíbar dulce aromatizado con canela y cáscara de naranja, servidos helados sobre una generosa porción de mote de trigo cocido.',
    ingredients: ['Huesillos (duraznos deshidratados)', 'Mote de trigo', 'Chancaca o azúcar', 'Rama de canela', 'Cáscara de naranja'],
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    available: true
  },
  {
    id: 'humitas-chilenas',
    name: 'Humitas Chilenas',
    category: 'Platos Principales',
    price: 6500,
    description: 'Dos humitas de choclo tierno molido mezclado con albahaca fresca picada, cebolla frita y condimentos, envueltas en las propias hojas del choclo y cocidas al vapor. Se sirven solas, con azúcar o ensalada chilena.',
    ingredients: ['Choclo pastelero', 'Albahaca fresca', 'Cebolla', 'Manteca o aceite', 'Leche', 'Sal', 'Ají de color'],
    image: 'https://images.unsplash.com/photo-1568106690101-fd6822e876f6?w=600&auto=format&fit=crop&q=80',
    available: true
  },
  {
    id: 'pisco-sour-chileno',
    name: 'Pisco Sour Chileno',
    category: 'Bebidas',
    price: 4500,
    description: 'Cóctel emblemático y refrescante elaborado con pisco chileno de doble destilación, jugo natural exprimido de limón sutil, jarabe de goma y claras de huevo batidas para lograr una espuma suave y persistente.',
    ingredients: ['Pisco Chileno', 'Limón sutil', 'Jarabe de goma o azúcar flor', 'Clara de huevo', 'Hielo'],
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&auto=format&fit=crop&q=80',
    available: true
  }
];

// Helper to make Google Sheets API Requests
async function sheetsApiRequest(endpoint: string, method: string, accessToken: string, body?: any) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${endpoint}`;
  const headers: HeadersInit = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error calling Sheets API: ${response.statusText}`);
  }

  return response.json();
}

// Fetch spreadsheet metadata to get sheet titles
export async function fetchSheetNames(accessToken: string): Promise<string[]> {
  try {
    const data = await sheetsApiRequest('', 'GET', accessToken);
    return data.sheets?.map((s: any) => s.properties?.title) || [];
  } catch (error) {
    console.error('Error fetching sheet metadata:', error);
    throw error;
  }
}

// Ensure both Ordenes and Multimedia exist, performing dynamic renames if old names are found
export async function initializeSpreadsheet(accessToken: string): Promise<{ sheet1Name: string; sheet2Name: string }> {
  try {
    const data = await sheetsApiRequest('', 'GET', accessToken);
    const sheetsList = data.sheets || [];

    // Find any sheet matching "Ordenes" or "Hoja 1" or similar
    const sheet1 = sheetsList.find((s: any) => {
      const title = (s.properties?.title || '').toLowerCase();
      return title === 'ordenes' || title === 'órdenes' || title === 'hoja 1' || title === 'hoja1' || title === 'sheet1';
    });

    // Find any sheet matching "Multimedia" or "Hoja 2" or "Hoja2" or similar
    const sheet2 = sheetsList.find((s: any) => {
      const title = (s.properties?.title || '').toLowerCase();
      return title === 'multimedia' || title === 'hoja 2' || title === 'hoja2' || title === 'sheet2';
    });

    const requests: any[] = [];
    let sheet1Name = 'Ordenes';
    let sheet2Name = 'Multimedia';

    // 1. Process Sheet 1 (Ordenes)
    if (sheet1) {
      const currentTitle = sheet1.properties?.title || '';
      const sheetId = sheet1.properties?.sheetId;
      if (currentTitle !== 'Ordenes' && currentTitle !== 'Órdenes') {
        // Dynamic rename
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              title: 'Ordenes'
            },
            fields: 'title'
          }
        });
      } else {
        sheet1Name = currentTitle;
      }
    } else {
      // If we have some sheets but none matched, rename the first one to "Ordenes" as it's likely the default
      if (sheetsList.length > 1) {
        const firstSheet = sheetsList[0];
        const sheetId = firstSheet.properties?.sheetId;
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              title: 'Ordenes'
            },
            fields: 'title'
          }
        });
      } else {
        requests.push({
          addSheet: {
            properties: { title: 'Ordenes' }
          }
        });
      }
    }

    // 2. Process Sheet 2 (Multimedia)
    if (sheet2) {
      const currentTitle = sheet2.properties?.title || '';
      const sheetId = sheet2.properties?.sheetId;
      if (currentTitle !== 'Multimedia') {
        // Dynamic rename
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              title: 'Multimedia'
            },
            fields: 'title'
          }
        });
      } else {
        sheet2Name = currentTitle;
      }
    } else {
      requests.push({
        addSheet: {
          properties: { title: 'Multimedia' }
        }
      });
    }

    if (requests.length > 0) {
      await sheetsApiRequest(':batchUpdate', 'POST', accessToken, { requests });
    }

    // Setup initial headers for both sheets if they are blank
    await ensureSheetHeaders(accessToken, sheet1Name, sheet2Name);

    return { sheet1Name, sheet2Name };
  } catch (error) {
    console.error('Error initializing spreadsheet:', error);
    throw error;
  }
}

async function ensureSheetHeaders(accessToken: string, sheet1Name: string, sheet2Name: string) {
  try {
    // 1. Check/Write sheet 1 (Pedidos) headers
    const sheet1Data = await sheetsApiRequest(`/values/${encodeURIComponent(sheet1Name)}!A1:K1`, 'GET', accessToken);
    if (!sheet1Data.values || sheet1Data.values.length === 0) {
      const headers = [
        ['ID Pedido', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Dirección', 'Pedido (Detalle)', 'Total ($)', 'Estado', 'Distancia', 'Duración']
      ];
      await sheetsApiRequest(`/values/${encodeURIComponent(sheet1Name)}!A1:K1?valueInputOption=USER_ENTERED`, 'PUT', accessToken, {
        values: headers
      });
    }

    // 2. Check/Write sheet 2 (Multimedia/Carta) headers
    const sheet2Data = await sheetsApiRequest(`/values/${encodeURIComponent(sheet2Name)}!A1:H1`, 'GET', accessToken);
    if (!sheet2Data.values || sheet2Data.values.length === 0) {
      const headers = [
        ['ID', 'Nombre', 'Categoría', 'Precio ($)', 'Descripción', 'Ingredientes', 'Imagen (URL)', 'Disponible']
      ];
      await sheetsApiRequest(`/values/${encodeURIComponent(sheet2Name)}!A1:H1?valueInputOption=USER_ENTERED`, 'PUT', accessToken, {
        values: headers
      });

      // Seed Hoja2 with initial traditional Chilean dishes
      const dishValues = DEFAULT_DISHES.map(d => [
        d.id,
        d.name,
        d.category,
        d.price,
        d.description,
        d.ingredients.join(', '),
        d.image,
        d.available ? 'Si' : 'No'
      ]);

      await sheetsApiRequest(`/values/${encodeURIComponent(sheet2Name)}!A2:H${DEFAULT_DISHES.length + 1}?valueInputOption=USER_ENTERED`, 'PUT', accessToken, {
        values: dishValues
      });
    }
  } catch (err) {
    console.error('Error writing sheet headers:', err);
  }
}

export function extractImageUrl(rawImageCell: any): string {
  if (!rawImageCell) return '';
  let str = String(rawImageCell).trim();

  // Handle Google Sheets formulas like =IMAGE("https://...") or =IMAGEN("https://...")
  if (str.startsWith('=')) {
    const urlMatch = str.match(/https?:\/\/[^\s"',\)]+/);
    if (urlMatch) {
      str = urlMatch[0];
    }
  }

  // Handle Google Drive view links
  const driveMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  return str;
}

// Fetch menu dishes from Hoja2
export async function fetchDishesFromSheet(accessToken: string, sheet2Name: string): Promise<Dish[]> {
  try {
    const data = await sheetsApiRequest(`/values/${encodeURIComponent(sheet2Name)}!A2:H100`, 'GET', accessToken);
    if (!data.values || data.values.length === 0) {
      return DEFAULT_DISHES;
    }

    return data.values.map((row: any[]): Dish => {
      const id = row[0] || '';
      const name = row[1] || '';
      const category = row[2] || '';
      const price = parseFloat(row[3]) || 0;
      const description = row[4] || '';
      const ingredients = row[5] ? row[5].split(',').map((i: string) => i.trim()).filter(Boolean) : [];
      const image = extractImageUrl(row[6]);
      const available = row[7] ? row[7].toLowerCase().trim() === 'si' : true;

      return { id, name, category, price, description, ingredients, image, available };
    }).filter((d: Dish) => d.id && d.name);
  } catch (error) {
    console.error('Error fetching dishes from Sheet:', error);
    // Fallback to local default menu so page is never empty/broken
    return DEFAULT_DISHES;
  }
}

// Write/Append order to Hoja 1
export async function createOrderInSheet(accessToken: string, sheet1Name: string, order: Order): Promise<void> {
  try {
    const row = [
      order.id,
      order.timestamp,
      order.customerName,
      order.email,
      order.phone,
      order.address,
      order.items,
      order.total,
      order.status,
      order.routeDistance || '',
      order.routeDuration || ''
    ];

    await sheetsApiRequest(`/values/${encodeURIComponent(sheet1Name)}!A:K:append?valueInputOption=USER_ENTERED`, 'POST', accessToken, {
      values: [row]
    });
  } catch (error) {
    console.error('Error appending order to sheet:', error);
    throw error;
  }
}

// Fetch orders from Hoja 1 (for Admin panel and to check status in real-time)
export async function fetchOrdersFromSheet(accessToken: string, sheet1Name: string): Promise<Order[]> {
  try {
    const data = await sheetsApiRequest(`/values/${encodeURIComponent(sheet1Name)}!A2:K1000`, 'GET', accessToken);
    if (!data.values || data.values.length === 0) {
      return [];
    }

    return data.values.map((row: any[]): Order => {
      return {
        id: row[0] || '',
        timestamp: row[1] || '',
        customerName: row[2] || '',
        email: row[3] || '',
        phone: row[4] || '',
        address: row[5] || '',
        items: row[6] || '',
        total: parseFloat(row[7]) || 0,
        status: (row[8] as OrderStatus) || 'Recibido',
        routeDistance: row[9] || '',
        routeDuration: row[10] || ''
      };
    }).filter((o: Order) => o.id);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

// Update order status in Sheet (for Admin panel)
export async function updateOrderStatusInSheet(
  accessToken: string,
  sheet1Name: string,
  orderId: string,
  newStatus: OrderStatus
): Promise<void> {
  try {
    // We first read all orders to find the exact row number
    const orders = await fetchOrdersFromSheet(accessToken, sheet1Name);
    const index = orders.findIndex(o => o.id === orderId);

    if (index === -1) {
      throw new Error(`Order ID ${orderId} not found in sheet`);
    }

    // Row number is index + 2 (since headers are row 1 and indexes are 0-based)
    const rowNum = index + 2;
    const range = `${sheet1Name}!I${rowNum}`;

    await sheetsApiRequest(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, 'PUT', accessToken, {
      values: [[newStatus]]
    });
  } catch (error) {
    console.error('Error updating order status in sheet:', error);
    throw error;
  }
}

// Update dish in Sheet (for Admin panel or testing)
export async function updateDishInSheet(
  accessToken: string,
  sheet2Name: string,
  dishId: string,
  updatedFields: Partial<Dish>
): Promise<void> {
  try {
    const dishes = await fetchDishesFromSheet(accessToken, sheet2Name);
    const index = dishes.findIndex(d => d.id === dishId);

    if (index === -1) {
      throw new Error(`Dish ID ${dishId} not found in sheet`);
    }

    const rowNum = index + 2;
    const currentDish = dishes[index];
    const newDish = { ...currentDish, ...updatedFields };

    const row = [
      newDish.id,
      newDish.name,
      newDish.category,
      newDish.price,
      newDish.description,
      newDish.ingredients.join(', '),
      newDish.image,
      newDish.available ? 'Si' : 'No'
    ];

    const range = `${sheet2Name}!A${rowNum}:H${rowNum}`;
    await sheetsApiRequest(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, 'PUT', accessToken, {
      values: [row]
    });
  } catch (error) {
    console.error('Error updating dish in sheet:', error);
    throw error;
  }
}

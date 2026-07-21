/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Dish, Order, OrderStatus } from '../types';
import { formatCLP } from './DishCard';
import { updateOrderStatusInSheet, updateDishInSheet } from '../lib/sheets';
import { CheckCircle2, ChevronDown, Clock, Edit2, List, Loader2, Save, ShoppingBag, RefreshCw, Eye } from 'lucide-react';
import { motion } from 'motion/react';

import { extractImageUrl } from '../lib/sheets_api';

interface AdminPanelProps {
  orders: Order[];
  dishes: Dish[];
  accessToken: string;
  sheet1Name: string;
  sheet2Name: string;
  onRefreshData: () => Promise<void>;
}

export default function AdminPanel({
  orders,
  dishes,
  accessToken,
  sheet1Name,
  sheet2Name,
  onRefreshData
}: AdminPanelProps) {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editImageLink, setEditImageLink] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editDescription, setEditDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [isSavingDish, setIsSavingDish] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatusInSheet(accessToken, sheet1Name, orderId, newStatus);
      await onRefreshData();
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Error al actualizar el estado en Google Sheets');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStartEditDish = (dish: Dish) => {
    setEditingDishId(dish.id);
    setEditName(dish.name);
    setEditImageLink(dish.image);
    setEditPrice(dish.price);
    setEditDescription(dish.description);
  };

  const handleSaveDish = async (dishId: string) => {
    setIsSavingDish(true);
    try {
      const cleanImage = extractImageUrl(editImageLink);
      await updateDishInSheet(accessToken, sheet2Name, dishId, {
        name: editName,
        image: cleanImage,
        price: editPrice,
        description: editDescription
      });
      setEditingDishId(null);
      await onRefreshData();
    } catch (err) {
      console.error('Failed to update dish media link:', err);
      alert('Error al actualizar el plato en Google Sheets');
    } finally {
      setIsSavingDish(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-slate-50 rounded-3xl border border-slate-200/60 p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
            ⚙️ Panel de Control del Restaurante
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visualiza pedidos, administra la carta y sincroniza la multimedia en Google Sheets en tiempo real.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-center px-4 py-2 bg-slate-900 border border-slate-800 rounded-full text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Sincronizando...' : 'Sincronizar Sheets'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Orders List */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
            <ShoppingBag className="w-4.5 h-4.5 text-red-600" />
            Pedidos Recientes en Google Sheets
          </h3>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Clock className="w-8 h-8 mx-auto text-slate-300 stroke-1 mb-2" />
              No hay pedidos registrados en la hoja de cálculo todavía.
            </div>
          ) : (
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">#{order.id.slice(0, 6)}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{order.timestamp}</span>
                    </div>
                    <p className="font-bold text-slate-700">{order.customerName}</p>
                    <p className="text-slate-500 text-[11px]">{order.address}</p>
                    <p className="text-red-700 font-bold bg-red-50 inline-block px-2.5 py-0.5 rounded-full mt-1 text-[10px]">
                      {order.items}
                    </p>
                    <div className="text-slate-800 font-extrabold mt-1 text-sm">
                      Total: {formatCLP(order.total)}
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 justify-between">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[9px] uppercase tracking-wider text-center ${
                      order.status === 'Recibido' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                      order.status === 'En Cocina' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      order.status === 'En Camino' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                      order.status === 'Entregado' ? 'bg-red-50 text-red-700 border border-red-100' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {order.status}
                    </span>

                    <div className="relative inline-block w-full">
                      {updatingOrderId === order.id ? (
                        <div className="flex items-center gap-1 text-slate-400 py-1 px-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                          <span>Guardando...</span>
                        </div>
                      ) : (
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className="w-full bg-white border border-slate-200 rounded-full py-1.5 px-3 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all shadow-xs cursor-pointer"
                        >
                          <option value="Recibido">Recibido</option>
                          <option value="En Cocina">En Cocina</option>
                          <option value="En Camino">En Camino (Reparto)</option>
                          <option value="Entregado">Entregado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dishes Manager (Sheet 2) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
            <List className="w-4.5 h-4.5 text-red-600" />
            Edición de Multimedia y Platos (Hoja2)
          </h3>

          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {dishes.map((dish) => (
              <div
                key={dish.id}
                className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-3 text-xs"
              >
                {editingDishId === dish.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-600">Editando {dish.name}</span>
                      <button
                        onClick={() => setEditingDishId(null)}
                        className="text-slate-400 hover:text-slate-600 font-bold"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nombre del Plato</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-full py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Precio ($ CLP)</label>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(parseInt(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-full py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Descripción Corta</label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">URL de Imagen (Multimedia)</label>
                        <input
                          type="text"
                          value={editImageLink}
                          onChange={(e) => setEditImageLink(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-full py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleSaveDish(dish.id)}
                      disabled={isSavingDish}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-full flex items-center justify-center gap-1 cursor-pointer transition-all text-xs"
                    >
                      {isSavingDish ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Guardando en Google Sheets...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Guardar Cambios
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <img
                      src={dish.image || 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&auto=format&fit=crop&q=80'}
                      alt={dish.name}
                      className="w-16 h-16 object-cover rounded-xl flex-shrink-0 bg-slate-100 border border-slate-200"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="flex-grow min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-slate-800 truncate">{dish.name}</h4>
                        <span className="font-bold text-red-600">{formatCLP(dish.price)}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] line-clamp-1">{dish.description}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleStartEditDish(dish)}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2.5 py-0.5 rounded-full"
                        >
                          <Edit2 className="w-3 h-3" />
                          Editar Datos/Imagen
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dish.available ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {dish.available ? 'Disponible' : 'Agotado'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

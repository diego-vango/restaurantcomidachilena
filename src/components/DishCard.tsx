/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Dish } from '../types';
import { Eye, Info, Plus, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';

interface DishCardProps {
  dish: Dish;
  onAddToCart: (dish: Dish) => void;
}

export const formatCLP = (price: number) => {
  return '$' + price.toLocaleString('es-CL');
};

export default function DishCard({ dish, onAddToCart }: DishCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const isLongDescription = dish.description && dish.description.length > 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg hover:border-red-200 transition-all duration-300 flex flex-col h-full"
    >
      {/* Dish Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
        <img
          src={dish.image || 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&auto=format&fit=crop&q=80'}
          alt={dish.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            // Fallback image if external URL fails to load due to hotlink protection/CORS
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&auto=format&fit=crop&q=80';
          }}
        />
        
        {/* Category Tag */}
        <span className="absolute top-3 left-3 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm">
          {dish.category}
        </span>

        {/* Unavailable overlay */}
        {!dish.available && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center">
            <span className="bg-slate-800 text-white font-bold text-xs uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md animate-pulse">
              Agotado hoy
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-grow flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-1">
            {dish.name}
          </h3>
          <span className="text-red-600 font-bold text-base whitespace-nowrap flex-shrink-0">
            {formatCLP(dish.price)}
          </span>
        </div>

        <div className="flex-grow mb-3">
          <p className={`text-xs text-slate-500 leading-relaxed ${!showFullDescription ? 'line-clamp-2' : ''}`}>
            {dish.description}
          </p>
          {isLongDescription && (
            <button
              type="button"
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline transition-colors mt-1 inline-flex items-center gap-0.5 cursor-pointer"
            >
              {showFullDescription ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </div>

        {/* Ingredients section */}
        <div className="mb-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            {showDetails ? 'Ocultar ingredientes' : 'Ver ingredientes'}
          </button>

          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 flex flex-wrap gap-1"
            >
              {dish.ingredients.map((ing, idx) => (
                <span
                  key={idx}
                  className="bg-slate-50 border border-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md"
                >
                  {ing}
                </span>
              ))}
            </motion.div>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={() => dish.available && onAddToCart(dish)}
          disabled={!dish.available}
          className={`w-full py-2.5 px-4 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            dish.available
              ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4" />
          Añadir +
        </button>
      </div>
    </motion.div>
  );
}

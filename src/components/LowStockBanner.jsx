// src/components/LowStockBanner.jsx
import React from 'react';

export default function LowStockBanner({ items, onNavigateRestock }) {
  const lowStockItems = items.filter((item) => item.is_low_stock || item.remaining_stock <= (item.min_stock_threshold || 5));

  if (lowStockItems.length === 0) return null;

  return (
    <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <div>
            <h3 className="text-sm font-bold">Low Stock Warning ({lowStockItems.length} items require restock)</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              The following items are running below reorder thresholds:
            </p>
          </div>
        </div>
        {onNavigateRestock && (
          <button
            onClick={onNavigateRestock}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition"
          >
            Restock Now
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {lowStockItems.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-amber-200 text-xs font-medium text-amber-800 shadow-xs"
          >
            <strong>{item.name}:</strong> 
            <span className="text-amber-600 font-bold">{item.remaining_stock} left</span> 
            <span className="text-slate-400 text-[10px]">(Min: {item.min_stock_threshold || 5})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
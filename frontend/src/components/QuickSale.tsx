import React, { useState } from 'react';

// Interfaces de datos iniciales basadas en tus requerimientos
interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  stock: number;
}

interface ItemCarrito {
  articulo: Articulo;
  cantidad: number;
}

export const PuntoDeVenta: React.FC = () => {
  // --- ESTADOS INICIALES ---
  const [busqueda, setBusqueda] = useState('');
  const [tipoPago, setTipoPago] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | ''>('');
  
  // Mocks temporales para ver cómo se renderiza la UI
  const [resultadosBusqueda] = useState<Articulo[]>([
    { id: '1', codigo: '101', nombre: 'Artículo de Prueba A', precio: 1500, stock: 5 },
    { id: '2', codigo: '102', nombre: 'Artículo de Prueba B', precio: 2800, stock: 1 }
  ]);

  const [carrito] = useState<ItemCarrito[]>([
    { 
      articulo: { id: '1', codigo: '101', nombre: 'Artículo de Prueba A', precio: 1500, stock: 5 }, 
      cantidad: 2 
    }
  ]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6" style={{ minWidth: '1366px' }}>
      
      {/* Barra superior informativa de Atajos */}
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-emerald-400">Punto de Venta Rápido</h1>
        <div className="flex gap-4 text-xs text-gray-400 bg-gray-800 p-2 rounded">
          <span><kbd className="bg-gray-700 px-1 rounded text-white font-mono">F2</kbd> Buscar</span>
          <span><kbd className="bg-gray-700 px-1 rounded text-white font-mono">F5</kbd> Confirmar</span>
          <span><kbd className="bg-gray-700 px-1 rounded text-white font-mono">F8</kbd> Vaciar</span>
        </div>
      </div>

      {/* Contenedor Principal en Grilla (Layout Horizontal) */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* ================= PANEL IZQUIERDO: BÚSQUEDA (40%) ================= */}
        <div className="col-span-5 bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700 flex flex-col h-[75vh]">
          <h2 className="text-lg font-semibold mb-3 text-gray-300">Búsqueda de Artículos</h2>
          
          {/* Input de Búsqueda */}
          <input
            type="text"
            placeholder="Buscar por código, nombre o barra..."
            className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white text-lg focus:outline-none focus:border-emerald-500 mb-4"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {/* Lista de Resultados */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {resultadosBusqueda.map((art) => (
              <div 
                key={art.id} 
                className="flex justify-between items-center bg-gray-900 p-3 rounded cursor-pointer hover:bg-gray-700 border border-transparent hover:border-emerald-500 transition"
              >
                <div>
                  <p className="font-medium text-sm">{art.nombre}</p>
                  <p className="text-xs text-gray-400">Cód: {art.codigo} | Stock: {art.stock}</p>
                </div>
                <span className="text-emerald-400 font-bold">${art.precio}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ================= PANEL DERECHO: CARRITO (60%) ================= */}
        <div className="col-span-7 bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700 flex flex-col h-[75vh] justify-between">
          
          {/* Listado del Carrito */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">Carrito de Compras</h2>
            
            {carrito.map((item) => (
              <div key={item.articulo.id} className="flex items-center justify-between bg-gray-900 p-3 rounded border border-gray-700">
                {/* Detalle Artículo */}
                <div className="w-1/3">
                  <p className="font-medium text-sm truncate">{item.articulo.nombre}</p>
                  <p className="text-xs text-gray-400">${item.articulo.precio} c/u</p>
                </div>

                {/* Controles de Cantidad */}
                <div className="flex items-center gap-2">
                  <button className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs font-bold">-</button>
                  <input 
                    type="number" 
                    className="w-12 text-center bg-gray-800 border border-gray-600 rounded p-1 text-sm font-semibold"
                    value={item.cantidad}
                    readOnly
                  />
                  <button className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs font-bold">+</button>
                </div>

                {/* Subtotal y Acción de Eliminar */}
                <div className="flex items-center gap-4">
                  <span className="font-bold text-white w-20 text-right">${item.articulo.precio * item.cantidad}</span>
                  <button className="text-red-400 hover:text-red-500 font-bold px-1">✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* Sección Inferior: Tipo de Pago y Totales */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              
              {/* Selector de tipo de pago */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-300">Tipo de Pago *:</label>
                <select 
                  className="bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none"
                  value={tipoPago}
                  onChange={(e) => setTipoPago(e.target.value as any)}
                >
                  <option value="">-- Seleccionar --</option>
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="TARJETA">TARJETA</option>
                  <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                </select>
              </div>

              {/* Total General */}
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total General</p>
                <p className="text-3xl font-black text-emerald-400">$3,000</p>
              </div>
            </div>

            {/* Botones de Confirmación / Cancelación */}
            <div className="flex gap-4">
              <button className="w-1/3 bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white font-semibold py-3 px-4 rounded transition">
                Vaciar Carrito (F8)
              </button>
              <button className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded transition">
                Confirmar Venta (F5)
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

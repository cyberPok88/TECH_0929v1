'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTO [ID] — página de detalle (Guía 1.2 · Parte 6)
// Página DELGADA (Regla 1): monta <ProductoFicha/> que carga el producto por id.
// Ruta: /dashboard/catalogos/productos/{id} (ficha del producto).
// ═══════════════════════════════════════════════════════════════════════════════

import { ProductoFicha } from '@/components/catalogos/productos/ProductoFicha'

export default function Page() {
    return <ProductoFicha />
}

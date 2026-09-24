// cache-catalogos.ts — caché en memoria de cliente (opción A · Guía 1.0)
// Vive a nivel de módulo (ámbito del bundle): es por sesión/pestaña del navegador,
// NO por componente ni por ruta. Los catálogos son read-heavy/low-write: se cargan
// una vez por sesión y se refrescan al escribir (cargar() fuerza red).
import type { ClaveTabCatalogo } from '@/types/catalogos'

const datos = new Map<ClaveTabCatalogo, unknown[]>()

export function leerCache(clave: ClaveTabCatalogo): unknown[] | undefined {
  return datos.get(clave)
}

export function guardarCache(clave: ClaveTabCatalogo, filas: unknown[]): void {
  datos.set(clave, filas)
}

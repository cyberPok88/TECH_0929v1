import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

import type { ToolbarAction } from "@/types/shell"

/**
 * Combina clases de Tailwind de forma inteligente.
 *
 * - Resuelve conflictos: cn('p-2', 'p-4') → 'p-4'
 * - Permite clases condicionales: cn('base', isActive && 'active')
 * - Permite override desde el padre: cn('bg-blue-500', className)
 *
 * @example
 * cn('flex items-center', isOpen && 'flex-col', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARADOR DE ACCIONES DEL TOOLBAR — Guía 0.6
// Reemplaza a lodash.isEqual (~70 KB) y, sobre todo, compara MENOS a propósito.
// Lo consumen page-context-store (guard anti-bucle) y Toolbar (memoización).
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compara dos arrays de ToolbarAction por sus campos ESTABLES.
 *
 * Ignora deliberadamente:
 *   • onClick — una función declarada en un componente es una referencia nueva
 *     en cada render. Compararla daría siempre false y reintroduciría el bucle
 *     infinito que este comparador existe para prevenir.
 *   • icon — es una constante de módulo; a igual `id`, igual icono.
 *
 * @returns true si los arrays son funcionalmente idénticos para la UI.
 */
export function areActionsEqual(a: ToolbarAction[], b: ToolbarAction[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.label !== y.label ||
      x.accion !== y.accion ||
      x.variant !== y.variant ||
      x.disabled !== y.disabled ||
      x.title !== y.title
    ) {
      return false
    }
  }

  return true
}

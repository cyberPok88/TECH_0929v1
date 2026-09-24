'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOGO FILTERS — Esqueleto genérico del apartado de filtros (Guía 0.8 · Parte 8)
//
// PROMOCIÓN 23 Ago 2026 — contrato validado por el usuario sobre mockup
// DOCS/design/CatalogoFilters_mockup.html. Lo consumen (gate ≥2 cumplido con 4):
//   · 0.9 Usuarios · 0.10 Roles · 1.0 Proveedores · 1.1 Productos · candidato 1.2 Clientes
//
// UN solo look para el "apartado de filtros" que vive bajo la Toolbar del Shell:
//   · Fila 1 — búsqueda (debounce 300ms) + contador + "Limpiar filtros"
//   · Fila 2+ — children: controles específicos del dominio (Selects, chips, switches)
//
// El debounce usa useRef + handler (precedente RoleFilters 0.10) — sin
// setState sincrónico en effects (regla react-hooks/set-state-in-effect).
// El sync externo de `busqueda` (cuando el padre resetea) usa el patrón React 19
// "ajustar estado durante el render", no un effect.
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CatalogoFiltersProps {
    /** Valor estabilizado de la búsqueda (estado del padre). */
    busqueda: string
    /** Emite la búsqueda tras 300ms de inactividad (debounce interno). */
    onBusquedaChange: (valor: string) => void
    /** Placeholder específico del dominio. Default: "Buscar…" */
    placeholderBusqueda?: string
    /** Contador de resultados — opcional; undefined oculta el bloque. */
    contador?: number
    /** Sustantivo del contador: { singular: 'item', plural: 'items' } — lo arma el dominio. */
    sustantivoContador?: { singular: string; plural: string }
    /** True si hay filtros activos ≠ default → muestra "Limpiar filtros". */
    hayFiltrosActivos: boolean
    /** Resetea TODOS los filtros (búsqueda incluida) al default del dominio. */
    onLimpiar: () => void
    /** Controles específicos del CRUD (Selects, chips, switches…) — Fila 2+.
     *  Opcional (FIX 24 Ago 2026): los CRUDs mini (sin Fila 2 de controles)
     *  solo usan búsqueda y omiten children sin romper el contrato. */
    children?: ReactNode
    /** Deshabilita todos los controles (carga inicial). */
    disabled?: boolean
    /** Clase extra para el layout del padre. */
    className?: string
}

const DEBOUNCE_MS = 300

export function CatalogoFilters({
    busqueda,
    onBusquedaChange,
    placeholderBusqueda = 'Buscar…',
    contador,
    sustantivoContador,
    hayFiltrosActivos,
    onLimpiar,
    children,
    disabled = false,
    className,
}: CatalogoFiltersProps) {
    // Valor local del input: responde al teclear. El onChange real se emite 300 ms
    // después de la última tecla (debounce). useRef para el timeout evita el patrón
    // setState-en-efecto que la regla react-hooks/set-state-in-effect prohíbe.
    const [busquedaLocal, setBusquedaLocal] = useState(busqueda)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync externo: cuando el padre resetea `busqueda` (botón Limpiar) desde
    // fuera, ajustamos el estado local DURANTE el render (patrón React 19
    // "ajustar estado durante el render" — no un effect).
    const [busquedaPrevia, setBusquedaPrevia] = useState(busqueda)
    if (busquedaPrevia !== busqueda) {
        setBusquedaPrevia(busqueda)
        setBusquedaLocal(busqueda)
    }

    const manejarBusqueda = (valor: string) => {
        setBusquedaLocal(valor)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            onBusquedaChange(valor)
        }, DEBOUNCE_MS)
    }

    const limpiar = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setBusquedaLocal('')
        onLimpiar()
    }

    const textoContador =
        typeof contador === 'number' && sustantivoContador
            ? contador === 0
                ? 'Sin coincidencias'
                : contador === 1
                    ? `1 ${sustantivoContador.singular}`
                    : `${contador} ${sustantivoContador.plural}`
            : null

    return (
        <div
            className={cn(
                // ⭐ FIX 22 Sep 2026 — `w-full`: dentro del `FiltrosBar` del Shell (fila flex)
                // la caja se encogía al contenido y el apartado no usaba el ancho.
                'flex w-full flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4',
                className,
            )}
        >
            {/* Fila 1 — Búsqueda + contador + Limpiar */}
            <div className="flex items-center gap-3">
                <div className="relative min-w-0 flex-1">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        type="search"
                        placeholder={placeholderBusqueda}
                        className="pl-9 pr-9"
                        value={busquedaLocal}
                        disabled={disabled}
                        onChange={(e) => manejarBusqueda(e.target.value)}
                        aria-label={placeholderBusqueda}
                    />
                    {busquedaLocal !== '' && (
                        <button
                            type="button"
                            onClick={() => manejarBusqueda('')}
                            aria-label="Limpiar búsqueda"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {textoContador && (
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                        {textoContador}
                    </span>
                )}

                {hayFiltrosActivos && (
                    <button
                        type="button"
                        onClick={limpiar}
                        className="ml-auto text-xs text-primary hover:underline"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* Fila 2+ — controles del dominio */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
        </div>
    )
}

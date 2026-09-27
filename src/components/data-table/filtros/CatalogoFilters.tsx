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

/**
 * ⭐ MEJORA 26 Sep 2026 — un filtro aplicado, legible y removible.
 * Existe porque «Limpiar filtros» solo aparecía cuando `hayFiltrosActivos` y no decía
 * CUÁL estaba puesto: el usuario veía una lista corta sin saber por qué. Los chips
 * nombran cada filtro y lo quitan de a uno.
 */
export interface ChipFiltro {
    /** Estable para la `key` (p. ej. `'cola'`, `'fecha'`). */
    clave: string
    etiqueta: string
    onQuitar: () => void
}

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
    /** ⭐ MEJORA 26 Sep 2026 — filtros aplicados como chips removibles, en su propia
     *  línea bajo los controles. Opcional: sin él, el apartado se comporta como antes. */
    chips?: ChipFiltro[]
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
    chips,
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
                //
                // ⭐ MEJORA 26 Sep 2026 (3ª pasada) — FUERA LA TARJETA INTERNA. Antes esto
                // era `rounded-lg border border-border bg-surface-raised p-4`: el área de
                // filtros quedaba como una caja con borde DENTRO de la barra del Shell
                // (`bg-surface` + su propio borde) DENTRO de la página. Tres superficies
                // anidadas para un puñado de controles. Ahora los controles viven directo
                // sobre la superficie de la barra: misma información, menos marco.
                // El padding lo pone la barra (px-3 py-2), no el apartado.
                'flex w-full flex-wrap items-center gap-x-4 gap-y-3 lg:items-end',
                className,
            )}
        >
            {/* ⭐ MEJORA 26 Sep 2026 (2ª iteración) — UNA SOLA LÍNEA EN ESCRITORIO.
                Antes eran dos filas fijas (búsqueda / controles) en CUALQUIER ancho,
                y la descripción de dominio que varios CRUD ponían en la última
                columna del grid la estiraba a una tercera. Ahora el apartado es un
                único flujo que envuelve: en móvil cada pieza ocupa su fila —la caja
                es `w-full`— y desde lg la búsqueda se lleva el sobrante (`lg:flex-1`
                con techo `lg:max-w-md`) mientras controles, contador y «Limpiar»
                comparten la misma línea. Si en un ancho dado no caben, envuelven:
                nunca se solapan ni se aplastan. */}
            <div className="relative w-full min-w-[9rem] lg:w-auto lg:max-w-md lg:flex-1">
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    type="search"
                    placeholder={placeholderBusqueda}
                    // ⭐ Ley 5 (44px de dedo en móvil, 36px densos en escritorio):
                    // el mismo patrón que ya usan NavItem/NavGroup/DataTable.
                    className="h-11 pl-9 pr-9 md:h-9"
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

            {/* Controles del dominio. En móvil el kit llega `w-full` (una fila por
                control, alineados); desde lg van en la línea de la búsqueda. */}
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 lg:w-auto">
                {children}
            </div>

            {/* Contador y «Limpiar» CIERRAN la línea: describen el resultado, no la
                entrada. Antes vivían junto al buscador y en móvil le robaban ancho
                (el input medía 97px = 6 caracteres). */}
            {textoContador && (
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {textoContador}
                </span>
            )}

            {/* ⭐ MEJORA 26 Sep 2026 — con chips, el «Limpiar filtros» se muda a la línea
                de los chips: si estuviera aquí, el mismo botón aparecería dos veces en la
                misma pantalla (uno por filtro, otro para todos). */}
            {hayFiltrosActivos && !(chips && chips.length > 0) && (
                <button
                    type="button"
                    onClick={limpiar}
                    // `min-h-11` en móvil: este botón medía 70×16 px, el objetivo
                    // táctil más pequeño de toda el área de filtros.
                    className="ml-auto inline-flex min-h-11 items-center text-xs text-primary hover:underline md:min-h-0"
                >
                    Limpiar filtros
                </button>
            )}

            {/* ⭐ MEJORA 26 Sep 2026 — CHIPS DE FILTROS ACTIVOS. Su propia línea, para que
                la fila de controles no salte de alto cada vez que se filtra. Cada chip dice
                QUÉ está filtrado y lo quita solo; el «Limpiar todo» del final los quita
                todos. Es la respuesta a «¿por qué me salen tan pocas filas?». */}
            {chips && chips.length > 0 && (
                <div className="flex w-full flex-wrap items-center gap-2">
                    {chips.map((chip) => (
                        <span
                            key={chip.clave}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary-bg',
                                'pl-2.5 pr-1 text-[11px] text-primary'
                            )}
                        >
                            {chip.etiqueta}
                            <button
                                type="button"
                                onClick={chip.onQuitar}
                                aria-label={`Quitar el filtro ${chip.etiqueta}`}
                                title={`Quitar el filtro «${chip.etiqueta}»`}
                                className="inline-flex size-6 items-center justify-center rounded-full hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <X className="size-3" aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={limpiar}
                        className="inline-flex min-h-11 items-center text-xs text-primary hover:underline md:min-h-0"
                    >
                        Limpiar todo
                    </button>
                </div>
            )}
        </div>
    )
}

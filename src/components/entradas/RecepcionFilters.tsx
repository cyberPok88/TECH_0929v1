'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RECEPCION FILTERS — Filtros del listado de recepción (Guía 1.6 · P2 · Dumb)
// Compone CatalogoFilters + búsqueda por folio/proveedor · **vista de cola** · rango de fechas.
//
// ⭐ MEJORA 24 Sep 2026 (Fase 1 · Recepción) — EL CONTROL ES LA VISTA DE COLA.
// Antes el único control de estado era un select con los 10 estados del DOCUMENTO. Ahora es la
// **vista de cola** — el patrón que estrenó la Fase 2 en `RevisionFilters` y sin inventar nada:
// `VISTAS_COLA` son las tres vistas del FLUJO (a revisar · por cerrar · **avanzadas**) y «Todas» es
// el centinela del kit. ⭐ FIX 25 Sep 2026 — la tercera se llamaba «Cerradas», pero incluye
// `ajustada` (nota generada, **esperando acondicionamiento**): sólo `confirmada` es un cierre.
// ⚠️ 24 Sep 2026 (usuario): la vista por DEFECTO es **Todas las entradas** — *«el filtro por
// defecto es ver todas»*. Se probó abrir filtrada a lo que Recepción debe cerrar y se descartó: el
// recepcionista quiere el listado completo y acotarlo él. El orden es el del listado (más reciente
// primero, `listarEntradas`).
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect } from '@/components/data-table'
import type { ChipFiltro } from '@/components/data-table'
import type { FiltrosEntradas } from '@/types/entradas'
import {
    CLAVE_TODAS,
    VISTAS_COLA,
    claveDeVista,
    estadosDeVista,
    fechaCorta,
} from '@/components/entradas/RevisionFilters'

/**
 * Default de los listados de Entradas que **no** tienen cola propia (Alta, Acondicionamiento):
 * sin vista → el listado no filtra por conjunto.
 */
export const FILTROS_ENTRADAS_DEFAULT: FiltrosEntradas = {
    busqueda: '',
    estado: '',
    fecha_desde: '',
    fecha_hasta: '',
}

/** ⚠️ 24 Sep 2026 (usuario): la vista por defecto de Recepción es **TODAS**.
 *  Se probó abrir la cola filtrada a lo que Recepción debe cerrar («Por cerrar / en Recepción») y
 *  el veredicto fue *«el filtro por defecto es ver todas»*: el recepcionista quiere ver el listado
 *  completo y acotarlo él. La vista sigue disponible en el select — solo deja de ser el default. */
export const FILTROS_RECEPCION_DEFAULT: FiltrosEntradas = FILTROS_ENTRADAS_DEFAULT

const OPCIONES_VISTA = [
    ...VISTAS_COLA.map((v) => ({ valor: v.clave, etiqueta: v.etiqueta })),
    { valor: CLAVE_TODAS, etiqueta: 'Todas las entradas' },
]

interface RecepcionFiltersProps {
    filtros: FiltrosEntradas
    onFiltrosChange: (patch: Partial<FiltrosEntradas>) => void
    contador?: number
    disabled?: boolean
}

/**
 * ⭐ MEJORA 26 Sep 2026 — ¿hay algún filtro distinto del default?
 * FUENTE ÚNICA de la pregunta: la usa la barra (para ofrecer «Limpiar») y la tabla (para
 * distinguir «no hay datos» de «ninguna coincide con lo que filtraste»). Tenerla escrita dos
 * veces es cómo las dos pantallas terminan discrepando.
 */
export function hayFiltrosRecepcion(f: FiltrosEntradas): boolean {
    return (
        f.busqueda !== '' ||
        f.estado !== '' ||
        f.fecha_desde !== '' ||
        f.fecha_hasta !== '' ||
        claveDeVista(f.estados) !== CLAVE_TODAS
    )
}

export function RecepcionFilters({ filtros, onFiltrosChange, contador, disabled = false }: RecepcionFiltersProps) {
    const vista = claveDeVista(filtros.estados)
    const hayFiltrosActivos = hayFiltrosRecepcion(filtros)

    const limpiar = () => onFiltrosChange(FILTROS_RECEPCION_DEFAULT)

    // ⭐ MEJORA 26 Sep 2026 — los filtros aplicados, nombrados. «Limpiar filtros» existía
    // pero no decía CUÁL estaba puesto: el recepcionista veía una lista corta sin saber por
    // qué. Cada chip lo dice y lo quita solo.
    const chips: ChipFiltro[] = []
    if (vista !== CLAVE_TODAS) {
        const etiquetaVista = OPCIONES_VISTA.find((o) => o.valor === vista)?.etiqueta ?? vista
        chips.push({
            clave: 'cola',
            etiqueta: `Cola: ${etiquetaVista}`,
            onQuitar: () => onFiltrosChange({ estados: [] }),
        })
    }
    if (filtros.fecha_desde !== '' || filtros.fecha_hasta !== '') {
        const desde = filtros.fecha_desde === '' ? 'inicio' : fechaCorta(filtros.fecha_desde)
        const hasta = filtros.fecha_hasta === '' ? 'hoy' : fechaCorta(filtros.fecha_hasta)
        chips.push({
            clave: 'fecha',
            etiqueta: `Fecha: ${desde} – ${hasta}`,
            onQuitar: () => onFiltrosChange({ fecha_desde: '', fecha_hasta: '' }),
        })
    }

    return (
        <CatalogoFilters
            busqueda={filtros.busqueda}
            onBusquedaChange={(busqueda) => onFiltrosChange({ busqueda })}
            placeholderBusqueda="Buscar por folio o proveedor…"
            contador={contador}
            sustantivoContador={{ singular: 'entrada', plural: 'entradas' }}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiar}
            chips={chips}
            disabled={disabled}
        >
            {/* ⭐ MEJORA 26 Sep 2026 (4ª pasada) — EL RANGO DE FECHAS SE MUDÓ AL ENCABEZADO
                de su columna (`filtro` en `columnaFecha`, RecepcionCatalogo). El usuario lo
                pidió: *«los encabezados de la tabla servían como los filtros: el encabezado
                Fecha, si le apretabas, mostraba un mini modal»*.
                Queda aquí lo que NO es una columna —la vista de cola, que es un CONJUNTO de
                estados del proceso— y el buscador. Sin grid de dos columnas: un solo control. */}
            <FiltroSelect
                label="Cola"
                opciones={OPCIONES_VISTA}
                valor={vista}
                onValorChange={(clave) =>
                    onFiltrosChange({ estados: clave === CLAVE_TODAS ? [] : estadosDeVista(clave) })
                }
                disabled={disabled}
            />
        </CatalogoFilters>
    )
}

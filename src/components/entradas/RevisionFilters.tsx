'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// REVISION FILTERS — filtros de la COLA del técnico (Guía 1.6 · Fase 2 · Dumb)
//
// ⭐ MEJORA 24 Sep 2026 — diseño aprobado en
// `DOCS/design/entradas/revision-puesto-tactil.html` §2.
//
// La cola de una ETAPA no se filtra como un catálogo:
//   · «Cola» dice a QUÉ PARTE DEL FLUJO miras (A revisar · Por cerrar · Cerradas · Todas) y se
//     traduce a `estados[]` — «A revisar» son TRES estados (`recien_creada` ·
//     `lista_para_revision` · `en_revision`), no uno. Por eso el filtro clásico de estado suelto
//     no alcanzaba y la cola abría mostrando las 7 entradas del sistema, incluidas las cerradas.
//   · «Antigüedad» es el filtro que hace VISIBLE el problema reportado —una entrada puede llevar
//     3 días en cola—: «lo que lleva ≥ N días esperando». Va como campo propio
//     (`antiguedad_min`) y NO derivado de `fecha_hasta`, para que tocar el rango de fechas no
//     mueva la antigüedad por debajo.
// ═══════════════════════════════════════════════════════════════════════════════

import { CatalogoFilters, FiltroSelect } from '@/components/data-table'
import type { ChipFiltro } from '@/components/data-table'
import type { EstadoEntrada, FiltrosEntradas } from '@/types/entradas'

export interface VistaCola {
    clave: string
    etiqueta: string
    /** Estados que abarca. */
    estados: EstadoEntrada[]
}

/** Las vistas de la cola, en el orden en que avanza el flujo. «Todas» es el centinela del kit. */
export const VISTAS_COLA: VistaCola[] = [
    {
        clave: 'revisar',
        etiqueta: 'A revisar',
        estados: ['recien_creada', 'lista_para_revision', 'en_revision'],
    },
    {
        clave: 'por_cerrar',
        etiqueta: 'Por cerrar / en Recepción',
        estados: ['revisada_sin_dev', 'con_dev'],
    },
    {
        clave: 'cerradas',
        // ⭐ FIX 25 Sep 2026 (usuario · ING-0002) — la vista se llamaba **«Cerradas»** y ahí entra
        // `ajustada`, que **no** está cerrada: es «nota generada, esperando acondicionamiento»
        // (medido: `fecha_fin_acond`/`fecha_fin_almacen` nulas y 0 lotes). El usuario leyó ese
        // rótulo —y la píldora «Cerrada» de la fila— como *«me cerró el ingreso … solo se generó la
        // NC»*. Sólo `confirmada` es un cierre; el resto son etapas **avanzadas**. La `clave` no
        // cambia (es el id interno de la vista, no un rótulo).
        etiqueta: 'Avanzadas',
        estados: ['ajustada', 'en_acondicionamiento', 'en_almacen', 'confirmada'],
    },
]

/** Clave del centinela «Todas» (el `FiltroSelect` la trae de fábrica). */
export const CLAVE_TODAS = 'todas'

/** Los estados de una vista; «Todas» → sin restricción (`[]`, y el listado no filtra). */
export function estadosDeVista(clave: string): EstadoEntrada[] {
    return VISTAS_COLA.find((v) => v.clave === clave)?.estados ?? []
}

/** La clave de vista que corresponde al conjunto activo (para pintar el select). */
export function claveDeVista(estados: EstadoEntrada[] | undefined): string {
    const actual = estados ?? []
    const v = VISTAS_COLA.find(
        (x) => x.estados.length === actual.length && x.estados.every((e) => actual.includes(e))
    )
    return v?.clave ?? CLAVE_TODAS
}

/**
 * ⭐ 24 Sep 2026 (usuario) — la cola abre en **TODAS**, con **lo cerrado al final**.
 * Se probó abrirla acotada a «A revisar» y se descartó: *«el filtro ponlo en default la cola a
 * todas»* — la vista no esconde trabajo, y el técnico acota él. La prioridad que pidió
 * (*«al último siempre las cerradas, arriba todas las que tienen un estatus diferente»*) la da el
 * **ORDEN**, no el filtro: `orden: 'cola'` deja **arriba lo que le falta a la etapa**
 * (`fecha_fin_rev` nula: el recién creado que nadie tomó, el empezado sin terminar y el que ya
 * tiene días — ordenados por antigüedad) y **abajo lo ya cerrado**.
 * ⚠️ Un corte por ESTADO fino (una franja por cada estado) no es expresable en PostgREST con
 * `estado` de tipo `text`: exigiría un objeto de BD (vista o columna generada), carril ANEXIÓN-BD
 * — queda declarado como pendiente de decisión, no hecho a medias.
 */
export const FILTROS_REVISION_DEFAULT: FiltrosEntradas = {
    busqueda: '',
    estado: '',
    estados: [],
    antiguedad_min: 0,
    // ⭐ MEJORA 34 (usuario, 27 Sep 2026) — **por FECHA, el último arriba**. El default era
    // `orden: 'cola'` (arriba lo que le falta a la etapa y lo cerrado al final, decisión del 25 Sep);
    // el usuario prefiere el orden cronológico: *«acomodar siempre por fecha mejor, el ultimo
    // arriba»*. `'cola'` sigue implementado en la Server Action (`fecha_fin_rev` nula primero,
    // `nullsFirst`) por si se quiere volver a atarlo a una vista.
    orden: 'recientes',
    fecha_desde: '',
    fecha_hasta: '',
}

const OPCIONES_ANTIGUEDAD = [
    { valor: '1', etiqueta: '≥ 1 día' },
    { valor: '2', etiqueta: '≥ 2 días' },
    { valor: '3', etiqueta: '≥ 3 días' },
]

/**
 * «01/09/2026» desde un `YYYY-MM-DD` **sin pasar por `new Date`**.
 * ⚠️ Un date-only (`'2026-09-01'`) lo interpreta el motor como medianoche **UTC**; al
 * formatearlo en la zona local de México (UTC−6) sale el día ANTERIOR. Los valores de un
 * `<input type="date">` son date-only, así que se parten en sus tres campos y se arman tal cual.
 * (No aplica a `formatearFechaEntrada`, que formatea un `TIMESTAMPTZ` real.)
 *
 * Vive aquí —y no en cada barra— porque la usan las DOS colas del módulo (Recepción y Revisión)
 * para rotular el chip de fechas.
 */
export function fechaCorta(iso: string): string {
    const [a, m, d] = iso.split('-')
    return a && m && d ? `${d}/${m}/${a}` : iso
}

interface RevisionFiltersProps {
    filtros: FiltrosEntradas
    onFiltrosChange: (patch: Partial<FiltrosEntradas>) => void
    contador?: number
    disabled?: boolean
}

/**
 * ⭐ MEJORA 26 Sep 2026 — ¿hay algún filtro distinto del default? FUENTE ÚNICA: la usan la
 * barra (para ofrecer «Limpiar») y la tabla (para distinguir «no hay datos» de «ninguna
 * coincide con lo que filtraste»).
 * La VISTA por defecto (Todas) NO cuenta: si contara, el botón «Limpiar» estaría encendido
 * desde que se abre la pantalla.
 */
export function hayFiltrosRevision(f: FiltrosEntradas): boolean {
    return (
        f.busqueda !== '' ||
        claveDeVista(f.estados) !== CLAVE_TODAS ||
        (f.antiguedad_min ?? 0) > 0 ||
        f.fecha_desde !== '' ||
        f.fecha_hasta !== ''
    )
}

export function RevisionFilters({
    filtros,
    onFiltrosChange,
    contador,
    disabled = false,
}: RevisionFiltersProps) {
    const vista = claveDeVista(filtros.estados)
    const antiguedad = filtros.antiguedad_min ?? 0
    const hayFiltrosActivos = hayFiltrosRevision(filtros)

    const limpiar = () => onFiltrosChange(FILTROS_REVISION_DEFAULT)

    // ⭐ MEJORA 26 Sep 2026 — los filtros aplicados, nombrados (ver `RecepcionFilters`).
    const chips: ChipFiltro[] = []
    if (vista !== CLAVE_TODAS) {
        const etiquetaVista = VISTAS_COLA.find((v) => v.clave === vista)?.etiqueta ?? vista
        chips.push({
            clave: 'cola',
            etiqueta: `Cola: ${etiquetaVista}`,
            onQuitar: () => onFiltrosChange({ estados: [] }),
        })
    }
    if (antiguedad > 0) {
        chips.push({
            clave: 'antiguedad',
            etiqueta: `Antigüedad: ≥ ${antiguedad} día${antiguedad === 1 ? '' : 's'}`,
            onQuitar: () => onFiltrosChange({ antiguedad_min: 0 }),
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
            {/* ⭐ MEJORA 26 Sep 2026 (4ª pasada) — FUERA el rango de fechas de la barra: se mudó
                al ENCABEZADO de su columna (`filtro` en la columna Fecha de RevisionCatalogo).
                Y fuera también el grid de 3 columnas que solo existía para alojarlo: quedan dos
                selects que el flujo del apartado ya acomoda solo. */}
            <FiltroSelect
                label="Cola"
                opciones={VISTAS_COLA.map((v) => ({ valor: v.clave, etiqueta: v.etiqueta }))}
                valor={vista}
                centinela={CLAVE_TODAS}
                etiquetaCentinela="Todas"
                onValorChange={(clave) => onFiltrosChange({ estados: estadosDeVista(clave) })}
                disabled={disabled}
            />
                <FiltroSelect
                    label="Antigüedad"
                    opciones={OPCIONES_ANTIGUEDAD}
                    valor={antiguedad > 0 ? String(antiguedad) : '__todos__'}
                    etiquetaCentinela="Cualquiera"
                    onValorChange={(v) =>
                        onFiltrosChange({ antiguedad_min: v === '__todos__' ? 0 : Number(v) })
                    }
                    disabled={disabled}
                />
        </CatalogoFilters>
    )
}

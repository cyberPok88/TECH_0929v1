'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMNAS DE ENTRADA — builders compartidos por las tablas de cada fase
// (Guía 1.6 · MEJORA 20 Sep 2026).
// ⭐ Cada fase COMPONE las suyas según el ROL de la etapa (no todas muestran lo
// mismo):  Recepción → partidas·recibidas·DEV·final·total·nota · Revisión →
// partidas·piezas·resultado · Acondicionamiento → partidas·piezas (sin costos) ·
// Alta → partidas·piezas·nota (sin costos).
// ⭐ MEJORA 22 Sep 2026: Recepción muestra la EVOLUCIÓN de la cantidad —
// `Recibidas` (declarada) · `DEV` · `Final` (Σ vigente, que solo existe tras el
// ajuste: mientras la DEV esté pendiente la celda lo dice en vez de mentir con un
// número) — y el `Total` ya sale con la cantidad vigente (no hay total "original"
// en pantalla: no aporta).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ColumnDef } from '@tanstack/react-table'
import { FileText } from 'lucide-react'

import { Pildora } from '@/components/data-table'
import type { ColumnDefExtension, TonoPildora } from '@/components/data-table'
import { cn } from '@/lib/utils'
import type { BandejaLiberada, Entrada, HuellaResuelta, PartidaConAvance } from '@/types/entradas'
import {
    claveLinea,
    puedeAjustarNota,
    TEXTO_ESTADO_ENTRADA,
    TEXTO_ESTADO_TANDA,
    TEXTO_ETAPA_RECEPCION,
    TEXTO_ETAPA_REVISION,
    TONO_ESTADO_ENTRADA,
    TONO_ESTADO_TANDA,
    TONO_ETAPA_RECEPCION,
    TONO_ETAPA_REVISION,
} from '@/types/entradas'

export type ColumnaEntrada = ColumnDef<Entrada> & ColumnDefExtension<Entrada>

export function formatearFechaEntrada(fecha: string): string {
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatearMXNEntrada(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

/**
 * ⭐ MEJORA 24 Sep 2026 — los **valores** de los atributos de una partida, en una línea
 * («PC · 2TB · 3.5"»). Se separa de `huellaDeclarada` porque hay pantallas que pintan la
 * categoría por su lado (en negrita) y solo necesitan los valores.
 */
export function valoresAtributos(atributos: Record<string, unknown>): string {
    return Object.values(atributos ?? {})
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map(String)
        .join(' · ')
}

/**
 * ⭐ MEJORA 24 Sep 2026 — el **producto declarado** de una partida (o de una devolución): la
 * categoría + los atributos capturados en recepción, o sea la huella. Una sola forma de
 * escribirlo en el módulo — la usan el desglose de partidas y el modal de la devolución, que
 * antes tenían cada uno su copia.
 * ⚠️ Una pieza **devuelta no tiene SKU** (lo resuelve Almacén y solo para lo aprobado): esto NO
 * es un nombre de producto, es la descripción tal como se recibió.
 */
export function huellaDeclarada(categoria: string | null, atributos: Record<string, unknown>): string {
    return [categoria ?? 'Sin categoría', valoresAtributos(atributos)].filter(Boolean).join(' · ')
}

/**
 * ⭐ MEJORA 22 Sep 2026 — ¿la entrada tiene una DEV **sin ajustar**? Mismo criterio que la
 * acción «Ajustar y nota». Mientras sea `true` el «final» todavía NO existe: `cantidad_vigente`
 * sigue igual a la declarada (caso real ING-0005: dev 1 · vigentes 5 · estado `con_dev`).
 *
 * ⭐ MEJORA 28 — el criterio de estado+nota sale de **`puedeAjustarNota`** (fuente única en
 * `types/entradas`), la MISMA que valida la Server Action: así el botón y el servidor no pueden
 * discrepar. Aquí solo se le añade la condición propia del módulo: que **haya DEV**.
 */
export function devPendiente(e: Entrada): boolean {
    return e.devolucion_total > 0 && puedeAjustarNota(e.estado, e.id_nota)
}

export const columnaFolio: ColumnaEntrada = {
    accessorKey: 'folio',
    label: 'Folio',
    movil: 'critica',
    // ⭐ MEJORA 24 Sep 2026 (usuario) — el folio del ingreso es la IDENTIDAD de la fila: sube de
    // `text-xs` (12px) a `text-[15px]`. ⚠️ Se probó con `font-semibold` y el usuario lo rechazó
    // («no se ve bien lo que pusiste en negritas»): el tamaño hace el trabajo, el peso no.
    render: (valor) => (
        <span className="font-mono text-[15px] tabular-nums">{String(valor)}</span>
    ),
}

// ⚠️ RETIRADA 24 Sep 2026 (usuario) — aquí vivió `crearColumnaFolio({ conFecha, onVerNota })`, que
// apilaba FECHA y NOTA bajo el folio para ganar ancho. Se probó en la app y el veredicto fue
// revertir: *«todo junto folio/fecha/botón de NC se ve muy mal; aparecen menos datos que antes y se
// ve mucho más amontonado — se veía bien antes con la devolución en píldora al lado, la NC»*.
// La celda de identidad es SOLO el folio; fecha y nota tienen su columna.

export const columnaFecha: ColumnaEntrada = {
    accessorKey: 'fecha',
    label: 'Fecha',
    movil: 'secundaria',
    render: (valor) => <span className="tabular-nums">{formatearFechaEntrada(String(valor))}</span>,
}

export const columnaProveedor: ColumnaEntrada = {
    accessorKey: 'proveedor_nombre',
    label: 'Proveedor',
    movil: 'secundaria',
    render: (_valor, fila) => <span className="block truncate">{fila.proveedor_nombre ?? '—'}</span>,
}

export const columnaPartidas: ColumnaEntrada = {
    id: 'partidas',
    accessorFn: (e) => e.partidas_count,
    label: 'Productos',
    align: 'derecha',
    movil: 'secundaria',
    // ⭐ MEJORA 22 Sep 2026 — `size` declarado: las columnas de SOLO NÚMEROS no deben comerse el
    // ancho (el kit aplica el `size` de la columna; el espacio sobrante va a las de texto).
    size: 72,
    render: (_valor, fila) => <span>{fila.partidas_count}</span>,
}

export const columnaPiezas: ColumnaEntrada = {
    id: 'piezas',
    accessorFn: (e) => e.piezas_total,
    // ⭐ MEJORA 24 Sep 2026 (usuario) — encabezados SINTETIZADOS (no se quita información):
    // «PZ. RECIBIDAS» → «RECIBIDAS». El dato sigue siendo Σ `cantidad_original`.
    label: 'RECIBIDAS',
    align: 'derecha',
    movil: 'secundaria',
    size: 104,
    render: (_valor, fila) => <span>{fila.piezas_total}</span>,
}

// ⭐ MEJORA 22 Sep 2026 — FUERA el builder del monto agregado (`columnaTotal`): el flujo de
// Entradas cuenta PIEZAS, no dinero (el costo vive en la nota de compra y en el detalle por
// partida). Si una fase futura necesita el monto, se vuelve a declarar aquí.

/**
 * ⭐ MEJORA 23 Sep 2026 (12) — la píldora de la DEV es una **ACCIÓN**: abre la devolución de la
 * entrada (de qué partida y de qué producto declarado se devuelve, con qué motivo y en qué estado)
 * junto con los botones de **ajustar y generar nota**. Se construye con el callback de quien la
 * hospeda — una columna compartida no puede conocer el estado de React —, igual que
 * `crearColumnaFinal` y `crearColumnaNota`.
 */
export function crearColumnaDevolucion(onVerDev?: (fila: Entrada) => void): ColumnaEntrada {
    return {
        id: 'devolucion',
        accessorFn: (e) => e.devolucion_total,
        // ⚠️ 24 Sep 2026 (usuario): se probó «DEVOLUCIÓN» (palabra del piso, ley L7) y la columna
        // robaba ancho horizontal — con la tabla apretada el veredicto fue volver a «DEV».
        label: 'DEV',
        align: 'derecha',
        movil: 'ocultar',
        size: 72,
        render: (_valor, fila) =>
            fila.devolucion_total > 0 ? (
                // La píldora NO cambia de forma (el usuario la aprobó): se envuelve para volverla botón.
                <button
                    type="button"
                    onClick={() => onVerDev?.(fila)}
                    disabled={!onVerDev}
                    title="Ver la devolución: partida, producto, motivo, estado y ajuste."
                    className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-default disabled:hover:opacity-100"
                >
                    <Pildora texto={`−${fila.devolucion_total}`} tono="peligro" />
                </button>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    }
}

/**
 * ⭐ MEJORA 22 Sep 2026 — «Final»: lo que QUEDA después del ajuste (Σ `cantidad_vigente`).
 * ⭐ 3ª pasada (idea del usuario): mientras la DEV está **sin ajustar** la celda no se queda en
 * un aviso — es el **BOTÓN que abre «Ajustar y nota»**, que es justo la acción que resuelve ese
 * estado. Con el ajuste hecho muestra el número (en negrita si hubo DEV).
 * Se construye con el callback de la página (patrón `crearColumnaAcciones`).
 */
export function crearColumnaFinal(onAjustar?: (e: Entrada) => void): ColumnaEntrada {
    return {
        id: 'final',
        accessorFn: (e) => e.piezas_vigentes,
        label: 'Final',
        align: 'derecha',
        movil: 'secundaria',
        // 104px: el ancho lo manda el botón (el `max-w-[110px]` de `secundaria` no lo corta).
        size: 104,
        render: (_valor, fila) => {
            const pendiente = devPendiente(fila)
            if (pendiente && onAjustar) {
                return (
                    <button
                        type="button"
                        onClick={() => onAjustar(fila)}
                        title="La DEV no está ajustada: abre el ajuste y genera la nota de compra."
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5',
                            'text-[10px] font-medium uppercase tracking-wide text-warning transition-colors',
                            'hover:bg-warning/20',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning'
                        )}
                    >
                        <FileText className="size-3 shrink-0" aria-hidden="true" />
                        Ajustar y nota
                    </button>
                )
            }
            return (
                <span
                    className={cn('tabular-nums', fila.devolucion_total > 0 && 'font-medium')}
                    title={pendiente ? 'La DEV todavía no se ajusta: esta es la cantidad vigente hoy.' : undefined}
                >
                    {fila.piezas_vigentes}
                </span>
            )
        },
    }
}

/**
 * ⭐ MEJORA 22 Sep 2026 — la píldora de la nota es una ACCIÓN (abrir la nota), y una columna
 * compartida no puede saber del estado de React: se construye con el callback de quien la
 * hospeda — Recepción y Alta —, igual que `crearColumnaFinal`.
 *
 * El destino NO es otra página: se monta `NotaCompraDetalleModal` (dueño: Guía 1.4), la ficha
 * completa con sus acciones (pagar · cancelar · editar) y su RBAC. Consultar una nota no debe
 * costar el estado de la tabla que se está trabajando.
 *
 * ⭐ MEJORA 24 Sep 2026 (usuario) — la nota **pesa**: es lo que se paga y no puede perderse entre
 * las cifras. Pasa de píldora gris neutra a **botón en tinta del primario** (`primary-bg` +
 * `primary`): sigue al tema de cada paleta (oro · turquesa · terracota) sin usar el relleno
 * sólido, que queda reservado a la acción que avanza el flujo. ⚠️ NO se usa `acc-entradas`: ese
 * acento es **azul en las 3 paletas** y el usuario lo rechazó por eso — la nota además es de
 * **Compras**, no de Entradas, y el tono del tema lo dice sin gritar.
 *
 * ⭐ FIX 24 Sep 2026 (usuario) — **la celda también dice cuando FALTA la nota**: si la entrada ya
 * está lista para cerrar (`revisada_sin_dev` · `con_dev`) y todavía no tiene nota, la celda ofrece
 * la píldora **«Crear»** en tono `info` (azul) que abre el **mismo modal** donde se genera
 * (`AjusteDevModal`). Así la columna deja de estar en «—» justo cuando hay algo que hacer, y el
 * color distingue *generar* de *consultar*.
 */
export function crearColumnaNota(
    onVerNota?: (fila: Entrada) => void,
    /** Abre el modal que GENERA la nota (el de la DEV). Sin él, la celda no ofrece «Crear». */
    onCrear?: (fila: Entrada) => void
): ColumnaEntrada {
    return {
        id: 'nota',
        accessorFn: (e) => e.nota_folio ?? '',
        // ⭐ MEJORA 24 Sep 2026 (usuario) — «Nota de compra» → «NOTA» (sintetizar el encabezado,
        // no la información: el folio NC-#### sigue en la celda).
        label: 'NOTA',
        movil: 'ocultar',
        render: (_valor, fila) => {
            if (fila.nota_folio && fila.id_nota) {
                return (
                    <button
                        type="button"
                        onClick={() => onVerNota?.(fila)}
                        disabled={!onVerNota}
                        title={`Ver la nota de compra ${fila.nota_folio} sin salir de esta página`}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-primary/45 bg-primary-bg px-2 py-0.5',
                            'font-mono text-[10px] text-primary transition-colors',
                            'hover:bg-primary/20',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            'disabled:cursor-default disabled:hover:bg-primary-bg'
                        )}
                    >
                        <FileText className="size-3 shrink-0" aria-hidden="true" />
                        {fila.nota_folio}
                    </button>
                )
            }
            // Falta la nota y la entrada ya se puede cerrar → aquí se GENERA.
            if (onCrear && pendienteDeRecepcion(fila)) {
                const conDev = fila.estado === 'con_dev'
                return (
                    <button
                        type="button"
                        onClick={() => onCrear(fila)}
                        title={
                            conDev
                                ? 'Ajustar la devolución y generar la nota de compra'
                                : 'Generar la nota de compra (esta entrada no tuvo devoluciones)'
                        }
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-info/35 bg-info/10 px-2 py-0.5',
                            'font-mono text-[10px] uppercase tracking-wide text-info transition-colors',
                            'hover:bg-info/20',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info'
                        )}
                    >
                        <FileText className="size-3 shrink-0" aria-hidden="true" />
                        Crear
                    </button>
                )
            }
            return <span className="text-muted-foreground">—</span>
        },
    }
}

export const columnaResultado: ColumnaEntrada = {
    id: 'resultado',
    accessorFn: (e) => e.resultado_rev ?? '',
    label: 'Resultado',
    movil: 'ocultar',
    render: (_valor, fila) =>
        fila.resultado_rev === 'CON_MALAS' ? (
            <Pildora texto="Con malas" tono="peligro" />
        ) : fila.resultado_rev === 'SIN_MALAS' ? (
            <Pildora texto="Sin malas" tono="exito" />
        ) : (
            <span className="text-muted-foreground">—</span>
        ),
}

export const columnaEstado: ColumnaEntrada = {
    accessorKey: 'estado',
    label: 'Estado',
    movil: 'critica',
    render: (_valor, fila) => (
        <Pildora texto={TEXTO_ESTADO_ENTRADA[fila.estado]} tono={TONO_ESTADO_ENTRADA[fila.estado]} />
    ),
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — EL ESTADO EN EL IDIOMA DE LA ETAPA
//
// La cola del técnico no se lee con el estado del DOCUMENTO: «Recién creada» no dice que la
// fila **le toca a él**, ni **desde cuándo** — y una entrada puede llevar 3 días ahí con el
// mismo gris que una recién capturada (caso real `ING-0001`, 21 Sep; reporte del usuario:
// *«puede decir así pero lleva 3 días ahí»*). Mientras la fila está EN COLA, el tono lo manda
// la ANTIGÜEDAD. Umbrales y diseño: `DOCS/design/entradas/revision-puesto-tactil.html` §1.
// ═══════════════════════════════════════════════════════════════════════════════

const DIA_MS = 86_400_000

/**
 * Días completos que la entrada lleva esperando. Se mide desde **`fecha`** (cuándo llegó la
 * mercancía), no desde `created_at`: la cola del piso arranca cuando llega el camión, no cuando
 * alguien alcanzó la computadora a capturarla.
 */
export function diasEnCola(fecha: string, hoy: Date = new Date()): number {
    const f = new Date(fecha)
    if (Number.isNaN(f.getTime())) return 0
    return Math.max(0, Math.floor((hoy.getTime() - f.getTime()) / DIA_MS))
}

/** Umbrales aprobados: 0–1 día → `info` · 2 → `advertencia` · ≥3 → `peligro` **y late**. */
export function urgenciaDeCola(dias: number): { tono: TonoPildora; pulsa: boolean } {
    if (dias >= 3) return { tono: 'peligro', pulsa: true }
    if (dias === 2) return { tono: 'advertencia', pulsa: false }
    return { tono: 'info', pulsa: false }
}

/** «hoy» · «1 d» · «3 d» — corto a propósito: el ancho de la celda es de todos. */
export function textoAntiguedad(dias: number): string {
    return dias === 0 ? 'hoy' : `${dias} d`
}

/**
 * Columna de estado de la **cola de Revisión**.
 * · En cola (`recien_creada` · `lista_para_revision`) → verbo de la etapa + antigüedad, y el
 *   tono escala con los días: es la señal de urgencia que faltaba.
 * · `en_revision` → «En revisión · 9/12»: el avance REAL (aprobadas + devueltas sobre declarado),
 *   para que cualquiera vea si el turno va a medias sin abrir el desglose.
 * · El resto habla la etapa («Cerrada», «Otra etapa», «Bloqueada»), no el documento.
 *
 * ⚠️ SSR: la fila solo se pinta con los datos que llegan en el `useEffect` (cliente), así que
 * «hoy» no puede provocar desajuste de hidratación.
 */
export const columnaEstadoRevision: ColumnaEntrada = {
    id: 'estado',
    accessorFn: (e) => e.estado,
    label: 'Estado',
    movil: 'critica',
    render: (_valor, fila) => {
        if (fila.estado === 'en_revision') {
            const revisadas = fila.piezas_aprobadas + fila.devolucion_total
            return (
                <Pildora
                    texto={`En revisión · ${revisadas}/${fila.piezas_total}`}
                    tono={TONO_ETAPA_REVISION.en_revision}
                />
            )
        }
        // ⭐ MEJORA 32 (25 Sep 2026 · usuario) — **«Cerrada · con DEV» afirmaba un cierre que no
        // existe** mientras queden piezas aprobadas sin liberar. El usuario, sobre una entrada ya
        // revisada del todo: *«si bien ya se revisó todo, aún no se libera todo… y el estado dice
        // "cerrada con dev" pero aún no está cerrada del todo»*.
        //
        // ⚠️ **El pendiente NO es un estado, es una CANTIDAD.** La liberación es un camino PARALELO
        // (decisión 22 / R23: *«la entrada NO cambia de estado: es un camino paralelo»*), y el
        // mockup lo cerró igual (*«el universo de estados no tiene un estado intermedio de
        // liberación»*): puedes tener 3 de 50, 12 de 14 o 14 de 14 — un estado tendría que ser
        // cierto para cualquier `0 < saldo ≤ aprobadas`, o sea no describe un momento del documento.
        // Un estado nuevo costaría además ~35 referencias en 8 archivos + `transiciones_etapa` y su
        // RLS por etapa. Así que se dice la **acción pendiente de la etapa**, como el resto de las
        // colas («Revisar», «Generar nota»): el saldo ya viaja en la fila.
        const porLiberar = Math.max(0, fila.piezas_aprobadas - fila.piezas_liberadas)
        if (porLiberar > 0 && (fila.estado === 'revisada_sin_dev' || fila.estado === 'con_dev')) {
            return (
                <Pildora
                    texto={`Por liberar (${porLiberar})${fila.estado === 'con_dev' ? ' · con DEV' : ''}`}
                    tono={TONO_ETAPA_REVISION[fila.estado]}
                />
            )
        }
        const enCola = fila.estado === 'recien_creada' || fila.estado === 'lista_para_revision'
        if (!enCola) {
            return (
                <Pildora
                    texto={TEXTO_ETAPA_REVISION[fila.estado]}
                    tono={TONO_ETAPA_REVISION[fila.estado]}
                />
            )
        }
        const dias = diasEnCola(fila.fecha)
        const { tono, pulsa } = urgenciaDeCola(dias)
        return (
            <Pildora
                texto={`${TEXTO_ETAPA_REVISION[fila.estado]} · ${textoAntiguedad(dias)}`}
                tono={tono}
                className={pulsa ? 'animate-pulse' : undefined}
            />
        )
    },
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 24 Sep 2026 (Fase 1 · Recepción) — EL ESTADO EN EL IDIOMA DE LA ETAPA
//
// Réplica del de Revisión (`columnaEstadoRevision`, arriba) con DOS diferencias deliberadas:
//   ① `en_revision` («En revisión técnica») es una **PUERTA**: la píldora se envuelve para abrir el
//      avance de la revisión en solo lectura (la misma tabla de ítems de la Fase 2). Recepción no
//      revisa, pero necesita saber cuánto lleva el técnico sin salir de su cola.
//   ② la cola de Recepción no es pasiva. Lo que está en `revisada_sin_dev`/`con_dev` es una
//      **acción que el recepcionista debe cerrar** (ajustar + generar la nota), así que nunca se
//      pinta «info»: arranca en `advertencia` y a los ≥3 días pasa a `peligro` **y late**. Caso
//      vivo: `ING-0001` lleva 3 días esperando ese cierre.
// Se construye con el callback de quien la hospeda (patrón `crearColumnaDevolucion`).
// Diseño: `DOCS/design/entradas/recepcion-puesto-tactil.html` §1.
// ═══════════════════════════════════════════════════════════════════════════════

/** ¿La entrada está pendiente DE RECEPCIÓN? (revisada, sin nota → hay que ajustar y generar). */
export function pendienteDeRecepcion(e: Entrada): boolean {
    return e.estado === 'revisada_sin_dev' || e.estado === 'con_dev'
}

export function crearColumnaEstadoRecepcion(
    onVerAvanceRevision?: (fila: Entrada) => void
): ColumnaEntrada {
    return {
        id: 'estado',
        accessorFn: (e) => e.estado,
        label: 'Estado',
        movil: 'critica',
        render: (_valor, fila) => {
            // ⭐ MEJORA 24 Sep 2026 (usuario) — «En revisión técnica» es una PUERTA: Recepción no
            // revisa, pero necesita saber cuánto lleva el técnico sin salir de su cola. Abre el
            // avance en SOLO LECTURA con la MISMA tabla de ítems que despliega la Fase 2
            // (`AvanceRevisionModal` + `PartidasAvance`).
            if (fila.estado === 'en_revision') {
                // La píldora NO cambia de forma (precedente MEJORA 12): se envuelve para volverla botón.
                return (
                    <button
                        type="button"
                        onClick={() => onVerAvanceRevision?.(fila)}
                        disabled={!onVerAvanceRevision}
                        title="Ver el avance de la revisión: partida, producto, aprobadas, DEV y pendientes."
                        aria-label={`${TEXTO_ETAPA_RECEPCION.en_revision} · ver el avance de ${fila.folio}`}
                        className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning disabled:cursor-default disabled:hover:opacity-100"
                    >
                        <Pildora
                            texto={TEXTO_ETAPA_RECEPCION[fila.estado]}
                            tono={TONO_ETAPA_RECEPCION[fila.estado]}
                        />
                    </button>
                )
            }
            if (!pendienteDeRecepcion(fila)) {
                return (
                    <Pildora
                        texto={TEXTO_ETAPA_RECEPCION[fila.estado]}
                        tono={TONO_ETAPA_RECEPCION[fila.estado]}
                    />
                )
            }
            const dias = diasEnCola(fila.fecha)
            const { tono, pulsa } = urgenciaDeCola(dias)
            // Lo que ME toca nunca es «info»: el piso de urgencia de una tarea propia es `advertencia`.
            const tonoFinal: TonoPildora = tono === 'info' ? 'advertencia' : tono
            // ⚠️ 24 Sep 2026 (usuario): «que no diga el tiempo en días en la píldora» → el número sale
            // de la vista (ocupaba ancho en una columna de todos) y queda en el `title`. La antigüedad
            // NO se pierde: sigue mandando el TONO y el latido de los ≥3 días.
            return (
                <span
                    title={
                        dias === 0
                            ? 'Llegó hoy y espera el cierre de Recepción'
                            : `Lleva ${dias} día${dias === 1 ? '' : 's'} esperando el cierre de Recepción`
                    }
                >
                    <Pildora
                        texto={TEXTO_ETAPA_RECEPCION[fila.estado]}
                        tono={tonoFinal}
                        className={pulsa ? 'animate-pulse' : undefined}
                    />
                </span>
            )
        },
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — EL AVANCE DE LA ETAPA CON BARRA (③)
//
// El usuario lo pidió explícito: *«en la evolución igual usar barras de avance también»* — como
// Recepción, que ya lee `Recibidas · DEV · Final` con número + barra.
//
// ⚠️ Vive aquí (helpers del MÓDULO) y no en cada componente porque la usan DOS superficies de la
// misma fase: la cola (`columnaAvanceRevision`) y el desglose por partida (`PartidasRevision`).
// Recepción tiene su propia `Proporcion` de 2 tramos dentro de `PartidasExpandidas`: unificarlas
// sería un refactor de una superficie ya validada — no se toca sin pedirlo (queda anotado).
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Barra de 3 tramos: **aprobadas** (verde) · **DEV** (rojo) · **faltan** (ámbar).
 * El tramo rojo lleva `minWidth` para que «−1 de 200» siga siendo visible sin exagerar su
 * proporción; el ámbar es el tramo que Recepción no tiene (allá la mercancía ya llegó toda).
 *
 * ⭐ MEJORA 25 — cuarto tramo **liberadas** (`chart-4`): las aprobadas que ya salieron como tanda
 * hacia Acondicionamiento. Se pinta DENTRO de las aprobadas (una liberada sigue estando aprobada),
 * por eso el verde se parte en dos tonos en vez de sumar un segmento aparte.
 * `--chart-4` es la única familia de color que no choca con los semánticos (SPEC §2.7).
 */
export function BarraAvance({
    aprobadas,
    dev,
    total,
    liberadas = 0,
    className,
}: {
    aprobadas: number
    dev: number
    total: number
    /** ⭐ MEJORA 25 — subconjunto de `aprobadas` que ya tiene tanda. */
    liberadas?: number
    className?: string
}) {
    const pendientes = Math.max(0, total - aprobadas - dev)
    const enMano = Math.max(0, aprobadas - liberadas)
    const base = Math.max(total, 1)
    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-flex h-1.5 w-[64px] shrink-0 overflow-hidden rounded-full bg-border',
                className
            )}
        >
            {enMano > 0 && (
                <span className="block h-full bg-success" style={{ width: `${(enMano / base) * 100}%` }} />
            )}
            {liberadas > 0 && (
                <span
                    className="block h-full bg-chart-4"
                    style={{ width: `${(liberadas / base) * 100}%` }}
                    title={`${liberadas} ya liberadas a acondicionamiento`}
                />
            )}
            {dev > 0 && (
                <span
                    className="block h-full bg-destructive"
                    style={{ width: `${(dev / base) * 100}%`, minWidth: 5 }}
                />
            )}
            {pendientes > 0 && (
                <span
                    className="block h-full bg-warning/55"
                    style={{ width: `${(pendientes / base) * 100}%` }}
                />
            )}
        </span>
    )
}

/**
 * El avance de la ENTRADA en la cola de Revisión: «9/12» + barra de tramos, en **UNA línea**.
 * Sustituye a la columna `RECIBIDAS` en esta fase: al técnico no le dice nada cuántas llegaron, le
 * dice **cuánto lleva revisado** de lo que llegó; y la barra muestra de un vistazo cuánto de eso ya
 * salió como tanda (el tramo `chart-4` = liberadas, con su `title`).
 *
 * ⚠️ 25 Sep 2026 (usuario) — AQUÍ vivió la píldora **«n listas»** (aprobadas **sin liberar**) que
 * abría el modal de liberación. **Se retira de la celda:** apilaba una SEGUNDA línea y, como el
 * alto de la fila lo manda su celda más alta, *«al mostrar ahí 2 datos se hace muy alta la fila»*.
 * Es el mismo síntoma que la SPEC §2.5 ya tenía escrito para Recepción (*«filas muy grandes, ya no
 * parece tabla»*). La **acción** se movió a la columna **Acción** de la fila —y sigue en el desglose
 * y en el pie del wizard: dos puertas, una superficie—, así que la función no se pierde; y el dato
 * tampoco: el tramo liberado de la barra dice lo mismo sin abrir nada.
 */
export const columnaAvanceRevision: ColumnaEntrada = {
    id: 'avance',
    accessorFn: (e) => e.piezas_aprobadas,
    label: 'AVANCE',
    movil: 'critica',
    // 132px: la cifra + la barra de 64px, en una línea (antes 160 por la segunda línea).
    size: 132,
    render: (_valor, fila) => {
        const revisadas = fila.piezas_aprobadas + fila.devolucion_total
        return (
            <span className="flex items-center justify-center gap-2">
                <span className="tabular-nums">
                    {revisadas}
                    <span className="text-muted-foreground">/{fila.piezas_total}</span>
                </span>
                <BarraAvance
                    aprobadas={fila.piezas_aprobadas}
                    dev={fila.devolucion_total}
                    total={fila.piezas_total}
                    liberadas={fila.piezas_liberadas}
                />
            </span>
        )
    },
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 25/27 — COLUMNAS DE LA BANDEJA (cola de Acondicionamiento y de Almacén)
//
// El usuario, mirando la tabla de Acondicionamiento: *«la tabla solo dice partidas y recibidas»*.
// Estas columnas cambian el sujeto: ya no es la ENTRADA con su total llegado, es la **BANDEJA** —
// qué producto, de qué partida y cuántas piezas se van a limpiar.
//
// ⭐ MEJORA 27 (decisión 22.g) — antes la fila era **una tanda**. El usuario: *«como una bandeja
// donde si van entregando de revisión ahí se van agrupando si vienen de la misma entrada misma
// partida»*. Medido en `ING-0001`: la partida 1 liberó dos tandas del mismo ADATA 1TB (4 + 2) y la
// cola las mostraba como DOS filas. Ahora la fila acumula y dice **cuántas tandas** la componen.
//
// ⚠️ Decisión del usuario (24 Sep): **la autoría y la fecha de la liberación NO se pintan**. No son
// un dato para el acondicionador; viven en la bitácora y en el detalle de Revisión.
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 28 (25 Sep 2026 · decisión 22.h) — LA PARTIDA SE LEE COMO SUS HUELLAS
//
// El usuario: *«sigo viendo que en detalles solo una partida cuando ahí ya debieron nacer 2
// partidas … y cada una evolucionar como si hubiera nacido desde entradas»*.
//
// El MODELO no se toca: `partidas_entrada` es la DECLARACIÓN y su `cantidad_original` es inmutable
// (R7) — es el respaldo del ajuste y de la DEV. Lo que cambia es la LECTURA: una partida declarada
// se muestra como **N líneas**, una por huella resuelta, y como **una** mientras no tenga huellas.
//
// Reutilizable a propósito: lo consumen los DOS desgloses (Revisión `PartidasAvance` y Recepción
// `PartidasExpandidas`) — dos tablas distintas para el mismo avance serían dos maneras de mentir.
// ═══════════════════════════════════════════════════════════════════════════════

/** Una fila del desglose: la fila de PARTIDA, o un producto (huella) de esa partida. */
export interface LineaPartida {
    /** `partidaId|partida` en la fila de partida · `partidaId|huella` en la de producto. */
    key: string
    /**
     * ⭐ MEJORA 30 (25 Sep 2026 · usuario) — **`true` en la fila de PARTIDA**: la dueña de lo que NO
     * tiene huella (lo declarado, lo que falta por revisar, el estado y las acciones de la partida).
     * Antes esos datos colgaban de la PRIMERA fila de producto y se leían como de esa marca:
     * *«el botón iniciar está colocado en la fila 1 como si dijera que falta revisar de esa marca»*.
     */
    esPartida: boolean
    /** Consecutivo 1..N de la ENTRADA (`0` en la fila de partida: no es un producto). */
    numero: number
    partida: PartidaConAvance
    /**
     * La huella **resuelta** de esta línea: el grupo que se libera (`id_partida_resuelta`). `null` =
     * la partida todavía no tiene revisión (se pinta lo declarado) **o** la línea nace de una **DEV
     * sin nada aprobado** — que desde la MEJORA 29 también es una línea.
     */
    huella: HuellaResuelta | null
    /** El producto de la línea: la marca de su huella, o la de la pieza devuelta. */
    marcaNombre: string | null
    atributos: Record<string, unknown>
    /** ⭐ MEJORA 29 — piezas APROBADAS de esta línea (0 en la fila de partida). */
    aprobadas: number
    /** ⭐ MEJORA 29 — piezas DEVUELTAS de esta línea (la DEV ya viene atribuida por huella). */
    dev: number
    /** ⭐ MEJORA 29 — ¿esa DEV ya tiene `fecha_ajuste`? */
    devAjustada: boolean
    /** De las aprobadas, cuántas ya salieron a limpieza (en cualquiera de sus tandas). */
    liberadas: number
    /**
     * ⭐ MEJORA 29 — las piezas **de esta fila**: `aprobadas + dev`. En la fila de partida son las
     * **declaradas** en recepción, porque todavía no hay nada que repartir; en la línea declarada
     * (partida sin revisar) también.
     */
    recibidas: number
    /** `true` cuando la partida aún no tiene huellas: la línea es lo DECLARADO en recepción. */
    declarada: boolean
    /** ¿la partida rinde más de un producto? (atenúa el `#` de sus filas de producto) */
    partidaMultiple: boolean
}

/**
 * Aplana las partidas declaradas en las FILAS que el usuario ve.
 *
 * ⭐ MEJORA 30 (25 Sep 2026 · usuario) — **la partida es una FILA**. Cierra las cuatro vueltas del
 * desglose, y la cuarta es la que el usuario pidió:
 *
 *  1. Se **repetía** todo en cada línea («opción A»): una partida de 2 marcas mostraba la misma barra
 *     y el mismo «1 mala» dos veces, como si cada producto tuviera su propia DEV.
 *  2. Se dijo **una sola vez**, en la línea que ABRE la partida: el desglose dejó de poder leerse por
 *     producto — justo lo contrario de para lo que existe.
 *  3. **Cada línea dice la suya y el padre es la suma de sus líneas** (MEJORA 29), pero lo que es de
 *     la PARTIDA (`Faltan`, `Estado`, las acciones de revisión) seguía viviendo en la fila de la
 *     **primera marca** → *«como si dijera que falta revisar de esa marca»*.
 *  4. Ahora hay **dos tipos de fila**: la de PARTIDA (lo declarado · `Recib.` declaradas · `Faltan` ·
 *     `Estado` · las acciones de la partida) y las de PRODUCTO (su `Recib.`, su avance, su `DEV`, su
 *     `Liberar n`). **Las mismas columnas en los dos niveles**, así que se sigue comparando en
 *     vertical — que es para lo que existe una tabla.
 *
 * Orden: **partida → sus productos**. El `numero` consecutivo (el que usará la nota de compra) solo
 * avanza en las filas de producto.
 */
export function lineasDePartidas(partidas: PartidaConAvance[]): LineaPartida[] {
    const out: LineaPartida[] = []
    let numero = 0
    for (const p of partidas) {
        // La partida se lee como la UNIÓN de sus huellas: las que aprobaron algo y las que solo
        // tienen DEV. Sin ninguna de las dos, la fila de producto es lo declarado (sin revisar).
        const huellas: (HuellaResuelta | null)[] =
            p.huellas.length > 0 ? p.huellas : p.devs.length > 0 ? [] : [null]
        const totalLineas = huellas.length + p.devs.length
        out.push({
            key: `${p.id}|partida`,
            esPartida: true,
            numero: 0,
            partida: p,
            huella: null,
            marcaNombre: null,
            atributos: p.atributos ?? {},
            aprobadas: 0,
            dev: 0,
            devAjustada: false,
            liberadas: 0,
            recibidas: Number(p.cantidad_original ?? 0),
            declarada: false,
            partidaMultiple: totalLineas > 1,
        })
        for (const h of huellas) {
            numero += 1
            out.push({
                key: `${p.id}|${h?.id_partida_resuelta ?? 'declarada'}`,
                esPartida: false,
                numero,
                partida: p,
                huella: h,
                marcaNombre: h?.marca_nombre ?? null,
                atributos: h?.atributos ?? {},
                aprobadas: h?.cantidad_aprobada ?? 0,
                dev: h?.cantidad_devuelta ?? 0,
                devAjustada: h?.dev_ajustada ?? false,
                liberadas: h?.cantidad_liberada ?? 0,
                recibidas: (h?.cantidad_aprobada ?? 0) + (h?.cantidad_devuelta ?? 0),
                declarada: h === null,
                partidaMultiple: totalLineas > 1,
            })
        }
        for (const d of p.devs) {
            numero += 1
            out.push({
                key: `${p.id}|dev:${claveLinea(d.id_marca, d.atributos)}`,
                esPartida: false,
                numero,
                partida: p,
                huella: null,
                marcaNombre: d.marca_nombre,
                atributos: d.atributos,
                aprobadas: 0,
                dev: d.cantidad,
                devAjustada: d.ajustada,
                liberadas: 0,
                recibidas: d.cantidad,
                declarada: false,
                partidaMultiple: totalLineas > 1,
            })
        }
    }
    return out
}

/** El producto de una fila: lo declarado en la de partida, o la huella en la de producto. */
export function productoDeLinea(l: LineaPartida): string {
    if (l.esPartida || l.declarada) {
        return huellaDeclarada(l.partida.categoria_nombre, l.partida.atributos)
    }
    return [l.partida.categoria_nombre, l.marcaNombre, valoresAtributos(l.atributos)]
        .filter(Boolean)
        .join(' · ')
}

/** La cantidad de la línea: lo aprobado de su huella, o lo declarado mientras no haya huellas. */
export function cantidadDeLinea(l: LineaPartida): number {
    return l.declarada ? l.partida.cantidad_original : l.aprobadas
}

export type ColumnaBandeja = ColumnDef<BandejaLiberada> & ColumnDefExtension<BandejaLiberada>

/** El producto de la bandeja: la huella (categoría + marca + atributos). */
export function productoDeBandeja(b: BandejaLiberada): string {
    return [b.categoria_nombre, b.marca_nombre, valoresAtributos(b.atributos)]
        .filter(Boolean)
        .join(' · ')
}

/** De dónde salió: «PARTIDA 1 · 6 PIEZAS · 2 TANDAS». Lo que el acondicionador necesita del origen. */
export function origenDeBandeja(b: BandejaLiberada): string {
    const partes = [`PARTIDA ${b.partida_numero ?? '—'}`, `${b.piezas} PIEZAS`]
    if (b.tandas.length > 1) partes.push(`${b.tandas.length} TANDAS`)
    return partes.join(' · ')
}

/**
 * «T2» o «T2 + T3» — las tandas que la componen, sin robar ancho cuando son muchas.
 * ⭐ MEJORA 31 (25 Sep 2026) — deja de ser privada: la sub-tabla hija de la cola agrupada
 * (`BandejasDeIngreso`) pinta la misma celda, y el folio del ingreso ya vive en la fila PADRE
 * (antes se repetía aquí como «T1 · ING-0003» en cada fila).
 */
export function foliosDeBandeja(b: BandejaLiberada): string {
    const orden = [...b.tandas].sort((x, y) => x - y)
    if (orden.length <= 2) return orden.map((n) => `T${n}`).join(' + ')
    return `T${orden[0]}–T${orden[orden.length - 1]}`
}

export const columnaBandejaFolio: ColumnaBandeja = {
    id: 'tanda',
    accessorFn: (b) => b.tandas[0] ?? 0,
    label: 'Tanda',
    movil: 'critica',
    size: 140,
    render: (_v, b) => (
        <span className="font-mono text-[13px]" title={b.tandas.map((n) => `T${n}`).join(' · ')}>
            <b>{foliosDeBandeja(b)}</b>
            <span className="text-muted-foreground"> · {b.entrada_folio}</span>
        </span>
    ),
}

export const columnaBandejaProducto: ColumnaBandeja = {
    id: 'producto',
    accessorFn: (b) => productoDeBandeja(b),
    label: 'Producto',
    movil: 'critica',
    size: 320,
    render: (_v, b) => (
        <span className="grid gap-0.5">
            <span className="font-semibold">{productoDeBandeja(b) || 'Sin huella'}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                {origenDeBandeja(b)}
            </span>
        </span>
    ),
}

export const columnaBandejaPiezas: ColumnaBandeja = {
    id: 'piezas',
    accessorFn: (b) => b.piezas,
    label: 'Piezas',
    align: 'centro',
    movil: 'critica',
    size: 96,
    render: (_v, b) => <span className="text-[16px] font-bold tabular-nums">{b.piezas}</span>,
}

/** El estado en el idioma del puesto (L1): «Por limpiar», no el nombre interno `por_limpiar`. */
export const columnaBandejaEstado: ColumnaBandeja = {
    id: 'estado',
    accessorFn: (b) => b.estado,
    label: 'Estado',
    align: 'centro',
    movil: 'critica',
    size: 170,
    render: (_v, b) => <Pildora texto={TEXTO_ESTADO_TANDA[b.estado]} tono={TONO_ESTADO_TANDA[b.estado]} />,
}

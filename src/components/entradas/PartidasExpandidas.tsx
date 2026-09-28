'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS EXPANDIDAS — contenido de la fila expandible (Guía 1.6 · Recepción)
// Primer consumidor de `DataTable.renderFilaExpandida` (PROMOCIÓN 20 Sep): muestra
// las PARTIDAS de la entrada dentro de su propia fila, sin abrir el expediente.
//
// ⭐ MEJORA 22 Sep 2026 (Fase 1 · Recepción) — evolución del ingreso + la DEV **real** de
// `devoluciones_entrada` (`dev_cantidad`) con su estado (`dev_ajustada`).
//
// ⭐ MEJORA 24 Sep 2026 (usuario) — el desglose dejó de apilar tres bloques (chips + timeline +
// tabla anidada con su propio «Costo»): ahora es **una sola tabla de partidas alineada** —
// un encabezado, números en columna — más el timeline en una línea con los totales en texto.
//   · la cantidad NO se dibuja con una barra por pieza (con 200 piezas no escala): números
//     (`Recibidas` · `DEV` · `Final`) + **barra de proporción**, que se lee igual con 5 o 200;
//   · el **producto** es la huella declarada (categoría + atributos de recepción): una pieza
//     devuelta no tiene SKU, lo resuelve Almacén y solo para lo aprobado;
//   · 2ª pasada del mismo día (usuario): encabezados **sintetizados** («#», «Producto»,
//     «Recib.»), **sin negritas** en las celdas y las acciones **contraídas en un menú ⋯**
//     — antes eran botones/iconos inline y se veían amontonados.
// ⚠️ El menú abre el MISMO modal de la DEV (`AjusteDevModal`): un Dialog que se abre en el
// mismo tick en que cierra un menú deja su overlay fantasma (Radix), así que la apertura va
// **diferida 160 ms** — el patrón que el proyecto ya documentó en `NotasCompraCatalogo`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { FileText, Printer, Workflow } from 'lucide-react'

import { BotonDespliegue, CLASE_CAJA_TABLA, CLASE_THEAD_TABLA, CLASE_TH_TABLA, Pildora } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { listarPartidasConAvance } from '@/lib/actions/entradas'
import {
    devPendiente,
    formatearFechaEntrada,
    formatearMXNEntrada,
    lineasDePartidas,
    productoDeLinea,
} from '@/components/entradas/columnas-entrada'
import { cn } from '@/lib/utils'
import type { Entrada, EstadoPartida, PartidaConAvance } from '@/types/entradas'
import {
    TEXTO_ESTADO_PARTIDA,
    TEXTO_ETAPA_RECEPCION,
    TONO_ETAPA_RECEPCION,
} from '@/types/entradas'

/** Un hito del timeline: la fecha ya formateada, o `—` si esa etapa no ocurrió. */
function Hito({ etiqueta, fecha }: { etiqueta: string; fecha: string | null }) {
    const hecha = Boolean(fecha)
    return (
        <span className="inline-flex items-center gap-1.5">
            <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', hecha ? 'bg-acc-entradas' : 'bg-border')}
            />
            <span
                className={cn(
                    'font-mono text-[10px] uppercase tracking-[0.12em]',
                    hecha ? 'text-foreground/80' : 'text-muted-foreground/70'
                )}
            >
                {etiqueta}
            </span>
            <span
                className={cn(
                    'text-[13px] tabular-nums',
                    hecha ? 'text-foreground' : 'text-muted-foreground/50'
                )}
            >
                {hecha ? formatearFechaEntrada(fecha as string) : '—'}
            </span>
        </span>
    )
}

/**
 * ⭐ Barra de PROPORCIÓN (no una barra por pieza): final vs DEV sobre lo declarado. El tramo
 * rojo lleva `minWidth` para que `−1 de 200` siga siendo visible sin exagerar la proporción.
 */
function Proporcion({ final, dev, total }: { final: number; dev: number; total: number }) {
    const base = Math.max(total, final + dev, 1)
    return (
        <span
            aria-hidden="true"
            className="inline-flex h-1.5 w-[64px] shrink-0 overflow-hidden rounded-full bg-border"
        >
            <span className="block h-full bg-success" style={{ width: `${(final / base) * 100}%` }} />
            {dev > 0 && (
                <span
                    className="block h-full bg-destructive"
                    style={{ width: `${(dev / base) * 100}%`, minWidth: 5 }}
                />
            )}
        </span>
    )
}

/** Estado de la partida cuando NO hay DEV (si la hay, manda el estado de la DEV). */
const TONO_PARTIDA: Record<EstadoPartida, 'neutro' | 'listo' | 'peligro'> = {
    PENDIENTE: 'neutro',
    OK: 'listo',
    MAL: 'peligro',
}

/** Los encabezados, cortos: el dato no se toca, la etiqueta se sintetiza.
 *  ⭐ MEJORA 26 Sep 2026 — la piel viene del kit (`estilos-tabla`): la MISMA banda, la misma
 *  regla de 2px y las mismas versalitas que el encabezado de la tabla madre. */
const TH = cn(CLASE_TH_TABLA, 'px-2.5 py-1.5')

export function PartidasExpandidas({
    entrada,
    onAjustar,
    onVerEtapas,
    onVerNota,
    onImprimir,
    onExpandida,
}: {
    entrada: Entrada
    /** Abre el modal de la DEV (ver + ajustar + generar nota) para esta entrada. */
    onAjustar?: (e: Entrada) => void
    /** ⭐ MEJORA 27 Sep 2026 — abre «Etapas del ingreso»: las 4 etapas, en solo lectura. */
    onVerEtapas?: (e: Entrada) => void
    /** ⭐ MEJORA 27 Sep 2026 — abre la nota de compra (solo si ya se generó). */
    onVerNota?: (e: Entrada) => void
    /** ⭐ MEJORA 27 Sep 2026 — imprime la nota de entrada de ESTA entrada (el papel de Recepción). */
    onImprimir?: (e: Entrada) => void
    /** ⭐ MEJORA 27 Sep 2026 — avisa a la página cuál es la fila abierta (su toolbar imprime la nota). */
    onExpandida?: (e: Entrada) => void
}) {
    // ⭐ MEJORA 28 (decisión 22.h) — la MISMA fuente que el desglose de Revisión
    // (`listarPartidasConAvance`): con las huellas se puede mostrar una línea por producto. Antes
    // usaba `listarPartidasEntrada`, que solo devuelve lo DECLARADO — por eso Recepción seguía
    // viendo «una partida» cuando la revisión ya había abierto dos marcas.
    const [partidas, setPartidas] = useState<PartidaConAvance[]>([])
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        let activo = true
        void listarPartidasConAvance(entrada.id).then((r) => {
            if (!activo) return
            if (r.success) setPartidas(r.data ?? [])
            setCargando(false)
            // ⭐ MEJORA 27 Sep 2026 — la página necesita saber cuál es la fila ABIERTA: su toolbar
            // (la del shell) imprime la nota de ESA entrada. El callback es el `setState` del padre
            // (estable), así que no re-dispara el efecto.
            onExpandida?.(entrada)
        })
        return () => {
            activo = false
        }
    }, [entrada, onExpandida])

    /** ¿La entrada está en el paso donde el ajuste + la nota ya se pueden generar? */
    const puedeAjustar = devPendiente(entrada) && Boolean(onAjustar)

    // ═══════════════════════════════════════════════════════════════════════════
    // ⭐ MEJORA 26 Sep 2026 — LA PARTIDA SE DESPLIEGA (decisión del usuario)
    //
    // *«en la tabla de los detalles sale el padre, por ejemplo donde dice PARTIDA 1, y no se
    // distingue que lo de abajo son sus subpartidas; que deberían tener el mismo funcionamiento:
    // otro botón de detalles que muestre y oculte estas subpartidas»*.
    //
    // El gesto es el MISMO que el de la fila de entrada (`BotonDespliegue`, kit 0.8): si los
    // dos niveles se abren distinto, el usuario no aprende que son lo mismo.
    // Estado: se guardan las PLEGADAS (opt-in) → todo nace abierto, como estaba.
    // ═══════════════════════════════════════════════════════════════════════════
    const lineas = useMemo(() => lineasDePartidas(partidas), [partidas])

    /** Cuántas subpartidas cuelgan de cada partida — va en la etiqueta («PARTIDA 1 · 4 productos»). */
    const hijosPorPartida = useMemo(() => {
        const cuenta = new Map<string, number>()
        for (const l of lineas) {
            if (l.esPartida) continue
            const clave = String(l.partida.id)
            cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
        }
        return cuenta
    }, [lineas])

    /**
     * ⭐ FIX 27 Sep 2026 (usuario) — **los productos de la ENTRADA**.
     *
     * El pie del desglose decía «{`partidas_count`} productos»: la cifra era el número de
     * **PARTIDAS** (`partidas_entrada`), no de productos. Con datos vivos se veía al instante —
     * `ING-0001` tiene **2 partidas** y **4 productos** y el pie decía «2 productos».
     * (El desglose de Revisión, `PartidasAvance`, arrastraba el mismo número en su pie y en su
     * toolbar: los tres sitios se corrigieron juntos.)
     *
     * La cifra es la **Σ del MISMO mapa que etiqueta cada partida** (`hijosPorPartida`): así el
     * pie y las etiquetas «PARTIDA n · N productos» **no pueden discrepar**. Se deriva de lo que ya
     * está en pantalla a propósito —pedirla al servidor crearía una SEGUNDA definición de
     * «producto» y volveríamos al problema de dos números para el mismo hecho.
     */
    const totalProductos = useMemo(
        () => Array.from(hijosPorPartida.values()).reduce((s, n) => s + n, 0),
        [hijosPorPartida]
    )

    // ⭐ MEJORA 34 (usuario) — **las partidas nacen CONTRAÍDAS**, igual que en el desglose de Revisión
    // (el gesto es el mismo en las dos superficies). El estado guarda las ABIERTAS: vacío = plegadas.
    const [desplegadas, setDesplegadas] = useState<Record<string, boolean>>({})
    const alternarPartida = (clave: string) =>
        setDesplegadas((prev) => ({ ...prev, [clave]: !prev[clave] }))

    /** ⭐ MEJORA 24 Sep 2026 (Fase 1) — el ⋯ se fue del puesto de dedo: la acción es un
     *  **botón con etiqueta** (ley L11). Al no haber menú, tampoco hay que diferir la apertura
     *  del modal (el retardo de 160 ms existía para el overlay fantasma de Radix). */

    return (
        <div className="flex flex-col gap-3">
            {/* ── ⭐ MEJORA 27 Sep 2026 (usuario) — LA **TOOLBAR DE DETALLES** DE RECEPCIÓN ──────
                Réplica del patrón que estrenó la cola del técnico (MEJORA 34): **Zona 1** dice de qué
                entrada se está hablando (folio · estado de la etapa · qué le toca) y **Zona 2** lleva
                las puertas, con **una sola dominante** (SPEC §2.3) y las demás **apagadas diciendo por
                qué** — nunca escondidas (SPEC §2.6). En el desglose largo ya no hay que subir a la fila
                del padre para saber de qué entrada se trata.
                ⚠️ Desviación declarada del mockup (①): aquí **no** está `Imprimir nota`. Ese papel ya
                vive en el expediente (`Ver` → «Imprimir / PDF») y traerlo acá obligaría a cargar las
                partidas declaradas (`listarPartidasEntrada`), que este componente no pide. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-border bg-surface-raised px-3 py-2.5">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-[13px] font-bold tracking-[0.06em] text-foreground">
                        {entrada.folio}
                    </span>
                    <Pildora
                        texto={TEXTO_ETAPA_RECEPCION[entrada.estado]}
                        tono={TONO_ETAPA_RECEPCION[entrada.estado]}
                    />
                    <span className="text-[12.5px] text-muted-foreground">
                        {puedeAjustar ? (
                            <>
                                <b className="tabular-nums text-foreground">
                                    {entrada.devolucion_total}
                                </b>{' '}
                                pieza{entrada.devolucion_total === 1 ? '' : 's'} devuelta
                                {entrada.devolucion_total === 1 ? '' : 's'} por ajustar · nota sin generar
                            </>
                        ) : entrada.id_nota ? (
                            <>
                                nota generada · <b className="tabular-nums text-foreground">
                                    {entrada.piezas_total}
                                </b>{' '}
                                pza declaradas · DEV{' '}
                                <b className="tabular-nums text-foreground">{entrada.devolucion_total}</b> ·
                                final <b className="tabular-nums text-foreground">{entrada.piezas_vigentes}</b>
                            </>
                        ) : (
                            <>
                                <b className="tabular-nums text-foreground">{entrada.piezas_total}</b> pza
                                declaradas · esperando revisión
                            </>
                        )}
                    </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                    {/* ⭐ MEJORA 27 Sep 2026 — UNA SOLA acción dominante por pantalla (SPEC §2.3): el
                        sólido es el de la toolbar; el botón de la fila de partida baja a `outline`
                        (misma acción, misma frase, otra profundidad). */}
                    {puedeAjustar && (
                        <Button
                            type="button"
                            onClick={() => onAjustar?.(entrada)}
                            className="h-9 gap-1.5 px-3 text-[12.5px] font-semibold"
                        >
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            Ajustar + nota ({entrada.devolucion_total})
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!onVerEtapas}
                        onClick={() => onVerEtapas?.(entrada)}
                        title="Cómo va este ingreso por sus 4 etapas: Recepción · Revisión · Acondicionamiento · Almacén (solo lectura)."
                    >
                        <Workflow className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Etapas del ingreso
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!entrada.id_nota || !onVerNota}
                        onClick={() => onVerNota?.(entrada)}
                        title={
                            entrada.id_nota
                                ? 'La nota de compra de esta entrada.'
                                : 'Todavía no hay nota de compra de esta entrada.'
                        }
                    >
                        <FileText className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Ver nota
                    </Button>
                    {/* ⭐ MEJORA 27 Sep 2026 (usuario) — «falta el botón imprimir en la toolbar del
                        shell y el de detalles»: el papel de Recepción es la NOTA DE ENTRADA, y aquí
                        se imprime la de ESTA entrada (mismo documento que el expediente). */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!onImprimir}
                        onClick={() => onImprimir?.(entrada)}
                        title="Imprime la nota de entrada de esta entrada (el papel que se firma al recibir)."
                    >
                        <Printer className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Imprimir nota
                    </Button>
                </span>
            </div>
            {/* ── Partidas: una tabla alineada, un solo encabezado ───────────── */}
            {cargando ? (
                <Spinner etiqueta="Cargando partidas…" className="py-1" />
            ) : partidas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin partidas.</p>
            ) : (
                <div className={CLASE_CAJA_TABLA}>
                    {/* ⚠️ `border-collapse`: LA CAUSA DE QUE NO SE VIERAN LAS FILAS.
                        Esta tabla no lo declaraba, así que usaba el default `separate` — y en el
                        modelo de bordes separados **los bordes de un `<tr>` NO se pintan**: las
                        reglas `border-t border-border/70` que ya estaban escritas en las filas de
                        producto (y el `border-t-2` de la de partida) eran literalmente invisibles.
                        Por eso el detalle se veía como una masa sin costuras. Con `collapse` la
                        fila pinta su propia regla y alcanza UNA clase por fila, no una por celda. */}
                    <table className="w-full border-collapse text-[14.5px]">
                        <thead className={CLASE_THEAD_TABLA}>
                            <tr>
                                <th className={cn(TH, 'w-52')} title="La partida y, bajo ella, el consecutivo de cada producto">
                                    Partida / #
                                </th>
                                <th
                                    className={cn(TH, 'text-left')}
                                    title="Categoría y atributos capturados en recepción (la huella declarada)"
                                >
                                    Producto
                                </th>
                                <th
                                    className={cn(TH, 'w-20')}
                                    title="En la fila de PARTIDA, lo declarado en recepción; en las de producto, las piezas de ese producto."
                                >
                                    Recib.
                                </th>
                                <th
                                    className={cn(TH, 'w-14')}
                                    title="De la partida en su fila; de cada producto en la suya (la pieza devuelta dice su marca)."
                                >
                                    DEV
                                </th>
                                <th
                                    className={cn(TH, 'w-28')}
                                    title="Lo que queda tras el ajuste en la fila de partida; lo aprobado de cada producto en la suya."
                                >
                                    Final
                                </th>
                                <th className={cn(TH, 'w-28')} title="Estado de la PARTIDA">
                                    Estado
                                </th>
                                <th className={cn(TH, 'w-24')} title="Costo acordado de la PARTIDA">
                                    Costo
                                </th>
                                <th className={cn(TH, 'w-24')}>
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineas.map((l) => {
                                const p = l.partida
                                // ⭐ MEJORA 26 Sep 2026 — las SUBPARTIDAS de una partida plegada no se pintan.
                                // Es el mismo gesto que la fila de entrada: el padre manda sobre sus hijos.
                                if (!l.esPartida && !desplegadas[String(p.id)]) return null
                                /* ── ⭐ MEJORA 30 (25 Sep 2026 · usuario) — LA FILA DE PARTIDA ──
                                   El mismo criterio que en Revisión, con las columnas de Recepción:
                                   lo que es de la PARTIDA (lo declarado · el DEV del documento · el
                                   `Final` vigente · el estado del ajuste · el costo · la acción de
                                   ajustar) tiene su PROPIA fila; las de producto dicen lo suyo. Antes
                                   todo eso vivía en la fila del primer producto y se leía como suyo. */
                                if (l.esPartida) {
                                    const devPartida = Number(p.dev_cantidad ?? 0)
                                    const devPendPartida = devPartida > 0 && !p.dev_ajustada
                                    return (
                                        <tr
                                            key={l.key}
                                            // ⭐ MEJORA 26 Sep 2026 — la fila de PARTIDA se distingue por
                                            // TINTE (`hover-bg`, el mismo tono de banda que usa la app) y
                                            // por el RIEL de acento de su primera celda; el `border-t-2`
                                            // ahora SÍ se pinta (ver el `border-collapse` de la tabla).
                                            className="border-t-2 border-border bg-hover-background"
                                        >
                                            <td className="px-2.5 py-2 text-center shadow-[inset_3px_0_0_var(--acc-entradas)]">
                                                <span className="inline-flex items-center gap-1">
                                                    <BotonDespliegue
                                                        abierto={Boolean(desplegadas[String(p.id)])}
                                                        onAlternar={() => alternarPartida(String(p.id))}
                                                        sujeto={`la partida ${p.partida}`}
                                                        tamano="sm"
                                                    />
                                                    <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.09em] text-acc-entradas">
                                                        PARTIDA {p.partida} · {hijosPorPartida.get(String(p.id)) ?? 0}{' '}
                                                        {(hijosPorPartida.get(String(p.id)) ?? 0) === 1 ? 'producto' : 'productos'}
                                                    </span>
                                                </span>
                                            </td>
                                            <td
                                                className="px-2.5 py-2 text-muted-foreground"
                                                title="Lo que Recepción declaró. Debajo, lo que la revisión encontró."
                                            >
                                                {productoDeLinea(l)}
                                            </td>
                                            <td
                                                className="px-2.5 py-2 text-center tabular-nums"
                                                title="Piezas declaradas en recepción"
                                            >
                                                {p.cantidad_original}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-2.5 py-2 text-center tabular-nums',
                                                    devPartida > 0
                                                        ? 'text-destructive'
                                                        : 'text-muted-foreground'
                                                )}
                                                title="DEV de la PARTIDA (Σ de sus productos)"
                                            >
                                                {devPartida > 0 ? `−${devPartida}` : '—'}
                                            </td>
                                            <td className="px-2.5 py-2">
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="text-[17px] tabular-nums">
                                                        {Number(p.cantidad_vigente)}
                                                    </span>
                                                    <Proporcion
                                                        final={Number(p.cantidad_vigente)}
                                                        dev={devPartida}
                                                        total={Number(p.cantidad_original)}
                                                    />
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-2 text-center">
                                                {devPartida > 0 ? (
                                                    <Pildora
                                                        texto={
                                                            p.dev_ajustada
                                                                ? 'Ajustada'
                                                                : 'Por cotejar'
                                                        }
                                                        tono={
                                                            p.dev_ajustada ? 'listo' : 'advertencia'
                                                        }
                                                    />
                                                ) : (
                                                    <Pildora
                                                        texto={
                                                            TEXTO_ESTADO_PARTIDA[p.estado_partida]
                                                        }
                                                        tono={TONO_PARTIDA[p.estado_partida]}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                                                {formatearMXNEntrada(Number(p.costo_acordado))}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                {devPartida > 0 && onAjustar ? (
                                                    puedeAjustar && devPendPartida ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAjustar(entrada)}
                                                            title="Ajusta la devolución y genera la nota de compra de la entrada."
                                                            /* ⭐ MEJORA 27 Sep 2026 — `outline`, NO sólido: la acción
                                                               dominante de la pantalla es la de la toolbar (SPEC §2.3:
                                                               una sola `default`). Misma frase en las dos. */
                                                            className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        >
                                                            Ajustar + nota
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAjustar(entrada)}
                                                            title="Ver la devolución: partida, producto, motivo y estado."
                                                            data-accion="ver-devolucion"
                                                            className="inline-flex h-8 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        >
                                                            Ver devolución
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                }
                                /* ── La fila de PRODUCTO: su DEV y su `Final` ────────────── */
                                // ⭐ MEJORA 29 — la DEV es de ESTA línea: guarda la huella de la pieza
                                // devuelta (antes era de la partida y se repetía —o se anulaba— en
                                // todas sus líneas para no contar dos veces el mismo rojo).
                                const dev = l.dev
                                const devPend = dev > 0 && !l.devAjustada
                                // ⭐ MEJORA 26 Sep 2026 — la regla de fila es la MISMA que la de la
                                // tabla madre (`border-border`), no una más débil: con `/70` la fila
                                // dejaba de leerse como fila.
                                return (
                                    <tr key={l.key} className="border-t border-border">
                                        <td
                                            className={cn(
                                                'px-2.5 py-2 text-center font-mono tabular-nums',
                                                l.partidaMultiple
                                                    ? 'text-muted-foreground'
                                                    : 'text-foreground',
                                                devPend
                                                    ? 'shadow-[inset_3px_0_0_var(--warning)]'
                                                    : dev > 0
                                                      ? 'shadow-[inset_3px_0_0_var(--destructive)]'
                                                      : undefined
                                            )}
                                            title={
                                                l.partidaMultiple
                                                    ? `Producto ${l.numero} de la entrada · viene de la partida ${p.partida} declarada`
                                                    : `Partida ${p.partida}`
                                            }
                                        >
                                            {l.numero}
                                        </td>
                                        <td className="px-2.5 py-2 pl-8">{productoDeLinea(l)}</td>
                                        <td
                                            className="px-2.5 py-2 text-center tabular-nums text-muted-foreground"
                                            title="Piezas DE ESTE producto: aprobadas + devueltas"
                                        >
                                            {l.recibidas}
                                        </td>
                                        <td
                                            className={cn(
                                                'px-2.5 py-2 text-center tabular-nums',
                                                dev > 0
                                                    ? 'text-destructive'
                                                    : 'text-muted-foreground'
                                            )}
                                            title="DEV de ESTE producto (la pieza devuelta dice su marca)"
                                        >
                                            {dev > 0 ? `−${dev}` : '—'}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            {/* ⭐ FIX 27 Sep 2026 (usuario) — **la fila de PRODUCTO no
                                                lleva barra**: *«en la columna Final los números están bien;
                                                lo que no cuadra son las barras de las filas de producto,
                                                porque la barra solo mostrando el número pues no dice nada»*.
                                                La barra de esta tabla mide lo VIGENTE contra lo DECLARADO
                                                **de la partida**; en una fila de producto el tramo vacío se
                                                leía como «de este producto» y era falso — la rebanada es de
                                                la partida, no suya. La proporción se queda donde es cierta:
                                                en la **fila de PARTIDA** (que la conserva). Aquí manda la
                                                cifra (17px), que es lo que el piso lee de un vistazo. */}
                                            <span className="flex items-center justify-center text-[17px] tabular-nums">
                                                {l.aprobadas}
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground">
                                            —
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground">
                                            —
                                        </td>
                                        <td className="px-2 py-2 text-center text-muted-foreground">
                                            —
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Timeline de etapas + totales, en UNA línea ─────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <Hito etiqueta="Recepción" fecha={entrada.fecha} />
                <Hito etiqueta="Revisión" fecha={entrada.fecha_fin_rev} />
                <Hito etiqueta="Acondicionamiento" fecha={entrada.fecha_fin_acond} />
                <Hito etiqueta="Almacén" fecha={entrada.fecha_fin_almacen} />
                <span className="ml-auto font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {totalProductos} {totalProductos === 1 ? 'producto' : 'productos'} ·{' '}
                    {entrada.piezas_total} pza · DEV {entrada.devolucion_total} · final{' '}
                    {entrada.piezas_vigentes}
                </span>
            </div>
        </div>
    )
}

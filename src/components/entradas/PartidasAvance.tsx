'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS DE AVANCE — la tabla de los ÍTEMS de una entrada (Guía 1.6 · Fase 2)
//
// ⭐ EXTRACCIÓN 24 Sep 2026 (usuario) — el pedido: *«en la columna estado aparece la píldora
// del estado, en las que aparece en revisión técnica que sea un link para abrir modal para
// mostrar el avance de la revisión … en la etapa 2 se resuelve cómo mostrar la tabla de los
// detalles de los ítems»*. En vez de copiar la tabla del desglose del técnico, sale de
// `PartidasRevision` a este componente presentacional y las DOS superficies la consumen:
//
//   · `PartidasRevision`      → el desglose del acordeón de la cola del técnico (con sus puertas);
//   · `AvanceRevisionModal`   → el mismo avance en **solo lectura** desde Recepción.
//
// El contrato es el de la etapa: la huella que produjo la REVISIÓN (una línea por grupo — una
// partida de 100 discos puede rendir 2TB y 4TB: se pintan todas), el avance «revisadas/total» con
// barra de tramos, y la DEV **contada** («2 malas», no «Con malas»).
//
// ⚠️ En solo lectura NO se pintan controles muertos: sin `onVerDev` la píldora queda píldora, y
// sin `onIniciar`/`onVerResultado`/`onLiberar` la columna de acciones no existe. Un botón que no
// hace nada enseña a ignorar esa zona (SISTEMA_COMPONENTES §8).
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { Eye, PackageCheck, Play, Printer } from 'lucide-react'

import { BotonDespliegue, Pildora } from '@/components/data-table'
import { CLASE_CAJA_TABLA, CLASE_THEAD_TABLA, CLASE_TH_TABLA } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DocumentoImprimible } from '@/components/imprimibles'
import { ActaRevisionImprimible } from '@/components/entradas/imprimibles/ActaRevisionImprimible'
import { construirDatosActaRevision } from '@/components/entradas/imprimibles/datos-acta-revision'
import {
    BarraAvance,
    formatearFechaEntrada,
    huellaDeclarada,
    lineasDePartidas,
    valoresAtributos,
} from '@/components/entradas/columnas-entrada'
import { cn } from '@/lib/utils'
import { puedeLiberar, TEXTO_ETAPA_REVISION, TONO_ETAPA_REVISION } from '@/types/entradas'
import type { Entrada, PartidaConAvance } from '@/types/entradas'

interface PartidasAvanceProps {
    entrada: Entrada
    /** Ya cargadas por quien hospeda: cada superficie tiene su propia carga. */
    partidas: PartidaConAvance[]
    cargando?: boolean
    /** ② La píldora «n malas» es botón cuando hay quien abra esa devolución (L3). */
    onVerDev?: (entrada: Entrada, idPartida: string) => void
    /** Abre el wizard de revisión en esa partida. */
    onIniciar?: (idPartida: string) => void
    /** Abre el resultado de una partida ya cerrada. */
    onVerResultado?: (entrada: Entrada) => void
    /**
     * ⭐ FIX 25 Sep 2026 (30-bis) — **puesto de dedo**. La SPEC lo manda dos veces: **§1.1** (en fila y
     * navegación el objetivo es **44**, y en un puesto de piso la altura **se sobreescribe**) y **§2.3**
     * («en un paso de puesto de piso la altura se sobreescribe — el tamaño no se cambia en el kit»).
     * El desglose se quedaba en el `sm` del kit (h-8 = **32px**), que es densidad de **ratón**: 32px
     * para un dedo. Lo enciende la cola que se opera con el dedo (Revisión), **no** el ancho de la
     * pantalla — la tablet en horizontal recibe la densidad de escritorio (SPEC §1.1 · L8).
     */
    tactil?: boolean
    /**
     * ⭐ MEJORA 25 — libera a acondicionamiento lo aprobado de ESA partida sin esperar a las demás.
     * Segunda puerta al mismo modal que el pie del wizard (una superficie, dos profundidades).
     */
    /**
     * ⭐ MEJORA 25/28/30 — libera a acondicionamiento lo aprobado. Tres profundidades, **el mismo
     * modal** (`LiberarAvanceModal` con su filtro): la LÍNEA (su grupo, tercer argumento), la
     * PARTIDA (segundo argumento) y la ENTRADA ENTERA (`idPartida = null` → sin filtro), que es la
     * puerta que evita abrir el modal 20 veces en una entrada de 20 partidas.
     */
    onLiberar?: (entrada: Entrada, idPartida: string | null, idGrupo?: string) => void
    className?: string
}

/** El estado de la PARTIDA en el idioma de la etapa (no el del documento de entrada). */
function estadoDePartida(p: PartidaConAvance): {
    texto: string
    tono: 'neutro' | 'listo' | 'advertencia' | 'peligro'
} {
    if (p.revisadas === 0) return { texto: 'Pendiente', tono: 'advertencia' }
    if (p.restantes === 0) return { texto: 'Cerrada', tono: 'listo' }
    return { texto: 'En curso', tono: p.dev_cantidad > 0 ? 'peligro' : 'advertencia' }
}

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
                    // ⭐ MEJORA 28 Sep 2026 — **PASE TIPOGRÁFICO (piso L14).** Esta etiqueta del timeline
                    // medía **9.5px**: por debajo del piso, y 9.5 es la medida del CROMO de tabla
                    // (`estilos-tabla.ts`), no la de una etiqueta de CONTENIDO. Se sube a la etiqueta
                    // canónica de la SPEC §1.2 (`font-mono text-[11px] uppercase`) — el dato del hito, al
                    // lado, ya iba a 11.5px, así que el par vuelve a leerse como un par.
                    'font-mono text-[11px] uppercase tracking-[0.12em]',
                    hecha ? 'text-foreground/80' : 'text-muted-foreground/70'
                )}
            >
                {etiqueta}
            </span>
            <span
                className={cn(
                    'text-[11.5px] tabular-nums',
                    hecha ? 'text-foreground' : 'text-muted-foreground/50'
                )}
            >
                {hecha ? formatearFechaEntrada(fecha as string) : '—'}
            </span>
        </span>
    )
}

const TH = cn(CLASE_TH_TABLA, 'px-2.5 py-1.5')

export function PartidasAvance({
    entrada,
    partidas,
    cargando = false,
    tactil = false,
    onVerDev,
    onIniciar,
    onVerResultado,
    onLiberar,
    className,
}: PartidasAvanceProps) {
    // ⭐ MEJORA 26 Sep 2026 — el despliegue de la PARTIDA (sus subpartidas).
    // ⚠️ El hook va ANTES de los `return` tempranos de abajo: un hook después de un return
    // condicional es un hook condicional, y React revienta en cuanto `cargando` cambia.
    /**
     * ⭐ MEJORA 34 (usuario) — **las partidas nacen CONTRAÍDAS**: *«que las filas de partida aparezcan
     * siempre contraídas»*. El estado guarda las que están **ABIERTAS** (vacío = todas plegadas); con
     * el nombre al revés el default efectivo era «abierto» y una entrada de 20 partidas se desplegaba
     * entera al abrir los detalles.
     */
    const [desplegadas, setDesplegadas] = useState<Record<string, boolean>>({})
    const alternarPartida = (clave: string) =>
        setDesplegadas((prev) => ({ ...prev, [clave]: !prev[clave] }))
    /**
     * ⭐ MEJORA 34 — el acta de revisión se abre desde la **toolbar de detalles** y vive aquí: este
     * componente ya tiene las partidas resueltas (huellas y DEV), así que imprime con los MISMOS datos
     * que pinta la pantalla (L6) y funciona igual en las dos superficies — incluidas las de **solo
     * lectura**, porque imprimir no cambia nada.
     */
    const [imprimir, setImprimir] = useState(false)

    /**
     * Las FILAS del desglose (la de partida + las de sus productos) se calculan **una sola vez**:
     * las consumen el render, el conteo del pie y el de la toolbar de detalles.
     */
    const lineas = useMemo(() => lineasDePartidas(partidas), [partidas])

    /**
     * ⭐ FIX 27 Sep 2026 (usuario) — **los productos de la ENTRADA** (Σ de las filas de producto).
     *
     * El pie del desglose y la toolbar de detalles decían «{`partidas_count`} productos»: la cifra
     * era el número de **PARTIDAS** (`partidas_entrada`), no de productos. Se ve con datos vivos —
     * `ING-0001`: **2 partidas · 4 productos** y el pie decía «2 productos».
     * (El desglose de Recepción, `PartidasExpandidas`, arrastraba el mismo número: los tres sitios
     * se corrigieron juntos, porque son la misma cifra en las dos caras del avance.)
     *
     * Sale del MISMO `lineasDePartidas` que pinta la tabla y que etiqueta cada partida, así que el
     * pie y las etiquetas **no pueden discrepar**. Derivarlo aquí es deliberado: pedirlo al servidor
     * crearía una segunda definición de «producto» para el mismo hecho.
     */
    const totalProductos = useMemo(() => lineas.filter((l) => !l.esPartida).length, [lineas])

    if (cargando) return <Spinner etiqueta="Cargando partidas…" className="py-1" />
    if (partidas.length === 0) return <p className="text-sm text-muted-foreground">Sin partidas.</p>

    /** Sin puertas no hay columna de acciones. */
    const hayAcciones = Boolean(onIniciar || onVerResultado || onLiberar)
    const faltanTotal = Math.max(
        0,
        entrada.piezas_total - entrada.piezas_aprobadas - entrada.devolucion_total
    )
    /**
     * ⭐ MEJORA 30 — lo aprobado **sin liberar** de TODA la entrada: la cifra de «Liberar todo».
     * Es la Σ de las mismas cifras que ofrecen las filas de producto y de partida.
     */
    const liberablesEntrada = partidas.reduce(
        (s, p) =>
            s +
            p.huellas.reduce(
                (t, h) => t + Math.max(0, h.cantidad_aprobada - h.cantidad_liberada),
                0
            ),
        0
    )
    /**
     * ⭐ MEJORA 34 — lo que gobierna la **toolbar de detalles**: si hay algo revisado (para ver/imprimir),
     * en qué partida sigue habiendo piezas por revisar (para `Revisar`) y **por qué** está apagada cada
     * acción. El motivo es parte del contrato: la SPEC §2.3 prohíbe deshabilitar sin decir por qué.
     */
    const hayRevision = entrada.piezas_aprobadas > 0 || entrada.devolucion_total > 0
    const partidaPendiente = partidas.find((p) => p.restantes > 0) ?? null
    const puedeLiberarAqui = Boolean(onLiberar) && puedeLiberar(entrada.estado)
    const soloLectura = 'Esta vista es de solo lectura.'
    const motivoRevisar = !onIniciar ? soloLectura : 'La revisión ya terminó: no quedan piezas por revisar.'
    const motivoLiberar = !onLiberar
        ? soloLectura
        : !puedeLiberar(entrada.estado)
          ? 'La entrada ya avanzó: la liberación se hace en la etapa de Revisión.'
          : 'No hay piezas aprobadas sin liberar.'
    const motivoVer = hayRevision ? undefined : 'Todavía no hay nada revisado en esta entrada.'
    /**
     * ⭐ MEJORA 34 — **jerarquía, no cuatro botones iguales** (SPEC §2.3: *«una sola `default` por
     * pantalla»*). La acción dominante es **lo que esta entrada necesita AHORA**: primero revisar (si
     * quedan piezas), y si no, liberar (si hay aprobadas sin salir). El resto son secundarias, y ver /
     * imprimir —lo menos frecuente— van discretas (`ghost`).
     */
    const dominante: 'revisar' | 'liberar' | null =
        onIniciar && partidaPendiente
            ? 'revisar'
            : puedeLiberarAqui && liberablesEntrada > 0
              ? 'liberar'
              : null

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {/* ── ⭐ MEJORA 34 (usuario) — LA **TOOLBAR DE DETALLES** ─────────────
                Es la barra de la ENTRADA: **dice el detalle** y lleva las acciones que afectan a
                **toda la entrada** —todas sus partidas y sus productos—: `Revisar (n)` ·
                `Liberar todo (n)` · `Ver revisión completa` · `Imprimir revisión`.

                **Siempre visible** —también ANTES de empezar la revisión— y las acciones se **apagan
                diciendo por qué**, nunca se esconden (usuario: *«que no desaparezca, solo se bloquea»*):
                una puerta que aparece y desaparece enseña a no buscarla (SPEC §2.3 y §2.6).

                Tres profundidades de liberación, **el mismo modal**: la LÍNEA, la PARTIDA y la ENTRADA. */}
            <div
                className={cn(
                    'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-border bg-surface-raised px-3 py-2.5',
                    // ⭐ FIX 30-bis — en puesto de dedo, 44 (SPEC §1.1/§2.3) sin tocar el kit.
                    tactil && '[&_button]:min-h-11'
                )}
            >
                {/* ── Zona 1 · QUIÉN es esta entrada y qué le falta ────────────────
                    ⭐ MEJORA 34 — la toolbar de detalles dice el detalle, así que empieza por la
                    IDENTIDAD (folio + estado de la etapa): en un desglose largo ya no hay que subir
                    a la fila del padre para saber de qué entrada se está hablando. */}
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-[13px] font-bold tracking-[0.06em] text-foreground">
                        {entrada.folio}
                    </span>
                    <Pildora
                        texto={TEXTO_ETAPA_REVISION[entrada.estado]}
                        tono={TONO_ETAPA_REVISION[entrada.estado]}
                    />
                    <span className="text-[12.5px] text-muted-foreground">
                        {liberablesEntrada > 0 ? (
                            <>
                                <span className="font-semibold tabular-nums text-foreground">
                                    {liberablesEntrada}
                                </span>{' '}
                                pieza{liberablesEntrada === 1 ? '' : 's'} aprobada
                                {liberablesEntrada === 1 ? '' : 's'} sin liberar en{' '}
                                {totalProductos}{' '}
                                {totalProductos === 1 ? 'producto' : 'productos'}
                            </>
                        ) : !puedeLiberar(entrada.estado) ? (
                            <>ya salió de Revisión: aquí solo se consulta y se imprime.</>
                        ) : (
                            <>nada por liberar: todo lo aprobado ya salió a limpieza.</>
                        )}
                    </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                    <Button
                        type="button"
                        // ⭐ MEJORA 34 — la dominante va SÓLIDA (SPEC §2.3: una sola `default`).
                        variant={dominante === 'revisar' ? 'default' : 'outline'}
                        size="sm"
                        disabled={!onIniciar || !partidaPendiente}
                        onClick={() => partidaPendiente && onIniciar?.(partidaPendiente.id)}
                        title={
                            partidaPendiente
                                ? `Abre la revisión en la partida #${partidaPendiente.partida}, que es la que tiene piezas pendientes.`
                                : motivoRevisar
                        }
                    >
                        <Play className="mr-1 h-3.5 w-3.5" /> Revisar ({faltanTotal})
                    </Button>
                    <Button
                        type="button"
                        variant={dominante === 'liberar' ? 'default' : 'outline'}
                        size="sm"
                        disabled={!puedeLiberarAqui || liberablesEntrada === 0}
                        onClick={() => onLiberar?.(entrada, null)}
                        title={
                            liberablesEntrada > 0 && puedeLiberarAqui
                                ? `Abre la liberación con TODOS los productos de la entrada ya cargados (${liberablesEntrada} pieza(s) aprobadas).`
                                : motivoLiberar
                        }
                    >
                        <PackageCheck className="mr-1 h-3.5 w-3.5" /> Liberar todo ({liberablesEntrada})
                    </Button>
                    <Button
                        type="button"
                        // ⭐ MEJORA 34 — ver e imprimir son lo MENOS frecuente: discretos (`ghost`).
                        variant="ghost"
                        size="sm"
                        disabled={!onVerResultado || !hayRevision}
                        onClick={() => onVerResultado?.(entrada)}
                        title={
                            hayRevision
                                ? 'El resultado de la revisión de toda la entrada.'
                                : motivoVer
                        }
                    >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Ver revisión completa
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!hayRevision}
                        onClick={() => setImprimir(true)}
                        title={
                            hayRevision
                                ? 'Acta de revisión para firmar: partidas, productos, aprobadas y DEV.'
                                : motivoVer
                        }
                    >
                        <Printer className="mr-1 h-3.5 w-3.5" /> Imprimir revisión
                    </Button>
                </span>
            </div>
            {/* ⭐ MEJORA 41 (29 Sep 2026 · carril PLANTILLA) — la segunda puerta del acta pasa por el
                punto de invocación: plantilla activa del tipo `acta_revision` si existe, y si no el
                respaldo en código. Una sola plantilla, dos puertas. */}
            <DocumentoImprimible
                tipo="acta_revision"
                datos={construirDatosActaRevision(entrada, partidas)}
                open={imprimir}
                onOpenChange={setImprimir}
                titulo={`Acta de revisión · ${entrada.folio}`}
                nombreArchivo={`acta-revision-${entrada.folio}`}
                fallback={ActaRevisionImprimible}
            />
            {/* ── Una sola tabla alineada, un solo encabezado ───────────────── */}
            <div className={cn(CLASE_CAJA_TABLA, 'shadow-premium-sm')}>
                {/* ⚠️ `border-collapse`: sin él la tabla usa el default `separate`, y en el modelo
                    de bordes SEPARADOS los bordes de un `<tr>` NO se pintan — las reglas de fila
                    que ya estaban escritas (`border-t`) eran invisibles. Mismo arreglo que
                    `PartidasExpandidas`: es el mismo desglose en el otro puesto. */}
                <table className="w-full border-collapse text-[12.5px]">
                    <thead className={CLASE_THEAD_TABLA}>
                        <tr>
                            <th
                                className={cn(TH, 'w-14')}
                                title="En la fila de PARTIDA, el número de la partida declarada; en las de producto, el consecutivo del producto en la entrada."
                            >
                                #
                            </th>
                            <th
                                className={cn(TH, 'text-left')}
                                title="En la fila de PARTIDA, lo declarado en recepción. En las de producto, la huella (marca + atributos) que produjo la REVISIÓN."
                            >
                                Producto
                            </th>
                            <th
                                className={cn(TH, 'w-16')}
                                title="Piezas DE ESTE PRODUCTO: aprobadas + devueltas. En una partida sin revisar, lo declarado en recepción."
                            >
                                Recib.
                            </th>
                            <th
                                className={cn(TH, 'w-32')}
                                title="Aprobadas + devueltas de ESTE producto, sobre las piezas de esta línea"
                            >
                                Revisadas
                            </th>
                            <th
                                className={cn(TH, 'w-16')}
                                title="Piezas aprobadas de este producto (se pagarán)"
                            >
                                Aprob.
                            </th>
                            <th
                                className={cn(TH, 'w-24')}
                                title="Piezas rechazadas de este producto — abre la devolución"
                            >
                                DEV
                            </th>
                            <th
                                className={cn(TH, 'w-16')}
                                title="Piezas que faltan por revisar en la PARTIDA: nadie las revisó, así que todavía no tienen huella y no se reparten por línea."
                            >
                                Faltan
                            </th>
                            <th
                                className={cn(TH, 'w-28')}
                                title="Estado de la PARTIDA en la etapa (sus líneas lo comparten: es el mismo hecho)"
                            >
                                Estado
                            </th>
                            {hayAcciones && (
                                // ⭐ MEJORA 34 (usuario) — la fila de PARTIDA lleva DOS puertas con
                                // etiqueta (`Ver revisión` + `Liberar n`): 112px no las contiene y los
                                // botones se apretaban. La columna pasa a 240px y el desglose se ensancha
                                // (el ancho tope subió a 1320 en `PartidasRevision`).
                                <th className={cn(TH, 'w-60')}>
                                    <span className="sr-only">Acciones</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {lineas.map((l) => {
                            const p = l.partida
                            // ⭐ MEJORA 26 Sep 2026 — las SUBPARTIDAS de una partida plegada no se pintan
                            // (mismo gesto que la fila de entrada y que el desglose de Recepción).
                            if (!l.esPartida && !desplegadas[String(p.id)]) return null
                            const estado = estadoDePartida(p)
                            const cerrada = p.revisadas > 0 && p.restantes === 0
                            /**
                             * ⭐ MEJORA 30 (25 Sep 2026 · usuario) — **LA FILA DE PARTIDA**.
                             *
                             * Es la dueña de todo lo que **no tiene huella**: lo declarado, las piezas
                             * declaradas, lo que falta por revisar, el estado de la partida y **sus**
                             * acciones de revisión. Antes colgaban de la fila de la PRIMERA marca y se
                             * leían como suyos: *«el botón iniciar está colocado en la fila 1 como si
                             * dijera que falta revisar de esa marca»*.
                             *
                             * Lleva las MISMAS columnas que las filas de producto (la anatomía de la
                             * fila a todo lo ancho de la SPEC §2.5: `bg-surface-2` + borde), así que
                             * la tabla se sigue comparando en vertical.
                             */
                            if (l.esPartida) {
                                const textoDevPartida =
                                    p.dev_cantidad === 1 ? '1 mala' : `${p.dev_cantidad} malas`
                                const tonoDevPartida = p.dev_ajustada ? 'peligro' : 'advertencia'
                                /** ⭐ MEJORA 30 — «Liberar n» de la PARTIDA: todos sus productos de una vez. */
                                const liberablesPartida = p.huellas.reduce(
                                    (s, h) =>
                                        s + Math.max(0, h.cantidad_aprobada - h.cantidad_liberada),
                                    0
                                )
                                return (
                                    <tr
                                        key={l.key}
                                        // ⭐ MEJORA 34 (usuario) — «darle más color para que resalte»: la
                                        // banda de la partida se tiñe con el acento del módulo. Es la
                                        // TERCERA y última puerta del acento en esta pantalla (riel del
                                        // desglose · rótulo PARTIDA · esta banda), así que la barra de
                                        // 3px de la primera celda se retira: el color de la fila entera
                                        // marca mejor dónde empieza una partida que una barrita.
                                        className="border-t-2 border-border bg-acc-entradas/10"
                                    >
                                        <td className="px-2.5 py-2 text-center">
                                            <span className="inline-flex items-center gap-1">
                                                <BotonDespliegue
                                                    abierto={Boolean(desplegadas[String(p.id)])}
                                                    onAlternar={() => alternarPartida(String(p.id))}
                                                    sujeto={`la partida ${p.partida}`}
                                                    tamano="sm"
                                                />
                                                <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.09em] text-acc-entradas">
                                                    PARTIDA {p.partida}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <span
                                                className="text-muted-foreground"
                                                title="Lo que Recepción declaró (categoría + atributos de recepción). Debajo, lo que la revisión encontró."
                                            >
                                                {huellaDeclarada(p.categoria_nombre, p.atributos)}
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2 text-center tabular-nums">
                                            {l.recibidas}
                                        </td>
                                        {/* ⭐ MEJORA 32 (usuario) — la fila de PARTIDA pintaba «—» en
                                            Revisadas y Aprob. mientras sus hijas sí decían su cifra. El
                                            usuario: *«a pesar que ya fueron revisadas, en las subpartidas
                                            sí muestra 3/3, pero en el padre no dice el total; solo dice
                                            las recibidas… en DEV sí muestra cuántas hay»*. El dato YA
                                            venía en la partida (`PartidaConAvance.revisadas` = aprobadas +
                                            devueltas, y `.aprobadas`) — el hueco era de pintado, no de
                                            consulta. La fila padre los dicta con el MISMO formato de sus
                                            hijas, para que la columna se siga leyendo en vertical. */}
                                        <td className="px-2.5 py-2 text-center tabular-nums">
                                            {p.revisadas}
                                            <span className="text-muted-foreground">/{l.recibidas}</span>
                                        </td>
                                        <td className="px-2.5 py-2 text-center tabular-nums text-success">
                                            {p.aprobadas}
                                        </td>
                                        <td className="px-2.5 py-2 text-center">
                                            {p.dev_cantidad > 0 ? (
                                                onVerDev ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onVerDev(entrada, p.id)}
                                                        title={`Ver ${p.dev_cantidad === 1 ? 'la devolución' : `las ${p.dev_cantidad} devoluciones`} de la partida #${p.partida}.`}
                                                        className={cn(
                                                        // ⭐ MEJORA 27 Sep 2026 — `rounded-md`: la DEV es un
                                                        // CONTROL. Misma talla y tono; la FORMA distingue
                                                        // control de estado (las píldoras de estado siguen
                                                        // `rounded-full`). FIX 30-bis: conserva el objetivo
                                                        // de dedo en puesto táctil.
                                                        'inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
                                                        tactil && 'min-h-11 min-w-11'
                                                    )}
                                                    >
                                                        <Pildora
                                                            texto={textoDevPartida}
                                                            tono={tonoDevPartida}
                                                            className="rounded-md"
                                                        />
                                                    </button>
                                                ) : (
                                                    <Pildora
                                                        texto={textoDevPartida}
                                                        tono={tonoDevPartida}
                                                        className="rounded-md"
                                                    />
                                                )
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-2 text-center tabular-nums">
                                            {p.restantes > 0 ? (
                                                <span className="font-semibold text-warning">
                                                    {p.restantes}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-2 text-center">
                                            <Pildora texto={estado.texto} tono={estado.tono} />
                                        </td>
                                        {hayAcciones && (
                                            <td className="px-2 py-2 text-center">
                                                {/* ⭐ FIX 30-bis — los controles de la fila de partida a
                                                    44 en puesto de dedo (SPEC §1.1/§2.3). */}
                                                <span
                                                    className={cn(
                                                        'flex flex-wrap items-center justify-center gap-1.5',
                                                        tactil && '[&_button]:min-h-11'
                                                    )}
                                                >
                                                    {cerrada
                                                        ? onVerResultado && (
                                                              <Button
                                                                  type="button"
                                                                  variant="outline"
                                                                  size="sm"
                                                                  onClick={() =>
                                                                      onVerResultado(entrada)
                                                                  }
                                                              >
                                                                  {/* ⭐ MEJORA 34 — «Ver resultado» pasa a
                                                                  **«Ver revisión»**: un solo vocabulario
                                                                  con la toolbar de detalles. */}
                                                              Ver revisión
                                                              </Button>
                                                          )
                                                        : onIniciar && (
                                                              <Button
                                                                  type="button"
                                                                  variant="outline"
                                                                  size="sm"
                                                                  onClick={() => onIniciar(p.id)}
                                                                  title={`Abrir la revisión de la partida #${p.partida}: ${p.restantes} pieza(s) por revisar.`}
                                                              >
                                                                  {/* ⭐ MEJORA 30 — «Revisar (n)»: la MISMA
                                                                      cifra de la columna Faltan, en el botón
                                                                      que abre el wizard de esa partida. */}
                                                                  <Play className="mr-1 h-3.5 w-3.5" />{' '}
                                                                  Revisar ({p.restantes})
                                                              </Button>
                                                          )}
                                                    {onLiberar &&
                                                        liberablesPartida > 0 &&
                                                        puedeLiberar(entrada.estado) && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    onLiberar(entrada, p.id)
                                                                }
                                                                title={`${liberablesPartida} pieza(s) aprobadas de la partida #${p.partida} (todos sus productos) pueden pasar ya a limpieza.`}
                                                            >
                                                                <PackageCheck className="mr-1 h-3.5 w-3.5" />
                                                                Liberar {liberablesPartida}
                                                            </Button>
                                                        )}
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                )
                            }
                            /* ── La fila de PRODUCTO: su avance y su DEV ────────────── */
                            const dev = l.dev
                            const textoDev = dev === 1 ? '1 mala' : `${dev} malas`
                            const tonoDev = l.devAjustada ? 'peligro' : 'advertencia'
                            const liberables = l.huella ? Math.max(0, l.aprobadas - l.liberadas) : 0
                            return (
                                <tr key={l.key} className="border-t border-border">
                                    <td
                                        className={cn(
                                            'px-2.5 py-2 text-center font-mono tabular-nums',
                                            l.partidaMultiple
                                                ? 'text-muted-foreground'
                                                : 'text-foreground',
                                            dev > 0 && !p.dev_ajustada
                                                ? 'shadow-[inset_3px_0_0_var(--warning)]'
                                                : dev > 0
                                                  ? 'shadow-[inset_3px_0_0_var(--destructive)]'
                                                  : undefined
                                        )}
                                        title={
                                            l.partidaMultiple
                                                ? `Línea ${l.numero} de la entrada · viene de la partida ${p.partida} declarada`
                                                : `Partida ${p.partida}`
                                        }
                                    >
                                        {l.numero}
                                    </td>
                                    {/* ── La línea es UN producto ──────────────────────
                                        ⭐ MEJORA 28 (opción A) — antes esta celda apilaba TODAS las
                                        huellas de la partida y la fila seguía siendo una: el usuario
                                        *«sigo viendo que en detalles solo una partida cuando ahí ya
                                        debieron nacer 2»*. Ahora cada huella es su propia fila.
                                        ⭐ MEJORA 29 — y una fila también puede nacer de una **DEV sin
                                        nada aprobado**: pinta su marca (o «Sin marca» si la DEV es
                                        anterior a la MEJORA 29, cuando la marca se tiraba al guardar). */}
                                    <td className="px-2.5 py-2">
                                        {l.declarada ? (
                                            <span
                                                className="italic text-muted-foreground/70"
                                                title={`Declarado en recepción: ${huellaDeclarada(p.categoria_nombre, p.atributos)}`}
                                            >
                                                {huellaDeclarada(p.categoria_nombre, p.atributos)} · sin revisar
                                            </span>
                                        ) : (
                                            <span
                                                className="font-semibold"
                                                title={`Declarado en recepción: ${huellaDeclarada(p.categoria_nombre, p.atributos)}`}
                                            >
                                                {l.marcaNombre ?? 'Sin marca'}
                                                {valoresAtributos(l.atributos) && (
                                                    <span className="font-normal">
                                                        {' '}
                                                        · {valoresAtributos(l.atributos)}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    {/* ── Las piezas DE ESTA LÍNEA ─────────────────────
                                        ⭐ MEJORA 29 (usuario) — antes decía lo declarado de la PARTIDA
                                        («en la partida uno dice 6 cuando era 3»): la cifra era de la
                                        partida, no de la línea. */}
                                    <td className="px-2.5 py-2 text-center tabular-nums">
                                        {l.recibidas}
                                    </td>
                                    {/* ── ③ Avance con barra ─────────────────────────── */}
                                    {/* ── El avance de ESTA LÍNEA ──────────────────────────────
                                        ⭐ MEJORA 29 (usuario) — antes la barra era de la PARTIDA y se
                                        decía una sola vez en la línea que la abría; el desglose no se
                                        podía leer por producto. Ahora cada línea pinta la suya: una
                                        partida de 2 marcas se lee como dos avances distintos, y la
                                        línea con DEV dice su propio «3/3 · 2 aprobadas · 1 mala». */}
                                    <td className="px-2.5 py-2">
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="tabular-nums">
                                                {l.aprobadas + dev}
                                                <span className="text-muted-foreground">
                                                    /{l.recibidas}
                                                </span>
                                            </span>
                                            <BarraAvance
                                                aprobadas={l.aprobadas}
                                                dev={dev}
                                                total={l.recibidas}
                                                liberadas={l.liberadas}
                                            />
                                        </span>
                                    </td>
                                    {/* ── Aprobadas de ESTA LÍNEA ─────────────────────────────
                                        ⭐ MEJORA 30 (usuario) — «n en limpieza» se movió a la columna de
                                        **Acciones**: esta celda es la cifra que se compara y se dicta,
                                        y la liberación solo aplica a algunas filas. */}
                                    <td className="px-2.5 py-2 text-center">
                                        <span className="tabular-nums text-success">
                                            {l.declarada ? '—' : l.aprobadas}
                                        </span>
                                    </td>
                                    {/* ── ② «n malas» DE ESTA LÍNEA + píldora-botón → devolución ──
                                        ⭐ MEJORA 29 (usuario) — antes la DEV era de la PARTIDA y se decía
                                        una sola vez: *«en la que tiene dev no muestra ese desglose»*.
                                        Ahora la línea con DEV dice la suya, porque la DEV guarda la
                                        huella de la pieza devuelta. */}
                                    <td className="px-2.5 py-2 text-center">
                                        {dev > 0 ? (
                                            onVerDev ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onVerDev(entrada, p.id)}
                                                    title={`Ver ${dev === 1 ? 'la devolución' : `las ${dev} devoluciones`} de ${l.marcaNombre ?? 'este producto'} en la partida #${p.partida}.`}
                                                    className={cn(
                                                        // ⭐ MEJORA 27 Sep 2026 — `rounded-md`: la DEV es
                                                        // un CONTROL (la forma distingue control de estado).
                                                        // FIX 30-bis: conserva el objetivo de dedo.
                                                        'inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
                                                        tactil && 'min-h-11 min-w-11'
                                                    )}
                                                >
                                                    <Pildora
                                                        texto={textoDev}
                                                        tono={tonoDev}
                                                        className="rounded-md"
                                                    />
                                                </button>
                                            ) : (
                                                // Solo lectura: el mismo dato, sin puerta.
                                                <span title={`${dev} ${dev === 1 ? 'pieza devuelta' : 'piezas devueltas'} de ${l.marcaNombre ?? 'este producto'} en la partida #${p.partida}.`}>
                                                    <Pildora
                                                        texto={textoDev}
                                                        tono={tonoDev}
                                                        className="rounded-md"
                                                    />
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    {/* ── `Faltan` y `Estado` viven en la FILA DE PARTIDA ────────
                                        ⭐ MEJORA 30 (usuario) — son de la partida y ya tienen su fila;
                                        aquí, en una fila de producto, serían un dato ajeno (y las piezas
                                        que nadie revisó **no tienen huella**: repartirlas sería
                                        inventarlas). El avance por producto se lee en `Recib.`,
                                        `Revisadas` y `Aprob.`, que sí son suyos. */}
                                    <td className="px-2.5 py-2 text-center text-muted-foreground">—</td>
                                    <td className="px-2.5 py-2 text-center text-muted-foreground">—</td>
                                    {/* ── Lo que ESTA LÍNEA puede hacer: liberar SU grupo ───────
                                        ⭐ MEJORA 30 (usuario) — «n en limpieza» aterriza aquí (es el
                                        estado de liberación de esta fila, no una cifra que se compare) y
                                        las acciones de REVISIÓN subieron a la fila de partida: son de la
                                        partida, no de una marca.
                                        ⚠️ La condición incluye el ESTADO (`puedeLiberar`): antes bastaba
                                        `liberables > 0` y en las entradas ya avanzadas la puerta salía y
                                        el servidor la rechazaba con «La entrada ya avanzó…». */}
                                    {hayAcciones && (
                                        <td className="px-2 py-2 text-center">
                                            {/* ⭐ FIX 30-bis — 44 en puesto de dedo (SPEC §1.1/§2.3). */}
                                            <span
                                                className={cn(
                                                    'flex flex-wrap items-center justify-center gap-1.5',
                                                    tactil && '[&_button]:min-h-11'
                                                )}
                                            >
                                                {onLiberar &&
                                                    liberables > 0 &&
                                                    puedeLiberar(entrada.estado) && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                onLiberar(
                                                                    entrada,
                                                                    p.id,
                                                                    l.huella?.id_partida_resuelta
                                                                )
                                                            }
                                                            title={`${liberables} pieza(s) aprobadas de ESTE producto pueden pasar ya a limpieza, sin esperar al resto de la partida.`}
                                                        >
                                                            <PackageCheck className="mr-1 h-3.5 w-3.5" />
                                                            Liberar {liberables}
                                                        </Button>
                                                    )}
                                                {l.liberadas > 0 && (
                                                    // ⭐ MEJORA 28 Sep 2026 — mismo pase (piso L14): el
                                                    // contador «n en limpieza» iba a 9.5px. Sube a la
                                                    // etiqueta canónica (11 mono) y el número gana
                                                    // `tabular-nums`, como todo dato que se cuenta.
                                                    <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-chart-4 tabular-nums">
                                                        {l.liberadas} en limpieza
                                                    </span>
                                                )}
                                                {liberables === 0 && l.liberadas === 0 && (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </span>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Timeline de etapas + totales, en UNA línea ─────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <Hito etiqueta="Recepción" fecha={entrada.fecha} />
                <Hito etiqueta="Revisión" fecha={entrada.fecha_fin_rev} />
                <Hito etiqueta="Acondicionamiento" fecha={entrada.fecha_fin_acond} />
                <Hito etiqueta="Almacén" fecha={entrada.fecha_fin_almacen} />
                <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {totalProductos} {totalProductos === 1 ? 'producto' : 'productos'} ·{' '}
                    {entrada.piezas_total} pza · {entrada.piezas_aprobadas} aprobadas · DEV{' '}
                    {entrada.devolucion_total} · faltan {faltanTotal}
                </span>
            </div>
        </div>
    )
}

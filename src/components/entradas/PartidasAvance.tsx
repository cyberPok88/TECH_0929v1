'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS DE AVANCE — la tabla de los ÍTEMS de una entrada (Guía 1.6 · Fase 2)
//
// ⭐ EXTRACCIÓN 24 Sep 2026 (usuario) — el pedido: *«en la columna estado aparece la píldora
// del estado, en las que aparece en revisión técnica que sea un link para abrir modal para
// mostrar el avance de la revisión … en la etapa 2 se resuelve cómo mostrar la tabla de los
// detalles de los ítems»*. En vez de copiar la tabla del desglose del técnico, salió de la fila
// expandida —cuyo contenedor se retiró el 06 Oct 2026: su trabajo vive en `AvanceRevisionModal`—
// a este componente presentacional, y las DOS superficies la consumen:
//
//   · `AvanceRevisionModal` en la cola del TÉCNICO → el desglose con sus puertas (interactivo);
//   · `AvanceRevisionModal` desde **Recepción**    → el mismo avance en **solo lectura**.
//
// El contrato es el de la etapa: la huella que produjo la REVISIÓN (una línea por grupo — una
// partida de 100 discos puede rendir 2TB y 4TB: se pintan todas), el avance «revisadas/total» con
// barra de tramos, y la DEV **contada** («2 malas», no «Con malas»).
//
// ⚠️ En solo lectura NO se pintan controles muertos: sin `onVerDev` la píldora queda píldora, y
// sin `onIniciar`/`onVerResultado`/`onLiberar` la columna de acciones no existe. Un botón que no
// hace nada enseña a ignorar esa zona (SISTEMA_COMPONENTES §8).
//
// ⭐ EL DESGLOSE EN UN MODAL (Fase 2 · 06 Oct 2026 · mockup aprobado): el chevron de la cola de
// Revisión ya no despliega la fila — abre `AvanceRevisionModal`, que hospeda ESTE mismo componente
// con la prop **`enModal`** (el precedente exacto es `PartidasExpandidas enModal`, de Recepción).
// Lo que cambia con `enModal` es el REPARTO DEL ALTO y la JERARQUÍA, no el contenido:
//   (a) **Z1 sale del scroll** (`shrink-0`): folio, etapa, frase y las 4 puertas quedan fijos;
//   (b) **Z2 + Z3 scrollean**: el cuerpo toma el alto sobrante (`min-h-0 flex-1 overflow-y-auto`);
//   (c) **la dominante cede**: si el PIE del modal lleva la acción siguiente, la de la toolbar baja
//       a `outline` con la MISMA frase — una sola `default` por pantalla (SPEC §2.3);
//   (d) `tactil` **se reenvía**, jamás se deduce del ancho de pantalla (SPEC §1.1 · L8).
// ⚠️ NO se duplica el componente: es el mismo display en otra altura.
//
// ⭐ MEJORA 47 · LAS AYUDAS DE PANTALLA (06 Oct 2026): los `title` de esta superficie eran
// LITERALES inline — sus explicaciones **no se podían apagar**. Ahora viven en
// `config/ayudas/revision.ts` (claves `revision.detalle-*`) y se consumen con `useAyuda` (los que
// no dependen de la fila) o con `textoAyuda` (los que sí: la lista de hooks no puede estar dentro
// de un `.map()`). Lo que NO se cataloga —el DATO y la BANDERA— está dicho clave por clave en el
// registro.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { Eye, PackageCheck, Play, Printer } from 'lucide-react'

import { BotonDespliegue, Pildora } from '@/components/data-table'
import { CLASE_CAJA_TABLA, CLASE_THEAD_TABLA, CLASE_TH_TABLA } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { textoAyuda, useAyuda } from '@/components/ui/Ayuda'
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
import { useAuth } from '@/lib/stores/auth-store'
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
    /**
     * ⭐ 06 Oct 2026 (Fase 2 · Revisión) — **el desglose hospedado en un MODAL**, el mismo display
     * y la misma fuente (`AvanceRevisionModal` lo monta en vez de copiar una segunda versión).
     *
     * El precedente exacto es `PartidasExpandidas enModal`. Lo que cambia es el reparto del alto y
     * la jerarquía — (a) Z1 fuera del scroll, (b) Z2 + Z3 scrolleando, (c) la dominante baja a
     * `outline` porque el pie del diálogo lleva la acción siguiente, (d) `tactil` llega reenviado.
     * Fuera del modal nada de esto aplica: sigue siendo el bloque del acordeón de la fila.
     */
    enModal?: boolean
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

/**
 * ⭐ 06 Oct 2026 (Fase 2 · Revisión) — **LO QUE LA ENTRADA NECESITA AHORA**, en una sola
 * definición.
 *
 * Lo consumen DOS alturas del mismo hecho: la **toolbar de Z1** de este componente y el **pie del
 * modal** (`AvanceRevisionModal`). Si cada una lo derivara por su cuenta, el botón del pie y el de
 * la toolbar podrían decir cifras distintas de lo mismo — el defecto que el módulo ya pagó con los
 * encabezados de tabla. Por eso la regla vive acá y el modal la importa.
 *
 * Es una función PURA a propósito: no sabe de permisos (eso lo dice quién la llama, con `hay*`) ni
 * de textos (los `title` son ayudas de pantalla y se resuelven donde hay hooks).
 */
export interface ResumenAvance {
    /** Σ de aprobadas **sin liberar** de TODA la entrada: la cifra de `Liberar todo (n)`. */
    liberables: number
    /** La partida que todavía tiene piezas por revisar, o `null` si ya no queda ninguna. */
    partidaPendiente: PartidaConAvance | null
    /** Piezas que faltan por revisar en la entrada: la cifra de `Revisar (n)`. */
    faltan: number
    /**
     * La acción dominante —*lo que esta entrada necesita AHORA*: primero revisar (si quedan piezas)
     * y, si no, liberar (si hay aprobadas sin salir)— o `null` si no hay ninguna.
     */
    dominante: 'revisar' | 'liberar' | null
}

export function resumenAvance(
    entrada: Entrada,
    partidas: PartidaConAvance[],
    /** Las puertas que el CRUD le pasó a la superficie: sin ellas no hay acción que ofrecer. */
    puertas: { hayIniciar?: boolean; hayLiberar?: boolean } = {}
): ResumenAvance {
    const liberables = partidas.reduce(
        (s, p) =>
            s + p.huellas.reduce((t, h) => t + Math.max(0, h.cantidad_aprobada - h.cantidad_liberada), 0),
        0
    )
    const partidaPendiente = partidas.find((p) => p.restantes > 0) ?? null
    const faltan = Math.max(
        0,
        entrada.piezas_total - entrada.piezas_aprobadas - entrada.devolucion_total
    )
    const dominante: ResumenAvance['dominante'] =
        puertas.hayIniciar && partidaPendiente
            ? 'revisar'
            : puertas.hayLiberar && puedeLiberar(entrada.estado) && liberables > 0
              ? 'liberar'
              : null
    return { liberables, partidaPendiente, faltan, dominante }
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
    enModal = false,
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

    // ═══════════════════════════════════════════════════════════════════════════
    // ⚠️ LAS DERIVACIONES DE LA TOOLBAR VAN **ANTES** DE LOS `return` TEMPRANOS.
    //
    // No es estilo: abajo se consumen AYUDAS DE PANTALLA, y el estándar exige que los hooks se
    // llamen **todos y siempre** (uno dentro de un ternario o después de un `return` condicional
    // rompe el orden de los hooks — medido al cablear `ModalFormateo`). Y varios `title` llevan
    // la cifra o el folio de la fila, así que el hook necesita el valor ya calculado.
    // Son derivaciones PURAS (sin hooks): subirlas no cambia ningún comportamiento.
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * ⭐ MEJORA 30 — lo aprobado **sin liberar** de TODA la entrada: la cifra de «Liberar todo».
     * Es la Σ de las mismas cifras que ofrecen las filas de producto y de partida.
     * ⭐ 06 Oct 2026 — ahora sale del MISMO `resumenAvance` que el pie del modal: el botón del
     * desglose y el del diálogo no pueden decir cifras distintas del mismo hecho.
     */
    const resumen = useMemo(
        () =>
            resumenAvance(entrada, partidas, {
                hayIniciar: Boolean(onIniciar),
                hayLiberar: Boolean(onLiberar),
            }),
        [entrada, partidas, onIniciar, onLiberar]
    )
    const { liberables: liberablesEntrada, partidaPendiente, faltan: faltanTotal } = resumen
    /**
     * ⭐ MEJORA 34 — lo que gobierna la **toolbar de detalles**: si hay algo revisado (para ver/imprimir),
     * en qué partida sigue habiendo piezas por revisar (para `Revisar`) y **por qué** está apagada cada
     * acción. El motivo es parte del contrato: la SPEC §2.3 prohíbe deshabilitar sin decir por qué.
     *
     * ⚠️ Los `motivo*` son **BANDERA**, no ayuda: son el porqué de un control APAGADO y vaciarlos
     * dejaría el botón mudo. Por eso **no** se catalogan (clasificador del estándar · §1.2) y viven
     * acá, inline. Lo que SÍ se cataloga es el `title` del control **encendido**.
     */
    const hayRevision = entrada.piezas_aprobadas > 0 || entrada.devolucion_total > 0
    const puedeLiberarAqui = Boolean(onLiberar) && puedeLiberar(entrada.estado)
    const soloLectura = 'Esta vista es de solo lectura.'
    const motivoRevisar = !onIniciar ? soloLectura : 'La revisión ya terminó: no quedan piezas por revisar.'
    const motivoLiberar = !onLiberar
        ? soloLectura
        : !puedeLiberar(entrada.estado)
          ? 'La entrada ya avanzó: la liberación se hace en la etapa de Revisión.'
          : 'No hay piezas aprobadas sin liberar.'
    const motivoVer = hayRevision ? undefined : 'Todavía no hay nada revisado en esta entrada.'
    /** Sin puertas no hay columna de acciones. */
    const hayAcciones = Boolean(onIniciar || onVerResultado || onLiberar)
    /**
     * ⭐ MEJORA 34 — **jerarquía, no cuatro botones iguales** (SPEC §2.3: *«una sola `default` por
     * pantalla»*). La acción dominante es **lo que esta entrada necesita AHORA**, y la deriva
     * `resumenAvance` (la misma que consume el pie del modal). El resto son secundarias, y ver /
     * imprimir —lo menos frecuente— van discretas (`ghost`).
     */
    const dominante = resumen.dominante

    // ═══════════════════════════════════════════════════════════════════════════
    // ⭐ MEJORA 47 · LAS AYUDAS DE PANTALLA (06 Oct 2026 · mockup aprobado)
    //
    // Todo texto de esta superficie que **EXPLICA** —y no es el dato ni la etiqueta de un
    // control— se cataloga en `config/ayudas/revision.ts` (claves `revision.detalle-*`) y se
    // consume de ahí: el usuario las prende y apaga desde el interruptor, por módulo y categoría.
    //
    // ⚠️ DOS FORMAS, porque los textos viven en dos momentos distintos del render:
    //   · `useAyuda` — el `title` NO depende de la fila (las 4 puertas de Z1 y los 8 encabezados);
    //   · `textoAyuda` — el `title` SÍ depende de la fila que se está pintando (las acciones y las
    //     celdas de las filas de PARTIDA y de PRODUCTO). Ahí no se puede llamar un hook: el
    //     `.map()` no es un componente. `textoAyuda` es la tercera forma del estándar, y existe
    //     exactamente para esto.
    // ═══════════════════════════════════════════════════════════════════════════
    const preferenciasAyudas = useAuth((s) => s.usuario?.preferencias?.ayudas)

    // Z1 · la toolbar de avance (las 4 puertas)
    const ayudaRevisar = useAyuda('revision.detalle-revisar', {
        partida: partidaPendiente?.partida ?? '',
    })
    const ayudaLiberarTodo = useAyuda('revision.detalle-liberar-todo', { n: liberablesEntrada })
    const ayudaVer = useAyuda('revision.detalle-ver')
    const ayudaImprimir = useAyuda('revision.detalle-imprimir')

    // Z2 · los encabezados
    const ayudaThNumero = useAyuda('revision.detalle-th-numero')
    const ayudaThProducto = useAyuda('revision.detalle-th-producto')
    const ayudaThRecib = useAyuda('revision.detalle-th-recib')
    const ayudaThRevisadas = useAyuda('revision.detalle-th-revisadas')
    const ayudaThAprob = useAyuda('revision.detalle-th-aprob')
    const ayudaThDev = useAyuda('revision.detalle-th-dev')
    const ayudaThFaltan = useAyuda('revision.detalle-th-faltan')
    const ayudaThEstado = useAyuda('revision.detalle-th-estado')

    // Z2 · la celda de la fila de PARTIDA que explica de dónde sale lo que se lee
    const ayudaCeldaProductoPadre = useAyuda('revision.detalle-celda-producto-padre')

    if (cargando) return <Spinner etiqueta="Cargando partidas…" className="py-1" />
    if (partidas.length === 0) return <p className="text-sm text-muted-foreground">Sin partidas.</p>

    return (
        // ⭐ 06 Oct 2026 — CON `enModal` EL DESGLOSE LLENA SU HUECO: el diálogo le da una altura
        // definida (una fila que scrollea) y acá adentro **Z1 queda fuera de ese scroll**
        // (`shrink-0`) mientras **Z2 + Z3** son el cuerpo que scrollea. Sin `enModal` —la fila
        // expandida— el componente sigue siendo un bloque que crece con su contenido.
        <div className={cn('flex flex-col gap-3', enModal && 'h-full min-h-0', className)}>
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
                    // ⭐ 06 Oct 2026 (decisión del dueño, D3.c) — LA TINTA DE LA TOOLBAR SE COPIA
                    // DE RECEPCIÓN: la del módulo (`bg-primary-bg`) y su borde, en vez del
                    // `surface-raised` que la dejaba casi del color del modal. Los dos desgloses
                    // del módulo se leen igual.
                    'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-primary/30 bg-primary-bg px-3 py-2.5 shadow-premium-sm',
                    // ⭐ FIX 30-bis — en puesto de dedo, 44 (SPEC §1.1/§2.3) sin tocar el kit.
                    tactil && '[&_button]:min-h-11',
                    // ⭐ 06 Oct 2026 — Z1 NO SE MUEVE: es la identidad y las puertas de la entrada
                    // que se está leyendo. Con 20 partidas el cuerpo scrollea y esta barra queda.
                    enModal && 'shrink-0'
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
                        // ⭐ 06 Oct 2026 — CON `enModal` CEDE: el pie del diálogo lleva la acción
                        // siguiente (misma frase, misma cifra), y dos `default` en la misma pantalla
                        // son la ley que se rompe. Baja a `outline` — y como la toolbar ahora tiene
                        // tinta propia, necesita su propio relleno.
                        variant={!enModal && dominante === 'revisar' ? 'default' : 'outline'}
                        size="sm"
                        disabled={!onIniciar || !partidaPendiente}
                        onClick={() => partidaPendiente && onIniciar?.(partidaPendiente.id)}
                        // ⭐ MEJORA 47 — el `title` del control ENCENDIDO se cataloga; el porqué
                        // del apagado (`motivoRevisar`) es BANDERA y vive inline.
                        title={partidaPendiente ? ayudaRevisar : motivoRevisar}
                    >
                        <Play className="mr-1 h-3.5 w-3.5" /> Revisar ({faltanTotal})
                    </Button>
                    <Button
                        type="button"
                        // ⭐ Mismo criterio que la puerta de arriba: con `enModal` la dominante vive
                        // en el pie del diálogo (`AvanceRevisionModal`), no acá.
                        variant={!enModal && dominante === 'liberar' ? 'default' : 'outline'}
                        size="sm"
                        disabled={!puedeLiberarAqui || liberablesEntrada === 0}
                        onClick={() => onLiberar?.(entrada, null)}
                        // ⭐ MEJORA 47 — encendido va la ayuda; apagado, el porqué (bandera).
                        title={liberablesEntrada > 0 && puedeLiberarAqui ? ayudaLiberarTodo : motivoLiberar}
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
                        title={hayRevision ? ayudaVer : motivoVer}
                    >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Ver revisión completa
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!hayRevision}
                        onClick={() => setImprimir(true)}
                        title={hayRevision ? ayudaImprimir : motivoVer}
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
            {/* ⭐ 06 Oct 2026 (b) — **Z2 SCROLLEA**. Con `enModal`, ESTE contenedor se queda con el
                alto sobrante y su propio `overflow-y: auto` (el `overflow-hidden` de la caja sigue
                gobernando el eje X y las esquinas redondeadas, así que la barra va adentro). Con el
                contenido corto la caja abraza sus filas —como la dibuja el mockup—; con 20 partidas
                se encoge (`min-h-0`) y scrollea, y **Z1 y Z4 no se mueven**. El `<thead>` del cromo
                ya es `sticky`, así que los encabezados viajan dentro de este scroll. */}
            <div
                className={cn(
                    CLASE_CAJA_TABLA,
                    'shadow-premium-sm',
                    enModal && 'min-h-0 shrink overflow-y-auto'
                )}
            >
                {/* ⚠️ `border-collapse`: sin él la tabla usa el default `separate`, y en el modelo
                    de bordes SEPARADOS los bordes de un `<tr>` NO se pintan — las reglas de fila
                    que ya estaban escritas (`border-t`) eran invisibles. Mismo arreglo que
                    `PartidasExpandidas`: es el mismo desglose en el otro puesto. */}
                <table className="w-full border-collapse text-[12.5px]">
                    <thead className={CLASE_THEAD_TABLA}>
                        <tr>
                            <th
                                className={cn(TH, 'w-14')}
                                title={ayudaThNumero}
                            >
                                #
                            </th>
                            <th
                                className={cn(TH, 'text-left')}
                                title={ayudaThProducto}
                            >
                                Producto
                            </th>
                            <th
                                className={cn(TH, 'w-16')}
                                title={ayudaThRecib}
                            >
                                Recib.
                            </th>
                            <th
                                className={cn(TH, 'w-32')}
                                title={ayudaThRevisadas}
                            >
                                Revisadas
                            </th>
                            <th
                                className={cn(TH, 'w-16')}
                                title={ayudaThAprob}
                            >
                                Aprob.
                            </th>
                            <th
                                className={cn(TH, 'w-24')}
                                title={ayudaThDev}
                            >
                                DEV
                            </th>
                            <th
                                className={cn(TH, 'w-16')}
                                title={ayudaThFaltan}
                            >
                                Faltan
                            </th>
                            <th
                                className={cn(TH, 'w-28')}
                                title={ayudaThEstado}
                            >
                                Estado
                            </th>
                            {hayAcciones && (
                                // ⭐ MEJORA 34 (usuario) — la fila de PARTIDA lleva DOS puertas con
                                // etiqueta (`Ver revisión` + `Liberar n`): 112px no las contiene y los
                                // botones se apretaban. La columna pasa a 240px y el desglose se ensancha
                                // (el ancho tope lo fija hoy `AvanceRevisionModal`: 1280 medidos).
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
                                                title={ayudaCeldaProductoPadre}
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
                                                        // ⭐ MEJORA 47 — la ayuda de la fila se resuelve
                                                        // con `textoAyuda`: lleva el número y la partida
                                                        // de ESTA fila, y un hook no puede vivir en un `.map()`.
                                                        title={textoAyuda(
                                                            'revision.detalle-ver-dev-partida',
                                                            preferenciasAyudas,
                                                            {
                                                                objeto:
                                                                    p.dev_cantidad === 1
                                                                        ? 'la devolución'
                                                                        : `las ${p.dev_cantidad} devoluciones`,
                                                                partida: p.partida,
                                                            }
                                                        )}
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
                                                                  title={textoAyuda(
                                                                      'revision.detalle-revisar-partida',
                                                                      preferenciasAyudas,
                                                                      {
                                                                          partida: p.partida,
                                                                          n: p.restantes,
                                                                      }
                                                                  )}
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
                                                                title={textoAyuda(
                                                                    'revision.detalle-liberar-partida',
                                                                    preferenciasAyudas,
                                                                    {
                                                                        n: liberablesPartida,
                                                                        partida: p.partida,
                                                                    }
                                                                )}
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
                                            // ⭐ MEJORA 47 — se cataloga el `title` de una línea que
                                            // viene de una partida MÚLTIPLE (explica de dónde sale el
                                            // consecutivo). El de una línea normal («Partida 3») nombra
                                            // el dato a secas y NO se cataloga.
                                            l.partidaMultiple
                                                ? textoAyuda(
                                                      'revision.detalle-celda-linea',
                                                      preferenciasAyudas,
                                                      { n: l.numero, partida: p.partida }
                                                  )
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
                                                title={textoAyuda(
                                                    'revision.detalle-celda-producto-hijo',
                                                    preferenciasAyudas,
                                                    {
                                                        huella: huellaDeclarada(
                                                            p.categoria_nombre,
                                                            p.atributos
                                                        ),
                                                    }
                                                )}
                                            >
                                                {huellaDeclarada(p.categoria_nombre, p.atributos)} · sin revisar
                                            </span>
                                        ) : (
                                            <span
                                                className="font-semibold"
                                                title={textoAyuda(
                                                    'revision.detalle-celda-producto-hijo',
                                                    preferenciasAyudas,
                                                    {
                                                        huella: huellaDeclarada(
                                                            p.categoria_nombre,
                                                            p.atributos
                                                        ),
                                                    }
                                                )}
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
                                                    // ⭐ MEJORA 47 — la ayuda de ESTA fila (lleva el
                                                    // número, la marca y la partida): `textoAyuda`, no
                                                    // `useAyuda` — un hook no puede vivir en un `.map()`.
                                                    title={textoAyuda(
                                                        'revision.detalle-ver-dev',
                                                        preferenciasAyudas,
                                                        {
                                                            objeto:
                                                                dev === 1
                                                                    ? 'la devolución'
                                                                    : `las ${dev} devoluciones`,
                                                            marca: l.marcaNombre ?? 'este producto',
                                                            partida: p.partida,
                                                        }
                                                    )}
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
                                                                title={textoAyuda(
                                                                    'revision.detalle-liberar-producto',
                                                                    preferenciasAyudas,
                                                                    { n: liberables }
                                                                )}
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
            {/* ⭐ 06 Oct 2026 — Z3 (la barra de etapas + el resumen) es `shrink-0`: con el cuerpo
                scrolleando, el timeline y sus totales siguen a la vista. */}
            <div
                className={cn(
                    'flex flex-wrap items-center gap-x-4 gap-y-1.5',
                    enModal && 'shrink-0'
                )}
            >
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

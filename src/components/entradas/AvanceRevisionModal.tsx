'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AVANCE DE LA REVISIÓN — el desglose de una entrada, en un MODAL (Guía 1.6 · Fase 2)
//
// ⭐ MEJORA 24 Sep 2026 (usuario) — nació como la **puerta de la píldora «En revisión técnica»** de
// RECEPCIÓN: *«en la columna estado aparece la píldora del estado, en las que aparece en revisión
// técnica que sea un link para abrir modal para mostrar el avance de la revisión»*. Desde ahí se
// invoca en **solo lectura**: Recepción no revisa, necesita saber **cuánto lleva** el técnico sin
// salir de su cola.
//
// ⭐ 06 Oct 2026 (Fase 2 · mockup aprobado `DOCS/design/entradas/02-revision/01-detalle-revision.html`)
// — **D1-A: UNIFICAR.** El chevron de la cola de Revisión ya no despliega la fila: abre **ESTE
// MISMO** modal, ahora **interactivo** («una superficie, dos profundidades»). Dos tablas distintas
// para el mismo avance serían dos maneras de mentir.
//
// 🔴 G7 — LAS 4 PUERTAS LLEGAN **POR PROPS DEL CRUD**, NO DESDE ACÁ. `PartidasAvance` ya es
// presentacional y decide `hayAcciones` por lo que recibe; el modal no las inventa ni las deduce.
// ⇒ la invocación desde **Recepción** (que no las pasa) sigue siendo de SOLO LECTURA sin una línea
// de más, y la de **Revisión** (que sí las pasa) pinta la columna de Acciones. El modal **no mira
// permisos** (`useCanAction` no entra acá): el estado del proceso vive donde están sus efectos
// (SPEC §5③).
//
// ⚠️ LA ANATOMÍA (gate G3, medido) — **el modal NO puede arrastrar el pie**. Se descarta su forma
// vieja (`max-h-[92vh] overflow-y-auto sm:max-w-4xl`: con ese patrón scrollea TODO, incluido el pie,
// y con 6 partidas el «Cerrar» se va de la pantalla). Nace con la anatomía que estrenó el detalle de
// Recepción (`EntradaDetalleModal`): `overflow-hidden` + columna flex, **la fila del cuerpo en
// `min-h-0 flex-1`** (el equivalente flex de `minmax(0,1fr)`), encabezado y pie `shrink-0`.
//
// ⚠️ LAS 4 ZONAS (Z1–Z4) LAS PINTA EL DESGLOSE HOSPEDADO (`PartidasAvance` con `enModal`): Z1 la
// toolbar de avance (fija: folio · etapa · la frase y las 4 puertas), Z2 la tabla (scrollea), Z3 el
// timeline y el resumen (fijos abajo) y **Z4 este pie**. Una sola fuente del display, nunca dos
// versiones: el resumen «n/m revisadas» que este modal pintaba por su cuenta se retiró de la vista
// INTERACTIVA —ahí sus cifras son las del pie de Z3 y repetirlas es el defecto medido— y **se
// repuso, condicionado, en la de SOLO LECTURA** (decisión del dueño, 06 Oct 2026): ver `hayAcciones`.
//
// ⚠️ `tactil` SE **REENVÍA**, jamás se deduce del ancho de pantalla (SPEC §1.1 · L8): la densidad
// la fija el PUESTO. Revisión se opera con el dedo y lo declara al abrirlo; Recepción se opera con
// ratón y no lo pasa — y eso es correcto, no un defecto (SPEC §1.1: Recepción queda declarada en
// densidad de ESCRITORIO).
//
// ⚠️ Carga SIN `setState` sincrónico en el efecto (regla `react-hooks/set-state-in-effect`): el
// padre lo monta con `key` calificada por entrada, así que cada apertura es un montaje nuevo y
// «cargando» es simplemente `partidas === null` (lo pinta el propio desglose). Mismo patrón que
// `AjusteDevModal`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PackageCheck, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAyuda } from '@/components/ui/Ayuda'
import { BarraAvance } from '@/components/entradas/columnas-entrada'
import { PartidasAvance, resumenAvance } from '@/components/entradas/PartidasAvance'
import { listarPartidasConAvance } from '@/lib/actions/entradas'
import type { Entrada, PartidaConAvance } from '@/types/entradas'

interface AvanceRevisionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    /**
     * ⭐ G7 — **las puertas del CRUD**, reenviadas al desglose tal cual. Sin ellas (Recepción no las
     * pasa) la superficie es de **solo lectura**: `PartidasAvance` no pinta la columna de Acciones.
     */
    onIniciar?: (idPartida: string) => void
    onVerDev?: (entrada: Entrada, idPartida: string) => void
    onVerResultado?: (entrada: Entrada) => void
    onLiberar?: (entrada: Entrada, idPartida: string | null, idGrupo?: string) => void
    /** ⭐ La densidad del PUESTO que abre el modal (SPEC §1.1): se reenvía, no se deduce. */
    tactil?: boolean
    /**
     * ⭐ G8 — **el desglose le PRESTA sus datos a la toolbar de la PÁGINA**.
     *
     * «Imprimir revisión» (la toolbar de la página) se activa cuando hay un detalle abierto, y hasta
     * hoy esos datos los prestaba el `onDatos` de la fila expandida, contenedor retirado el 06 Oct
     * 2026 (su trabajo vive en este modal). Sin una fuente nueva, el botón quedaba **apagado para
     * siempre**. El contrato es el MISMO que traía aquel contenedor: `datos = null` significa
     * *«este detalle se cerró»* (si no, la toolbar se queda con la última entrada y su botón sigue
     * activo imprimiendo esa).
     *
     * ⚠️ Quien lo pase debe **memoizarlo** (`useCallback`): entra en las dependencias del efecto.
     */
    onDatos?: (
        idEntrada: string,
        datos: { entrada: Entrada; partidas: PartidaConAvance[] } | null
    ) => void
    /**
     * ⭐ Contador de refresco (el contrato que traía el contenedor retirado el 06 Oct 2026): cada vez
     * que algo cambia lo que el desglose pinta —una liberación, el ajuste de la DEV, el wizard—
     * quien lo hospeda lo incrementa y el efecto **vuelve a consultar**. Sin él, el desglose se
     * queda con los datos del montaje y sigue ofreciendo puertas que ya no corresponden (FIX 25 Sep 2026).
     */
    refresco?: number
}

export function AvanceRevisionModal({
    open,
    onOpenChange,
    entrada,
    onIniciar,
    onVerDev,
    onVerResultado,
    onLiberar,
    tactil = false,
    onDatos,
    refresco = 0,
}: AvanceRevisionModalProps) {
    /** `null` = todavía no llegó (es el estado «cargando», no un booleano aparte). */
    const [partidas, setPartidas] = useState<PartidaConAvance[] | null>(null)

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void listarPartidasConAvance(entrada.id).then((r) => {
            if (!activo) return
            const datos = r.success ? (r.data ?? []) : []
            setPartidas(datos)
            // ⭐ G8 — se los presta a la toolbar de la página (ver `onDatos`).
            onDatos?.(entrada.id, { entrada, partidas: datos })
        })
        return () => {
            activo = false
            // ⭐ G8 — el detalle se cerró: la toolbar de la página debe **soltar** esta entrada (si
            // no, su botón seguiría activo imprimiendo el acta de la que ya no se ve).
            onDatos?.(entrada.id, null)
        }
        // ⚠️ `refresco` en las dependencias: es lo que hace que una liberación (o un guardado del
        // wizard) se vea en el desglose SIN cerrar y volver a abrir el modal.
    }, [open, entrada, refresco, onDatos])

    /**
     * ⭐ La acción que la entrada necesita AHORA, con la MISMA función que usa la toolbar de Z1
     * (`resumenAvance`): el botón del pie y el de la toolbar no pueden decir cifras distintas del
     * mismo hecho. Es lo que hace que Z1 **ceda la dominante** (`PartidasAvance enModal`) cuando el
     * pie la lleva — una sola `default` por pantalla (SPEC §2.3).
     */
    const resumen = useMemo(
        () =>
            entrada
                ? resumenAvance(entrada, partidas ?? [], {
                      hayIniciar: Boolean(onIniciar),
                      hayLiberar: Boolean(onLiberar),
                  })
                : null,
        [entrada, partidas, onIniciar, onLiberar]
    )
    const pendiente = resumen?.partidaPendiente ?? null

    /**
     * ⭐ **LA TIRA DE RESUMEN, SÓLO EN LA VISTA DE SOLO LECTURA** (restituida 06 Oct 2026 por
     * decisión del dueño, sobre el comparativo `DOCS/design/entradas/02-revision/02-comparativa-resumen-y-huerfano.html` §①).
     *
     * **Por qué está condicionada**: la tira es la MISMA cifra que el pie de Z3 (`PartidasAvance`
     * `enModal`), y el desglose la pinta SIEMPRE. En la vista INTERACTIVA —la del chevron de
     * Revisión— repetirla arriba y abajo es el defecto que el comparativo midió; en la de SOLO
     * LECTURA —la píldora «En revisión técnica» de Recepción— el dueño decidió que el avance de la
     * entrada se lea primero, sin bajar a la tabla.
     *
     * **De dónde salió el bloque**: es el fragmento ① que se **retiró literalmente al unificar el
     * modal** (06 Oct 2026, MISMO día) y que seguía en el diff sin commitear de
     * `AvanceRevisionModal.tsx` —markup y clases carácter por carácter—. El fragmento ② (el ternario
     * de carga/vacío) **no se repone**: el desglose ya pinta «Cargando partidas…» / «Sin partidas.».
     *
     * ⚠️ `hayAcciones` es el MISMO criterio del desglose (`PartidasAvance:303`): «solo lectura» tiene
     * **una sola definición** en el módulo y no dos.
     */
    const hayAcciones = Boolean(onIniciar || onVerResultado || onLiberar)
    const lista = partidas ?? []
    const recibidas = lista.reduce((s, p) => s + p.cantidad_original, 0)
    const revisadas = lista.reduce((s, p) => s + p.revisadas, 0)
    const aprobadas = lista.reduce((s, p) => s + p.aprobadas, 0)
    const dev = lista.reduce((s, p) => s + p.dev_cantidad, 0)
    const liberadas = lista.reduce((s, p) => s + p.liberadas, 0)
    const faltan = Math.max(0, recibidas - revisadas)

    // ⭐ MEJORA 47 — la MISMA ayuda que la puerta de Z1 (la frase es idéntica en las dos alturas):
    // el `title` del control ENCENDIDO se cataloga; el porqué del apagado es bandera y vive inline.
    const ayudaRevisar = useAyuda('revision.detalle-revisar', {
        partida: pendiente?.partida ?? '',
    })
    const ayudaLiberarTodo = useAyuda('revision.detalle-liberar-todo', {
        n: resumen?.liberables ?? 0,
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                // ⭐ D3.a — el velo de Recepción: el kit ya acepta el velo POR MODAL
                // (`overlayClassName`) y ESTE pide el desenfoque suave. `bg-black/80` se queda: el
                // velo no cambia de color, cambia de textura (en Piedra Solar el 80 % de negro
                // sobre una tabla casi blanca era un corte duro, y el MISMO módulo no puede tener
                // dos velos).
                overlayClassName="backdrop-blur-[2px]"
                // ⭐ G3 — `overflow-hidden` + columna flex: el scroll vive en la fila del cuerpo.
                // ⭐ G4 — **1280px MEDIDOS**: deja 1232 útiles ≥ los umbrales del mockup (la toolbar
                // de Z1 pide 1112 con la frase viva y 1184 con su peor rama; la fila de producto
                // 1074). 6xl (1104) NO alcanza: la toolbar envuelve por 8px. ⚠️ El ancho NO se toca
                // sin volver a medir (mismo gate que el detalle de Recepción).
                className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]"
            >
                {/* ⭐ D3.b — la cabecera de Recepción: el folio ya vive en Z1 (a tres líneas), así
                    que un título visible lo repetiría (L6); el `sr-only` sostiene la accesibilidad
                    (Radix exige un `DialogTitle`) y el retroceso va VISIBLE (ley L13, 44px). */}
                <DialogHeader className="shrink-0 border-b border-border pb-3 pl-6 pr-12 pt-4">
                    <DialogTitle className="sr-only">Detalle de la revisión</DialogTitle>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-fit min-h-11 px-3.5 text-[14px]"
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                </DialogHeader>

                {/* ── LA FILA QUE SCROLLEA (Z1 + Z2 + Z3, del desglose hospedado) ────────────
                    `min-h-0 flex-1`: el `PartidasAvance` con `enModal` se estira a este alto y
                    scrollea ADENTRO — Z1 (`shrink-0`) y Z3 (`shrink-0`) quedan fuera del scroll. El
                    `key` por entrada es el patrón del repo: cada entrada abre su propio estado y
                    «Cargando partidas…» arranca limpio sin un `setState` dentro del efecto. */}
                <div className="flex h-full min-h-0 flex-col gap-3 px-6">
                    {/* ⭐ ① LA TIRA DE RESUMEN — **sólo sin puertas** (ver `hayAcciones` arriba):
                        en la vista interactiva estas cifras ya están en el pie de Z3 y repetirlas es
                        el defecto medido; en la de solo lectura (Recepción) es el número que la
                        píldora no dice. Bloque **literal** del diff de la unificación. */}
                    {entrada && !hayAcciones && partidas !== null && partidas.length > 0 && (
                        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-surface-2 px-3 py-2.5">
                            <span className="flex items-baseline gap-1 text-[18px] font-semibold tabular-nums">
                                {revisadas}
                                <span className="text-[13px] font-normal text-muted-foreground">
                                    /{recibidas}
                                </span>
                            </span>
                            <BarraAvance
                                aprobadas={aprobadas}
                                dev={dev}
                                total={recibidas}
                                liberadas={liberadas}
                            />
                            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                                revisadas · {aprobadas} aprobadas · DEV {dev}
                                {liberadas > 0 ? ` · ${liberadas} liberadas` : ''} · faltan {faltan}
                            </span>
                        </div>
                    )}
                    {entrada && (
                        <PartidasAvance
                            key={entrada.id}
                            entrada={entrada}
                            partidas={partidas ?? []}
                            cargando={partidas === null}
                            enModal
                            // ⭐ (d) — la densidad del PUESTO llega reenviada; el desglose jamás la
                            // deduce del ancho de la pantalla.
                            tactil={tactil}
                            onIniciar={onIniciar}
                            onVerDev={onVerDev}
                            onVerResultado={onVerResultado}
                            onLiberar={onLiberar}
                        />
                    )}
                </div>

                {/* ── Z4 · EL PIE FIJO ───────────────────────────────────────────────────────
                    `Cerrar` (52) + **la acción siguiente** (56) — *sólo si corresponde*: si no hay
                    nada que hacer, el pie es SÓLO `Cerrar` y no se inventa una acción. Es la misma
                    anatomía y la misma jerarquía del detalle de Recepción («Cerrar» + la
                    dominante), y por eso `PartidasAvance enModal` baja su dominante a `outline`:
                    **una sola `default` por pantalla** (SPEC §2.3), con la MISMA frase y la misma
                    cifra en las dos alturas. */}
                <DialogFooter className="shrink-0 gap-2 border-t border-border bg-surface-2 px-6 py-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-h-[52px] bg-surface-raised px-5 text-[15px] shadow-premium-sm"
                    >
                        Cerrar
                    </Button>
                    {entrada && resumen?.dominante === 'revisar' && pendiente && (
                        <Button
                            type="button"
                            onClick={() => onIniciar?.(pendiente.id)}
                            title={ayudaRevisar}
                            className="min-h-[56px] gap-2 px-6 text-[16px] font-semibold shadow-premium-md"
                        >
                            <Play className="h-4 w-4" aria-hidden="true" />
                            Revisar ({resumen.faltan})
                        </Button>
                    )}
                    {entrada && resumen?.dominante === 'liberar' && (
                        <Button
                            type="button"
                            onClick={() => onLiberar?.(entrada, null)}
                            title={ayudaLiberarTodo}
                            className="min-h-[56px] gap-2 px-6 text-[16px] font-semibold shadow-premium-md"
                        >
                            <PackageCheck className="h-4 w-4" aria-hidden="true" />
                            Liberar todo ({resumen.liberables})
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

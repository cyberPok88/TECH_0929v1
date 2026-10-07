'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRADA DETALLE MODAL — el desglose de la entrada, sin mover la tabla (Guía 1.6 · Fase 1)
//
// ⭐ MEJORA 05 Oct 2026 (usuario) — *«el chevron no despliega toda esa información —la toolbar
// de detalles, los encabezados, fila de partidas, fila de producto, todo, acciones— que lo
// muestre en un modal nuevo, que oculte o ponga borroso lo de atrás.»*
//
// Antes el desglose vivía DENTRO de la fila (`renderFilaExpandida` → `PartidasExpandidas`) y
// **competía con la lista**: empujaba la tabla hacia abajo (≈260px con una partida, ≈1100px con
// 16), teñía la fila y perdía el scroll donde estabas. El modal lleva a su conclusión la decisión
// del acordeón (MEJORA 34: «los detalles son siempre uno»).
//
// ⚠️ ES PRESENTACIONAL (SPEC §5③ · *el estado del proceso vive donde están sus efectos*): NO
// carga nada, NO sabe de permisos y NO dispara nada por su cuenta — recibe la entrada ya elegida
// y reenvía las **mismas 4 acciones** que ya existían (`RecepcionCatalogo` es quien las resuelve):
//     Ajustar + nota     → AjusteDevModal (ver + ajustar + generar la nota)
//     Etapas del ingreso → EtapasIngresoModal (solo lectura)
//     Ver nota           → NotaCompraDetalleModal (dueño 1.4)
//     Imprimir nota      → el papel de la nota de entrada (carril PLANTILLA · 2.1)
// Ni un botón, ni un campo, ni un permiso, ni una ruta nuevos.
//
// ⚠️ LAS 4 ZONAS (SPEC §3) Y EL REPARTO DEL ALTO (gate G3 medido):
//     Z1 · la toolbar de detalles  → FIJA (la pinta `PartidasExpandidas` con `enModal`, dentro de
//                                    la fila que NO scrollea: folio, etapa, frase y las 4 puertas)
//     Z2 · la tabla de partidas    → scrollea (es el cuerpo: con 16 partidas el cuerpo se mueve)
//     Z3 · la barra de etapas      → scrollea al final del cuerpo
//     Z4 · el pie                  → FIJO (este pie: `Cerrar` + la dominante)
//   ⚠️ NO se usa `max-h-[92vh] overflow-y-auto` (el patrón de `EtapasIngresoModal` /
//   `NotaCompraDetalleModal`): con ese patrón **scrollea todo, incluido el pie**. Acá el diálogo
//   es `overflow-hidden` + columna flex y **la fila del cuerpo es `min-h-0 flex-1`** — el
//   equivalente flex de `minmax(0,1fr)`: puede encogerse por debajo de su contenido y se queda
//   con el alto que sobra, así que el scroll vive DENTRO y Z1/Z4 nunca se mueven.
//
// ⚠️ DESVIACIONES DECLARADAS DEL MOCKUP (medidas por el propio mockup, no silenciadas):
//   ① **Z3 no es una puerta.** El SPEC §3 dice que la barra de etapas lo es; medido, los 4 `Hito`
//      son `<span>` sin `onClick` ⇒ la puerta es el botón **«Etapas del ingreso» de Z1**. Hacer la
//      barra clicable sería una afordancia nueva (con `role`/foco/teclado) y este pedido no la
//      incluye.
//   ② **El nombre accesible del chevron dice el folio** («Desplegar ING-0001») vía
//      `DataTable.etiquetaFila`; el mockup dibujó «Abrir el detalle de ING-0003». El verbo lo pone
//      el kit (`BotonDespliegue`) y el CRUD aporta el sujeto — la parte que estaba rota (el UUID).
//
// Una sola fuente del display: el contenido NO se duplica, es el MISMO `PartidasExpandidas`.
// Precedente del repo: `NotaCompraDetalleModal` hospedando `NotaCompraFicha` con `enModal`.
// ═══════════════════════════════════════════════════════════════════════════════

import { ArrowLeft, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { PartidasExpandidas } from '@/components/entradas/PartidasExpandidas'
import { devPendiente } from '@/components/entradas/columnas-entrada'
import type { Entrada } from '@/types/entradas'

interface EntradaDetalleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** La entrada cuyo desglose se está mirando; `null` mientras no se elige ninguna. */
    entrada: Entrada | null
    /** Abre el modal de la DEV (ver + ajustar + generar nota). Mismo handler que la fila. */
    onAjustar?: (e: Entrada) => void
    /** Abre «Etapas del ingreso» (las 4 etapas, solo lectura). */
    onVerEtapas?: (e: Entrada) => void
    /** Abre la nota de compra (solo si ya se generó). */
    onVerNota?: (e: Entrada) => void
    /** Imprime la nota de entrada de ESTA entrada. */
    onImprimir?: (e: Entrada) => void
    /** Avisa a la página cuál es el detalle abierto: su toolbar imprime la nota de ESA entrada. */
    onExpandida?: (e: Entrada) => void
}

export function EntradaDetalleModal({
    open,
    onOpenChange,
    entrada,
    onAjustar,
    onVerEtapas,
    onVerNota,
    onImprimir,
    onExpandida,
}: EntradaDetalleModalProps) {
    // La MISMA fuente que usa la toolbar de detalles para decidir si hay dominante
    // (`devPendiente` de `columnas-entrada`): el botón y el servidor no pueden discrepar.
    const puedeAjustar = Boolean(entrada && devPendiente(entrada) && onAjustar)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                // ⭐ G2 · velo B (decisión D1): el kit ya acepta el velo por modal y ESTE pide el
                // desenfoque suave. `bg-black/80` se queda: el velo no cambia de color, cambia de
                // textura (en Piedra Solar el 80 % de negro sobre tabla clara era un corte duro).
                overlayClassName="backdrop-blur-[2px]"
                // ⭐ G3 · `p-0` porque el encabezado, el cuerpo y el pie traen su propio aire, y
                // `overflow-hidden` porque el scroll vive en la fila del cuerpo, no acá.
                // ⭐ D2 · 6xl MEDIDO (1152 ⇒ 1102 útiles): en 5xl la toolbar de Z1 envuelve por 50px
                // y la huella de producto por 90px (fila de 59px). Sólo 6xl cumple las dos cosas.
                // ⚠️ G5 (gate de MEDICIÓN): esas cuentas se hicieron con los iconos REALES del kit
                // —16px, `[&_svg]:size-4` de `button.tsx:29`— y no con 14px: la diferencia son 29px
                // de umbral (978 vs 1024). Si acá se achicara el ancho, el número se vuelve a medir.
                // ⭐ 05 Oct 2026 (dueño, fix de diseño) — **6xl → 1280px (+11 %)** para PAGAR el
                // `px-6` interno que el contenido pedía: la tabla y Z1 tocaban los bordes del modal.
                // Con los 48px del padding quedan **1232 útiles ≥ los umbrales medidos** (Z1 1024 ·
                // Z2 1064) ⇒ nada se envuelve. El ancho NO se toca sin volver a medir (gate G5).
                className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]"
            >
                <DialogHeader className="shrink-0 border-b border-border pb-3 pl-6 pr-12 pt-4">
                    {/* ⭐ D4 · encabezado A: el folio ya vive en Z1 (a tres líneas) — un título
                        visible lo repetiría (L6). El `sr-only` sostiene la accesibilidad (Radix
                        exige un `DialogTitle`) y el retroceso va VISIBLE (ley L13). */}
                    <DialogTitle className="sr-only">Detalle de la entrada</DialogTitle>
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

                {/* ── LA FILA QUE SCROLLEA (Z2 + Z3) ──────────────────────────────────────
                    `min-h-0 flex-1`: el `PartidasExpandidas` con `enModal` se estira a este alto
                    y scrollea ADENTRO (Z1 queda fuera). El `key` por entrada es el patrón del
                    repo: cada entrada abre su propio estado y «Cargando partidas…» arranca limpio
                    sin un `setState` dentro del efecto. */}
                <div className="min-h-0 flex-1 px-6">
                    {entrada && (
                        <PartidasExpandidas
                            key={entrada.id}
                            entrada={entrada}
                            enModal
                            onAjustar={onAjustar}
                            onVerEtapas={onVerEtapas}
                            onVerNota={onVerNota}
                            onImprimir={onImprimir}
                            onExpandida={onExpandida}
                        />
                    )}
                </div>

                {/* ── Z4 · EL PIE FIJO (decisión D3, opción A) ────────────────────────────
                    `Cerrar` + la acción siguiente. Es la anatomía de los modales del módulo
                    (`EtapasIngresoModal` cierra con el mismo `Cerrar` de 52). Si la dominante
                    vive acá, la de Z1 baja a `outline` (`PartidasExpandidas enModal`): **una sola
                    `default` por pantalla** (SPEC §2.3). En el estado sin DEV la dominante no
                    existe y el pie es SÓLO `Cerrar` — no se inventa una acción que no toca. */}
                <DialogFooter className="shrink-0 gap-2 border-t border-border bg-surface-2 px-6 py-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-h-[52px] bg-surface-raised px-5 text-[15px] shadow-premium-sm"
                    >
                        Cerrar
                    </Button>
                    {puedeAjustar && entrada && (
                        <Button
                            type="button"
                            onClick={() => onAjustar?.(entrada)}
                            className="min-h-[56px] gap-2 px-6 text-[16px] font-semibold shadow-premium-md"
                        >
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            Ajustar + nota ({entrada.devolucion_total})
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

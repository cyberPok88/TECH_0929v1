'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ACONDICIONAMIENTO · DETALLE — el desglose del ingreso, en un MODAL (Guía 1.6 · Fase 3)
//
// ⭐ 06 Oct 2026 (dueño · mockup aprobado
// `DOCS/design/entradas/03-acondicionamiento/01-detalle-acondicionamiento.html` · decisión **D1-A**)
// — **EL CHEVRON YA NO DESPLIEGA LA FILA: ABRE ESTE MODAL**, que hospeda `BandejasDeIngreso` con la
// prop `enModal`. Es la **tercera** aplicación del patrón del módulo (Recepción 05 Oct · Revisión
// 06 Oct · esta) y la MISMA doctrina: **una sola fuente del display, nunca dos versiones** — el
// contenido no se duplica, es la misma pieza que Almacén ya usa.
//
// ⚠️ NO se unificó con ninguno de los 2 modales que la fase ya tenía, y es una decisión del dueño
// (D1-A, con B y C enfrentadas y medidas): `AcondicionamientoModal` es el cierre del **DOCUMENTO**
// (su dominante ejecuta `tomarAcondicionamiento`/`completarAcondicionamiento`) y no tiene nada del
// trabajo del piso (la tanda, su estado, la huella resuelta, el riel de la partida); y
// `TandaAcondicionamientoModal` exige **UNA** bandeja mientras la fila es un ingreso con N.
// ⇒ Son **contenidos distintos**: la fase queda con **3 modales**, que es el precio declarado (P-1).
//
// ⚠️ ES PRESENTACIONAL (SPEC §5③ · *el estado del proceso vive donde están sus efectos*): NO carga
// nada, NO sabe de permisos y NO dispara nada por su cuenta. Recibe el ingreso con sus bandejas ya
// cargadas y **reenvía** las mismas acciones/permisos que ya existían (`AcondicionamientoCatalogo`
// es quien los resuelve):
//     · la acción de cada bandeja (`accion`) → TandaAcondicionamientoModal (iniciar / entregar)
//     · las 2 puertas masivas del ingreso (`accionesMasivas` = `barraMasiva(i)`) → el
//       ConfirmarAccionDialog de siempre (gate **G7**: si no viajaran, el atajo del puesto quedaría
//       sólo en la fila desplegada que este cambio retira ⇒ regresión funcional — la razón por la
//       que la opción C se descartó).
// Ni un botón, ni un campo, ni un permiso, ni una ruta nuevos.
//
// ⚠️ LA ANATOMÍA — LA DE RECEPCIÓN/REVISIÓN, **NO** la de los otros 2 modales de la fase (gate G3
// medido): `TandaAcondicionamientoModal:83` y `AcondicionamientoModal:60` montan
// `max-h-[92vh] overflow-y-auto sm:max-w-2xl`, y con ese patrón **scrollea TODO, incluido el pie**
// (con 6 partidas el «Cerrar» se va de la pantalla). Acá el diálogo es `overflow-hidden` + columna
// flex, **la fila del cuerpo en `min-h-0 flex-1`** (el equivalente flex de `minmax(0,1fr)`), y el
// encabezado y el pie `shrink-0`: el scroll vive DENTRO del cuerpo, que es de `BandejasDeIngreso`.
//
// ⚠️ LAS ZONAS: Z1 la banda de acciones del ingreso (`accionesMasivas`, fija) · Z2 la sub-tabla de
// BANDEJAS (scrollea) · Z4 este pie. La Z3 del mockup (la barra de etapas + el resumen del ingreso)
// **no existe en esta pieza** y no se inventa acá: es un desglose del módulo que hoy no la tiene
// (ver la desviación declarada en el reporte de la implementación).
//
// ⚠️ EL PIE LLEVA **SÓLO `Cerrar`**: la dominante de esta superficie es la **acción de la bandeja**
// (la decide `accionDeBandeja()` con `dominante: b.estado === 'por_limpiar'`) y sigue viviendo en su
// fila, que es donde está el trabajo. Con N bandejas de estados distintos no hay «la acción del
// ingreso» que poner acá sin inventar una regla ⇒ **una sola `default` por pantalla** (SPEC §2.3),
// que es la versión que el mockup dibuja en su escenario canónico (sección A).
//
// ⚠️ CARGA (pendiente **P-3**, decidido y declarado): **no hay estado de carga en el detalle** y no
// se le agrega una prop `cargando` — sería un estado sin productor. El chevron existe sólo si el
// `DataTable` pintó la fila, y la fila se pinta sólo con `estado === 'idle'`, que exige que las DOS
// consultas de la cola hayan vuelto (`AcondicionamientoCatalogo:186-191`): al abrir el modal las
// bandejas YA están en memoria (`i.bandejas`). **La carga ocurre en la COLA, antes de que exista el
// chevron** — «Cargando…» con el modal abierto es un estado que no puede ocurrir.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAyuda } from '@/components/ui/Ayuda'
import {
    BandejasDeIngreso,
    type AccionBandeja,
    type IngresoEnCola,
} from '@/components/entradas/BandejasDeIngreso'
import type { BandejaLiberada } from '@/types/entradas'

interface AcondicionamientoDetalleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** El ingreso cuyo desglose se está mirando; `null` mientras no se elige ninguno. */
    ingreso: IngresoEnCola | null
    /** La acción de UNA bandeja — la MISMA que resuelve el catálogo (no se inventa ni se deduce). */
    accion: (b: BandejaLiberada) => AccionBandeja
    /** ⭐ G7 — las 2 puertas masivas del ingreso (`barraMasiva(i)`), tal cual: es la **Z1**. */
    accionesMasivas?: ReactNode
    /**
     * La densidad del PUESTO que abre el modal (SPEC §1.1 · L8): se **reenvía**, jamás se deduce del
     * ancho de la pantalla. Acondicionamiento es un puesto de dedo ⇒ `'puesto'` (52), el default de
     * la pieza; `'kit'` (36) es el escritorio de Almacén.
     */
    densidad?: 'puesto' | 'kit'
}

export function AcondicionamientoDetalleModal({
    open,
    onOpenChange,
    ingreso,
    accion,
    accionesMasivas,
    densidad = 'puesto',
}: AcondicionamientoDetalleModalProps) {
    // ── Las ayudas de Z2 (los 4 encabezados de la sub-tabla de bandejas) ────────────────────────
    // ⚠️ Se consumen ACÁ y no dentro de `BandejasDeIngreso`: la pieza es compartida con Almacén y sus
    // textos son del registro de Acondicionamiento. Viajan **por prop** (opcional): sin ellas el
    // `<th>` no lleva `title`, que es el DOM de hoy para Almacén.
    const ayudaThTanda = useAyuda('acondicionamiento.detalle-th-tanda')
    const ayudaThProducto = useAyuda('acondicionamiento.detalle-th-producto')
    const ayudaThPiezas = useAyuda('acondicionamiento.detalle-th-piezas')
    const ayudaThEstado = useAyuda('acondicionamiento.detalle-th-estado')
    const titulos = {
        tanda: ayudaThTanda,
        producto: ayudaThProducto,
        piezas: ayudaThPiezas,
        estado: ayudaThEstado,
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                // ⭐ D3.a — el velo del patrón: el kit ya acepta el velo POR MODAL
                // (`overlayClassName`, `ui/dialog.tsx:45`) y este sería su tercer consumidor, cero
                // código de kit. `bg-black/80` se queda: el velo no cambia de color, cambia de
                // textura — y el mismo módulo no puede tener dos velos.
                overlayClassName="backdrop-blur-[2px]"
                // ⭐ G3 — `overflow-hidden` + columna flex: el scroll vive en la fila del cuerpo, así
                // que el encabezado y el pie NO se mueven (es el gate medido de esta fase).
                // ⭐ D2 — **1280px MEDIDOS** (el mismo de `EntradaDetalleModal` y `AvanceRevisionModal`):
                // deja 1232 útiles ≥ los umbrales del mockup (la peor frase de Z1 pide 1002, la barra
                // de etapas 966, la sub-tabla 841). 5xl (976) NO alcanza: la frase de escala lo pasa
                // por 26px. ⚠️ El ancho NO se toca sin volver a medir (mismo gate que los hermanos).
                className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]"
            >
                {/* ⭐ G5 — la cabecera del patrón: el folio ya vive en la banda de acciones de Z1, así
                    que un título visible lo repetiría (L6); el `sr-only` sostiene la accesibilidad
                    (Radix exige un `DialogTitle`) y el retroceso va VISIBLE (ley L13, 44px). El
                    `eyebrow` «Entradas» del mockup NO se implementa: lo pinta `acento-modulo.ts`
                    desde la ruta. */}
                <DialogHeader className="shrink-0 border-b border-border pb-3 pl-6 pr-12 pt-4">
                    <DialogTitle className="sr-only">Detalle del acondicionamiento</DialogTitle>
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

                {/* ── LA FILA QUE SCROLLEA (Z1 + Z2, del desglose hospedado) ───────────────────
                    `min-h-0 flex-1`: el `BandejasDeIngreso` con `enModal` se estira a este alto y
                    scrollea ADENTRO — Z1 (`shrink-0`) queda fuera del scroll. */}
                <div className="flex h-full min-h-0 flex-col gap-3 px-6">
                    {ingreso && (
                        <BandejasDeIngreso
                            bandejas={ingreso.bandejas}
                            accion={accion}
                            accionesMasivas={accionesMasivas}
                            // ⭐ (d) — la densidad del PUESTO llega reenviada; la pieza jamás la
                            // deduce del ancho de la pantalla.
                            densidad={densidad}
                            enModal
                            titulos={titulos}
                        />
                    )}
                </div>

                {/* ── Z4 · EL PIE FIJO ───────────────────────────────────────────────────────
                    Sólo `Cerrar` (52): la acción siguiente de esta superficie es la de CADA
                    bandeja, y vive en su fila (ver la nota del encabezado). Así no hay dos
                    `default` en la misma pantalla (SPEC §2.3). */}
                <DialogFooter className="shrink-0 gap-2 border-t border-border bg-surface-2 px-6 py-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-h-[52px] bg-surface-raised px-5 text-[15px] shadow-premium-sm"
                    >
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

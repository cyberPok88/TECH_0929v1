'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA COMPRA DETALLE MODAL — la nota de compra SIN abandonar la página (Guía 1.4)
//
// ⭐ MEJORA 22 Sep 2026 — nace de la 1.6: la celda «Nota de compra» de Recepción abría la
// ficha completa en otra ruta (`/dashboard/compras/{id}`) y se perdía el contexto de la tabla
// que se estaba trabajando. Aquí se atiende el mismo caso en la PROPIA página de notas de
// compra (acción «Ver»): consultar es leer, no navegar.
//
// ⭐ Dueño del bloque: COMPRAS (Guía 1.4). Muestra una nota —partidas, pagos, estados— o sea
// datos de DOMINIO; por eso NO vive en el kit 0.8 (`data-table` es presentacional y no conoce
// notas de compra) ni en la 1.6 (que solo lo CONSUME). La 1.4 es quien lo declara; la 1.6 lo
// importa, igual que ya importa el modal de la 1.4 desde la ficha del proveedor.
//
// ⭐ Reusa `NotaCompraFicha` con `enModal`: UNA sola fuente del display. El modal no repite
// campos, totales, partidas ni acciones (editar · pagar · cancelar siguen funcionando dentro
// del diálogo, con su RBAC); solo aporta el marco y quita los botones de navegación.
// ═══════════════════════════════════════════════════════════════════════════════

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NotaCompraFicha } from '@/components/compras/NotaCompraFicha'

interface NotaCompraDetalleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Nota a mostrar; `null` mientras no se elige ninguna. */
    notaId: string | null
    /** La ficha cambió algo (editar · pagar · cancelar): refresca el listado que quedó detrás. */
    onCambio?: () => void
}

export function NotaCompraDetalleModal({ open, onOpenChange, notaId, onCambio }: NotaCompraDetalleModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    {/* La ficha ya trae su título visible («Nota {folio}»); este sostiene la
                        accesibilidad del diálogo (Radix exige un DialogTitle). */}
                    <DialogTitle className="sr-only">Nota de compra</DialogTitle>
                </DialogHeader>
                {/* Se monta solo con el diálogo abierto: la ficha no pide datos en balde. */}
                {notaId && <NotaCompraFicha key={notaId} notaId={notaId} enModal onCambio={onCambio} />}
            </DialogContent>
        </Dialog>
    )
}

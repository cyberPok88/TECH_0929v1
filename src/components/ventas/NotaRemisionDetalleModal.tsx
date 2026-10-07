'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA REMISION DETALLE MODAL — la nota SIN abandonar la página (Guía 1.8)
//
// ⭐ Solo aporta el MARCO: monta `NotaRemisionFicha` con `enModal` — UNA sola fuente
//    del display (patrón medido de 1.4 · `NotaCompraDetalleModal`, 63 líneas).
// ⭐ Nace del mismo caso que en 1.4: la celda abría la ficha completa en OTRA RUTA y
//    se perdía el contexto de la tabla que se estaba trabajando. «Consultar es leer,
//    no navegar».
// ⚠️ `key={notaId}` OBLIGATORIO: sin él React reusa la ficha anterior al cambiar de
//    nota y se ve el contenido VIEJO con el folio NUEVO por un instante.
// ⚠️ Aquí NO hay lógica de dominio: ni consultas, ni cálculos, ni permisos. Eso vive
//    en la ficha, que es la que sabe de notas.
// ═══════════════════════════════════════════════════════════════════════════════

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NotaRemisionFicha } from '@/components/ventas/NotaRemisionFicha'

interface NotaRemisionDetalleModalProps {
    open: boolean
    onOpenChange: (abierto: boolean) => void
    /** Nota a mostrar; `null` mientras no se elige ninguna. */
    notaId: string | null
    /** La ficha cambió algo (editar · cancelar): refresca el listado que quedó detrás. */
    onCambio?: () => void
}

export function NotaRemisionDetalleModal({
    open,
    onOpenChange,
    notaId,
    onCambio,
}: NotaRemisionDetalleModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    {/* La ficha ya trae su título visible («Nota REM-####»); este sostiene la
                        accesibilidad del diálogo (Radix exige un DialogTitle). */}
                    <DialogTitle className="sr-only">Nota de remisión</DialogTitle>
                </DialogHeader>
                {/* ⚠️ `key`: fuerza el remonte al cambiar de nota (ver el aviso de arriba) */}
                {notaId && (
                    <NotaRemisionFicha key={notaId} notaId={notaId} enModal onCambio={onCambio} />
                )}
            </DialogContent>
        </Dialog>
    )
}

'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTO IMPRIMIBLE — diálogo con "Guardar PDF" (Guía 1.6 · MEJORA 20 Sep 2026)
// ⭐ PROMOCIÓN 27 Sep 2026 → kit 0.8 (`@/components/imprimibles`): nació en la Guía 1.6
//    (BLOQUE 12) y sube al kit porque lo consumen 1.4 · 1.6 · 1.7 · 1.8. Contrato idéntico.
// Patrón V5 ("1 documento = 1 generador datos→HTML"): el contenido se renderiza en
// un nodo con fondo blanco y `generarPDF` (lib/pdf/generador.ts, jsPDF+html2canvas)
// lo captura como PDF descargable. Reutilizable por nota de entrada, DEV, resultado
// de revisión e ingreso a almacén (se pasa el `children` con el documento).
//
// ⭐ P8 (27 Sep 2026): AVISA CUANDO EL PDF YA EXISTE. `onGuardado` se llama DESPUÉS
// del `await generarPDF(...)`, nunca al apretar el botón: si la captura falla, no se
// registra una impresión que no ocurrió. El kit NO conoce ninguna Server Action —
// solo dice «ya está»; quien decide qué hacer con eso es el consumidor (la 2.1 lo
// audita desde `DocumentoImprimible`).
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DocumentoImprimibleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    titulo: string
    nombreArchivo: string
    /** Se dispara cuando el PDF ya se generó y descargó. Opcional: no todos auditan. */
    onGuardado?: () => void
    children: ReactNode
}

export function DocumentoImprimibleDialog({
    open,
    onOpenChange,
    titulo,
    nombreArchivo,
    onGuardado,
    children,
}: DocumentoImprimibleDialogProps) {
    const areaRef = useRef<HTMLDivElement>(null)

    const guardarPdf = async () => {
        if (!areaRef.current) return
        // import dinámico: html2canvas + jsPDF son pesados y solo se cargan al usar.
        const { generarPDF } = await import('@/lib/pdf/generador')
        await generarPDF(areaRef.current, nombreArchivo)
        // ⭐ El aviso va AQUÍ: si `generarPDF` lanza, esta línea no corre y no se
        //   registra nada. El orden es la garantía, no un comentario.
        onGuardado?.()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader className="flex-row items-center gap-3">
                    {/* ⭐ MEJORA 24 Sep 2026 — retroceso visible también aquí (ley L13). */}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-h-11 gap-1.5 px-3 text-[14px]"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    <DialogTitle>{titulo}</DialogTitle>
                </DialogHeader>
                {/* Fondo blanco + texto negro: el PDF captura exactamente este nodo. */}
                <div ref={areaRef} className="rounded border bg-white p-6 text-black">
                    {children}
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="default"
                        onClick={() => void guardarPdf()}
                        className="min-h-[56px] gap-2 px-6 text-[16px] font-semibold"
                    >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Guardar PDF
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

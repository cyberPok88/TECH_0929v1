'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTO IMPRIMIBLE — diálogo con "Guardar PDF" (Guía 1.6 · MEJORA 20 Sep 2026)
// Patrón V5 ("1 documento = 1 generador datos→HTML"): el contenido se renderiza en
// un nodo con fondo blanco y `generarPDF` (lib/pdf/generador.ts, jsPDF+html2canvas)
// lo captura como PDF descargable. Reutilizable por nota de entrada, DEV, resultado
// de revisión e ingreso a almacén (se pasa el `children` con el documento).
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DocumentoImprimibleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    titulo: string
    nombreArchivo: string
    children: ReactNode
}

export function DocumentoImprimibleDialog({
    open,
    onOpenChange,
    titulo,
    nombreArchivo,
    children,
}: DocumentoImprimibleDialogProps) {
    const areaRef = useRef<HTMLDivElement>(null)

    const guardarPdf = async () => {
        if (!areaRef.current) return
        // import dinámico: html2canvas + jsPDF son pesados y solo se cargan al usar.
        const { generarPDF } = await import('@/lib/pdf/generador')
        await generarPDF(areaRef.current, nombreArchivo)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                </DialogHeader>
                {/* Fondo blanco + texto negro: el PDF captura exactamente este nodo. */}
                <div ref={areaRef} className="rounded border bg-white p-6 text-black">
                    {children}
                </div>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="default" onClick={() => void guardarPdf()}>
                        <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Guardar PDF
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

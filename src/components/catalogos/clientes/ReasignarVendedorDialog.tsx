'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// REASIGNAR VENDEDOR DIALOG — cartera (Guía 1.3 · Parte 6 · Smart)
// Reasignación MASIVA (ids seleccionados) e individual desde la ficha (P7).
// Los vendedores vienen de listarVendedores (hub 1.0 — usuarios con rol vendedor).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import { cambiarVendedorClientes } from '@/lib/actions/clientes'
import { listarVendedores } from '@/lib/actions/catalogos'

interface OpcionVendedor {
    id: string
    nombre: string
}

interface ReasignarVendedorDialogProps {
    open: boolean
    /** ids del lote (masiva) o el id único (ficha) */
    ids: string[]
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function ReasignarVendedorDialog({
    open,
    ids,
    onOpenChange,
    onSuccess,
}: ReasignarVendedorDialogProps) {
    const [vendedores, setVendedores] = useState<OpcionVendedor[]>([])
    const [seleccion, setSeleccion] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        void Promise.resolve().then(() => {
            setSeleccion('')
            setErrorServidor(null)
        })
        void listarVendedores().then((res) => {
            if (res.success) {
                setVendedores((res.data ?? []).map((v) => ({ id: v.id, nombre: v.nombre })))
            }
        })
    }, [open])

    const confirmar = async () => {
        setEnviando(true)
        setErrorServidor(null)
        try {
            const res = await cambiarVendedorClientes(ids, seleccion === '__ninguno__' ? null : seleccion)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo reasignar.')
                return
            }
            toast.success(ids.length > 1 ? 'Cartera reasignada' : 'Vendedor asignado')
            onSuccess()
            onOpenChange(false)
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {ids.length > 1 ? `Reasignar ${ids.length} clientes` : 'Asignar vendedor'}
                    </DialogTitle>
                    <DialogDescription>
                        Cambia la cartera (vendedor asignado). Es la base del alcance &quot;propios&quot;
                        de V2.
                    </DialogDescription>
                </DialogHeader>

                {errorServidor && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span>{errorServidor}</span>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="vendedor_destino">Vendedor</Label>
                    <Select value={seleccion} onValueChange={setSeleccion} disabled={enviando}>
                        <SelectTrigger id="vendedor_destino">
                            <SelectValue placeholder="Elige el vendedor…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__ninguno__">Sin vendedor (desasignar)</SelectItem>
                            {vendedores.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                    {v.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={enviando}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        disabled={enviando || seleccion === ''}
                        onClick={() => void confirmar()}
                    >
                        {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                        {ids.length > 1 ? 'Reasignar' : 'Asignar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEO INVENTARIO MODAL — crear/editar conteo en borrador (Guía 1.5)
// Encabezado (fecha · ubicación · notas) + grid de renglones (producto · contado).
// Solo borrador: la SA valida. Reset en `alAbrir` (setState solo en handlers).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SelectorProducto } from '@/components/form'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { crearConteo, editarConteo, listarUbicacionesActivas, obtenerConteo } from '@/lib/actions/inventario'
import type { RenglonConteoForm } from '@/types/inventario'
import type { ConteoInventario } from '@/types/inventario'

interface ConteoInventarioModalProps {
    open: boolean
    modo: 'crear' | 'editar'
    conteo: ConteoInventario | null
    onOpenChange: (abierto: boolean) => void
    onSuccess?: () => void
}

interface OpcionUbicacion {
    id: string
    nombre: string
}

export function ConteoInventarioModal({
    open,
    modo,
    conteo,
    onOpenChange,
    onSuccess,
}: ConteoInventarioModalProps) {
    const esEdicion = modo === 'editar'
    const [fecha, setFecha] = useState('')
    const [idUbicacion, setIdUbicacion] = useState('')
    const [notas, setNotas] = useState('')
    const [renglones, setRenglones] = useState<RenglonConteoForm[]>([])
    const [ubicaciones, setUbicaciones] = useState<OpcionUbicacion[]>([])
    const [quitarIdx, setQuitarIdx] = useState<number | null>(null)
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    // Carga de ubicaciones (una vez).
    useEffect(() => {
        let activo = true
        void listarUbicacionesActivas().then((res) => {
            if (!activo || !res.success) return
            setUbicaciones((res.data ?? []).map((u) => ({ id: u.id, nombre: u.nombre })))
        })
        return () => {
            activo = false
        }
    }, [])

    // Reset/precarga al abrir (setState diferido en timer — patrón NotaCompraModal 1.4).
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            setFecha(new Date().toISOString().slice(0, 10))
            setIdUbicacion(ubicaciones[0]?.id ?? '')
            setNotas('')
            setRenglones([])
            setErrorServidor(null)
            if (esEdicion && conteo) {
                void obtenerConteo(conteo.id).then((res) => {
                    if (!res.success || !res.data) return
                    const c = res.data
                    setFecha(c.fecha_conteo)
                    setIdUbicacion(c.id_ubicacion)
                    setNotas(c.notas ?? '')
                    setRenglones(
                        c.renglones.map((r) => ({
                            id: r.id,
                            id_producto: r.id_producto,
                            cantidad_contada: String(r.cantidad_contada),
                        }))
                    )
                })
            }
        }, 0)
        return () => {
            clearTimeout(timer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, esEdicion, conteo])

    const agregarRenglon = () => {
        setRenglones((prev) => [...prev, { id: '', id_producto: '', cantidad_contada: '' }])
    }

    const actualizarRenglon = (indice: number, patch: Partial<RenglonConteoForm>) => {
        setRenglones((prev) => prev.map((r, i) => (i === indice ? { ...r, ...patch } : r)))
    }

    const guardar = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (renglones.length === 0) {
            setErrorServidor('Agrega al menos un renglón con su producto.')
            return
        }
        if (renglones.some((r) => !r.id_producto || !r.cantidad_contada)) {
            setErrorServidor('Cada renglón debe tener producto y cantidad contada.')
            return
        }
        const payload = {
            fecha_conteo: fecha,
            id_ubicacion: idUbicacion,
            notas,
            renglones: renglones.map((r) => ({
                id: r.id,
                id_producto: r.id_producto,
                cantidad_contada: r.cantidad_contada,
            })),
        }
        setCargando(true)
        setErrorServidor(null)
        const res =
            esEdicion && conteo
                ? await editarConteo(conteo.id, payload as Parameters<typeof editarConteo>[1])
                : await crearConteo(payload as Parameters<typeof crearConteo>[0])
        setCargando(false)
        if (!res.success) {
            setErrorServidor(res.error ?? 'No se pudo guardar el conteo.')
            return
        }
        toast.success(esEdicion ? 'Conteo actualizado.' : 'Conteo creado (borrador).')
        onSuccess?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{esEdicion ? 'Editar conteo' : 'Nuevo conteo de inventario'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={guardar} className="flex flex-col gap-5">
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Encabezado</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Fecha del conteo *</Label>
                                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={cargando} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Ubicación *</Label>
                                <Select value={idUbicacion} onValueChange={setIdUbicacion} disabled={cargando}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Elegir ubicación…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ubicaciones.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </section>

                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                                Renglones ({renglones.length})
                            </h3>
                            <Button type="button" variant="outline" size="sm" onClick={agregarRenglon} disabled={cargando}>
                                <Plus className="mr-2 h-4 w-4" /> Agregar producto
                            </Button>
                        </div>

                        {renglones.length === 0 && (
                            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                                Agrega los productos que vas a contar.
                            </p>
                        )}

                        <div className="flex flex-col gap-2">
                            {renglones.map((r, i) => (
                                <div
                                    key={`${r.id_producto}-${i}`}
                                    className="grid grid-cols-[1fr_130px_40px] items-end gap-2 rounded-md border border-border p-2"
                                >
                                    <div className="min-w-0">
                                        <SelectorProducto
                                            value={r.id_producto || null}
                                            onChange={(id) => actualizarRenglon(i, { id_producto: id ?? '' })}
                                            disabled={cargando}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Label className="text-xs font-medium text-muted-foreground">Contado</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={r.cantidad_contada}
                                            onChange={(e) => actualizarRenglon(i, { cantidad_contada: e.target.value })}
                                            disabled={cargando}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setQuitarIdx(i)}
                                        disabled={cargando}
                                        aria-label="Quitar renglón"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Notas</Label>
                        <textarea
                            rows={2}
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Opcional…"
                            disabled={cargando}
                            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                        />
                    </div>

                    {errorServidor && <p className="text-sm text-destructive">{errorServidor}</p>}

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={cargando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={cargando}>
                            {cargando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear conteo'}
                        </Button>
                    </div>
                </form>

                <ConfirmarAccionDialog
                    open={quitarIdx !== null}
                    onOpenChange={(o) => {
                        if (!o) setQuitarIdx(null)
                    }}
                    titulo="Quitar renglón"
                    descripcion="Este producto dejará de formar parte del conteo."
                    confirmLabel="Quitar"
                    variant="destructive"
                    onConfirm={async () => {
                        if (quitarIdx !== null) {
                            const idx = quitarIdx
                            setRenglones((prev) => prev.filter((_, i) => i !== idx))
                        }
                        return { error: null }
                    }}
                />
            </DialogContent>
        </Dialog>
    )
}

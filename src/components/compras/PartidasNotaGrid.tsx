'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS NOTA GRID — Renglones de la nota (Guía 1.4 · rediseño · Parte 3–4)
// Grid N de partidas (producto · cantidad · costo · subtotal) dentro del modal.
// Incluye un selector de producto buscable (SA listarProductosParaPartida) y
// quitar fila SIEMPRE con ConfirmarAccionDialog (PLAN §4). Controlado por el padre.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { listarProductosParaPartida, type ProductoParaPartida } from '@/lib/actions/notas-compra'
import type { PartidaNotaForm } from '@/types/notas-compra'

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

function nuevaPartida(): PartidaNotaForm {
    return {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id_producto: '',
        cantidad: '1',
        costo_acordado: '',
    }
}

export interface InfoProducto {
    sku: string
    nombre: string
}

interface PartidasNotaGridProps {
    partidas: PartidaNotaForm[]
    onChange: (partidas: PartidaNotaForm[]) => void
    /** Map id_producto → display, para precargar en edición (viene del detalle). */
    infoInicial?: Record<string, InfoProducto>
    disabled?: boolean
}

export function PartidasNotaGrid({ partidas, onChange, infoInicial, disabled = false }: PartidasNotaGridProps) {
    const [infoProductos, setInfoProductos] = useState<Record<string, InfoProducto>>(() => ({ ...infoInicial }))
    const [pickerAbierto, setPickerAbierto] = useState(false)
    const [filaObjetivo, setFilaObjetivo] = useState<number | null>(null)
    const [busqueda, setBusqueda] = useState('')
    const [opciones, setOpciones] = useState<ProductoParaPartida[]>([])
    const [buscando, setBuscando] = useState(false)
    const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
    const [eliminarIndex, setEliminarIndex] = useState<number | null>(null)

    // Carga de opciones del picker (debounce 250ms) — setState solo en callbacks.
    useEffect(() => {
        if (!pickerAbierto) return
        const timer = setTimeout(() => {
            let activo = true
            setBuscando(true)
            setErrorBusqueda(null)
            void listarProductosParaPartida(busqueda).then((res) => {
                if (!activo) return
                setBuscando(false)
                if (!res.success) {
                    setErrorBusqueda(res.error ?? 'No se pudieron cargar los productos.')
                    return
                }
                setOpciones(res.data ?? [])
            })
            return () => {
                activo = false
            }
        }, 250)
        return () => {
            clearTimeout(timer)
        }
    }, [pickerAbierto, busqueda])

    const abrirPicker = (indice: number) => {
        setFilaObjetivo(indice)
        setBusqueda('')
        setOpciones([])
        setErrorBusqueda(null)
        setPickerAbierto(true)
    }

    const elegirProducto = (p: ProductoParaPartida) => {
        if (filaObjetivo === null) return
        const siguiente = partidas.map((fila, i) =>
            i === filaObjetivo ? { ...fila, id_producto: p.id } : fila
        )
        onChange(siguiente)
        setInfoProductos((prev) => ({ ...prev, [p.id]: { sku: p.sku, nombre: p.nombre } }))
        setPickerAbierto(false)
        setFilaObjetivo(null)
    }

    const actualizarFila = (indice: number, campo: 'cantidad' | 'costo_acordado', valor: string) => {
        const siguiente = partidas.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila))
        onChange(siguiente)
    }

    const confirmarEliminar = async (): Promise<{ error: string | null }> => {
        if (eliminarIndex === null) return { error: null }
        onChange(partidas.filter((_, i) => i !== eliminarIndex))
        setEliminarIndex(null)
        return { error: null }
    }

    const totalNota = partidas.reduce(
        (acc, fila) => acc + (Number(fila.cantidad) || 0) * (Number(fila.costo_acordado) || 0),
        0
    )

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">Partidas *</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange([...partidas, nuevaPartida()])}
                >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    Agregar partida
                </Button>
            </div>

            {partidas.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    Agrega al menos una partida (producto · cantidad · costo).
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {partidas.map((fila, i) => {
                        const info = fila.id_producto ? infoProductos[fila.id_producto] : undefined
                        const subtotal = (Number(fila.cantidad) || 0) * (Number(fila.costo_acordado) || 0)
                        return (
                            <div
                                key={fila.id}
                                className="grid grid-cols-12 items-center gap-2 rounded-md border border-border bg-surface px-2 py-2"
                            >
                                {/* Producto */}
                                <div className="col-span-12 sm:col-span-5">
                                    {fila.id_producto && info ? (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => abrirPicker(i)}
                                                disabled={disabled}
                                                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm hover:bg-surface"
                                                aria-label="Cambiar producto"
                                            >
                                                <span className="block truncate">{info.nombre}</span>
                                                <span className="block font-mono text-[11px] text-muted-foreground">
                                                    {info.sku}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => abrirPicker(i)}
                                                disabled={disabled}
                                                className="rounded p-1 text-muted-foreground hover:text-foreground"
                                                aria-label="Cambiar producto"
                                            >
                                                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                                            </button>
                                        </div>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-start text-muted-foreground"
                                            disabled={disabled}
                                            onClick={() => abrirPicker(i)}
                                        >
                                            Elegir producto…
                                        </Button>
                                    )}
                                </div>
                                {/* Cantidad */}
                                <div className="col-span-4 sm:col-span-2">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={fila.cantidad}
                                        onChange={(e) => actualizarFila(i, 'cantidad', e.target.value)}
                                        disabled={disabled}
                                        aria-label={`Cantidad partida ${i + 1}`}
                                        className="h-9 text-right"
                                    />
                                </div>
                                {/* Costo */}
                                <div className="col-span-4 sm:col-span-2">
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={fila.costo_acordado}
                                        onChange={(e) => actualizarFila(i, 'costo_acordado', e.target.value)}
                                        disabled={disabled}
                                        aria-label={`Costo partida ${i + 1}`}
                                        className="h-9 text-right"
                                    />
                                </div>
                                {/* Subtotal */}
                                <div className="col-span-3 text-right font-mono text-xs tabular-nums sm:col-span-2">
                                    {formatearMXN(subtotal)}
                                </div>
                                {/* Quitar */}
                                <div className="col-span-1 flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        disabled={disabled}
                                        aria-label={`Quitar partida ${i + 1}`}
                                        onClick={() => setEliminarIndex(i)}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })}

                    <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground">Total de la nota</span>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                            {formatearMXN(totalNota)}
                        </span>
                    </div>
                </div>
            )}

            {/* Selector de producto */}
            <Dialog open={pickerAbierto} onOpenChange={(o) => !disabled && setPickerAbierto(o)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Elegir producto</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por nombre, SKU o código de barras…"
                            autoFocus
                            className="h-10"
                        />
                        {busqueda !== '' && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => setBusqueda('')}>
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        )}
                    </div>

                    <div className="max-h-72 overflow-auto rounded-md border border-border">
                        {buscando && (
                            <p className="px-3 py-3 text-sm text-muted-foreground">Buscando productos…</p>
                        )}
                        {!buscando && errorBusqueda && (
                            <p className="px-3 py-3 text-sm text-destructive">{errorBusqueda}</p>
                        )}
                        {!buscando && !errorBusqueda && opciones.length === 0 && (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                                Sin productos que coincidan (usa el catálogo activo).
                            </p>
                        )}
                        {!buscando &&
                            !errorBusqueda &&
                            opciones.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => elegirProducto(p)}
                                    className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-surface"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate">{p.nombre}</span>
                                        <span className="block font-mono text-[11px] text-muted-foreground">
                                            {p.sku}
                                        </span>
                                    </span>
                                </button>
                            ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirmación al quitar partida */}
            <ConfirmarAccionDialog
                open={eliminarIndex !== null}
                onOpenChange={(o) => {
                    if (!o) setEliminarIndex(null)
                }}
                titulo="Quitar partida"
                descripcion="Se elimina esta línea de la nota. Los cambios se aplican al guardar."
                confirmLabel="Quitar"
                variant="destructive"
                successMessage="Partida quitada"
                onConfirm={confirmarEliminar}
            />
        </div>
    )
}

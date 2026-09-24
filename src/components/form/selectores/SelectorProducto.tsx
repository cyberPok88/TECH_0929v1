'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR DE PRODUCTO — Guía 0.8 · Parte 7 (componente compartido · PROMOCIÓN
// 17 Sep 2026 — la pidió la Guía 1.5 Inventario y la consumirá además la 1.6 Entradas)
//
// Selector buscable de productos ACTIVOS (contrato del módulo dueño 1.2:
// `listarProductosActivos` — `src/lib/actions/productos.ts` · `ProductoOpcion` —
// `src/types/productos.ts` L147).
//
// MECANISMO — picker DIALOG (mismo patrón que SelectorProveedor): el trigger abre
// un `Dialog` con buscador + lista. Dentro de un `Dialog` modal, un `Popover`
// portaliza a `body` con z-50 y quedaba BAJO el overlay (lista visible pero click
// muerto) — un Dialog anidado lo apila Radix correctamente (validado 1.1–1.4).
//
// Contrato:
//   <SelectorProducto
//     value={idProducto | null}
//     onChange={(id) => ...}
//     disabled?
//     etiqueta?        // por defecto "Producto"
//     placeholder?     // por defecto "Elegir producto…"
//     className?
//   />
//
// value=true → id del producto elegido; null = ninguno. Filtro local
// (nombre · sku). Carga perezosa al primer open — setState solo en handlers y
// continuaciones async (regla react-hooks/set-state-in-effect, patrón repo).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listarProductosActivos } from '@/lib/actions/productos'
import type { ProductoOpcion } from '@/types/productos'

interface SelectorProductoProps {
    /** id del producto elegido — null = ninguno. */
    value: string | null
    /** Notifica la selección — null deselecciona. */
    onChange: (id: string | null) => void
    disabled?: boolean
    etiqueta?: string
    placeholder?: string
    className?: string
}

function coincideProducto(p: ProductoOpcion, termino: string): boolean {
    const t = termino.trim().toLowerCase()
    if (!t) return true
    return p.nombre.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)
}

export function SelectorProducto({
    value,
    onChange,
    disabled = false,
    etiqueta = 'Producto',
    placeholder = 'Elegir producto…',
    className,
}: SelectorProductoProps) {
    const [abierto, setAbierto] = useState(false)
    const [busqueda, setBusqueda] = useState('')
    const [opciones, setOpciones] = useState<ProductoOpcion[] | null>(null)
    const [cargando, setCargando] = useState(false)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)

    const seleccionado = opciones?.find((o) => o.id === value) ?? null

    async function cargarProductos() {
        setCargando(true)
        setErrorCarga(null)
        const respuesta = await listarProductosActivos()
        setCargando(false)
        if (!respuesta.success) {
            setErrorCarga(respuesta.error ?? 'No se pudieron cargar los productos.')
            return
        }
        setOpciones(respuesta.data ?? [])
    }

    function manejarAbierto(next: boolean) {
        if (disabled && next) return
        setAbierto(next)
        if (next) {
            if (opciones === null && !errorCarga) {
                void cargarProductos()
            }
        } else {
            setBusqueda('')
        }
    }

    function manejarSeleccion(id: string | null) {
        onChange(id)
        setAbierto(false)
        setBusqueda('')
    }

    const filtradas = (opciones ?? []).filter((p) => coincideProducto(p, busqueda))

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <Label className="text-xs font-medium text-muted-foreground">{etiqueta}</Label>
            <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={abierto}
                aria-haspopup="dialog"
                disabled={disabled}
                onClick={() => manejarAbierto(true)}
                className={cn(
                    'w-full justify-between font-normal',
                    !seleccionado && 'text-muted-foreground',
                )}
            >
                <span className="truncate">
                    {seleccionado ? `${seleccionado.sku} — ${seleccionado.nombre}` : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

            <Dialog open={abierto} onOpenChange={manejarAbierto}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Elegir producto</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por nombre o SKU…"
                            autoFocus
                            className="h-10"
                            aria-label="Buscar producto"
                        />
                        {busqueda !== '' && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setBusqueda('')}
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        )}
                    </div>

                    <div className="max-h-72 overflow-auto rounded-md border border-border">
                        {cargando && (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                                Cargando productos…
                            </p>
                        )}

                        {!cargando && errorCarga && (
                            <div className="px-3 py-3">
                                <p className="text-sm text-destructive">{errorCarga}</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1 h-9"
                                    onClick={() => void cargarProductos()}
                                >
                                    Reintentar
                                </Button>
                            </div>
                        )}

                        {!cargando && !errorCarga && opciones !== null && filtradas.length === 0 && (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                                Sin productos que coincidan.
                            </p>
                        )}

                        {!cargando &&
                            !errorCarga &&
                            opciones !== null &&
                            filtradas.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => manejarSeleccion(p.id)}
                                    className={cn(
                                        'flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                        value === p.id && 'bg-primary-bg text-primary',
                                    )}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate">{p.nombre}</span>
                                        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                                            {p.sku}
                                        </span>
                                    </span>
                                    {value === p.id && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                            ))}
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => manejarSeleccion(null)}
                    >
                        Sin producto
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    )
}

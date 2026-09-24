'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR DE PROVEEDOR — Guía 0.8 · Parte 7 (componente compartido · PROMOCIÓN
// 05 Sep 2026 — la pidió la Guía 1.4 Compras y la consumirá además la 1.6 Entradas)
//
// Selector buscable de proveedores ACTIVOS (contrato del módulo dueño 1.1:
// `listarProveedoresActivos` · `ProveedorOpcion` — `src/lib/actions/proveedores.ts`
// L322 y `src/types/proveedores.ts` L45).
//
// MECANISMO — picker DIALOG (FIX VF Guía 1.4 · 05 Sep 2026): el trigger abre un
// `Dialog` con buscador + lista (mismo patrón que el picker de producto de
// PartidasNotaGrid). Motivo: el `Popover` portaliza a `body` con `z-50` y, dentro
// de un `Dialog` modal, con React 19 el contenido quedaba BAJO el overlay del
// Dialog (la lista se veía pero el click no entraba). Un Dialog anidado lo apila
// Radix correctamente — patrón ya validado en 1.1–1.3.
//
// Contrato (agregado 05 Sep 2026 — SIN cambios con el fix):
//   <SelectorProveedor
//     value={idProveedor | null}
//     onChange={(id) => ...}
//     disabled?
//     etiqueta?        // por defecto "Proveedor"
//     placeholder?     // por defecto "Elegir proveedor…"
//     className?
//   />
//
// value=true → id del proveedor elegido; null = ninguno. El filtro es local
// (codigo · nombre_comercial · rfc). La carga es perezosa: ocurre al ABRIR el
// picker la primera vez — setState solo en handlers y en continuaciones async
// (regla react-hooks/set-state-in-effect, patrón repo 1.1–1.3).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listarProveedoresActivos } from '@/lib/actions/proveedores'
import type { ProveedorOpcion } from '@/types/proveedores'

interface SelectorProveedorProps {
    /** id del proveedor elegido — null = ninguno. */
    value: string | null
    /** Notifica la selección — null deselecciona. */
    onChange: (id: string | null) => void
    disabled?: boolean
    /** Texto de la etiqueta sobre el control (default "Proveedor"). */
    etiqueta?: string
    placeholder?: string
    className?: string
}

function coincideProveedor(p: ProveedorOpcion, termino: string): boolean {
    const t = termino.trim().toLowerCase()
    if (!t) return true
    return (
        p.nombre_comercial.toLowerCase().includes(t) ||
        p.codigo.toLowerCase().includes(t) ||
        (p.rfc ?? '').toLowerCase().includes(t)
    )
}

export function SelectorProveedor({
    value,
    onChange,
    disabled = false,
    etiqueta = 'Proveedor',
    placeholder = 'Elegir proveedor…',
    className,
}: SelectorProveedorProps) {
    const [abierto, setAbierto] = useState(false)
    const [busqueda, setBusqueda] = useState('')
    // null = aún no cargado (carga perezosa al primer open) · [] = sin resultados
    const [opciones, setOpciones] = useState<ProveedorOpcion[] | null>(null)
    const [cargando, setCargando] = useState(false)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)

    const seleccionado = opciones?.find((o) => o.id === value) ?? null

    async function cargarProveedores() {
        setCargando(true)
        setErrorCarga(null)
        const respuesta = await listarProveedoresActivos()
        setCargando(false)
        if (!respuesta.success) {
            setErrorCarga(respuesta.error ?? 'No se pudieron cargar los proveedores.')
            return
        }
        setOpciones(respuesta.data ?? [])
    }

    function manejarAbierto(next: boolean) {
        if (disabled && next) return
        setAbierto(next)
        if (next) {
            if (opciones === null && !errorCarga) {
                void cargarProveedores()
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

    const filtradas = (opciones ?? []).filter((p) => coincideProveedor(p, busqueda))

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
                    {seleccionado
                        ? `${seleccionado.codigo} — ${seleccionado.nombre_comercial}`
                        : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

            <Dialog open={abierto} onOpenChange={manejarAbierto}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Elegir proveedor</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por nombre, código o RFC…"
                            autoFocus
                            className="h-10"
                            aria-label="Buscar proveedor"
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
                                Cargando proveedores…
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
                                    onClick={() => void cargarProveedores()}
                                >
                                    Reintentar
                                </Button>
                            </div>
                        )}

                        {!cargando && !errorCarga && opciones !== null && filtradas.length === 0 && (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                                Sin proveedores que coincidan.
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
                                        <span className="block truncate">{p.nombre_comercial}</span>
                                        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                                            {p.codigo}
                                            {p.rfc ? ` · ${p.rfc}` : ''}
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
                        Sin proveedor
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    )
}

'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR DE CLIENTE — Guía 0.8 · Parte 7 (componente compartido · PROMOCIÓN
// 01 Oct 2026 (8ª) — la pidió el ciclo de Venta: 1.7 Cotizaciones · 1.8 Ventas ·
// 1.9 Cobros, los tres en su alta)
//
// Selector buscable de clientes ACTIVOS (contrato del módulo dueño 1.3:
// `listarClientesActivos` — `src/lib/actions/clientes.ts` L207 · `ClienteOpcion` —
// `src/types/clientes.ts` { id · codigo · nombre_comercial · rfc }).
// ⭐ El encabezado de `clientes.ts` dice literalmente «contrato 1.7/1.8/1.9»: el
//    contrato YA existía y esperaba a este componente. La promoción solo aporta
//    la pieza de UI — CERO contrato nuevo.
//
// MECANISMO — picker DIALOG (mismo patrón que SelectorProveedor y SelectorProducto):
// el trigger abre un `Dialog` con buscador + lista. Dentro de un `Dialog` modal, un
// `Popover` portaliza a `body` con z-50 y quedaba BAJO el overlay (lista visible pero
// click muerto) — un Dialog anidado lo apila Radix correctamente (validado 1.1–1.5).
//
// Contrato:
//   <SelectorCliente
//     value={idCliente | null}
//     onChange={(id) => ...}
//     disabled?
//     etiqueta?        // por defecto "Cliente"
//     placeholder?     // por defecto "Elegir cliente…"
//     className?
//   />
//
// value → id del cliente elegido; null = ninguno. Filtro local (nombre comercial ·
// código · RFC). Carga perezosa al primer open — setState solo en handlers y
// continuaciones async (regla react-hooks/set-state-in-effect, patrón repo).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listarClientesActivos } from '@/lib/actions/clientes'
import type { ClienteOpcion } from '@/types/clientes'

interface SelectorClienteProps {
    /** id del cliente elegido — null = ninguno. */
    value: string | null
    /** Notifica la selección — null deselecciona. */
    onChange: (id: string | null) => void
    /**
     * ⭐ **ANEXIÓN 05 Oct 2026**: entrega la **opción completa** (no solo el id) para que el
     * consumidor lea datos que este selector **ya cargó** — hoy el `dias_credito` que la
     * confirmación de la nota necesita para decir «Crédito · plazo N días».
     * ⚠️ Evita una consulta extra por cliente: el dato viaja con la fila que ya está en memoria.
     * `null` = deseleccionó.
     */
    onSeleccionada?: (cliente: ClienteOpcion | null) => void
    disabled?: boolean
    etiqueta?: string
    placeholder?: string
    className?: string
}

/**
 * Filtro local por **nombre comercial · código · RFC**.
 * ⭐ El RFC entra a propósito: en mostrador el cliente se busca muchas veces por él,
 *    y es un dato que el contrato de 1.3 ya trae (`ClienteOpcion.rfc`).
 */
function coincideCliente(c: ClienteOpcion, termino: string): boolean {
    const t = termino.trim().toLowerCase()
    if (!t) return true
    return (
        c.nombre_comercial.toLowerCase().includes(t) ||
        c.codigo.toLowerCase().includes(t) ||
        (c.rfc ?? '').toLowerCase().includes(t)
    )
}

export function SelectorCliente({
    value,
    onChange,
    onSeleccionada,
    disabled = false,
    etiqueta = 'Cliente',
    placeholder = 'Elegir cliente…',
    className,
}: SelectorClienteProps) {
    const [abierto, setAbierto] = useState(false)
    const [busqueda, setBusqueda] = useState('')
    const [opciones, setOpciones] = useState<ClienteOpcion[] | null>(null)
    const [cargando, setCargando] = useState(false)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)

    const seleccionado = opciones?.find((o) => o.id === value) ?? null

    async function cargarClientes() {
        setCargando(true)
        setErrorCarga(null)
        const respuesta = await listarClientesActivos()
        setCargando(false)
        if (!respuesta.success) {
            setErrorCarga(respuesta.error ?? 'No se pudieron cargar los clientes.')
            return
        }
        setOpciones(respuesta.data ?? [])
    }

    function manejarAbierto(next: boolean) {
        if (disabled && next) return
        setAbierto(next)
        if (next) {
            if (opciones === null && !errorCarga) {
                void cargarClientes()
            }
        } else {
            setBusqueda('')
        }
    }

    function manejarSeleccion(id: string | null) {
        onChange(id)
        // ⭐ ANEXIÓN 05 Oct 2026: la opción COMPLETA viaja al consumidor (el id solo no alcanza
        //   para leer `dias_credito`). Se busca en las opciones que ya están en memoria.
        onSeleccionada?.(id ? ((opciones ?? []).find((o) => o.id === id) ?? null) : null)
        setAbierto(false)
        setBusqueda('')
    }

    const filtradas = (opciones ?? []).filter((c) => coincideCliente(c, busqueda))

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
                        <DialogTitle>Elegir cliente</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por nombre, código o RFC…"
                            autoFocus
                            className="h-10"
                            aria-label="Buscar cliente"
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
                                Cargando clientes…
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
                                    onClick={() => void cargarClientes()}
                                >
                                    Reintentar
                                </Button>
                            </div>
                        )}

                        {!cargando && !errorCarga && opciones !== null && filtradas.length === 0 && (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                                Sin clientes que coincidan.
                            </p>
                        )}

                        {!cargando &&
                            !errorCarga &&
                            opciones !== null &&
                            filtradas.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => manejarSeleccion(c.id)}
                                    className={cn(
                                        'flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                        value === c.id && 'bg-primary-bg text-primary',
                                    )}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate">{c.nombre_comercial}</span>
                                        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                                            {c.codigo}
                                            {c.rfc ? ` · ${c.rfc}` : ''}
                                        </span>
                                    </span>
                                    {value === c.id && <Check className="h-4 w-4 shrink-0" />}
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
                        Sin cliente
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    )
}

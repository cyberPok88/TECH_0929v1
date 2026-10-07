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
//
// ⭐ CASCADA 06 Oct 2026 (decisión del dueño) — arriba del buscador viven los filtros
// que CONSULTAN AL SERVIDOR: Familia → Tipo → atributos `en_huella` del Tipo.
//   · Familia = `id_categoria_padre === null` (agrupa y no recibe productos, R8) ⇒
//     centinela «Todas las familias»; el servidor la expande a sus Tipos.
//   · Tipo = con padre. Se etiqueta «Familia › Tipo» cuando no hay Familia elegida
//     porque el nombre es único POR PADRE, no global (R9): el Tipo suelto es ambiguo.
//   · 3er nivel = la huella del Tipo: `select` con opciones → dropdown (igualdad);
//     `text` sin opciones → input que filtra por CONTENIDO (`ilike`, decisión del dueño).
//   · Cada cambio de filtro = 1 llamada a la SA. El buscador de texto NO consulta:
//     sigue filtrando en cliente sobre las 50 opciones.
//   · Una Familia sin Tipos se ofrece igual y devuelve 0 (decisión: sin aviso).
// ⚠️ La etiqueta del elegido se GUARDA: si la cascada lo deja fuera de las 50 opciones,
// `opciones.find` no lo encuentra y el trigger del selector quedaba en blanco.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FiltroSelect } from '@/components/data-table'
import { listarCategoriasSelector, listarProductosActivos } from '@/lib/actions/productos'
import type { OpcionCategoriaSelector, ProductoOpcion } from '@/types/productos'

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
    // ⭐ CASCADA — árbol de categorías (Familia/Tipo + huella del Tipo) y filtros vivos.
    const [categorias, setCategorias] = useState<OpcionCategoriaSelector[] | null>(null)
    const [cargandoCategorias, setCargandoCategorias] = useState(false)
    const [errorCategorias, setErrorCategorias] = useState<string | null>(null)
    const [idFamilia, setIdFamilia] = useState('')
    const [idTipo, setIdTipo] = useState('')
    const [atributos, setAtributos] = useState<Record<string, string>>({})
    // ⚠️ Guarda la etiqueta del elegido: con filtros activos el producto puede quedar
    // fuera de las 50 opciones y el trigger se quedaba sin texto.
    const [etiquetaElegida, setEtiquetaElegida] = useState<{ id: string; etiqueta: string } | null>(null)

    // La ÚLTIMA consulta manda (carrera al cambiar de filtro rápido) · debounce del texto.
    const pedidoRef = useRef(0)
    const timerTexto = useRef<ReturnType<typeof setTimeout> | null>(null)

    const seleccionado = opciones?.find((o) => o.id === value) ?? null
    const etiquetaSeleccionada = etiquetaElegida?.id === value ? etiquetaElegida.etiqueta : null

    // ── Opciones de la cascada ──────────────────────────────────────────────────
    const familias = useMemo(
        () =>
            (categorias ?? [])
                .filter((c) => c.id_categoria_padre === null)
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((c) => ({ valor: c.id, etiqueta: c.nombre })),
        [categorias]
    )

    const tipos = useMemo(() => {
        const nombrePorId = new Map((categorias ?? []).map((c) => [c.id, c.nombre]))
        return (categorias ?? [])
            .filter((c) => c.id_categoria_padre !== null)
            // Con Familia elegida el Tipo se acota a sus hijos; sin ella se ofrecen todos.
            .filter((c) => !idFamilia || c.id_categoria_padre === idFamilia)
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map((c) => {
                // R9 — el nombre es único POR PADRE: sin Familia elegida, «Fuentes de poder»
                // puede ser de dos Familias distintas ⇒ la etiqueta lleva la Familia.
                const familia = !idFamilia && c.id_categoria_padre ? nombrePorId.get(c.id_categoria_padre) : null
                return { valor: c.id, etiqueta: familia ? `${familia} › ${c.nombre}` : c.nombre }
            })
    }, [categorias, idFamilia])

    // 3er nivel — la huella del Tipo elegido ([] si no hay Tipo o no declara `en_huella`:
    // no se renderiza la fila y NO es error).
    const atributosHuella = useMemo(
        () => (idTipo ? ((categorias ?? []).find((c) => c.id === idTipo)?.atributos_huella ?? []) : []),
        [categorias, idTipo]
    )

    // ── Cargas ──────────────────────────────────────────────────────────────────
    async function cargarProductos(
        idCategoria: string = idTipo || idFamilia,
        atributosFiltro: Record<string, string | string[]> = atributos
    ) {
        const pedido = ++pedidoRef.current
        setCargando(true)
        setErrorCarga(null)
        const respuesta = await listarProductosActivos({
            id_categoria: idCategoria || undefined,
            atributos: atributosFiltro,
        })
        if (pedido !== pedidoRef.current) return // llegó tarde: la última consulta manda
        setCargando(false)
        if (!respuesta.success) {
            setErrorCarga(respuesta.error ?? 'No se pudieron cargar los productos.')
            return
        }
        const filas = respuesta.data ?? []
        setOpciones(filas)
        const elegido = filas.find((f) => f.id === value)
        if (elegido) {
            setEtiquetaElegida({ id: elegido.id, etiqueta: `${elegido.sku} — ${elegido.nombre}` })
        }
    }

    async function cargarCategorias() {
        setCargandoCategorias(true)
        setErrorCategorias(null)
        const respuesta = await listarCategoriasSelector()
        setCargandoCategorias(false)
        if (!respuesta.success) {
            setErrorCategorias(respuesta.error ?? 'No se pudieron cargar las categorías.')
            return
        }
        setCategorias(respuesta.data ?? [])
    }

    function manejarAbierto(next: boolean) {
        if (disabled && next) return
        setAbierto(next)
        if (next) {
            // Carga perezosa al primer open: árbol de categorías + opciones (2 llamadas).
            if (categorias === null && !cargandoCategorias) void cargarCategorias()
            if (opciones === null && !errorCarga) {
                void cargarProductos()
            }
        } else {
            setBusqueda('')
        }
    }

    // ── Filtros de la cascada (cada cambio = 1 llamada a la SA) ─────────────────
    function cancelarDebounce() {
        if (timerTexto.current) {
            clearTimeout(timerTexto.current)
            timerTexto.current = null
        }
    }

    function manejarFamilia(valor: string) {
        const id = valor === '__todos__' ? '' : valor
        cancelarDebounce()
        setIdFamilia(id)
        setIdTipo('') // el Tipo vive dentro de la Familia elegida
        setAtributos({}) // la huella es del Tipo
        void cargarProductos(id, {})
    }

    function manejarTipo(valor: string) {
        const id = valor === '__todos__' ? '' : valor
        cancelarDebounce()
        setIdTipo(id)
        setAtributos({})
        void cargarProductos(id || idFamilia, {})
    }

    function manejarAtributoSelect(clave: string, valor: string) {
        const siguientes = { ...atributos }
        if (valor === '__todos__' || valor === '') delete siguientes[clave]
        else siguientes[clave] = valor
        cancelarDebounce()
        setAtributos(siguientes)
        void cargarProductos(idTipo || idFamilia, siguientes)
    }

    // Los atributos `text` (sin opciones) filtran por CONTENIDO (`ilike` sobre
    // `atributos->>clave`, decisión del dueño): el tecleo va con debounce 300 ms
    // (patrón FiltroBusqueda) para no disparar una consulta por letra.
    function manejarAtributoTexto(clave: string, valor: string) {
        const siguientes = { ...atributos }
        if (valor === '') delete siguientes[clave]
        else siguientes[clave] = valor
        setAtributos(siguientes)
        cancelarDebounce()
        timerTexto.current = setTimeout(() => {
            void cargarProductos(idTipo || idFamilia, siguientes)
        }, 300)
    }

    function manejarSeleccion(id: string | null) {
        onChange(id)
        if (id === null) {
            setEtiquetaElegida(null)
        } else {
            const elegido = opciones?.find((o) => o.id === id)
            if (elegido) setEtiquetaElegida({ id: elegido.id, etiqueta: `${elegido.sku} — ${elegido.nombre}` })
        }
        setAbierto(false)
        setBusqueda('')
    }

    // El debounce pendiente llama a la SA: no debe sobrevivir al desmontaje.
    useEffect(() => {
        const timer = timerTexto
        return () => {
            if (timer.current) clearTimeout(timer.current)
        }
    }, [])

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
                    !etiquetaSeleccionada && !seleccionado && 'text-muted-foreground',
                )}
            >
                <span className="truncate">
                    {etiquetaSeleccionada ??
                        (seleccionado ? `${seleccionado.sku} — ${seleccionado.nombre}` : placeholder)}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

            <Dialog open={abierto} onOpenChange={manejarAbierto}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Elegir producto</DialogTitle>
                    </DialogHeader>

                    {/* ⭐ CASCADA — Familia → Tipo → atributos `en_huella` del Tipo. Cada
                        cambio re-consulta la SA (1 llamada). Una Familia sin Tipos se
                        ofrece igual y devuelve 0 (decisión del dueño: sin aviso). */}
                    <div className="grid gap-2 sm:grid-cols-2">
                        <FiltroSelect
                            label="Familia"
                            opciones={familias}
                            valor={idFamilia}
                            onValorChange={manejarFamilia}
                            etiquetaCentinela="Todas las familias"
                            cargando={cargandoCategorias}
                            ancho="completo"
                        />
                        <FiltroSelect
                            label="Tipo"
                            opciones={tipos}
                            valor={idTipo}
                            onValorChange={manejarTipo}
                            etiquetaCentinela="Todos los tipos"
                            cargando={cargandoCategorias}
                            disabled={tipos.length === 0}
                            ancho="completo"
                        />
                    </div>

                    {errorCategorias && <p className="text-sm text-destructive">{errorCategorias}</p>}

                    {/* 3er nivel — la huella del Tipo: `select` (lista cerrada) o `text`. */}
                    {atributosHuella.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {atributosHuella.map((def) =>
                                def.tipo === 'select' && (def.opciones ?? []).length > 0 ? (
                                    <FiltroSelect
                                        key={def.clave}
                                        label={def.etiqueta}
                                        opciones={(def.opciones ?? []).map((o) => ({ valor: o, etiqueta: o }))}
                                        valor={atributos[def.clave] ?? ''}
                                        onValorChange={(v) => manejarAtributoSelect(def.clave, v)}
                                        etiquetaCentinela="Todos"
                                        ancho="completo"
                                    />
                                ) : (
                                    <div key={def.clave} className="flex flex-col gap-1">
                                        <Label className="text-xs text-muted-foreground">
                                            {def.etiqueta}
                                        </Label>
                                        <Input
                                            value={atributos[def.clave] ?? ''}
                                            onChange={(e) => manejarAtributoTexto(def.clave, e.target.value)}
                                            placeholder="Contiene…"
                                            className="h-11 md:h-9"
                                            aria-label={`Filtrar por ${def.etiqueta}`}
                                        />
                                    </div>
                                )
                            )}
                        </div>
                    )}

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

                    <div className="max-h-56 overflow-auto rounded-md border border-border">
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

"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA DE PRUEBA — Demo funcional de los componentes de la Guía 0.8
// Ruta: /dashboard/pruebas (exenta via RUTAS_PUBLICAS — NO está en menu[])
// SIN BD, SIN Server Actions, SIN stores. Datos ficticios tipados locales.
// Demuestra el patrón de uso que los CRUDs 1.0+ seguirán.
//
// ⭐ MEJORA 20 Ago 2026 — las acciones de selección viven en la TOOLBAR del
// Shell, no en una barra interna del DataTable. usePageConfig inyecta 'nuevo'/
// 'exportar' siempre y 'editar'/'eliminar' cuando hay filas seleccionadas; la
// Toolbar (0.6/0.7) las filtra por RBAC de forma central. Se mantiene
// crearColumnaAcciones para las acciones por fila (PROMOCIÓN B5 · REDISEÑO 02 Sep).
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { RefreshCw, Pencil, Trash2, Plus, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ColumnDef } from "@tanstack/react-table"

import {
    DataTable,
    ConfirmDialog,
    crearColumnaAcciones,
    useSeleccionTabla,
    type ColumnDefExtension,
} from "@/components/data-table"
import { useCanAction } from "@/hooks/useCanAction"
import { usePageConfig } from "@/hooks/usePageConfig"
import type { ToolbarAction } from "@/types/shell"

// ═══════════════════════════════════════════════════════════════════════════════
// PÍLDORA DE ESTADO — local de la demo (NO es EstadoBadge de 0.6)
// Patrón que las guías 2.3/2.4 replicarán con estados_pago.color_hex → tokens.
// ═══════════════════════════════════════════════════════════════════════════════

type EstadoDemo = "disponible" | "agotado" | "por_agotarse" | "suspendido"

const ESTADO_DEMO_TEXTO: Record<EstadoDemo, string> = {
    disponible: "Disponible",
    por_agotarse: "Por agotarse",
    agotado: "Agotado",
    suspendido: "Suspendido",
}

const ESTADO_DEMO_CLASES: Record<EstadoDemo, string> = {
    // Tokens semánticos de CATALOGO §2: border-X/30 + bg-X/10 + text-X
    disponible: "border-success/30 bg-success/10 text-success",
    por_agotarse: "border-warning/30 bg-warning/10 text-warning",
    agotado: "border-destructive/30 bg-destructive/10 text-destructive",
    suspendido: "border-info/30 bg-info/10 text-info",
}

function PildoraEstado({ estado }: { estado: EstadoDemo }) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center rounded-full font-medium",
                "border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                ESTADO_DEMO_CLASES[estado]
            )}
        >
            {ESTADO_DEMO_TEXTO[estado]}
        </span>
    )
}

interface ProductoDemo {
    id: string
    nombre: string
    categoria: string
    existencia: number
    precio: number
    estado: EstadoDemo
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIPO DEMO + DATOS FICTICIOS (~48 filas, 6 columnas)
// Tipado como un catálogo de inventario — suficiente para ejercitar la table.
// ═══════════════════════════════════════════════════════════════════════════════

function generarData(): ProductoDemo[] {
    const nombres = [
        "Laptop Pro 14", "Monitor 27\" 4K", "Mouse inalámbrico", "Teclado mecánico",
        "SSD 1TB NVMe", "RAM 16GB DDR5", "Impresora láser", "Webcam 1080p",
        "Audífonos ANC", "Hub USB-C 8 en 1", "Router Wi-Fi 6", "Bocina Bluetooth",
        "Tableta gráfica", "Disco duro 4TB", "Fuente 750W", "Gabinete RGB",
        "Tarjeta de video 8GB", "Procesador i7", "Placa base ATX", "Ventilador RGB",
        "Soporte monitor", "Cable HDMI 2m", "Adaptador USB-C", "Microfone USB",
        "Smartwatch", "Cámara IP", "Proyector 1080p", "UPS 1000VA",
        "Extensión 8 contactos", "Limpieza kit", "Pasta térmica", "Mica protectora",
        "Funda laptop 15\"", "Estuche audífonos", "Pack de pilas AA", "Cargador 65W",
        "HUB USB 4 puertos", "Lector de tarjetas", "Mini PC", "Pendrive 128GB",
        "Tarjeta de captura", "Trackball", "Alfombrilla XXL", "Cámara web 2K",
        "Switch 8 puertos", "Antena Wi-Fi", "Etiquetadora", "Báscula digital",
    ]
    const categorias = ["Cómputo", "Periféricos", "Redes", "Accesorios", "Audio", "Video"]
    const estados: EstadoDemo[] = ["disponible", "agotado", "por_agotarse", "suspendido"]

    return (
        nombres
            .map((nombre, idx) => {
                // Determinístico: pseudo-random basado en índice (estable entre renders)
                const hash = (idx * 7) % 3
                return {
                    id: `P-${String(idx + 1).padStart(3, "0")}`,
                    nombre,
                    categoria: categorias[idx % categorias.length],
                    existencia: hash === 0 ? 0 : 5 + ((idx * 13) % 80),
                    precio: 150 + ((idx * 37) % 24000),
                    estado: estados[idx % estados.length],
                }
            })
            .sort((a, b) => a.id.localeCompare(b.id))
    )
}

const DATA_INICIAL = generarData()

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMNAS — ColumnDef + extensión (visible/render/label/align/movil)
// ⭐ REDISEÑO 02 Sep 2026: label limpio · align 'derecha' (numérico → derecha +
// mono + tabular-nums automático) · movil declara la prioridad en <768px (R4).
// ═══════════════════════════════════════════════════════════════════════════════

function formatearPrecio(precio: number): string {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(precio)
}

const COLUMNAS: (ColumnDef<ProductoDemo> & ColumnDefExtension<ProductoDemo>)[] = [
    {
        accessorKey: "id",
        label: "ID",
        size: 90,
        movil: "critica",
    },
    {
        accessorKey: "nombre",
        label: "Producto",
        size: 220,
        movil: "critica",
    },
    {
        accessorKey: "categoria",
        label: "Categoría",
        size: 140,
        visible: true,
        movil: "secundaria",
    },
    {
        accessorKey: "existencia",
        label: "Existencia",
        size: 110,
        // align 'derecha' → derecha + mono + tabular-nums (Ley 6), sin cell manual
        align: "derecha",
        movil: "secundaria",
    },
    {
        accessorKey: "precio",
        label: "Precio",
        size: 140,
        align: "derecha",
        movil: "ocultar",
        // El formato de moneda SÍ es de la columna; la alineación/mono la da align
        cell: ({ row }) => formatearPrecio(row.original.precio),
    },
    {
        accessorKey: "estado",
        label: "Estado",
        size: 140,
        movil: "critica",
        // Badge semántico (tokens success/warning/destructive/info — CATALOGO §2)
        cell: ({ row }) => <PildoraEstado estado={row.original.estado} />,
    },
]

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function PruebasPage() {
    const [data, setData] = useState<ProductoDemo[]>(DATA_INICIAL)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [target, setTarget] = useState<ProductoDemo | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [confirmando, setConfirmando] = useState(false)
    // ⭐ REDISEÑO 02 Sep — densidad (R2): el toggle es el OVERRIDE del default por breakpoint
    const [densidad, setDensidad] = useState<"normal" | "compacto">("normal")
    const [eliminacionMasiva, setEliminacionMasiva] = useState<string[] | null>(null)

    // Contrato 0.7: permiso granular sobre la página demo (URL exenta)
    const puedeEliminar = useCanAction("/dashboard/pruebas", "eliminar")

    // ⭐ REDISEÑO 02 Sep — selección UNIFORME con useSeleccionTabla (B6 · NACE):
    // reemplaza el Record + Object.keys manual; el DataTable queda en modo controlado.
    const { seleccion, onSeleccionChange, claves, seleccionados, limpiar } = useSeleccionTabla(
        data,
        (p) => p.id
    )

    // ⭐ REDISEÑO 02 Sep — acciones por fila con crearColumnaAcciones (B5 · PROMOCIÓN):
    // ⭐ 20 Sep: TODAS las acciones inline (se retiró el dropdown ⋮); el RBAC se
    // envuelve aquí (0.7). Sin useMemo en la demo: los CRUDs usan useCallback/useMemo.
    const columnas = [
        ...COLUMNAS,
        crearColumnaAcciones<ProductoDemo>({
            acciones: [
                { icon: Pencil, label: "Editar", onClick: (p) => toast.info(`Editar ${p.id} (simulación)`) },
                ...(puedeEliminar
                    ? [{
                          icon: Trash2,
                          label: "Eliminar",
                          variant: "destructive" as const,
                          dataAccion: "eliminar",
                          onClick: (p: ProductoDemo) => abrirConfirmacion(p),
                      }]
                    : []),
            ],
            secundarias: [
                { icon: Download, label: "Exportar fila", onClick: (p) => toast.info(`Exportar ${p.id} (simulación)`) },
            ],
        }),
    ]

    // ══════════════════════════════════════════════════════════════════════════════
    // DEMO DE LA TOOLBAR DEL SHELL (0.6/0.7) — inyección de onClicks
    // toolbar-config declara 'nuevo' (crear) y 'exportar' (exportar) para esta ruta.
    // Aquí se les pone conducta: el merge por id del Toolbar conecta estos onClicks
    // con las acciones del diccionario. 'editar'/'eliminar' aparecen solo cuando hay
    // filas seleccionadas. El filtro RBAC (0.7) decide cuáles se ven: admin tiene
    // 'crear'/'exportar'/'editar'/'eliminar' sembrados → los ve; un rol sin esas
    // filas en la BD no ve el botón (fail-closed). Simulación: toast.
    // ══════════════════════════════════════════════════════════════════════════════
    const acciones = useMemo<ToolbarAction[]>(() => {
        const base: ToolbarAction[] = [
            {
                id: "nuevo",
                label: "Nuevo producto",
                icon: Plus,
                accion: "crear",
                variant: "default",
                onClick: () => toast.info("Nuevo producto (simulación)"),
            },
            {
                id: "exportar",
                label: "Exportar",
                icon: Download,
                accion: "exportar",
                variant: "outline",
                onClick: () => toast.info("Exportar (simulación)"),
            },
        ]

        if (claves.length === 0) return base

        base.push({
            id: "editar",
            label: "Editar",
            icon: Pencil,
            accion: "editar",
            variant: "outline",
            onClick: () =>
                toast.info(`Editar ${seleccionados.length} producto(s) (simulación)`),
        })
        base.push({
            id: "eliminar",
            label: "Eliminar",
            icon: Trash2,
            accion: "eliminar",
            variant: "destructive",
            onClick: () => {
                setEliminacionMasiva(seleccionados.map((p) => p.id))
                setConfirmOpen(true)
            },
        })

        return base
    }, [claves, seleccionados])

    usePageConfig({
        info: {
            title: "Demo",
            subtitle: "Componentes Guía 0.8",
        },
        path: "/dashboard/pruebas",
        actions: acciones,
    })

    // ══════════════════════════════════════════════════════════════════════════════
    // SIMULACIÓN DE CARGA — SIN setState en useEffect (Decisión 12)
    // El botón "Simular recarga" dispara el timeout en su HANDLER — no en un efecto.
    // ═══════════════════════════════════════════════════════════════════════════════

    function simularRecarga() {
        setLoading(true)
        setError(null)
        window.setTimeout(() => {
            setLoading(false)
            setData(generarData())
            toast.success("Datos recargados (simulación)")
        }, 1200)
    }

    function simularError() {
        setLoading(true)
        setError(null)
        window.setTimeout(() => {
            setLoading(false)
            setError("No se pudieron cargar los datos (simulación de fallo)")
            toast.error("Error simulado: revise la conexión")
        }, 900)
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // ACCIONES (rata: ConfirmDialog + toast — patrón que los CRUDs replicarán)
    // ═══════════════════════════════════════════════════════════════════════════════

    function abrirConfirmacion(producto: ProductoDemo) {
        setTarget(producto)
        setConfirmOpen(true)
    }

    async function confirmarEliminacion() {
        if (!target && !eliminacionMasiva) return { error: null }

        setConfirmando(true)
        try {
            // Simulación de Server Action (sin BD real — demo)
            await new Promise((r) => setTimeout(r, 800))
            if (eliminacionMasiva) {
                // MODO MASIVO — elimina todas las filas seleccionadas (ANEXIÓN 19 Ago 2026)
                setData((prev) => prev.filter((p) => !eliminacionMasiva.includes(p.id)))
                toast.success(`${eliminacionMasiva.length} producto(s) eliminado(s) (simulación)`)
                limpiar()
                return { error: null }
            }
            if (target) {
                setData((prev) => prev.filter((p) => p.id !== target.id))
                toast.success(`Producto ${target.id} eliminado (simulación)`)
                return { error: null }
            }
            return { error: null }
        } catch {
            return { error: "No se pudo eliminar (simulación de fallo)" }
        } finally {
            setConfirmando(false)
            setConfirmOpen(false)
            setTarget(null)
            setEliminacionMasiva(null)
        }
    }

    // El estado error se transforma para DataTable: usa union "idle" | "loading" | "error"
    const estadoTabla = error ? "error" : loading ? "loading" : "idle"

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-display">Demo — Componentes Guía 0.8</CardTitle>
                    <CardDescription>
                        DataTable · TableSkeleton · Pagination · ColumnSelector · ConfirmDialog ·
                        Toaster. Página técnica: no aparece en el menú, se abre por URL
                        (exenta en RUTAS_PUBLICAS). Sin BD — datos ficticios locales.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Button onClick={simularRecarga} variant="outline" disabled={loading}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                        Simular recarga
                    </Button>
                    <Button onClick={simularError} variant="outline" disabled={loading}>
                        Simular error
                    </Button>
                    <Button
                        onClick={() => setData((prev) => prev.filter((_, i) => i < 5))}
                        variant="outline"
                        disabled={loading}
                    >
                        Dejar 5 filas (empty)
                    </Button>
                    {/* ⭐ REDISEÑO 02 Sep — densidad (R2): override del default por breakpoint */}
                    <Button
                        onClick={() => setDensidad("compacto")}
                        variant={densidad === "compacto" ? "default" : "outline"}
                        disabled={loading}
                    >
                        Compacto
                    </Button>
                    <Button
                        onClick={() => setDensidad("normal")}
                        variant={densidad === "normal" ? "default" : "outline"}
                        disabled={loading}
                    >
                        Normal
                    </Button>
                </CardContent>
            </Card>

            {/*
                DATATABLE — patrón real de uso (⭐ REDISEÑO 02 Sep 2026):
                  · columns con ColumnDef + (visible/render/label/align/movil) +
                    crearColumnaAcciones (acciones por fila: TODAS inline —
                    ⭐ 20 Sep, sin dropdown ⋮ — sticky derecha, no ocultable)
                  · rowKey obligatorio → (p) => p.id
                  · estado: idle | loading | error
                  · onRetry → re-dispara simularRecarga
                  · enableRowSelection + useSeleccionTabla → checkboxes; las
                    acciones de selección se inyectan a la Toolbar del Shell
                    (usePageConfig), NO en una barra interna de la tabla
                  · densidad (R2) + alturaMaxima (sticky header · R1/R6)
                  · pageSize 10 para que el truncado elíptico se vea (48 filas → 5 págs)
            */}
            <DataTable<ProductoDemo>
                columns={columnas}
                data={error ? [] : data}
                rowKey={(p) => p.id}
                estado={estadoTabla}
                emptyMessage="No hay productos (simulación)"
                onRetry={simularRecarga}
                pageSize={10}
                densidad={densidad}
                alturaMaxima="420px"
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
            />

            {/*
                CONFIRMDIALOG — destrucción irreversible con accesibilidad real
                (Radix AlertDialog — focus trap, sin cierre por overlay, aria-describedby)
            */}
            <ConfirmDialog
                titulo="Eliminar producto"
                descripcion={
                    eliminacionMasiva
                        ? `Se eliminarán ${eliminacionMasiva.length} productos seleccionados. Esta acción es irreversible.`
                        : target
                            ? `Se eliminará "${target.nombre}" (${target.id}). Esta acción es irreversible y, en producción, un movimiento de inventario.`
                            : "¿Confirma la eliminación?"
                }
                confirmLabel="Eliminar"
                isLoading={confirmando}
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={confirmarEliminacion}
            />

            {/* Nota de uso para el administrador/implementador */}
            <p className="text-xs text-muted-foreground">
                Verificación funcional: ordena por cualquier columna (clic → asc → desc → sin
                orden), oculta/muestra columnas (se persiste en localStorage por ruta), usa
                &quot;Simular recarga&quot; para ver el skeleton y &quot;Simular error&quot; para el retry.
                Selecciona filas con los checkboxes: en la Toolbar del Shell aparecen
                &quot;Editar&quot; y &quot;Eliminar&quot;. Para el rol vendedor el botón de eliminar no aparece
                (useCanAction / filtro RBAC de la 0.7).
            </p>
        </div>
    )
}

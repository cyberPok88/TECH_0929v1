'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTO FICHA — página de detalle del producto (Guía 1.2 · Parte 6 · Smart)
// Carga obtenerProducto(id) y pinta las pestañas:
//   · Ficha (todo el detalle + banner pendiente_enriquecimiento)
//   · Sustitutos (placeholder — se activa en la Parte 7)
//   · Últimos precios pagados / Kardex (placeholders disabled → 1.4/1.5)
// Puentes a módulos futuros como botones disabled con tooltip (D18 · cero rutas
// muertas). "Marcar enriquecido" limpia el flag (roles con editar).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Pildora, TableSkeleton } from '@/components/data-table'
import { AtributosChips } from '@/components/catalogos/productos/AtributosChips'
import { ProductoSustitutosTab } from '@/components/catalogos/productos/ProductoSustitutosTab'
// ANEXIÓN Guía 1.5 (17 Sep 2026): pestaña Kardex — lee el libro del dominio inventario
import { ProductoKardexTab } from '@/components/catalogos/productos/ProductoKardexTab'
import { useCanAction } from '@/hooks/useCanAction'
import { usePageConfig } from '@/hooks/usePageConfig'
import { completarEnriquecimiento, obtenerProducto } from '@/lib/actions/productos'
import { formatearMoneda } from '@/lib/utils/formatters'
import type { Producto } from '@/types/productos'
import { TEXTO_ESTADO_PRODUCTO, TONO_ESTADO_PRODUCTO, estadoDeProducto } from '@/types/productos'

const RUTA_BASE = '/dashboard/catalogos/productos'

interface TabDefinicion {
    id: 'ficha' | 'sustitutos' | 'precios' | 'kardex'
    etiqueta: string
    disabled?: boolean
}

const TABS: TabDefinicion[] = [
    { id: 'ficha', etiqueta: 'Ficha' },
    { id: 'sustitutos', etiqueta: 'Sustitutos' },
    { id: 'precios', etiqueta: 'Últimos precios', disabled: true },
    // ANEXIÓN Guía 1.5 (17 Sep 2026): la pestaña Kardex se habilita — el libro de
    // inventario existe (movimientos_inventario) y esta guía construyó su lectura.
    { id: 'kardex', etiqueta: 'Kardex' },
]

type TabId = TabDefinicion['id']

function FilaDetalle({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[180px_1fr] gap-2 border-b border-border py-1.5 text-sm last:border-0">
            <span className="text-muted-foreground">{etiqueta}</span>
            <span className="text-foreground">{valor ?? '—'}</span>
        </div>
    )
}

export function ProductoFicha() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const searchParams = useSearchParams()
    const puedeEditar = useCanAction(RUTA_BASE, 'editar')

    const [producto, setProducto] = useState<Producto | null>(null)
    const [cargando, setCargando] = useState(true)
    const [noExiste, setNoExiste] = useState(false)
    // ANEXIÓN Guía 1.5: soporta ?tab=kardex (deep link desde Existencias "Ver kardex").
    const [tab, setTab] = useState<TabId>(() => {
        const q = searchParams.get('tab')
        return q === 'kardex' || q === 'sustitutos' ? q : 'ficha'
    })

    usePageConfig({
        info: { title: 'Producto', subtitle: 'Catálogos' },
        path: RUTA_BASE,
    })

    const recargar = (id: string) => {
        void obtenerProducto(id).then((res) => {
            setCargando(false)
            if (!res.success || !res.data) {
                setNoExiste(true)
                return
            }
            setProducto(res.data)
        })
    }

    useEffect(() => {
        if (!params?.id) return
        recargar(params.id)
    }, [params?.id])

    const marcarEnriquecido = async () => {
        if (!producto) return
        const res = await completarEnriquecimiento(producto.id)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo marcar como enriquecido.')
            return
        }
        toast.success('Producto marcado como enriquecido.')
        recargar(producto.id)
    }

    if (cargando) return <TableSkeleton />

    if (noExiste || !producto) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">El producto no existe o fue eliminado.</p>
                <Button variant="outline" onClick={() => router.push(RUTA_BASE)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver al catálogo
                </Button>
            </div>
        )
    }

    const estado = estadoDeProducto(producto)

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.push(RUTA_BASE)}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Catálogo
                    </Button>
                    <h1 className="text-lg font-semibold">{producto.nombre}</h1>
                    <span className="font-mono text-xs text-muted-foreground">{producto.sku}</span>
                    <Pildora
                        texto={TEXTO_ESTADO_PRODUCTO[estado]}
                        tono={TONO_ESTADO_PRODUCTO[estado]}
                    />
                    {producto.pendiente_enriquecimiento && (
                        <Pildora texto="Pendiente de enriquecer" tono="advertencia" />
                    )}
                </div>
            </div>

            {producto.pendiente_enriquecimiento && puedeEditar && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-warning-bg/40 px-3 py-2 text-sm">
                    <span>
                        Creado al vuelo (alta rápida) — falta completar datos como precios, ubicación o fotos.
                    </span>
                    <Button size="sm" onClick={() => void marcarEnriquecido()}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como enriquecido
                    </Button>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                {TABS.map((t) => (
                    <Button
                        key={t.id}
                        type="button"
                        variant={tab === t.id && !t.disabled ? 'default' : 'ghost'}
                        size="sm"
                        disabled={t.disabled}
                        title={t.disabled ? 'Disponible próximamente' : undefined}
                        onClick={() => !t.disabled && setTab(t.id)}
                    >
                        {t.etiqueta}
                    </Button>
                ))}
            </div>

            {tab === 'ficha' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-md border border-border p-4">
                        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Identidad</h2>
                        <FilaDetalle etiqueta="Nombre" valor={producto.nombre} />
                        <FilaDetalle etiqueta="SKU" valor={<span className="font-mono">{producto.sku}</span>} />
                        <FilaDetalle etiqueta="Código de barras" valor={producto.codigo_barras} />
                        <FilaDetalle etiqueta="Descripción" valor={producto.descripcion} />
                        <FilaDetalle etiqueta="Marca" valor={producto.marca_nombre} />
                        <FilaDetalle etiqueta="Categoría" valor={producto.categoria_nombre} />
                        <FilaDetalle etiqueta="Unidad" valor={producto.unidad_nombre} />
                    </section>
                    <section className="rounded-md border border-border p-4">
                        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Precios e impuesto</h2>
                        <FilaDetalle etiqueta="Precio base" valor={formatearMoneda(producto.precio_base)} />
                        <FilaDetalle etiqueta="Precio mínimo" valor={producto.precio_minimo === null ? '—' : formatearMoneda(producto.precio_minimo)} />
                        <FilaDetalle etiqueta="Impuesto" valor={producto.impuesto_nombre} />
                        <h2 className="mb-2 mt-4 text-sm font-semibold uppercase text-muted-foreground">Inventario</h2>
                        <FilaDetalle etiqueta="Stock actual" valor={formatearMoneda(producto.stock_actual)} />
                        <FilaDetalle etiqueta="Stock mínimo" valor={formatearMoneda(producto.stock_minimo)} />
                        <FilaDetalle etiqueta="Ubicación default" valor={producto.ubicacion_texto} />
                        <FilaDetalle etiqueta="Requiere revisión" valor={producto.requiere_revision ? 'Sí' : 'No'} />
                        <FilaDetalle etiqueta="Maneja número de serie" valor={producto.maneja_numero_serie ? 'Sí' : 'No'} />
                    </section>
                    <section className="rounded-md border border-border p-4 lg:col-span-2">
                        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Características técnicas</h2>
                        <div className="flex flex-wrap gap-1.5">
                            <AtributosChips atributos={producto.atributos} max={50} />
                        </div>
                        <div className="mt-3">
                            {Object.entries(producto.atributos).map(([clave, valor]) => (
                                <div key={clave} className="grid grid-cols-[180px_1fr] gap-2 border-b border-border py-1 text-sm last:border-0">
                                    <span className="text-muted-foreground">{clave}</span>
                                    <span>{String(valor ?? '')}</span>
                                </div>
                            ))}
                            {Object.keys(producto.atributos).length === 0 && (
                                <p className="text-sm text-muted-foreground">Sin características definidas.</p>
                            )}
                        </div>
                    </section>
                    <section className="rounded-md border border-border p-4 lg:col-span-2">
                        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Fiscal y notas</h2>
                        <FilaDetalle etiqueta="Clave ProdServ (SAT)" valor={producto.sat_prod_descripcion ?? producto.id_clave_prod_serv_sat} />
                        <FilaDetalle etiqueta="Clave Unidad (SAT)" valor={producto.sat_unid_nombre ?? producto.id_clave_unidad_sat} />
                        <FilaDetalle etiqueta="Notas" valor={producto.notas} />
                        <FilaDetalle etiqueta="Creado" valor={producto.created_at ? new Date(producto.created_at).toLocaleString() : null} />
                        <FilaDetalle etiqueta="Actualizado" valor={producto.updated_at ? new Date(producto.updated_at).toLocaleString() : null} />
                    </section>
                    <section className="rounded-md border border-border p-4 lg:col-span-2">
                        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Puentes (disponibles próximamente)</h2>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'compras', label: 'Compras (1.4)' },
                                { id: 'inventario', label: 'Inventario (1.5)' },
                                { id: 'cotizaciones', label: 'Cotizaciones (1.7)' },
                                { id: 'ventas', label: 'Ventas (1.8)' },
                            ].map((p) => (
                                <Button key={p.id} variant="outline" size="sm" disabled title={`Disponible con ${p.label}`}>
                                    {p.label}
                                </Button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {tab === 'sustitutos' && <ProductoSustitutosTab producto={producto} />}

            {/* ANEXIÓN Guía 1.5: pestaña Kardex — movimientos del libro de inventario */}
            {tab === 'kardex' && <ProductoKardexTab producto={producto} />}
        </div>
    )
}

'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTO KARDEX TAB — pestaña Kardex de la ficha de producto (Guía 1.5 · anexión 1.2)
// Lee el libro del dominio INVENTARIO (listarMovimientosPorProducto) y pinta la
// KardexTabla reutilizable + export CSV. Misma vida que ProductoSustitutosTab.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listarMovimientosPorProducto } from '@/lib/actions/inventario'
import type { EstadoTabla } from '@/components/data-table'
import { KardexTabla } from '@/components/inventario/KardexTabla'
import { exportarKardexCsv } from '@/components/inventario/exportar-kardex-csv'
import type { MovimientoInventario } from '@/types/inventario'
import type { Producto } from '@/types/productos'

const PAGE = 1
const TAMANO = 25

interface ProductoKardexTabProps {
    producto: Producto
}

export function ProductoKardexTab({ producto }: ProductoKardexTabProps) {
    const [filas, setFilas] = useState<MovimientoInventario[]>([])
    const [estado, setEstado] = useState<EstadoTabla>('loading')
    const [total, setTotal] = useState(0)

    const cargar = useCallback(async () => {
        const res = await listarMovimientosPorProducto(producto.id, PAGE, TAMANO)
        if (!res.success) {
            setEstado('error')
            return
        }
        setFilas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstado('idle')
    }, [producto.id])

    useEffect(() => {
        let activo = true
        void listarMovimientosPorProducto(producto.id, PAGE, TAMANO).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstado('error')
                return
            }
            setFilas(res.data ?? [])
            setTotal(res.total ?? 0)
            setEstado('idle')
        })
        return () => {
            activo = false
        }
    }, [producto.id])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    Movimientos del libro de inventario de este producto ({total}).
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportarKardexCsv(filas, producto)}
                    disabled={filas.length === 0}
                >
                    <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
            </div>
            <KardexTabla
                filas={filas}
                estado={estado}
                total={total}
                onRetry={() => void cargar()}
            />
        </div>
    )
}

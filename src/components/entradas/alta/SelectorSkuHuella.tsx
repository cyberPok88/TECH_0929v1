'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR SKU POR HUELLA — resuelve el SKU en ALMACÉN (Guía 1.6 · P6 · Smart)
// ⭐ Evolución V5 (20 Sep): la REVISIÓN deja la HUELLA; aquí se propone el SKU
// candidato (`buscarProductosPorAtributos`) o se crea guiado (`crearProductoRapido`).
// Lo consumen el cotejo de alta y la resolución de divergencia (mismo patrón).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buscarProductosPorAtributos } from '@/lib/actions/productos'
import { crearProductoRapido } from '@/lib/actions/entradas'

export interface SkuOpcion {
    id: string
    sku: string
    nombre: string
}

interface SelectorSkuHuellaProps {
    idCategoria: string | null
    idMarca: string | null
    marcaNombre: string | null
    atributos: Record<string, unknown>
    valor: string
    onChange: (idProducto: string) => void
    disabled?: boolean
}

const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

export function SelectorSkuHuella({
    idCategoria,
    idMarca,
    marcaNombre,
    atributos,
    valor,
    onChange,
    disabled = false,
}: SelectorSkuHuellaProps) {
    const [opciones, setOpciones] = useState<SkuOpcion[]>([])
    const [creando, setCreando] = useState(false)
    const onChangeRef = useRef(onChange)
    const ultimaHuella = useRef('')

    useEffect(() => {
        onChangeRef.current = onChange
    })

    const huellaKey = `${idCategoria ?? ''}|${idMarca ?? ''}|${JSON.stringify(atributos ?? {})}`

    useEffect(() => {
        if (!idCategoria || !idMarca) return
        if (ultimaHuella.current === huellaKey) return
        ultimaHuella.current = huellaKey
        let activo = true
        void buscarProductosPorAtributos({
            id_categoria: idCategoria,
            id_marca: idMarca,
            atributos: aTexto(atributos),
        }).then((r) => {
            if (!activo || !r.success) return
            const lista = (r.data ?? []) as SkuOpcion[]
            setOpciones(lista)
            if (lista.length === 1) onChangeRef.current(lista[0].id)
        })
        return () => {
            activo = false
        }
    }, [huellaKey, idCategoria, idMarca, atributos])

    const crear = async () => {
        if (!idCategoria || !idMarca) {
            toast.error('Falta categoría o marca para crear el producto.')
            return
        }
        setCreando(true)
        const nombre = [marcaNombre, ...Object.values(aTexto(atributos))].filter(Boolean).join(' ')
        const res = await crearProductoRapido({
            id_categoria: idCategoria,
            id_marca: idMarca,
            nombre,
            atributos: aTexto(atributos),
        })
        setCreando(false)
        if (!res.success || !res.data) {
            toast.error(res.error ?? 'No se pudo crear el producto.')
            return
        }
        const nuevo: SkuOpcion = { id: res.data.id, sku: res.data.sku, nombre }
        toast.success(`Producto ${nuevo.sku} creado (pendiente de enriquecimiento)`)
        setOpciones((prev) => [...prev, nuevo])
        onChangeRef.current(nuevo.id)
    }

    if (opciones.length === 0) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sin coincidencias.</span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void crear()}
                    disabled={disabled || creando}
                >
                    <Plus className="mr-1 h-4 w-4" /> Crear producto
                </Button>
            </div>
        )
    }

    return (
        <select
            className="h-9 w-full rounded-md border bg-surface px-2 text-sm"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
        >
            <option value="">— elige SKU —</option>
            {opciones.map((p) => (
                <option key={p.id} value={p.id}>
                    {p.sku} — {p.nombre}
                </option>
            ))}
        </select>
    )
}

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
import { nombreDesdeHuella } from '@/types/entradas'

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
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **si la mercancía se identifica por número de serie**, tal como lo
     * declaró la PUERTA (`partidas_entrada.lleva_ns`). El alta del SKU lo hereda: antes se escribía
     * `false` a mano y **un disco nacía sin manejar serie** ⇒ salía del inventario sin pedir su NS.
     */
    manejaNumeroSerie?: boolean
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **el alta abre el FORMULARIO de producto, prellenado con la huella.**
     *
     * Lo pidió el dueño para el alta de Almacén: *«el alta sí abrir el formulario»*. El alta rápida
     * (`crearProductoRapido`) nace «pendiente de enriquecimiento» y **no deja capturar las
     * características técnicas**; el formulario sí, y viene lleno con lo que la Revisión ya dejó.
     *
     * Si el llamador no pasa esto, el botón se comporta como antes (alta rápida): la resolución de
     * divergencia sigue igual hasta que se decida lo mismo para ella.
     */
    onCrearConFormulario?: () => void
    /**
     * ⭐ FIX 08 Oct 2026 (2ª VF del dueño) — **avisa que se creó/reutilizó un SKU.**
     *
     * El caso medido: `ING-0003` tiene **dos partidas con la MISMA huella** y el almacenista creó el
     * producto en la primera línea… y **la segunda le seguía ofreciendo «Crear producto»**. El dato
     * salió bien (la reutilización por `23505` funcionó: una sola pieza de catálogo, las dos huellas
     * apuntándole), pero **la pantalla no lo dijo**: el padre sólo se enteraba por el camino del
     * **formulario** (`onExito`), no por el del **alta rápida**.
     *
     * ⇒ Con esto, los DOS caminos avisan y el padre puede remontar los selectores hermanos (ver
     * `generacionSku` en `CotejoAltaModal`): la segunda línea **vuelve a buscar y lo encuentra sola**,
     * sin que nadie tenga que pulsar «Crear producto» para descubrir que ya existía.
     */
    onCrear?: (id: string, sku: string, existente: boolean) => void
}

/**
 * La huella tal como la guarda `partidas_resueltas` (`Record<string, unknown>`) pasa a la forma
 * cruda del formulario de producto (`string`). Se exporta porque el alta del cotejo arma el
 * **prellenado del formulario** con la misma conversión: una sola fuente.
 */
export const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

export function SelectorSkuHuella({
    idCategoria,
    idMarca,
    marcaNombre,
    atributos,
    valor,
    onChange,
    disabled = false,
    manejaNumeroSerie,
    onCrearConFormulario,
    onCrear,
}: SelectorSkuHuellaProps) {
    const [opciones, setOpciones] = useState<SkuOpcion[]>([])
    const [creando, setCreando] = useState(false)
    const onChangeRef = useRef(onChange)
    const ultimaHuella = useRef('')
    /** ⭐ FIX 05 Oct 2026 — candado de reentrada del alta. `creando` (estado) no alcanza: tres
     *  clics seguidos en el mismo tick disparan tres veces antes de que React re-renderice. */
    const creandoRef = useRef(false)

    useEffect(() => {
        onChangeRef.current = onChange
    })

    const huellaKey = `${idCategoria ?? ''}|${idMarca ?? ''}|${JSON.stringify(atributos ?? {})}`

    useEffect(() => {
        if (!idCategoria || !idMarca) return
        if (ultimaHuella.current === huellaKey) return
        let activo = true
        void buscarProductosPorAtributos({
            id_categoria: idCategoria,
            id_marca: idMarca,
            atributos: aTexto(atributos),
        }).then((r) => {
            if (!activo || !r.success) return
            /**
             * 🔴 FIX 08 Oct 2026 (VF del dueño: *«al querer hacer la 0002 el modal de cotejar no
             * detectó el producto ya creado en 0001»*) — **LA MARCA DE «YA CONSULTÉ» VA DESPUÉS DEL
             * RESULTADO, NO ANTES DE PEDIRLO.**
             *
             * Este `useRef` es una guarda contra repetir la búsqueda, y estaba mal puesta: se escribía
             * **antes** de lanzar la promesa. Con el **Strict Mode** que Next trae encendido por
             * defecto en el App Router (`next.config.ts` no lo apaga; la doc de Next lo dice: *«Since
             * Next.js 13.5.1, Strict Mode is `true` by default with `app` router»*), React monta así:
             *
             *     run 1   → marca la huella y LANZA la búsqueda
             *     cleanup → `activo = false`  ⇒ el resultado de run 1 se DESCARTA
             *     run 2   → la huella ya está marcada ⇒ RETURN sin buscar
             *
             * ⇒ **`opciones` no se llenaba nunca** y el selector decía **«Sin coincidencias» SIEMPRE**
             * —aunque el producto existiera—. Era la causa de fondo de todos los «no lo detectó»: se
             * creaba el producto una y otra vez porque la pantalla nunca veía lo que la BD ya tenía.
             *
             * ⚠️ Marcarla acá (y no antes) es seguro: el efecto sólo se re-dispara si cambian sus
             * dependencias, no en cada render, así que no hay bucle. Y si la búsqueda falla, la huella
             * **no** queda marcada: el próximo cambio vuelve a intentar en vez de mentir con un vacío.
             */
            ultimaHuella.current = huellaKey
            const lista = (r.data ?? []) as SkuOpcion[]
            setOpciones(lista)
            if (lista.length === 1) onChangeRef.current(lista[0].id)
        })
        return () => {
            activo = false
        }
    }, [huellaKey, idCategoria, idMarca, atributos])

    /**
     * ⭐ FIX 08 Oct 2026 (lo cazó el dueño en la VF) — **SI EL SKU DE LA LÍNEA NO ESTÁ EN LA LISTA,
     * SE VUELVE A PREGUNTAR.**
     *
     * El defecto, medido: el cotejo no encontraba el SKU, el almacenista creaba el producto con el
     * **FORMULARIO** (`onCrearConFormulario`), el padre dejaba el id **seleccionado**… y el selector
     * seguía diciendo **«Sin coincidencias»** — porque `opciones` se llenó UNA vez y el alta por
     * formulario no la toca (la «Alta rápida», que sí la actualiza, es por eso la única que se veía
     * bien). Con el producto ya creado **la búsqueda sí lo encuentra**: lo único que faltaba era
     * volver a preguntar. Sin esto el alta no se podía cerrar y la entrada quedaba en `en_almacen`.
     *
     * ⚠️ **No puede quedar en bucle:** si la búsqueda vuelve sin el `valor`, `setOpciones` no se llama
     * cuando la lista viene vacía y las dependencias del efecto no cambian ⇒ no se re-dispara.
     */
    const valorHuerfano = !!valor && !opciones.some((o) => o.id === valor)
    useEffect(() => {
        if (!valorHuerfano || !idCategoria || !idMarca) return
        let activo = true
        void buscarProductosPorAtributos({
            id_categoria: idCategoria,
            id_marca: idMarca,
            atributos: aTexto(atributos),
        }).then((r) => {
            if (!activo || !r.success) return
            const lista = (r.data ?? []) as SkuOpcion[]
            if (lista.length > 0) setOpciones(lista)
        })
        return () => {
            activo = false
        }
    }, [valorHuerfano, valor, idCategoria, idMarca, atributos])

    const crear = async () => {
        if (!idCategoria || !idMarca) {
            toast.error('Falta categoría o marca para crear el producto.')
            return
        }
        // ⭐ FIX 05 Oct 2026 — primera barrera: el candado del cliente (tres clics = una alta).
        // La segunda barrera es `crearProductoRapido`, que ahora BUSCA por huella antes de crear.
        if (creandoRef.current) return
        creandoRef.current = true
        setCreando(true)
        const nombreBase = nombreDesdeHuella(marcaNombre, atributos)
        const res = await crearProductoRapido({
            id_categoria: idCategoria,
            id_marca: idMarca,
            nombre: nombreBase,
            atributos: aTexto(atributos),
            // ⭐ MEJORA 52 — lo que declaró la puerta. Si el llamador no lo pasa, `crearProductoRapido`
            // usa `true` (asumir «no lleva serie» es lo que rompía: el disco salía sin pedir el NS).
            maneja_numero_serie: manejaNumeroSerie,
        })
        creandoRef.current = false
        setCreando(false)
        if (!res.success || !res.data) {
            toast.error(res.error ?? 'No se pudo crear el producto.')
            return
        }
        // `existente: true` ⇒ la acción encontró uno con la MISMA huella y lo reutilizó.
        // Se dice tal cual: decir «creado» cuando en realidad se reutilizó es lo que hacía
        // invisible el duplicado.
        toast.success(
            res.data.existente
                ? `Ya existía ${res.data.sku} con esa huella — se reutiliza`
                : `Producto ${res.data.sku} creado (pendiente de enriquecimiento)`
        )
        const id = res.data.id
        const sku = res.data.sku
        setOpciones((prev) =>
            prev.some((p) => p.id === id) ? prev : [...prev, { id, sku, nombre: nombreBase }]
        )
        onChangeRef.current(id)
        // ⭐ FIX 08 Oct 2026 — el camino del ALTA RÁPIDA también avisa al padre (el del formulario ya
        // lo hacía por `onExito`). Sin esto, una huella repetida en la MISMA entrada dejaba a la otra
        // línea pidiendo «Crear producto» para un producto que acababa de nacer.
        onCrear?.(id, sku, res.data.existente === true)
    }

    if (opciones.length === 0) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sin coincidencias.</span>
                {onCrearConFormulario ? (
                    /* ⭐ MEJORA 52 — el camino del dueño: el FORMULARIO, prellenado con la huella.
                       El alta rápida queda como salida secundaria para quien no quiere capturar nada
                       ahora (nace «pendiente de enriquecimiento», como siempre). */
                    <>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={onCrearConFormulario}
                            disabled={disabled}
                        >
                            <Plus className="mr-1 h-4 w-4" /> Crear producto
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void crear()}
                            disabled={disabled || creando}
                            title="Alta rápida: solo con la huella, se enriquece después"
                        >
                            Alta rápida
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void crear()}
                        disabled={disabled || creando}
                    >
                        <Plus className="mr-1 h-4 w-4" /> Crear producto
                    </Button>
                )}
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

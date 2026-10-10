'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTO MODAL — alta de producto (Guía 1.2 · Parte 3 · Smart)
// Modal ~960px con sidebar vertical de 6 secciones (anatomía §4):
//   1 Identidad · 2 Clasificación (+ características dinámicas) · 3 Precios ·
//   4 Inventario/ubicación (+ flags) · 5 Fiscal SAT · 6 Control
// Parte 3 = modo 'crear'. El modo 'editar' se habilita en la Parte 4.
// Reglas del plan: marca obligatoria (select filtrado por la categoría + crear al
// vuelo) · «otra…» agrega opción al esquema (solo quien edita el hub = Admin) ·
// defaults: unidad Pieza e impuesto IVA 16 % · cambiar de categoría vacía atributos.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { AtributosDinamicos } from '@/components/catalogos/productos/producto-form/AtributosDinamicos'
import { useCanAction } from '@/hooks/useCanAction'
import { usePageConfig } from '@/hooks/usePageConfig'
import { editarCategoria, listarImpuestos, listarUbicacionesAlmacen, listarUnidadesMedida } from '@/lib/actions/catalogos'
import {
    crearMarcaConCategorias,
    crearProducto,
    editarProducto,
    listarClavesSAT,
    listarMarcasPorCategoria,
} from '@/lib/actions/productos'
import { convertirAtributosCrudos, productoSchema, validarAtributosContraEsquema } from '@/lib/validations/productos'
import type { AtributoEsquema, CategoriaFila, ImpuestoFila, UbicacionAlmacenFila, UnidadMedidaFila } from '@/types/catalogos'
import type { ClaveSAT, Producto, ProductoFormData } from '@/types/productos'
import { productoFormDataVacio } from '@/types/productos'

const SECCIONES = ['Identidad', 'Clasificación', 'Precios', 'Inventario', 'Fiscal SAT', 'Control']

/** Los defaults del formulario, en UN solo lugar (los usan la carga de catálogos y el guardado). */
const UNIDAD_POR_DEFECTO = 'Pieza'
const IMPUESTO_POR_DEFECTO = 'IVA_16'

/**
 * ⭐ FIX 08 Oct 2026 (lo reportó el dueño en la VF) — **los defaults se resuelven TAMBIÉN al guardar.**
 *
 * El síntoma: *«tengo que abrir la pestaña 4 Inventario para que se seleccione la unidad de medida;
 * si no abro la pestaña, no deja guardar porque pide la unidad de medida»*. El único lugar donde se
 * veía el select era esa pestaña, y Guardar respondía **«Elige la unidad de medida»**.
 *
 * La causa: el default se escribía **sólo** en el efecto de carga de catálogos — una promesa que
 * resuelve DESPUÉS del primer render. Entre el montaje y esa resolución, `form.id_unidad_medida`
 * seguía vacío y Guardar lo rechazaba; abrir la pestaña no cambiaba el dato, **cambiaba el momento**
 * (para entonces la promesa ya había vuelto). O sea: un defecto de **carrera**, y por eso se veía
 * intermitente.
 *
 * ⇒ Los defaults se resuelven con **una sola función**, en los dos momentos: cuando llegan los
 * catálogos **y** justo antes de validar. Si el catálogo ya está en memoria, Guardar **no depende de
 * qué pestaña se abrió**. Es idempotente: nunca pisa un valor elegido a mano.
 */
function resolverDefaults(
    unidades: UnidadMedidaFila[],
    impuestos: ImpuestoFila[],
    form: ProductoFormData
): ProductoFormData {
    const unidad =
        form.id_unidad_medida ||
        unidades.find((u) => u.es_activo && u.nombre === UNIDAD_POR_DEFECTO)?.id ||
        ''
    const impuesto =
        form.id_impuesto || impuestos.find((i) => i.clave === IMPUESTO_POR_DEFECTO)?.id || ''
    if (unidad === form.id_unidad_medida && impuesto === form.id_impuesto) return form
    return { ...form, id_unidad_medida: unidad, id_impuesto: impuesto }
}

interface ProductoModalProps {
    modo: 'crear' | 'editar'
    producto?: Producto | null
    categorias: CategoriaFila[]
    onCerrar: () => void
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — en **modo crear** entrega el producto recién creado, para que quien
     * abrió el formulario **desde otro flujo** (el alta del cotejo en Almacén) pueda dejarlo
     * **seleccionado** sin volver a buscarlo. Los llamadores que no lo necesitan siguen pasando una
     * función sin parámetros.
     */
    onExito: (creado?: { id: string; sku: string }) => void
    /**
     * ⭐ MEJORA 52 — **el formulario viene PRELLENADO con la HUELLA** que la Revisión dejó: la
     * categoría de la partida, su marca y sus atributos. Sin esto, dar de alta desde Almacén
     * obligaría a volver a teclear lo que la pieza ya sabe.
     */
    inicial?: Partial<ProductoFormData> | null
}

interface MarcaOpcion { id: string; nombre: string }

/** Esquema efectivo: el de la categoría final; si es sub sin esquema, el de su raíz. */
function esquemaEfectivo(categorias: CategoriaFila[], idCategoria: string): AtributoEsquema[] {
    const fila = categorias.find((c) => c.id === idCategoria)
    if (!fila) return []
    if ((fila.esquema_atributos ?? []).length > 0) return fila.esquema_atributos
    if (fila.id_categoria_padre) {
        const padre = categorias.find((c) => c.id === fila.id_categoria_padre)
        return padre?.esquema_atributos ?? []
    }
    return []
}

export function ProductoModal({ modo, producto, categorias, onCerrar, onExito, inicial }: ProductoModalProps) {
    const [form, setForm] = useState<ProductoFormData>(() => {
        if (producto) return productoAFormulario(producto)
        const base = productoFormDataVacio()
        return inicial ? { ...base, ...inicial } : base
    })
    const [seccion, setSeccion] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [ocupado, setOcupado] = useState(false)

    const [categoriasLocal, setCategoriasLocal] = useState<CategoriaFila[]>(categorias)
    /** La categoría de la que se derivan raíz y hoja: la del producto (editar) o la del prellenado. */
    const idCategoriaBase = producto?.id_categoria ?? inicial?.id_categoria ?? ''
    const [idRaiz, setIdRaiz] = useState(() => {
        if (!idCategoriaBase) return ''
        const fila = categorias.find((c) => c.id === idCategoriaBase)
        return fila?.id_categoria_padre ?? fila?.id ?? ''
    })
    const [idHoja, setIdHoja] = useState(() => {
        if (!idCategoriaBase) return ''
        const fila = categorias.find((c) => c.id === idCategoriaBase)
        return fila?.id_categoria_padre ? fila.id : ''
    })

    const [unidades, setUnidades] = useState<UnidadMedidaFila[]>([])
    const [impuestos, setImpuestos] = useState<ImpuestoFila[]>([])
    const [ubicaciones, setUbicaciones] = useState<UbicacionAlmacenFila[]>([])
    const [marcas, setMarcas] = useState<MarcaOpcion[]>([])
    const [crearMarcaActivo, setCrearMarcaActivo] = useState(false)
    const [nombreMarcaNueva, setNombreMarcaNueva] = useState('')

    const [satProd, setSatProd] = useState<ClaveSAT[]>([])

    const puedeOtra = useCanAction('/dashboard/catalogos/catalogos-basicos', 'editar')
    usePageConfig({ info: { title: 'Productos', subtitle: 'Catálogos' }, path: '/dashboard/catalogos/productos' })

    const categoriaFinal = form.id_categoria
    const esquema = useMemo(
        () => esquemaEfectivo(categoriasLocal, categoriaFinal),
        [categoriasLocal, categoriaFinal]
    )

    const raices = useMemo(
        () =>
            categoriasLocal
                .filter((c) => !c.id_categoria_padre && c.es_activo)
                .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        [categoriasLocal]
    )

    const subsDeRaiz = useMemo(() => {
        if (!idRaiz) return []
        return categoriasLocal
            .filter((c) => c.id_categoria_padre === idRaiz && c.es_activo)
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
    }, [categoriasLocal, idRaiz])

    const raizTieneHijos = subsDeRaiz.length > 0

    const setCampo = useCallback(<K extends keyof ProductoFormData>(clave: K, valor: ProductoFormData[K]) => {
        setForm((f) => ({ ...f, [clave]: valor }))
    }, [])

    /**
     * ⭐ FIX 08 Oct 2026 (VF del dueño) — **LOS CATÁLOGOS SE PIDEN CUANDO SE ABRE EL DESPLEGABLE, NO AL
     * ABRIR EL FORMULARIO.**
     *
     * Lo reportó así: *«cuando abre el form de nuevo producto pide la unidad de medida; por defecto pon
     * Pieza, pero que no busque ese dato en la base a menos que abran el desplegable de las opciones,
     * porque siento que hace una búsqueda en la BD al abrir el formulario»*. **Y era cierto:** al montar
     * se disparaban **5 consultas** (`unidades` · `impuestos` · `ubicaciones` · claves SAT · marcas), y
     * el caso más común —el alta que abre el cotejo— solo quiere **escribir un nombre**: categoría,
     * marca y atributos **ya vienen de la huella**.
     *
     * ⇒ Los tres catálogos del formulario se cargan **una sola vez, al primer desplegable que se abre**
     * (`onFocus`), y `guardar()` los pide **solo si de verdad hacen falta** (si el default quedó sin
     * resolver). El campo muestra el default **sin consultar nada**: la primera opción dice
     * «Pieza (por defecto)».
     *
     * ⚠️ La promesa se guarda **en un ref**, no en estado: así dos desplegables que se abran seguidos
     * —o un `guardar()` mientras la carga vuela— **comparten la misma consulta** en vez de duplicarla.
     */
    const catalogoPromesa = useRef<Promise<{ unidades: UnidadMedidaFila[]; impuestos: ImpuestoFila[] }> | null>(null)
    const cargarCatalogos = useCallback(() => {
        if (!catalogoPromesa.current) {
            catalogoPromesa.current = Promise.all([
                listarUnidadesMedida(),
                listarImpuestos(),
                listarUbicacionesAlmacen(),
            ]).then(([un, imp, ubi]) => {
                const u = un.success ? un.data ?? [] : []
                const i = imp.success ? imp.data ?? [] : []
                if (ubi.success) setUbicaciones(ubi.data ?? [])
                setUnidades(u)
                setImpuestos(i)
                setForm((f) => resolverDefaults(u, i, f))
                return { unidades: u, impuestos: i }
            })
        }
        return catalogoPromesa.current
    }, [])

    /**
     * La lista SAT del subset ProdServ (desplegable de la sección Fiscal · MEJORA 04 Sep) — **también
     * perezosa**: es la consulta más larga de las cinco y la mayoría de las altas no la miran.
     * La clave de unidad del SAT NO se pregunta aquí: se deriva de la unidad de medida al guardar
     * (`resolverClaveUnidadSAT` en la Server Action).
     */
    const satPromesa = useRef<Promise<void> | null>(null)
    const cargarSAT = useCallback(() => {
        if (!satPromesa.current) {
            satPromesa.current = listarClavesSAT('prod_serv').then((res) => {
                if (res.success) setSatProd(res.data ?? [])
            })
        }
        return satPromesa.current
    }, [])

    const elegirCategoria = useCallback(
        async (finalId: string) => {
            setForm((f) => ({ ...f, id_categoria: finalId, atributos: {}, id_marca: '' }))
            setMarcas([])
            if (!finalId) return
            const res = await listarMarcasPorCategoria(finalId)
            if (res.success) setMarcas((res.data ?? []).map((m) => ({ id: m.id, nombre: m.nombre })))
        },
        []
    )

    const manejarRaiz = (id: string) => {
        setIdRaiz(id)
        setIdHoja('')
        void elegirCategoria('')
        const raiz = categoriasLocal.find((c) => c.id === id)
        const subs = categoriasLocal.filter((c) => c.id_categoria_padre === id)
        if (raiz && subs.length === 0) void elegirCategoria(id) // raíz hoja (caso RAM)
    }

    const manejarHoja = (id: string) => {
        setIdHoja(id)
        if (id) void elegirCategoria(id)
        else void elegirCategoria('')
    }

    const crearMarca = async () => {
        const nombre = nombreMarcaNueva.trim()
        if (!nombre) return
        if (!categoriaFinal) {
            toast.error('Primero elige la categoría del producto.')
            return
        }
        setOcupado(true)
        const res = await crearMarcaConCategorias(nombre, [categoriaFinal])
        setOcupado(false)
        if (!res.success || !res.data) {
            toast.error(res.error ?? 'No se pudo crear la marca.')
            return
        }
        const marcasRes = await listarMarcasPorCategoria(categoriaFinal)
        if (marcasRes.success) setMarcas((marcasRes.data ?? []).map((m) => ({ id: m.id, nombre: m.nombre })))
        setForm((f) => ({ ...f, id_marca: res.data! }))
        setCrearMarcaActivo(false)
        setNombreMarcaNueva('')
        toast.success(`Marca "${nombre}" creada y vinculada a la categoría.`)
    }

    // «otra…»: agrega la opción al esquema de la categoría (escribe categorias_producto
    // vía la action de la 1.0 — RLS admin-only; solo quien edita el hub ve el control).
    const agregarOpcionAlEsquema = async (def: AtributoEsquema, opcion: string): Promise<string | null> => {
        const fila = categoriasLocal.find((c) => c.id === categoriaFinal)
        if (!fila || !categoriaFinal) return 'Primero elige la categoría.'
        if (!puedeOtra) return 'Solo un administrador puede ampliar el esquema.'
        const esquemaNuevo = fila.esquema_atributos.map((d) =>
            d.clave === def.clave
                ? { ...d, opciones: [...(d.opciones ?? []), opcion] }
                : d
        )
        const res = await editarCategoria(categoriaFinal, {
            nombre: fila.nombre,
            descripcion: fila.descripcion ?? '',
            orden: fila.orden,
            id_categoria_padre: fila.id_categoria_padre ?? '',
            es_activo: fila.es_activo,
            esquema_atributos: esquemaNuevo,
        })
        if (!res.success) return res.error ?? 'No se pudo ampliar el esquema.'
        // Refresco local del esquema para que la opción aparezca en la lista al instante.
        setCategoriasLocal((prev) =>
            prev.map((c) => (c.id === categoriaFinal ? { ...c, esquema_atributos: esquemaNuevo } : c))
        )
        toast.success(`Opción "${opcion}" agregada al esquema de ${fila.nombre}.`)
        return null
    }

    const guardar = async () => {
        setError(null)
        if (raizTieneHijos && !idHoja) {
            setError('Elige la subcategoría (la raíz elegida tiene subcategorías).')
            return
        }
        /**
         * ⭐ FIX 08 Oct 2026 — **los defaults se resuelven ACÁ, y los catálogos se piden sólo si de
         * verdad hacen falta.**
         *
         * Dos defectos en uno, arreglados juntos: (a) Guardar rechazaba con «Elige la unidad de medida»
         * a quien no abría la pestaña Inventario —el dato ya estaba resuelto en memoria: era una
         * carrera—; y (b) desde hoy los catálogos **no** se cargan al abrir el formulario (se piden al
         * abrir el desplegable), así que si el default aún está sin resolver **se pide acá**, que es el
         * único momento en que el dato es imprescindible. Se escribe también al estado para que la
         * pestaña Inventario **muestre** lo que se va a guardar — el defecto era justo no poder verlo.
         */
        let efectivo = form
        if (efectivo.id_unidad_medida === '' || efectivo.id_impuesto === '') {
            const cat = await cargarCatalogos()
            efectivo = resolverDefaults(cat.unidades, cat.impuestos, efectivo)
        }
        efectivo = resolverDefaults(unidades, impuestos, efectivo)
        if (efectivo !== form) setForm(efectivo)
        const parsed = productoSchema.safeParse(efectivo)
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Datos no válidos.')
            return
        }
        const errores = validarAtributosContraEsquema(convertirAtributosCrudos(efectivo.atributos, esquema), esquema)
        if (errores.length > 0) {
            setError(errores[0])
            return
        }
        setOcupado(true)
        if (modo === 'crear') {
            const res = await crearProducto(efectivo)
            setOcupado(false)
            if (!res.success) {
                setError(res.error ?? 'No se pudo guardar el producto.')
                return
            }
            toast.success(res.data?.existente ? `Ya existía ${res.data.sku} — se reutiliza` : 'Producto creado')
            // ⭐ MEJORA 52 — se entrega el creado para que el flujo que abrió el formulario lo seleccione.
            onExito(res.data)
            return
        }
        const res = producto
            ? await editarProducto(producto.id, efectivo)
            : { success: false as boolean, error: 'Producto no identificado.' }
        setOcupado(false)
        if (!res.success) {
            setError(res.error ?? 'No se pudo guardar el producto.')
            return
        }
        toast.success('Producto actualizado')
        onExito()
    }

    const haySub = raizTieneHijos
    const categoriaActual = categoriasLocal.find((c) => c.id === form.id_categoria)?.nombre ?? null
    const marcaActual = marcas.find((m) => m.id === form.id_marca)?.nombre ?? null

    return (
        <Dialog open onOpenChange={(v) => { if (!v && !ocupado) onCerrar() }}>
            <DialogContent className="max-w-[960px]">
                <DialogHeader>
                    <DialogTitle>{modo === 'crear' ? 'Nuevo producto' : `Editar · ${producto?.sku ?? ''}`}</DialogTitle>
                </DialogHeader>

                {/* Vista previa viva: lo que capturas se ve desde cualquier pestaña */}
                <p className="text-sm text-muted-foreground">
                    Producto:{' '}
                    <span className="font-medium text-foreground">{form.nombre.trim() || '—'}</span>
                    {categoriaActual && (
                        <>
                            {' · Categoría: '}
                            <span className="text-foreground">{categoriaActual}</span>
                        </>
                    )}
                    {marcaActual && (
                        <>
                            {' · Marca: '}
                            <span className="text-foreground">{marcaActual}</span>
                        </>
                    )}
                </p>

                <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                    {/* Sidebar vertical 1→6 */}
                    <nav className="flex flex-row flex-wrap gap-1 sm:flex-col">
                        {SECCIONES.map((titulo, i) => (
                            <Button
                                key={titulo}
                                type="button"
                                variant={seccion === i ? 'default' : 'ghost'}
                                onClick={() => setSeccion(i)}
                                className="justify-start"
                            >
                                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/20 text-[11px]">
                                    {i + 1}
                                </span>
                                {titulo}
                            </Button>
                        ))}
                    </nav>

                    {/* Panel de la sección activa */}
                    <div className="min-h-[380px] rounded-md border border-border p-4">
                        {seccion === 0 && (
                            <div className="grid gap-3">
                                <div className="grid gap-1.5">
                                    <Label>SKU</Label>
                                    <Input value={modo === 'crear' ? 'Se genera automático (P-######)' : (producto?.sku ?? '')}
                                        disabled readOnly className="text-muted-foreground" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Nombre <span className="text-destructive">*</span></Label>
                                    <Input value={form.nombre} onChange={(e) => setCampo('nombre', e.target.value)}
                                        placeholder="Ej. Disco duro Seagate 1TB SATA" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Modelo</Label>
                                    <Input value={form.modelo} onChange={(e) => setCampo('modelo', e.target.value)}
                                        placeholder="Opcional — identifica la pieza (no entra en la huella)" />
                                    <p className="text-xs text-muted-foreground">
                                        El modelo distingue la pieza exacta <b>sin partir el stock</b>. Si buscás que
                                        dos modelos distintos sean dos SKU, eso se decide en el esquema de la categoría
                                        (atributo con «Identidad (huella)»).
                                    </p>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Código de barras</Label>
                                    <Input value={form.codigo_barras} onChange={(e) => setCampo('codigo_barras', e.target.value)}
                                        placeholder="Opcional (idempotencia del import)" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Descripción</Label>
                                    <Input value={form.descripcion} onChange={(e) => setCampo('descripcion', e.target.value)} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>URL de imagen (opcional)</Label>
                                    <Input value={form.imagen_url} onChange={(e) => setCampo('imagen_url', e.target.value)}
                                        placeholder="https://… (storage diferido)" />
                                </div>
                            </div>
                        )}

                        {seccion === 1 && (
                            <div className="grid gap-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label>Categoría <span className="text-destructive">*</span></Label>
                                        <select
                                            value={idRaiz}
                                            disabled={ocupado}
                                            onChange={(e) => manejarRaiz(e.target.value)}
                                            className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground disabled:opacity-50"
                                        >
                                            <option value="">—</option>
                                            {raices.map((r) => (
                                                <option key={r.id} value={r.id}>{r.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {haySub && (
                                        <div className="grid gap-1.5">
                                            <Label>Subcategoría <span className="text-destructive">*</span></Label>
                                            <select
                                                value={idHoja}
                                                disabled={ocupado}
                                                onChange={(e) => manejarHoja(e.target.value)}
                                                className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground disabled:opacity-50"
                                            >
                                                <option value="">—</option>
                                                {subsDeRaiz.map((s) => (
                                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="grid gap-1.5">
                                        <Label>Marca (fabricante) <span className="text-destructive">*</span></Label>
                                        <select
                                            value={form.id_marca}
                                            disabled={ocupado || !categoriaFinal}
                                            onChange={(e) => setCampo('id_marca', e.target.value)}
                                            className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground disabled:opacity-50"
                                        >
                                            <option value="">{categoriaFinal ? 'Elige la marca…' : 'Primero la categoría'}</option>
                                            {marcas.map((m) => (
                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        {!crearMarcaActivo ? (
                                            <Button type="button" variant="outline" size="sm"
                                                disabled={!categoriaFinal}
                                                onClick={() => setCrearMarcaActivo(true)}>
                                                + Nueva marca
                                            </Button>
                                        ) : (
                                            <div className="flex w-full gap-1.5">
                                                <Input placeholder="Nombre de la marca…" value={nombreMarcaNueva}
                                                    onChange={(e) => setNombreMarcaNueva(e.target.value)} />
                                                <Button type="button" size="sm" onClick={() => void crearMarca()} disabled={ocupado}>
                                                    Crear
                                                </Button>
                                                <Button type="button" size="sm" variant="ghost"
                                                    onClick={() => setCrearMarcaActivo(false)}>
                                                    Cancelar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-md border border-border p-3">
                                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                                        Características técnicas
                                    </p>
                                    {categoriaFinal ? (
                                        <AtributosDinamicos
                                            esquema={esquema}
                                            valores={form.atributos}
                                            onChange={(clave, valor) =>
                                                setForm((f) => ({ ...f, atributos: { ...f.atributos, [clave]: valor } }))
                                            }
                                            puedeOtra={puedeOtra}
                                            onAgregarOpcion={agregarOpcionAlEsquema}
                                            disabled={ocupado}
                                        />
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Elige la categoría para ver sus características.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {seccion === 2 && (
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="grid gap-1.5">
                                    <Label>Precio base (venta) <span className="text-destructive">*</span></Label>
                                    <Input type="number" step="0.01" min="0" value={form.precio_base}
                                        onChange={(e) => setCampo('precio_base', e.target.value)} placeholder="0.00" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Precio mínimo</Label>
                                    <Input type="number" step="0.01" min="0" value={form.precio_minimo}
                                        onChange={(e) => setCampo('precio_minimo', e.target.value)} placeholder="Opcional" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Impuesto <span className="text-destructive">*</span></Label>
                                    <select value={form.id_impuesto}
                                        onChange={(e) => setCampo('id_impuesto', e.target.value)}
                                        /* ⭐ FIX 08 Oct 2026 — los catálogos se piden AL ABRIR el
                                           desplegable, no al abrir el formulario. Antes de eso, la
                                           lista vacía muestra el default de la casa. */
                                        onFocus={() => void cargarCatalogos()}
                                        className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground">
                                        <option value="">
                                            {impuestos.length === 0 ? 'IVA 16 % (por defecto)' : '— elige impuesto —'}
                                        </option>
                                        {impuestos.filter((i) => i.es_activo).map((i) => (
                                            <option key={i.id} value={i.id}>{i.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {seccion === 3 && (
                            <div className="grid gap-3">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="grid gap-1.5">
                                        <Label>Unidad de medida <span className="text-destructive">*</span></Label>
                                        <select value={form.id_unidad_medida}
                                            onChange={(e) => setCampo('id_unidad_medida', e.target.value)}
                                            /* ⭐ FIX 08 Oct 2026 — el pedido textual del dueño: *«pide la
                                               unidad de medida, por defecto pon Pieza, pero que no busque
                                               ese dato en la base a menos que abran el desplegable»*. */
                                            onFocus={() => void cargarCatalogos()}
                                            className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground">
                                            <option value="">
                                                {unidades.length === 0 ? 'Pieza (por defecto)' : '— elige unidad —'}
                                            </option>
                                            {unidades.filter((u) => u.es_activo).map((u) => (
                                                <option key={u.id} value={u.id}>{u.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label>Stock mínimo</Label>
                                        <Input type="number" step="0.01" min="0" value={form.stock_minimo}
                                            onChange={(e) => setCampo('stock_minimo', e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label>Ubicación por defecto</Label>
                                        <select value={form.id_ubicacion_default}
                                            onChange={(e) => setCampo('id_ubicacion_default', e.target.value)}
                                            onFocus={() => void cargarCatalogos()}
                                            className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground">
                                            <option value="">Sin ubicación</option>
                                            {ubicaciones.filter((u) => u.es_activo).map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.rack} / {u.nivel} / {u.organizador} / {u.charola}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-6">
                                    <label className="flex items-center gap-2 text-sm">
                                        Requiere revisión técnica
                                        <Switch checked={form.requiere_revision}
                                            onCheckedChange={(v) => setCampo('requiere_revision', v)} />
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        Maneja número de serie
                                        <Switch checked={form.maneja_numero_serie}
                                            onCheckedChange={(v) => setCampo('maneja_numero_serie', v)} />
                                    </label>
                                </div>
                            </div>
                        )}

                        {seccion === 4 && (
                            <div className="grid gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Clave ProdServ (SAT)</Label>
                                    <select
                                        value={form.id_clave_prod_serv_sat}
                                        onChange={(e) => setCampo('id_clave_prod_serv_sat', e.target.value)}
                                        /* ⭐ FIX 08 Oct 2026 — la lista SAT también es perezosa. */
                                        onFocus={() => void cargarSAT()}
                                        className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground"
                                    >
                                        <option value="">
                                            {satProd.length === 0
                                                ? 'Sin asignar (CFDI V2) — abrí la lista para cargarla'
                                                : 'Sin asignar (CFDI V2)'}
                                        </option>
                                        {satProd.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.clave} — {c.descripcion}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    La clave de unidad del SAT se asigna automáticamente desde la
                                    unidad de medida elegida en Inventario (ej. Pieza → H87).
                                </p>
                            </div>
                        )}

                        {seccion === 5 && (
                            <div className="grid gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Notas</Label>
                                    <Input value={form.notas} onChange={(e) => setCampo('notas', e.target.value)}
                                        placeholder="Notas internas del producto" />
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    Activo
                                    <Switch checked={form.es_activo} onCheckedChange={(v) => setCampo('es_activo', v)} />
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <DialogFooter className="gap-2 sm:justify-between">
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setSeccion((s) => Math.max(0, s - 1))}
                            disabled={seccion === 0 || ocupado}>
                            Anterior
                        </Button>
                        {seccion < SECCIONES.length - 1 && (
                            <Button variant="outline" onClick={() => setSeccion((s) => Math.min(SECCIONES.length - 1, s + 1))}>
                                Siguiente
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onCerrar} disabled={ocupado}>Cancelar</Button>
                        <Button onClick={() => void guardar()} disabled={ocupado}>
                            {ocupado ? 'Guardando…' : modo === 'crear' ? 'Crear producto' : 'Guardar cambios'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/** Producto (BD) → formulario (edición). sku no viaja al form (inmutable). */
function productoAFormulario(p: Producto): ProductoFormData {
    const crudo: Record<string, string> = {}
    for (const [clave, valor] of Object.entries(p.atributos)) {
        if (valor !== null && valor !== undefined) crudo[clave] = String(valor)
    }
    return {
        nombre: p.nombre,
        modelo: p.modelo ?? '',
        descripcion: p.descripcion ?? '',
        codigo_barras: p.codigo_barras ?? '',
        id_categoria: p.id_categoria ?? '',
        id_marca: p.id_marca ?? '',
        id_unidad_medida: p.id_unidad_medida,
        id_impuesto: p.id_impuesto,
        precio_base: String(p.precio_base ?? 0),
        precio_minimo: p.precio_minimo === null ? '' : String(p.precio_minimo),
        stock_minimo: String(p.stock_minimo ?? 0),
        id_ubicacion_default: p.id_ubicacion_default ?? '',
        requiere_revision: p.requiere_revision,
        maneja_numero_serie: p.maneja_numero_serie,
        es_activo: p.es_activo,
        id_clave_prod_serv_sat: p.id_clave_prod_serv_sat ?? '',
        id_clave_unidad_sat: p.id_clave_unidad_sat ?? '',
        imagen_url: p.imagen_url ?? '',
        notas: p.notas ?? '',
        atributos: crudo,
    }
}

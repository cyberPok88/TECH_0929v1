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

import { useCallback, useEffect, useMemo, useState } from 'react'
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

interface ProductoModalProps {
    modo: 'crear' | 'editar'
    producto?: Producto | null
    categorias: CategoriaFila[]
    onCerrar: () => void
    onExito: () => void
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

export function ProductoModal({ modo, producto, categorias, onCerrar, onExito }: ProductoModalProps) {
    const [form, setForm] = useState<ProductoFormData>(() =>
        producto ? productoAFormulario(producto) : productoFormDataVacio()
    )
    const [seccion, setSeccion] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [ocupado, setOcupado] = useState(false)

    const [categoriasLocal, setCategoriasLocal] = useState<CategoriaFila[]>(categorias)
    const [idRaiz, setIdRaiz] = useState(() => {
        if (!producto?.id_categoria) return ''
        const fila = categorias.find((c) => c.id === producto.id_categoria)
        return fila?.id_categoria_padre ?? fila?.id ?? ''
    })
    const [idHoja, setIdHoja] = useState(() => {
        if (!producto?.id_categoria) return ''
        const fila = categorias.find((c) => c.id === producto.id_categoria)
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

    // Catálogos del formulario (una carga) + defaults Pieza / IVA 16 %.
    useEffect(() => {
        let activo = true
        Promise.all([listarUnidadesMedida(), listarImpuestos(), listarUbicacionesAlmacen()]).then(
            ([un, imp, ubi]) => {
                if (!activo) return
                if (un.success) setUnidades(un.data ?? [])
                if (imp.success) setImpuestos(imp.data ?? [])
                if (ubi.success) setUbicaciones(ubi.data ?? [])
                setForm((f) => ({
                    ...f,
                    id_unidad_medida:
                        f.id_unidad_medida === ''
                            ? (un.data?.find((u) => u.nombre === 'Pieza')?.id ?? '')
                            : f.id_unidad_medida,
                    id_impuesto:
                        f.id_impuesto === ''
                            ? (imp.data?.find((i) => i.clave === 'IVA_16')?.id ?? '')
                            : f.id_impuesto,
                }))
            }
        )
        return () => { activo = false }
    }, [])

    // Lista SAT del subset ProdServ (desplegable de la sección Fiscal · MEJORA 04 Sep).
    // La clave de unidad del SAT NO se pregunta aquí: se deriva de la unidad de
    // medida (Inventario) al guardar — resolverClaveUnidadSAT en la Server Action.
    useEffect(() => {
        let activo = true
        listarClavesSAT('prod_serv').then((res) => {
            if (!activo) return
            if (res.success) setSatProd(res.data ?? [])
        })
        return () => { activo = false }
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
        const parsed = productoSchema.safeParse(form)
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Datos no válidos.')
            return
        }
        const errores = validarAtributosContraEsquema(convertirAtributosCrudos(form.atributos, esquema), esquema)
        if (errores.length > 0) {
            setError(errores[0])
            return
        }
        setOcupado(true)
        const res =
            modo === 'crear'
                ? await crearProducto(form)
                : producto
                  ? await editarProducto(producto.id, form)
                  : { success: false as boolean, error: 'Producto no identificado.' }
        setOcupado(false)
        if (!res.success) {
            setError(res.error ?? 'No se pudo guardar el producto.')
            return
        }
        toast.success(modo === 'crear' ? 'Producto creado' : 'Producto actualizado')
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
                                        className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground">
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
                                            className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground">
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
                                        className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground"
                                    >
                                        <option value="">Sin asignar (CFDI V2)</option>
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

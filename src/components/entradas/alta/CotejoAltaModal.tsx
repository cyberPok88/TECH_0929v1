'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COTEJO ALTA MODAL — Cotejo físico + ingreso a inventario (Guía 1.6 · P6 · Smart)
// ⭐ Evolución V5 (20 Sep): la revisión dejó la HUELLA (marca + atributos), no el SKU.
// Aquí el almacenista RESUELVE EL SKU por huella (`SelectorSkuHuella`), captura la
// cantidad FÍSICA (default = la pendiente) y confirma. `confirmarAlta` / `confirmarAltaBandeja`
// escriben el lote + movimiento (sube stock) y persisten el SKU en la huella.
//
// ⭐ MEJORA 25 (24 Sep 2026 · decisión 22) — sirve a DOS sujetos con el mismo cuerpo:
//   · **la ENTRADA** (camino clásico) — coteja el **saldo no liberado**, no lo aprobado total:
//     las piezas que ya salieron por tanda subirían stock dos veces (decisión 22.b).
//   · **la TANDA** — coteja exactamente lo que el acondicionador entregó.
// Si no queda saldo, la entrada **igual cierra**: antes devolvía error y quedaba atorada en
// `en_almacen` para siempre. Diseño aprobado: mockup §7.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, PackagePlus, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Ayuda, useAyuda } from '@/components/ui/Ayuda'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { abrirCotejoAlta, abrirCotejoBandeja, confirmarAlta, confirmarAltaBandeja } from '@/lib/actions/entradas'
import { listarCategorias } from '@/lib/actions/catalogos'
import { SelectorSkuHuella } from '@/components/entradas/alta/SelectorSkuHuella'
import { ProductoModal } from '@/components/catalogos/productos/ProductoModal'
import { nombreDesdeHuella, claveLinea } from '@/types/entradas'
import type { CategoriaFila } from '@/types/catalogos'
import type { BandejaLiberada, CotejoLinea, Entrada } from '@/types/entradas'

interface CotejoAltaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Camino clásico: la entrada completa. */
    entrada: Entrada | null
    /** ⭐ MEJORA 25/27 — camino de la BANDEJA (tandas del mismo producto). Si viene, manda él. */
    bandeja?: BandejaLiberada | null
    onGuardado?: () => void
}

const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

/**
 * ⭐ FIX 08 Oct 2026 (lo pidió la VF del dueño: *«se supone que las 2 son el mismo producto, pero no lo
 * detectó»*) — **las HUELLAS que aparecen más de una vez en este cotejo**.
 *
 * Dos partidas de la misma entrada pueden rendir **el mismo producto** (dos lotes del mismo disco).
 * Son **dos líneas** —porque son dos partidas y dos tandas— pero **un solo SKU**: el cotejo tiene que
 * decirlo, o el almacenista cree que está creando dos productos cuando en realidad está resolviendo
 * el mismo dos veces. La clave es la de siempre (`claveLinea`: marca + huella canónica), la MISMA con
 * la que el desglose y la nota emparejan líneas.
 */
function huellasRepetidas(filas: CotejoLinea[]): Set<string> {
    const cuenta = new Map<string, number>()
    for (const l of filas) {
        const k = claveLinea(l.id_marca, l.atributos)
        cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([k]) => k))
}

export function CotejoAltaModal({ open, onOpenChange, entrada, bandeja, onGuardado }: CotejoAltaModalProps) {
    // `null` = todavía no llegó: el loader se DERIVA de ahí (no se escribe estado en el efecto).
    const [lineas, setLineas] = useState<CotejoLinea[] | null>(null)
    const [cantidades, setCantidades] = useState<Record<string, string>>({})
    /**
     * ⭐ 08 Oct 2026 (lo pidió el dueño) — **la cantidad FÍSICA no se edita por accidente.**
     *
     * *«En ese modal la cantidad está bien que se pueda editar, pero poné un botón que diga Editar y
     * poder editar el campo, con advertencia de si edita la cantidad pasa tal cosa.»*
     *
     * El campo nace **de sólo lectura con la cantidad PENDIENTE** (el 99 % de los cotejos van bien y
     * no hay nada que corregir), y el `<Input>` se abre con el botón **Editar** — que además pinta el
     * `candado` (`alta.cantidad-fisica`: catálogo de ayudas, apagable por el usuario) porque lo que se
     * escribe va a `lotes` + `movimientos_inventario`, que son **append-only**. Y trae la vuelta
     * atrás («Usar la pendiente»): probar un número no obliga a dejar la línea cambiada.
     */
    const [editando, setEditando] = useState<Record<string, boolean>>({})
    /** El PORQUÉ del aviso de la cantidad, para el `title` (el texto largo no se pinta inline). */
    const porqueCantidad = useAyuda('alta.cantidad-fisica-porque')
    const [skuSel, setSkuSel] = useState<Record<string, string>>({})
    const [cargando, setCargando] = useState(false)

    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **EL ALTA ABRE EL FORMULARIO DE PRODUCTO** (lo pidió el dueño:
     * *«el alta sí abrir el formulario como dices»*). Guarda la LÍNEA para la que se está dando de
     * alta: al guardar hay que **dejar su SKU seleccionado** y seguir con el cotejo, sin volver a
     * buscar lo que el almacenista acaba de crear.
     *
     * Las categorías se piden **solo al abrir** el formulario (no en cada apertura del cotejo): son
     * datos del hub de Catálogos y el puesto de Almacén no los necesita para nada más.
     */
    const [formulario, setFormulario] = useState<{ linea: CotejoLinea } | null>(null)
    const [categorias, setCategorias] = useState<CategoriaFila[]>([])
    const [cargandoCategorias, setCargandoCategorias] = useState(false)

    /**
     * ⭐ FIX 08 Oct 2026 (lo pidió el dueño para su prueba: *«haz algunos que se repitan la huella para
     * ver las detecta»*) — **cuando nace un SKU, las DEMÁS líneas vuelven a preguntar.**
     *
     * El caso: una entrada con **dos partidas que rinden la MISMA huella** (dos lotes del mismo
     * producto). Los dos selectores buscan **a la vez**, cuando el producto todavía no existe ⇒ los
     * dos dicen «Sin coincidencias»; el almacenista lo crea en la primera línea… y **la segunda se
     * queda con la lista vieja** y vuelve a pedir «Crear producto» para el mismo producto. Con el
     * `23505` ya no duplica (reutiliza), pero el puesto igual da un paso de más y **no ve** que el
     * sistema lo detectó.
     *
     * ⇒ Un contador de generación que se incrementa al crear/reutilizar: viaja en el `key` de cada
     * selector y los remonta, y al montar **vuelven a buscar**. Es barato (una consulta por línea) y
     * no pierde nada: el estado de cada selector es derivado.
     */
    const [generacionSku, setGeneracionSku] = useState(0)

    const abrirFormulario = async (linea: CotejoLinea) => {
        setFormulario({ linea })
        if (categorias.length > 0) return
        setCargandoCategorias(true)
        const r = await listarCategorias()
        setCargandoCategorias(false)
        if (!r.success) {
            toast.error('No se pudieron cargar las categorías del hub.')
            setFormulario(null)
            return
        }
        setCategorias(r.data ?? [])
    }

    useEffect(() => {
        if (!open) return
        if (!entrada && !bandeja) return
        let activo = true
        const promesa = bandeja ? abrirCotejoBandeja(bandeja.ids_tanda) : abrirCotejoAlta((entrada as Entrada).id)
        void promesa.then((r) => {
            if (!activo) return
            if (!r.success) {
                toast.error(r.error ?? 'No se pudo abrir el cotejo.')
                setLineas([])
                return
            }
            const ls = r.data?.lineas ?? []
            setLineas(ls)
            // El default es la cantidad PENDIENTE (lo que falta por dar de alta), no lo aprobado.
            setCantidades(
                Object.fromEntries(ls.map((l) => [l.id_partida_resuelta, String(l.cantidad_pendiente)]))
            )
            setSkuSel(
                Object.fromEntries(
                    ls.filter((l) => l.id_producto).map((l) => [l.id_partida_resuelta, l.id_producto as string])
                )
            )
        })
        return () => {
            activo = false
        }
    }, [open, entrada, bandeja])

    const cargandoLineas = lineas === null
    const filas = lineas ?? []
    const pendienteTotal = filas.reduce((s, l) => s + Number(l.cantidad_pendiente ?? 0), 0)
    const yaAlta = filas.reduce(
        (s, l) => s + Math.max(0, Number(l.cantidad_aprobada) - Number(l.cantidad_pendiente)),
        0
    )
    /** Sin saldo por cotejar: la acción es CERRAR (todo salió por tandas), no ingresar. */
    const soloCerrar = filas.length > 0 && pendienteTotal === 0
    /** ⭐ Las huellas que se repiten en este cotejo (dos partidas = un solo producto). */
    const mismasHuellas = huellasRepetidas(filas)

    const confirmar = async () => {
        const conCantidad = filas.filter((l) => Number(cantidades[l.id_partida_resuelta] ?? 0) > 0)
        if (conCantidad.some((l) => !skuSel[l.id_partida_resuelta])) {
            toast.error('Resuelve el SKU de todas las líneas con cantidad.')
            return
        }

        setCargando(true)
        if (bandeja) {
            const lineasInput = conCantidad.map((l) => ({

                id_partida_resuelta: l.id_partida_resuelta,
                id_producto: skuSel[l.id_partida_resuelta] ?? '',
                cantidad_fisica: Number(cantidades[l.id_partida_resuelta] ?? 0),
                costo_acordado: l.costo_acordado,
            }))
            if (lineasInput.length === 0) {
                setCargando(false)
                toast.error('Ingresa al menos una cantidad física.')
                return
            }
            const res = await confirmarAltaBandeja({ ids_tanda: bandeja.ids_tanda, lineas: lineasInput })
            setCargando(false)
            if (!res.success) {
                toast.error(res.error ?? 'No se pudo dar el alta a la bandeja.')
                return
            }
            toast.success(`${bandeja.entrada_folio} · ${lineasInput.reduce((s, l) => s + l.cantidad_fisica, 0)} pieza(s) dadas de alta`)
        } else if (entrada) {
            const lineasInput = conCantidad.map((l) => ({
                id_partida_resuelta: l.id_partida_resuelta,
                id_producto: skuSel[l.id_partida_resuelta] ?? '',
                cantidad_fisica: Number(cantidades[l.id_partida_resuelta] ?? 0),
                costo_acordado: l.costo_acordado,
            }))
            const res = await confirmarAlta({ id_entrada: entrada.id, lineas: lineasInput })
            setCargando(false)
            if (!res.success) {
                toast.error(res.error ?? 'No se pudo ingresar a almacén.')
                return
            }
            toast.success(
                lineasInput.length === 0
                    ? `${entrada.folio} cerrada · todo su saldo ya había salido por tandas`
                    : 'Ingreso a almacén realizado'
            )
        }
        onGuardado?.()
        onOpenChange(false)
    }

    const titulo = bandeja
        ? `Cotejo y alta — ${bandeja.entrada_folio} · ${bandeja.tandas.map((n) => `T${n}`).join(' + ')}`
        : `Cotejo e ingreso — ${entrada?.folio ?? ''}`

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader className="flex-row items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 shrink-0 gap-1.5 px-3 text-[14px]"
                        onClick={() => onOpenChange(false)}
                        disabled={cargando}
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    <DialogTitle>{titulo}</DialogTitle>
                </DialogHeader>

                {cargandoLineas ? (
                    <Spinner etiqueta="Leyendo lo que falta por cotejar…" className="py-4" />
                ) : (
                    <div className="space-y-3">
                        {/* ⭐ MEJORA 25 — la cuenta que impide subir stock dos veces. */}
                        {yaAlta > 0 && (
                            <p className="rounded-md border border-chart-4/40 bg-chart-4/10 px-3 py-2 text-[12.5px]">
                                <b>{yaAlta} pieza(s)</b> de esta entrada ya se dieron
                                de alta por tandas. Aquí se coteja solo el <b>saldo</b>.
                            </p>
                        )}
                        {soloCerrar && (
                            <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12.5px]">
                                Todo lo aprobado de <b>{entrada?.folio}</b> ya entró a almacén por tandas. Esta
                                confirmación solo <b>cierra la entrada</b>.
                            </p>
                        )}

                        {filas.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin piezas aprobadas por ingresar.</p>
                        ) : (
                            filas.map((l) => {
                                const huella = [l.marca_nombre, ...Object.values(aTexto(l.atributos))]
                                    .filter(Boolean)
                                    .join(' · ')
                                const sinSaldo = Number(l.cantidad_pendiente ?? 0) <= 0
                                return (
                                    <div
                                        key={l.id_partida_resuelta}
                                        className="space-y-2 rounded border p-3"
                                    >
                                        <div className="text-xs text-muted-foreground">
                                            Huella:{' '}
                                            <span className="font-medium text-foreground">{huella || '—'}</span> ·
                                            pendientes{' '}
                                            <b className="text-foreground">{l.cantidad_pendiente}</b>
                                            {sinSaldo && <span className="text-chart-4"> · ya en almacén</span>}
                                        </div>
                                        {/* ⭐ FIX 08 Oct 2026 — el aviso que faltaba: esta línea y otra
                                            del MISMO cotejo comparten huella ⇒ es UN solo producto. */}
                                        {mismasHuellas.has(claveLinea(l.id_marca, l.atributos)) && (
                                            <p className="rounded-md border border-chart-4/40 bg-chart-4/10 px-2.5 py-1.5 text-[12px]">
                                                Mismo producto que <b>otra línea</b> de esta entrada
                                                (comparten huella): resolvé <b>un solo SKU</b> — la otra
                                                línea lo va a tomar sola.
                                            </p>
                                        )}
                                        {!sinSaldo && (
                                            <div className="flex items-end gap-2">
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <span className="text-xs text-muted-foreground">
                                                        SKU (lo resuelve Almacén)
                                                    </span>
                                                    <SelectorSkuHuella
                                                        key={`${l.id_partida_resuelta}-sku${generacionSku}`}
                                                        idCategoria={l.id_categoria}
                                                        idMarca={l.id_marca}
                                                        marcaNombre={l.marca_nombre}
                                                        atributos={l.atributos}
                                                        valor={skuSel[l.id_partida_resuelta] ?? ''}
                                                        onChange={(id) =>
                                                            setSkuSel((prev) => ({
                                                                ...prev,
                                                                [l.id_partida_resuelta]: id,
                                                            }))
                                                        }
                                                        disabled={cargando}
                                                        /* ⭐ MEJORA 52 — el SKU que nazca hereda lo que
                                                           declaró la puerta (no un `false` inventado). */
                                                        manejaNumeroSerie={l.lleva_ns}
                                                        /* ⭐ MEJORA 52 — y el alta ABRE EL FORMULARIO,
                                                           prellenado con la huella de la línea. */
                                                        onCrearConFormulario={() => void abrirFormulario(l)}
                                                        /* ⭐ FIX 08 Oct 2026 — y el ALTA RÁPIDA avisa
                                                           igual: los dos caminos remontan a los
                                                           hermanos (`generacionSku`) para que una
                                                           huella repetida se vea sola en la 2ª línea. */
                                                        onCrear={() => setGeneracionSku((v) => v + 1)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        Física
                                                        {/* ⭐ El botón que abre la edición. Su etiqueta NO se
                                                            cataloga (es un control, no una explicación). */}
                                                        {!editando[l.id_partida_resuelta] && (
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                                                                onClick={() =>
                                                                    setEditando((prev) => ({
                                                                        ...prev,
                                                                        [l.id_partida_resuelta]: true,
                                                                    }))
                                                                }
                                                                disabled={cargando}
                                                                title="Corregir la cantidad que entra al inventario"
                                                            >
                                                                <Pencil className="h-3 w-3" aria-hidden="true" />
                                                                Editar
                                                            </button>
                                                        )}
                                                    </span>
                                                    <Input
                                                        type="number"
                                                        className="w-24 read-only:bg-surface-2 read-only:text-muted-foreground"
                                                        min={0}
                                                        max={l.cantidad_pendiente}
                                                        readOnly={!editando[l.id_partida_resuelta]}
                                                        value={cantidades[l.id_partida_resuelta] ?? ''}
                                                        onChange={(e) =>
                                                            setCantidades((prev) => ({
                                                                ...prev,
                                                                [l.id_partida_resuelta]: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {/* ⭐ El aviso de la cantidad editable: **UNA LÍNEA**, con el
                                            tono de un error de formulario (lo pidió el dueño: *«algo
                                            más sencillo como cuando te equivocas de password»*). El
                                            porqué completo viaja en el `title` — el patrón del módulo:
                                            la línea dice QUÉ pasa, el `title` dice POR QUÉ. */}
                                        {!sinSaldo && editando[l.id_partida_resuelta] && (
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <Ayuda
                                                    k="alta.cantidad-fisica"
                                                    inline
                                                    className="text-[12px] text-destructive"
                                                />
                                                <button
                                                    type="button"
                                                    className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                                    onClick={() => {
                                                        setCantidades((prev) => ({
                                                            ...prev,
                                                            [l.id_partida_resuelta]: String(l.cantidad_pendiente),
                                                        }))
                                                        setEditando((prev) => ({
                                                            ...prev,
                                                            [l.id_partida_resuelta]: false,
                                                        }))
                                                    }}
                                                    title={porqueCantidad || undefined}
                                                >
                                                    Usar la pendiente ({l.cantidad_pendiente})
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] px-5 text-[15px]"
                        onClick={() => onOpenChange(false)}
                        disabled={cargando}
                    >
                        Cerrar
                    </Button>
                    <Button
                        type="button"
                        className="min-h-[56px] flex-1 px-6 text-[16px] font-semibold sm:flex-none"
                        onClick={confirmar}
                        disabled={cargando || cargandoLineas || filas.length === 0}
                    >
                        {cargando ? (
                            <Spinner className="mr-2 text-primary-foreground" />
                        ) : (
                            <PackagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        )}
                        {cargando
                            ? 'Ingresando…'
                            : soloCerrar
                              ? 'Cerrar la entrada'
                              : `Dar alta a ${pendienteTotal} pieza(s)`}
                    </Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>

            {/* ⭐ MEJORA 52 — EL FORMULARIO DEL PRODUCTO, ABIERTO DESDE EL COTEJO.
                Va PRELLENADO con la HUELLA de la línea (categoría · marca · atributos) y con lo que
                declaró la puerta (`lleva_ns` ⇒ «maneja número de serie»). Al guardar, el SKU creado
                queda SELECCIONADO en su línea: el almacenista sigue cotejando sin volver a buscarlo. */}
            {formulario ? (
                cargandoCategorias ? (
                    <Spinner etiqueta="Cargando las categorías…" className="py-4" />
                ) : (
                    <ProductoModal
                        key={`alta-${formulario.linea.id_partida_resuelta}`}
                        modo="crear"
                        categorias={categorias}
                        inicial={{
                            id_categoria: formulario.linea.id_categoria ?? '',
                            id_marca: formulario.linea.id_marca ?? '',
                            /**
                             * ⭐ FIX 08 Oct 2026 — **el nombre viene SUGERIDO por la HUELLA.**
                             * Antes el formulario abría con el nombre **vacío** y el almacenista lo
                             * tecleaba a mano teniendo la huella ya resuelta en la pantalla. Se usa la
                             * MISMA función que el alta rápida (`nombreDesdeHuella`): los dos caminos
                             * no pueden bautizar distinto al mismo producto.
                             */
                            nombre: nombreDesdeHuella(formulario.linea.marca_nombre, formulario.linea.atributos),
                            atributos: aTexto(formulario.linea.atributos),
                            maneja_numero_serie: formulario.linea.lleva_ns,
                        }}
                        onCerrar={() => setFormulario(null)}
                        onExito={(creado) => {
                            const linea = formulario.linea
                            setFormulario(null)
                            if (!creado) return
                            setSkuSel((prev) => ({ ...prev, [linea.id_partida_resuelta]: creado.id }))
                            // ⭐ Y las OTRAS líneas vuelven a buscar: una huella repetida tiene que
                            // aparecer sola en la segunda (ver la nota de `generacionSku`).
                            setGeneracionSku((v) => v + 1)
                        }}
                    />
                )
            ) : null}
        </>
    )
}

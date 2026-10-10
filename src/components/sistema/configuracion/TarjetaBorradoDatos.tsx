'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// TARJETA DE BORRADO DE DATOS — el modal (Guía 2.4 · 05 Oct 2026)
//   Parte 5: + el bloque de BORRADO TOTAL, debajo del panel de casillas.
//
// ⚠️ ES LA ÚNICA PANTALLA DEL ERP QUE BORRA DATOS. Y tiene UN SOLO candado de
//    ejecución, decidido por el dueño: **el conteo previo**. No hay respaldo ni
//    auditoría (D5, decisión explícita e informada). NO los agregues "por
//    precaución": sería contradecir una decisión cerrada.
//
// Los otros tres candados NO se ven desde acá:
//   · 2 gates en la BD (`tiene_permiso_accion` + `es_admin_principal`) — b6
//   · el gate de entorno en la Server Action (`permiteBorradoBd`) — fail-closed
//   · y este modal NI SE MONTA si `permiteBorrado` es false (lo decide el servidor)
//
// ⭐ EL FLUJO: se abre → se pide el conteo (UNA vez) → el usuario marca paquetes y el
//   TOTAL se recalcula sumando → confirma en el diálogo del kit → la RPC borra en UNA
//   transacción y en el orden de FK → **se vuelve a contar** (el recuento es la prueba).
//
// ⭐ FIX `g26_p1_b9` (07 Oct 2026) — **SI UNA FK DE OTRO PAQUETE LO BLOQUEA, LA PANTALLA
//   DICE CUÁL Y LO MARCA EN UN CLIC.** La RPC devuelve el paquete faltante en el `DETAIL`
//   del error; acá se cierra la confirmación y aparece el aviso al lado del botón.
//   ⚠️ **NO se auto-marca**: el aviso ofrece, el humano decide. Auto-marcar sería que la
//   herramienta elija por él qué más se borra — y esto no se deshace.
//
// ⭐ D13: el BORRADO TOTAL va APARTE y DESPUÉS — su propio bloque rojo, su propio botón,
//   y **sin estado compartido** con las casillas (E6). Si estuviera arriba, el primer
//   botón que vería el usuario sería el que vacía la empresa.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { BorradoTotal } from '@/components/sistema/configuracion/BorradoTotal'
import { CatalogoSelector } from '@/components/sistema/configuracion/CatalogoSelector'
import { DesglosePaquetes } from '@/components/sistema/configuracion/DesglosePaquetes'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    borrarDatosAction,
    contarPaquetesAction,
    listarCatalogoAction,
    listarRolesBorrablesAction,
} from '@/lib/actions/configuracion'
import { cn } from '@/lib/utils'
import {
    PAQUETES_UI,
    TABLAS_CATALOGO,
    type FilaCatalogo,
    type FilaConteo,
    type PaqueteBorrado,
    type TablaCatalogo,
} from '@/types/configuracion'

/**
 * Cuenta los paquetes y **traduce la respuesta**. ⚠️ Vive FUERA del componente a propósito: así no
 * contiene ningún `setState` y el efecto puede llamarla sin violar
 * `react-hooks/set-state-in-effect` — la regla rastrea el cuerpo de una función del componente
 * (por eso `void contar()` con un `useCallback` **también** la violaba) y no una función de módulo.
 */
async function pedirConteoPaquetes(): Promise<{ filas: FilaConteo[] } | { error: string }> {
    const r = await contarPaquetesAction()
    return r.success ? { filas: r.data ?? [] } : { error: r.error ?? 'No se pudo contar' }
}

interface TarjetaBorradoDatosProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TarjetaBorradoDatos({ open, onOpenChange }: TarjetaBorradoDatosProps) {
    const [conteo, setConteo] = useState<FilaConteo[] | null>(null)
    const [marcados, setMarcados] = useState<PaqueteBorrado[]>([])
    const [abierto, setAbierto] = useState<string | null>(null)
    const [filasCatalogo, setFilasCatalogo] = useState<Partial<Record<TablaCatalogo | 'roles', FilaCatalogo[]>>>({})
    const [tildadas, setTildadas] = useState<Record<string, string[]>>({})
    const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
    const [confirmando, setConfirmando] = useState(false)
    /**
     * ⭐ El paquete que la BD dijo que FALTA (FIX `g26_p1_b9`). `null` = no hay nada que ofrecer.
     * No es un error de pantalla: es una instrucción que llegó desde la RPC.
     */
    const [faltante, setFaltante] = useState<PaqueteBorrado | null>(null)

    // ⚠️ El efecto SOLO dispara la acción async, como **IIFE inline** (el patrón de `AlmacenHub`).
    //    Dos intentos previos fallaron el lint: ① resetear estado en el cuerpo del efecto;
    //    ② `void contar()` con un `useCallback` del componente — la regla **rastrea su cuerpo**.
    //    Es el anti-patrón que el FINGERPRINT de la 2.1 vigila; acá lo encontró el lint.
    useEffect(() => {
        if (!open) return
        let activo = true
        void (async () => {
            const r = await pedirConteoPaquetes()
            if (!activo) return
            if ('error' in r) {
                toast.error(r.error)
                setConteo([])
                return
            }
            setConteo(r.filas)
        })()
        return () => {
            activo = false
        }
    }, [open])

    /**
     * Abre/cierra el modal. ⭐ **La selección se limpia al CERRAR, no al abrir**: al abrir no se
     * puede (sería setState síncrono en un efecto), y al cerrar es un **evento del usuario** — que
     * es donde React quiere que viva el estado.
     */
    const cambiar = (o: boolean) => {
        if (confirmando) return
        if (!o) {
            setMarcados([])
            setAbierto(null)
            setTildadas({})
            setFilasCatalogo({})
            setConteo(null)
            setFaltante(null)
        }
        onOpenChange(o)
    }

    /** Las filas de los catálogos se cargan la PRIMERA vez que se marca «Catálogos». */
    const cargarCatalogo = useCallback(async () => {
        setCargandoCatalogo(true)
        const siguiente: Partial<Record<TablaCatalogo | 'roles', FilaCatalogo[]>> = {}
        for (const tabla of TABLAS_CATALOGO) {
            const r = await listarCatalogoAction(tabla)
            siguiente[tabla] = r.success ? (r.data ?? []) : []
        }
        const roles = await listarRolesBorrablesAction()
        siguiente.roles = roles.success ? (roles.data ?? []) : []
        setFilasCatalogo(siguiente)
        setCargandoCatalogo(false)
    }, [])

    const alternar = (id: PaqueteBorrado, valor: boolean) => {
        setMarcados((prev) =>
            valor ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((p) => p !== id)
        )
        // ⭐ Si el humano marca a mano el paquete que la BD reclamó, el aviso ya no hace falta.
        if (valor && id === faltante) setFaltante(null)
        if (valor && (id === 'catalogos' || id === 'sistema') && !filasCatalogo[id === 'sistema' ? 'roles' : 'marcas_producto']) {
            void cargarCatalogo()
        }
    }

    /** El nombre que se LEE. El id es el idioma del protocolo; esto es el de la pantalla. */
    const nombreDe = (id: PaqueteBorrado): string => PAQUETES_UI.find((p) => p.id === id)?.nombre ?? id

    const tildar = (tabla: string, id: string, valor: boolean) => {
        setTildadas((prev) => {
            const actual = prev[tabla] ?? []
            return { ...prev, [tabla]: valor ? [...actual, id] : actual.filter((x) => x !== id) }
        })
    }

    const filasDe = (paquete: string): FilaConteo[] =>
        (conteo ?? []).filter((f) => f.paquete === paquete)

    /** ⭐ El TOTAL se recalcula en el CLIENTE sumando lo ya contado. */
    const total = marcados.reduce(
        (n, p) => n + filasDe(p).reduce((m, f) => m + Number(f.filas), 0),
        0
    )

    /** El total de los 11 paquetes: se lo pasa al botón de borrado total para su aviso. */
    const totalTodo = (conteo ?? []).reduce((n, f) => n + Number(f.filas), 0)

    const nombresMarcados = PAQUETES_UI.filter((p) => marcados.includes(p.id))
        .map((p) => p.nombre)
        .join(' · ')

    const borrar = async (): Promise<{ error: string | null }> => {
        const r = await borrarDatosAction({ paquetes: marcados, seleccion: tildadas })
        if (!r.success) {
            // ⭐ FIX `g26_p1_b9`: la BD dijo QUÉ paquete falta ⇒ se cierra la confirmación y el
            //    aviso aparece al lado del botón. Dejar el diálogo abierto con «Sí, borrar»
            //    invitaría a apretar otra vez el mismo botón que acaba de fallar.
            setFaltante(r.paqueteFaltante ?? null)
            if (r.paqueteFaltante) setConfirmando(false)
            return { error: r.error ?? 'No se pudo borrar' }
        }
        // ⭐ El recuento ES la prueba de que el borrado ocurrió.
        const c = await pedirConteoPaquetes()
        setConteo('error' in c ? [] : c.filas)
        setMarcados([])
        setTildadas({})
        setFaltante(null)
        return { error: null }
    }

    /** El borrado total ya borró: acá solo se vuelve a contar. */
    const recargarTrasTotal = () => {
        void (async () => {
            const c = await pedirConteoPaquetes()
            setConteo('error' in c ? [] : c.filas)
            setMarcados([])
            setTildadas({})
            setFilasCatalogo({})
            setFaltante(null)
        })()
    }

    return (
        <>
            <Dialog open={open} onOpenChange={cambiar}>
                <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                            Borrar datos de la BD
                        </DialogTitle>
                        <DialogDescription>
                            Elegí qué se borra. Vas a ver <b>cuántas filas se pierden antes</b> de
                            confirmar. Esto no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>

                    {conteo === null ? (
                        <p className="flex items-center gap-2 px-1 py-6 text-[12.5px] text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" /> Contando lo que hay…
                        </p>
                    ) : (
                        <div className="divide-y divide-border rounded-lg border border-border">
                            {PAQUETES_UI.map((p) => {
                                const filas = filasDe(p.id)
                                const subtotal = filas.reduce((n, f) => n + Number(f.filas), 0)
                                const marcado = marcados.includes(p.id)
                                const expandido = abierto === p.id
                                const id = `paq-${p.id}`
                                return (
                                    <div key={p.id}>
                                        <div className="flex items-start gap-2.5 px-3 py-2.5">
                                            <Checkbox
                                                id={id}
                                                checked={marcado}
                                                onCheckedChange={(v) => alternar(p.id, v === true)}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <label htmlFor={id} className="cursor-pointer text-[12.5px] font-medium">
                                                    {p.nombre}
                                                </label>
                                                <p className="text-[11px] leading-snug text-muted-foreground">
                                                    {p.ayuda}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <span
                                                    className={cn(
                                                        'font-mono text-[11.5px] tabular-nums',
                                                        subtotal > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground/60'
                                                    )}
                                                >
                                                    {subtotal}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAbierto(expandido ? null : p.id)}
                                                    aria-expanded={expandido}
                                                    aria-label={`Ver el desglose de ${p.nombre}`}
                                                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                                >
                                                    <ChevronRight
                                                        className={cn('size-3.5 transition-transform', expandido && 'rotate-90')}
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        {expandido ? (
                                            <div className="border-t border-border bg-surface-2">
                                                <DesglosePaquetes filas={filas} />
                                                {marcado && p.porFilas ? (
                                                    <CatalogoSelector
                                                        filas={filasCatalogo}
                                                        tildadas={tildadas}
                                                        onTildar={tildar}
                                                        cargando={cargandoCatalogo}
                                                    />
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* ⭐ FIX `g26_p1_b9` — el borrado falló y la BD dijo QUÉ paquete falta.
                        Va al lado del botón (es lo que hay que apretar después) y **no marca
                        nada solo**: el aviso ofrece, el humano decide. */}
                    {faltante ? (
                        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive-bg/50 px-3.5 py-2.5">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] font-medium text-destructive">
                                    Falta marcar {nombreDe(faltante)}
                                </p>
                                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                                    Tiene datos que apuntan a lo que marcaste, así que <b>no se borró
                                    nada</b>. Marcalo y volvé a intentar.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive-bg"
                                onClick={() => alternar(faltante, true)}
                            >
                                Marcar {nombreDe(faltante)}
                            </Button>
                        </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                        <div className="min-w-0">
                            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                Total seleccionado
                            </p>
                            <p className="font-display text-[19px] font-semibold tabular-nums">{total}</p>
                        </div>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={marcados.length === 0 || total === 0}
                            onClick={() => setConfirmando(true)}
                        >
                            Borrar lo seleccionado
                        </Button>
                    </div>

                    {/* ⭐ D13 · APARTE y DESPUÉS: su propio bloque, su propio botón, sin estado
                        compartido con las casillas (E6). Arriba sería lo primero que se ve. */}
                    {conteo !== null ? (
                        <BorradoTotal totalFilas={totalTodo} onEjecutado={recargarTrasTotal} />
                    ) : null}
                </DialogContent>
            </Dialog>

            <ConfirmarAccionDialog
                open={confirmando}
                titulo="¿Borrar lo seleccionado?"
                descripcion={`Se van a borrar ${total} filas: ${nombresMarcados}.`}
                detalle={
                    // ⭐ MEJORA `g26_p1_b10`: borrar Entradas reinicia SU folio. Se avisa en la
                    // confirmación porque el conteo **no** lo muestra: no es una fila que se pierde,
                    // es numeración que vuelve a empezar.
                    marcados.includes('entradas')
                        ? 'No se puede deshacer, y no hay respaldo. El folio de ingreso vuelve a 0: la próxima entrada entra como ING-0001.'
                        : 'No se puede deshacer, y no hay respaldo.'
                }
                confirmLabel="Sí, borrar"
                variant="destructive"
                successMessage="Borrado. El conteo se actualizó."
                onOpenChange={setConfirmando}
                onConfirm={borrar}
            />
        </>
    )
}

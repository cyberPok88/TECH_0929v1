'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOGO MODAL BASE — Modal mini de catálogo genérico (Guía 0.8 · Parte 7)
//
// PROMOCIÓN 24 Ago 2026 (PR7 · MAPA_MODULO_CATALOGOS D11): esqueleto común de
// los 3 modales mini de la Guía 1.2 (TipoClienteModal · RutaCobroModal ·
// ListaPreciosModal — base clave/nombre/es_activo + extras) que la Guía 1.3
// reutilizará en sus pestañas nuevas (impuestos · unidades · canales · marcas).
// Cumple el gate ≥2 guías: 3 instancias en 1.2 + ≥3 nuevas en 1.3.
//
// Presentacional / infraestructura: recibe el schema zod, los defaultValues,
// los campos como children (render-prop con el form de react-hook-form) y el
// handler de submit. CERO lógica de negocio — no sabe de clientes, saldos ni
// carteras; no llama Server Actions; no tostea (el feedback es del consumidor,
// que decide toasts o propagación de datos dentro de su onSubmit).
//
// Contrato: { open, onOpenChange, modo: 'crear'|'editar', titulo, descripcion?,
//            schema, defaultValues, onSubmit, onExito?, textoCrear?, textoEditar?,
//            children }
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import type { DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType, ZodTypeDef } from 'zod'
import { AlertCircle, Loader2 } from 'lucide-react'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CatalogoModalBaseProps<T extends FieldValues> {
    open: boolean
    onOpenChange: (open: boolean) => void
    modo: 'crear' | 'editar'
    /** Título del DialogHeader (ej. "Nuevo tipo de cliente"). */
    titulo: string
    /** Descripción opcional bajo el título. */
    descripcion?: string
    /** Schema zod del dominio que valida los datos del formulario. */
    schema: ZodType<T, ZodTypeDef, T>
    /** Valores iniciales según modo. El base los aplica en CADA apertura
     *  (reset por apertura — el componente queda montado entre cierres). */
    defaultValues: DefaultValues<T>
    /**
     * Persiste los datos. Retorna { error: string | null }:
     *   · error → el modal lo muestra inline (banner rojo) y permanece abierto
     *   · null  → el modal cierra y dispara onExito
     * El consumidor decide el feedback de éxito (toast, propagación de data…)
     * dentro de este handler, antes de retornar.
     */
    onSubmit: (datos: T) => Promise<{ error: string | null }>
    /** Callback tras guardar exitosamente (el modal ya cerró). */
    onExito?: () => void
    /** Label del botón de submit en modo 'crear'. Default: 'Crear'. */
    textoCrear?: string
    /** Label del botón de submit en modo 'editar'. Default: 'Guardar cambios'. */
    textoEditar?: string
    /** Render-prop: recibe el form (register, watch, setValue, formState…)
     *  para que el consumidor dibuje sus campos dentro del modal. */
    children: (form: UseFormReturn<T>) => ReactNode
}

/**
 * Shell del modal mini de catálogo: Dialog + react-hook-form/zod + botones +
 * error inline. El consumidor provee schema, defaults, campos y persistencia.
 * Si cambia el registro en caliente (editar A → editar B), el padre fuerza
 * remount con `key` (patrón FormularioRutaCobro de la 1.2).
 */
export function CatalogoModalBase<T extends FieldValues>({
    open,
    onOpenChange,
    modo,
    titulo,
    descripcion,
    schema,
    defaultValues,
    onSubmit,
    onExito,
    textoCrear = 'Crear',
    textoEditar = 'Guardar cambios',
    children,
}: CatalogoModalBaseProps<T>) {
    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)
    const esEditar = modo === 'editar'

    const form = useForm<T>({
        resolver: zodResolver(schema),
        defaultValues,
    })

    const { handleSubmit } = form

    // ═══ RESET POR APERTURA (FIX 26 Ago 2026) ══════════════════════════════════
    // El padre mantiene ESTE componente montado entre aperturas (controla `open`),
    // así que el estado del useForm persistiría entre cierres sin este reset —
    // el bug reportado: escribir, cerrar sin guardar y reabrir mostraba los datos.
    // Radix desmonta el DOM del DialogContent al cerrar, NO el componente React
    // que renderiza el Dialog: el "reset por remount" solo funcionaría si el
    // useForm viviera DENTRO de DialogContent (patrón FormularioRutaCobro 1.2).
    // El guard de transición evita resetear mientras el modal está abierto
    // (defaultValues cambia de identidad en cada render del padre en edición).
    const abiertoPrevio = useRef(open)
    useEffect(() => {
        if (open && !abiertoPrevio.current) {
            form.reset(defaultValues)
        }
        abiertoPrevio.current = open
    }, [open, form, defaultValues])

    /** Cierre unificado: el banner de error solo vive mientras el modal está
     *  abierto — se limpia al cerrar (event handler, no effect). */
    const manejarOpenChange = (o: boolean) => {
        // No se cierra por overlay/Escape mientras se guarda.
        if (!enviando) {
            if (!o) setErrorServidor(null)
            onOpenChange(o)
        }
    }

    const submitForm = handleSubmit(async (datos) => {
        setEnviando(true)
        setErrorServidor(null)
        try {
            const res = await onSubmit(datos)
            if (res.error) {
                setErrorServidor(res.error)
                return
            }
            onOpenChange(false)
            onExito?.()
        } finally {
            setEnviando(false)
        }
    })

    return (
        <Dialog
            open={open}
            onOpenChange={manejarOpenChange}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                    {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
                </DialogHeader>

                <form onSubmit={submitForm} noValidate className="flex flex-col gap-5">
                    {children(form)}

                    {/* Error inline del servidor (contrato ProveedorModal / RutaCobroModal) */}
                    {errorServidor && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-bg px-3 py-2 text-sm text-destructive"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{errorServidor}</span>
                        </div>
                    )}

                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => manejarOpenChange(false)}
                            disabled={enviando}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando}>
                            {enviando && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            )}
                            {enviando ? 'Guardando…' : esEditar ? textoEditar : textoCrear}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

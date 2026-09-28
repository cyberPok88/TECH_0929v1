'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLA — EDITOR (Guía 2.1 · P4 · Smart) · P5: + «Ver versiones» · P7: + «Vista previa»
//
// El corazón del carril: aquí se ESCRIBE el papel.
//
// ⚠️ `version` NO viaja en el payload. La asigna el trigger `fn_plantillas_versionar()`
// al detectar el cambio de `cuerpo`/`variables`, y archiva el estado previo en el
// historial. Escribirla aquí rompería el `UNIQUE(id_plantilla, version)` DESPUÉS de
// haber perdido el estado previo.
//
// ⭐ P7 — EL GATE (decisión 3 de P0 hecha código): el toggle «Activa» está DESHABILITADO
// hasta que la pestaña «Vista previa» se haya renderizado en ESTA edición. Sin el gate,
// «previsualización obligatoria» sería una sugerencia y el riesgo declarado en
// SISTEMA_IMPRESION §3 («una plantilla rota rompe un documento con valor») quedaría sin
// mitigación en el único momento en que se puede evitar.
//
// El `resolver` es `plantillaCrearSchema` en AMBOS modos: el formulario siempre tiene los
// 7 campos y en edición el tipo se pinta fijo. El servidor re-valida con
// `plantillaEditarSchema`, que ni declara `id_tipo` → no se puede cambiar.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, History, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { PlantillaPreview } from '@/components/sistema/plantillas/PlantillaPreview'
import { VariablesEditor } from '@/components/sistema/plantillas/VariablesEditor'
import { VersionesSubModal } from '@/components/sistema/plantillas/VersionesSubModal'
import {
    crearPlantilla,
    editarPlantilla,
    listarTiposDocumento,
} from '@/lib/actions/plantillas'
import { plantillaCrearSchema } from '@/lib/validations/plantillas'
import { plantillaAFormData, plantillaFormDataVacia } from '@/types/plantillas'
import type {
    PlantillaDocumento,
    PlantillaFormData,
    TipoDocumento,
} from '@/types/plantillas'

interface PlantillaEditorModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    modo: 'crear' | 'editar'
    /** Fila a editar (`null` en alta). Trae `cuerpo` y `variables` (el DTO los incluye). */
    plantilla: PlantillaDocumento | null
    onExito?: () => void
}

export function PlantillaEditorModal({
    open,
    onOpenChange,
    modo,
    plantilla,
    onExito,
}: PlantillaEditorModalProps) {
    const esEditar = modo === 'editar' && plantilla !== null
    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)
    const [tipos, setTipos] = useState<TipoDocumento[]>([])
    const [versionesOpen, setVersionesOpen] = useState(false)
    // ⭐ EL GATE: se enciende al VISITAR la pestaña «Vista previa».
    const [previewVisto, setPreviewVisto] = useState(false)

    // ⚠️ Se estrecha por la fila, NO por `esEditar`: TS no deduce el no-nulo desde un
    //    booleano derivado (lección de P2).
    const defaults: PlantillaFormData = plantilla
        ? plantillaAFormData(plantilla)
        : plantillaFormDataVacia('')

    const form = useForm<PlantillaFormData>({
        resolver: zodResolver(plantillaCrearSchema),
        defaultValues: defaults,
    })

    const { handleSubmit, formState, reset } = form
    // ⭐ `useWatch` y NO `form.watch()`: el React Compiler emite
    //    `react-hooks/incompatible-library` («React Hook Form's useForm() API returns a
    //    watch() function which cannot be memoized safely») y **salta el componente entero**.
    //    `useWatch` es la API que RHF recomienda para leer valores reactivos — mismo patrón
    //    que `UserModal` y los formularios de auth (`?? default` para el primer render).
    const variables = useWatch({ control: form.control, name: 'variables' }) ?? []
    const idTipo = useWatch({ control: form.control, name: 'id_tipo' }) ?? ''
    const esActivo = useWatch({ control: form.control, name: 'es_activo' }) ?? false
    const cuerpo = useWatch({ control: form.control, name: 'cuerpo' }) ?? ''

    // Tipos activos para el select. setState DENTRO del .then() — nunca sincrónico
    // en el cuerpo del efecto (react-hooks/set-state-in-effect).
    const cargarTipos = useCallback(async () => {
        const res = await listarTiposDocumento({ busqueda: '', familia: '', esActivo: 'activos' })
        return res.success ? (res.data ?? []) : []
    }, [])

    useEffect(() => {
        if (!open) return
        let activo = true
        cargarTipos().then((t) => {
            if (activo) setTipos(t)
        })
        return () => {
            activo = false
        }
    }, [open, cargarTipos])

    // Reset por apertura — MISMO patrón que `CatalogoModalBase` (kit 0.8): guard de
    // transición con `useRef` y **sin setState dentro del efecto**.
    const abiertoPrevio = useRef(false)
    useEffect(() => {
        if (open && !abiertoPrevio.current) {
            reset(plantilla ? plantillaAFormData(plantilla) : plantillaFormDataVacia(''))
        }
        abiertoPrevio.current = open
    }, [open, plantilla, reset])

    /**
     * Tras restaurar: se CIERRA el editor.
     *
     * ⭐ Por qué NO se sigue editando: restaurar cambia la VERSIÓN de la fila y el formulario
     * se abrió contra la anterior. Dejar el cuerpo restaurado en pantalla con el número de
     * versión viejo son dos datos del MISMO objeto divergiendo — lo que la ley L6 prohíbe — y,
     * peor, un «Guardar cambios» posterior **revertiría la restauración**. Se cierra, la lista
     * se recarga y el usuario reabre.
     */
    const cerrarTrasRestaurar = useCallback(() => {
        toast.success('Versión restaurada. Vuelve a abrir la plantilla para editarla.')
        onExito?.()
        onOpenChange(false)
    }, [onExito, onOpenChange])

    const enviar = handleSubmit(async (datos) => {
        setEnviando(true)
        setErrorServidor(null)
        try {
            const res =
                esEditar && plantilla
                    ? await editarPlantilla(plantilla.id, {
                          nombre: datos.nombre,
                          cuerpo: datos.cuerpo,
                          variables: datos.variables,
                          notas_version: datos.notas_version,
                          es_activo: datos.es_activo,
                      })
                    : await crearPlantilla(datos)

            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo guardar la plantilla.')
                return
            }
            toast.success(esEditar ? 'Plantilla actualizada' : 'Plantilla creada')
            onOpenChange(false)
            onExito?.()
        } finally {
            setEnviando(false)
        }
    })

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!enviando) {
                    if (o) {
                        // ⭐ El gate es POR EDICIÓN: al reabrir hay que volver a ver el papel.
                        setPreviewVisto(false)
                    } else {
                        setErrorServidor(null)
                    }
                    onOpenChange(o)
                }
            }}
        >
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{esEditar ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
                    <DialogDescription>
                        {esEditar
                            ? 'Al cambiar el cuerpo o las variables se crea una versión nueva; la anterior queda en el historial.'
                            : 'Elige el tipo de documento y escribe cómo se ve el papel.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
                    {/* Tipo + nombre — fuera de las pestañas: son la identidad de la plantilla. */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pl-tipo">Tipo de documento</Label>
                            {esEditar ? (
                                <Input
                                    id="pl-tipo"
                                    value={plantilla?.tipo_nombre ?? plantilla?.tipo_clave ?? ''}
                                    readOnly
                                    className="bg-surface-raised text-muted-foreground"
                                />
                            ) : (
                                <Select
                                    value={idTipo}
                                    onValueChange={(v) => form.setValue('id_tipo', v, { shouldValidate: true })}
                                >
                                    <SelectTrigger id="pl-tipo" className="w-full">
                                        <SelectValue placeholder="Elige el tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tipos.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {formState.errors.id_tipo && (
                                <p className="text-xs text-destructive">{formState.errors.id_tipo.message}</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pl-nombre">Nombre</Label>
                            <Input
                                id="pl-nombre"
                                {...form.register('nombre')}
                                placeholder="Nota de compra al proveedor"
                            />
                            {formState.errors.nombre && (
                                <p className="text-xs text-destructive">{formState.errors.nombre.message}</p>
                            )}
                        </div>
                    </div>

                    <Tabs
                        defaultValue="cuerpo"
                        onValueChange={(v) => {
                            // ⭐ EL GATE se enciende en el HANDLER (evento), no en un efecto.
                            if (v === 'preview') setPreviewVisto(true)
                        }}
                    >
                        <TabsList>
                            <TabsTrigger value="cuerpo">Cuerpo</TabsTrigger>
                            <TabsTrigger value="variables">
                                Variables{variables.length > 0 ? ` (${variables.length})` : ''}
                            </TabsTrigger>
                            <TabsTrigger value="preview">Vista previa</TabsTrigger>
                        </TabsList>

                        <TabsContent value="cuerpo" className="flex flex-col gap-3 pt-3">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="pl-cuerpo">Cuerpo del documento (HTML)</Label>
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {esEditar ? `versión vigente v${plantilla?.version}` : 'versión 1 al crear'}
                                    </span>
                                </div>
                                <Textarea
                                    id="pl-cuerpo"
                                    {...form.register('cuerpo')}
                                    rows={14}
                                    spellCheck={false}
                                    placeholder={'<div class="membrete">{{razon_social}}</div>\n<h1>Nota {{folio}}</h1>'}
                                    className="font-mono text-[13px] leading-relaxed"
                                />
                                {formState.errors.cuerpo && (
                                    <p className="text-xs text-destructive">{formState.errors.cuerpo.message}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    El papel no hereda la paleta: se pinta en blanco y negro. Los datos llegan
                                    resueltos desde la pantalla — la plantilla <b>no calcula</b>.
                                </p>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="pl-notas">Notas de la versión</Label>
                                <Input
                                    id="pl-notas"
                                    {...form.register('notas_version')}
                                    placeholder="Qué cambió (opcional)"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="variables" className="pt-3">
                            <VariablesEditor
                                variables={variables}
                                onChange={(v) => form.setValue('variables', v, { shouldValidate: true })}
                                disabled={enviando}
                            />
                        </TabsContent>

                        <TabsContent value="preview" className="pt-3">
                            <PlantillaPreview cuerpo={cuerpo} variables={variables} />
                        </TabsContent>
                    </Tabs>

                    {/* Activo — ⭐ GATEADO: sin haber visto el papel no se activa (decisión 3). */}
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                        <div className="flex flex-col">
                            <Label htmlFor="pl-activo">Activa</Label>
                            <span className="text-xs text-muted-foreground">
                                {esActivo && !previewVisto
                                    ? 'Mira la Vista previa antes de activarla.'
                                    : 'Una sola plantilla activa por tipo. Al activar, si el tipo ya tenía otra, la operación se rechaza.'}
                            </span>
                        </div>
                        <Switch
                            id="pl-activo"
                            checked={esActivo}
                            disabled={!previewVisto}
                            onCheckedChange={(v) => form.setValue('es_activo', v, { shouldValidate: true })}
                        />
                    </div>

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
                        {/* «Ver versiones» SOLO en edición: en alta no hay historial que ver
                            (un botón que abre una lista vacía es un control muerto). */}
                        {esEditar && plantilla ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setVersionesOpen(true)}
                                disabled={enviando}
                                className="gap-1.5 sm:mr-auto"
                            >
                                <History className="h-4 w-4" aria-hidden="true" />
                                Ver versiones
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={enviando}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando}>
                            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            {enviando ? 'Guardando…' : esEditar ? 'Guardar cambios' : 'Crear plantilla'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            {esEditar && plantilla ? (
                <VersionesSubModal
                    open={versionesOpen}
                    onOpenChange={setVersionesOpen}
                    idPlantilla={plantilla.id}
                    versionActual={plantilla.version}
                    onRestaurada={cerrarTrasRestaurar}
                />
            ) : null}
        </Dialog>
    )
}

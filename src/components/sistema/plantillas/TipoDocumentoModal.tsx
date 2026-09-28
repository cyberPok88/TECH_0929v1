'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// TIPO DE DOCUMENTO — MODAL (Guía 2.1 · 27 Sep 2026)
//
// ⭐ PRIMER CONSUMIDOR REAL de `CatalogoModalBase` (kit 0.8 · form/modales): vive
// en el kit desde el 24 Ago 2026 y CATALOGO_UI lo daba por «nadie todavía».
// No se reescribe el esqueleto Dialog + react-hook-form + zod + error inline.
//
// Gating R2 (familia ↔ audita_reimpresion): está en la BD (CHECK chk_tipo_audita_valor),
// en zod (refinarTipo) y aquí como control apagado. La de aquí es cortesía; la que
// manda es la de la BD.
// ═══════════════════════════════════════════════════════════════════════════════

import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { CatalogoModalBase } from '@/components/form/modales/CatalogoModalBase'
import { toast } from 'sonner'
import { crearTipoDocumento, editarTipoDocumento } from '@/lib/actions/plantillas'
import { tipoDocumentoCrearSchema } from '@/lib/validations/plantillas'
import {
    tipoDocumentoAFormData,
    tipoDocumentoFormDataVacia,
} from '@/types/plantillas'
import type { FamiliaDocumento, TipoDocumento, TipoDocumentoFormData } from '@/types/plantillas'

interface TipoDocumentoModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    modo: 'crear' | 'editar'
    /** Fila a editar (`null` en alta). */
    tipo: TipoDocumento | null
    onExito?: () => void
}

export function TipoDocumentoModal({
    open,
    onOpenChange,
    modo,
    tipo,
    onExito,
}: TipoDocumentoModalProps) {
    const esEditar = modo === 'editar' && tipo !== null
    // ⚠️ Se estrecha por `tipo`, NO por `esEditar`: TS no deduce el no-nulo desde un
    //    booleano derivado, y `tipoDocumentoAFormData(tipo)` exigiría un `!`.
    const defaults: TipoDocumentoFormData = tipo
        ? tipoDocumentoAFormData(tipo)
        : tipoDocumentoFormDataVacia()

    return (
        <CatalogoModalBase<TipoDocumentoFormData>
            open={open}
            onOpenChange={onOpenChange}
            modo={esEditar ? 'editar' : 'crear'}
            titulo={esEditar ? 'Editar tipo de documento' : 'Nuevo tipo de documento'}
            descripcion="El tipo define qué se imprime, si se firma y si su reimpresión se audita."
            schema={tipoDocumentoCrearSchema}
            defaultValues={defaults}
            textoCrear="Crear tipo"
            onSubmit={async (datos) => {
                const res = esEditar && tipo
                    ? await editarTipoDocumento(tipo.id, {
                          nombre: datos.nombre,
                          familia: datos.familia,
                          se_firma: datos.se_firma,
                          audita_reimpresion: datos.audita_reimpresion,
                          descripcion: datos.descripcion,
                          es_activo: datos.es_activo,
                      })
                    : await crearTipoDocumento(datos)

                if (!res.success) return { error: res.error ?? 'No se pudo guardar el tipo.' }
                toast.success(esEditar ? 'Tipo actualizado' : 'Tipo creado')
                return { error: null }
            }}
            onExito={onExito}
        >
            {(form) => {
                const familia = form.watch('familia')
                const esInterno = familia === 'interno'

                return (
                    <>
                            {/* Clave — el VÍNCULO con los consumidores. Inmutable tras crear (R1). */}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="tipo-clave">Clave</Label>
                                <Input
                                    id="tipo-clave"
                                    {...form.register('clave')}
                                    readOnly={esEditar}
                                    placeholder="nota_compra"
                                    className={`font-mono ${esEditar ? 'bg-surface-raised text-muted-foreground' : ''}`}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {esEditar
                                        ? 'La clave no se edita: los documentos ya impresos apuntan a ella.'
                                        : 'Minúsculas, números y guion bajo. Se escribe literal en el código que imprime.'}
                                </p>
                                {form.formState.errors.clave && (
                                    <p className="text-xs text-destructive">
                                        {form.formState.errors.clave.message}
                                    </p>
                                )}
                            </div>

                            {/* Nombre */}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="tipo-nombre">Nombre</Label>
                                <Input id="tipo-nombre" {...form.register('nombre')} placeholder="Nota de compra" />
                                {form.formState.errors.nombre && (
                                    <p className="text-xs text-destructive">
                                        {form.formState.errors.nombre.message}
                                    </p>
                                )}
                            </div>

                            {/* Familia + gating R2 */}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="tipo-familia">Familia</Label>
                                <Select
                                    value={familia}
                                    onValueChange={(v) => {
                                        const nueva = v as FamiliaDocumento
                                        form.setValue('familia', nueva, { shouldValidate: true })
                                        // ⭐ R2 — un interno no audita: se apaga EN EL HANDLER.
                                        if (nueva === 'interno') {
                                            form.setValue('audita_reimpresion', false)
                                        }
                                    }}
                                >
                                    <SelectTrigger id="tipo-familia" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="interno">Interno (acto interno)</SelectItem>
                                        <SelectItem value="valor">Papel con valor</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {esInterno
                                        ? 'Acto interno: el PDF en imagen basta y no se audita la reimpresión.'
                                        : 'Papel que sale de la empresa: exige texto buscable y audita su reimpresión.'}
                                </p>
                            </div>

                            {/* Se firma */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col">
                                    <Label htmlFor="tipo-firma">Se firma</Label>
                                    <span className="text-xs text-muted-foreground">
                                        El papel lleva línea de firma
                                    </span>
                                </div>
                                <Switch
                                    id="tipo-firma"
                                    checked={form.watch('se_firma')}
                                    onCheckedChange={(v) =>
                                        form.setValue('se_firma', v, { shouldValidate: true })
                                    }
                                />
                            </div>

                            {/* Audita reimpresión — apagado si la familia es interna (R2) */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col">
                                    <Label htmlFor="tipo-audita">Audita su reimpresión</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {esInterno
                                            ? 'No aplica a los documentos internos'
                                            : 'Registra quién y cuándo reimprimió'}
                                    </span>
                                </div>
                                <Switch
                                    id="tipo-audita"
                                    checked={form.watch('audita_reimpresion')}
                                    disabled={esInterno}
                                    onCheckedChange={(v) =>
                                        form.setValue('audita_reimpresion', v, { shouldValidate: true })
                                    }
                                />
                            </div>

                            {/* Activo */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col">
                                    <Label htmlFor="tipo-activo">Activo</Label>
                                    <span className="text-xs text-muted-foreground">
                                        Un tipo inactivo no se ofrece a los consumidores
                                    </span>
                                </div>
                                <Switch
                                    id="tipo-activo"
                                    checked={form.watch('es_activo')}
                                    onCheckedChange={(v) =>
                                        form.setValue('es_activo', v, { shouldValidate: true })
                                    }
                                />
                            </div>

                            {/* Descripción */}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="tipo-descripcion">Descripción</Label>
                                <Textarea
                                    id="tipo-descripcion"
                                    {...form.register('descripcion')}
                                    rows={2}
                                    placeholder="Para qué sirve este documento"
                                />
                            </div>
                    </>
                )
            }}
        </CatalogoModalBase>
    )
}

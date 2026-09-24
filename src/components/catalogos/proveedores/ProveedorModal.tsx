'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDOR MODAL — Alta / edición con 4 pestañas (Guía 1.1 · Parte 3 · Smart)
// Pestañas derivadas de los bloques del diccionario (ANATOMÍA §4):
//   General · Datos fiscales · Contacto y domicilio · Términos y notas
// RHF + zodResolver (convención §6). El C.P. muestra el SelloFiscal cuando hay
// RFC (domicilio fiscal, R3) vía DomicilioFields del kit (PROMOCIÓN 0.8).
// codigo NO se captura (autogenerado PROV-####) — se muestra en edición.
// Los condicionales visuales (rfc → sello · crédito → días) NO usan `watch`
// (react-hooks/incompatible-library): estado local sincronizado en onChange.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { DomicilioFields } from '@/components/form'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import { crearProveedor, editarProveedor } from '@/lib/actions/proveedores'
import type { RegimenFiscalOpcion } from '@/lib/actions/sat'
import { proveedorSchema } from '@/lib/validations/proveedores'
import type { ProveedorInput } from '@/lib/validations/proveedores'
import { proveedorAFormData, proveedorFormDataVacio } from '@/types/proveedores'
import type { Proveedor, ProveedorFormData } from '@/types/proveedores'

import { cn } from '@/lib/utils'

interface ProveedorModalProps {
    open: boolean
    modo: 'crear' | 'editar'
    /** Solo en edición — con quién se precarga el formulario. */
    proveedor: Proveedor | null
    regimenes: RegimenFiscalOpcion[]
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function ProveedorModal({
    open,
    modo,
    proveedor,
    regimenes,
    onOpenChange,
    onSuccess,
}: ProveedorModalProps) {
    const esEditar = modo === 'editar'
    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const defaultValues: ProveedorFormData = esEditar
        ? proveedorAFormData(proveedor as Proveedor)
        : proveedorFormDataVacio()

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProveedorInput>({
        resolver: zodResolver(proveedorSchema),
        defaultValues,
    })

    // Condicionales visuales (R3/R5) SIN watch — regla react-hooks/
    // incompatible-library: la `watch()` de RHF no es estado de render
    // memoizable. Estado local sincronizado en los onChange.
    const [terminosVigente, setTerminosVigente] = useState<'contado' | 'credito'>(
        defaultValues.terminos_pago
    )
    const [rfcVigente, setRfcVigente] = useState(defaultValues.rfc)
    const tieneRfc = rfcVigente.trim().length > 0

    const registroRfc = register('rfc')

    // Reset por apertura/firma — el padre mantiene ESTA instancia montada
    // SIEMPRE (sin key dinámico: cambiar key desmonta el Dialog a mitad de su
    // animación de salida y deja el overlay de Radix colgado). Se resetea solo
    // cuando cambia el objetivo (abrir crear · abrir editar-{id}).
    const firma = esEditar ? (proveedor?.id ?? 'nuevo') : 'nuevo'
    const ultimaFirma = useRef<string | null>(null)
    useEffect(() => {
        if (open && ultimaFirma.current !== firma) {
            reset(defaultValues)
            setTerminosVigente(defaultValues.terminos_pago)
            setRfcVigente(defaultValues.rfc)
            ultimaFirma.current = firma
        }
    }, [open, firma, reset, defaultValues])

    const enviar = handleSubmit(async (valores) => {
        setEnviando(true)
        setErrorServidor(null)
        try {
            const res = esEditar
                ? await editarProveedor((proveedor as Proveedor).id, valores)
                : await crearProveedor(valores)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo guardar el proveedor.')
                return
            }
            toast.success(esEditar ? 'Proveedor actualizado' : 'Proveedor creado')
            onSuccess()
            onOpenChange(false)
        } finally {
            setEnviando(false)
        }
    })

    // Mensaje de error por campo (zod ya lo resolvió en `errors`).
    const renderError = (nombre: keyof ProveedorFormData) => {
        const msg = errors[nombre]?.message
        return typeof msg === 'string' ? (
            <p className="text-xs font-medium text-destructive">{msg}</p>
        ) : null
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {esEditar ? `Editar proveedor · ${proveedor?.codigo ?? ''}` : 'Nuevo proveedor'}
                    </DialogTitle>
                    <DialogDescription>
                        Los datos fiscales se pueden completar después (R3) — el RFC es opcional
                        al crear.
                    </DialogDescription>
                </DialogHeader>

                {errorServidor && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span>{errorServidor}</span>
                    </div>
                )}

                <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="fiscal">Datos fiscales</TabsTrigger>
                            <TabsTrigger value="contacto">Contacto y domicilio</TabsTrigger>
                            <TabsTrigger value="terminos">Términos y notas</TabsTrigger>
                        </TabsList>

                        {/* ── General ─────────────────────────────────────────── */}
                        <TabsContent value="general" className="space-y-3 pt-3">
                            <div className="space-y-2">
                                <Label htmlFor="nombre_comercial">Nombre comercial *</Label>
                                <Input
                                    id="nombre_comercial"
                                    {...register('nombre_comercial')}
                                    placeholder="Distribuidora Chávez"
                                    disabled={enviando}
                                    autoFocus
                                />
                                {renderError('nombre_comercial')}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="razon_social">
                                    Razón social{' '}
                                    <span className="text-xs text-muted-foreground">(opcional)</span>
                                </Label>
                                <Input id="razon_social" {...register('razon_social')} disabled={enviando} />
                                {renderError('razon_social')}
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="tipo">Tipo</Label>
                                    <Controller
                                        control={control}
                                        name="tipo"
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                disabled={enviando}
                                            >
                                                <SelectTrigger id="tipo">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="formal">Formal</SelectItem>
                                                    <SelectItem value="informal">Informal</SelectItem>
                                                    <SelectItem value="eventual">Eventual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <div className="flex items-end gap-3 pb-1">
                                    <Label htmlFor="es_activo" className="flex-1">
                                        Proveedor activo
                                    </Label>
                                    <Controller
                                        control={control}
                                        name="es_activo"
                                        render={({ field }) => (
                                            <Switch
                                                id="es_activo"
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={enviando}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Datos fiscales ──────────────────────────────────── */}
                        <TabsContent value="fiscal" className="space-y-3 pt-3">
                            <div className="space-y-2">
                                <Label htmlFor="rfc">
                                    RFC{' '}
                                    <span className="text-xs text-muted-foreground">
                                        (opcional · con RFC el régimen y el C.P. son obligatorios)
                                    </span>
                                </Label>
                                <Input
                                    id="rfc"
                                    {...registroRfc}
                                    onChange={(e) => {
                                        registroRfc.onChange(e)
                                        setRfcVigente(e.target.value)
                                    }}
                                    placeholder="CHD901010XXX"
                                    className="font-mono uppercase"
                                    disabled={enviando}
                                />
                                {renderError('rfc')}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="id_regimen_fiscal">Régimen fiscal</Label>
                                <Controller
                                    control={control}
                                    name="id_regimen_fiscal"
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={(v) =>
                                                field.onChange(v === '__ninguno__' ? '' : v)
                                            }
                                            disabled={enviando}
                                        >
                                            <SelectTrigger id="id_regimen_fiscal">
                                                <SelectValue placeholder="Selecciona un régimen…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__ninguno__">
                                                    Sin régimen
                                                </SelectItem>
                                                {regimenes.map((r) => (
                                                    <SelectItem key={r.id} value={r.id}>
                                                        {r.clave} · {r.descripcion}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {renderError('id_regimen_fiscal')}
                            </div>
                        </TabsContent>

                        {/* ── Contacto y domicilio ───────────────────────────── */}
                        <TabsContent value="contacto" className="space-y-3 pt-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="telefono">
                                        Teléfono{' '}
                                        <span className="text-xs text-muted-foreground">(opcional)</span>
                                    </Label>
                                    <Input id="telefono" {...register('telefono')} type="tel" disabled={enviando} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">
                                        Correo{' '}
                                        <span className="text-xs text-muted-foreground">(opcional)</span>
                                    </Label>
                                    <Input id="email" {...register('email')} type="email" disabled={enviando} />
                                    {renderError('email')}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nombre_contacto">
                                    Nombre de contacto{' '}
                                    <span className="text-xs text-muted-foreground">(opcional)</span>
                                </Label>
                                <Input id="nombre_contacto" {...register('nombre_contacto')} disabled={enviando} />
                            </div>
                            <div className="space-y-2 rounded-md border border-border/60 bg-surface/40 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Domicilio
                                </p>
                                <DomicilioFields
                                    register={register}
                                    errors={errors}
                                    cpFiscal={tieneRfc}
                                    deshabilitado={enviando}
                                />
                            </div>
                        </TabsContent>

                        {/* ── Términos y notas ────────────────────────────────── */}
                        <TabsContent value="terminos" className="space-y-3 pt-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="terminos_pago">Términos de pago</Label>
                                    <Controller
                                        control={control}
                                        name="terminos_pago"
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={(v) => {
                                                    const valor = v as 'contado' | 'credito'
                                                    field.onChange(valor)
                                                    setTerminosVigente(valor)
                                                }}
                                                disabled={enviando}
                                            >
                                                <SelectTrigger id="terminos_pago">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="contado">Contado</SelectItem>
                                                    <SelectItem value="credito">Crédito</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dias_credito">
                                        Días de crédito{' '}
                                        <span className="text-xs text-muted-foreground">
                                            {terminosVigente === 'credito'
                                                ? '(requerido)'
                                                : '(solo con crédito)'}
                                        </span>
                                    </Label>
                                    <Input
                                        id="dias_credito"
                                        {...register('dias_credito')}
                                        type="number"
                                        min={1}
                                        disabled={enviando || terminosVigente === 'contado'}
                                        placeholder={terminosVigente === 'credito' ? '30' : '—'}
                                    />
                                    {renderError('dias_credito')}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notas">
                                    Notas{' '}
                                    <span className="text-xs text-muted-foreground">(opcional)</span>
                                </Label>
                                <Textarea
                                    id="notas"
                                    {...register('notas')}
                                    rows={3}
                                    disabled={enviando}
                                    placeholder="Referencias, acuerdos, horarios de entrega…"
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={enviando}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando} className={cn(enviando && 'opacity-80')}>
                            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            {esEditar ? 'Guardar cambios' : 'Crear proveedor'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

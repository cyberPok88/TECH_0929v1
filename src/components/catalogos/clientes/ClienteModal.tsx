'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTE MODAL — Alta / edición (Guía 1.3 · Partes 3–4 · Smart)
// Crea en secciones (Identidad/Comercial · Crédito · Fiscal · grids · Notas).
// En edición: codigo read-only · saldo_inicial oculto (D20) · hijas por diffs.
// Los grids (DireccionesGrid/ContactosGrid) poseen su editor inline; el padre rastrea
// los ids reales removidos para enviarlos como diffs.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'

import { DireccionesGrid } from '@/components/catalogos/clientes/DireccionesGrid'
import { ContactosGrid } from '@/components/catalogos/clientes/ContactosGrid'
import { crearCliente, editarCliente, obtenerCliente } from '@/lib/actions/clientes'
import { clienteAltaSchema, clienteEditarSchema } from '@/lib/validations/clientes'
import {
    listarCanalesVenta,
    listarListasPrecio,
    listarMarcasComerciales,
    listarRutasCobro,
    listarTiposCliente,
    listarVendedores,
} from '@/lib/actions/catalogos'
import { listarRegimenesFiscalesActivos } from '@/lib/actions/sat'
import type { RegimenFiscalOpcion } from '@/lib/actions/sat'
import { clienteAFormData, clienteFormDataVacio } from '@/types/clientes'
import type { ClienteFormData, ContactoFormData, DireccionFormData } from '@/types/clientes'
import { cn } from '@/lib/utils'

interface OpcionUI {
    id: string
    etiqueta: string
}

interface ClienteModalProps {
    open: boolean
    modo: 'crear' | 'editar'
    /** Solo en edición: id del cliente a cargar (el detalle se obtiene en el modal). */
    clienteId?: string
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function ClienteModal({
    open,
    modo,
    clienteId,
    onOpenChange,
    onSuccess,
}: ClienteModalProps) {
    const esEditar = modo === 'editar'
    const [enviando, setEnviando] = useState(false)
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)
    const [codigoActual, setCodigoActual] = useState('')
    const [direcciones, setDirecciones] = useState<DireccionFormData[]>([])
    const [contactos, setContactos] = useState<ContactoFormData[]>([])
    const [removidosDir, setRemovidosDir] = useState<string[]>([])
    const [removidosCt, setRemovidosCt] = useState<string[]>([])

    const [marcas, setMarcas] = useState<OpcionUI[]>([])
    const [tipos, setTipos] = useState<OpcionUI[]>([])
    const [listas, setListas] = useState<OpcionUI[]>([])
    const [canales, setCanales] = useState<OpcionUI[]>([])
    const [rutas, setRutas] = useState<OpcionUI[]>([])
    const [vendedores, setVendedores] = useState<OpcionUI[]>([])
    const [regimenes, setRegimenes] = useState<RegimenFiscalOpcion[]>([])
    const catalogoCargado = useRef(false)
    // Defaults de alta (usuario 04 Sep): marca Tenochtitlán · tipo Público general.
    const marcaTenochtitlan = useRef<string | null>(null)
    const tipoPublico = useRef<string | null>(null)

    const resolver = useMemo(
        () => zodResolver(esEditar ? clienteEditarSchema : clienteAltaSchema),
        [esEditar]
    )

    const defaultValues = clienteFormDataVacio()
    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<ClienteFormData>({
        resolver,
        defaultValues,
    })

    const [tipoPersonaVigente, setTipoPersonaVigente] = useState<'fisica' | 'moral'>('fisica')
    const [tieneCredito, setTieneCredito] = useState(false)
    const [rfcVigente, setRfcVigente] = useState('')
    const tieneRfc = rfcVigente.trim().length > 0
    const registroRfc = register('rfc')

    // Reset por objetivo (crear | editar-{id}) — instancia siempre montada.
    const firma = esEditar ? `editar-${clienteId ?? ''}` : 'crear'
    const ultimaFirma = useRef<string | null>(null)
    useEffect(() => {
        if (!open || ultimaFirma.current === firma) return
        ultimaFirma.current = firma
        void Promise.resolve().then(() => {
        setErrorServidor(null)
        if (!esEditar) {
            reset(clienteFormDataVacio())
            setDirecciones([])
            setContactos([])
            setRemovidosDir([])
            setRemovidosCt([])
            setCodigoActual('')
            setTipoPersonaVigente('fisica')
            setTieneCredito(false)
            setRfcVigente('')
            // Defaults de alta (usuario 04 Sep): Tenochtitlán · Público general.
            if (marcaTenochtitlan.current) {
                setValue('id_marca_comercial', marcaTenochtitlan.current, { shouldValidate: false })
            }
            if (tipoPublico.current) {
                setValue('id_tipo_cliente', tipoPublico.current, { shouldValidate: false })
            }
            return
        }
        if (!clienteId) return
        setCargando(true)
        void obtenerCliente(clienteId).then((res) => {
            setCargando(false)
            if (!res.success || !res.data) {
                setErrorServidor(res.error ?? 'No se pudo cargar el cliente.')
                return
            }
            const detalle = res.data as unknown as Parameters<typeof clienteAFormData>[0]
            const form = clienteAFormData(detalle)
            reset(form)
            setCodigoActual(detalle.codigo)
            setDirecciones(form.direcciones)
            setContactos(form.contactos)
            setRemovidosDir([])
            setRemovidosCt([])
            setTipoPersonaVigente(form.tipo_persona)
            setTieneCredito(form.tiene_credito)
            setRfcVigente(form.rfc)
        })
        })
        // ⭐ FIX 22 Sep 2026 — `setValue` declarado: react-hook-form lo expone
        // estable, pero es dependencia real del efecto (defaults de alta).
    }, [open, firma, esEditar, clienteId, reset, setValue])

    // Catálogos de selectores (una vez).
    useEffect(() => {
        if (catalogoCargado.current) return
        catalogoCargado.current = true
        void Promise.all([
            listarMarcasComerciales(),
            listarTiposCliente(),
            listarListasPrecio(),
            listarCanalesVenta(),
            listarRutasCobro(),
            listarVendedores(),
            listarRegimenesFiscalesActivos(),
        ]).then(([m, t, l, c, r, v, rg]) => {
            const teno = (m.data ?? []).find((x) => x.clave === 'tenochtitlan')
            if (teno) marcaTenochtitlan.current = teno.id
            const publico = (t.data ?? []).find((x) => x.clave === 'PUBLICO')
            if (publico) tipoPublico.current = publico.id
            setMarcas((m.data ?? []).map((x) => ({ id: x.id, etiqueta: x.nombre_visible })))
            setTipos((t.data ?? []).map((x) => ({ id: x.id, etiqueta: x.nombre })))
            setListas((l.data ?? []).map((x) => ({ id: x.id, etiqueta: x.nombre })))
            setCanales((c.data ?? []).map((x) => ({ id: x.id, etiqueta: x.nombre })))
            setRutas((r.data ?? []).map((x) => ({ id: x.id, etiqueta: x.nombre })))
            setVendedores((v.data ?? []).map((x) => ({ id: x.id, etiqueta: x.nombre })))
            setRegimenes(rg.data ?? [])
        })
    }, [])

    // Rastreo de removidos (solo ids REALES): la grid emite la lista final; el padre
    // detecta qué filas con id persistido desaparecieron y las agrega a los diffs.
    const manejarDirecciones = (siguientes: DireccionFormData[]) => {
        setRemovidosDir((prev) => [
            ...prev,
            ...direcciones.filter((d) => d.id && !siguientes.some((s) => s.id === d.id)).map((d) => d.id),
        ])
        setDirecciones(siguientes)
    }
    const manejarContactos = (siguientes: ContactoFormData[]) => {
        setRemovidosCt((prev) => [
            ...prev,
            ...contactos.filter((c) => c.id && !siguientes.some((s) => s.id === c.id)).map((c) => c.id),
        ])
        setContactos(siguientes)
    }

    const enviar = handleSubmit(async (valores) => {
        setEnviando(true)
        setErrorServidor(null)
        try {
            if (esEditar && clienteId) {
                const res = await editarCliente(clienteId, {
                    ...valores,
                    removedDirecciones: removidosDir,
                    removedContactos: removidosCt,
                })
                if (!res.success) {
                    setErrorServidor(res.error ?? 'No se pudo guardar el cliente.')
                    return
                }
                toast.success('Cliente actualizado')
            } else {
                const res = await crearCliente(valores)
                if (!res.success) {
                    setErrorServidor(res.error ?? 'No se pudo crear el cliente.')
                    return
                }
                toast.success('Cliente creado')
            }
            onSuccess()
            onOpenChange(false)
        } finally {
            setEnviando(false)
        }
    })

    const renderError = (nombre: keyof ClienteFormData) => {
        const msg = errors[nombre]?.message
        return typeof msg === 'string' ? (
            <p className="text-xs font-medium text-destructive">{msg}</p>
        ) : null
    }

    const selectId = (opciones: OpcionUI[]) => (
        <SelectContent>
            <SelectItem value="__ninguno__">Sin asignar</SelectItem>
            {opciones.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                    {o.etiqueta}
                </SelectItem>
            ))}
        </SelectContent>
    )

    const seccion = (titulo: string, children: React.ReactNode) => (
        <section className="space-y-3 rounded-md border border-border/60 bg-surface/30 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
            {children}
        </section>
    )

    return (
        <Dialog open={open} onOpenChange={(o) => !enviando && !cargando && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {esEditar
                            ? `Editar cliente · ${codigoActual || ''}`
                            : 'Nuevo cliente'}
                    </DialogTitle>
                    <DialogDescription>
                        {esEditar
                            ? 'El código y el saldo inicial no cambian (D20).'
                            : 'El código CLT-#### se genera solo. Marca y tipo son obligatorios.'}
                    </DialogDescription>
                </DialogHeader>

                {cargando && (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando
                        cliente…
                    </div>
                )}
                {!cargando && errorServidor && (
                    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span>{errorServidor}</span>
                    </div>
                )}

                {!cargando && (
                    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
                        {esEditar && (
                            <p className="rounded-md border border-border/60 bg-surface/30 px-3 py-2 font-mono text-xs text-muted-foreground">
                                Código: {codigoActual || '—'} (no editable)
                            </p>
                        )}

                        {seccion('Identidad y comercial', (
                            <>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="nombre_comercial">Nombre comercial *</Label>
                                        <Input id="nombre_comercial" {...register('nombre_comercial')} disabled={enviando} autoFocus={!esEditar} />
                                        {renderError('nombre_comercial')}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tipo_persona">Tipo de persona</Label>
                                        <Controller
                                            control={control}
                                            name="tipo_persona"
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={(v) => { const valor = v as 'fisica' | 'moral'; field.onChange(valor); setTipoPersonaVigente(valor) }} disabled={enviando}>
                                                    <SelectTrigger id="tipo_persona"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="fisica">Física</SelectItem>
                                                        <SelectItem value="moral">Moral</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="razon_social">
                                        Razón social{' '}
                                        <span className="text-xs text-muted-foreground">
                                            {tipoPersonaVigente === 'moral' ? '(requerida)' : '(opcional)'}
                                        </span>
                                    </Label>
                                    <Input id="razon_social" {...register('razon_social')} disabled={enviando} placeholder="Opcional si persona física · requerida si persona moral" />
                                    {renderError('razon_social')}
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {(
                                        [
                                            ['id_marca_comercial', 'Marca *', marcas],
                                            ['id_tipo_cliente', 'Tipo de cliente *', tipos],
                                            ['id_lista_precio', 'Lista de precios *', listas],
                                        ] as const
                                    ).map(([campo, etiqueta, opciones]) => (
                                        <div key={campo} className="space-y-2">
                                            <Label htmlFor={campo}>{etiqueta}</Label>
                                            <Controller
                                                control={control}
                                                name={campo}
                                                render={({ field }) => (
                                                    <Select value={field.value || '__ninguno__'} onValueChange={(v) => field.onChange(v === '__ninguno__' ? '' : v)} disabled={enviando}>
                                                        <SelectTrigger id={campo}><SelectValue placeholder="Elige…" /></SelectTrigger>
                                                        {selectId(opciones)}
                                                    </Select>
                                                )}
                                            />
                                            {renderError(campo as keyof ClienteFormData)}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {(
                                        [
                                            ['id_canal_venta', 'Canal de venta', canales],
                                            ['id_ruta_cobro', 'Ruta de cobro', rutas],
                                            ['id_vendedor_asignado', 'Vendedor (cartera)', vendedores],
                                        ] as const
                                    ).map(([campo, etiqueta, opciones]) => (
                                        <div key={campo} className="space-y-2">
                                            <Label htmlFor={campo}>{etiqueta}</Label>
                                            <Controller
                                                control={control}
                                                name={campo}
                                                render={({ field }) => (
                                                    <Select value={field.value || '__ninguno__'} onValueChange={(v) => field.onChange(v === '__ninguno__' ? '' : v)} disabled={enviando}>
                                                        <SelectTrigger id={campo}><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                                                        {selectId(opciones)}
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ))}

                        {seccion('Crédito', (
                            <>
                                <div className="flex items-center gap-3">
                                    <Label htmlFor="tiene_credito" className="flex-1">Cliente con crédito</Label>
                                    <Controller
                                        control={control}
                                        name="tiene_credito"
                                        render={({ field }) => (
                                            <Switch id="tiene_credito" checked={field.value} onCheckedChange={(v) => { field.onChange(v); setTieneCredito(v) }} disabled={enviando} />
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="limite_credito">Límite {tieneCredito ? '*' : ''}</Label>
                                        <Input id="limite_credito" {...register('limite_credito')} type="number" inputMode="decimal" min={0} step="0.01" disabled={enviando || !tieneCredito} placeholder={tieneCredito ? '50000' : '—'} />
                                        {renderError('limite_credito')}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="dias_credito">Días {tieneCredito ? '*' : ''}</Label>
                                        <Input id="dias_credito" {...register('dias_credito')} type="number" min={1} disabled={enviando || !tieneCredito} placeholder={tieneCredito ? '30' : '—'} />
                                        {renderError('dias_credito')}
                                    </div>
                                    {!esEditar && (
                                        <div className="space-y-2">
                                            <Label htmlFor="saldo_inicial">
                                                Saldo inicial{' '}
                                                <span className="text-xs text-muted-foreground">(solo al alta)</span>
                                            </Label>
                                            <Input id="saldo_inicial" {...register('saldo_inicial')} type="number" step="0.01" disabled={enviando || !tieneCredito} placeholder={tieneCredito ? '0' : '—'} />
                                            {renderError('saldo_inicial')}
                                        </div>
                                    )}
                                </div>
                            </>
                        ))}

                        {seccion('Fiscal', (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="rfc">
                                        RFC{' '}
                                        <span className="text-xs text-muted-foreground">{tieneRfc ? '(régimen requerido)' : '(opcional)'}</span>
                                    </Label>
                                    <Input id="rfc" {...registroRfc} onChange={(e) => { registroRfc.onChange(e); setRfcVigente(e.target.value) }} placeholder="RAM840101XXX" className="font-mono uppercase" disabled={enviando} maxLength={13} />
                                    {renderError('rfc')}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="id_regimen_fiscal">Régimen fiscal</Label>
                                    <Controller
                                        control={control}
                                        name="id_regimen_fiscal"
                                        render={({ field }) => (
                                            <Select value={field.value || '__ninguno__'} onValueChange={(v) => field.onChange(v === '__ninguno__' ? '' : v)} disabled={enviando}>
                                                <SelectTrigger id="id_regimen_fiscal"><SelectValue placeholder="Sin régimen" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__ninguno__">Sin régimen</SelectItem>
                                                    {regimenes.map((r) => (
                                                        <SelectItem key={r.id} value={r.id}>{r.clave} · {r.descripcion}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {renderError('id_regimen_fiscal')}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="id_uso_cfdi">Uso de CFDI</Label>
                                    <Controller
                                        control={control}
                                        name="id_uso_cfdi"
                                        render={({ field }) => (
                                            <Select value={field.value || '__ninguno__'} onValueChange={(v) => field.onChange(v === '__ninguno__' ? '' : v)} disabled={enviando}>
                                                <SelectTrigger id="id_uso_cfdi"><SelectValue placeholder="(V2)" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__ninguno__">Sin uso (V2)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                        ))}

                        <DireccionesGrid rows={direcciones} onChange={manejarDirecciones} deshabilitado={enviando} />
                        <ContactosGrid rows={contactos} onChange={manejarContactos} deshabilitado={enviando} />

                        {seccion('Notas', (
                            <Textarea id="notas" {...register('notas')} rows={3} disabled={enviando} placeholder="Referencias, acuerdos, horarios…" />
                        ))}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={enviando} className={cn(enviando && 'opacity-80')}>
                                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                {esEditar ? 'Guardar cambios' : 'Crear cliente'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}

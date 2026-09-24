// ═══════════════════════════════════════════════════════════════════════════════════
// DOMICILIO FIELDS — Bloque de domicilio compartido (Guía 0.8 · Parte 7 · PROMOCIÓN 03 Sep 2026)
//
// PROMOCIÓN 03 Sep 2026 — la pidió la Guía 1.1 (CRUD Proveedores) y la consumirá además
// la Guía 1.3 (CRUD Clientes): paridad literal de captura de domicilio entre ambos
// catálogos (MODELO_DATOS §7.1/§7.2 — "los dos catálogos se capturan igual y comparten
// los componentes de domicilio").
//
// Los 5 campos son espejo literal de las columnas de BD (direccion · colonia · ciudad ·
// estado · codigo_postal) — nombres en snake_case = contrato de columna (regla del
// proyecto: los nombres de campo de la BD son contratos literales).
//
// Componente dumb acoplado a react-hook-form (convención §6 del proyecto): recibe
// `register` y `errors` del useForm padre — sin estado propio, sin lógica de negocio.
// La validación (CP de 5 dígitos, requeridos) vive en el zod del consumidor; aquí solo
// presentación. `cpFiscal` marca el C.P. con el SelloFiscal (domicilio fiscal CFDI 4.0 —
// la exigencia de captura la resuelve el CRUD, fuera del componente).
// ═══════════════════════════════════════════════════════════════════════════════════

import type { FieldErrors, Path, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { SelloFiscal } from '@/components/form'

/** Forma del bloque de domicilio compartido (espejo de columnas clientes/proveedores). */
export interface DomicilioFormData {
    direccion?: string
    colonia?: string
    ciudad?: string
    estado?: string
    codigo_postal?: string
}

export type CampoDomicilio = keyof DomicilioFormData

interface ConfigCampo {
    campo: CampoDomicilio
    etiqueta: string
    placeholder: string
    /** Ocupa todo el ancho de la grilla (default: media columna). */
    anchoCompleto?: boolean
    maxLength?: number
    inputMode?: 'text' | 'numeric'
}

const CAMPOS: ConfigCampo[] = [
    {
        campo: 'direccion',
        etiqueta: 'Calle y número',
        placeholder: 'Calle, número y referencias',
        anchoCompleto: true,
    },
    { campo: 'colonia', etiqueta: 'Colonia', placeholder: 'Colonia o fraccionamiento' },
    { campo: 'ciudad', etiqueta: 'Ciudad', placeholder: 'Ciudad' },
    { campo: 'estado', etiqueta: 'Estado', placeholder: 'Estado' },
    {
        campo: 'codigo_postal',
        etiqueta: 'Código postal',
        placeholder: '00000',
        maxLength: 5,
        inputMode: 'numeric',
    },
]

interface DomicilioFieldsProps<T extends DomicilioFormData> {
    /** `register` del useForm padre (react-hook-form). */
    register: UseFormRegister<T>
    /** `errors` del useForm padre (mensajes de zod ya resueltos). */
    errors?: FieldErrors<T>
    /** true → el C.P. es el del domicilio fiscal: muestra el SelloFiscal junto al label. */
    cpFiscal?: boolean
    /** Deshabilita los 5 campos (lectura). */
    deshabilitado?: boolean
    /** Prefijo de ids — evita colisiones si hay más de un bloque en la pantalla. */
    idBase?: string
}

export function DomicilioFields<T extends DomicilioFormData>({
    register,
    errors,
    cpFiscal = false,
    deshabilitado = false,
    idBase = 'domicilio',
}: DomicilioFieldsProps<T>) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAMPOS.map(({ campo, etiqueta, placeholder, anchoCompleto, maxLength, inputMode }) => {
                const id = `${idBase}-${campo}`
                // `errors` llega tipado contra T (superset del formulario del consumidor);
                // los 5 campos del bloque existen por la constraint T extends DomicilioFormData.
                const errorCampo = (errors as unknown as
                    | FieldErrors<DomicilioFormData>
                    | undefined)?.[campo]
                const mensajeError =
                    typeof errorCampo?.message === 'string' ? errorCampo.message : undefined
                return (
                    <div
                        key={campo}
                        className={cn('space-y-1.5', anchoCompleto && 'sm:col-span-2')}
                    >
                        <div className="flex items-center gap-1.5">
                            <Label htmlFor={id} className="text-[13px]">
                                {etiqueta}
                            </Label>
                            {cpFiscal && campo === 'codigo_postal' && <SelloFiscal />}
                        </div>
                        <Input
                            id={id}
                            {...register(campo as Path<T>)}
                            placeholder={placeholder}
                            maxLength={maxLength}
                            inputMode={inputMode}
                            disabled={deshabilitado}
                            aria-invalid={Boolean(mensajeError)}
                            aria-describedby={mensajeError ? `${id}-error` : undefined}
                        />
                        {mensajeError ? (
                            <p id={`${id}-error`} className="text-xs font-medium text-destructive">
                                {mensajeError}
                            </p>
                        ) : cpFiscal && campo === 'codigo_postal' ? (
                            <p className="text-[11px] leading-snug text-muted-foreground">
                                C.P. del domicilio fiscal — CFDI 4.0 lo valida contra el SAT.
                            </p>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}

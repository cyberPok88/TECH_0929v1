'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONES DE LA PLANTILLA — historial + restaurar (Guía 2.1 · P5 · Smart)
//
// La RED DE SEGURIDAD del carril: «una plantilla rota rompe un documento con valor;
// necesita versiones y "restaurar"» (SISTEMA_IMPRESION §3).
//
// ⭐ Restaurar NO borra: `restaurarVersion` COPIA el cuerpo/variables de la versión
// elegida a la plantilla, y el trigger `fn_plantillas_versionar()` archiva el estado
// actual y sube la versión. El historial no se acorta: CRECE. Restaurar es editar,
// con el contenido de ayer.
//
// ⚠️ `plantillas_documento_versiones` es APPEND-ONLY en la BD: `REVOKE ALL` + solo
// `GRANT SELECT` (verificado en la Fase 3). Un botón de «borrar versión» fallaría en
// la BD, no en la UI — y el historial no se poda: es la garantía del «restaurar».
//
// SMART: hace fetch y ejecuta una Server Action (SISTEMA_COMPONENTES §4). La anatomía
// lo etiquetó Dumb y se corrigió: «disparar restaurar» es llamar una acción.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/data-table'
import { listarVersiones, restaurarVersion } from '@/lib/actions/plantillas'
import { formatearFechaPlantilla } from '@/components/sistema/plantillas/columnas-plantilla'
import type { VersionPlantilla } from '@/types/plantillas'

interface VersionesSubModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    idPlantilla: string
    /** La versión VIGENTE (vive en `plantillas_documento.version`, NO en el historial). */
    versionActual: number
    /** Se dispara tras restaurar: el editor recarga la plantilla. */
    onRestaurada?: () => void
}

export function VersionesSubModal({
    open,
    onOpenChange,
    idPlantilla,
    versionActual,
    onRestaurada,
}: VersionesSubModalProps) {
    const [versiones, setVersiones] = useState<VersionPlantilla[]>([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [porRestaurar, setPorRestaurar] = useState<VersionPlantilla | null>(null)
    const [restaurando, setRestaurando] = useState(false)

    const obtener = useCallback(async () => {
        return listarVersiones(idPlantilla)
    }, [idPlantilla])

    // Carga al abrir. ⚠️ Sin setState SÍNCRONO en el cuerpo del efecto: el
    // `setCargando(true)` va en el HANDLER de apertura del padre… que aquí no existe,
    // así que el estado inicial ya es `true` y solo se apaga en el .then().
    useEffect(() => {
        if (!open) return
        let activo = true
        obtener().then((res) => {
            if (!activo) return
            if (!res.success) {
                setError(res.error ?? 'No se pudo cargar el historial.')
                setCargando(false)
                return
            }
            setVersiones(res.data ?? [])
            setError(null)
            setCargando(false)
        })
        return () => {
            activo = false
        }
    }, [open, obtener])

    const ejecutarRestaurar = async (): Promise<{ error: string | null }> => {
        if (!porRestaurar) return { error: null }
        setRestaurando(true)
        try {
            const res = await restaurarVersion(idPlantilla, porRestaurar.version)
            if (!res.success) return { error: res.error ?? 'No se pudo restaurar la versión.' }
            toast.success(`Restaurada la versión ${porRestaurar.version}`)
            setPorRestaurar(null)
            // ⭐ Restaurar CREA una versión nueva (la del estado reemplazado): hay que releer.
            const frescas = await obtener()
            if (frescas.success) setVersiones(frescas.data ?? [])
            onRestaurada?.()
            return { error: null }
        } finally {
            setRestaurando(false)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Versiones de la plantilla</DialogTitle>
                        <DialogDescription>
                            Cada cambio del cuerpo o de las variables archiva la versión anterior. Restaurar
                            vuelve a ese contenido y crea una versión nueva — el historial nunca se acorta.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Versión vigente — NO está en el historial: vive en la plantilla. */}
                    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2">
                        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm">
                            Versión vigente:{' '}
                            <span className="font-mono tabular-nums">v{versionActual}</span>
                        </span>
                    </div>

                    {cargando ? (
                        <div className="flex justify-center py-8">
                            <Spinner />
                        </div>
                    ) : error ? (
                        <p className="py-6 text-center text-sm text-destructive">{error}</p>
                    ) : versiones.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            Sin versiones anteriores. El historial nace en el primer cambio del cuerpo.
                        </p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-border">
                            {versiones.map((v) => (
                                <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                                    <div className="flex min-w-0 flex-col">
                                        <span className="font-mono text-[13px] tabular-nums">
                                            v{v.version}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatearFechaPlantilla(v.created_at)}
                                            {v.notas_version ? ` · ${v.notas_version}` : ''}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPorRestaurar(v)}
                                        disabled={restaurando}
                                        className="gap-1.5"
                                    >
                                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                        Restaurar
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>

            {/* Confirmación: nombra las DOS versiones — la que se aplica y sobre la que se aplica. */}
            <ConfirmDialog
                open={porRestaurar !== null}
                onOpenChange={(o) => {
                    if (!o) setPorRestaurar(null)
                }}
                titulo={`Restaurar la versión ${porRestaurar?.version ?? ''}`}
                descripcion={
                    porRestaurar
                        ? `El cuerpo y las variables de la v${porRestaurar.version} reemplazarán a la v${versionActual} vigente. El contenido que se reemplaza queda archivado como una versión nueva, así que la operación se puede deshacer.`
                        : ''
                }
                confirmLabel="Restaurar"
                isLoading={restaurando}
                onConfirm={ejecutarRestaurar}
            />
        </>
    )
}

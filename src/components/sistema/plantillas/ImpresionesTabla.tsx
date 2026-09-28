'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AUDITORÍA DE IMPRESIONES — el registro del papel con valor (Guía 2.1 · P8 · Smart)
//
// La superficie 8: QUIÉN imprimió QUÉ versión y CUÁNDO. Es de SOLO LECTURA, así que no
// ofrece ninguna acción: ni en la toolbar ni en una columna de acciones.
//
// ⭐ Se audita SOLO el papel con valor (familia `valor`, decisión 10 de P0): un acto
// interno (una DEV, una requisición) se imprime sin dejar rastro, porque no sale de la
// empresa. El gate vive en la BD (`fn_impresiones_solo_valor()`), no aquí — por eso
// esta pantalla EXPLICA el caso interno en vez de esconder el tipo del selector.
//
// ⭐ `creado_por` guarda un UUID SIN llave foránea, a propósito: la bitácora tiene que
// sobrevivir a que el usuario se borre. El nombre se resuelve con el lector que el kit
// de catálogos ya usa para los cobradores (`listarUsuariosActivos`), no con un lector
// nuevo. Si el usuario ya no está activo, ese lector no lo devuelve y la celda muestra
// el id corto: preferimos un dato crudo a un nombre inventado.
//
// ⭐ El tipo se elige con un `Select` y NO con la barra de filtros del módulo: la
// auditoría mira UN tipo por vez, y la acción recibe la clave, no filtros.
//
// SMART: hace fetch y nada más (SISTEMA_COMPONENTES §4).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { formatearFechaPlantilla } from '@/components/sistema/plantillas/columnas-plantilla'
import { usePageConfig } from '@/hooks/usePageConfig'
import { listarUsuariosActivos } from '@/lib/actions/catalogos'
import { listarImpresiones, listarTiposDocumento } from '@/lib/actions/plantillas'
import type { FiltrosTiposDocumento, ImpresionDocumento, TipoDocumento } from '@/types/plantillas'

const RUTA = '/dashboard/sistema/plantillas'

// El inventario COMPLETO (activos + inactivos): desactivar un tipo no borra su
// auditoría — el papel que ya salió sigue siendo auditable.
const TODOS_LOS_TIPOS: FiltrosTiposDocumento = { busqueda: '', familia: '', esActivo: '' }

export function ImpresionesTabla() {
    const [tipos, setTipos] = useState<TipoDocumento[]>([])
    const [nombres, setNombres] = useState<Record<string, string>>({})
    const [clave, setClave] = useState('')
    const [filas, setFilas] = useState<ImpresionDocumento[]>([])
    const [estado, setEstado] = useState<EstadoTabla>('loading')

    // Carga única: el inventario de tipos y los nombres de quienes imprimen.
    // ⚠️ Sin setState SÍNCRONO en el cuerpo del efecto (react-hooks/set-state-in-effect):
    //    todo se resuelve dentro del .then().
    useEffect(() => {
        let activo = true
        Promise.all([listarTiposDocumento(TODOS_LOS_TIPOS), listarUsuariosActivos()]).then(
            ([resTipos, resUsuarios]) => {
                if (!activo) return
                if (!resTipos.success) {
                    setEstado('error')
                    return
                }
                const lista = resTipos.data ?? []
                setTipos(lista)

                if (resUsuarios.success) {
                    const mapa: Record<string, string> = {}
                    for (const u of resUsuarios.data) mapa[u.id] = u.nombre
                    setNombres(mapa)
                }

                // Se abre en un tipo que SÍ audita: arrancar en uno interno mostraría una
                // tabla vacía y parecería un error de la pantalla.
                const conAuditoria = lista.find((t) => t.audita_reimpresion && t.es_activo)
                if (conAuditoria) setClave(conAuditoria.clave)
                else setEstado('idle')
            }
        )
        return () => {
            activo = false
        }
    }, [])

    // Fetch puro: NO setea estado (lo consumen el efecto y el reintento de la tabla).
    const obtener = useCallback(async () => listarImpresiones(clave), [clave])

    // La tabla sigue al tipo elegido.
    useEffect(() => {
        if (!clave) return
        let activo = true
        obtener().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstado('error')
                return
            }
            setFilas(res.data ?? [])
            setEstado('idle')
        })
        return () => {
            activo = false
        }
    }, [clave, obtener])

    const recargar = useCallback(async () => {
        if (!clave) return
        const res = await obtener()
        if (!res.success) {
            setEstado('error')
            return
        }
        setFilas(res.data ?? [])
        setEstado('idle')
    }, [clave, obtener])

    const tipoElegido = useMemo(() => tipos.find((t) => t.clave === clave) ?? null, [tipos, clave])
    const esInterno = tipoElegido !== null && !tipoElegido.audita_reimpresion

    // Única llamadora: esta pestaña montada. Sin acciones — una bitácora no se toca.
    usePageConfig({
        info: { title: 'Plantillas', subtitle: 'Auditoría' },
        path: RUTA,
    })

    // ── Columnas (checklist de consumo 0.8: label · movil · align) ─────────────
    const columnas = useMemo<
        (ColumnDef<ImpresionDocumento> & ColumnDefExtension<ImpresionDocumento>)[]
    >(
        () => [
            {
                accessorKey: 'created_at',
                label: 'Impreso',
                movil: 'critica',
                render: (value) => (
                    <span className="tabular-nums">{formatearFechaPlantilla(String(value))}</span>
                ),
            },
            {
                accessorKey: 'version',
                label: 'Versión',
                movil: 'secundaria',
                // `—` = se imprimió desde el respaldo en código: no había plantilla que citar.
                render: (value) => (
                    <span className="font-mono text-[13px] tabular-nums">
                        {value === null ? '—' : `v${String(value)}`}
                    </span>
                ),
            },
            {
                id: 'usuario',
                accessorFn: (row) => row.creado_por,
                label: 'Usuario',
                movil: 'critica',
                render: (value) => {
                    const id = value === null ? '' : String(value)
                    const nombre = nombres[id]
                    if (nombre) return <span>{nombre}</span>
                    // Sin llave foránea a propósito: si el usuario se desactivó, el nombre ya
                    // no viene en la lista y el id es el único dato que no miente.
                    return (
                        <span
                            className="font-mono text-[13px] text-muted-foreground"
                            title={id ? `Usuario ${id}` : 'Sin usuario registrado'}
                        >
                            {id ? `#${id.slice(0, 8)}` : '—'}
                        </span>
                    )
                },
            },
        ],
        [nombres]
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                {/* El tipo se elige aquí porque la acción recibe UNA clave. */}
                <Select
                    value={clave}
                    onValueChange={(v) => {
                        // El 'loading' se marca en el HANDLER (evento), nunca en el efecto.
                        setEstado('loading')
                        setFilas([])
                        setClave(v)
                    }}
                >
                    <SelectTrigger className="w-72" aria-label="Tipo de documento a auditar">
                        <SelectValue placeholder="Elegí un tipo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                        {tipos.map((t) => (
                            <SelectItem key={t.id} value={t.clave}>
                                {t.nombre}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <p className="text-sm text-muted-foreground">
                    {esInterno
                        ? 'Este tipo es un acto interno: no sale de la empresa, así que su impresión no se audita.'
                        : 'Quién imprimió cada versión. Reimprimir no cambia el folio: suma un registro.'}
                </p>
            </div>

            <DataTable<ImpresionDocumento>
                columns={columnas}
                data={filas}
                rowKey={(r) => r.id}
                estado={estado}
                emptyMessage={
                    esInterno
                        ? 'Los actos internos no dejan registro de impresión'
                        : 'Sin impresiones registradas para este tipo'
                }
                onRetry={() => {
                    setEstado('loading')
                    void recargar()
                }}
            />
        </div>
    )
}

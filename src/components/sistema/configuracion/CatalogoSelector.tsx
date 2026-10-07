'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOGO SELECTOR — la OPCIÓN C del paquete «Catálogos» (Guía 2.4 · 05 Oct 2026)
//
// El paquete «Catálogos» NO puede traducirse a una lista fija de tablas como los
// otros 10: el esquema **no distingue** una fila de semilla de una que cargó el
// usuario. Medido: `marcas_producto` (7) y `categorias_producto` (18) son semilla de
// migración; `ubicaciones_almacen` no tiene semilla. Una regla automática borraría
// semilla.
//
// ⭐ LA DECISIÓN DEL DUEÑO (opción C): **el humano tilda las filas.** Por eso la UI
//   las LISTA —con nombre, FECHA DE ALTA y USOS— y el componente devuelve **ids**.
//
// ⚠️ La fecha de alta es información de DECISIÓN: es lo único que separa lo que sembró
//    una migración (03-04 Sep 2026) de lo que cargó el dueño.
// ⚠️ Los USOS avisan la consecuencia: para marcas y categorías la FK a productos es
//    `SET NULL` ⇒ borrar NO falla, deja los productos sin marca. Para `ubicaciones`
//    con conteos, la FK es RESTRICT ⇒ el borrado FALLA (y la RPC lo dice).
// ⚠️ NO borra: devuelve los ids al padre, para que entren en LA MISMA transacción que
//    los otros paquetes.
// ═══════════════════════════════════════════════════════════════════════════════

import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { NOMBRE_TABLA_CATALOGO, TABLAS_CATALOGO, type FilaCatalogo, type TablaCatalogo } from '@/types/configuracion'

interface CatalogoSelectorProps {
    /** Las filas ya cargadas, por tabla. Si falta una clave, todavía no se cargó. */
    filas: Partial<Record<TablaCatalogo | 'roles', FilaCatalogo[]>>
    /** Los ids tildados, por tabla. */
    tildadas: Record<string, string[]>
    onTildar: (tabla: string, id: string, valor: boolean) => void
    /** `true` mientras alguna tabla está cargando. */
    cargando?: boolean
}

export function CatalogoSelector({ filas, tildadas, onTildar, cargando }: CatalogoSelectorProps) {
    if (cargando) {
        return (
            <p className="flex items-center gap-2 px-4 py-3 text-[11.5px] text-muted-foreground">
                <Spinner className="size-3.5" /> Leyendo los catálogos…
            </p>
        )
    }

    return (
        <div className="space-y-3 px-4 py-3">
            {TABLAS_CATALOGO.map((tabla) => {
                const lista = filas[tabla] ?? []
                return (
                    <div key={tabla}>
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {NOMBRE_TABLA_CATALOGO[tabla]} · {lista.length}
                        </p>
                        {lista.length === 0 ? (
                            <p className="text-[11.5px] text-muted-foreground/70">No hay filas.</p>
                        ) : (
                            lista.map((f) => {
                                const id = `cat-${tabla}-${f.id}`
                                const marcada = (tildadas[tabla] ?? []).includes(f.id)
                                return (
                                    <div key={f.id} className="flex items-start gap-2.5 py-1">
                                        <Checkbox
                                            id={id}
                                            checked={marcada}
                                            onCheckedChange={(v) => onTildar(tabla, f.id, v === true)}
                                            className="mt-0.5"
                                        />
                                        <label htmlFor={id} className="min-w-0 cursor-pointer text-[12px] leading-snug">
                                            <span className="block truncate">{f.nombre}</span>
                                            <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                                                {f.created_at ? `alta ${f.created_at.slice(0, 10)} · ` : ''}
                                                <span className={cn(f.usos > 0 && 'text-warning')}>
                                                    {f.usos} uso{f.usos === 1 ? '' : 's'}
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )
            })}

            {/* Los roles van en el mismo selector: mismo mecanismo, misma transacción. */}
            <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Roles no-sistema · {(filas.roles ?? []).length}
                </p>
                {(filas.roles ?? []).length === 0 ? (
                    <p className="text-[11.5px] text-muted-foreground/70">No hay roles propios.</p>
                ) : (
                    (filas.roles ?? []).map((r) => {
                        const id = `rol-${r.id}`
                        const marcada = (tildadas.roles ?? []).includes(r.id)
                        const enUso = r.usos > 0
                        return (
                            <div key={r.id} className="flex items-start gap-2.5 py-1">
                                <Checkbox
                                    id={id}
                                    checked={marcada}
                                    // Un rol con usuarios NO se puede borrar (RESTRICT): se deshabilita
                                    // en vez de dejar que el usuario lo marque y falle después.
                                    disabled={enUso}
                                    onCheckedChange={(v) => onTildar('roles', r.id, v === true)}
                                    className="mt-0.5"
                                />
                                <label
                                    htmlFor={id}
                                    className={cn(
                                        'min-w-0 cursor-pointer text-[12px] leading-snug',
                                        enUso && 'cursor-not-allowed text-muted-foreground'
                                    )}
                                >
                                    <span className="block font-mono">{r.nombre}</span>
                                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                        {enUso
                                            ? `${r.usos} usuario(s) lo tienen: no se puede borrar`
                                            : 'sin usuarios asignados'}
                                    </span>
                                </label>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

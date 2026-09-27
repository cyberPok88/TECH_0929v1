"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// CREAR COLUMNA DE ACCIONES — Guía 0.8 · ⭐ PROMOCIÓN 02 Sep 2026 (Decisión 20)
// Factory genérica de la columna de acciones por fila: encabezado "Acciones",
// sticky derecha, no ocultable.
//
// ⭐ MEJORA 24 Sep 2026 (usuario) — **LA DECISIÓN DEL 20 SEP CAMBIA, a propósito.**
// El 20 Sep se pasaron TODAS las acciones a inline («ya no hay dropdown ⋮»). Con las tablas
// del flujo de Entradas cargadas de columnas, el resultado se vio **amontonado**: hasta 5
// iconos por fila compitiendo con las píldoras de estado. Ahora:
//   · `acciones` (PRIMARIAS) siguen **inline** — la que más se usa queda a un clic;
//   · `secundarias` vuelven al **menú ⋮** — la fila baja a 2 controles.
// La API **no cambia**: los CRUDs que ya declaran `acciones`/`secundarias` no se tocan (eran
// 11 tablas: Proveedores · Productos · Clientes · Usuarios · Roles · Notas de compra ·
// Recepción · Revisión · Existencias · Inventario físico · Pruebas).
//
// ⚠️ El kit **difiere la apertura de las secundarias 160 ms**, y eso es deliberado: casi todas
// abren un Dialog, y Radix deja su **overlay fantasma** (página «congelada») cuando el Dialog
// abre en el MISMO tick en que cierra el menú. Centralizarlo aquí evita que cada CRUD tenga que
// acordarse — el workaround vivía copiado en `NotasCompraCatalogo` (FIX VF 05 Sep).
// La 0.8 renderiza; el RBAC lo envuelve el CRUD (ProtectedAction/useCanAction — 0.7).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ColumnDef } from "@tanstack/react-table"
import { MoreVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ColumnDefExtension, RowAction } from "@/types/table"

/** Abrir un Dialog en el mismo tick en que cierra el menú deja el overlay fantasma de Radix. */
const APERTURA_DIFERIDA_MS = 160

interface CrearColumnaAccionesProps<TData = unknown> {
    /** Acciones primarias — **iconos inline** (Eye, Pencil, Archive…).
     *  El CRUD envuelve cada onClick con ProtectedAction/useCanAction (0.7). */
    acciones: RowAction<TData>[]
    /** Acciones secundarias — ⭐ 23 Sep 2026: van al **menú ⋮** (el 20 Sep iban inline). */
    secundarias?: RowAction<TData>[]
    /** Etiqueta del encabezado (default: "Acciones") */
    label?: string
}

export function crearColumnaAcciones<TData = unknown>({
    acciones,
    secundarias,
    label = "Acciones",
}: CrearColumnaAccionesProps<TData>): ColumnDef<TData> & ColumnDefExtension<TData> {
    return {
        id: "acciones",
        header: label,
        // Contrato: nunca ocultable · centrada · sticky derecha (R1)
        visible: false,
        align: "centro",
        fijaDerecha: true,
        cell: ({ row }) => {
            // ⭐ ANEXIÓN 02 Sep 2026 — disabled puede ser predicado por fila
            // (patrón "no te operes a ti mismo" de la Guía 0.9).
            const deshabilitada = (accion: RowAction<TData>): boolean =>
                typeof accion.disabled === "function"
                    ? accion.disabled(row.original)
                    : accion.disabled ?? false

            const haySecundarias = (secundarias?.length ?? 0) > 0

            // ⚠️ DESCARTADO 24 Sep 2026 (usuario): aquí vivió una rama `modoTactil` que pintaba las
            // secundarias como BOTONES CON ETIQUETA en la fila (ley L11). En Recepción el resultado
            // fue «filas muy grandes, ya no parece tabla» → se retiró: la densidad de la tabla manda
            // y el eje táctil del kit (`modoTactil` en el DataTable, que usa Revisión) sigue vivo
            // para un puesto que se opere con el dedo.
            return (
                <div className="flex items-center justify-center gap-0.5">
                    {acciones.map((accion) => (
                        <Button
                            key={accion.label}
                            variant={accion.variant ?? "ghost"}
                            size="icon"
                            onClick={() => accion.onClick(row.original)}
                            disabled={deshabilitada(accion)}
                            title={accion.label}
                            aria-label={accion.label}
                            data-accion={accion.dataAccion}
                            // R3: objetivo táctil ≥44px en <768px (Ley 5), denso en escritorio
                            className="h-11 w-11 md:h-8 md:w-8"
                        >
                            <accion.icon className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    ))}

                    {haySecundarias && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Más acciones"
                                    aria-label="Más acciones"
                                    data-accion="mas-acciones"
                                    className="h-11 w-11 md:h-8 md:w-8"
                                >
                                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                {secundarias?.map((accion) => (
                                    <DropdownMenuItem
                                        key={accion.label}
                                        disabled={deshabilitada(accion)}
                                        data-accion={accion.dataAccion}
                                        onSelect={() =>
                                            window.setTimeout(
                                                () => accion.onClick(row.original),
                                                APERTURA_DIFERIDA_MS
                                            )
                                        }
                                        className={cn(
                                            accion.variant === "destructive" &&
                                                "text-destructive focus:text-destructive"
                                        )}
                                    >
                                        <accion.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                                        {accion.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )
        },
    }
}

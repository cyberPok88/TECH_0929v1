'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// BORRADO TOTAL — el botón aparte (Guía 2.4 · 05 Oct 2026)
//
// ⚠️ ES EL BOTÓN QUE VACÍA LA EMPRESA DE UN CLIC. Dos cosas que NO se "mejoran":
//   · agregarle un respaldo — el dueño aceptó la irreversibilidad (D5, decisión
//     explícita e informada);
//   · meterlo DENTRO del panel de casillas — D13 lo quiere APARTE, justamente para
//     que no se apriete por inercia después de marcar dos paquetes.
//
// ⭐ E6: NO comparte estado con las casillas. No recibe `marcados`. Si lo compartiera,
//   marcar un paquete "prepararía" el borrado total — dos mecánicas contaminadas.
//
// 🔑 EL DETALLE QUE CASI SE PASA: los paquetes `catalogos` y `sistema` se borran POR IDS
//   DE FILA (opción C: el humano tilda). Un borrado total que mandara solo los ids de
//   paquete SALTARÍA EN SILENCIO los catálogos y los roles. ⇒ El borrado total es
//   "tildar TODAS las filas": se piden los ids y se mandan. Mismo mecanismo, sin caso
//   especial en la RPC.
//
// ⚠️ Y de ahí sale la condición dura: un rol CON USUARIOS no se puede borrar
//   (`usuarios.id_rol` es RESTRICT). Si se incluyera, la transacción ENTERA fallaría y
//   el botón no borraría NADA. Por eso se excluyen los roles en uso.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Flame } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { borrarDatosAction, listarCatalogoAction, listarRolesBorrablesAction } from '@/lib/actions/configuracion'
import { PAQUETES, TABLAS_CATALOGO, type SeleccionFilas } from '@/types/configuracion'

interface BorradoTotalProps {
    /** El total de filas de los 11 paquetes, ya contado por el modal. Solo para el aviso. */
    totalFilas: number
    /** Se llama tras un borrado exitoso: el modal **vuelve a contar**. */
    onEjecutado: () => void
}

export function BorradoTotal({ totalFilas, onEjecutado }: BorradoTotalProps) {
    const [confirmando, setConfirmando] = useState(false)

    const ejecutar = async (): Promise<{ error: string | null }> => {
        // "Tildar TODAS las filas": los catálogos y los roles van por ids, como si el
        // humano los hubiera marcado uno por uno.
        const seleccion: SeleccionFilas = {}
        for (const tabla of TABLAS_CATALOGO) {
            const r = await listarCatalogoAction(tabla)
            seleccion[tabla] = r.success ? (r.data ?? []).map((f) => f.id) : []
        }
        const roles = await listarRolesBorrablesAction()
        // ⚠️ Solo los roles SIN usuarios: uno en uso hace fallar la transacción ENTERA.
        seleccion.roles = roles.success ? (roles.data ?? []).filter((f) => f.usos === 0).map((f) => f.id) : []

        const r = await borrarDatosAction({
            paquetes: [...PAQUETES],
            seleccion,
            reiniciarFolios: true,
        })
        if (!r.success) return { error: r.error ?? 'No se pudo borrar' }
        onEjecutado()
        return { error: null }
    }

    return (
        <>
            {/* Separado a propósito: borde y fondo propios, lejos de las casillas. */}
            <div className="rounded-lg border border-destructive/40 bg-destructive-bg/40 p-3.5">
                <div className="flex items-start gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
                        <Flame className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="font-display text-[13px] font-semibold text-destructive">
                            Borrado total · dejar la app como nueva
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                            Borra <b>los 11 grupos</b> ({totalFilas} filas) y <b>reinicia los
                            folios a 0</b>. No toca usuarios, roles del sistema, catálogos de
                            semilla, la empresa emisora ni las plantillas. Los roles que tengan
                            usuarios asignados <b>no se borran</b> (y por eso quedan).
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setConfirmando(true)}
                    >
                        Borrar todo
                    </Button>
                </div>
            </div>

            <ConfirmarAccionDialog
                open={confirmando}
                titulo="¿Borrar TODO y reiniciar los folios?"
                descripcion={`Se van a borrar ${totalFilas} filas de los 11 grupos: Entradas, Compras, Inventario, Productos, Catálogos, Proveedores, Clientes, Ventas, Cobranza, Tesorería y Sistema.`}
                detalle="No se puede deshacer y no hay respaldo. Los folios vuelven a 0: un número que ya imprimiste puede repetirse."
                confirmLabel="Sí, borrar todo"
                variant="destructive"
                successMessage="Borrado total. El conteo se actualizó."
                onOpenChange={setConfirmando}
                onConfirm={ejecutar}
            />
        </>
    )
}

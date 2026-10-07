'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AUTORIZACION DIALOG — Guía 1.8 · Ventas (Parte 3 · BLOQUE 2)
//
// ⭐ MVP (02 Oct 2026) — ES UNA **CONFIRMACIÓN**, NO UNA AUTORIZACIÓN DE 2º NIVEL.
//
// **Un solo diálogo para CUATRO reglas:** las TRES PUERTAS de crédito (suspendido · moroso ·
// límite) y el PISO DE PRECIO. Cuatro diálogos distintos habrían duplicado el mismo acto.
//
// **Qué pasó, medido:** pedía `usuario` + `contrasena` + `motivo`… y **nadie verificaba esas
// credenciales** — ni el RPC ni el trigger. Peor: el trigger de las puertas
// (`fn_validar_venta_credito`, §B4.6 de `bd-ventas.md`) **NO miraba `aprobar`** y bloqueaba
// SIEMPRE ⇒ **ni un Administrador podía emitir a un moroso**: la autorización se pedía, se
// capturaba… y **la emisión moría igual** (VF-2 paso 2 era imposible).
//
// **Decisión del dueño (02 Oct 2026):** en el MVP la autorización de segundo nivel se reemplaza
// por **un botón de confirmación** — *«estás a punto de hacer esto, ¿ok?»*. La autorización real
// (credenciales verificadas + `aprobar`) vuelve en **V2, después del MVP**.
//
// **Qué hace ahora:** muestra **por qué** se bloqueó (el texto que devolvió el RPC) y pide
// confirmar. Al confirmar, el motivo viaja como `motivo_autorizacion` (el piso lo registra) y el
// RPC marca la transacción para que las tres puertas pasen (`g20_p4_c6_puertas_confirmacion_mvp`).
//
// ⚠️ **LIMITACIÓN DECLARADA DEL MVP:** una puerta destrabada por confirmación **NO deja rastro de
// quién** en la nota (no hay columna para eso). El piso **sí** deja el suyo. V2 lo repone.
//
// ⭐ **Y NO se inventó UI:** se reusa el `ConfirmarAccionDialog` del kit 0.8 — el mismo componente
// que el resto del proyecto usa para «confirmá esta acción».
// ═══════════════════════════════════════════════════════════════════════════════

import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'

/** El acto confirmado. En el MVP alcanza con el MOTIVO: no hay credenciales que registrar. */
export interface ActoAutorizacion {
    motivo: string
}

interface AutorizacionDialogProps {
    open: boolean
    onOpenChange: (abierto: boolean) => void
    /** ⭐ POR QUÉ se pide — el texto que el usuario lee antes de confirmar. */
    motivo: string
    onAutorizar: (acto: ActoAutorizacion) => void
}

export function AutorizacionDialog({
    open,
    onOpenChange,
    motivo,
    onAutorizar,
}: AutorizacionDialogProps) {
    return (
        <ConfirmarAccionDialog
            open={open}
            onOpenChange={onOpenChange}
            titulo="Confirmar la emisión"
            descripcion={motivo}
            detalle="Al confirmar, la nota se emite y el bloqueo queda registrado como excepción."
            confirmLabel="Confirmar y emitir"
            successMessage="Confirmado"
            onConfirm={async () => {
                onAutorizar({ motivo })
                return { error: null }
            }}
        />
    )
}

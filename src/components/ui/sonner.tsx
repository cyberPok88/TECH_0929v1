"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// TOASTER — Wrapper shadcn de sonner
// Guía 0.8 — Formaliza el contrato "Toaster" del mapa §9.2
// Reemplaza el montaje desnudo de app/layout.tsx:110
// ═══════════════════════════════════════════════════════════════════════════════

import { Toaster as SonnerToaster, type ToasterProps } from "sonner"
import { cn } from "@/lib/utils"

/**
 * Toaster configurado para el sistema de 3 capas semántico.
 * - richColors: usa tokens --destructive/--success/--warning/--info (CATALOGO §2)
 * - position bottom-right: no compite con header/sidebar
 * - closeButton: permite descartar manual (UX empresarial)
 * - theme heredado de next-themes via ThemeProvider (ThemeToggler 0.6)
 */
export function Toaster(props: ToasterProps = {}) {
    return (
        <SonnerToaster
            richColors
            position="bottom-right"
            closeButton
            toastOptions={{
                className: cn(
                    "group",
                    "bg-surface text-foreground",           // base: surface/foreground
                    "border border-border",                  // borde semántico
                    "shadow-premium-md",                     // elevación consistente
                    "data-[state=open]:animate-fade-in",     // entrada suave
                    "data-[state=closed]:animate-fade-out"   // salida suave
                ),
                // Estilos por variante usando tokens semánticos (richColors los aplica)
                // destructive → --destructive-bg / --destructive-fg
                // success → --success-bg / --success-fg
                // warning → --warning-bg / --warning-fg
                // info → --info-bg / --info-fg
            }}
            {...props}
        />
    )
}

// Re-exporta la API de toast para consumidores (Topbar, ConfirmDialog, demo, CRUDs)
export { toast } from "sonner"

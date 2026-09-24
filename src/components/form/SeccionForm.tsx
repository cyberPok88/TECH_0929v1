// ═══════════════════════════════════════════════════════════════════════════════
// SECCION FORM — Card colapsable genérica (Guía 0.8 · Parte 7)
//
// PROMOCIÓN 23 Ago 2026 desde catalogos/proveedor-form/SeccionProveedor.tsx.
// El componente nunca supo de dominio: acepta children, id, numero, titulo,
// hint, completada, colapsada, onToggle. Al pedirlo el 2º CRUD (Productos 1.1)
// subió a la 0.8 con nombre neutro.
//
// Header clickeable: badge-num (Orbitron) · título · hint · chevron ▾→▸.
// `completada` pinta el badge con `success`; `colapsada` oculta el cuerpo.
// La lógica de colapso vive en el orquestador del formulario; acá es
// presentación pura.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SeccionFormProps {
    /** Ancla para la navegación del sidebar (scrollIntoView). */
    id?: string
    numero: number
    titulo: string
    hint?: string
    completada?: boolean
    colapsada?: boolean
    onToggle: () => void
    children: ReactNode
}

export function SeccionForm({
    id,
    numero,
    titulo,
    hint,
    completada = false,
    colapsada = false,
    onToggle,
    children,
}: SeccionFormProps) {
    return (
        <section
            id={id}
            className="scroll-mt-4 overflow-hidden rounded-lg border border-border/60 bg-surface/40"
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!colapsada}
                className={cn(
                    'flex w-full items-center gap-3 border-b border-border/50 bg-surface/70 px-4 py-3 text-left select-none transition-colors hover:bg-surface-2/40',
                    colapsada && 'border-b-transparent',
                )}
            >
                <span
                    className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-[13px] font-extrabold transition-colors',
                        completada ? 'bg-success text-primary-fg' : 'bg-primary text-primary-fg',
                    )}
                >
                    {numero}
                </span>
                <span className="flex-1 text-[14.5px] font-bold text-foreground">{titulo}</span>
                {hint && (
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                        {hint}
                    </span>
                )}
                <ChevronDown
                    className={cn(
                        'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-150',
                        colapsada && '-rotate-90',
                    )}
                    aria-hidden="true"
                />
            </button>
            {/*
                Mantener montado (hidden) y NO desmontar al colapsar: si se
                desmonta, los useEffect de carga de catálogos de las secciones
                (p. ej. SeccionClasificacion) corren al DESPLEGAR, no al abrir
                el modal — en modo editar eso mostraba "Sin categoría" hasta
                que cargaban (FIX 23 Ago 2026). Con hidden, la sección ya tiene
                sus catálogos listos cuando el usuario la expande.
            */}
            <div className="p-4 sm:p-5" hidden={colapsada}>
                {children}
            </div>
        </section>
    )
}

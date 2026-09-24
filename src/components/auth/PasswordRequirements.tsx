// ============================================================================
// PASSWORD REQUIREMENTS — Checklist visual de requisitos de contraseña
// Componente Dumb: sin stores, sin Router, sin Server Actions
// Controlado por prop show — el formulario padre decide cuándo es visible
// Itera PASSWORD_REQUIREMENTS — los requisitos nuevos aparecen automáticamente
// ============================================================================

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PasswordValidation } from '@/lib/validations/password'
import { PASSWORD_REQUIREMENTS } from '@/lib/validations/password'

interface PasswordRequirementsProps {
    validation: PasswordValidation  // Estado actual — calculado en el formulario padre
    show: boolean                   // El formulario decide cuándo mostrar el checklist
}

export function PasswordRequirements({ validation, show }: PasswordRequirementsProps) {
    // No renderizar si no debe mostrarse — evita un espacio vacío en el layout
    if (!show) return null

    return (
        // Con 5 requisitos el bloque crece: tipografía e interlineado más
        // compactos evitan que el checklist empuje al botón fuera de la vista.
        <div className="bg-surface border border-border rounded-lg p-3.5 space-y-2 animate-in slide-in-from-top-2 duration-300">
            {PASSWORD_REQUIREMENTS.map(({ key, label }) => {
                // Leer el estado del requisito del objeto validation
                const passed = validation[key as keyof PasswordValidation] as boolean

                return (
                    <div
                        key={key}
                        className={cn(
                            'flex items-center gap-2 text-xs transition-all duration-300',
                            // Token semántico success (todas las paletas) vs. texto secundario
                            passed ? 'text-success font-medium' : 'text-muted-foreground'
                        )}
                    >
                        {passed
                            ? <Check className="h-3.5 w-3.5 flex-shrink-0" />
                            : <X className="h-3.5 w-3.5 flex-shrink-0" />
                        }
                        <span>{label}</span>
                    </div>
                )
            })}
        </div>
    )
}

import * as React from "react"
import { cn } from "@/lib/utils"

// Reemplazamos la interfaz vacia por un Type Alias para satisfacer la regla de TypeScript
// @typescript-eslint/no-empty-object-type y evitar el error del linter.
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

/**
 * Input — Campo de texto base del sistema.
 *
 * Usa bg-surface (no bg-background) para aparecer elevado sobre el fondo.
 * El ring de focus hereda el color del primary del tema activo.
 * Compatible con todos los tipos de input HTML: text, email, password,
 * number, date, search, file, etc.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    // Layout y tipografia
                    "flex h-9 w-full rounded-md px-3 py-1",
                    "text-sm text-foreground",
                    // Fondo elevado sobre el fondo de pagina
                    "bg-surface border border-border",
                    // Placeholder con opacidad reducida — diferenciado del valor real
                    "placeholder:text-muted-foreground/60",
                    // Transicion suave en border y sombra al enfocar
                    "transition-all duration-150",
                    // Focus: ring del color del acento activo + sombra interna
                    "focus-visible:outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
                    "focus-visible:border-primary/50",
                    "focus-visible:shadow-premium-inner",
                    // File input: estilo del boton de seleccion
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
                    // Deshabilitado: opacidad reducida, sin cursor
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }

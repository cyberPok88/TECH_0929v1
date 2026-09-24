'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AVATAR — Guía 0.6 · Dumb Component
//
// Iniciales con color estable. Sin foto y sin petición extra.
//
// El color se DERIVA del nombre (hash determinista), no es aleatorio: un color
// al azar cambiaría en cada render y el avatar parpadearía. Así, el mismo
// usuario tiene siempre el mismo color en cualquier dispositivo, sin persistir
// nada.
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

/**
 * Iniciales de un nombre completo: primera palabra + última.
 * "María de los Ángeles Rodríguez" → "MR"
 *
 * Se limita a dos porque cinco letras son ilegibles en 36px, y porque en
 * español identificamos a alguien por su nombre de pila y su primer apellido.
 */
export function obtenerIniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/).filter(Boolean)
    if (palabras.length === 0) return '?'
    if (palabras.length === 1) return palabras[0].charAt(0).toUpperCase()

    const primera = palabras[0].charAt(0)
    const ultima = palabras[palabras.length - 1].charAt(0)
    return (primera + ultima).toUpperCase()
}

// Tokens semánticos, NO hexadecimales. Aquí solo hay que distinguir usuarios
// DENTRO del tema activo, así que los avatares acompañan el cambio de paleta.
// (El punto de muestra del ThemeToggler sí usa hex, porque debe mostrar cómo se
//  ven OTROS temas — es el caso distinto y está documentado allí.)
const COLORES = [
    'bg-primary-bg text-primary',
    'bg-info-bg text-info',
    'bg-success-bg text-success',
    'bg-warning-bg text-warning',
    'bg-secondary-bg text-secondary',
] as const

/** Hash determinista y barato. No es criptografía: solo reparte nombres entre 5 cubetas. */
function indiceColor(nombre: string): number {
    let acumulado = 0
    for (let i = 0; i < nombre.length; i++) {
        acumulado = (acumulado + nombre.charCodeAt(i)) % COLORES.length
    }
    return acumulado
}

interface AvatarProps {
    nombre: string
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const TAMANOS = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-11 w-11 text-sm',
} as const

export function Avatar({ nombre, size = 'md', className }: AvatarProps) {
    const iniciales = obtenerIniciales(nombre)
    const color = COLORES[indiceColor(nombre)]

    return (
        <span
            // El nombre completo se anuncia por el título del contenedor padre;
            // las iniciales por sí solas no aportan a un lector de pantalla.
            aria-hidden="true"
            title={nombre}
            className={cn(
                'inline-flex shrink-0 select-none items-center justify-center',
                'rounded-full font-semibold uppercase',
                TAMANOS[size],
                color,
                className
            )}
        >
            {iniciales}
        </span>
    )
}

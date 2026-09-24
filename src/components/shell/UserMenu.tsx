'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// USER MENU — Guía 0.11 · Smart Component
//
// Dropdown único que reúne identidad y acciones del usuario en el Topbar:
//   · Avatar + nombre + rol como trigger (mantiene la caja del chip anterior)
//   · Opción "Mi perfil" → /dashboard/perfil (datos + cambio de contraseña)
//   · Opción "Cerrar sesión" (destructive) — absorbe el botón LogOut suelto
//
// Reemplaza el bloque de la Guía 0.6 (Topbar líneas 130–152): chip del
// avatar + botón LogOut. El comportamiento visible antes de abrir el dropdown
// se preserva — el chevron es la afordancia nueva.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar } from '@/components/shell/Avatar'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

import { cerrarSesionAction } from '@/lib/actions/auth'
import { useAuth, useAuthStoreBase } from '@/lib/stores/auth-store'

export function UserMenu() {
    const router = useRouter()
    const usuario = useAuth((s) => s.usuario)
    const [saliendo, setSaliendo] = useState(false)

    if (!usuario) return null

    const salir = async () => {
        setSaliendo(true)
        const resultado = await cerrarSesionAction()

        if (!resultado.success) {
            toast.error(resultado.error ?? 'No se pudo cerrar la sesión')
            setSaliendo(false)
            return
        }

        // Limpiar ANTES de redirigir — mismo motivo que en el Topbar de la 0.6:
        // si se navega primero, /login puede montarse con el store aún
        // autenticado y AuthWrapper rebotaría al dashboard.
        useAuthStoreBase.getState().clearAuth()
        router.push('/login')
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Abrir menú de usuario"
                    className="ml-1 flex items-center gap-2 rounded-md border-l border-border pl-2 pr-1.5 py-1 hover:bg-hover-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                    <Avatar nombre={usuario.nombre_completo} size="sm" />
                    <span className="hidden min-w-0 flex-col leading-tight sm:flex text-left">
                        <span className="truncate text-xs font-medium text-foreground">
                            {usuario.nombre_completo}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                            {usuario.rol.nombre}
                        </span>
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-muted-foreground/70 hidden sm:block"
                    />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-[220px]">
                {/* Encabezado — repite identidad en el dropdown (útil en móvil, donde
                    el trigger solo muestra el avatar sin nombre) */}
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                        {usuario.nombre_completo}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                        {usuario.email}
                    </span>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* Mi perfil — datos + cambio de contraseña */}
                <DropdownMenuItem asChild>
                    <Link href="/dashboard/perfil" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Mi perfil</span>
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Cerrar sesión — variante destructive */}
                <DropdownMenuItem
                    onSelect={(e) => {
                        // onSelect cierra el menú por default; se evita para que
                        // el spinner del `saliendo` sea visible antes del redirect.
                        e.preventDefault()
                        salir()
                    }}
                    disabled={saliendo}
                    className="text-destructive focus:text-destructive focus:bg-destructive-bg cursor-pointer"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

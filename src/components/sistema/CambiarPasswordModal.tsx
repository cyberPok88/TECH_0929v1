'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CAMBIAR CONTRASEÑA — Guía 0.9 · MEJORA 21 Ago 2026
// Diálogo orquestador ligero: el admin restablece la contraseña de OTRO usuario
// (sin conocer la actual) vía cambiarPasswordUsuario. Checklist de política en
// vivo (PasswordRequirements — 0.5) y contraseña autogenerada/regenerable
// (password-gen — Parte 2). La fila propia se excluye: la defensa real vive en
// la Server Action (cambiarPasswordUsuario) y el self-service en /perfil (0.11).
//
// ⚠️ FIX 02 Sep 2026 (implementación): el manifiesto (Parte 0) declara este
// archivo como "Parte 3", pero ninguna parte de la guía tenía su bloque — se
// anexó aquí (bloque B5 de la Parte 3) con actualizar-guia.
//
// ⚠️ FIX 02 Sep 2026 (set-state-in-effect): la versión original sembraba la
// contraseña con setPassword() dentro de un useEffect — la regla
// react-hooks/set-state-in-effect lo marca como error. El estado vive en
// CambiarPasswordContenido (montado SOLO con el Dialog abierto — Radix lo
// desmonta al cerrar) y nace con useState perezoso:
// cada apertura es un montaje nuevo, sin efectos que seteen estado.
//
// ⭐ FIX 10 Oct 2026 (`g09_p3_b9`) — EL CAMPO NACE **VACÍO**, y es la parte que
// importa: antes nacía con `() => generarPassword()`, o sea **lleno y ya válido**,
// así que **dos clics sin escribir nada** rotaban la contraseña de esa fila y
// cerraban sus sesiones. Medido: así se rotó la del DUEÑO y quedó fuera del
// sistema. Vacío, «Confirmar» queda deshabilitado hasta que alguien escriba una
// o la genere **a propósito** (botón ⟳). El inicializador sigue siendo perezoso.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { RefreshCw, Loader2, KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'

import { PasswordRequirements } from '@/components/auth/PasswordRequirements'
import { validarPassword } from '@/lib/validations/password'
import { generarPassword } from '@/lib/utils/password-gen'
import { cambiarPasswordUsuario } from '@/lib/actions/usuarios'
import type { UsuarioLista } from '@/types/usuarios'

interface CambiarPasswordModalProps {
    usuario: UsuarioLista | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function CambiarPasswordModal({
    usuario,
    open,
    onOpenChange,
    onSuccess,
}: CambiarPasswordModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* El contenido se monta SOLO con el Dialog abierto (Radix lo desmonta
                al cerrar): el estado nace limpio en cada apertura. */}
            {usuario && (
                <CambiarPasswordContenido
                    usuario={usuario}
                    onOpenChange={onOpenChange}
                    onSuccess={onSuccess}
                />
            )}
        </Dialog>
    )
}

interface CambiarPasswordContenidoProps {
    usuario: UsuarioLista
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

function CambiarPasswordContenido({
    usuario,
    onOpenChange,
    onSuccess,
}: CambiarPasswordContenidoProps) {
    // useState perezoso: en el montaje (cada apertura) nace una contraseña ya
    // generada y válida — sin setState en efectos (react-hooks/set-state-in-effect).
    /**
     * ⭐ FIX 10 Oct 2026 (`g09_p3_b9`) — **arranca VACÍA**. Con la contraseña ya generada, el
     * botón de confirmar quedaba habilitado desde el primer segundo: dos clics sin escribir nada
     * rotaban la contraseña y **cerraban las sesiones** de esa persona (así se rotó la del dueño).
     * Vacía, hay que **escribirla o generarla a propósito** (`regenerar`), y `guardar()` no corre
     * mientras `validarPassword('')` no pase.
     */
    const [password, setPassword] = useState<string>('')
    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState('')

    const passwordValidation = validarPassword(password)

    const regenerar = () => setPassword(generarPassword())

    const cerrar = () => onOpenChange(false)

    async function guardar() {
        if (!passwordValidation.isValid) return
        setEnviando(true)
        setErrorServidor('')
        try {
            const res = await cambiarPasswordUsuario(usuario.id, password)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo cambiar la contraseña.')
                return
            }
            toast.success(`Contraseña actualizada para ${usuario.nombre_completo}`)
            onSuccess()
            onOpenChange(false)
        } catch {
            setErrorServidor('Error de conexión. Intenta de nuevo.')
        } finally {
            setEnviando(false)
        }
    }

    return (
        <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>Cambiar contraseña</DialogTitle>
                <DialogDescription>
                    Restablece la contraseña de {usuario.nombre_completo}. La persona la usará en su
                    próximo acceso.
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
                <Label htmlFor="nueva_password">Nueva contraseña</Label>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <KeyRound
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            id="nueva_password"
                            type="text"
                            className="pl-9 font-mono"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={enviando}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={regenerar}
                        disabled={enviando}
                        aria-label={password ? 'Regenerar contraseña' : 'Generar contraseña'}
                        title={password ? 'Regenerar' : 'Generar una'}
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
                {password === '' && (
                    <p className="text-[11.5px] leading-snug text-muted-foreground">
                        Escribila o generá una con el botón ⟳. <b>Nada se cambia hasta que confirmes</b>
                        : al rotarla, esa persona queda fuera de su sesión.
                    </p>
                )}
                <PasswordRequirements validation={passwordValidation} show={password.length > 0} />
            </div>

            {errorServidor && (
                <p className="rounded-lg border border-destructive/20 bg-destructive-bg px-4 py-2.5 text-sm text-destructive">
                    {errorServidor}
                </p>
            )}

            <DialogFooter>
                <Button type="button" variant="outline" onClick={cerrar} disabled={enviando}>
                    Cancelar
                </Button>
                <Button type="button" onClick={guardar} disabled={enviando || !passwordValidation.isValid}>
                    {enviando ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        'Actualizar contraseña'
                    )}
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

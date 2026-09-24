// ═══════════════════════════════════════════════════════════════════════════════
// DECISION 0 — "Usar datos fiscales" (SPEC §1 D2/D3)
//
// Checkbox maestro que condiciona el resto del formulario: al activarlo se
// habilita la Sección 3 (Fiscal) y se muestran las píldoras F con los
// obligatorios CFDI 4.0 (RFC · Razón social · Régimen · C.P. del domicilio
// fiscal). Dumb: recibe el valor y el handler del useForm padre.
// ═══════════════════════════════════════════════════════════════════════════════

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SelloFiscal } from '@/components/form'

interface DecisionFiscalProps {
    usaFiscales: boolean
    onToggle: (checked: boolean) => void
}

/** Obligatorios CFDI 4.0 que se muestran como píldoras F al activar la decisión. */
const OBLIGATORIOS_CFDI = ['RFC', 'Razón social', 'Régimen fiscal', 'C.P. domicilio fiscal']

export function DecisionFiscal({ usaFiscales, onToggle }: DecisionFiscalProps) {
    return (
        <div className="flex items-start gap-3 border-b border-border/55 bg-surface/35 px-6 py-3.5">
            <Checkbox
                id="usa_fiscales"
                checked={usaFiscales}
                onCheckedChange={onToggle}
                className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
                <Label htmlFor="usa_fiscales" className="text-[13px] font-bold">
                    Usar datos fiscales
                </Label>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    ¿El proveedor facturará al negocio? Al activarlo se habilita la sección 3
                    (Fiscal) y se marcan los datos obligatorios CFDI 4.0.
                </p>
                {usaFiscales && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {OBLIGATORIOS_CFDI.map((label) => (
                            <SelloFiscal key={label} conIcono>
                                {label}
                            </SelloFiscal>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

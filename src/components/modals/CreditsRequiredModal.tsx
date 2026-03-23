import { Button } from "@/components/ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  credits: number;
}

export function CreditsRequiredModal({ isOpen, onClose, credits }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-foreground">Créditos insuficientes</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Saldo actual: {credits}. Conecta create-checkout y verify-payment para activar el paywall real.
        </p>
        <div className="mt-5 rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
          Placeholder de compra. El backend sigue en Supabase/Stripe.
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={onClose}>Comprar luego</Button>
        </div>
      </div>
    </div>
  );
}

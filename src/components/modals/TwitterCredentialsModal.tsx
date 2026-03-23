import { Button } from "@/components/ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TwitterCredentialsModal({ isOpen, onClose, onSuccess }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-foreground">Credenciales de X/Twitter</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          La UI ya contempla el flujo. Falta inyectar las credenciales reales y persistirlas en Supabase.
        </p>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border/50 p-3">API Key: TBD</div>
          <div className="rounded-lg border border-border/50 p-3">API Secret: TBD</div>
          <div className="rounded-lg border border-border/50 p-3">Access Token: TBD</div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={onSuccess}>Entendido</Button>
        </div>
      </div>
    </div>
  );
}

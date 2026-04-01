import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    async function verifyPayment() {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        setStatus('error');
        return;
      }

      try {
        // Refresh profile to get updated credits
        await refreshProfile();
        setStatus('success');
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('error');
      }
    }

    verifyPayment();
  }, [searchParams, refreshProfile]);

  return (
    <div className="min-h-screen chat-gradient flex items-center justify-center p-4">
      <div className="bg-card border border-border/50 rounded-lg p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Verificando Pago</h1>
            <p className="text-muted-foreground">Por favor espera...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Pago Exitoso!</h1>
            <p className="text-muted-foreground mb-6">
              Tu compra ha sido procesada correctamente. Los creditos han sido agregados a tu cuenta.
            </p>
            <Button onClick={() => navigate('/')}>
              Ir al Chat
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Error de Verificacion</h1>
            <p className="text-muted-foreground mb-6">
              No se pudo verificar el pago. Si el problema persiste, contacta a soporte.
            </p>
            <div className="space-x-4">
              <Button variant="outline" onClick={() => navigate('/')}>
                Ir al Chat
              </Button>
              <Button onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;

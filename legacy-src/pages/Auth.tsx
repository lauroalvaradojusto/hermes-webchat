import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Auth = () => {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen chat-gradient flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = isLogin ? await signIn(email, password) : await signUp(email, password);
    if (result.error) setError(result.error.message);
    setSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen chat-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/90 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Topic Threader</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">{isLogin ? "Acceso" : "Registro"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Inicia sesión con tu cuenta de Google</p>
        </div>

        {error && <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {/* Google Sign In Button */}
        <Button 
          type="button" 
          className="w-full mb-4 bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-2"
          onClick={handleGoogleSignIn}
          disabled={submitting}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.38-1.05 2.56-2.19 3.35v2.77h3.54c2.08-1.92 3.28-4.74 3.28-8.13z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.77c-.98.66-2.23 1.06-3.74 1.06-2.88 0-5.32-1.94-6.2-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.8 14.28c-.48-.93-.76-1.94-.76-3.04s.28-2.11.76-3.04V5.4H2.18C.79 7.46 0 9.65 0 12s.79 4.54 2.18 6.12l3.62-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 5.88l3.62 2.84c.88-2.59 3.32-4.34 6.2-4.34z"
            />
          </svg>
          Continuar con Google
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">o usa tu email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-foreground">Email</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-foreground outline-none ring-0 transition focus:border-primary"
                type="email"
                placeholder="lauro@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-foreground">Contraseña</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-foreground outline-none ring-0 transition focus:border-primary"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          </label>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isLogin ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {isLogin ? "Entrar" : "Crear cuenta"}
          </Button>
        </form>

        <button className="mt-6 w-full text-sm text-primary hover:underline" onClick={() => setIsLogin((v) => !v)}>
          {isLogin ? "No tienes cuenta? Regístrate" : "Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
};

export default Auth;
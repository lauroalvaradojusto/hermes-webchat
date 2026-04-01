import { Clock3, CreditCard, LogOut, MoonStar, Plus, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface ChatItem {
  id: string;
  title: string;
  updatedAt: string;
}

interface Props {
  chats: ChatItem[];
  currentChatId: string;
  isLoadingHistory: boolean;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

export function UserSettingsPanel({ chats, currentChatId, isLoadingHistory, onSelectChat, onNewChat }: Props) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Cuenta</p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">{profile?.email || "Usuario"}</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/50 px-2 py-1">Créditos: {profile?.credits ?? 0}</span>
          <span className="rounded-full border border-border/50 px-2 py-1">Rol: {profile?.role ?? "user"}</span>
          <span className="rounded-full border border-border/50 px-2 py-1">Tema: {theme}</span>
        </div>
      </div>

      <div className="space-y-6 overflow-y-auto px-6 py-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground"><Clock3 className="h-4 w-4" /> Historial</h3>
            <Button size="sm" variant="outline" onClick={onNewChat}><Plus className="mr-2 h-4 w-4" /> Nuevo</Button>
          </div>
          <div className="space-y-2">
            {isLoadingHistory ? (
              <div className="rounded-lg border border-border/50 p-3 text-sm text-muted-foreground">Cargando historial…</div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${chat.id === currentChatId ? "border-primary bg-primary/10" : "border-border/50 bg-card/60 hover:border-primary/40"}`}
                >
                  <div className="text-sm font-medium text-foreground">{chat.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(chat.updatedAt).toLocaleString()}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><MoonStar className="h-4 w-4" /> Tema</h3>
          <div className="grid grid-cols-3 gap-2">
            {(["matrix", "midnight", "android"] as const).map((option) => (
              <button
                key={option}
                className={`rounded-lg border px-3 py-2 text-xs capitalize ${theme === option ? "border-primary bg-primary/10 text-foreground" : "border-border/50 text-muted-foreground"}`}
                onClick={() => setTheme(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 text-foreground"><CreditCard className="h-4 w-4" /> Integraciones pendientes</p>
          <p>Stripe checkout, Twitter publish/delete, analyze-document y chat-deepseek se conectan desde Supabase.</p>
          <Button variant="outline" className="w-full" onClick={() => navigate("/payment-success?session_id=demo")}>Simular pago</Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/mant")}>Ir a admin</Button>
          <Button variant="outline" className="w-full" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
          <div className="rounded-lg border border-dashed border-border/50 p-3 text-xs">
            <span className="flex items-center gap-2 font-medium text-foreground"><Shield className="h-4 w-4" /> Nota</span>
            El backend real permanece en Supabase. Aquí quedó sólo la capa frontend lista para Vercel.
          </div>
        </section>
      </div>
    </div>
  );
}

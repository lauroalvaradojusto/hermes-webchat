import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, supabase } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Users, DollarSign, Shield, RefreshCw } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalCredits: number;
  activeUsers: number;
}

const Admin = () => {
  const { user, profile, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchStats();
    }
  }, [profile]);

  async function fetchStats() {
    setIsLoadingStats(true);
    try {
      // Placeholder: In production, this would call a Supabase function
      // const { data } = await supabase.rpc('get_admin_stats');
      setStats({
        totalUsers: 0, // TBD - Requires admin function
        totalCredits: 0, // TBD - Requires admin function
        activeUsers: 0, // TBD - Requires admin function
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen chat-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen chat-gradient p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Panel de Administracion</h1>
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingStats ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border/50 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Usuarios</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoadingStats ? '...' : stats?.totalUsers ?? 'TBD'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Creditos Totales</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoadingStats ? '...' : stats?.totalCredits ?? 'TBD'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <Shield className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usuarios Activos</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoadingStats ? '...' : stats?.activeUsers ?? 'TBD'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-card border border-border/50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Funciones de Admin</h2>
          <p className="text-muted-foreground">
            Panel de administracion reconstruido. Las funciones de administracion 
            requieren implementacion de edge functions en Supabase.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Admin;

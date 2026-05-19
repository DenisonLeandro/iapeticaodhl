import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { User, Save, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function ProfilePage() {
  const { user, profile, loading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (profile && !initialized) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setOabNumber(profile.oab_number ?? "");
      setInitialized(true);
    }
  }, [profile, initialized]);

  const ensureProfile = async () => {
    setBootstrapping(true);
    try {
      const { error } = await supabase.rpc("bootstrap_current_user_profile");
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      toast.error(`Erro ao carregar perfil: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => {
    if (!loading && user && !profile && !bootstrapping) {
      void ensureProfile();
    }
  }, [loading, user, profile]);

  if (loading || bootstrapping) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
          <CardDescription>Não foi possível carregar seus dados agora.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={ensureProfile} disabled={bootstrapping}>
            {bootstrapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasChanges =
    fullName !== (profile.full_name ?? "") ||
    phone !== (profile.phone ?? "") ||
    oabNumber !== (profile.oab_number ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.replace(/\D/g, "") || null,
          oab_number: oabNumber.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
    } catch (err) {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 0) formatted = `(${digits.substring(0, 2)}`;
    if (digits.length > 2) formatted += `) ${digits.substring(2, 7)}`;
    if (digits.length > 7) formatted += `-${digits.substring(7, 11)}`;
    setPhone(formatted);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <User className="h-6 w-6" />
          Meu Perfil
        </h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Pessoais</CardTitle>
          <CardDescription>Informações exibidas no sistema e nos documentos gerados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email ?? ""} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full-name">Nome completo</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="(11) 99999-9999" maxLength={15} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="oab">Número OAB</Label>
              <Input id="oab" value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="Ex: 123456/SP" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Função</Label>
            <Input value={profile.role} disabled className="opacity-60 capitalize" />
            <p className="text-xs text-muted-foreground">A função é gerenciada pelo administrador.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}


import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import InviteDialog from "@/components/settings/InviteDialog";
import UserRoleSelect from "@/components/settings/UserRoleSelect";
import RemoveMemberDialog from "@/components/settings/RemoveMemberDialog";
import type { UserRole } from "@/types/database.types";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  lawyer: "Advogado",
  secretary: "Secretária",
  intern: "Estagiário",
};

const roleBadgeColors: Record<UserRole, string> = {
  admin: "bg-blue-600 text-white hover:bg-blue-600/80 border-transparent",
  lawyer: "bg-green-600 text-white hover:bg-green-600/80 border-transparent",
  secretary: "bg-yellow-500 text-black hover:bg-yellow-500/80 border-transparent",
  intern: "bg-gray-500 text-white hover:bg-gray-500/80 border-transparent",
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const { user, profile } = useAuth();
  const {
    members,
    isLoading,
    error,
    updateRole,
    isUpdatingRole,
    removeMember,
  } = useOrganizationMembers();

  const currentUserId = user?.id;
  const adminCount = members.filter((m) => m.role === "admin").length;

  const handleRoleChange = async (profileId: string, newRole: UserRole) => {
    const result = await updateRole({ profileId, newRole });
    if (result.success) {
      toast.success("Papel atualizado com sucesso");
    } else {
      toast.error(result.error ?? "Erro ao atualizar papel");
    }
  };

  const canRemoveMember = (memberId: string, memberRole: UserRole) => {
    // Cannot remove yourself
    if (memberId === currentUserId) return false;
    // Cannot remove the last admin
    if (memberRole === "admin" && adminCount <= 1) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Gerenciamento de Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os membros da sua organização
          </p>
        </div>
        <InviteDialog />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Erro ao carregar membros. Tente novamente.
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground">
          Nenhum membro encontrado
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Alterar Papel</TableHead>
                <TableHead className="w-[70px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.id === currentUserId;
                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell>
                      <Badge className={roleBadgeColors[member.role]}>
                        {roleLabels[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <UserRoleSelect
                        currentRole={member.role}
                        isSelf={isSelf}
                        disabled={isUpdatingRole}
                        onRoleChange={(newRole) =>
                          handleRoleChange(member.id, newRole)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {canRemoveMember(member.id, member.role) && (
                        <RemoveMemberDialog
                          memberName={member.full_name}
                          onConfirm={() => removeMember(member.id)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

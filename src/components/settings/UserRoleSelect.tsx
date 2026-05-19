import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UserRole } from "@/types/database.types";

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "lawyer", label: "Advogado" },
  { value: "secretary", label: "Secretária" },
  { value: "intern", label: "Estagiário" },
];

interface UserRoleSelectProps {
  currentRole: UserRole;
  isSelf: boolean;
  disabled?: boolean;
  onRoleChange: (newRole: UserRole) => void;
}

export default function UserRoleSelect({
  currentRole,
  isSelf,
  disabled,
  onRoleChange,
}: UserRoleSelectProps) {
  const [value, setValue] = useState<UserRole>(currentRole);

  const handleChange = (newRole: string) => {
    const role = newRole as UserRole;
    setValue(role);
    onRoleChange(role);
  };

  if (isSelf) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select value={value} disabled>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Você não pode alterar seu próprio papel</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

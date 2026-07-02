import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOpposingPartySuggestions } from "@/services/opposingPartySuggestions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useCaseMutations, useLawyers } from "@/hooks/useCases";
import { useClients } from "@/hooks/useClients";
import {
  caseFormSchema,
  COURT_OPTIONS,
  CASE_STATUS_OPTIONS,
  type CaseFormValues,
  type Case,
} from "@/types/case";
import { REPRESENTED_PARTY_OPTIONS } from "@/lib/represented-party";

interface CaseFormProps {
  editCase?: Case;
  defaultClientId?: string;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export default function CaseForm({
  editCase,
  defaultClientId,
  onSuccess,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger,
}: CaseFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChangeProp) onOpenChangeProp(v);
    else setInternalOpen(v);
  };
  const { createCase, isCreating, updateCase, isUpdating } = useCaseMutations();
  const { lawyers } = useLawyers();
  const [clientSearch, setClientSearch] = useState("");
  const { clients: clientResults } = useClients({
    search: clientSearch,
    page: 1,
    pageSize: 50,
    sortBy: "full_name",
    sortOrder: "asc",
  });
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const isEditing = !!editCase;
  const isSubmitting = isCreating || isUpdating;


  const initialKind: "judicial" | "pre_processual" =
    editCase && !editCase.case_number?.trim() ? "pre_processual" : "judicial";

  const form = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      case_kind: initialKind,
      case_number: editCase?.case_number ?? "",
      court: editCase?.court ?? "",
      branch: editCase?.branch ?? "",
      subject: editCase?.subject ?? "",
      opposing_party: editCase?.opposing_party ?? "",
      client_id: editCase?.client_id ?? defaultClientId ?? "",
      assigned_to: editCase?.assigned_to ?? "",
      status: editCase?.status ?? "active",
      represented_party:
        (editCase?.represented_party as CaseFormValues["represented_party"]) ?? "autor",
    },
  });

  const caseKind = form.watch("case_kind");
  const isPreProcessual = caseKind === "pre_processual";


  const onSubmit = async (values: CaseFormValues) => {
    try {
      const isPre = values.case_kind === "pre_processual";
      const noun = isPre ? "Caso" : "Processo";
      if (isEditing && editCase) {
        await updateCase({ caseId: editCase.id, values });
        toast.success(`${noun} atualizado com sucesso`);
      } else {
        await createCase(values);
        toast.success(`${noun} cadastrado com sucesso`);
      }
      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar";
      toast.error(message);
    }
  };


  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {isEditing ? (
            <Button variant="outline" size="sm">
              Editar
            </Button>
          ) : (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Processo
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[600px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? isPreProcessual
                ? "Editar Caso"
                : "Editar Processo"
              : "Novo Cadastro"}
          </DialogTitle>
          <DialogDescription>
            {isPreProcessual
              ? "Caso em preparação — sem número de processo ainda."
              : "Processo judicial já distribuído."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="case_kind"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Tipo de cadastro</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={field.value === "judicial" ? "default" : "outline"}
                      onClick={() => field.onChange("judicial")}
                      className="justify-center"
                    >
                      Processo judicial
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "pre_processual" ? "default" : "outline"}
                      onClick={() => field.onChange("pre_processual")}
                      className="justify-center"
                    >
                      Caso sem processo
                    </Button>
                  </div>
                </FormItem>
              )}
            />

            {!isPreProcessual && (
              <>
                <FormField
                  control={form.control}
                  name="case_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Processo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0000000-00.0000.0.00.0000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="court"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tribunal</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tribunal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COURT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="branch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vara</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 1ª Vara Cível" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isPreProcessual ? "Título/Assunto do caso" : "Assunto"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        isPreProcessual
                          ? "Ex: Caso novo sem processo — horas extras"
                          : "Assunto do processo"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="opposing_party"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parte Contrária</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        isPreProcessual
                          ? "Se houver (opcional)"
                          : "Nome da parte contrária"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => {
                const selected = clientResults.find((c) => c.id === field.value);
                const label = selected?.full_name ?? "— Sem cliente —";
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Cliente vinculado</FormLabel>
                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {label}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Buscar cliente por nome, CPF/CNPJ ou e-mail..."
                            value={clientSearch}
                            onValueChange={setClientSearch}
                          />
                          <CommandList>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  field.onChange("");
                                  setClientPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !field.value ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                — Sem cliente —
                              </CommandItem>
                              {clientResults.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.id}
                                  onSelect={() => {
                                    field.onChange(c.id);
                                    setClientPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === c.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  {c.full_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />



            <FormField
              control={form.control}
              name="represented_party"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parte representada pelo escritório</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a parte representada" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REPRESENTED_PARTY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">

              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advogado Responsável</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o advogado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lawyers.map((lawyer) => (
                          <SelectItem key={lawyer.id} value={lawyer.id}>
                            {lawyer.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CASE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing
                  ? "Salvar Alterações"
                  : isPreProcessual
                    ? "Cadastrar Caso"
                    : "Cadastrar Processo"}

              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

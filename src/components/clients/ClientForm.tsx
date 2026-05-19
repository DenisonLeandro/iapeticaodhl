import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mic, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clientFormSchema,
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskCEP,
  type ClientFormValues,
} from "@/schemas/client.schema";
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import type { Client } from "@/types/client";
import VoiceClientDialog from "@/components/clients/VoiceClientDialog";
import OCRUploadDialog from "@/components/shared/OCRUploadDialog";

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export default function ClientForm({
  open,
  onOpenChange,
  client,
}: ClientFormProps) {
  const isEditing = !!client;
  const { user, organization, profile } = useAuth();
  const isSessionReady = !!user && !!organization && !!profile;
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const isSubmitting = createClient.isPending || updateClient.isPending;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      full_name: "",
      document_type: "cpf",
      document_number: "",
      email: "",
      phone: "",
      address: {
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
      },
      notes: "",
    },
  });

  const [fetchingCep, setFetchingCep] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);

  const documentType = form.watch("document_type");

  const handleVoiceExtracted = useCallback(
    (data: Partial<ClientFormValues>) => {
      if (data.full_name) form.setValue("full_name", data.full_name, { shouldValidate: true });
      if (data.document_type) form.setValue("document_type", data.document_type);
      if (data.document_number) {
        const dt = data.document_type || form.getValues("document_type");
        const masked = dt === "cnpj" ? maskCNPJ(data.document_number) : maskCPF(data.document_number);
        form.setValue("document_number", masked, { shouldValidate: true });
      }
      if (data.email) form.setValue("email", data.email, { shouldValidate: true });
      if (data.phone) form.setValue("phone", maskPhone(data.phone), { shouldValidate: true });
      if (data.notes) form.setValue("notes", data.notes);
      if (data.address) {
        if (data.address.zip_code) form.setValue("address.zip_code", maskCEP(data.address.zip_code), { shouldValidate: true });
        if (data.address.street) form.setValue("address.street", data.address.street, { shouldValidate: true });
        if (data.address.number) form.setValue("address.number", data.address.number, { shouldValidate: true });
        if (data.address.complement) form.setValue("address.complement", data.address.complement);
        if (data.address.neighborhood) form.setValue("address.neighborhood", data.address.neighborhood, { shouldValidate: true });
        if (data.address.city) form.setValue("address.city", data.address.city, { shouldValidate: true });
        if (data.address.state) form.setValue("address.state", data.address.state, { shouldValidate: true });
      }
      toast.success("Dados preenchidos por voz com sucesso!");
    },
    [form],
  );

  // Reset form when dialog opens/closes or client changes
  useEffect(() => {
    if (open && client) {
      const docNumber = client.document_number ?? "";
      const maskedDoc =
        client.document_type === "cnpj" ? maskCNPJ(docNumber) : maskCPF(docNumber);
      const maskedPhone = client.phone ? maskPhone(client.phone) : "";
      const maskedCEP = client.address?.zip_code ? maskCEP(client.address.zip_code) : "";

      form.reset({
        full_name: client.full_name,
        document_type: client.document_type ?? "cpf",
        document_number: maskedDoc,
        email: client.email ?? "",
        phone: maskedPhone,
        address: {
          street: client.address?.street ?? "",
          number: client.address?.number ?? "",
          complement: client.address?.complement ?? "",
          neighborhood: client.address?.neighborhood ?? "",
          city: client.address?.city ?? "",
          state: client.address?.state ?? "",
          zip_code: maskedCEP,
        },
        notes: client.notes ?? "",
      });
    } else if (open && !client) {
      form.reset({
        full_name: "",
        document_type: "cpf",
        document_number: "",
        email: "",
        phone: "",
        address: {
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: "",
          zip_code: "",
        },
        notes: "",
      });
    }
  }, [open, client, form]);

  const onSubmit = async (values: ClientFormValues) => {
    try {
      if (isEditing && client) {
        await updateClient.mutateAsync({ id: client.id, data: values });
        toast.success("Cliente atualizado com sucesso");
      } else {
        await createClient.mutateAsync(values);
        toast.success("Cliente cadastrado com sucesso");
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao salvar cliente:", err);
      const code = err?.code;
      const message = err?.message || "";
      let errorMessage: string;
      if (code === "23505") {
        errorMessage = "CPF/CNPJ já cadastrado para esta organização.";
      } else if (code === "23503") {
        errorMessage = "Perfil do usuário não encontrado. Faça login novamente.";
      } else if (message.includes("row-level security")) {
        errorMessage = "Sem permissão. Verifique seu vínculo com a organização.";
      } else if (message.includes("Sessão incompleta")) {
        errorMessage = message;
      } else {
        errorMessage = message || (isEditing
          ? "Erro ao atualizar cliente. Tente novamente."
          : "Erro ao cadastrar cliente. Tente novamente.");
      }
      toast.error(errorMessage);
    }
  };

  const handleDocumentNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: string) => void,
  ) => {
    const raw = e.target.value;
    const masked = documentType === "cnpj" ? maskCNPJ(raw) : maskCPF(raw);
    onChange(masked);
  };

  const handlePhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: string) => void,
  ) => {
    onChange(maskPhone(e.target.value));
  };

  const handleCEPChange = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      onChange: (value: string) => void,
    ) => {
      const masked = maskCEP(e.target.value);
      onChange(masked);

      const cleaned = masked.replace(/\D/g, "");
      if (cleaned.length === 8) {
        setFetchingCep(true);
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
          const data = await res.json();
          if (!data.erro) {
            form.setValue("address.street", data.logradouro || "", { shouldValidate: true });
            form.setValue("address.neighborhood", data.bairro || "", { shouldValidate: true });
            form.setValue("address.city", data.localidade || "", { shouldValidate: true });
            form.setValue("address.state", data.uf || "", { shouldValidate: true });
          }
        } catch {
          // silently fail – user can fill manually
        } finally {
          setFetchingCep(false);
        }
      }
    },
    [form],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do cliente abaixo."
              : "Preencha os dados para cadastrar um novo cliente."}
          </DialogDescription>
        </DialogHeader>

        {/* Voice & OCR fill buttons */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setOcrOpen(true)}
          >
            <FileSearch className="h-4 w-4" />
            Preencher por Documento
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setVoiceOpen(true)}
          >
            <Mic className="h-4 w-4" />
            Preencher por Voz
          </Button>
        </div>

        <VoiceClientDialog
          open={voiceOpen}
          onOpenChange={setVoiceOpen}
          onExtracted={handleVoiceExtracted}
        />

        <OCRUploadDialog
          open={ocrOpen}
          onOpenChange={setOcrOpen}
          context="client"
          onExtracted={handleVoiceExtracted as (data: Record<string, unknown>) => void}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo e Número do Documento */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="document_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Documento</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("document_number", "");
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Documento *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          documentType === "cnpj"
                            ? "00.000.000/0000-00"
                            : "000.000.000-00"
                        }
                        value={field.value}
                        onChange={(e) =>
                          handleDocumentNumberChange(e, field.onChange)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Nome Completo / Razão Social */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {documentType === "cnpj" ? "Razão Social *" : "Nome Completo *"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        documentType === "cnpj"
                          ? "Razão social da empresa"
                          : "Nome do cliente"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email e Telefone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={field.value}
                        onChange={(e) => handlePhoneChange(e, field.onChange)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Endereço */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Endereço</p>
              {/* Linha 1: CEP, Cidade, UF */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="address.zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="00000-000"
                            value={field.value}
                            onChange={(e) => handleCEPChange(e, field.onChange)}
                          />
                          {fetchingCep && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UF_OPTIONS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Linha 2: Rua, Número */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua *</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua / Avenida" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address.number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nº" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Linha 3: Complemento, Bairro */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address.complement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Apto, sala, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro *</FormLabel>
                      <FormControl>
                        <Input placeholder="Bairro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notas */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações sobre o cliente..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              {!isSessionReady && (
                <p className="text-sm text-destructive mr-auto self-center">
                  Sessão incompleta. Recarregue a página.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !isSessionReady}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

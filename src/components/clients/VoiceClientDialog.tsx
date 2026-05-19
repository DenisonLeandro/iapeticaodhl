import { useState } from "react";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVoiceTranscription } from "@/hooks/useVoiceTranscription";
import { supabase } from "@/lib/backend/client";
import type { ClientFormValues } from "@/schemas/client.schema";

interface VoiceClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (data: Partial<ClientFormValues>) => void;
}

export default function VoiceClientDialog({ open, onOpenChange, onExtracted }: VoiceClientDialogProps) {
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceTranscription();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editableTranscript, setEditableTranscript] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  const fullTranscript = transcript + (interimTranscript ? ` ${interimTranscript}` : "");

  const handleToggleRecording = () => {
    if (isListening) {
      stopListening();
      setEditableTranscript(transcript);
      setShowEditor(true);
    } else {
      setError(null);
      setShowEditor(false);
      resetTranscript();
      startListening();
    }
  };

  const handleProcess = async () => {
    const text = showEditor ? editableTranscript : transcript;
    if (!text || text.trim().length < 10) {
      setError("Texto muito curto. Fale mais detalhes sobre o cliente.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("voice-extract-client", {
        body: { transcript: text.trim() },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.extracted) {
        const ex = data.extracted;
        const mapped: Partial<ClientFormValues> = {};

        if (ex.nome) mapped.full_name = ex.nome;
        if (ex.tipoDocumento === "cpf" || ex.tipoDocumento === "cnpj") {
          mapped.document_type = ex.tipoDocumento;
        }
        if (ex.documento) mapped.document_number = ex.documento;
        if (ex.email) mapped.email = ex.email;
        if (ex.telefone) mapped.phone = ex.telefone;
        if (ex.notas) mapped.notes = ex.notas;

        if (ex.endereco) {
          mapped.address = {
            street: ex.endereco.rua || "",
            number: ex.endereco.numero || "",
            complement: ex.endereco.complemento || "",
            neighborhood: ex.endereco.bairro || "",
            city: ex.endereco.cidade || "",
            state: ex.endereco.estado || "",
            zip_code: ex.endereco.cep || "",
          };
        }

        onExtracted(mapped);
        onOpenChange(false);
        resetState();
      }
    } catch (err) {
      console.error("Voice extract client error:", err);
      setError(err instanceof Error ? err.message : "Erro ao processar com IA");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    resetTranscript();
    setEditableTranscript("");
    setShowEditor(false);
    setError(null);
    setIsProcessing(false);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      stopListening();
      resetState();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preencher por Voz</DialogTitle>
          <DialogDescription>
            Fale os dados do cliente: nome, CPF/CNPJ, email, telefone, endereço, etc.
            A IA irá extrair os dados e preencher o formulário automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isSupported && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Seu navegador não suporta reconhecimento de voz. Use Chrome, Edge ou Safari.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center">
            <Button
              type="button"
              variant={isListening ? "destructive" : "default"}
              size="lg"
              className="gap-2 px-8"
              onClick={handleToggleRecording}
              disabled={!isSupported || isProcessing}
            >
              {isListening ? (
                <>
                  <MicOff className="h-5 w-5" />
                  Parar Gravação
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5" />
                  {transcript ? "Gravar Novamente" : "Iniciar Gravação"}
                </>
              )}
            </Button>
          </div>

          {isListening && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="mb-1 text-xs font-medium text-primary">🔴 Gravando...</p>
              <p className="text-sm text-foreground">
                {fullTranscript || (
                  <span className="text-muted-foreground italic">Aguardando fala...</span>
                )}
              </p>
            </div>
          )}

          {showEditor && !isListening && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Revise o texto antes de processar:
              </label>
              <Textarea
                value={editableTranscript}
                onChange={(e) => setEditableTranscript(e.target.value)}
                className="min-h-[120px]"
                placeholder="Texto transcrito..."
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || isListening || (!transcript && !editableTranscript)}
            className="gap-2"
          >
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            {isProcessing ? "Processando com IA..." : "Processar e Preencher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

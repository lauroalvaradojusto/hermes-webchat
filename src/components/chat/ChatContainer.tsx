import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FileUp, Loader2, PlusCircle, SendHorizonal, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/hooks/useChat";

interface Props {
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onFileUpload: (file: File) => Promise<void>;
  onPublish: () => Promise<void>;
  onGeneratePdf: () => Promise<void>;
  onCancelPublish: () => Promise<void>;
  isLoading: boolean;
  isConfigured: boolean;
  selectedFiles: File[];
  removeFile: (index: number) => void;
}

export function ChatContainer({ messages, onSendMessage, onFileUpload, onPublish, onGeneratePdf, onCancelPublish, isLoading, isConfigured, selectedFiles, removeFile }: Props) {
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    setDraft("");
    await onSendMessage(value);
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onFileUpload(file);
    e.target.value = "";
  };

  return (
    <div className="relative flex h-screen flex-col">
      <div className="border-b border-border/50 bg-background/40 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Topic Threader</p>
            <h1 className="text-2xl font-semibold text-foreground">Panel principal</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" /> Archivo
            </Button>
            <Button variant="outline" onClick={onGeneratePdf}>
              <PlusCircle className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" onClick={onCancelPublish}>
              Cancelar
            </Button>
            <Button onClick={onPublish} disabled={!isConfigured}>
              <Share2 className="mr-2 h-4 w-4" /> Publicar
            </Button>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="border-b border-border/50 bg-background/40 px-6 py-3 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-sm">
                <FileUp className="h-4 w-4 text-primary" />
                <span className="max-w-[200px] truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-1 rounded-full p-1 hover:bg-accent/20"
                  type="button"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((message) => (
          <div key={message.id} className={`max-w-3xl rounded-2xl border px-4 py-3 shadow ${message.role === "assistant" ? "border-primary/20 bg-card/90 text-foreground" : "ml-auto border-accent/20 bg-primary text-primary-foreground"}`}>
            <div className="mb-1 text-xs uppercase tracking-wide opacity-70">{message.role === "assistant" ? "Sistema" : "Usuario"}</div>
            <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generando respuesta…
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-border/50 bg-background/40 px-6 py-4 backdrop-blur">
        <div className="flex items-end gap-3 rounded-2xl border border-border/60 bg-card/80 p-3">
          <textarea
            className="min-h-24 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Escribe el prompt, pega el tema o prepara un hilo para X…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" size="icon" disabled={isLoading || !draft.trim()}>
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

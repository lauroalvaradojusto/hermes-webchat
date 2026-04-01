"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Copy,
  FileText,
  FolderOpen,
  Globe,
  Lock,
  LogIn,
  Loader2,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  SendHorizonal,
  Settings2,
  X,
} from "lucide-react";
import { isApprovedGoogleEmail } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

type AttachedFile = {
  file: File;
  id: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  fileName?: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
};

function newChatSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [],
    createdAt: new Date().toISOString(),
  };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground"
      title="Copy message"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 w-fit rounded-2xl border border-border bg-card">
      <span className="dot-bounce dot-bounce-1 w-2 h-2 rounded-full bg-muted-foreground inline-block" />
      <span className="dot-bounce dot-bounce-2 w-2 h-2 rounded-full bg-muted-foreground inline-block" />
      <span className="dot-bounce dot-bounce-3 w-2 h-2 rounded-full bg-muted-foreground inline-block" />
    </div>
  );
}

function WelcomeScreen({ onQuickAction }: { onQuickAction: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4 text-center py-20">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
        <MessageSquare className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">What can I help you with?</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Ask anything — I can search the web, analyze files, and more.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
        {[
          { label: "Search the web", prompt: "Search the web for the latest AI news" },
          { label: "Upload a file", prompt: "I want to analyze a file" },
          { label: "Create content", prompt: "Help me create content for my project" },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => onQuickAction(item.prompt)}
            className="px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary transition-colors text-sm font-medium text-foreground"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      <div className="max-w-[85%] space-y-1">
        <div
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-foreground"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    if (match) {
                      return (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-lg text-xs"
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      );
                    }
                    return (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          {!isUser && (
            <div className="absolute top-2 right-2">
              <CopyButton text={message.content} />
            </div>
          )}
        </div>
        <div className={`text-[11px] text-muted-foreground px-1 ${isUser ? "text-right" : "text-left"}`}>
          {timeAgo}
        </div>
      </div>
    </div>
  );
}

export function HermesInterface() {
  const initialSession = newChatSession();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSession.id);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [backendUrl, setBackendUrl] = useState("http://localhost:8080");
  const [model, setModel] = useState("opencode/claude-opus-4-6");
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = chatSessions.find((s) => s.id === activeSessionId) ?? chatSessions[0];
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    let mounted = true;

    // Handle auth tokens from URL hash (when Supabase redirects back with tokens)
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(hash.replace("#", ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        supabaseBrowser.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.location.hash = "";
      }
    }

    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setAuthSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setAuthSession(nextSession);
      setAuthLoading(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const approved = isApprovedGoogleEmail(authSession?.user?.email);

  useEffect(() => {
    if (authSession && !approved) {
      setAuthError("Your Google account is not authorized for Hermes.");
      void supabaseBrowser.auth.signOut();
    }
  }, [authSession, approved]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const updateActiveSession = useCallback((updater: (s: ChatSession) => ChatSession) => {
    setChatSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? updater(s) : s))
    );
  }, [activeSessionId]);

  const sendMessage = useCallback(async (text: string, files: AttachedFile[] = []) => {
    const value = text.trim();
    if ((!value && files.length === 0) || busy) return;

    setPrompt("");
    setAttachedFiles([]);
    setBusy(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: value || `(Attached ${files.length} file${files.length > 1 ? "s" : ""})`,
      createdAt: new Date().toISOString(),
      fileName: files.length > 0 ? files.map((f) => f.file.name).join(", ") : undefined,
    };

    let historyForRequest: ChatMessage[] = [];
    setChatSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const updated = [...s.messages, userMsg];
        historyForRequest = updated;
        return {
          ...s,
          messages: updated,
          title: s.messages.length === 0 ? (value || files[0]?.file.name || "File upload").slice(0, 40) : s.title,
        };
      })
    );

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setChatSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, assistantMsg] }
          : s
      )
    );

    try {
      // Read files as base64 if present
      let filesData: Array<{ name: string; type: string; content: string }> = [];
      if (files.length > 0) {
        filesData = await Promise.all(
          files.map(async (af) => {
            const buffer = await af.file.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
            );
            return { name: af.file.name, type: af.file.type, content: base64 };
          })
        );
      }

      const { data: { session: latestSession } } = await supabaseBrowser.auth.getSession();
      const accessToken = latestSession?.access_token ?? authSession?.access_token;

      if (latestSession?.access_token && latestSession.access_token !== authSession?.access_token) {
        setAuthSession(latestSession);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          message: value,
          history: historyForRequest.map(({ role, content }) => ({ role, content })),
          model,
          search: searchEnabled,
          files: filesData,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const payload = await response.json().catch(() => null);
          setAuthError(payload?.error || "Your session is not authorized for Hermes.");
          setBusy(false);
          return;
        }
        throw new Error("Request failed");
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          const lines = decoder.decode(chunk, { stream: true }).split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const token =
                parsed.choices?.[0]?.delta?.content ||
                parsed.token ||
                parsed.content ||
                "";
              accumulated += token;
              setChatSessions((prev) =>
                prev.map((s) =>
                  s.id === activeSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === assistantMsgId ? { ...m, content: accumulated } : m
                        ),
                      }
                    : s
                )
              );
            } catch {}
          }
        }
      } else {
        const data = await response.json();
        const answer = data.response || data.message || "Response processed.";
        setChatSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: answer } : m
                  ),
                }
              : s
          )
        );
      }
    } catch {
      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content:
                          "Hermes is in local mode. Connect HERMES_API_URL for real responses.",
                      }
                    : m
                ),
              }
            : s
        )
      );
    } finally {
      setBusy(false);
    }
  }, [busy, activeSessionId, authSession, model, searchEnabled]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendMessage(prompt, attachedFiles);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void sendMessage(prompt, attachedFiles);
    }
  };

  const createNewChat = useCallback(() => {
    const chat = newChatSession();
    setChatSessions((prev) => [chat, ...prev]);
    setActiveSessionId(chat.id);
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createNewChat();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [createNewChat]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setAuthError(error.message);
  };

  const handleSignOut = async () => {
    setAuthError(null);
    await supabaseBrowser.auth.signOut();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground">Verifying access…</span>
        </div>
      </div>
    );
  }

  if (!authSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-background via-background to-secondary/20" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Lock className="h-3.5 w-3.5" /> Restricted access
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Hermes AI</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Sign in with an approved Google account to continue.
          </p>
          {authError && (
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {authError}
            </div>
          )}
          <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-4 text-sm">
            <div className="font-medium text-foreground mb-2">Allowed accounts</div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• lauroalvarado@gmail.com</li>
              <li>• desarrolladorassitantsai@gmail.com</li>
            </ul>
          </div>
          <Button className="mt-6 w-full" onClick={handleGoogleSignIn}>
            <LogIn className="mr-2 h-4 w-4" /> Continue with Google
          </Button>
        </div>
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <Lock className="h-3.5 w-3.5" /> Access denied
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Account not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This Google account is not on the approved list for Hermes.
          </p>
          <Button className="mt-6 w-full" variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const showTypingDots =
    busy &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role !== "assistant" ||
      messages[messages.length - 1]?.content === "");

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-background via-background to-secondary/20" />

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col border-r border-border bg-card transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Hermes AI</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 rounded hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2">
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors border border-border"
          >
            <Plus className="h-4 w-4" /> New Chat
            <span className="ml-auto text-[10px] text-muted-foreground">⌘N</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {chatSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }}
              className={`flex flex-col w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                s.id === activeSessionId
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <span className="truncate font-medium">{s.title}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <div className="text-xs text-muted-foreground truncate">{authSession.user.email}</div>
          <button
            onClick={handleSignOut}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="relative z-10 flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="font-semibold text-sm truncate flex-1">
            {activeSession.title === "New Chat" && messages.length === 0
              ? "New Chat"
              : activeSession.title}
          </h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Settings"
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </header>

        {/* Settings panel */}
        {showSettings && (
          <div className="border-b border-border bg-card/80 px-4 py-3 max-w-[90vw] self-center w-full">
            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Backend URL:
                <input
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary w-48"
                  placeholder="http://localhost:8080"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Model:
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary w-48"
                  placeholder="opencode/claude-opus-4-6"
                />
              </label>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto w-full space-y-4 min-h-full">
            {messages.length === 0 ? (
              <WelcomeScreen onQuickAction={(text) => void sendMessage(text)} />
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
            )}
            {showTypingDots && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card/50 backdrop-blur-sm px-4 py-3">
          <form
            onSubmit={onSubmit}
            className="max-w-2xl mx-auto w-full rounded-xl border border-border bg-background p-3"
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.pdf,.csv,.docx,.xlsx,.pptx,.md,.json,.xml,.html,.py,.js,.ts,.tsx,.jsx,.css,.sql,.yaml,.yml,.toml,.ini,.cfg,.log,.rtf"
              className="hidden"
              onChange={(e) => {
                const fileList = e.target.files;
                if (!fileList || fileList.length === 0) return;
                const MAX_SIZE = 10 * 1024 * 1024; // 10MB
                const MAX_FILES = 3;
                const oversized = Array.from(fileList).find((f) => f.size > MAX_SIZE);
                if (oversized) {
                  alert(`"${oversized.name}" exceeds 10MB limit`);
                  e.target.value = "";
                  return;
                }
                const newFiles: AttachedFile[] = Array.from(fileList).map((f) => ({
                  file: f,
                  id: crypto.randomUUID(),
                }));
                setAttachedFiles((prev) => {
                  const combined = [...prev, ...newFiles];
                  if (combined.length > MAX_FILES) {
                    alert(`Maximum ${MAX_FILES} files allowed`);
                    return prev;
                  }
                  return combined;
                });
                // Reset input so same file can be re-selected
                e.target.value = "";
              }}
            />

            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                {attachedFiles.map((af) => (
                  <div
                    key={af.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/25 text-xs text-green-300 max-w-[240px]"
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-green-400" />
                    <span className="truncate font-medium">{af.file.name}</span>
                    <span className="text-green-500/70">{(af.file.size / 1024).toFixed(0)}KB</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== af.id))}
                      className="shrink-0 hover:text-red-400 transition-colors ml-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedFiles.length > 0 ? "Add a message about the attached files (optional)…" : "Message Hermes…"}
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="text-[11px] text-muted-foreground hidden sm:block select-none">
                ⌘↵ send · ⌘N new chat
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title={attachedFiles.length > 0 ? `${attachedFiles.length} file(s) attached` : "Attach files"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    attachedFiles.length > 0
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "hover:bg-secondary text-muted-foreground border-transparent"
                  }`}
                >
                  <Paperclip className={`h-3.5 w-3.5 ${attachedFiles.length > 0 ? "fill-green-400" : ""}`} />
                  <span className="hidden sm:inline">
                    {attachedFiles.length > 0 ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached` : "Attach"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchEnabled(!searchEnabled)}
                  title="Toggle web search"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    searchEnabled
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "hover:bg-secondary text-muted-foreground border-transparent"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Search</span>
                </button>
                <Button type="submit" size="sm" disabled={busy || (!prompt.trim() && attachedFiles.length === 0)} className="h-8">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

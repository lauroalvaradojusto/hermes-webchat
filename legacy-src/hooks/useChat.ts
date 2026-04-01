import { useState, useEffect, useCallback } from "react";
import { useAuth, supabase } from "@/contexts/AuthContext";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  file?: { name: string; type: string; url?: string; };
}

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const BACKEND_URL = import.meta.env.VITE_HERMES_API_URL || 'http://localhost:8080';
const MAX_SESSIONS = 15;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useChat() {
  const { user, profile, refreshProfile } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [needsTwitterCredentials, setNeedsTwitterCredentials] = useState(false);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  // Check session timeout
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getTime() - lastActivity.getTime() > SESSION_TIMEOUT_MS) {
        handleNewChat();
        setLastActivity(new Date());
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastActivity]);

  useEffect(() => {
    if (user) loadChatHistory();
  }, [user]);

  const loadChatHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(MAX_SESSIONS);
      if (error) throw error;
      setChats(data || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setChats([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadChat = async (chatId: string) => {
    if (!user) return;
    setCurrentChatId(chatId);
    setIsLoading(true);
    setLastActivity(new Date());
    try {
      const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
      setMessages((data || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        file: msg.file_name ? { name: msg.file_name, type: msg.file_type || 'application/octet-stream', url: msg.file_url } : undefined,
      })));
    } catch (error) {
      console.error('Error loading chat:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setLastActivity(new Date());
  };

  const sendMessage = async (content: string) => {
    if (!user || (!content.trim() && selectedFiles.length === 0)) return;
    if ((profile?.credits ?? 0) <= 0 && !profile?.unlimited_credits) {
      setNeedsCredits(true);
      return;
    }

    setLastActivity(new Date());

    // Build user message content with file names
    let messageContent = content;
    if (selectedFiles.length > 0) {
      const fileNames = selectedFiles.map(f => f.name).join(', ');
      messageContent = content ? `${content}\n\nArchivos adjuntos: ${fileNames}` : `Analiza estos archivos: ${fileNames}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      file: selectedFiles.length > 0 ? { name: selectedFiles[0].name, type: selectedFiles[0].type } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Read file contents and encode to base64
      const filesData = await Promise.all(selectedFiles.map(async (file) => {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64Content = base64.split(',')[1];

        return {
          name: file.name,
          type: file.type,
          content: base64Content
        };
      }));

      const endpoint = selectedFiles.length > 0
        ? `${BACKEND_URL}/api/v1/chat/analyze-file`
        : `${BACKEND_URL}/api/v1/chat/deepseek`;

      const requestBody = selectedFiles.length > 0
        ? { message: content, files: filesData, userId: user.id }
        : { message: content, chatId: currentChatId, userId: user.id };

      let response: Response;
      let data: any;

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': import.meta.env.VITE_HERMES_API_KEY || ''
          },
          body: JSON.stringify(requestBody)
        });

        // If file endpoint returns 404, fallback to regular chat
        if (response.status === 404 && selectedFiles.length > 0) {
          console.warn('File analysis endpoint not available, using fallback');

          const fallbackMessage = content + '\n\n[Archivos adjuntos: ' +
            selectedFiles.map(f => `${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join(', ') +
            ']\n\nNota: El análisis de archivos está temporalmente deshabilitado. Los archivos se han recibido pero no se pueden procesar hasta que Railway se conecte al repositorio GitHub.';

          response = await fetch(`${BACKEND_URL}/api/v1/chat/deepseek`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': import.meta.env.VITE_HERMES_API_KEY || ''
            },
            body: JSON.stringify({ message: fallbackMessage, chatId: currentChatId, userId: user.id })
          });
        }

        data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || `Backend error: ${response.status}`);
        }
      } catch (error: any) {
        console.error('Error sending message:', error);
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error de conexión: ${error.message}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setIsLoading(false);
        setSelectedFiles([]);
        return;
      }


      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'Respuesta procesada.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Clear files after sending
      setSelectedFiles([]);

      await refreshProfile();
    } catch (error) {
      console.error('Error sending message:', error);
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error de conexión. El backend está en configuración.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    setLastActivity(new Date());

    // Validate file size (50 MB max)
    if (file.size > 50 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 50 MB.');
      return;
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    const fileExtension = file.name.toLowerCase().split('.').pop();
    const validExtensions = ['pdf', 'docx', 'csv', 'pptx'];

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension || '')) {
      alert('Tipo de archivo no soportado. Solo se permiten: PDF, DOCX, CSV, PPTX.');
      return;
    }

    // Validate file count (max 3)
    if (selectedFiles.length >= 3) {
      alert('Máximo 3 archivos por mensaje.');
      return;
    }

    setSelectedFiles(prev => [...prev, file]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!profile?.twitter_username) { setNeedsTwitterCredentials(true); return; }
    if ((profile?.credits ?? 0) < 10 && !profile?.unlimited_credits) { setNeedsCredits(true); return; }
    console.log('Publish triggered');
  };

  const handleGeneratePdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text('Conversacion', 20, y);
      y += 10;
      doc.setFontSize(10);
      messages.forEach(msg => {
        const prefix = msg.role === 'user' ? 'Tu: ' : 'AI: ';
        const lines = doc.splitTextToSize(prefix + msg.content, 170);
        lines.forEach((line: string) => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(line, 20, y);
          y += 6;
        });
        y += 4;
      });
      doc.save('chat.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleCancelPublish = () => console.log('Cancel publish');
  const closeTwitterModal = () => setNeedsTwitterCredentials(false);
  const closeCreditsModal = () => setNeedsCredits(false);

  return {
    messages, isLoading, sendMessage, handleFileUpload, handlePublish, handleGeneratePdf, handleCancelPublish,
    needsTwitterCredentials, needsCredits, closeTwitterModal, closeCreditsModal,
    chats, currentChatId, isLoadingHistory, loadChat, handleNewChat,
    selectedFiles, removeFile,
  };
}

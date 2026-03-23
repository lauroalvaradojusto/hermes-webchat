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
    if (!user || !content.trim()) return;
    if ((profile?.credits ?? 0) <= 0 && !profile?.unlimited_credits) {
      setNeedsCredits(true);
      return;
    }

    setLastActivity(new Date());
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/chat/deepseek`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_HERMES_API_KEY || ''
        },
        body: JSON.stringify({ message: content, chatId: currentChatId, userId: user.id })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || `Backend error: ${response.status}`);
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'Respuesta procesada.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
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

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    setLastActivity(new Date());
    // TODO: Implement file upload to Supabase Storage
    console.log('File upload:', file.name, file.size);
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
  };
}

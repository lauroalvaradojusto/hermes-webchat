import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { UserSettingsPanel } from "@/components/settings/UserSettingsPanel";
import { TwitterCredentialsModal } from "@/components/modals/TwitterCredentialsModal";
import { CreditsRequiredModal } from "@/components/modals/CreditsRequiredModal";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import RandomShaderBackground from "@/components/ui/random-shader-background";
import { Settings, MessageSquare, Loader2 } from "lucide-react";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const { 
    messages, 
    isLoading: chatLoading, 
    sendMessage, 
    handlePublish, 
    handleGeneratePdf,
    handleCancelPublish,
    handleFileUpload,
    needsTwitterCredentials,
    needsCredits,
    closeTwitterModal,
    closeCreditsModal,
    chats,
    currentChatId,
    isLoadingHistory,
    loadChat,
    handleNewChat,
  } = useChat();

  if (loading) {
    return (
      <div className="min-h-screen chat-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen relative flex">
      {/* Random Shader Background */}
      <RandomShaderBackground />
      
      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showSettings ? 'lg:mr-96' : ''}`}>
        <ChatContainer
          messages={messages}
          onSendMessage={sendMessage}
          onFileUpload={handleFileUpload}
          onPublish={handlePublish}
          onGeneratePdf={handleGeneratePdf}
          onCancelPublish={handleCancelPublish}
          isLoading={chatLoading}
          isConfigured={true}
        />
      </div>

      {/* Settings Toggle Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className={`fixed top-6 right-6 z-50 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
          showSettings 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50'
        }`}
      >
        {showSettings ? <MessageSquare className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
      </button>

      {/* Settings Panel */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-card border-l border-border/50 transform transition-transform duration-300 z-40 ${
        showSettings ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <UserSettingsPanel 
          chats={chats}
          currentChatId={currentChatId}
          isLoadingHistory={isLoadingHistory}
          onSelectChat={loadChat}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Overlay for mobile */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* Modals */}
      <TwitterCredentialsModal
        isOpen={needsTwitterCredentials}
        onClose={closeTwitterModal}
        onSuccess={closeTwitterModal}
      />

      <CreditsRequiredModal
        isOpen={needsCredits}
        onClose={closeCreditsModal}
        credits={profile?.credits || 0}
      />
    </div>
  );
};

export default Index;

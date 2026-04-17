import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Sparkles, User, Bot, Loader2, ChevronDown, ChevronRight } from "lucide-react";

import { streamChatMessage, uploadDocument, type ApiSource } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ApiSource[];
  memoryHits?: number;
}

const ChatView = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "I'm your personal AI — connected to everything you've stored in PDOS. Ask me anything about your notes, documents, or ideas. I'll find the answers in your data.",
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isStreaming || isUploadingDocument;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isBusy) return;

    setError(null);
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const assistantId = `${Date.now()}-assistant`;
    setMessages((prev) => [...prev, userMsg]);
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        sources: [],
        memoryHits: 0,
      },
    ]);
    setInput("");
    setIsStreaming(true);

    try {
      await streamChatMessage(userMsg.content, conversationId, {
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: `${msg.content}${token}`,
                  }
                : msg,
            ),
          );
        },
        onDone: (payload) => {
          setConversationId(payload.conversationId || conversationId);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    sources: payload.sources,
                    memoryHits: payload.memoryHits,
                    content: msg.content.trim() || "I could not generate a response.",
                  }
                : msg,
            ),
          );
        },
      });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Failed to send message";
      setError(message);
      setMessages((prev) => [
        ...prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `I could not process that request: ${message}`,
              }
            : msg,
        ),
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const toggleMessageSources = (messageId: string) => {
    setExpandedMessageIds((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setError(null);
    setIsUploadingDocument(true);
    try {
      const uploaded = await uploadDocument(selectedFile);
      const processingStatus = uploaded.status === "ready" || uploaded.status === "indexed" ? "ready" : uploaded.status;
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-upload`,
          role: "assistant",
          content:
            processingStatus === "ready"
              ? `Uploaded and indexed ${uploaded.fileName} with ${uploaded.chunks} chunks. You can ask questions about it now.`
              : `Uploaded ${uploaded.fileName}. It is currently ${processingStatus}; ask in a few seconds while indexing finishes.`,
          sources: [
            {
              sourceId: uploaded.id,
              sourceType: "document",
              label: `Document: ${uploaded.fileName}`,
              score: 1,
              confidence: 1,
              excerpt: uploaded.extractedText ? uploaded.extractedText.slice(0, 180) : "Document queued for indexing.",
            },
          ],
        },
      ]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setIsUploadingDocument(false);
      event.target.value = "";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="h-13 flex items-center justify-center px-6 shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">Chat</span>
          <span className="text-xs text-muted-foreground ml-1">· Searches your entire knowledge base</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="space-y-3"
              >
                {/* Role label */}
                <div className="flex items-center gap-2">
                  {msg.role === "user" ? (
                    <>
                      <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center">
                        <User className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">You</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">PDOS</span>
                    </>
                  )}
                </div>

                {/* Content */}
                <div className={`pl-7 ${msg.role === "assistant" ? "" : ""}`}>
                  <p className="text-[14.5px] text-foreground/90 leading-[1.7] whitespace-pre-wrap">{msg.content}</p>

                  {/* Sources */}
                  {msg.memoryHits && msg.memoryHits > 0 && (
                    <div className="mt-3 inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Memory hits: {msg.memoryHits}
                    </div>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4">
                      <button
                        onClick={() => toggleMessageSources(msg.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedMessageIds[msg.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {msg.sources.length} sources
                      </button>

                      {expandedMessageIds[msg.id] && (
                        <div className="mt-2 space-y-2">
                          {msg.sources.map((source, index) => (
                            <div key={`${source.sourceId}-${index}`} className="rounded-lg border border-glass-border/20 bg-surface-1/60 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium text-foreground">{source.label}</p>
                                <span className="text-[10px] text-muted-foreground">
                                  confidence {(source.confidence ?? source.score).toFixed(2)}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{source.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading */}
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                </div>
                <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">PDOS</span>
              </div>
              <div className="pl-7 flex items-center gap-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/40"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground ml-2">Searching your knowledge base...</span>
              </div>
            </motion.div>
          )}

          {isUploadingDocument && (
            <p className="pl-7 text-xs text-warning">Uploading and indexing document...</p>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 pb-6">
        <div className="max-w-2xl mx-auto">
          <div className="glass-panel rounded-2xl p-1.5 flex items-end gap-1 focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_0_20px_-5px_hsl(var(--primary)/0.1)] transition-shadow duration-300">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={handleFileSelection}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-surface-2 shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your data..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none outline-none py-2.5 px-1 max-h-32 leading-relaxed"
            />
            <motion.button
              onClick={handleSend}
              disabled={!input.trim() || isBusy}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-xl bg-gradient-to-r from-primary to-primary text-primary-foreground transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 hover:glow-sm-primary"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;

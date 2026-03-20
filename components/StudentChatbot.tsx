"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Paperclip, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner"; // Using what's presumably standard from package.json

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  file?: File;
  fileUrl?: string; // object URL for preview
}

export function StudentChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [documentText, setDocumentText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error("Unsupported file type. Please upload a PDF, PNG, or JPG.");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error("File is too large (max 10MB).");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const currentFile = file;
    const currentText = input.trim();
    
    setInput("");
    setFile(null);
    setIsLoading(true);

    try {
      let documentUploaded = false;
      // Local var to hold text from THIS submit cycle (React state lags)
      let currentDocText = documentText;
      
      // 1. Process File Upload
      if (currentFile) {
        toast.info("Uploading and processing document...");
        
        // Optimistic UI for file validation
        const fileMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          text: "Uploaded a document for my knowledge base.",
          file: currentFile,
          fileUrl: URL.createObjectURL(currentFile)
        };
        setMessages(prev => [...prev, fileMessage]);

        const uploadData = new FormData();
        uploadData.append("file", currentFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });

        const uploadResult = await uploadRes.json();
        
        if (!uploadRes.ok) throw new Error(uploadResult.error || "Failed to process document.");
        
        // Store the full extracted text in React state AND local var
        currentDocText = uploadResult.text || "";
        setDocumentText(currentDocText);
        documentUploaded = true;
        toast.success(`Document added! Extracted ${uploadResult.chunks?.length ?? 0} chunks (${uploadResult.charCount} chars).`);
      }

      // 2. Process Chat Prompt
      if (currentText) {
        const userMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "user",
          text: currentText,
        };
        
        setMessages(prev => [...prev, userMessage]);

        const chatData = new FormData();
        chatData.append("prompt", currentText);
        // Pass the full document text directly — no vector DB needed
        if (currentDocText) {
          chatData.append("documentText", currentDocText);
        }

        const chatRes = await fetch("/api/chat", {
          method: "POST",
          body: chatData,
        });

        const chatDataJson = await chatRes.json();

        if (!chatRes.ok) {
          throw new Error(chatDataJson.error || "Failed to fetch response");
        }

        const botMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "bot",
          text: chatDataJson.text || "No response generated.",
        };

        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error: any) {
      toast.error(error.message);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "bot",
        text: "Error: " + error.message
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragConstraints={{ left: -1000, right: 0, top: -1000, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-80 sm:w-96 h-[500px] max-h-[80vh] mb-4 bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary p-4 flex justify-between items-center text-primary-foreground">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <h3 className="font-semibold">Student Assistant</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:text-black hover:bg-white/20" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-4 overflow-y-auto no-scrollbar" ref={scrollRef}>
              <div className="flex flex-col gap-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground mt-10 p-4">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Hi! I'm your AI tutor. Ask me a question or upload a document for help.</p>
                  </div>
                )}
                
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted rounded-bl-sm'
                    }`}>
                      {msg.fileUrl && (
                        <div className="mb-2">
                          {msg.file?.type.startsWith('image/') ? (
                            <img src={msg.fileUrl} alt="uploaded" className="max-w-full rounded-md border" />
                          ) : (
                            <div className="flex items-center gap-2 text-xs bg-white/20 p-2 rounded-md">
                              <Paperclip className="w-4 h-4" />
                              <span className="truncate max-w-[150px]">{msg.file?.name}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className={`prose ${msg.role === 'user' ? 'prose-invert prose-p:text-primary-foreground' : 'dark:prose-invert'} prose-sm max-w-none break-words`}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted max-w-[80%] rounded-2xl rounded-bl-sm p-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-3 bg-card border-t flex flex-col gap-2">
              {file && (
                <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md text-sm border border-border">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Paperclip className="w-4 h-4 shrink-0" />
                    <span className="truncate text-xs">{file.name}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => setFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2 relative">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-10 w-10 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Paperclip className="w-5 h-5 text-muted-foreground" />
                </Button>
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpeg,.jpg"
                  disabled={isLoading}
                />
                <Input
                  placeholder="Ask a question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  className="rounded-full shadow-none border-muted-foreground/30 focus-visible:ring-1 pr-10"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="absolute right-1 shrink-0 h-8 w-8 rounded-full"
                  disabled={isLoading || (!input.trim() && !file)}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground flex flex-col justify-center items-center hover:bg-primary/90 transition-colors"
      >
        <AnimatePresence mode="popLayout">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

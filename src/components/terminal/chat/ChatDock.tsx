import React, { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { marked } from "marked";
import {
  Bot,
  BotMessageSquare,
  Maximize2,
  Minus,
  RotateCcw,
  SendIcon,
  StopCircle,
  X,
} from "lucide-react";
import { useChatStore } from "@stores/chatStore";
import "./chat.css";

export function ChatDock() {
  // Select all needed slices in one selector and shallow-compare to cut down on re-renders.
  const {
    messages,
    input,
    loading,
    isOpen,
    isMinimized,
    unread,
    tone,
    setInput,
    setTone,
    sendMessage,
    clear,
    openChat,
    toggleChat,
    minimizeChat,
    cancel,
    markRead,
  } = useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      input: state.input,
      loading: state.loading,
      isOpen: state.isOpen,
      isMinimized: state.isMinimized,
      unread: state.unread,
      tone: state.tone,
      setInput: state.setInput,
      setTone: state.setTone,
      sendMessage: state.sendMessage,
      clear: state.clear,
      openChat: state.openChat,
      toggleChat: state.toggleChat,
      minimizeChat: state.minimizeChat,
      cancel: state.cancel,
      markRead: state.markRead,
    })),
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    if (unread > 0) markRead();
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized, markRead, unread]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isMinimized) {
        e.preventDefault();
        minimizeChat();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isMinimized, toggleChat, minimizeChat]);

  useEffect(() => {
    if (!isOpen) setIsMaximized(false);
  }, [isOpen]);

  const hasStreamingChunk = useMemo(
    () => messages.some((m) => m.id === "streaming"),
    [messages],
  );

  const showTypingIndicator = loading && !hasStreamingChunk;

  const tonePresets = useMemo(
    () => [
      {
        key: "technical" as const,
        label: "Technical",
        helper: "Concise, code-first",
      },
      {
        key: "non-technical" as const,
        label: "Non-technical",
        helper: "Plain language",
      },
    ],
    [],
  );

  const hasUserMessages = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages],
  );

  const handleTonePreset = (presetKey: "technical" | "non-technical") => {
    const preset = tonePresets.find((p) => p.key === presetKey);
    if (!preset) return;
    setTone(preset.key);
  };

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        const roleClass =
          message.role === "user"
            ? "chat-bubble user"
            : message.role === "assistant"
              ? "chat-bubble bot"
              : "chat-bubble intro";
        return (
          <div key={message.id} className={roleClass}>
            {message.role === "assistant" && (
              <span className="chat-avatar" aria-hidden="true">
                <Bot size={18} />
              </span>
            )}
            {message.role === "assistant" ? (
              <div
                className="chat-content"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(message.content || ""),
                }}
              />
            ) : (
              <div className="chat-content">{message.content}</div>
            )}
          </div>
        );
      }),
    [messages],
  );

  const send = async () => {
    await sendMessage();
    focusInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      minimizeChat();
    }
  };

  const docked = isMinimized || !isOpen;

  return (
    <>
      <button
        className={`chat-fab${docked ? "" : " is-active"}`}
        aria-label="Open chatbot"
        onClick={() => {
          openChat();
          focusInput();
        }}
      >
        <BotMessageSquare size={20} strokeWidth={2.2} />
        {unread > 0 ? <span className="chat-fab-unread">{unread}</span> : null}
      </button>

      {isOpen && !isMinimized ? (
        <div
          className={`chat-wrap${isMaximized ? " is-maximized" : ""}`}
          role="dialog"
          aria-modal="false"
          onClick={focusInput}
        >
          <div className={`chat-window${isMaximized ? " is-maximized" : ""}`}>
            <div className="chat-header">
              <div className="chat-title">
                <Bot size={18} />
                <span>CV-Bot</span>
              </div>
              <div className="chat-actions">
                <button
                  className={`ghost t-pressable${isMaximized ? " is-active" : ""}`}
                  title={isMaximized ? "Restore size" : "Maximize"}
                  aria-label={isMaximized ? "Restore chatbot size" : "Maximize chatbot"}
                  onClick={() => setIsMaximized((prev) => !prev)}
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  className="ghost t-pressable"
                  title="Clear"
                  aria-label="Clear conversation"
                  onClick={clear}
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  className="ghost t-pressable"
                  title="Minimize"
                  aria-label="Minimize chatbot"
                  onClick={minimizeChat}
                >
                  <Minus size={16} />
                </button>
                <button
                  className="ghost t-pressable"
                  title="Close"
                  aria-label="Hide chatbot"
                  onClick={toggleChat}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="chat-body" ref={listRef}>
              {renderedMessages}
              {!hasUserMessages ? (
                <div className="chat-suggestions" role="list">
                  {tonePresets.map((preset) => (
                    <button
                      key={preset.key}
                      role="listitem"
                      className={`chat-suggestion${tone === preset.key ? " is-active" : ""}`}
                      onClick={() => handleTonePreset(preset.key)}
                      aria-pressed={tone === preset.key}
                    >
                      <span className="chat-suggestion-label">{preset.label}</span>
                      <span className="chat-suggestion-helper">{preset.helper}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {showTypingIndicator ? (
                <div className="chat-bubble bot">
                  <span className="chat-avatar" aria-hidden="true">
                    <Bot size={18} />
                  </span>
                  <div className="chat-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-inputRow">
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Ask anything about Milad—technical or not."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="chat-send t-pressable"
                onClick={loading ? cancel : send}
                aria-label={loading ? "Stop response" : "Send message"}
                disabled={loading ? false : !input.trim()}
              >
                {loading ? <StopCircle size={18} /> : <SendIcon size={18} />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default ChatDock;

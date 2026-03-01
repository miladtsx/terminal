import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { sendTelemetryEvent } from "@hooks/useTelemetry";

type ChatRole = "assistant" | "user";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

type ChatTone = "technical" | "non-technical" | null;

type ChatStatus = {
  isOpen: boolean;
  isMinimized: boolean;
  maximizeOnOpen: boolean;
  loading: boolean;
  input: string;
  unread: number;
  error?: string | null;
  tone: ChatTone;
};

type ChatStore = ChatStatus & {
  messages: ChatMessage[];
  sendMessage: (text?: string) => Promise<void>;
  setInput: (value: string) => void;
  setTone: (tone: ChatTone) => void;
  clear: () => void;
  openChat: () => void;
  openChatMaximized: () => void;
  closeChat: () => void;
  minimizeChat: () => void;
  toggleChat: () => void;
  markRead: () => void;
  cancel: () => void;
  setMaximizeOnOpen: (value: boolean) => void;
};

const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL;

const uuid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

// Lightweight IndexedDB storage for zustand persist.
const createIdbStorage = () => {
  if (typeof indexedDB === "undefined") return null;

  const dbName = "terminal-chatbot";
  const storeName = "state";

  const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const run = async <T>(
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = op(store);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  };

  return {
    async getItem(name: string) {
      return run<string | null>("readonly", (s) => s.get(name));
    },
    async setItem(name: string, value: string) {
      return run("readwrite", (s) => s.put(value, name)).then(() => undefined);
    },
    async removeItem(name: string) {
      return run("readwrite", (s) => s.delete(name)).then(() => undefined);
    },
  };
};

const idbStorage = createIdbStorage();

const storage = createJSONStorage(() => {
  if (idbStorage) return idbStorage;
  // Fallback to localStorage if IndexedDB is unavailable.
  return {
    getItem: (name: string) =>
      Promise.resolve(
        typeof window !== "undefined" ? localStorage.getItem(name) : null,
      ),
    setItem: (name: string, value: string) =>
      Promise.resolve(
        typeof window !== "undefined"
          ? localStorage.setItem(name, value)
          : undefined,
      ),
    removeItem: (name: string) =>
      Promise.resolve(
        typeof window !== "undefined"
          ? localStorage.removeItem(name)
          : undefined,
      ),
  };
});

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => {
      let abortController: AbortController | null = null;

      const pushAssistantChunk = (chunk: string) => {
        set((state) => {
          const messages = [...state.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant" && last.id === "streaming") {
            messages[messages.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          } else {
            messages.push({
              id: "streaming",
              role: "assistant",
              createdAt: Date.now(),
              content: chunk,
            });
          }
          return {
            messages,
            loading: true,
            unread:
              state.isOpen && !state.isMinimized
                ? state.unread
                : state.unread + 1,
          };
        });
      };

      const finalizeAssistant = () => {
        set((state) => {
          const messages = [...state.messages];
          const last = messages[messages.length - 1];
          if (last?.id === "streaming") {
            messages[messages.length - 1] = { ...last, id: uuid() };
          }
          return { messages, loading: false };
        });
      };

      return {
        messages: [],
        isOpen: false,
        isMinimized: false,
        maximizeOnOpen: false,
        loading: false,
        input: "",
        unread: 0,
        error: null,
        tone: null,
        setMaximizeOnOpen: (value: boolean) => set({ maximizeOnOpen: value }),
        setInput: (value: string) => set({ input: value }),
        setTone: (tone: ChatTone) => set({ tone }),
        markRead: () => set((state) => (state.unread ? { unread: 0 } : {})),
        openChat: () =>
          set((state) => ({
            isOpen: true,
            isMinimized: false,
            unread: 0,
            error: null,
            maximizeOnOpen: false,
            // leave messages as-is
          })),
        openChatMaximized: () =>
          set(() => ({
            isOpen: true,
            isMinimized: false,
            unread: 0,
            error: null,
            maximizeOnOpen: true,
          })),
        closeChat: () =>
          set(() => ({
            isOpen: false,
            isMinimized: false,
          })),
        minimizeChat: () =>
          set((state) => ({
            ...state,
            isMinimized: true,
            isOpen: false,
          })),
        toggleChat: () =>
          set((state) => ({
            isOpen: !state.isOpen || state.isMinimized,
            isMinimized: state.isOpen && !state.isMinimized ? true : false,
            unread: !state.isOpen || state.isMinimized ? 0 : state.unread,
          })),
        clear: () =>
          set(() => ({
            messages: [],
            input: "",
            unread: 0,
            loading: false,
            error: null,
          })),
        cancel: () => {
          if (abortController) {
            abortController.abort();
            abortController = null;
            set({ loading: false });
          }
        },
        sendMessage: async (text?: string) => {
          const state = get();
          const content = (text ?? state.input).trim();
          if (!content) return;

          const userMessage: ChatMessage = {
            id: uuid(),
            role: "user",
            content,
            createdAt: Date.now(),
          };

          set((prev) => ({
            messages: [...prev.messages, userMessage],
            input: "",
            loading: true,
            error: null,
          }));

          void sendTelemetryEvent({
            action: "chat_message",
            userInput: content,
            message: "chat user message",
            context: {
              tone: state.tone ?? "default",
              messageId: userMessage.id,
            },
          });

          const rawHistory = [...get().messages];
          const history = rawHistory
            .slice(-12) // avoid unnecessary bandwidth
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })); // drop id/createdAt

          abortController = new AbortController();

          try {
            const resp = await fetch(CHATBOT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tone: state.tone ?? "non-technical",
                history,
                message: content,
              }),
              signal: abortController.signal,
            });

            if (!resp.ok) {
              throw new Error(`HTTP ${resp.status}`);
            }
            const reader = resp.body?.getReader();
            if (!reader) throw new Error("Empty response body");

            const decoder = new TextDecoder("utf-8");
            const process = async (): Promise<void> => {
              const { done, value } = await reader.read();
              if (done) {
                finalizeAssistant();
                abortController = null;
                return;
              }
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.trim().split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const payload = line.slice(6);
                if (payload === "[DONE]") {
                  finalizeAssistant();
                  abortController = null;
                  return;
                }
                try {
                  const json = JSON.parse(payload);
                  const newText = json.response ?? "";
                  if (newText) pushAssistantChunk(newText);
                } catch {
                  /* ignore malformed chunks */
                }
              }
              await process();
            };

            await process();
          } catch (error) {
            console.error("chatbot error", error);
            void sendTelemetryEvent({
              action: "chat_message_error",
              userInput: content,
              message: "chatbot failed",
              level: "error",
              error,
            });
            abortController = null;
            set((prev) => ({
              loading: false,
              error:
                error instanceof Error ? error.message : "Something went wrong",
              messages: [
                ...prev.messages,
                {
                  id: uuid(),
                  role: "assistant",
                  createdAt: Date.now(),
                  content:
                    "I hit a snag reaching the server. Please try again or check your connection.",
                },
              ],
            }));
          }
        },
      };
    },
    {
      name: "chatbot-store",
      storage,
      version: 1,
    },
  ),
);

export const openChat = () => useChatStore.getState().openChat();
export const openChatMaximized = () =>
  useChatStore.getState().openChatMaximized();
export const toggleChat = () => useChatStore.getState().toggleChat();
export const minimizeChat = () => useChatStore.getState().minimizeChat();

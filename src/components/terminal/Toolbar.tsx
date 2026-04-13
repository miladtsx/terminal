import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SparklesCore } from "@components/ui/sparkles";
import { useTerminalTone } from "@hooks/useTerminalTone";
import { useSearchStore } from "@stores/searchStore";
import { openChatMaximized, useChatStore } from "@stores/chatStore";

type TerminalToolbarProps = {
  onOpenSearch: () => void;
};

export function TerminalToolbar({
  onOpenSearch,
}: TerminalToolbarProps) {
  const unread = useChatStore((state) => state.unread);
  const isChatActive = useChatStore((state) => state.isOpen && !state.isMinimized);
  const total = useSearchStore((state) => state.total);
  const query = useSearchStore((state) => state.query);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(isChatActive);
  }, [isChatActive]);

  const handleAskClick = () => {
    setIsExpanded(true);
    openChatMaximized();
    requestAnimationFrame(() => {
      const chatInput = document.querySelector<HTMLTextAreaElement>(".chat-input");
      chatInput?.focus();
    });
  };

  const hasSearchBadge = useMemo(
    () => Boolean(query.trim()) && total > 0,
    [query, total],
  );
  const searchBadgeText = useMemo(() => (total > 99 ? "99+" : total.toString()), [total]);
  const tone = useTerminalTone();
  const sparkleColor = tone === "light" ? "#0b1322" : "#e6f5ff";

  return (
    <div className="terminal-toolbar" aria-label="Quick actions">
      <button
        type="button"
        className="terminal-searchButton"
        aria-label="Open search"
        title="Open search"
        onClick={onOpenSearch}
      >
        <Search size={18} />
        {hasSearchBadge ? (
          <span className="terminal-toolbar-badge" aria-hidden="true">
            {searchBadgeText}
          </span>
        ) : null}
      </button>

      <div className="terminal-askAiSlot">
        <button
          type="button"
          className={`terminal-askAi${isExpanded ? " is-expanded" : ""}${isChatActive ? " is-active" : ""}`}
          aria-label="Open chatbot"
          title="Open chatbot"
          onClick={handleAskClick}
        >
          <span className="terminal-askAiSparkles" aria-hidden="true">
            <SparklesCore
              background="transparent"
              className="terminal-askAiSparklesCanvas"
              minSize={0.4}
              maxSize={1.4}
              particleColor={sparkleColor}
              particleDensity={120}
              speed={0.5}
            />
          </span>
          <span className="terminal-askAi-label">Ask AI</span>
          {unread > 0 ? <span className="terminal-toolbar-dot" aria-hidden="true" /> : null}
        </button>
      </div>
    </div>
  );
}

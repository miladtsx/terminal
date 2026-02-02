import { MessageCircle, Search, AArrowUp, AArrowDown, } from "lucide-react";
import { useSearchStore } from "@stores/searchStore";
import { openChat, useChatStore } from "@stores/chatStore";

type TerminalToolbarProps = {
  onOpenSearch: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
};

export function TerminalToolbar({
  onOpenSearch,
  onIncrease,
  onDecrease,
  canIncrease,
  canDecrease,
}: TerminalToolbarProps) {
  const unread = useChatStore((state) => state.unread);
  const isChatActive = useChatStore((state) => state.isOpen && !state.isMinimized);
  const total = useSearchStore((state) => state.total);
  const query = useSearchStore((state) => state.query);

  const hasSearchBadge = Boolean(query.trim()) && total > 0;
  const searchBadgeText = total > 99 ? "99+" : total.toString();

  return (
    <div className="terminal-toolbar" aria-label="Quick actions">
      <button
        type="button"
        className={`terminal-toolbar-button${isChatActive ? " is-active" : ""}`}
        aria-label="Open chatbot"
        title="Open chatbot"
        onClick={openChat}
      >
        <MessageCircle size={18} />
        {unread > 0 ? <span className="terminal-toolbar-dot" aria-hidden="true" /> : null}
      </button>

      <button
        type="button"
        className="terminal-toolbar-button"
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

      <button
        type="button"
        className="terminal-toolbar-button"
        aria-label="Increase font size"
        title="Increase font size"
        onClick={onIncrease}
        disabled={!canIncrease}
      >
        <AArrowUp size={18} />
      </button>

      <button
        type="button"
        className="terminal-toolbar-button"
        aria-label="Decrease font size"
        title="Decrease font size"
        onClick={onDecrease}
        disabled={!canDecrease}
      >
        <AArrowDown size={18} />
      </button>
    </div>
  );
}

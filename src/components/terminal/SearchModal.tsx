import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchStore } from "@stores/searchStore";
import { runSearch, sanitizeSearchQuery } from "@data/searchIndex";
import { SearchHit } from "@types";

const debounce = (fn: (...args: any[]) => void, wait = 200) => {
  let timer: number | undefined;
  return (...args: any[]) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
};

export function SearchModal({ executeCommand }: { executeCommand: (cmd: string) => void }) {
  const {
    isOpen,
    isMinimized,
    query,
    hits,
    total,
    open,
    close,
    minimize,
    setQuery,
    setResults,
    clear,
  } = useSearchStore();

  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        const focused = inputRef.current?.focus();
        console.log("[search] focus on open", { isOpen, focused });
      });
    }
  }, [isOpen]);

  // Keep focus inside the search input while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const enforceFocus = (target: EventTarget | null) => {
      if (!inputRef.current) return;
      const el = target as HTMLElement | null;
      const inModal = el?.closest?.(".t-searchModal");
      const alreadyOnInput = el === inputRef.current;
      if (inModal && !alreadyOnInput) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };

    const onFocusIn = (event: FocusEvent) => enforceFocus(event.target);
    const onPointerDown = (event: PointerEvent) => enforceFocus(event.target);

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [isOpen]);

  // ESC closes but keeps state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  const run = useMemo(
    () =>
      debounce(async (next: string) => {
        const cleaned = sanitizeSearchQuery(next);
        if (!cleaned) {
          clear();
          return;
        }
        setPending(true);
        const { hits: found, total: foundTotal } = await runSearch(cleaned);
        setResults(found, foundTotal);
        setPending(false);
      }, 180),
    [clear, setResults],
  );

  useEffect(() => {
    if (!isOpen) return;

    // Clear immediately when the query is emptied so results don't linger while the
    // debounced search waits to fire (visible when deleting via Ctrl+Backspace).
    if (!query.trim()) {
      clear();
      setPending(false);
      return;
    }

    run(query);
  }, [query, isOpen, run, clear]);

  const grouped = useMemo(() => {
    type Entry = {
      key: string;
      title: string;
      readCommand: string;
      downloadCommand?: string;
      snippets: SearchHit[];
    };

    const by: Record<string, { label: string; items: Entry[] }> = {};
    const labels: Record<SearchHit["source"], string> = {
      blog: "Blogs",
      log: "Logs",
      resume: "Resume",
      work: "Work",
    };
    hits.forEach((hit) => {
      if (!by[hit.source]) by[hit.source] = { label: labels[hit.source], items: [] };
      const key = `${hit.source}::${hit.title}::${hit.readCommand}::${hit.downloadCommand || ""}`;
      const existing = by[hit.source].items.find((entry) => entry.key === key);

      if (existing) {
        existing.snippets.push(hit);
      } else {
        by[hit.source].items.push({
          key,
          title: hit.title,
          readCommand: hit.readCommand,
          downloadCommand: hit.downloadCommand,
          snippets: [hit],
        });
      }
    });
    return by;
  }, [hits]);

  const highlightRegex = useMemo(() => {
    const cleaned = sanitizeSearchQuery(query);
    const tokens = cleaned
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((token) => `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

    return tokens.length ? new RegExp(`(${tokens.join("|")})`, "gi") : null;
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="t-searchModal" role="dialog" aria-modal="true">
      <div className="t-searchOverlay" onClick={minimize} />
      <div className="t-searchWindow">
        <div className="t-searchHeader t-searchHeader-grid">
          <div className="t-searchHeaderLeft">
            <span className="t-searchEyebrow">Search</span>
            <span className="t-searchHeading">
              {query ? `“${query}” — ${total} result${total === 1 ? "" : "s"}` : "Type to search"}
              {pending ? " · searching…" : ""}
            </span>
          </div>
          <div className="t-searchHeaderActions">
            <div className="t-searchInputWrap">
              <input
                ref={inputRef}
                className="t-searchInput"
                placeholder="e.g Rust"
                value={query}
                maxLength={50}
                onChange={(e) => {
                  const cleaned = sanitizeSearchQuery(e.target.value, { trim: false });
                  setQuery(cleaned);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  console.log("[search] input mousedown", {
                    target: e.target,
                    currentTarget: e.currentTarget,
                    alreadyFocused: document.activeElement === e.currentTarget,
                  });
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="t-searchClear"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    clear();
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="t-searchClose t-searchClose-floating t-pressable"
              aria-label="Close search"
              onClick={minimize}
            >
              ×
            </button>
          </div>
        </div>

        <div className="t-searchGroups">
          {Object.keys(grouped).length === 0 ? (
            <div className="t-searchEmpty">{query ? "No matches yet." : "Start typing to search."}</div>
          ) : (
            Object.entries(grouped).map(([key, group]) => (
              <details key={key} className="t-searchGroup" open={false}>
                <summary className="t-searchGroupHead">
                  <span className="t-searchCaret">▾</span>
                  <span className={`t-searchTag is-${key}`}>{group.label}</span>
                  <span className="t-searchCount">[{group.items.length}]</span>
                </summary>
                <div className="t-searchGroupBody">
                  {group.items.map((entry) => (
                    <details key={entry.key} className="t-searchHit" open>
                      <summary className="t-searchHead">
                        <span className="t-searchCaret">▾</span>
                        <span className="t-searchTitle">{entry.title} ({entry.snippets.length})</span>
                      </summary>
                      {entry.snippets.map((hit) => (
                        <pre
                          key={hit.id}
                          className="t-searchSnippet"
                          dangerouslySetInnerHTML={{
                            __html: (() => {
                              const content = hit.before.concat([hit.line], hit.after).join("\n");
                              const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                              const marked = highlightRegex
                                ? escaped.replace(highlightRegex, "<mark>$1</mark>")
                                : escaped;

                              return marked
                                .split("\n")
                                .map((line, idx) => {
                                  const isFocusLine = idx === hit.before.length;
                                  return isFocusLine
                                    ? `<span class=\"t-searchLineFocus\">${line}</span>`
                                    : line;
                                })
                                .join("\n");
                            })(),
                          }}
                        />
                      ))}
                      <div className="t-searchActions">
                        <button
                          type="button"
                          className="t-commandLink t-pressable"
                          onClick={() => {
                            executeCommand(entry.readCommand);
                            minimize();
                          }}
                        >
                          Read more
                        </button>
                        {entry.downloadCommand ? (
                          <button
                            type="button"
                            className="t-commandLink t-pressable"
                            onClick={() => executeCommand(entry.downloadCommand!)}
                          >
                            Download
                          </button>
                        ) : null}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

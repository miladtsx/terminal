import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchStore } from "@stores/searchStore";
import { runSearch } from "@data/searchIndex";
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
        if (!next.trim()) {
          clear();
          return;
        }
        setPending(true);
        const { hits: found, total: foundTotal } = await runSearch(next);
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
    const by: Record<string, { label: string; items: SearchHit[] }> = {};
    const labels: Record<SearchHit["source"], string> = {
      blog: "Blogs",
      log: "Logs",
      resume: "Resume",
      work: "Work",
    };
    hits.forEach((hit) => {
      if (!by[hit.source]) by[hit.source] = { label: labels[hit.source], items: [] };
      by[hit.source].items.push(hit);
    });
    return by;
  }, [hits]);

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
                placeholder="Search blogs, logs, work, resume…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  console.log("[search] input mousedown", {
                    target: e.target,
                    currentTarget: e.currentTarget,
                    alreadyFocused: document.activeElement === e.currentTarget,
                  });
                  const focused = inputRef.current?.focus();
                  console.log("[search] input focus attempt on mousedown", { focused, active: document.activeElement });
                }}
                onFocus={(e) => console.log("[search] input focus", { target: e.target })}
                onBlur={(e) => console.log("[search] input blur", { target: e.target })}
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
              <details key={key} className="t-searchGroup" open>
                <summary className="t-searchGroupHead">
                  <span className="t-searchCaret">▾</span>
                  <span className={`t-searchTag is-${key}`}>{group.label}</span>
                  <span className="t-searchCount">{group.items.length}</span>
                </summary>
                <div className="t-searchGroupBody">
                  {group.items.map((hit) => (
                    <details key={hit.id} className="t-searchHit" open>
                      <summary className="t-searchHead">
                        <span className="t-searchCaret">▾</span>
                        <span className="t-searchTitle">{hit.title}</span>
                        <span className="t-searchMeta">line {hit.lineNumber}</span>
                      </summary>
                      <pre
                        className="t-searchSnippet"
                        dangerouslySetInnerHTML={{
                          __html: hit.before
                            .concat([hit.line], hit.after)
                            .join("\n")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(new RegExp(`(${query.split(/\s+/).map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi"), "<mark>$1</mark>")
                            .split("\n")
                            .map((line, idx) => {
                              const lineNum = hit.lineNumber - hit.before.length + idx;
                              return `<span class=\"t-searchLineNum\">${lineNum.toString().padStart(3, " ")}▏</span>${line}`;
                            })
                            .join("\n"),
                        }}
                      />
                      <div className="t-searchActions">
                        <button
                          type="button"
                          className="t-commandLink t-pressable"
                          onClick={() => {
                            executeCommand(hit.readCommand);
                            minimize();
                          }}
                        >
                          Read more
                        </button>
                        {hit.downloadCommand ? (
                          <button
                            type="button"
                            className="t-commandLink t-pressable"
                            onClick={() => executeCommand(hit.downloadCommand!)}
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

export function SearchFab({ onOpen }: { onOpen: () => void }) {
  const { total, query, isOpen } = useSearchStore();
  return (
    <button
      type="button"
      className={`search-fab${isOpen ? " is-active" : ""}`}
      aria-label="Open search"
      onClick={onOpen}
    >
      🔍
      <span className="search-fab-label">Search</span>
      {total > 0 && query ? <span className="search-fab-pill">{total}</span> : null}
    </button>
  );
}

import { useEffect, useMemo, useState } from "react";
import { MarkdownBlock } from "@components/MarkdownBlock";
import { copyToClipboard, buildShareLink } from "@utils";
import {
  CommandSegment,
  CopySegment,
  LinkSegment,
  FaqSegment,
  LogSegment,
  LineSegment,
  TerminalLineProps,
  MarkdownSegment,
  WorkSegment,
  AvatarSegment,
  SearchHitsSegment as SearchHitsSegmentType,
  ActivityTreeNode,
  ActivityTreeSegment,
} from "@types";
import { DownloadIntegrity } from "./terminal/DownloadIntegrity";

function CopyIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`t-copyIcon${active ? " is-active" : ""}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <rect x="4" y="4" width="11" height="11" rx="2" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="t-eyeIcon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? <circle cx="12" cy="12" r="7" opacity="0" /> : null}
    </svg>
  );
}

function CopyButton({
  segment,
}: {
  segment: CopySegment;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    if (copied) {
      timer = window.setTimeout(() => setCopied(false), 650);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [copied]);

  const label = segment.label || "Copy";
  const ariaLabel = segment.ariaLabel || `Copy ${label}`;

  return (
    <button
      type="button"
      className="t-copyButton"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        void copyToClipboard(segment.value);
        setCopied(true);
      }}
    >
      <CopyIcon active={copied} />
      <span className={`t-copyState${copied ? " is-visible" : ""}`}>
        {copied && "Copied"}
      </span>
    </button>
  );
}

function AvatarMessageSegment({ segment }: { segment: AvatarSegment }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      <span className="t-avatarMessage">
        <span className="t-avatarMedia">
          <button
            type="button"
            className="t-avatarPhoto"
            aria-label="Open profile photo"
            onClick={() => setIsOpen(true)}
          >
            <img
              src={segment.image}
              alt={segment.label ? `${segment.label} avatar` : "avatar"}
            />
          </button>
          {segment.label ? (
            <span className="t-avatarCaption">{segment.label}</span>
          ) : null}
        </span>
        <span className="t-avatarContent">
          {segment.meta ? (
            <span className="t-avatarHead">
              <span className="t-avatarMeta">{segment.meta}</span>
            </span>
          ) : null}
          {segment.lines.map((line, lineIdx) => {
            const isEmphasis = segment.emphasizeLines?.includes(lineIdx);
            return (
              <span
                key={`avatar-line-${lineIdx}`}
                className={`t-avatarLine${isEmphasis ? " is-emphasis" : ""}`}
              >
                {line}
              </span>
            );
          })}
        </span>
      </span>

      {isOpen ? (
        <div className="t-avatarModal" role="dialog" aria-modal="true">
          <div className="t-avatarModal__backdrop" onClick={() => setIsOpen(false)} />
          <div className="t-avatarModal__content">
            <button
              type="button"
              className="t-avatarModal__close"
              aria-label="Close photo"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
            <img
              src={segment.image}
              alt={segment.label ? `${segment.label} avatar full view` : "avatar full view"}
            />
            {segment.label ? (
              <span className="t-avatarModal__caption">{segment.label}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightQuery(text: string, query: string): string {
  const escaped = escapeHtml(text);
  const tokens = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map(escapeRegex);

  if (!tokens.length) return escaped;
  const regex = new RegExp(`(${tokens.join("|")})`, "gi");
  return escaped.replace(regex, "<mark>$1</mark>");
}

function renderSearchSnippet(
  hit: SearchHitsSegmentType["hits"][number],
  query: string,
): string {
  const renderLine = (text: string, emphasize?: boolean) => {
    const body = highlightQuery(text, query);
    return `${emphasize ? '<span class="t-searchLineFocus">' : ""}${body}${emphasize ? "</span>" : ""}`;
  };

  const lines: string[] = [];

  hit.before.forEach((text) => {
    lines.push(renderLine(text));
  });

  lines.push(renderLine(hit.line, true));

  hit.after.forEach((text, idx) => {
    lines.push(renderLine(text));
  });

  return lines.join("\n");
}

function SearchHits({
  segment,
  executeCommand,
}: {
  segment: SearchHitsSegmentType;
  executeCommand: (command: string) => void;
}) {
  const { hits, query } = segment;
  const [open, setOpen] = useState(true);
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>(
    {},
  );
  const [itemCollapsed, setItemCollapsed] = useState<Record<string, boolean>>(
    {},
  );

  const grouped = useMemo(() => {
    type Entry = {
      key: string;
      title: string;
      readCommand: string;
      downloadCommand?: string;
      snippets: typeof hits;
    };
    const by: Record<string, { label: string; items: Entry[] }> = {};
    const labelFor: Record<SearchHitsSegmentType["hits"][number]["source"], string> = {
      blog: "Blogs",
      log: "Logs",
      resume: "Resume",
      work: "Work",
    };
    hits.forEach((hit) => {
      const sourceKey = hit.source;
      const entryKey = `${hit.source}::${hit.title}::${hit.readCommand}::${hit.downloadCommand || ""}`;

      if (!by[sourceKey]) {
        by[sourceKey] = {
          label: labelFor[hit.source] || hit.source,
          items: [],
        };
      }

      const existing = by[sourceKey].items.find((item) => item.key === entryKey);
      if (existing) {
        existing.snippets.push(hit);
      } else {
        by[sourceKey].items.push({
          key: entryKey,
          title: hit.title,
          readCommand: hit.readCommand,
          downloadCommand: hit.downloadCommand,
          snippets: [hit],
        });
      }
    });
    return by;
  }, [hits]);

  if (!open) return null;

  const toggleGroup = (key: string) =>
    setGroupCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleItem = (id: string) =>
    setItemCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="t-searchModal" role="dialog" aria-modal="true">
      <div className="t-searchOverlay" />
      <div className="t-searchWindow">
        <div className="t-searchHeader">
          <div className="t-searchHeaderLeft">
            <span className="t-searchEyebrow">Search</span>
            <span className="t-searchHeading">
              “{query}” — {hits.length} result{hits.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="t-searchHeaderActions">
            <button
              type="button"
              className="t-searchClose t-pressable"
              aria-label="Close search results"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
        </div>

        <div className="t-searchGroups">
          {Object.entries(grouped).map(([key, group]) => {
            const collapsed = groupCollapsed[key] ?? false;
            return (
              <div className="t-searchGroup" key={key} data-source={key}>
                <button
                  type="button"
                  className="t-searchGroupHead"
                  onClick={() => toggleGroup(key)}
                >
                  <span className="t-searchCaret">{collapsed ? "▸" : "▾"}</span>
                  <span className={`t-searchTag is-${key}`}>{group.label}</span>
                  <span className="t-searchCount">{group.items.length}</span>
                </button>

                {!collapsed ? (
                  <div className="t-searchGroupBody">
                    {group.items.map((entry) => {
                      const folded = itemCollapsed[entry.key] ?? false;
                      return (
                        <div
                          className="t-searchHit"
                          key={entry.key}
                          data-source={key}
                        >
                          <button
                            type="button"
                            className="t-searchHead"
                            onClick={() => toggleItem(entry.key)}
                          >
                            <span className="t-searchCaret">
                              {folded ? "▸" : "▾"}
                            </span>
                            <span className="t-searchTitle">{entry.title}</span>
                          </button>

                          {!folded ? (
                            <>
                              {entry.snippets.map((hit) => (
                                <pre
                                  key={hit.id}
                                  className="t-searchSnippet"
                                  dangerouslySetInnerHTML={{
                                    __html: renderSearchSnippet(hit, query),
                                  }}
                                />
                              ))}
                              <div className="t-searchActions">
                                <button
                                  type="button"
                                  className="t-commandLink t-pressable"
                                  onClick={() => executeCommand(entry.readCommand)}
                                  aria-label={`Read more from ${entry.title}`}
                                >
                                  Read more
                                </button>
                                {entry.downloadCommand ? (
                                  <button
                                    type="button"
                                    className="t-commandLink t-pressable"
                                    onClick={() =>
                                      executeCommand(entry.downloadCommand!)
                                    }
                                    aria-label={`Download ${entry.title}`}
                                  >
                                    Download
                                  </button>
                                ) : null}
                              </div>
                              {entry.downloadCommand ? (
                                <DownloadIntegrity command={entry.downloadCommand} />
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderSegment(
  segment: LineSegment,
  key: string,
  executeCommand: (command: string) => void,
) {
  switch (segment.type) {
    case "text":
      return <span key={key}>{segment.text}</span>;
    case "link": {
      const attrs = segment as LinkSegment;
      const ariaLabel = attrs.ariaLabel || attrs.label;
      return (
        <a
          key={key}
          className="t-link"
          href={attrs.href}
          aria-label={ariaLabel}
          target={attrs.newTab ? "_blank" : undefined}
          rel={attrs.newTab ? "noopener noreferrer" : undefined}
        >
          {attrs.label}
        </a>
      );
    }
    case "avatar":
      return <AvatarMessageSegment key={key} segment={segment as AvatarSegment} />;
    case "command": {
      const attrs = segment as CommandSegment;
      const ariaLabel = attrs.ariaLabel || `Run ${attrs.command}`;
      const variantClass =
        attrs.variant === "primary"
          ? " is-primary"
          : attrs.variant === "secondary"
            ? " is-secondary"
            : attrs.variant === "link"
              ? " is-link"
              : "";
      return (
        <button
          key={key}
          type="button"
          className={`t-commandLink t-pressable${variantClass}`}
          onClick={() => executeCommand(attrs.command)}
          aria-label={ariaLabel}
        >
          {attrs.label}
        </button>
      );
    }
    case "copy": {
      return (
        <CopyButton
          key={key}
          segment={segment as CopySegment}
        />
      );
    }
    case "faq": {
      const faq = segment as FaqSegment;
      return <FaqAccordion key={key} items={faq.items} />;
    }
    case "logs": {
      const logs = segment as LogSegment;
      return <LogAccordion key={key} items={logs.items} />;
    }
    case "markdown": {
      return <MarkdownBlock key={key} segment={segment as MarkdownSegment} />;
    }
    case "work": {
      return (
        <WorkGrid key={key} segment={segment as WorkSegment} />
      );
    }
    case "activityTree": {
      return (
        <ActivityTree
          key={key}
          segment={segment as ActivityTreeSegment}
          executeCommand={executeCommand}
        />
      );
    }
    case "searchHits": {
      return (
        <SearchHits
          key={key}
          segment={segment as SearchHitsSegmentType}
          executeCommand={executeCommand}
        />
      );
    }
    default:
      return null;
  }
}

function FaqAccordion({ items }: { items: FaqSegment["items"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="t-faq">
      {items.map((item, idx) => {
        const open = openIndex === idx;
        return (
          <div key={idx} className={`t-faqItem${open ? " is-open" : ""}`}>
            <button
              type="button"
              className="t-faqSummary"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : idx)}
            >
              <span className="t-faqChevron" aria-hidden="true">
                ▸
              </span>
              {item.question}
            </button>
            <div
              className="t-faqAnswer"
              style={{ maxHeight: open ? "320px" : "0px" }}
            >
              <div className="t-faqAnswerInner">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogAccordion({ items }: { items: LogSegment["items"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="t-logAccordion">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const shareCommand =
          item.slug &&
          (item.kind === "blog" ? `blog read ${item.slug}` : `logs read ${item.slug}`);
        const shareText =
          shareCommand && typeof window !== "undefined"
            ? buildShareLink(shareCommand, window.location.href)
            : `${item.date} — ${item.note}`;
        return (
          <div key={idx} className={`t-logItem${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="t-logSummary"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
            >
              <span className="t-logChevron" aria-hidden="true">
                ▸
              </span>
              <span className="t-logTitle">{item.note}</span>
              <span className="t-logDate">{item.date}</span>
              {item.body ? <EyeIcon open={isOpen} /> : null}
            </button>

            <div
              className="t-logPanel"
              style={{ maxHeight: isOpen ? "700px" : "0px" }}
            >
              <div className="t-logPanelInner">
                {item.body ? (
                  <MarkdownBlock
                    segment={{ type: "markdown", markdown: item.body, title: item.note }}
                  />
                ) : (
                  <div className="t-logEmpty">No content</div>
                )}
                {shareCommand ? (
                  <button
                    type="button"
                    className="t-logShare"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(shareText);
                    }}
                    aria-label={`Copy share command for ${item.note}`}
                    title="Copy to share"
                  >
                    Copy to share
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkGrid({ segment }: { segment: WorkSegment }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = segment.items || [];

  const openItem = openIndex !== null ? items[openIndex] : null;

  useEffect(() => {
    if (openIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openIndex]);

  const renderParagraphs = (text: string) =>
    text
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, idx) => <p key={idx}>{paragraph}</p>);

  const renderTechnicalDetails = (text: string) => {
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (!lines.length) return null;

    return (
      <ul className="t-proofList t-proofTechList">
        {lines.map((line, idx) => (
          <li key={`tech-${idx}`}>{line}</li>
        ))}
      </ul>
    );
  };

  const modalSections = openItem
    ? (
        [
          { label: "Before", content: openItem.beforeBullets || openItem.problem },
          { label: "What I did", content: openItem.approachBullets || openItem.approach },
          { label: "Result", content: openItem.resultBullets || openItem.result },
        ] as const
      ).filter(
        (entry): entry is { label: string; content: string | string[] } =>
          Boolean(entry.content),
      )
    : [];

  return (
    <div className="t-work">
      <div className="t-proofHeader">
        <div className="t-proofTitle">Proof: results in production</div>
        <div className="t-proofSubtitle">Cost down. Reliability up. MVPs shipped.</div>
      </div>

      <div className="t-workGrid">
        {items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            className={`t-workCard t-proofCard${idx < 3 ? " is-headline" : ""}`}
            onClick={() => setOpenIndex(idx)}
            aria-label={`Open ${item.title} details`}
          >
            <div className="t-proofMain">
              <div className="t-proofOutcome">{item.outcome || item.desc || item.result}</div>
              <div className="t-proofTimeframe">{item.timeframe || " "}</div>
            </div>
            <div className="t-proofFooter">
              <span className="t-proofCta">Open</span>
            </div>
          </button>
        ))}
      </div>

      {openItem ? (
        <div
          className="t-workModalBackdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${openItem.title} details`}
          onClick={() => setOpenIndex(null)}
        >
          <div
            className="t-workModal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="t-workModalHead">
              <div>
                <div className="t-workModalEyebrow">Case study</div>
                <div className="t-workModalTitle">{openItem.title}</div>
                {(openItem.outcome || openItem.outcomeSummary || openItem.timeframe || openItem.whyItMatters) ? (
                  <div className="t-proofStats" aria-label="Outcome summary">
                    {[openItem.outcome || openItem.outcomeSummary, openItem.timeframe, openItem.whyItMatters]
                      .filter(Boolean)
                      .map((stat, statIdx, arr) => (
                        <span key={`stat-${statIdx}`} className="t-proofStat">
                          {stat}
                          {statIdx < arr.length - 1 ? (
                            <span className="t-proofStatDot" aria-hidden="true">·</span>
                          ) : null}
                        </span>
                      ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="t-workModalClose"
                onClick={() => setOpenIndex(null)}
                aria-label="Close case study"
              >
                ×
              </button>
            </div>
            <div className="t-proofModalBody">
              <div className="t-proofModalSections">
                {modalSections.length
                  ? modalSections.map((section) => (
                      <div className="t-proofModalSection" key={section.label}>
                        <div className="t-proofModalLabel">{section.label}</div>
                        {Array.isArray(section.content) ? (
                          <ul className="t-proofList">
                            {(section.content as string[]).map((bullet, bulletIdx) => (
                              <li key={`${section.label}-${bulletIdx}`}>{bullet}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="t-proofModalCopy">{renderParagraphs(section.content)}</div>
                        )}
                      </div>
                    ))
                  : (
                    <div className="t-proofModalSection">
                      <div className="t-proofModalLabel">Details</div>
                      <div className="t-proofModalCopy">
                        <p>Details coming soon.</p>
                      </div>
                    </div>
                  )}
              </div>

              {openItem.technicalDetails ? (
                <details className="t-proofDetails">
                  <summary>Technical details (for engineers)</summary>
                  <div className="t-proofModalCopy">
                    {renderTechnicalDetails(openItem.technicalDetails) || renderParagraphs(openItem.technicalDetails)}
                  </div>
                </details>
              ) : null}

              {openItem.tags?.length ? (
                <div className="t-proofModalTags" aria-label="Tags">
                  {openItem.tags.map((tag) => (
                    <span key={`tag-${openItem.title}-${tag}`} className="t-workTag">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActivityTree({
  segment,
  executeCommand,
}: {
  segment: ActivityTreeSegment;
  executeCommand: (command: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    const walk = (nodes: ActivityTreeNode[]) => {
      nodes.forEach((node) => {
        state[node.id] = false;
        if (node.children?.length) walk(node.children);
      });
    };
    walk(segment.nodes);
    return state;
  });
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const toggleNode = (id: string) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNodes = (nodes: ActivityTreeNode[]) => (
    <ul className="t-activityTreeList">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const isOpen = hasChildren ? open[node.id] !== false : false;
        const isActive = activeNodeId === node.id;

        const handleSelect = () => {
          setActiveNodeId((prev) => (prev === node.id ? null : node.id));
        };

        return (
          <li key={node.id} className="t-activityTreeNode">
            <div className="t-activityTreeHead">
              {hasChildren ? (
                <button
                  type="button"
                  className="t-activityTreeToggle"
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.title}`}
                  aria-expanded={isOpen}
                  onClick={() => toggleNode(node.id)}
                >
                  {isOpen ? "▾" : "▸"}
                </button>
              ) : (
                <span className="t-activityTreeSpacer" aria-hidden="true" />
              )}

              <div className="t-activityTreeContent">
                <div className="t-activityTreeTitleRow">
                  {node.command ? (
                    <button
                      type="button"
                      className="t-activityTreeAction"
                      onClick={() => {
                        handleSelect();
                        if (node.command) executeCommand(node.command);
                      }}
                    >
                      {node.title}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="t-activityTreeTitleButton"
                      onClick={handleSelect}
                    >
                      <span className="t-activityTreeTitle">{node.title}</span>
                    </button>
                  )}
                  {node.period ? (
                    <span className="t-activityTreePeriod">{node.period}</span>
                  ) : null}
                </div>

                {node.summary && isActive ? (
                  <div className="t-activityTreeSummary">{node.summary}</div>
                ) : null}

                {node.tags?.length && isActive ? (
                  <div className="t-activityTreeTags">
                    {node.tags.map((tag) => (
                      <span key={`${node.id}-${tag}`} className="t-activityTreeTag">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {hasChildren && isOpen ? renderNodes(node.children!) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="t-activityTree">
      {segment.title ? <div className="t-activityTreeHeading">{segment.title}</div> : null}
      {renderNodes(segment.nodes)}
    </div>
  );
}

export function TerminalLineRow({
  line,
  lineIndex,
  className,
  executeCommand,
  isCommandLine,
  isCollapsed,
  prompt,
  commandText,
  onToggleCollapse,
}: TerminalLineProps) {
  const hasCommandSegments = line.some(
    (segment) => typeof segment !== "string" && segment.type === "command",
  );

  const content =
    line.length === 0
      ? [<span key={`line-${lineIndex}-empty`}></span>]
      : line.map((segment, idx) =>
        renderSegment(
          segment,
          `line-${lineIndex}-seg-${idx}`,
          executeCommand,
        )
      );

  const promptGlyph = prompt || ">";
  const commandLabel = (() => {
    if (commandText) return commandText;
    const first = line[0];
    if (line.length === 1 && typeof first !== "string" && first.type === "text") {
      const raw = first.text || "";
      const prefix = `${promptGlyph} `;
      return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
    }
    return typeof line[0] === "string" ? (line[0] as string) : "";
  })();

  const interactiveContent = isCommandLine ? (
    <button
      type="button"
      className={`t-lineCommand${isCollapsed ? " is-collapsed" : " is-open"}`}
      aria-expanded={!isCollapsed}
      aria-label={`${isCollapsed ? "Expand" : "Collapse"} output for ${commandLabel || "command"}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggleCollapse?.();
      }}
    >
      <span className="t-lineCaret" aria-hidden="true">{promptGlyph}</span>
      <span className="t-lineCommandText">{commandLabel}</span>
    </button>
  ) : content;

  return (
    <span
      className={`${className || ""}${hasCommandSegments ? " has-commands" : ""}`.trim()}
      data-line-index={lineIndex}
    >
      {interactiveContent}
    </span>
  );
}

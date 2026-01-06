import { useTerminalController } from "../../hooks/useTerminalController";
import type { TerminalProps } from "./types";

export default function Terminal(props: TerminalProps) {
    const {
        ready,
        lines,
        input,
        prompt,
        inputRef,
        scrollRef,
        handleKeyDown,
        onInputChange,
        focusInput,
    } = useTerminalController(props);

    return (
        <div
            className={"t-root" + (ready ? " is-ready" : "")}
            onMouseDown={() => focusInput()}
            role="application"
            aria-label="Terminal portfolio"
        >
            <div className="t-wrap" ref={scrollRef}>
                <pre className="t-output" aria-live="polite">
                    {lines.join("\n")}
                </pre>

                <div className="t-inputRow">
                    <span className="t-prompt">{prompt}</span>
                    <textarea
                        ref={inputRef}
                        className="t-input"
                        value={input}
                        onChange={onInputChange}
                        onKeyDown={handleKeyDown}
                        spellCheck={false}
                        autoCapitalize="none"
                        autoCorrect="off"
                        rows={1}
                        aria-label="Terminal input"
                    />
                </div>
            </div>
        </div>
    );
}

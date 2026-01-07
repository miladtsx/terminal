import type { CommandHandlerContext, CommandRegistry } from "./commandRegistry";
import type { TerminalModel } from "./terminalModel";
import type {
  TerminalLineInput,
  LineSegment,
  CommandSegment,
  CopySegment,
  TextSegment,
  TerminalProps,
} from "./types";

export const DEFAULT_SUGGESTED_COMMANDS = ["help", "work", "resume", "contact"];

type RegisterDefaultsArgs = {
  registry: CommandRegistry;
  props: TerminalProps;
  model: TerminalModel;
  setLinesFromModel: (extraLines?: TerminalLineInput[]) => void;
};

const createTextSegment = (text: string): TextSegment => ({
  type: "text",
  text,
});

const createCommandSegment = (command: string): CommandSegment => ({
  type: "command",
  label: `[${command}]`,
  command,
});

const createCopySegment = (value: string, label?: string): CopySegment => ({
  type: "copy",
  value,
  label,
});

const buildCommandButtonLine = (commands: string[]): LineSegment[] => {
  const segments: LineSegment[] = [createTextSegment("  ")];
  commands.forEach((command, index) => {
    if (index) {
      segments.push(createTextSegment(" · "));
    }
    segments.push(createCommandSegment(command));
  });
  return segments;
};

const buildContactRow = (label: string, value: string): LineSegment[] => [
  createTextSegment(`  ${label}`),
  createTextSegment("  "),
  createTextSegment(value),
  createTextSegment(" "),
  createCopySegment(value, label),
];

export function formatCommandToButton(
  prefixPrompt: string,
  commands: string[]
) {
  return (): TerminalLineInput[] => {
    const list = commands;
    if (!list.length) return [];

    return [prefixPrompt, buildCommandButtonLine(list), ""];
  };
}

export function registerDefaultCommands({
  registry,
  props,
  model,
  setLinesFromModel,
}: RegisterDefaultsArgs) {
  const contact = props.contact || {
    email: "miladtsx+terminal@gmail.com",
    github: "https://github.com/miladtsx",
  };

  const caseStudies = props.caseStudies || [
    {
      title: "System Hardening",
      desc: "Reduced incidents, improved deploy safety.",
    },
    {
      title: "Payments/Entitlements",
      desc: "Built reliable gating + subscription rails.",
    },
    { title: "Automation", desc: "Agentic workflows, less ops toil." },
  ];

  const contactEntries = [
    { label: "email", value: contact.email },
    { label: "github", value: contact.github },
  ];

  const formatSuggestedLines = formatCommandToButton(
    "Suggested commands:",
    props.suggestedCommands ?? DEFAULT_SUGGESTED_COMMANDS
  );

  const helpHandler = ({
    registry: registryContext,
  }: CommandHandlerContext) => {
    const rows = registryContext.list().map((command) => {
      const right = command.desc ? ` — ${command.desc}` : "";
      return `  ${command.name}${right}`;
    });

    return [
      ...formatSuggestedLines(),
      "commands:",
      ...rows,
      "",
      "tips:",
      "  ↑/↓ history",
      "  Tab autocomplete",
    ];
  };

  registry
    .register("help", helpHandler, { desc: "show commands" })
    .register("?", helpHandler, { desc: "show commands (alias)" })
    .register(
      "about",
      () =>
        props.aboutLines || [
          "It started as my personal website, but ended up being this!",
        ],
      { desc: "short bio" }
    )
    .register(
      "contact",
      () => [
        "contact:",
        ...contactEntries.map((entry) =>
          buildContactRow(entry.label, entry.value)
        ),
        "",
      ],
      { desc: "how to reach me" }
    )
    .register(
      "work",
      () => {
        const lines = ["Previous works:"];
        caseStudies.forEach((item, index) => {
          lines.push(`  ${index + 1}. ${item.title}`);
          lines.push(`     ${item.desc}`);
        });
        lines.push(
          "",
          "hint: open links from your main site if you want richer content."
        );
        return lines;
      },
      { desc: "selected projects" }
    )
    .register(
      "clear",
      () => {
        model.clear();
        setLinesFromModel();
        return [];
      },
      { desc: "clear the screen" }
    );
}

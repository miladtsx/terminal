import type { CommandRegistry } from "./commandRegistry";
import type { TerminalModel } from "./terminalModel";
import type { TerminalProps } from "./types";

type RegisterDefaultsArgs = {
  registry: CommandRegistry;
  props: TerminalProps;
  model: TerminalModel;
  setLinesFromModel: (extraLines?: string[]) => void;
};

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

  registry
    .register(
      "help",
      () => {
        const rows = registry.list().map((command) => {
          const right = command.desc ? ` — ${command.desc}` : "";
          return `  ${command.name}${right}`;
        });

        return [
          "commands:",
          ...rows,
          "",
          "tips:",
          "  ↑/↓ history",
          "  Tab autocomplete",
        ];
      },
      { desc: "show commands" }
    )
    .register(
      "about",
      () =>
        props.aboutLines || [
          "developer portfolio terminal",
          "minimal interface, maximal signal",
        ],
      { desc: "short bio" }
    )
    .register(
      "contact",
      () => [
        "contact:",
        `  email  ${contact.email}`,
        `  github ${contact.github}`,
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

import { CommandEntry, CommandHandler, CommandMeta } from "@types";

export class CommandRegistry {
  private commands = new Map<string, CommandEntry>();
  private order: string[] = [];

  register(
    name: string,
    handler: CommandHandler,
    meta: CommandMeta = {}
  ): this {
    this.commands.set(name, { handler, meta });
    if (!this.order.includes(name)) this.order.push(name);
    return this;
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  get(name: string): CommandEntry | undefined {
    return this.commands.get(name);
  }

  list(): Array<{ name: string } & CommandMeta> {
    return this.order.map((name) => ({
      name,
      ...(this.commands.get(name)?.meta || {}),
    }));
  }

  suggest(prefix?: string): string[] {
    const lower = (prefix || "").toLowerCase();
    return this.order.filter((command) =>
      command.toLowerCase().startsWith(lower)
    );
  }
}

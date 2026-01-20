import { CommandEntry, CommandHandler, CommandMeta } from "@types";

export class CommandRegistry {
  private commands = new Map<string, CommandEntry>();
  private order: string[] = [];

  private normalize(value: string): string {
    return value.toLowerCase();
  }

  private findRegisteredName(name: string): string | undefined {
    const normalized = this.normalize(name);
    return this.order.find((registered) => this.normalize(registered) === normalized);
  }

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
    const registeredName = this.findRegisteredName(name) || name;
    return this.commands.get(registeredName);
  }

  getCanonicalName(name: string): string | undefined {
    return this.findRegisteredName(name);
  }

  list(): Array<{ name: string } & CommandMeta> {
    return this.order.map((name) => ({
      name,
      ...(this.commands.get(name)?.meta || {}),
    }));
  }

  suggest(prefix?: string): string[] {
    const lower = this.normalize(prefix || "");
    return this.order.filter((command) =>
      this.normalize(command).startsWith(lower)
    );
  }

  suggestSubcommands(command: string, prefix?: string): string[] {
    const registeredName = this.findRegisteredName(command);
    if (!registeredName) return [];

    const subcommands = this.commands.get(registeredName)?.meta.subcommands;
    if (!subcommands?.length) return [];

    const lower = this.normalize(prefix || "");
    return subcommands.filter((sub) => this.normalize(sub).startsWith(lower));
  }
}

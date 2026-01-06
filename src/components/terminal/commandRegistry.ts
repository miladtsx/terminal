import type { TerminalModel } from "./terminalModel";

export type CommandMeta = {
    desc?: string;
};

export type CommandHandlerContext = {
    args: string[];
    raw: string;
    model: TerminalModel;
    registry: CommandRegistry;
};

export type CommandHandler = (context: CommandHandlerContext) => string | string[] | void;

export type CommandEntry = {
    handler: CommandHandler;
    meta: CommandMeta;
};

export class CommandRegistry {
    private commands = new Map<string, CommandEntry>();
    private order: string[] = [];

    register(name: string, handler: CommandHandler, meta: CommandMeta = {}): this {
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

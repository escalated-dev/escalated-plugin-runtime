import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

export interface JsonRpcMessage {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
    id?: number | string;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
    id: number | string;
}

type MessageCallback = (msg: JsonRpcMessage) => void;

export class JsonRpcHandler {
    private rl?: ReturnType<typeof createInterface>;
    private callbacks: MessageCallback[] = [];
    private pendingRequests = new Map<number | string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
    }>();
    private nextId = 1;

    constructor(
        private input: Readable,
        private output: Writable,
    ) {}

    start(): void {
        this.rl = createInterface({ input: this.input });
        this.rl.on('line', (line) => {
            if (!line.trim()) return;
            try {
                const parsed = JSON.parse(line);
                if ('method' in parsed) {
                    // Incoming request/notification
                    for (const cb of this.callbacks) cb(parsed as JsonRpcMessage);
                } else if ('result' in parsed || 'error' in parsed) {
                    // Response to our request
                    const pending = this.pendingRequests.get(parsed.id);
                    if (pending) {
                        this.pendingRequests.delete(parsed.id);
                        if (parsed.error) {
                            pending.reject(new Error(parsed.error.message));
                        } else {
                            pending.resolve(parsed.result);
                        }
                    }
                }
            } catch {
                // Ignore malformed messages
            }
        });
    }

    stop(): void {
        this.rl?.close();
    }

    onMessage(callback: MessageCallback): void {
        this.callbacks.push(callback);
    }

    sendResponse(id: number | string, result: unknown): void {
        this.writeLine({ jsonrpc: '2.0', result, id });
    }

    sendError(id: number | string, code: number, message: string, data?: unknown): void {
        this.writeLine({ jsonrpc: '2.0', error: { code, message, data }, id });
    }

    async sendRequest(method: string, params?: unknown): Promise<unknown> {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.writeLine({ jsonrpc: '2.0', method, params, id });
        });
    }

    private writeLine(data: unknown): void {
        this.output.write(JSON.stringify(data) + '\n');
    }
}

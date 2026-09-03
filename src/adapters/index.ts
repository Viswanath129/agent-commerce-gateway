import type { ProtocolAdapter, ProtocolSource, AdapterValidationResult } from "./types.js";
import { ACGNativeAdapter } from "./acg/adapter.js";
import { McpProtocolAdapter } from "./mcp/adapter.js";
import { A2AProtocolAdapter } from "./a2a/adapter.js";
import { AcpProtocolAdapter } from "./acp/adapter.js";
import { Ap2ProtocolAdapter } from "./ap2/adapter.js";
import { UcpProtocolAdapter } from "./ucp/adapter.js";
import { VisaTapProtocolAdapter } from "./tap/adapter.js";

export * from "./types.js";
export { ACGNativeAdapter } from "./acg/adapter.js";
export { McpProtocolAdapter } from "./mcp/adapter.js";
export { A2AProtocolAdapter } from "./a2a/adapter.js";
export { AcpProtocolAdapter } from "./acp/adapter.js";
export { Ap2ProtocolAdapter } from "./ap2/adapter.js";
export { UcpProtocolAdapter } from "./ucp/adapter.js";
export { VisaTapProtocolAdapter } from "./tap/adapter.js";

export class ProtocolAdapterRegistry {
  private adapters: Map<string, ProtocolAdapter> = new Map();

  constructor() {
    this.register(new ACGNativeAdapter());
    this.register(new McpProtocolAdapter());
    this.register(new A2AProtocolAdapter());
    this.register(new AcpProtocolAdapter());
    this.register(new Ap2ProtocolAdapter());
    this.register(new UcpProtocolAdapter());
    this.register(new VisaTapProtocolAdapter());
  }

  public register(adapter: ProtocolAdapter): void {
    this.adapters.set(adapter.protocol.toLowerCase(), adapter);
  }

  public get(protocol: string): ProtocolAdapter | undefined {
    return this.adapters.get(protocol.toLowerCase());
  }

  public listAdapters(): ProtocolAdapter[] {
    return Array.from(this.adapters.values());
  }

  public async normalize(protocol: string, rawPayload: unknown, merchantId?: string): Promise<AdapterValidationResult> {
    const adapter = this.get(protocol);
    if (!adapter) {
      return {
        success: false,
        error: `Unsupported agentic commerce protocol: '${protocol}'. Supported: ${Array.from(this.adapters.keys()).join(", ")}`,
        code: "UNSUPPORTED_PROTOCOL",
      };
    }
    return adapter.normalize(rawPayload, merchantId);
  }
}

export const defaultAdapterRegistry = new ProtocolAdapterRegistry();

import { existsSync, readFileSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

/** Single-process store: Supabase in production, atomic local file for development. */
export class SnapshotStore {
  private data: Record<string, unknown> = {};
  private file?: string;
  private remote?: { url: string; key: string };
  private revision = 0;
  private dirty = false;
  private writing?: Promise<void>;
  private operations: Promise<unknown> = Promise.resolve();
  private active = 0;
  private batching = false;
  private generation = 0;
  private attempt?:{snapshot:{version:number;data:Record<string,unknown>};revision:number;generation:number;operationId:string};
  constructor(file?: string) {
    if (file) {
      this.file = resolve(file); mkdirSync(dirname(this.file), { recursive: true });
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, "utf8"));
        if (!raw || raw.version !== 1 || !raw.data || typeof raw.data !== "object" || Array.isArray(raw.data)) throw new Error("Invalid world snapshot; refusing to overwrite it");
        this.data = raw.data;
      }
    }
  }
  get<T>(key: string, fallback: T): T { return structuredClone((this.data[key] ?? fallback) as T); }
  set(key: string, value: unknown) {
    const next = { ...this.data, [key]: structuredClone(value) };
    if (!this.remote && !this.batching) this.persist(next);
    this.data = next; this.dirty = !!this.remote || this.batching;
    this.generation++;
  }
  get durable() { return !!this.file || !!this.remote; }
  get busy() { return this.active > 0; }
  /** Verify the RPC and claim the latest revision before accepting any public game connection. */
  async probeWrite() { if(this.remote){this.dirty=true;await this.flush();} }
  async connectSupabase(url: string, key: string) {
    if (!/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test(url) || !key) throw new Error("Invalid Supabase server configuration");
    this.remote = { url: url.replace(/\/$/, ""), key };
    const response = await this.request("ro_world?select=revision,snapshot&id=eq.main", { method: "GET" });
    const rows = await response.json() as { revision: number; snapshot: { version: number; data: Record<string, unknown> } }[];
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].snapshot.version !== 1 || !rows[0].snapshot.data || typeof rows[0].snapshot.data !== "object" || Array.isArray(rows[0].snapshot.data)) throw new Error("Run the RO Lounge storage SQL migration before starting the server");
    this.revision = Number(rows[0].revision); this.data = rows[0].snapshot.data;
    if(!Number.isSafeInteger(this.revision)||this.revision<0)throw new Error("Invalid storage revision");
    this.dirty = false;
  }
  /** Serializes durable game operations without blocking the movement/event loop. */
  run<T>(action: () => T): Promise<T> {
    this.active++;
    const next = this.operations.then(async () => { await this.flush(); this.batching=true; try { return action(); } finally { this.batching=false; await this.flush(); } });
    this.operations = next.catch(() => {}).finally(() => { this.active--; });
    return next;
  }
  async flush(): Promise<void> {
    if (!this.remote) {if(this.dirty){this.persist(this.data);this.dirty=false;}return;}
    if (this.writing) { await this.writing; if (this.dirty) await this.flush(); return; }
    if (!this.dirty) return;
    const attempt=this.attempt??{snapshot:{version:1,data:structuredClone(this.data)},revision:this.revision,generation:this.generation,operationId:randomUUID()};
    this.attempt=attempt;const {snapshot,revision,operationId}=attempt;
    this.dirty = false;
    this.writing = (async () => {
      try {
        const response = await this.request("rpc/ro_world_save", { method: "POST", body: JSON.stringify({ expected_revision: revision, new_snapshot: snapshot,operation_id:operationId }) });
        const saved = Number(await response.json());
        if (!Number.isSafeInteger(saved) || saved !== revision + 1) throw new Error("Storage revision conflict; refusing stale overwrite");
        this.revision = saved;
        this.attempt=undefined;this.dirty=this.generation!==attempt.generation;
      } catch (error) { this.dirty = true; throw error; }
    })();
    try { await this.writing; } finally { this.writing = undefined; }
    if (this.dirty) await this.flush();
  }
  /** Notifications are captured by caller and released only after the current stack is saved. */
  deliver(action: () => void) {
    queueMicrotask(() => { void this.flush().then(action).catch(() => { /* Fail closed: no false save acknowledgement. */ }); });
  }
  private async request(path: string, init: RequestInit) {
    const headers:Record<string,string>={apikey:this.remote!.key,"Content-Type":"application/json"};
    // Modern sb_secret keys are not JWTs. Only legacy service_role JWTs belong in Bearer.
    if(this.remote!.key.startsWith("eyJ"))headers.Authorization="Bearer "+this.remote!.key;
    const response = await fetch(this.remote!.url + "/rest/v1/" + path, { ...init,
      headers,
      signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Game storage unavailable (HTTP " + response.status + "); no save acknowledged");
    return response;
  }
  private persist(data: Record<string, unknown>) {
    if (!this.file) return;
    const temporary = this.file + ".next", text = JSON.stringify({ version: 1, data });
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, "w", 0o600); const bytes = Buffer.from(text); let written = 0;
      while (written < bytes.length) written += writeSync(descriptor, bytes, written, bytes.length - written);
      fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined; renameSync(temporary, this.file);
      const directory = openSync(dirname(this.file), "r"); try { fsyncSync(directory); } finally { closeSync(directory); }
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      try { unlinkSync(temporary); } catch { /* No temporary snapshot. */ }
      throw error;
    }
  }
}

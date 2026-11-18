import { promises as fs } from "fs";
import path from "path";
import type { Profile, Session, VocabEntry } from "../types";
import type { Store } from "./types";

interface DB {
  profile: Profile | null;
  sessions: Record<string, Session>;
  vocab: Record<string, VocabEntry>;
}

/**
 * JSON-file store for local use, a VPS or Docker (with a mounted volume).
 * Writes are serialized and atomic (write temp file + rename) so a crash never corrupts data.
 */
export class FileStore implements Store {
  readonly kind = "file" as const;
  private file: string;
  private cache: DB | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.file = path.join(dir, "tutor-db.json");
  }

  private mtime = 0;

  private async load(): Promise<DB> {
    // Re-read when the file changed on disk (e.g. a backup restore or another process).
    const stat = await fs.stat(this.file).catch(() => null);
    if (this.cache && (!stat || stat.mtimeMs === this.mtime)) return this.cache;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      this.cache = JSON.parse(raw) as DB;
      this.mtime = stat?.mtimeMs ?? 0;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      this.cache = { profile: null, sessions: {}, vocab: {} };
    }
    return this.cache;
  }

  private mutate(fn: (db: DB) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const db = await this.load();
      fn(db);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db));
      await fs.rename(tmp, this.file);
      this.mtime = (await fs.stat(this.file)).mtimeMs;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getProfile() { return structuredClone((await this.load()).profile); }
  saveProfile(p: Profile) { return this.mutate((db) => { db.profile = structuredClone(p); }); }
  async getSession(id: string) { return structuredClone((await this.load()).sessions[id] ?? null); }
  saveSession(s: Session) { return this.mutate((db) => { db.sessions[s.id] = structuredClone(s); }); }
  async listSessions() {
    const all = Object.values((await this.load()).sessions);
    return structuredClone(all.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
  }
  async listVocab() {
    const all = Object.values((await this.load()).vocab);
    return structuredClone(all.sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
  }
  saveVocab(v: VocabEntry) { return this.mutate((db) => { db.vocab[v.id] = structuredClone(v); }); }
  deleteVocab(id: string) { return this.mutate((db) => { delete db.vocab[id]; }); }
}

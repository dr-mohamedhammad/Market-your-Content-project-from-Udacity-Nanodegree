import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Session, VocabEntry } from "../types";
import type { Store } from "./types";

/**
 * Supabase (Postgres) store. Uses the service-role key, which only ever lives on the server.
 * Tables are created by supabase/schema.sql. Each row keeps the document in a jsonb column.
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;
  constructor(url: string, serviceKey: string, private userId = "me") {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(`Database error: ${res.error.message}`);
    return res.data;
  }

  async getProfile() {
    const data = this.check(await this.db.from("tutor_profiles").select("data").eq("user_id", this.userId).maybeSingle());
    return (data?.data as Profile) ?? null;
  }
  async saveProfile(p: Profile) {
    this.check(await this.db.from("tutor_profiles").upsert({ user_id: this.userId, data: p, updated_at: new Date().toISOString() }));
  }
  async getSession(id: string) {
    const data = this.check(await this.db.from("tutor_sessions").select("data").eq("user_id", this.userId).eq("id", id).maybeSingle());
    return (data?.data as Session) ?? null;
  }
  async saveSession(s: Session) {
    this.check(await this.db.from("tutor_sessions").upsert({ id: s.id, user_id: this.userId, data: s, started_at: s.startedAt, updated_at: s.updatedAt }));
  }
  async listSessions() {
    const data = this.check(await this.db.from("tutor_sessions").select("data").eq("user_id", this.userId).order("started_at", { ascending: false }).limit(1000));
    return (data ?? []).map((r: { data: Session }) => r.data);
  }
  async listVocab() {
    const data = this.check(await this.db.from("tutor_vocab").select("data").eq("user_id", this.userId).order("added_at", { ascending: false }).limit(5000));
    return (data ?? []).map((r: { data: VocabEntry }) => r.data);
  }
  async saveVocab(v: VocabEntry) {
    this.check(await this.db.from("tutor_vocab").upsert({ id: v.id, user_id: this.userId, data: v, added_at: v.addedAt }));
  }
  async deleteVocab(id: string) {
    this.check(await this.db.from("tutor_vocab").delete().eq("user_id", this.userId).eq("id", id));
  }
}

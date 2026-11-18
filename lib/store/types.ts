import type { Profile, Session, VocabEntry } from "../types";

export interface Store {
  readonly kind: "file" | "supabase";
  getProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  getSession(id: string): Promise<Session | null>;
  saveSession(s: Session): Promise<void>;
  listSessions(): Promise<Session[]>; // newest first
  listVocab(): Promise<VocabEntry[]>;
  saveVocab(v: VocabEntry): Promise<void>;
  deleteVocab(id: string): Promise<void>;
}

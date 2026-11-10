// What Studium needs from the cloud store; the real one is in firebase, tests use a fake.
import type { RecordKey } from "./records";
import type { StampedRecords } from "./merge";

export type RemoteChange =
  | { kind: "upsert"; key: RecordKey; updatedAt: string; value: unknown }
  | { kind: "delete"; key: RecordKey; updatedAt: string };

export type SavedInfo = { savedAt: string; savedBy: string };

export interface RemoteStore {
  load(uid: string): Promise<StampedRecords | null>; // null = account has nothing yet
  write(uid: string, changes: RemoteChange[], meta: SavedInfo): Promise<void>;
  subscribe(uid: string, onRemote: (r: StampedRecords) => void): () => void;
  replaceAll(uid: string, r: StampedRecords, meta: SavedInfo): Promise<void>; // the picker chose this device: remote becomes exactly r
  deleteAll(uid: string): Promise<void>;
  savedInfo(uid: string): Promise<SavedInfo | null>;
}

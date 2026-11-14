// What Studium needs from the cloud store; the real one is in firebase, tests use a fake.
import type { RecordKey } from "./records";
import type { StampedRecords } from "./merge";

export type RemoteChange =
  | { kind: "upsert"; key: RecordKey; updatedAt: string; value: unknown }
  | { kind: "delete"; key: RecordKey; updatedAt: string };

export type SavedInfo = { savedAt: string; savedBy: string };
/** What goes with a write: the save info, and which save the writing device is on (null before the account has one). */
export type WriteMeta = SavedInfo & { saveId: string | null };

export interface RemoteStore {
  load(uid: string): Promise<StampedRecords | null>; // null = account has nothing yet
  write(uid: string, changes: RemoteChange[], meta: WriteMeta): Promise<void>; // refused if meta.saveId is no longer the account's save
  subscribe(uid: string, onRemote: (r: StampedRecords) => void, onError?: (e: Error) => void): () => void; // onError: a listener stopped, so no more changes will arrive
  replaceAll(uid: string, r: StampedRecords, meta: SavedInfo): Promise<void>; // the picker chose this device: remote becomes exactly r
  deleteAll(uid: string): Promise<void>;
  savedInfo(uid: string): Promise<SavedInfo | null>;
}

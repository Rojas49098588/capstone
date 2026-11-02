// Links into Studium from the pets: #project=<projectId> (optionally &pet=<petId>, to scroll to that
// pet's habitat) and #complete=<taskId>.
export type HashLink = { kind: "project"; id: string; pet?: string } | { kind: "complete"; id: string };

export function parseHashLink(hash: string): HashLink | null {
  const match = /^#(project|complete)=([^&]+)(?:&pet=([^&]*))?$/.exec(hash);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[2]);
    if (match[1] === "complete") return { kind: "complete", id };
    const pet = match[3] ? decodeURIComponent(match[3]) : "";
    return pet ? { kind: "project", id, pet } : { kind: "project", id };
  } catch {
    return null; // malformed escape
  }
}

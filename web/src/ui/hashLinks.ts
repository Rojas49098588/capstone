// Links into Studium from the browser pets: #project=<projectId> and #complete=<taskId>.
export type HashLink = { kind: "project" | "complete"; id: string };

export function parseHashLink(hash: string): HashLink | null {
  const match = /^#(project|complete)=(.+)$/.exec(hash);
  if (!match) return null;
  try {
    return { kind: match[1] as HashLink["kind"], id: decodeURIComponent(match[2]) };
  } catch {
    return null; // malformed escape
  }
}

// What a task or requirement waits on, and the loop checks that keep every wait finishable.
import { isRequirementDone } from "./progress";
import type { Requirement, StudiumData, Task } from "./types";

export type BlockData = Pick<StudiumData, "tasks" | "requirements">;
export type Blocker = { kind: "task"; task: Task } | { kind: "requirement"; requirement: Requirement };

/** The requirements this one waits on: every other one in the project with blockedByAll, else its blockedBy that still exist there. */
export function requirementBlockerIds(req: Requirement, requirements: Requirement[]): string[] {
  const sameProject = requirements.filter((r) => r.projectId === req.projectId && r.id !== req.id);
  if (req.blockedByAll) return sameProject.map((r) => r.id);
  const ids = new Set(sameProject.map((r) => r.id));
  return (req.blockedBy ?? []).filter((id) => ids.has(id));
}

/** The requirements this one waits on that aren't finished (a requirement with no tasks isn't finished). */
export function openRequirementBlockers(req: Requirement, data: BlockData): Requirement[] {
  const byId = new Map(data.requirements.map((r) => [r.id, r]));
  return requirementBlockerIds(req, data.requirements)
    .map((id) => byId.get(id) as Requirement)
    .filter((r) => !isRequirementDone(r.id, data.tasks));
}

/** Everything a task waits on: its open blocker tasks, then the unfinished requirements its requirement waits on. */
export function waitingOn(task: Task, data: BlockData): Blocker[] {
  const byId = new Map(data.tasks.map((t) => [t.id, t]));
  const tasks: Blocker[] = task.blockedBy
    .map((id) => byId.get(id))
    .filter((t): t is Task => t !== undefined && !t.done)
    .map((t) => ({ kind: "task", task: t }));
  const req = data.requirements.find((r) => r.id === task.requirementId);
  const reqs: Blocker[] = req ? openRequirementBlockers(req, data).map((r) => ({ kind: "requirement", requirement: r })) : [];
  return [...tasks, ...reqs];
}

export function isBlocked(task: Task, data: BlockData): boolean {
  return waitingOn(task, data).length > 0;
}

/** How many open tasks wait on this one, directly or through a chain. Each counted once. */
export function downstreamOpenCount(taskId: string, tasks: Task[]): number {
  const dependents = new Map<string, string[]>();
  for (const t of tasks) {
    for (const b of t.blockedBy) {
      const list = dependents.get(b) ?? [];
      list.push(t.id);
      dependents.set(b, list);
    }
  }
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>([taskId]);
  const queue = [taskId];
  let count = 0;
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const dep of dependents.get(id) ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      queue.push(dep);
      if (byId.get(dep)?.done === false) count += 1;
    }
  }
  return count;
}

// ---- Loops ----
// One graph for the whole project. "A → B" means A waits on B:
//   task:X     → task:Y       for each Y in X.blockedBy
//   task:X     → unlock:R     where R is X's requirement
//   unlock:R   → finished:R2  for each requirement R waits on
//   finished:R → task:Y       for each task Y in R
// Adding A → B makes a loop exactly when B already reaches A. Done tasks still count (the safe choice).

type Node = `task:${string}` | `unlock:${string}` | `finished:${string}`;

function successors(node: Node, data: BlockData): Node[] {
  const id = node.slice(node.indexOf(":") + 1);
  if (node.startsWith("task:")) {
    const t = data.tasks.find((x) => x.id === id);
    if (!t) return [];
    const out: Node[] = t.blockedBy.filter((b) => data.tasks.some((x) => x.id === b)).map((b) => `task:${b}` as Node);
    if (t.requirementId !== null && data.requirements.some((r) => r.id === t.requirementId)) out.push(`unlock:${t.requirementId}`);
    return out;
  }
  if (node.startsWith("unlock:")) {
    const r = data.requirements.find((x) => x.id === id);
    return r ? requirementBlockerIds(r, data.requirements).map((b) => `finished:${b}` as Node) : [];
  }
  return data.tasks.filter((t) => t.requirementId === id).map((t) => `task:${t.id}` as Node);
}

function reaches(from: Node, to: Node, data: BlockData): boolean {
  const seen = new Set<Node>();
  const stack: Node[] = [from];
  while (stack.length > 0) {
    const node = stack.pop() as Node;
    if (node === to) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...successors(node, data));
  }
  return false;
}

/** Would making task `taskId` wait on task `blockerId` create a loop (through tasks or requirements)? */
export function wouldTaskBlockerLoop(taskId: string, blockerId: string, data: BlockData): boolean {
  return blockerId === taskId || reaches(`task:${blockerId}`, `task:${taskId}`, data);
}

/** Tasks that `taskId` may be marked "blocked by": same project, not itself, no loops. */
export function blockerOptions(taskId: string, data: BlockData): Task[] {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return [];
  return data.tasks.filter((t) => t.projectId === task.projectId && !wouldTaskBlockerLoop(taskId, t.id, data));
}

/** Requirements that `reqId` may wait on: same project, not itself, not one that waits on all others, no loops. */
export function requirementBlockerOptions(reqId: string, data: BlockData): Requirement[] {
  const req = data.requirements.find((r) => r.id === reqId);
  if (!req) return [];
  return data.requirements.filter(
    (r) => r.projectId === req.projectId && r.id !== reqId && !r.blockedByAll && !reaches(`finished:${r.id}`, `unlock:${reqId}`, data),
  );
}

/** May `reqId` wait on every other requirement? Only one per project may, and only if that makes no loop. */
export function canBlockByAll(reqId: string, data: BlockData): boolean {
  const req = data.requirements.find((r) => r.id === reqId);
  if (!req) return false;
  const others = data.requirements.filter((r) => r.projectId === req.projectId && r.id !== reqId);
  if (others.some((r) => r.blockedByAll)) return false;
  return others.every((r) => !reaches(`finished:${r.id}`, `unlock:${reqId}`, data));
}

/**
 * Would moving task `taskId` into `requirementId` create a loop? The move adds two waits (the task
 * waits on the requirement's blockers, and the requirement's "finished" waits on the task), so check
 * for any loop through the task once it's moved.
 */
export function wouldRequirementChangeLoop(taskId: string, requirementId: string | null, data: BlockData): boolean {
  const moved: BlockData = { ...data, tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, requirementId } : t)) };
  return successors(`task:${taskId}`, moved).some((n) => reaches(n, `task:${taskId}`, moved));
}

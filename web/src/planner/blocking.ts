import type { Task } from "./types";

/** Open tasks this task is waiting on. Ids that no longer exist are ignored. */
export function openBlockers(task: Task, tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return task.blockedBy.map((id) => byId.get(id)).filter((t): t is Task => t !== undefined && !t.done);
}

export function isBlocked(task: Task, tasks: Task[]): boolean {
  return openBlockers(task, tasks).length > 0;
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

/** True if `taskId` waits on `targetId`, directly or through a chain. */
function dependsOn(taskId: string, targetId: string, tasks: Task[]): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [...(byId.get(taskId)?.blockedBy ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === targetId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.blockedBy ?? []));
  }
  return false;
}

/** Would making `taskId` wait on `blockerId` create a loop? */
export function wouldCreateCycle(taskId: string, blockerId: string, tasks: Task[]): boolean {
  return blockerId === taskId || dependsOn(blockerId, taskId, tasks);
}

/** Tasks that `taskId` may be marked "blocked by": same project, not itself, no loops. */
export function blockerOptions(taskId: string, tasks: Task[]): Task[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return [];
  return tasks.filter((t) => t.projectId === task.projectId && !wouldCreateCycle(taskId, t.id, tasks));
}

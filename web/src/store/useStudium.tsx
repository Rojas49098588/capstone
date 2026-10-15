// Owns Studium's saved data for the React tree. Every action gets the current time,
// is applied with the pure functions in actions.ts, and is saved straight away.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StudiumData } from "../planner/types";
import * as A from "./actions";
import { browserStorage, loadData, saveData, type LoadNotice } from "./storage";

export const NOW_REFRESH_MS = 60_000;

export type Notice = LoadNotice | "save-failed";
export type StudiumOptions = { storage?: Storage | null; clock?: () => Date };

export function useStudium(options: StudiumOptions = {}) {
  const [env] = useState(() => ({
    storage: options.storage === undefined ? browserStorage() : options.storage,
    clock: options.clock ?? (() => new Date()),
  }));
  const [initial] = useState(() => loadData(env.storage, env.clock()));
  const [data, setData] = useState<StudiumData>(initial.data);
  const [notice, setNotice] = useState<Notice>(initial.notice);
  const [now, setNow] = useState(() => env.clock());
  const dataRef = useRef(data);
  const persistent = initial.persistent;

  // Moods, day labels and Today's plan depend on the date, so keep "now" fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(env.clock()), NOW_REFRESH_MS);
    return () => clearInterval(id);
  }, [env]);

  const apply = useCallback(
    function apply<R>(fn: (d: StudiumData, at: Date) => { data: StudiumData; result: R }): R {
      const at = env.clock();
      const { data: next, result } = fn(dataRef.current, at);
      if (next !== dataRef.current) {
        dataRef.current = next;
        setData(next);
        setNow(at);
        if (persistent && !saveData(env.storage, next)) setNotice("save-failed");
      }
      return result;
    },
    [env, persistent],
  );

  const actions = useMemo(() => {
    const change = (fn: (d: StudiumData, at: Date) => StudiumData) =>
      apply((d, at) => ({ data: fn(d, at), result: undefined }));
    return {
      createProject: (input: A.ProjectInput) =>
        apply((d, at) => {
          const r = A.createProject(d, input, at);
          return { data: r.data, result: r.project };
        }),
      updateProject: (id: string, changes: Parameters<typeof A.updateProject>[2]) =>
        change((d) => A.updateProject(d, id, changes)),
      deleteProject: (id: string) => change((d) => A.deleteProject(d, id)),
      createRequirement: (input: A.RequirementInput) =>
        apply((d, at) => {
          const r = A.createRequirement(d, input, at);
          return { data: r.data, result: r.requirement };
        }),
      updateRequirement: (id: string, changes: Parameters<typeof A.updateRequirement>[2]) =>
        change((d, at) => A.updateRequirement(d, id, changes, at)),
      deleteRequirement: (id: string, mode: "deleteTasks" | "unlinkTasks") =>
        change((d) => A.deleteRequirement(d, id, mode)),
      createTask: (input: A.TaskInput) =>
        apply((d, at) => {
          const r = A.createTask(d, input, at);
          return { data: r.data, result: r.task };
        }),
      updateTask: (id: string, changes: Parameters<typeof A.updateTask>[2]) =>
        change((d, at) => A.updateTask(d, id, changes, at)),
      deleteTask: (id: string) => change((d) => A.deleteTask(d, id)),
      togglePriority: (id: string) => change((d) => A.togglePriority(d, id)),
      completeTask: (id: string, actualMin: number | null) =>
        apply((d, at) => {
          const r = A.completeTask(d, id, actualMin, at);
          return { data: r.data, result: r.payout };
        }),
      reopenTask: (id: string) => change((d, at) => A.reopenTask(d, id, at)),
      addToToday: (id: string) => change((d, at) => A.addToToday(d, id, at)),
      removeFromToday: (id: string) => change((d, at) => A.removeFromToday(d, id, at)),
      purchase: (productId: string) =>
        apply((d, at) => {
          const r = A.purchase(d, productId, at);
          return { data: r.data, result: r.ok };
        }),
      giveMedicine: (projectId: string) =>
        apply((d, at) => {
          const r = A.giveMedicine(d, projectId, at);
          return { data: r.data, result: r.ok };
        }),
    };
  }, [apply]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { data, now, notice, persistent, dismissNotice, ...actions };
}

export type Studium = ReturnType<typeof useStudium>;

const StudiumContext = createContext<Studium | null>(null);

export function StudiumProvider({ children, options }: { children: ReactNode; options?: StudiumOptions }) {
  const studium = useStudium(options);
  return <StudiumContext.Provider value={studium}>{children}</StudiumContext.Provider>;
}

export function useStudiumContext(): Studium {
  const studium = useContext(StudiumContext);
  if (!studium) throw new Error("useStudiumContext must be used inside <StudiumProvider>");
  return studium;
}

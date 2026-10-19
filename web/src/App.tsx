// App shell: navigation, theme, modals and toasts. Screens live in components/,
// data and actions come from the Studium provider (store/useStudium.tsx).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import CompletionPrompt from "./components/CompletionPrompt";
import NoticeBanner from "./components/NoticeBanner";
import Overview from "./components/Overview";
import ProjectDetail from "./components/ProjectDetail";
import ProjectModal from "./components/ProjectModal";
import Shop from "./components/Shop";
import Toast from "./components/Toast";
import { isBlocked } from "./planner/blocking";
import { tokenBalance } from "./planner/history";
import { StudiumProvider, useStudiumContext } from "./store/useStudium";
import { parseHashLink } from "./ui/hashLinks";
import { SERIF } from "./ui/styles";

type Theme = "light" | "dark";
type Modal = null | { mode: "create" } | { mode: "edit"; projectId: string };

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem("studium-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage blocked; fall through to the system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const NAV_ACTIVE = "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]";
const NAV_IDLE = "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]";

export function StudiumApp() {
  const s = useStudiumContext();
  const [page, setPage] = useState<"projects" | "shop">("projects");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [justHatchedId, setJustHatchedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("studium-theme", theme);
    } catch {
      // Not saved; the theme still applies for this visit.
    }
  }, [theme]);

  const dismissToast = useCallback(() => setToast(null), []);
  const closeModal = useCallback(() => setModal(null), []);
  const closePrompt = useCallback(() => setCompletingId(null), []);

  const selected = s.data.projects.find((p) => p.id === selectedId) ?? null;
  const editing = modal?.mode === "edit" ? s.data.projects.find((p) => p.id === modal.projectId) : undefined;
  const onProjects = page === "projects";

  function openProjects() {
    setSelectedId(null);
    setPage("projects");
  }

  function openProject(id: string) {
    if (id !== justHatchedId) setJustHatchedId(null);
    setSelectedId(id);
    setPage("projects");
  }

  // Links from the browser pets (Open project, Done after a nap). Read through a ref, so the
  // hashchange listener is added once and still sees the latest data.
  const followLink = useRef<() => void>(() => {});
  followLink.current = () => {
    const link = parseHashLink(window.location.hash);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!link) return;
    if (link.kind === "project") {
      if (s.data.projects.some((p) => p.id === link.id)) openProject(link.id);
      return;
    }
    const task = s.data.tasks.find((t) => t.id === link.id);
    if (!task) return;
    openProject(task.projectId);
    if (!task.done && !isBlocked(task, s.data.tasks)) setCompletingId(task.id);
  };
  useEffect(() => {
    const follow = () => followLink.current();
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  const navButton = (label: string, active: boolean, onClick: () => void, color?: string, small = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`${small ? "px-3 py-1 text-xs whitespace-nowrap" : "px-3 py-1.5 text-sm"} transition-colors flex items-center gap-1.5 ${active ? NAV_ACTIVE : NAV_IDLE}`}
    >
      {color && <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: active ? "white" : color }} />}
      {label}
    </button>
  );

  const navItems = (small: boolean) => [
    navButton(small ? "All" : "All Projects", onProjects && !selected, openProjects, undefined, small),
    ...s.data.projects.map((p) => navButton(p.shortName, onProjects && selected?.id === p.id, () => openProject(p.id), p.color, small)),
    navButton("Shop", page === "shop", () => setPage("shop"), undefined, small),
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-background)" }}>
      <header className="bg-[var(--color-card)] border-b border-[var(--color-border)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <span style={SERIF} className="text-lg italic text-[var(--color-foreground)]">
              Studium
            </span>
            <nav aria-label="Main" className="hidden sm:flex items-center gap-1 overflow-x-auto">
              {navItems(false)}
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-mono text-[var(--color-muted-foreground)] whitespace-nowrap">
              {tokenBalance(s.data.events)} tokens
            </span>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              className="w-8 h-8 border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-foreground)] transition-colors flex items-center justify-center"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? "☾" : "☀"}
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="text-sm px-4 py-1.5 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] transition-colors whitespace-nowrap"
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      <nav aria-label="Main (mobile)" className="sm:hidden bg-[var(--color-card)] border-b border-[var(--color-border)] px-4 py-2 flex gap-2 overflow-x-auto">
        {navItems(true)}
      </nav>

      <NoticeBanner notice={s.notice} onDismiss={s.dismissNotice} />

      <main className="max-w-6xl mx-auto w-full px-6 py-10">
        {page === "shop" ? (
          <Shop />
        ) : selected ? (
          <>
            <button
              type="button"
              onClick={openProjects}
              className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors mb-6"
            >
              ‹ All Projects
            </button>
            <ProjectDetail
              key={selected.id}
              projectId={selected.id}
              justHatched={selected.id === justHatchedId}
              onRequestComplete={setCompletingId}
              onEditProject={() => setModal({ mode: "edit", projectId: selected.id })}
              onOpenShop={() => setPage("shop")}
            />
          </>
        ) : (
          <Overview onSelect={openProject} onRequestComplete={setCompletingId} />
        )}
      </main>

      {modal && (
        <ProjectModal
          project={editing}
          onClose={closeModal}
          onCreated={(p) => {
            setJustHatchedId(p.id);
            setSelectedId(p.id);
            setPage("projects");
          }}
          onDeleted={openProjects}
        />
      )}
      {completingId && <CompletionPrompt taskId={completingId} onClose={closePrompt} onDone={setToast} />}
      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <StudiumProvider>
      <StudiumApp />
    </StudiumProvider>
  );
}

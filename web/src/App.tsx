import { useLayoutEffect, useState } from "react";

type Goal = { id: number; text: string; done: boolean };
type Task = { id: number; text: string; done: boolean; priority?: boolean };
type Project = {
  id: number;
  name: string;
  shortName: string;
  color: string;
  deadline: string;
  description: string;
  tasks: Task[];
  goals: Goal[];
};
type Theme = "light" | "dark";
type ShopCategory = "Food" | "Clothes" | "Toys";
type ShopProduct = {
  id: number;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
};

const COLORS = ["#2d3a8c", "#c9501a", "#3a7c4f", "#7b4fa6", "#8a6a00", "#1a6e7e"];

const SHOP_PRODUCTS: ShopProduct[] = [
  { id: 1, name: "Berry Bites", description: "A sweet everyday snack for your companion.", category: "Food", price: 35 },
  { id: 2, name: "Power Bento", description: "A hearty meal for long study sessions.", category: "Food", price: 60 },
  { id: 3, name: "Scholar Scarf", description: "A soft scarf with a studious stripe.", category: "Clothes", price: 120 },
  { id: 4, name: "Rainy-Day Coat", description: "Keeps tiny paws dry in any weather.", category: "Clothes", price: 180 },
  { id: 5, name: "Focus Ball", description: "A bouncy reward after completing a task.", category: "Toys", price: 75 },
  { id: 6, name: "Puzzle Cube", description: "A clever toy for curious companions.", category: "Toys", price: 150 },
];

const INITIAL_PROJECTS: Project[] = [
  {
    id: 1,
    name: "Web Development Portfolio",
    shortName: "webDev",
    color: "#2d3a8c",
    deadline: "2026-12-01",
    description: "Build a personal portfolio site with case studies, live demos, and a blog.",
    tasks: [
      { id: 1, text: "Design landing page layout", done: true },
      { id: 2, text: "Implement responsive nav", done: true },
      { id: 3, text: "Write 3 case study pages", done: false, priority: true },
      { id: 4, text: "Add contact form with validation", done: false },
      { id: 5, text: "Deploy to Vercel", done: false },
    ],
    goals: [
      { id: 1, text: "Finish case study #2 draft", done: true },
      { id: 2, text: "Review color system tokens", done: false },
    ],
  },
  {
    id: 2,
    name: "Mobile App — Habit Tracker",
    shortName: "appDev",
    color: "#c9501a",
    deadline: "2027-02-15",
    description: "React Native app for tracking daily habits with streaks, reminders, and analytics.",
    tasks: [
      { id: 1, text: "Set up Expo project", done: true },
      { id: 2, text: "Design onboarding flow", done: true },
      { id: 3, text: "Build habit CRUD screens", done: true },
      { id: 4, text: "Implement streak logic", done: false, priority: true },
      { id: 5, text: "Push notification integration", done: false },
      { id: 6, text: "Analytics dashboard", done: false },
    ],
    goals: [
      { id: 1, text: "Code streak logic & unit tests", done: false },
      { id: 2, text: "Design notification permission UX", done: false },
      { id: 3, text: "Review Expo docs on background tasks", done: true },
    ],
  },
  {
    id: 3,
    name: "3D Animation Reel",
    shortName: "Animation",
    color: "#3a7c4f",
    deadline: "2026-11-01",
    description: "Produce a 90-second showreel showcasing motion graphics and 3D character animation.",
    tasks: [
      { id: 1, text: "Storyboard all 6 scenes", done: true },
      { id: 2, text: "Model hero character", done: true },
      { id: 3, text: "Rig & weight paint character", done: false, priority: true },
      { id: 4, text: "Animate scene 1 & 2", done: false },
      { id: 5, text: "Render final frames", done: false },
      { id: 6, text: "Sound design & export", done: false },
    ],
    goals: [
      { id: 1, text: "Complete weight painting pass", done: false },
    ],
  },
  {
    id: 4,
    name: "Senior Capstone Project",
    shortName: "seniorCap",
    color: "#7b4fa6",
    deadline: "2027-05-10",
    description: "Full-stack AI-assisted tutoring platform — research, development, and thesis paper.",
    tasks: [
      { id: 1, text: "Literature review (20 papers)", done: true },
      { id: 2, text: "Define research questions", done: true },
      { id: 3, text: "System architecture design", done: true },
      { id: 4, text: "Build prototype v1", done: false, priority: true },
      { id: 5, text: "User study (n=20)", done: false },
      { id: 6, text: "Write thesis draft", done: false },
      { id: 7, text: "Defense presentation", done: false },
    ],
    goals: [
      { id: 1, text: "Outline prototype database schema", done: true },
      { id: 2, text: "Read 2 papers on LLM tutoring", done: false },
    ],
  },
  {
    id: 5,
    name: "Virtual Pet Extension",
    shortName: "petExt",
    color: "#1a6e7e",
    deadline: "2026-12-15",
    description: "Chrome extension with project pets that follow you across the web and link to Studium.",
    tasks: [
      { id: 1, text: "Pet walks, drags, and throws", done: true },
      { id: 2, text: "One pet per project", done: true },
      { id: 3, text: "Save Studium data between visits", done: false, priority: true },
      { id: 4, text: "Share pet hunger and mood with Studium", done: false },
      { id: 5, text: "Replace placeholder art with sprites", done: false },
    ],
    goals: [
      { id: 1, text: "Test pets on five different sites", done: false },
    ],
  },
];

// "YYYY-MM-DD" alone parses as UTC midnight, which shows as the day before in US time zones.
function parseLocalDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function daysUntil(dateStr: string) {
  const diff = parseLocalDate(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDeadline(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function progress(tasks: Task[]) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

function totalProgress(projects: Project[]) {
  const all = projects.flatMap((p) => p.tasks);
  if (!all.length) return 0;
  return Math.round((all.filter((t) => t.done).length / all.length) * 100);
}

// ── Add Project Modal ──────────────────────────────────────────────────────────
function AddProjectModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Project) => void }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !deadline) return;
    onAdd({
      id: Date.now(),
      name,
      shortName: shortName || name.split(" ")[0],
      color: COLORS[colorIdx],
      deadline,
      description,
      tasks: [],
      goals: [],
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] w-full max-w-lg mx-4 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl">New Project</h2>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">Project Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Senior Capstone Project" className="w-full border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-foreground)]" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">Short Label</label>
            <input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. seniorCap" className="w-full border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-foreground)]" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">Deadline *</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required className="w-full border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-foreground)]" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is this project about?" className="w-full border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-foreground)] resize-none" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c, i) => (
                <button type="button" key={c} onClick={() => setColorIdx(i)} className="w-7 h-7 rounded-sm border-2 transition-all" style={{ backgroundColor: c, borderColor: colorIdx === i ? c : "transparent", outline: colorIdx === i ? `2px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[var(--color-border)] text-sm hover:border-[var(--color-foreground)] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm hover:bg-[var(--color-primary-hover)] transition-colors">Create Project</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCompanion({ project }: { project: Project }) {
  const pct = progress(project.tasks);
  const status = pct === 100 ? "Thriving" : pct >= 50 ? "Growing" : "Settling in";
  const goalRatio = project.goals.length
    ? project.goals.filter((goal) => goal.done).length / project.goals.length
    : 0.5;
  const hunger = Math.max(8, Math.round(65 - pct * 0.25 - goalRatio * 25));
  const mood = Math.min(100, Math.round(40 + pct * 0.45 + goalRatio * 15));
  const hungerState = hunger <= 25 ? "Satisfied" : hunger <= 55 ? "Peckish" : "Hungry";
  const moodState = mood >= 80 ? "Delighted" : mood >= 60 ? "Happy" : "Calm";

  return (
    <section className="border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Project Companion
          </p>
          <h2 style={{ fontFamily: "var(--font-serif)" }} className="text-xl">
            Tamagotchi Habitat
          </h2>
        </div>
        <span className="text-xs font-mono uppercase tracking-widest" style={{ color: project.color }}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_18rem]">
        <div className="relative h-48 overflow-hidden bg-[var(--color-muted)] flex items-end justify-center">
          <div className="absolute inset-x-0 bottom-0 h-12 border-t border-[var(--color-border)] bg-[var(--color-card)]" />
          <svg
            className="relative z-1 w-28 h-28 mb-7"
            viewBox="0 0 120 120"
            role="img"
            aria-label={`${project.shortName} project companion`}
            style={{ color: project.color }}
          >
            <path
              d="M35 42 29 22l20 12a43 43 0 0 1 22 0l20-12-6 20c8 8 12 18 12 29 0 23-16 36-37 36S23 94 23 71c0-11 4-21 12-29Z"
              fill="currentColor"
            />
            <path
              d="M79 84c20 1 27-12 19-23"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="8"
            />
            <circle cx="47" cy="62" r="4" fill="var(--color-card)" />
            <circle cx="73" cy="62" r="4" fill="var(--color-card)" />
            <path
              d="M55 74c3 3 7 3 10 0"
              fill="none"
              stroke="var(--color-card)"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-[var(--color-border)] p-5 flex flex-col justify-center gap-5">
          <div>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">Hunger</span>
              <span className="text-sm font-medium">{hungerState} · {hunger}%</span>
            </div>
            <div
              className="h-2 bg-[var(--color-muted)] overflow-hidden"
              role="progressbar"
              aria-label={`Hunger: ${hungerState}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={hunger}
            >
              <div className="h-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${hunger}%` }} />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">Lower hunger is better.</p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">Mood</span>
              <span className="text-sm font-medium">{moodState} · {mood}%</span>
            </div>
            <div
              className="h-2 bg-[var(--color-muted)] overflow-hidden"
              role="progressbar"
              aria-label={`Mood: ${moodState}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={mood}
            >
              <div className="h-full transition-all duration-500" style={{ width: `${mood}%`, backgroundColor: project.color }} />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">{pct}% project progress</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Project Detail ─────────────────────────────────────────────────────────────
function ProjectDetail({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const pct = progress(project.tasks);
  const days = daysUntil(project.deadline);
  const todayGoalsDone = project.goals.filter((g) => g.done).length;

  function toggleTask(id: number) {
    onChange({ ...project, tasks: project.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  }

  function togglePriority(id: number) {
    onChange({
      ...project,
      tasks: project.tasks.map((t) => (t.id === id ? { ...t, priority: !t.priority } : t)),
    });
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    onChange({
      ...project,
      tasks: [...project.tasks, { id: Date.now(), text: newTask.trim(), done: false, priority: false }],
    });
    setNewTask("");
  }

  function toggleGoal(id: number) {
    onChange({ ...project, goals: project.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)) });
  }

  function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!newGoal.trim()) return;
    onChange({ ...project, goals: [...project.goals, { id: Date.now(), text: newGoal.trim(), done: false }] });
    setNewGoal("");
  }

  function removeTask(id: number) {
    onChange({ ...project, tasks: project.tasks.filter((t) => t.id !== id) });
  }

  function removeGoal(id: number) {
    onChange({ ...project, goals: project.goals.filter((g) => g.id !== id) });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-l-4 pl-5" style={{ borderColor: project.color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">{project.shortName}</p>
            <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-3xl text-[var(--color-foreground)]">{project.name}</h1>
            {project.description && <p className="text-[var(--color-muted-foreground)] text-sm mt-1 max-w-xl">{project.description}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">Deadline</p>
            <p style={{ fontFamily: "var(--font-serif)" }} className="text-2xl">{formatDeadline(project.deadline)}</p>
            <p className={`text-xs font-mono mt-0.5 ${days < 30 ? "text-[var(--color-accent)]" : "text-[var(--color-muted-foreground)]"}`}>
              {days > 0 ? `${days} days remaining` : "Overdue"}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">Overall Progress</span>
            <span className="font-mono text-sm font-medium">{pct}%</span>
          </div>
          <div className="h-2.5 bg-[var(--color-muted)] rounded-sm overflow-hidden">
            <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: project.color }} />
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-1">{project.tasks.filter((t) => t.done).length} of {project.tasks.length} tasks complete</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tasks */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6">
          <h2 style={{ fontFamily: "var(--font-serif)" }} className="text-xl mb-4">Project Tasks</h2>
          <div className="space-y-2 mb-4">
            {project.tasks.length === 0 && (
              <p className="text-sm text-[var(--color-muted-foreground)] italic">No tasks yet — add one below.</p>
            )}
            {[...project.tasks].sort((a, b) => Number(b.priority) - Number(a.priority)).map((t) => (
              <div key={t.id} className="flex items-start gap-3 group py-1">
                <button onClick={() => toggleTask(t.id)} className="mt-0.5 w-4 h-4 flex-shrink-0 border rounded-sm flex items-center justify-center transition-colors" style={{ borderColor: t.done ? project.color : "var(--color-border)", backgroundColor: t.done ? project.color : "transparent" }}>
                  {t.done && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <span className={`text-sm flex-1 leading-relaxed ${t.done ? "line-through text-[var(--color-muted-foreground)]" : "text-[var(--color-foreground)]"}`}>{t.text}</span>
                <button
                  onClick={() => togglePriority(t.id)}
                  aria-label={t.priority ? "Remove high priority" : "Mark as high priority"}
                  title={t.priority ? "Remove high priority" : "Mark as high priority"}
                  className={`transition-colors ${t.priority ? "text-[var(--color-accent)]" : "text-[var(--color-border)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-accent)]"}`}
                >
                  <svg className="w-4 h-4" fill={t.priority ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 21V5.5A2.5 2.5 0 0 1 8.5 3H19l-2.5 4L19 11H8" />
                  </svg>
                </button>
                <button onClick={() => removeTask(t.id)} className="opacity-0 group-hover:opacity-100 text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)] text-lg leading-none transition-opacity">×</button>
              </div>
            ))}
          </div>
          <form onSubmit={addTask} className="flex gap-2">
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task..." className="flex-1 border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-foreground)]" />
            <button type="submit" className="px-3 py-1.5 bg-[var(--color-foreground)] text-[var(--color-background)] text-sm hover:opacity-80 transition-opacity">+</button>
          </form>
        </div>

        {/* Daily Goals */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="text-xl">Today's Goals</h2>
            <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{todayGoalsDone}/{project.goals.length} done</span>
          </div>
          {project.goals.length > 0 && (
            <div className="h-1 bg-[var(--color-muted)] rounded-sm mb-4 overflow-hidden">
              <div className="h-full rounded-sm transition-all" style={{ width: project.goals.length ? `${(todayGoalsDone / project.goals.length) * 100}%` : "0%", backgroundColor: project.color }} />
            </div>
          )}
          <div className="space-y-2 mb-4">
            {project.goals.length === 0 && (
              <p className="text-sm text-[var(--color-muted-foreground)] italic">No goals set for today.</p>
            )}
            {project.goals.map((g) => (
              <div key={g.id} className="flex items-start gap-3 group py-1">
                <button onClick={() => toggleGoal(g.id)} className="mt-0.5 w-4 h-4 flex-shrink-0 border-2 rounded-full flex items-center justify-center transition-colors" style={{ borderColor: g.done ? project.color : "var(--color-border)", backgroundColor: g.done ? project.color : "transparent" }}>
                  {g.done && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </button>
                <span className={`text-sm flex-1 leading-relaxed ${g.done ? "line-through text-[var(--color-muted-foreground)]" : "text-[var(--color-foreground)]"}`}>{g.text}</span>
                <button onClick={() => removeGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)] text-lg leading-none transition-opacity">×</button>
              </div>
            ))}
          </div>
          <form onSubmit={addGoal} className="flex gap-2">
            <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Add a daily goal..." className="flex-1 border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-foreground)]" />
            <button type="submit" className="px-3 py-1.5 text-white text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: project.color }}>+</button>
          </form>
        </div>
      </div>

      <ProjectCompanion project={project} />
    </div>
  );
}

// ── All Projects Overview ──────────────────────────────────────────────────────
function Overview({
  projects,
  onSelect,
  onToggleTask,
}: {
  projects: Project[];
  onSelect: (id: number) => void;
  onToggleTask: (projectId: number, taskId: number) => void;
}) {
  const tp = totalProgress(projects);
  const totalTasks = projects.flatMap((p) => p.tasks).length;
  const doneTasks = projects.flatMap((p) => p.tasks).filter((t) => t.done).length;
  const totalGoals = projects.flatMap((p) => p.goals).length;
  const doneGoals = projects.flatMap((p) => p.goals).filter((g) => g.done).length;
  const priorityTasks = projects
    .flatMap((project) =>
      project.tasks
        .filter((task) => task.priority && !task.done)
        .map((task) => ({ project, task })),
    )
    .sort((a, b) => daysUntil(a.project.deadline) - daysUntil(b.project.deadline));

  return (
    <div className="space-y-8">
      {/* Total progress */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">Total Progress — All Projects</p>
            <p style={{ fontFamily: "var(--font-serif)" }} className="text-5xl">{tp}<span className="text-2xl text-[var(--color-muted-foreground)]">%</span></p>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">Tasks</p>
              <p style={{ fontFamily: "var(--font-serif)" }} className="text-2xl">{doneTasks}<span className="text-base text-[var(--color-muted-foreground)]"> / {totalTasks}</span></p>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">Today's Goals</p>
              <p style={{ fontFamily: "var(--font-serif)" }} className="text-2xl">{doneGoals}<span className="text-base text-[var(--color-muted-foreground)]"> / {totalGoals}</span></p>
            </div>
          </div>
        </div>
        {/* Circular project progress */}
        <div className="flex flex-col md:flex-row items-center gap-8 border-t border-[var(--color-border)] pt-6">
          <div className="relative w-44 h-44 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-label={`${tp}% total progress`}>
              {projects.map((p, index) => {
                const radius = 44 - index * (30 / Math.max(projects.length - 1, 1));
                const strokeWidth = Math.min(5, 26 / Math.max(projects.length, 1));
                const projectProgress = progress(p.tasks);
                return (
                  <g key={p.id}>
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke="var(--color-muted)"
                      strokeWidth={strokeWidth}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      pathLength="100"
                      fill="none"
                      stroke={p.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${projectProgress} ${100 - projectProgress}`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </g>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontFamily: "var(--font-serif)" }} className="text-xl leading-none">{tp}</span>
              <span className="text-xs font-mono text-[var(--color-muted-foreground)]">%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 flex-1 w-full">
            {projects.map((p) => {
              const projectProgress = progress(p.tasks);
              return (
                <button key={p.id} onClick={() => onSelect(p.id)} className="flex items-center gap-3 text-left group">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
                      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-muted)" strokeWidth="4" />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        pathLength="100"
                        fill="none"
                        stroke={p.color}
                        strokeWidth="4"
                        strokeDasharray={`${projectProgress} ${100 - projectProgress}`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-mono">{projectProgress}</span>
                  </div>
                  <span>
                    <span className="block text-xs font-mono text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)] transition-colors">
                      {p.shortName}
                    </span>
                    <span className="block text-xs text-[var(--color-muted-foreground)] mt-0.5">
                      {p.tasks.filter((task) => task.done).length}/{p.tasks.length} tasks
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Priority focus */}
      <section className="bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-l-4 border-[var(--color-accent)] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-white/55 mb-1">Priority Focus</p>
            <p style={{ fontFamily: "var(--font-serif)" }} className="text-2xl">What matters next</p>
          </div>
          <p className="text-xs text-white/55 max-w-sm">
            Flag important tasks inside any project to keep them visible here.
          </p>
        </div>
        {priorityTasks.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/15">
            {priorityTasks.map(({ project, task }, index) => (
              <div key={`${project.id}-${task.id}`} className="bg-[var(--color-foreground)] p-4 flex items-start gap-3">
                <button
                  onClick={() => onToggleTask(project.id, task.id)}
                  aria-label={`Complete ${task.text}`}
                  className="mt-0.5 w-5 h-5 flex-shrink-0 border border-white/35 hover:border-white flex items-center justify-center transition-colors"
                >
                  <span className="text-xs font-mono text-white/45">{String(index + 1).padStart(2, "0")}</span>
                </button>
                <button onClick={() => onSelect(project.id)} className="text-left flex-1 group">
                  <span className="block text-xs font-mono uppercase tracking-widest text-white/50 mb-1">
                    {project.shortName} · {daysUntil(project.deadline)}d left
                  </span>
                  <span className="block text-sm leading-snug group-hover:text-[var(--color-accent)] transition-colors">
                    {task.text}
                  </span>
                </button>
                <svg className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 21V5.5A2.5 2.5 0 0 1 8.5 3H19l-2.5 4L19 11H8" />
                </svg>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/55 border-t border-white/15 pt-4">
            No priority tasks yet. Open a project and use the flag beside a task.
          </p>
        )}
      </section>

      {/* Project cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((p) => {
          const pct = progress(p.tasks);
          const days = daysUntil(p.deadline);
          const goalsDone = p.goals.filter((g) => g.done).length;

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 text-left hover:border-[var(--color-foreground)] transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: p.color }} />
                  <div>
                    <p className="text-xs font-mono text-[var(--color-muted-foreground)] uppercase tracking-widest">{p.shortName}</p>
                    <p className="font-semibold text-[var(--color-foreground)] leading-tight mt-0.5">{p.name}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[var(--color-border)] group-hover:text-[var(--color-foreground)] transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-xs text-[var(--color-muted-foreground)]">{p.tasks.filter((t) => t.done).length} / {p.tasks.length} tasks</span>
                  <span className="text-xs font-mono font-medium">{pct}%</span>
                </div>
                <div className="h-1.5 bg-[var(--color-muted)] rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                <span className={days < 30 ? "text-[var(--color-accent)] font-medium" : ""}>
                  {days > 0 ? `${days}d until deadline` : "Overdue"} · {formatDeadline(p.deadline)}
                </span>
                {p.goals.length > 0 && (
                  <span className="font-mono">{goalsDone}/{p.goals.length} goals today</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShopProductIcon({ category }: { category: ShopCategory }) {
  if (category === "Food") {
    return (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M14 28h36l-4 22H18l-4-22Z" strokeWidth="2" strokeLinejoin="round" />
        <path d="M21 28c1-8 6-13 11-13s10 5 11 13M26 20c-2-5 1-9 6-10" strokeWidth="2" strokeLinecap="round" />
        <circle cx="26" cy="35" r="2" fill="currentColor" stroke="none" />
        <circle cx="38" cy="35" r="2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (category === "Clothes") {
    return (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="m22 14-12 9 7 10 6-4v22h18V29l6 4 7-10-12-9c-2 4-5 6-10 6s-8-2-10-6Z" strokeWidth="2" strokeLinejoin="round" />
        <path d="M26 18c1 5 3 8 6 8s5-3 6-8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M18 41c0-12 7-22 14-22s14 10 14 22" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="43" r="7" strokeWidth="2" />
      <circle cx="46" cy="43" r="7" strokeWidth="2" />
      <path d="M24 43h16M28 19l-5-7M36 19l5-7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Shop({
  balance,
  inventory,
  onPurchase,
}: {
  balance: number;
  inventory: Record<number, number>;
  onPurchase: (product: ShopProduct) => void;
}) {
  const ownedItems = Object.values(inventory).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--color-border)] pb-7">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-accent)] mb-2">Companion Supplies</p>
          <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)]">Shop</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-2 max-w-lg">
            Spend study tokens on treats, outfits, and toys for your project companions.
          </p>
        </div>
        <div className="bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] px-5 py-3 min-w-44">
          <p className="text-xs font-mono uppercase tracking-widest text-white/55">Your Balance</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span style={{ fontFamily: "var(--font-serif)" }} className="text-3xl">{balance}</span>
            <span className="text-xs font-mono uppercase tracking-widest text-white/65">Study Tokens</span>
          </div>
        </div>
      </div>

      {(["Food", "Clothes", "Toys"] as ShopCategory[]).map((category) => (
        <section key={category}>
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl">{category}</h2>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">
              {category === "Food" ? "Care & energy" : category === "Clothes" ? "Companion style" : "Play & enrichment"}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SHOP_PRODUCTS.filter((product) => product.category === category).map((product) => {
              const owned = inventory[product.id] ?? 0;
              const canAfford = balance >= product.price;

              return (
                <article key={product.id} className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 flex gap-5">
                  <div className="w-24 h-24 flex-shrink-0 bg-[var(--color-muted)] text-[var(--color-primary)] flex items-center justify-center">
                    <ShopProductIcon category={product.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--color-foreground)]">{product.name}</h3>
                        <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed mt-1">{product.description}</p>
                      </div>
                      {owned > 0 && (
                        <span className="text-xs font-mono text-[var(--color-accent)] whitespace-nowrap">OWNED ×{owned}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onPurchase(product)}
                      disabled={!canAfford}
                      className="mt-4 w-full px-3 py-2 text-xs font-mono uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-muted)] disabled:text-[var(--color-muted-foreground)] disabled:cursor-not-allowed transition-colors"
                    >
                      {canAfford ? `Buy · ${product.price} tokens` : `Need ${product.price - balance} more`}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <div className="border-t border-[var(--color-border)] pt-4 flex justify-between text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">
        <span>Inventory</span>
        <span>{ownedItems} items owned</span>
      </div>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState<"projects" | "shop">("projects");
  const [showAdd, setShowAdd] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(650);
  const [inventory, setInventory] = useState<Record<number, number>>({});
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem("studium-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("studium-theme", theme);
  }, [theme]);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  function updateProject(updated: Project) {
    setProjects((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
  }

  function addProject(p: Project) {
    setProjects((ps) => [...ps, p]);
    setSelectedId(p.id);
    setPage("projects");
  }

  function openProjects() {
    setSelectedId(null);
    setPage("projects");
  }

  function openProject(id: number) {
    setSelectedId(id);
    setPage("projects");
  }

  function purchaseProduct(product: ShopProduct) {
    if (tokenBalance < product.price) return;
    setTokenBalance((balance) => balance - product.price);
    setInventory((current) => ({
      ...current,
      [product.id]: (current[product.id] ?? 0) + 1,
    }));
  }

  function toggleTask(projectId: number, taskId: number) {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task.id === taskId ? { ...task, done: !task.done } : task,
              ),
            }
          : project,
      ),
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Top bar */}
      <header className="bg-[var(--color-card)] border-b border-[var(--color-border)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span style={{ fontFamily: "var(--font-serif)" }} className="text-lg italic text-[var(--color-foreground)]">
              Studium
            </span>
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={openProjects}
                className={`px-3 py-1.5 text-sm transition-colors ${page === "projects" && selectedId === null ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
              >
                All Projects
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  className={`px-3 py-1.5 text-sm transition-colors flex items-center gap-1.5 ${page === "projects" && selectedId === p.id ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
                >
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: page === "projects" && selectedId === p.id ? "white" : p.color }} />
                  {p.shortName}
                </button>
              ))}
              <button
                onClick={() => setPage("shop")}
                className={`px-3 py-1.5 text-sm transition-colors ${page === "shop" ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
              >
                Shop
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
              className="w-8 h-8 border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-foreground)] transition-colors flex items-center justify-center"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20.4 15.5A8.5 8.5 0 0 1 8.5 3.6 8.5 8.5 0 1 0 20.4 15.5Z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3.5" strokeWidth={1.7} />
                  <path strokeLinecap="round" strokeWidth={1.7} d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="text-sm px-4 py-1.5 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="sm:hidden bg-[var(--color-card)] border-b border-[var(--color-border)] px-4 py-2 flex gap-2 overflow-x-auto">
        <button onClick={openProjects} className={`px-3 py-1 text-xs whitespace-nowrap transition-colors ${page === "projects" && selectedId === null ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]" : "text-[var(--color-muted-foreground)]"}`}>All</button>
        {projects.map((p) => (
          <button key={p.id} onClick={() => openProject(p.id)} className={`px-3 py-1 text-xs whitespace-nowrap flex items-center gap-1 transition-colors ${page === "projects" && selectedId === p.id ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]" : "text-[var(--color-muted-foreground)]"}`}>
            <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: page === "projects" && selectedId === p.id ? "white" : p.color }} />
            {p.shortName}
          </button>
        ))}
        <button onClick={() => setPage("shop")} className={`px-3 py-1 text-xs whitespace-nowrap transition-colors ${page === "shop" ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]" : "text-[var(--color-muted-foreground)]"}`}>Shop</button>
      </div>

      <main className="max-w-6xl mx-auto w-full px-6 py-10">
        {page === "shop" ? (
          <Shop balance={tokenBalance} inventory={inventory} onPurchase={purchaseProduct} />
        ) : selectedProject ? (
          <>
            <button onClick={openProjects} className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors mb-6">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              All Projects
            </button>
            <ProjectDetail project={selectedProject} onChange={updateProject} />
          </>
        ) : (
          <>
            <div className="mb-8">
              <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)]">Your Projects</h1>
              <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">{projects.length} active projects · {projects.flatMap((p) => p.goals).filter((g) => !g.done).length} goals remaining today</p>
            </div>
            <Overview projects={projects} onSelect={openProject} onToggleTask={toggleTask} />
          </>
        )}
      </main>

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} onAdd={addProject} />}
    </div>
  );
}

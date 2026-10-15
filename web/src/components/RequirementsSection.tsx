import { useState } from "react";
import { useStudiumContext } from "../store/useStudium";
import { BUTTON_SMALL, CARD, SERIF } from "../ui/styles";
import RequirementCard from "./RequirementCard";
import RequirementForm from "./RequirementForm";
import TaskRow from "./TaskRow";

type Props = { projectId: string; onRequestComplete: (taskId: string) => void };

export default function RequirementsSection({ projectId, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const [adding, setAdding] = useState(false);
  const requirements = s.data.requirements.filter((r) => r.projectId === projectId);
  const unlinked = s.data.tasks.filter((t) => t.projectId === projectId && t.requirementId === null);

  return (
    <section aria-labelledby="requirements-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="requirements-heading" style={SERIF} className="text-2xl">
          Requirements
        </h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={BUTTON_SMALL}>
            + Add requirement
          </button>
        )}
      </div>
      {adding && (
        <div className={`${CARD} p-5`}>
          <RequirementForm
            submitLabel="Add requirement"
            onSubmit={(values) => {
              s.createRequirement({ projectId, ...values });
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
      {requirements.length === 0 && !adding && (
        <p className="text-sm italic text-[var(--color-muted-foreground)]">
          No requirements yet. Add one first: every task belongs to a requirement, and its weight decides what the tasks
          are worth.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {requirements.map((r) => (
          <RequirementCard key={r.id} requirementId={r.id} onRequestComplete={onRequestComplete} />
        ))}
      </div>
      {unlinked.length > 0 && (
        <section aria-label="Unlinked tasks" className={`${CARD} p-5 border-dashed`}>
          <h3 className="font-semibold">Unlinked</h3>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">
            These tasks earn nothing until you link them to a requirement.
          </p>
          {unlinked.map((t) => (
            <TaskRow key={t.id} taskId={t.id} onRequestComplete={onRequestComplete} />
          ))}
        </section>
      )}
    </section>
  );
}

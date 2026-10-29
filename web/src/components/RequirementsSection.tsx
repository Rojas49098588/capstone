import { useState } from "react";
import { useStudiumContext } from "../store/useStudium";
import { capitalize, hatchingMessage, wordsFor } from "../ui/format";
import { BUTTON_SMALL, CARD, SERIF } from "../ui/styles";
import RequirementCard from "./RequirementCard";
import RequirementForm from "./RequirementForm";
import TaskRow from "./TaskRow";

type Props = {
  projectId: string;
  onRequestComplete: (taskId: string) => void;
  onHatch: (message: string) => void; // the 3rd requirement just hatched the project's egg
};

export default function RequirementsSection({ projectId, onRequestComplete, onHatch }: Props) {
  const s = useStudiumContext();
  const [adding, setAdding] = useState(false);
  const requirements = s.data.requirements.filter((r) => r.projectId === projectId);
  const words = wordsFor(s.data.projects.find((p) => p.id === projectId));
  const unlinked = s.data.tasks.filter((t) => t.projectId === projectId && t.requirementId === null);

  return (
    <section aria-labelledby="requirements-heading" data-tour="requirements" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="requirements-heading" style={SERIF} className="text-2xl">
          {capitalize(words.requirements)}
        </h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={BUTTON_SMALL}>
            + Add {words.requirement}
          </button>
        )}
      </div>
      {adding && (
        <div className={`${CARD} p-5`}>
          <RequirementForm
            submitLabel={`Add ${words.requirement}`}
            words={words}
            onSubmit={(values) => {
              const { hatched } = s.createRequirement({ projectId, ...values });
              const project = s.data.projects.find((p) => p.id === projectId);
              if (hatched && project) onHatch(hatchingMessage(project.shortName));
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
      {requirements.length === 0 && !adding && (
        <p className="text-sm italic text-[var(--color-muted-foreground)]">
          No {words.requirements} yet. Add one first: every {words.task} belongs to a {words.requirement}, and its weight
          decides what the {words.tasks} are worth.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {requirements.map((r) => (
          <RequirementCard key={r.id} requirementId={r.id} onRequestComplete={onRequestComplete} />
        ))}
      </div>
      {unlinked.length > 0 && (
        <section aria-label={`Unlinked ${words.tasks}`} className={`${CARD} p-5 border-dashed`}>
          <h3 className="font-semibold">Unlinked</h3>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">
            These {words.tasks} earn nothing until you link them to a {words.requirement}.
          </p>
          {unlinked.map((t) => (
            <TaskRow key={t.id} taskId={t.id} onRequestComplete={onRequestComplete} />
          ))}
        </section>
      )}
    </section>
  );
}

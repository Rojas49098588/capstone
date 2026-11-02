import { useId, useState } from "react";
import { isRequirementDone } from "../planner/progress";
import { suggestedPetName, type PetRef } from "../planner/pets";
import { NICKNAME_MAX } from "../planner/tuning";
import { useStudiumContext } from "../store/useStudium";
import { PET_SETUP_TEXT, SHARES_MOOD_OPTION, looksAfterOption } from "../ui/format";
import { BUTTON_PRIMARY, LABEL } from "../ui/styles";

/** "Cares about": shares the project's mood ("") or looks after one unfinished requirement. */
export function CaresAboutSelect({ pet, value, onChange }: { pet: PetRef; value: string; onChange: (value: string) => void }) {
  const s = useStudiumContext();
  const id = useId();
  const open = s.data.requirements.filter((r) => r.projectId === pet.projectId && !isRequirementDone(r.id, s.data.tasks));
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        Cares about
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-sm"
      >
        <option value="">{SHARES_MOOD_OPTION}</option>
        {open.map((r) => (
          <option key={r.id} value={r.id}>
            {looksAfterOption(r.title)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Shown once a bought egg hatches: name the pet and choose what it cares about, in one step. */
export default function PetSetup({ pet }: { pet: PetRef }) {
  const s = useStudiumContext();
  const project = s.data.projects.find((p) => p.id === pet.projectId);
  const [name, setName] = useState(() => (project ? suggestedPetName(project, pet.kind) : ""));
  const [caresFor, setCaresFor] = useState("");
  const nameId = useId();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        s.setUpPet(pet.projectId, pet.petId, { name, caresFor: caresFor || null });
      }}
    >
      <p>{PET_SETUP_TEXT}</p>
      <div>
        <label htmlFor={nameId} className={LABEL}>
          Name
        </label>
        <input
          id={nameId}
          value={name}
          maxLength={NICKNAME_MAX}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-sm"
        />
      </div>
      <CaresAboutSelect pet={pet} value={caresFor} onChange={setCaresFor} />
      <button type="submit" className={BUTTON_PRIMARY}>
        Done
      </button>
    </form>
  );
}

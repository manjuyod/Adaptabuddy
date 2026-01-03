import type { WizardInjury } from "./types";

const randomId = () => Math.random().toString(16).slice(2);

export const createInjuryId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `injury-${Date.now()}-${randomId()}`;
};

type PartialInjury = Omit<WizardInjury, "id"> & Partial<Pick<WizardInjury, "id">>;

export const ensureInjuryIds = (injuries: PartialInjury[]): WizardInjury[] =>
  injuries.map((injury) => ({
    ...injury,
    id: typeof injury.id === "string" && injury.id.length ? injury.id : createInjuryId()
  }));

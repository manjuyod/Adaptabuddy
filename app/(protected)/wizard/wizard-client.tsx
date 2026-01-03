"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import {
  equipmentOptions,
  dayOptions,
  fatigueProfiles
} from "@/lib/wizard/schemas";
import type {
  EquipmentOption,
  PlannedSession,
  PreviewResult,
  TemplateSummary,
  WizardInjury
} from "@/lib/wizard/types";
import {
  AlertTriangle,
  CheckCircle,
  Flame,
  Loader2,
  Sparkles
} from "lucide-react";

type WizardClientProps = {
  userId: string;
  initialInjuries: WizardInjury[];
  initialPreferences: Record<string, unknown>;
  templateSummaries: TemplateSummary[];
  hasExistingProgram: boolean;
};

type ProgramSelection = {
  template_id: number;
  weight_override?: number;
};

const isEquipmentOption = (value: unknown): value is EquipmentOption =>
  typeof value === "string" &&
  (equipmentOptions as readonly string[]).includes(value);

const pullNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const pullArray = (value: unknown) => (Array.isArray(value) ? value : []);

export function WizardClient({
  userId,
  initialInjuries,
  initialPreferences,
  templateSummaries,
  hasExistingProgram
}: WizardClientProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [injuries, setInjuries] = useState<WizardInjury[]>(initialInjuries);
  const [newInjuryName, setNewInjuryName] = useState("");
  const [newInjurySeverity, setNewInjurySeverity] = useState(3);
  const initialFatigue =
    typeof initialPreferences.fatigue_profile === "string" &&
    fatigueProfiles.includes(initialPreferences.fatigue_profile as string)
      ? (initialPreferences.fatigue_profile as typeof fatigueProfiles[number])
      : ("medium" as const);
  const [fatigueProfile, setFatigueProfile] =
    useState<typeof fatigueProfiles[number]>(initialFatigue);

  const initialEquipment = pullArray(initialPreferences.equipment_profile).filter(
    isEquipmentOption
  ) as EquipmentOption[];
  const [equipment, setEquipment] = useState<EquipmentOption[]>(initialEquipment);

  const [selectedPrograms, setSelectedPrograms] = useState<ProgramSelection[]>(
    templateSummaries.length
      ? [{ template_id: templateSummaries[0].id, weight_override: 1 }]
      : []
  );

  const [daysPerWeek, setDaysPerWeek] = useState(
    pullNumber(initialPreferences.days_per_week, 3)
  );
  const [maxSessionMinutes, setMaxSessionMinutes] = useState(
    pullNumber(initialPreferences.max_session_minutes, 60)
  );
  const [preferredDays, setPreferredDays] = useState<string[]>(
    pullArray(initialPreferences.preferred_days).filter((day) =>
      dayOptions.includes(day as (typeof dayOptions)[number])
    ) as string[]
  );
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [plannedSchedule, setPlannedSchedule] = useState<PlannedSession[] | null>(
    null
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const templatesById = useMemo(
    () => new Map(templateSummaries.map((template) => [template.id, template])),
    [templateSummaries]
  );

  const steps = [
    "Constraints",
    "Program mix",
    "Schedule",
    "Preview & generate"
  ];

  const selectionValid = selectedPrograms.length > 0;

  const toggleEquipment = (option: EquipmentOption) => {
    setEquipment((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
  };

  const togglePreferredDay = (day: string) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day]
    );
  };

const clampWeight = (value: number) => Math.min(2, Math.max(0.5, value));

const toggleProgram = (templateId: number) => {
  setSelectedPrograms((prev) => {
    const exists = prev.some((program) => program.template_id === templateId);
    if (exists) {
      return prev.filter((program) => program.template_id !== templateId);
    }
      return [...prev, { template_id: templateId, weight_override: 1 }];
    });
  };

const updateProgramWeight = (templateId: number, weight: number) => {
  const clamped = clampWeight(weight);
  setSelectedPrograms((prev) =>
    prev.map((program) =>
      program.template_id === templateId
        ? { ...program, weight_override: clamped }
        : program
    )
  );
};

  const addInjury = () => {
    if (!newInjuryName.trim()) {
      toast({ title: "Add an injury name", description: "Example: Left knee ache." });
      return;
    }
    setInjuries((prev) => [
      ...prev,
      { name: newInjuryName.trim(), severity: newInjurySeverity }
    ]);
    setNewInjuryName("");
    setNewInjurySeverity(3);
  };

  const payload = useMemo(
    () => ({
      user_id: userId,
      injuries,
      fatigue_profile: fatigueProfile,
      equipment_profile: equipment,
      selected_programs: selectedPrograms,
      days_per_week: daysPerWeek,
      max_session_minutes: maxSessionMinutes,
      preferred_days: preferredDays,
      confirm_overwrite: confirmOverwrite
    }),
    [
      userId,
      injuries,
      fatigueProfile,
      equipment,
      selectedPrograms,
      daysPerWeek,
      maxSessionMinutes,
      preferredDays,
      confirmOverwrite
    ]
  );

  const runPreview = async () => {
    setIsPreviewing(true);
    setPlannedSchedule(null);
    try {
      const response = await fetch("/api/wizard/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Preview failed");
      }
      const body = (await response.json()) as PreviewResult;
      setPreview(body);
      toast({
        title: "Preview ready",
        description: "Review weekly sets and recovery load before generating."
      });
    } catch (error) {
      toast({
        title: "Preview error",
        description:
          error instanceof Error ? error.message : "Unable to compute preview right now."
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const runGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/wizard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not generate program.");
      }

      const body = (await response.json()) as {
        preview: PreviewResult;
        schedule: PlannedSession[];
      };
      setPreview(body.preview);
      setPlannedSchedule(body.schedule);
      toast({
        title: "Program generated",
        description: "Active program updated and sessions scheduled."
      });
    } catch (error) {
      toast({
        title: "Generate failed",
        description:
          error instanceof Error ? error.message : "Unable to generate program now."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const goNext = () => {
    if (step === 1 && !selectionValid) {
      toast({
        title: "Select at least one program",
        description: "Pick a template to mix before continuing."
      });
      return;
    }
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
    }
  };

  const goBack = () => setStep((prev) => Math.max(0, prev - 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Program Builder Wizard v2
          </p>
          <h2 className="text-xl font-semibold text-white">
            Constraint-aware program mix
          </h2>
        </div>
        <Chip variant="success">Deterministic</Chip>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-300">
        {steps.map((label, index) => {
          const active = index === step;
          const completed = index < step;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-sm",
                  active
                    ? "border-brand-400 bg-brand-500/20 text-brand-100"
                    : completed
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                      : "border-slate-700 bg-slate-800 text-slate-300"
                )}
              >
                {completed ? <CheckCircle size={16} /> : index + 1}
              </div>
              <span className={active ? "text-white" : "text-slate-400"}>{label}</span>
              {index < steps.length - 1 && (
                <div className="h-px w-6 bg-slate-700" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <Card className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Sparkles size={18} className="text-brand-200" />
            Capture injuries, fatigue, and equipment constraints.
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Injuries
            </p>
            <div className="flex flex-wrap gap-2">
              {injuries.map((injury) => (
                <Chip
                  key={`${injury.name}-${injury.severity}`}
                  className="flex items-center gap-2 bg-slate-800"
                >
                  <span className="font-semibold text-white">{injury.name}</span>
                  <span className="text-xs text-slate-300">S{injury.severity}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-slate-300"
                    onClick={() =>
                      setInjuries((prev) =>
                        prev.filter(
                          (entry) =>
                            !(entry.name === injury.name && entry.severity === injury.severity)
                        )
                      )
                    }
                  >
                    Remove
                  </Button>
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder="e.g. Left knee"
                value={newInjuryName}
                onChange={(event) => setNewInjuryName(event.target.value)}
              />
              <Input
                type="number"
                min={1}
                max={5}
                value={newInjurySeverity}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  const safeValue = Number.isFinite(next)
                    ? Math.min(5, Math.max(1, next))
                    : 1;
                  setNewInjurySeverity(safeValue);
                }}
              />
              <Button onClick={addInjury}>Add injury</Button>
            </div>
            <p className="text-xs text-slate-400">
              Severity scales 1-5 help the mixer remove or replace slots when above 3.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Fatigue profile
            </p>
            <div className="flex flex-wrap gap-2">
              {fatigueProfiles.map((profile) => (
                <Button
                  key={profile}
                  variant={fatigueProfile === profile ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setFatigueProfile(profile)}
                >
                  {profile.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Equipment available
            </p>
            <div className="flex flex-wrap gap-2">
              {equipmentOptions.map((option) => (
                <Chip
                  key={option}
                  onClick={() => toggleEquipment(option)}
                  className={cn(
                    "cursor-pointer",
                    equipment.includes(option) ? "bg-brand-500/20 text-brand-100" : ""
                  )}
                >
                  {option}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              We filter templates and exercise pools based on what you can access.
            </p>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-200" />
            <p className="text-sm text-slate-200">
              Mix 1+ program templates and weight their influence.
            </p>
          </div>

          <div className="grid gap-3">
            {templateSummaries.map((template) => {
              const selected = selectedPrograms.some(
                (program) => program.template_id === template.id
              );
              const weight =
                selectedPrograms.find((program) => program.template_id === template.id)
                  ?.weight_override ?? 1;
              return (
                <Card
                  key={template.id}
                  className={cn(
                    "space-y-3 border border-slate-800 bg-slate-900/60",
                    selected ? "border-brand-400" : ""
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{template.name}</p>
                      <p className="text-sm text-slate-300">
                        Sessions ~ {template.sessionCount} - Sets ~ {template.estimatedSets}
                      </p>
                      <p className="text-xs text-slate-400">
                        {template.focusHint} {template.methodology ? `- ${template.methodology}` : ""}
                      </p>
                    </div>
                    <Button
                      variant={selected ? "primary" : "outline"}
                      size="sm"
                      onClick={() => toggleProgram(template.id)}
                    >
                      {selected ? "Selected" : "Select"}
                    </Button>
                  </div>
                  {selected && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Weight
                      </label>
                      <Input
                        type="number"
                        min={0.5}
                        max={2}
                        step={0.1}
                        className="w-28"
                        value={weight}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          updateProgramWeight(
                            template.id,
                            Number.isFinite(next) ? next : 1
                          );
                        }}
                      />
                      <p className="text-xs text-slate-400">
                        Heavier weights bias the mixer toward this template.
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
            {!templateSummaries.length && (
              <p className="text-sm text-slate-300">
                No program templates found. Seed the database to continue.
              </p>
            )}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-amber-300" />
            <p className="text-sm text-slate-200">Choose training days and session caps.</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Days per week
            </p>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 5].map((value) => (
                <Button
                  key={value}
                  variant={daysPerWeek === value ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setDaysPerWeek(value)}
                >
                  {value} days
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Max session minutes
            </p>
            <Input
              type="number"
              min={30}
              max={150}
              value={maxSessionMinutes}
              onChange={(event) => {
                const next = Number(event.target.value);
                const clamped = Number.isFinite(next)
                  ? Math.min(180, Math.max(30, next))
                  : 60;
                setMaxSessionMinutes(clamped);
              }}
              className="w-32"
            />
            <p className="text-xs text-slate-400">Default is 60 minutes.</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Preferred training days (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((day) => (
                <Chip
                  key={day}
                  onClick={() => togglePreferredDay(day)}
                  className={cn(
                    "cursor-pointer",
                    preferredDays.includes(day) ? "bg-brand-500/20 text-brand-100" : ""
                  )}
                >
                  {day}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Leave blank to let the mixer auto-assign training days.
            </p>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-brand-200" />
              <p className="text-sm text-slate-200">
                Preview load, then generate and commit sessions.
              </p>
            </div>
            {(isPreviewing || isGenerating) && <Loader2 className="animate-spin text-white" />}
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => void runPreview()}
              disabled={isPreviewing || isGenerating}
            >
              Preview mix
            </Button>
            <Button
              className="flex-1"
              onClick={() => void runGenerate()}
              disabled={isGenerating || !selectionValid}
            >
              Generate & commit
            </Button>
          </div>
          {!selectionValid && (
            <p className="text-xs text-amber-300">
              Select at least one program template before generating.
            </p>
          )}

          {hasExistingProgram && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>Existing program detected.</span>
                </div>
                <Button
                  size="sm"
                  variant={confirmOverwrite ? "primary" : "outline"}
                  onClick={() => setConfirmOverwrite((prev) => !prev)}
                >
                  {confirmOverwrite ? "Will overwrite" : "Require overwrite"}
                </Button>
              </div>
              <p className="text-xs text-amber-200">
                Confirm overwrite to replace your current active program snapshot.
              </p>
            </div>
          )}

          {preview && (
            <div className="grid gap-3 rounded-xl bg-slate-900/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Preview</p>
                <Chip>{preview.seed}</Chip>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm text-slate-200">
                {preview.weeklySets.map((group) => (
                  <div
                    key={group.muscleGroup}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-center"
                  >
                    <p className="text-xs uppercase text-slate-400">{group.muscleGroup}</p>
                    <p className="text-lg font-semibold text-white">{group.sets} sets</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-slate-950/60 p-3 text-sm text-slate-200">
                Recovery load:{" "}
                <span className="font-semibold text-white">{preview.recoveryLoad}</span>
              </div>
              {preview.warnings.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                  {preview.warnings.map((warning) => (
                    <div key={warning.message} className="flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>{warning.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {plannedSchedule && plannedSchedule.length > 0 && (
            <div className="space-y-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-2 text-sm text-emerald-100">
                <CheckCircle size={16} />
                <span>Planned sessions created</span>
              </div>
              <div className="grid gap-2 text-sm text-slate-200">
                {plannedSchedule.map((session) => (
                  <div
                    key={session.program_session_key}
                    className="rounded-lg bg-slate-950/60 p-2"
                  >
                    <p className="font-semibold text-white">
                      {session.label} - {session.date}
                    </p>
                    <p className="text-xs text-slate-400">{session.focus}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goBack} disabled={step === 0}>
          Back
        </Button>
        {step < steps.length - 1 && (
          <Button onClick={goNext} disabled={step === steps.length - 1}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

export default WizardClient;

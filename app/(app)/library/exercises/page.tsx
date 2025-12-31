import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { LibraryBig, Search, Shuffle } from "lucide-react";

const exercises = [
  { name: "Single-leg box squat", muscle: "Quads", equipment: "Box" },
  { name: "Banded RDL", muscle: "Posterior chain", equipment: "Band" },
  { name: "Landmine press", muscle: "Shoulders", equipment: "Barbell" },
  { name: "Copenhagen plank", muscle: "Adductors", equipment: "Bodyweight" }
];

export default function ExercisesPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <LibraryBig size={18} className="text-brand-200" />
          <h2 className="text-lg font-semibold text-white">Exercise library</h2>
        </div>
        <Button size="sm" variant="ghost" className="text-sm text-slate-300">
          Add
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full">
          <Input placeholder="Search movements" className="pl-10" />
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
        </div>
        <Button variant="outline" size="sm" className="whitespace-nowrap">
          <Shuffle size={16} className="mr-2" />
          Shuffle
        </Button>
      </div>

      <div className="grid gap-3">
        {exercises.map((exercise) => (
          <Card key={exercise.name} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">{exercise.name}</p>
              <p className="text-sm text-slate-400">
                {exercise.muscle} · {exercise.equipment}
              </p>
            </div>
            <Chip>Ready</Chip>
          </Card>
        ))}
      </div>
    </div>
  );
}

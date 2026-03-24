export interface Meal {
  id: string;
  description: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: number;
}

export interface ExerciseSet {
  id: string;
  weight: number;
  reps: number | 'Failure';
}

export interface Exercise {
  id: string;
  name: string;
  sets: ExerciseSet[];
}

export interface Workout {
  id: string;
  name: string;
  duration: number;
  intensity: 'Low' | 'Medium' | 'High';
  timestamp: number;
  exercises: Exercise[];
}

export interface DailyActivity {
  id: string;
  name: string;
  duration: number;
  timestamp: number;
}

export interface StudySession {
  id: string;
  topic: string;
  duration: number;
}

export interface Supplements {
  fishOil: boolean;
  zma: boolean;
  creatine: boolean;
  protein: number;
}

export interface DailyData {
  date: string;
  meals: Meal[];
  workouts: Workout[];
  activities: DailyActivity[];
  runDistance: number;
  runDuration: number;
  steps: number;
  waterIntake: number;
  studySessions: StudySession[];
  supplements: Supplements;
}

export interface ExercisePR {
  currentPR: number;
  targetPR: number;
  prAction: 'Increase' | 'Maintain';
}

export type PRTracker = Record<string, ExercisePR>;

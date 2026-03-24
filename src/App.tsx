import React, { useState, useEffect } from 'react';
import { Activity, Dumbbell, Utensils, Clock, Plus, Trash2, Loader2, Calendar, LayoutDashboard, Droplets, BookOpen, Footprints, Pill, LogOut, LineChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { calculateMacros } from './services/gemini';
import { Meal, Workout, DailyActivity, DailyData, PRTracker, Exercise, ExerciseSet, StudySession } from './types';
import Login from './Login';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, getDocs } from 'firebase/firestore';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays, addDays, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const getLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'meals' | 'workouts' | 'activities' | 'progress'>('dashboard');
  
  const [dailyData, setDailyData] = useState<Record<string, DailyData>>({});
  const [prData, setPrData] = useState<PRTracker>({});
  const [historicalData, setHistoricalData] = useState<DailyData[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState(getTodayString());
  
  const selectedData: DailyData = dailyData[selectedDateStr] || { 
    date: selectedDateStr, 
    meals: [], 
    workouts: [], 
    activities: [],
    runDistance: 0,
    runDuration: 0,
    steps: 0,
    waterIntake: 0,
    studySessions: [],
    supplements: { fishOil: false, zma: false, creatine: false, protein: 0 }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const dailyDataRef = collection(db, `users/${user.uid}/dailyData`);
    const unsubscribeDaily = onSnapshot(dailyDataRef, (snapshot) => {
      const data: Record<string, DailyData> = {};
      const history: DailyData[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data() as DailyData;
        data[doc.id] = docData;
        history.push(docData);
      });
      setDailyData(data);
      setHistoricalData(history.sort((a, b) => a.date.localeCompare(b.date)));
    }, (error) => {
      console.error("Error fetching daily data:", error);
    });

    const prDataRef = collection(db, `users/${user.uid}/prData`);
    const unsubscribePR = onSnapshot(prDataRef, (snapshot) => {
      const data: PRTracker = {};
      snapshot.forEach((doc) => {
        data[doc.id] = doc.data() as any;
      });
      setPrData(data);
    }, (error) => {
      console.error("Error fetching PR data:", error);
    });

    return () => {
      unsubscribeDaily();
      unsubscribePR();
    };
  }, [user, isAuthReady]);

  const updateSelectedData = async (newData: Partial<DailyData>) => {
    if (!user) return;
    const updatedData = {
      ...selectedData,
      ...newData
    };
    
    // Optimistic update
    setDailyData(prev => ({
      ...prev,
      [selectedDateStr]: updatedData
    }));

    try {
      await setDoc(doc(db, `users/${user.uid}/dailyData/${selectedDateStr}`), updatedData);
    } catch (error) {
      console.error("Error updating daily data:", error);
      // Revert optimistic update on error if needed, or show a toast
    }
  };

  const updatePrData = async (newPrData: PRTracker) => {
    if (!user) return;
    
    // Optimistic update
    setPrData(newPrData);

    try {
      // Update each PR individually in Firestore
      for (const [exerciseName, pr] of Object.entries(newPrData)) {
         await setDoc(doc(db, `users/${user.uid}/prData/${exerciseName}`), pr);
      }
    } catch (error) {
      console.error("Error updating PR data:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Activity size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 hidden sm:block">LifeTracker AI</h1>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-neutral-100 rounded-lg p-1">
            <button 
              onClick={() => setSelectedDateStr(format(subDays(getLocalDate(selectedDateStr), 1), 'yyyy-MM-dd'))}
              className="p-1.5 hover:bg-white rounded-md transition-colors text-neutral-600"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5 px-2 font-medium text-sm min-w-[110px] justify-center text-neutral-800">
              <Calendar size={14} className="text-neutral-500" />
              <span>{selectedDateStr === getTodayString() ? 'Today' : format(getLocalDate(selectedDateStr), 'MMM d, yyyy')}</span>
            </div>
            <button 
              onClick={() => setSelectedDateStr(format(addDays(getLocalDate(selectedDateStr), 1), 'yyyy-MM-dd'))}
              disabled={selectedDateStr === getTodayString()}
              className="p-1.5 hover:bg-white rounded-md transition-colors text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium text-neutral-500">
            <div className="flex items-center gap-1.5 bg-neutral-100 px-3 py-1.5 rounded-full text-neutral-700 hidden md:flex">
              <Clock size={16} />
              <span className="font-mono">{currentTime.toLocaleTimeString()}</span>
            </div>
            <button onClick={handleLogout} className="text-neutral-500 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Navigation */}
        <nav className="flex space-x-1 bg-neutral-200/50 p-1 rounded-xl mb-8 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'meals', label: 'Meals & Macros', icon: Utensils },
            { id: 'workouts', label: 'Workouts', icon: Dumbbell },
            { id: 'activities', label: 'Daily Activity', icon: Activity },
            { id: 'progress', label: 'Progress', icon: LineChart },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="animate-in fade-in duration-300">
          {activeTab === 'dashboard' && <Dashboard data={selectedData} historicalData={historicalData} selectedDateStr={selectedDateStr} />}
          {activeTab === 'meals' && (
            <MealTracker 
              meals={selectedData.meals} 
              onAdd={(m) => updateSelectedData({ meals: [...selectedData.meals, m] })}
              onDelete={(id) => updateSelectedData({ meals: selectedData.meals.filter(m => m.id !== id) })}
              onUpdate={(id, updatedMeal) => updateSelectedData({ meals: selectedData.meals.map(m => m.id === id ? updatedMeal : m) })}
            />
          )}
          {activeTab === 'workouts' && (
            <WorkoutTracker 
              data={selectedData}
              historicalData={historicalData}
              onUpdateData={updateSelectedData}
              prData={prData}
              setPrData={updatePrData}
            />
          )}
          {activeTab === 'activities' && (
            <ActivityTracker 
              data={selectedData}
              onUpdateData={updateSelectedData}
            />
          )}
          {activeTab === 'progress' && (
            <ProgressCharts historicalData={historicalData} />
          )}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ data, historicalData, selectedDateStr }: { data: DailyData, historicalData: DailyData[], selectedDateStr: string }) {
  const totalCalories = data.meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = data.meals.reduce((sum, m) => sum + m.protein, 0);
  const totalCarbs = data.meals.reduce((sum, m) => sum + m.carbs, 0);
  const totalFat = data.meals.reduce((sum, m) => sum + m.fat, 0);
  const totalWorkoutMins = data.workouts.reduce((sum, w) => sum + w.duration, 0);
  const totalStudyMins = data.studySessions.reduce((sum, s) => sum + s.duration, 0);

  // Calculate past 3 days
  const past3Days = Array.from({ length: 3 }).map((_, i) => {
    const date = subDays(getLocalDate(selectedDateStr), i + 1);
    const dateStr = format(date, 'yyyy-MM-dd');
    const pastData = historicalData.find(d => d.date === dateStr) || {
      date: dateStr,
      meals: [],
      workouts: [],
      studySessions: [],
      steps: 0,
      runDistance: 0,
      runDuration: 0
    } as DailyData;
    return pastData;
  });

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Daily Summary</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
            <div className="flex items-center gap-3 mb-4 text-orange-500">
              <Utensils size={24} />
              <h3 className="font-semibold text-neutral-700">Nutrition</h3>
            </div>
            <div className="text-3xl font-bold mb-1">{totalCalories} <span className="text-lg font-normal text-neutral-500">kcal</span></div>
            <div className="flex gap-4 text-sm mt-4">
              <div><span className="font-medium text-neutral-900">{totalProtein}g</span> <span className="text-neutral-500">Pro</span></div>
              <div><span className="font-medium text-neutral-900">{totalCarbs}g</span> <span className="text-neutral-500">Carb</span></div>
              <div><span className="font-medium text-neutral-900">{totalFat}g</span> <span className="text-neutral-500">Fat</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
            <div className="flex items-center gap-3 mb-4 text-indigo-500">
              <Dumbbell size={24} />
              <h3 className="font-semibold text-neutral-700">Workouts</h3>
            </div>
            <div className="text-3xl font-bold mb-1">{totalWorkoutMins} <span className="text-lg font-normal text-neutral-500">mins</span></div>
            <div className="text-sm text-neutral-500 mt-4">{data.workouts.length} session(s)</div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
            <div className="flex items-center gap-3 mb-4 text-blue-500">
              <BookOpen size={24} />
              <h3 className="font-semibold text-neutral-700">Study</h3>
            </div>
            <div className="text-3xl font-bold mb-1">{totalStudyMins} <span className="text-lg font-normal text-neutral-500">mins</span></div>
            <div className="text-sm text-neutral-500 mt-4">{data.studySessions.length} session(s)</div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
            <div className="flex items-center gap-3 mb-4 text-emerald-500">
              <Footprints size={24} />
              <h3 className="font-semibold text-neutral-700">Movement</h3>
            </div>
            <div className="text-3xl font-bold mb-1">{data.steps} <span className="text-lg font-normal text-neutral-500">steps</span></div>
            <div className="text-sm text-neutral-500 mt-4">{data.runDistance} km run</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-neutral-800">Past 3 Days</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {past3Days.map((pastData) => {
            const pCals = pastData.meals.reduce((sum, m) => sum + m.calories, 0);
            const pPro = pastData.meals.reduce((sum, m) => sum + m.protein, 0);
            const pWork = pastData.workouts.reduce((sum, w) => sum + w.duration, 0);
            const pStudy = pastData.studySessions.reduce((sum, s) => sum + s.duration, 0);
            
            return (
              <div key={pastData.date} className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-neutral-900">{format(getLocalDate(pastData.date), 'EEE, MMM d')}</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 flex items-center gap-1.5"><Utensils size={14} /> Nutrition</span>
                    <span className="font-medium">{pCals} kcal <span className="text-neutral-400 text-xs">({pPro}g pro)</span></span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 flex items-center gap-1.5"><Dumbbell size={14} /> Workout</span>
                    <span className="font-medium">{pWork} mins</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 flex items-center gap-1.5"><BookOpen size={14} /> Study</span>
                    <span className="font-medium">{pStudy} mins</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 flex items-center gap-1.5"><Footprints size={14} /> Steps</span>
                    <span className="font-medium">{pastData.steps || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MealTracker({ meals, onAdd, onDelete, onUpdate }: { meals: Meal[], onAdd: (m: Meal) => void, onDelete: (id: string) => void, onUpdate: (id: string, m: Meal) => void }) {
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState<number | ''>('');
  const [protein, setProtein] = useState<number | ''>('');
  const [carbs, setCarbs] = useState<number | ''>('');
  const [fat, setFat] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [editingMeal, setEditingMeal] = useState<string | null>(null);

  const handleAIAnalyze = async () => {
    if (!description.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const macros = await calculateMacros(description);
      setName(macros.name || description);
      setCalories(macros.calories || 0);
      setProtein(macros.protein || 0);
      setCarbs(macros.carbs || 0);
      setFat(macros.fat || 0);
    } catch (err) {
      setError('Failed to calculate macros. You can enter them manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    if (!name.trim() || calories === '') return;
    const newMeal: Meal = {
      id: Date.now().toString(),
      description,
      name,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      timestamp: Date.now()
    };
    onAdd(newMeal);
    resetForm();
  };

  const resetForm = () => {
    setDescription('');
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setEditingMeal(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <h2 className="text-xl font-bold mb-4">Log a Meal</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">What did you eat? (For AI Analysis)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., 2 scrambled eggs and toast"
                className="flex-1 p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <button
                onClick={handleAIAnalyze}
                disabled={isLoading || !description.trim()}
                className="px-4 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'AI Auto-Fill'}
              </button>
            </div>
            {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Meal Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Calories</label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value ? Number(e.target.value) : '')}
                placeholder="kcal"
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Protein (g)</label>
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value ? Number(e.target.value) : '')}
                placeholder="g"
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Carbs (g)</label>
              <input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value ? Number(e.target.value) : '')}
                placeholder="g"
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Fat (g)</label>
              <input
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value ? Number(e.target.value) : '')}
                placeholder="g"
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!name.trim() || calories === ''}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={18} />
            Save Meal
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-neutral-900">Meals</h3>
        {meals.length === 0 ? (
          <div className="text-neutral-500 text-sm italic">No meals logged yet.</div>
        ) : (
          <div className="grid gap-4">
            {meals.map(meal => (
              <div key={meal.id} className="bg-white p-5 rounded-xl shadow-sm border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {editingMeal === meal.id ? (
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <input type="text" value={meal.name} onChange={(e) => onUpdate(meal.id, {...meal, name: e.target.value})} className="col-span-2 sm:col-span-1 p-2 border rounded" />
                    <input type="number" value={meal.calories} onChange={(e) => onUpdate(meal.id, {...meal, calories: Number(e.target.value)})} className="p-2 border rounded" placeholder="kcal" />
                    <input type="number" value={meal.protein} onChange={(e) => onUpdate(meal.id, {...meal, protein: Number(e.target.value)})} className="p-2 border rounded" placeholder="Pro" />
                    <input type="number" value={meal.carbs} onChange={(e) => onUpdate(meal.id, {...meal, carbs: Number(e.target.value)})} className="p-2 border rounded" placeholder="Carb" />
                    <input type="number" value={meal.fat} onChange={(e) => onUpdate(meal.id, {...meal, fat: Number(e.target.value)})} className="p-2 border rounded" placeholder="Fat" />
                  </div>
                ) : (
                  <div>
                    <h4 className="font-semibold text-neutral-900">{meal.name}</h4>
                    {meal.description && <p className="text-sm text-neutral-500 mt-1">{meal.description}</p>}
                    <div className="flex gap-3 text-sm mt-3 font-mono bg-neutral-50 p-2 rounded-lg inline-flex">
                      <span className="text-orange-600">{meal.calories} kcal</span>
                      <span className="text-neutral-300">|</span>
                      <span className="text-blue-600">{meal.protein}g P</span>
                      <span className="text-neutral-300">|</span>
                      <span className="text-green-600">{meal.carbs}g C</span>
                      <span className="text-neutral-300">|</span>
                      <span className="text-red-600">{meal.fat}g F</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 self-start sm:self-center">
                  <button 
                    onClick={() => setEditingMeal(editingMeal === meal.id ? null : meal.id)}
                    className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    {editingMeal === meal.id ? 'Done' : 'Edit'}
                  </button>
                  <button 
                    onClick={() => onDelete(meal.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkoutTracker({ 
  data, 
  historicalData,
  onUpdateData,
  prData,
  setPrData
}: { 
  data: DailyData,
  historicalData: DailyData[],
  onUpdateData: (newData: Partial<DailyData>) => void,
  prData: PRTracker,
  setPrData: (data: PRTracker) => void
}) {
  const [year, month, d] = data.date.split('-');
  const day = new Date(Number(year), Number(month) - 1, Number(d)).getDay();
  const isRestDay = day === 0; // Sunday

  const getSplit = () => {
    if (day === 1 || day === 4) return 'Chest & Triceps';
    if (day === 2 || day === 5) return 'Back & Biceps';
    if (day === 3 || day === 6) return 'Legs, Shoulders & Traps';
    return 'Rest Day';
  };
  const todaySplit = getSplit();

  const previousWorkoutDay = historicalData
    .filter(d => d.date < data.date && d.workouts.length > 0 && d.workouts[0].name === todaySplit)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const previousWorkout = previousWorkoutDay?.workouts[0];

  const workouts = data.workouts;
  const activeWorkout = workouts.length > 0 ? workouts[0] : null;

  // State for adding an exercise
  const [exerciseName, setExerciseName] = useState('');
  const [currentPR, setCurrentPR] = useState<number | ''>('');
  const [targetPR, setTargetPR] = useState<number | ''>('');
  const [prAction, setPrAction] = useState<'Increase' | 'Maintain'>('Increase');
  
  // State for adding sets
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [isFailure, setIsFailure] = useState(false);

  useEffect(() => {
    const pr = prData[exerciseName.trim().toLowerCase()];
    if (pr) {
      setCurrentPR(pr.currentPR);
      setTargetPR(pr.targetPR);
      setPrAction(pr.prAction);
    } else {
      setCurrentPR('');
      setTargetPR('');
      setPrAction('Increase');
    }
  }, [exerciseName, prData]);

  const handleAddSet = () => {
    if (!weight || (!reps && !isFailure)) return;
    setSets([...sets, {
      id: Date.now().toString(),
      weight: parseFloat(weight),
      reps: isFailure ? 'Failure' : parseInt(reps, 10)
    }]);
    setWeight('');
    setReps('');
    setIsFailure(false);
  };

  const handleSaveExercise = () => {
    if (!exerciseName.trim() || sets.length === 0) return;
    
    const normalizedName = exerciseName.trim().toLowerCase();
    
    let maxWeightInSets = 0;
    sets.forEach(s => {
      if (s.weight > maxWeightInSets) maxWeightInSets = s.weight;
    });
    
    const newPR = Math.max(Number(currentPR) || 0, maxWeightInSets);

    setPrData({
      ...prData,
      [normalizedName]: {
        currentPR: newPR,
        targetPR: Number(targetPR) || 0,
        prAction
      }
    });

    const newExercise: Exercise = {
      id: Date.now().toString(),
      name: exerciseName.trim(),
      sets
    };

    if (activeWorkout) {
      const updatedWorkout = {
        ...activeWorkout,
        exercises: [...(activeWorkout.exercises || []), newExercise]
      };
      onUpdateData({
        workouts: workouts.map(w => w.id === activeWorkout.id ? updatedWorkout : w)
      });
    } else {
      onUpdateData({
        workouts: [{
          id: Date.now().toString(),
          name: todaySplit,
          duration: 60, // Default duration
          intensity: 'Medium',
          timestamp: Date.now(),
          exercises: [newExercise]
        }]
      });
    }

    setExerciseName('');
    setSets([]);
    setCurrentPR('');
    setTargetPR('');
    setPrAction('Increase');
  };

  if (isRestDay) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h2 className="text-xl font-bold mb-2">Day's Split: <span className="text-indigo-600">Rest Day</span></h2>
          <p className="text-neutral-500 mb-6">Take it easy! Track your light cardio and steps below.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Steps Walked</label>
              <input
                type="number"
                value={data.steps || ''}
                onChange={(e) => onUpdateData({ steps: Number(e.target.value) })}
                placeholder="e.g., 10000"
                className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Run Distance (km)</label>
              <input
                type="number"
                value={data.runDistance || ''}
                onChange={(e) => onUpdateData({ runDistance: Number(e.target.value) })}
                placeholder="e.g., 5"
                className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Run Duration (mins)</label>
              <input
                type="number"
                value={data.runDuration || ''}
                onChange={(e) => onUpdateData({ runDuration: Number(e.target.value) })}
                placeholder="e.g., 30"
                className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Day's Split: <span className="text-indigo-600">{todaySplit}</span></h2>
          <p className="text-sm mt-1 text-neutral-500">Log your exercises, sets, reps, and track your PRs below.</p>
        </div>
        {activeWorkout && (
          <button 
            onClick={() => onUpdateData({ workouts: [] })}
            className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium"
          >
            Clear Workout
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <h3 className="text-lg font-bold mb-4">Add Exercise</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Exercise Name</label>
            <input
              type="text"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder="e.g., Barbell Bench Press"
              className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            {exerciseName.trim() && previousWorkout && (
              (() => {
                const prevExercise = previousWorkout.exercises.find(e => e.name.toLowerCase() === exerciseName.trim().toLowerCase());
                if (prevExercise && prevExercise.sets.length > 0) {
                  const maxWeight = Math.max(...prevExercise.sets.map(s => s.weight));
                  const totalSets = prevExercise.sets.length;
                  return (
                    <div className="mt-2 text-sm text-indigo-600 bg-indigo-50 p-2 rounded-lg flex items-center gap-2">
                      <Dumbbell size={14} />
                      <span>Last time on {format(getLocalDate(previousWorkoutDay.date), 'MMM d')}: {totalSets} sets, max weight {maxWeight}</span>
                    </div>
                  );
                }
                return null;
              })()
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Current PR (kg/lbs)</label>
              <input
                type="number"
                value={currentPR}
                onChange={(e) => setCurrentPR(e.target.value ? Number(e.target.value) : '')}
                placeholder="100"
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Next PR Target</label>
              <input
                type="number"
                value={targetPR}
                onChange={(e) => setTargetPR(e.target.value ? Number(e.target.value) : '')}
                placeholder="105"
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">PR Goal</label>
              <select
                value={prAction}
                onChange={(e) => setPrAction(e.target.value as any)}
                className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="Increase">Increase PR</option>
                <option value="Maintain">Maintain PR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Sets Performed</label>
            
            {sets.length > 0 && (
              <div className="mb-4 space-y-2">
                {sets.map((set, idx) => (
                  <div key={set.id} className="flex items-center justify-between bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                    <span className="font-medium text-neutral-700">Set {idx + 1}: {set.weight} kg/lbs × {set.reps}</span>
                    <button 
                      onClick={() => setSets(sets.filter(s => s.id !== set.id))}
                      className="text-neutral-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[120px]">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Weight"
                  className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  disabled={isFailure}
                  placeholder="Reps"
                  className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                />
              </div>
              <div className="flex items-center gap-2 pb-3 px-2">
                <input 
                  type="checkbox" 
                  id="failure" 
                  checked={isFailure}
                  onChange={(e) => setIsFailure(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="failure" className="text-sm font-medium text-neutral-700">Till Failure</label>
              </div>
              <button
                onClick={handleAddSet}
                disabled={!weight || (!reps && !isFailure)}
                className="px-4 py-2.5 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                Add Set
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100">
            <button
              onClick={handleSaveExercise}
              disabled={!exerciseName.trim() || sets.length === 0}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Save Exercise
            </button>
          </div>
        </div>
      </div>

      {activeWorkout?.exercises && activeWorkout.exercises.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-neutral-900">Completed Exercises</h3>
          <div className="grid gap-4">
            {activeWorkout.exercises.map(exercise => (
              <div key={exercise.id} className="bg-white p-5 rounded-xl shadow-sm border border-neutral-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-neutral-900">{exercise.name}</h4>
                  <button 
                    onClick={() => {
                      const updatedWorkout = {
                        ...activeWorkout,
                        exercises: activeWorkout.exercises.filter(e => e.id !== exercise.id)
                      };
                      onUpdateData({
                        workouts: workouts.map(w => w.id === activeWorkout.id ? updatedWorkout : w)
                      });
                    }}
                    className="text-neutral-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {exercise.sets.map((set, idx) => (
                    <div key={set.id} className="flex items-center justify-between text-sm bg-neutral-50 px-3 py-2 rounded-lg">
                      <span className="text-neutral-600 font-medium">Set {idx + 1}</span>
                      <span className="text-neutral-900 font-mono">{set.weight} kg/lbs × {set.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeWorkout?.exercises && activeWorkout.exercises.length > 0 && previousWorkout && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 mt-6">
          <h3 className="text-lg font-bold mb-4">Progress vs Previous Session</h3>
          <p className="text-sm text-neutral-500 mb-6">Comparing your max weight for each exercise against your last {todaySplit} session on {format(getLocalDate(previousWorkoutDay.date), 'MMM d')}.</p>
          
          {(() => {
            const chartData = activeWorkout.exercises.map(ex => {
              const currentMax = Math.max(...ex.sets.map(s => s.weight));
              let previousMax = 0;
              const prevEx = previousWorkout.exercises.find(e => e.name.toLowerCase() === ex.name.toLowerCase());
              if (prevEx && prevEx.sets.length > 0) {
                previousMax = Math.max(...prevEx.sets.map(s => s.weight));
              }
              return {
                name: ex.name.length > 15 ? ex.name.substring(0, 15) + '...' : ex.name,
                Current: currentMax,
                Previous: previousMax,
              };
            }).filter(d => d.Previous > 0);

            if (chartData.length === 0) {
              return <div className="text-sm text-neutral-500 italic py-8 text-center bg-neutral-50 rounded-xl">No matching exercises from the previous session to compare.</div>;
            }

            return (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f5f5f5', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f5f5f5' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="Previous" fill="#9ca3af" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Current" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function ActivityTracker({ data, onUpdateData }: { data: DailyData, onUpdateData: (newData: Partial<DailyData>) => void }) {
  const [studyTopic, setStudyTopic] = useState('');
  const [studyDuration, setStudyDuration] = useState('');

  const handleAddStudy = () => {
    if (!studyTopic.trim() || !studyDuration) return;
    onUpdateData({
      studySessions: [...data.studySessions, {
        id: Date.now().toString(),
        topic: studyTopic,
        duration: parseInt(studyDuration, 10)
      }]
    });
    setStudyTopic('');
    setStudyDuration('');
  };

  return (
    <div className="space-y-6">
      {/* Running & Steps */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex items-center gap-2 mb-4 text-emerald-600">
          <Footprints size={20} />
          <h2 className="text-xl font-bold text-neutral-900">Movement & Cardio</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Steps Walked</label>
            <input
              type="number"
              value={data.steps || ''}
              onChange={(e) => onUpdateData({ steps: Number(e.target.value) })}
              placeholder="e.g., 10000"
              className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Run Distance (km)</label>
            <input
              type="number"
              value={data.runDistance || ''}
              onChange={(e) => onUpdateData({ runDistance: Number(e.target.value) })}
              placeholder="e.g., 5"
              className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Run Duration (mins)</label>
            <input
              type="number"
              value={data.runDuration || ''}
              onChange={(e) => onUpdateData({ runDuration: Number(e.target.value) })}
              placeholder="e.g., 30"
              className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Study Tracker */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex items-center gap-2 mb-4 text-blue-600">
          <BookOpen size={20} />
          <h2 className="text-xl font-bold text-neutral-900">Study Tracker</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Topic</label>
            <input
              type="text"
              value={studyTopic}
              onChange={(e) => setStudyTopic(e.target.value)}
              placeholder="e.g., React JS, Mathematics"
              className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Duration (min)</label>
            <input
              type="number"
              value={studyDuration}
              onChange={(e) => setStudyDuration(e.target.value)}
              placeholder="60"
              className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button
            onClick={handleAddStudy}
            disabled={!studyTopic.trim() || !studyDuration}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>

        {data.studySessions.length > 0 && (
          <div className="space-y-2">
            {data.studySessions.map(session => (
              <div key={session.id} className="flex items-center justify-between bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                <div>
                  <span className="font-medium text-neutral-900">{session.topic}</span>
                  <span className="text-neutral-500 text-sm ml-2">({session.duration} mins)</span>
                </div>
                <button 
                  onClick={() => onUpdateData({ studySessions: data.studySessions.filter(s => s.id !== session.id) })}
                  className="text-neutral-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div className="pt-2 text-sm font-medium text-neutral-700">
              Total Study Time: {data.studySessions.reduce((sum, s) => sum + s.duration, 0)} mins
            </div>
          </div>
        )}
      </div>

      {/* Hydration & Supplements */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex items-center gap-2 mb-4 text-cyan-600">
          <Pill size={20} />
          <h2 className="text-xl font-bold text-neutral-900">Hydration & Supplements</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
              <Droplets size={16} className="text-cyan-500" />
              Water Intake (Liters)
            </label>
            <input
              type="number"
              step="0.1"
              value={data.waterIntake || ''}
              onChange={(e) => onUpdateData({ waterIntake: Number(e.target.value) })}
              placeholder="e.g., 3.5"
              className="w-full p-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Supplements</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={data.supplements.fishOil}
                  onChange={(e) => onUpdateData({ supplements: { ...data.supplements, fishOil: e.target.checked } })}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-700">Fish Oil</span>
              </label>
              <label className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={data.supplements.zma}
                  onChange={(e) => onUpdateData({ supplements: { ...data.supplements, zma: e.target.checked } })}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-700">ZMA</span>
              </label>
              <label className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={data.supplements.creatine}
                  onChange={(e) => onUpdateData({ supplements: { ...data.supplements, creatine: e.target.checked } })}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-700">Creatine</span>
              </label>
              <div className="pt-2">
                <label className="block text-sm text-neutral-600 mb-1">Whey Protein Intake (scoops/grams)</label>
                <input
                  type="number"
                  value={data.supplements.protein || ''}
                  onChange={(e) => onUpdateData({ supplements: { ...data.supplements, protein: Number(e.target.value) } })}
                  placeholder="e.g., 1 scoop"
                  className="w-full p-2.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressCharts({ historicalData }: { historicalData: DailyData[] }) {
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  const getChartData = () => {
    const today = new Date();
    const days = timeRange === 'week' ? 7 : 30;
    const startDate = subDays(today, days - 1);
    
    const dateRange = eachDayOfInterval({ start: startDate, end: today });
    
    return dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = historicalData.find(d => d.date === dateStr);
      
      const totalCalories = dayData?.meals.reduce((sum, m) => sum + m.calories, 0) || 0;
      const totalProtein = dayData?.meals.reduce((sum, m) => sum + m.protein, 0) || 0;
      const totalWorkoutMins = dayData?.workouts.reduce((sum, w) => sum + w.duration, 0) || 0;
      const totalStudyMins = dayData?.studySessions.reduce((sum, s) => sum + s.duration, 0) || 0;

      return {
        date: format(date, 'MMM dd'),
        calories: totalCalories,
        protein: totalProtein,
        workoutMins: totalWorkoutMins,
        studyMins: totalStudyMins,
        steps: dayData?.steps || 0,
        water: dayData?.waterIntake || 0,
      };
    });
  };

  const chartData = getChartData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-neutral-100">
        <h2 className="text-xl font-bold text-neutral-900">Your Progress</h2>
        <div className="flex bg-neutral-100 p-1 rounded-lg">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${timeRange === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${timeRange === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}
          >
            30 Days
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calories Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="font-semibold text-neutral-700 mb-6 flex items-center gap-2">
            <Utensils size={18} className="text-orange-500" />
            Calories Consumed
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#e5e5e5', strokeWidth: 2 }}
                />
                <Line type="monotone" dataKey="calories" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Protein Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="font-semibold text-neutral-700 mb-6 flex items-center gap-2">
            <Utensils size={18} className="text-blue-500" />
            Protein Intake (g)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f5f5f5' }}
                />
                <Bar dataKey="protein" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workout Duration Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="font-semibold text-neutral-700 mb-6 flex items-center gap-2">
            <Dumbbell size={18} className="text-indigo-500" />
            Workout Duration (mins)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f5f5f5' }}
                />
                <Bar dataKey="workoutMins" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Steps Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h3 className="font-semibold text-neutral-700 mb-6 flex items-center gap-2">
            <Footprints size={18} className="text-emerald-500" />
            Daily Steps
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#e5e5e5', strokeWidth: 2 }}
                />
                <Line type="monotone" dataKey="steps" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}


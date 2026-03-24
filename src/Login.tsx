import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';
import { Activity } from 'lucide-react';

export default function Login() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100 max-w-md w-full text-center">
        <div className="bg-indigo-600 p-3 rounded-xl text-white inline-flex mb-6">
          <Activity size={32} />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Welcome to LifeTracker AI</h1>
        <p className="text-neutral-500 mb-8">Log in to track your meals, workouts, and daily progress securely.</p>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-neutral-200 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

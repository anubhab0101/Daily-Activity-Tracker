import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { Activity, Mail, Lock } from 'lucide-react';

export default function Login() {
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setErrorMsg('');
    setIsLoading(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google Login failed:', error);
      setErrorMsg(error.message || 'Failed to log in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    
    setErrorMsg('');
    setIsLoading(true);
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error('Email Auth failed:', error);
      // Make error messages more user-friendly
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Please log in.');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setErrorMsg('Invalid email or password.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else {
        setErrorMsg(error.message || 'Authentication failed. Please try again.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100 max-w-md w-full text-center">
        <div className="bg-indigo-600 p-3 rounded-xl text-white inline-flex mb-6">
          <Activity size={32} />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Welcome to ApexFit AI</h1>
        <p className="text-neutral-500 mb-8">Log in to track your meals, workouts, and daily progress securely.</p>
        
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-70"
          >
            {isLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px bg-neutral-200 flex-1"></div>
          <span className="text-sm text-neutral-400 font-medium">OR</span>
          <div className="h-px bg-neutral-200 flex-1"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          type="button"
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-neutral-200 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-70 mb-6"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <p className="text-sm text-neutral-600">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
            }}
            className="text-indigo-600 font-medium hover:underline focus:outline-none"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}

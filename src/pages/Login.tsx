import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi } from '../services/auth';
import type { AuthUser } from '../services/auth';

const inputClass =
  'w-full input !w-auto.5 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function Login({ onSignedIn, setupCredentials = false }: { onSignedIn: (user: AuthUser) => void; setupCredentials?: boolean }) {
  const [step, setStep] = useState<'credentials' | 'otp-details' | 'otp-code' | 'set-credentials'>(setupCredentials ? 'set-credentials' : 'credentials');
  const [passwordMode, setPasswordMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function submitCredentials(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (passwordMode === 'register' && password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }
      const { user } = passwordMode === 'register'
        ? await authApi.register(username, password)
        : await authApi.login(username, password);
      onSignedIn(user);
    });
  }

  function sendCode(e: FormEvent) {
    e.preventDefault();
    if (name.trim().split(/\s+/).length < 2) {
      setError('Please enter your full name (first and last name).');
      return;
    }
    void run(async () => {
      await authApi.requestOtp(name, email);
      setStep('otp-code');
    });
  }

  function verify(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const { user } = await authApi.verifyOtp(email.trim().toLowerCase(), code.trim());
      if (!user.username) {
        setStep('set-credentials');
      } else {
        onSignedIn(user);
      }
    });
  }

  function saveCredentials(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      const { user } = await authApi.setCredentials(username, password);
      onSignedIn(user);
    });
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-navy-900 text-white p-12">
        <p className="page-title">SplitSync</p>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Share costs.<br />Keep friendships.</h2>
          <p className="mt-4 text-slate-300 max-w-sm">
            Track shared expenses with friends, flatmates and travel groups, and settle up with the fewest payments.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-200">
            {['Split equally, by exact amount, percentage or shares', 'Monthly recap and spending charts', 'Shareable reports and in-app notifications'].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-400">Sign in with a unique username and password.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <p className="md:hidden text-2xl font-bold text-brand-700 mb-6">SplitSync</p>

          {step === 'credentials' ? (
            <form onSubmit={submitCredentials} className="space-y-4">
              <div>
                <h1 className="page-title">{passwordMode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {passwordMode === 'register' ? 'Choose a unique username and password.' : 'Enter your username and password to continue.'}
                </p>
              </div>
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
                <input id="username" autoComplete="username" minLength={3} maxLength={32} required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
                <input id="password" type="password" autoComplete={passwordMode === 'register' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
              </div>
              {passwordMode === 'register' && (
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">Confirm password</label>
                  <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
                </div>
              )}
              {error && <p className="text-sm text-owe">{error}</p>}
              <button disabled={busy} className="btn-primary w-full !py-2.5">
                {busy ? 'Please wait…' : passwordMode === 'register' ? 'Create account' : 'Sign in'}
              </button>
              <div className="flex justify-between text-sm text-slate-500">
                <button type="button" onClick={() => { setPasswordMode(passwordMode === 'login' ? 'register' : 'login'); setError(''); }} className="text-brand-700">
                  {passwordMode === 'login' ? 'Create an account' : 'Already have an account? Sign in'}
                </button>
                <button type="button" onClick={() => { setStep('otp-details'); setError(''); }} className="text-brand-700">
                  Existing account?
                </button>
              </div>
              {passwordMode === 'register' && <p className="text-xs text-slate-500">Choose a password you can remember. Password reset by email is not enabled.</p>}
            </form>
          ) : step === 'otp-details' ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <h1 className="page-title">Existing account</h1>
                <p className="text-slate-500 text-sm mt-1">Use your email code to access an older account.</p>
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">Full name</label>
                <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">Email address</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              {error && <p className="text-sm text-owe">{error}</p>}
              <button disabled={busy} className="btn-primary w-full !py-2.5">
                {busy ? 'Sending code…' : 'Send me a code'}
              </button>
              <button type="button" onClick={() => { setStep('credentials'); setError(''); }} className="w-full text-sm text-slate-500">
                Back to username sign-in
              </button>
            </form>
          ) : step === 'otp-code' ? (
            <form onSubmit={verify} className="space-y-4">
              <div>
                <h1 className="page-title">Check your email</h1>
                <p className="text-slate-500 text-sm mt-1">We sent a 6-digit code to {email.trim()}. It expires in 10 minutes.</p>
              </div>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                aria-label="6-digit code"
                className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
              />
              {error && <p className="text-sm text-owe">{error}</p>}
              <button disabled={busy || code.length !== 6} className="btn-primary w-full !py-2.5">
                {busy ? 'Checking…' : 'Verify and continue'}
              </button>
              <button type="button" onClick={() => { setStep('otp-details'); setCode(''); setError(''); }} className="w-full text-sm text-slate-500">
                Use a different email
              </button>
            </form>
          ) : (
            <form onSubmit={saveCredentials} className="space-y-4">
              <div>
                <h1 className="page-title">Set up username sign-in</h1>
                <p className="text-slate-500 text-sm mt-1">Choose a unique username and password for this existing account.</p>
              </div>
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
                <input id="username" autoComplete="username" minLength={3} maxLength={32} required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
                <input id="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">Confirm password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
              </div>
              {error && <p className="text-sm text-owe">{error}</p>}
              <button disabled={busy} className="btn-primary w-full !py-2.5">{busy ? 'Saving…' : 'Save and continue'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useApp } from '@/src/AppContext';
import { Button, Input } from '@/src/components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Lock, User, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';
import { collection, getDocs, setDoc, doc, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Login() {
  const { login, loginWithGoogle, theme, showToast } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDbEmpty, setIsDbEmpty] = useState<boolean | null>(null);
  const [showBootstrap, setShowBootstrap] = useState(false);

  useEffect(() => {
    const checkDb = async () => {
      try {
        const sn = await getDocs(query(collection(db, 'users'), limit(1)));
        setIsDbEmpty(sn.empty);
      } catch (err) {
        console.error('Failed to check users:', err);
        // If we can't check (likely permission denied because rules are active but no user exists)
        // we should still allow bootstrapping
        setIsDbEmpty(true); 
      }
    };
    checkDb();
  }, []);

  const handleBootstrap = async () => {
    setLoading(true);
    try {
      const admin = {
        id: '1',
        name: 'Super Administrator',
        username: 'initial_admin',
        password: 'Password@123',
        role: 'SuperAdmin',
        permissions: ['all']
      };
      await setDoc(doc(db, 'users', '1'), admin);
      showToast('First SuperAdmin account created successfully!', 'success');
      setIsDbEmpty(false);
      setShowBootstrap(false);
      setUsername('initial_admin');
      setPassword('Password@123');
    } catch (err) {
      console.error('Bootstrap failed:', err);
      showToast('Failed to create first admin. Check rules.', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-main)] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border-main)] p-8 md:p-12 rounded-3xl shadow-xl space-y-8"
      >
        <div className="text-center space-y-2 flex flex-col items-center">
          <Logo theme={theme} className="h-16" />
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] font-bold pt-4">
            Secured Asset Access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-tighter font-black text-[var(--color-text-dim)]">Identity</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-[var(--color-text-dim)]" />
              <Input 
                className="pl-10" 
                placeholder="Username" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-tighter font-black text-[var(--color-text-dim)]">Passphrase</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-[var(--color-text-dim)]" />
              <Input 
                type="password" 
                className="pl-10" 
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center">{error}</p>}

          <Button type="submit" className="w-full h-12 bg-accent text-white hover:bg-accent/90" disabled={loading}>
            {loading ? 'Validating...' : 'Authorize Access'}
          </Button>

          <div className="relative flex items-center justify-center my-6">
            <span className="absolute px-3 bg-[var(--color-bg-card)] text-[9px] uppercase tracking-widest text-[var(--color-text-dim)] font-bold">or</span>
            <div className="w-full border-t border-[var(--color-border-main)]"></div>
          </div>

          <Button 
            type="button" 
            variant="outline"
            className="w-full h-12 border-[var(--color-border-main)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-main)] flex items-center justify-center gap-3" 
            onClick={loginWithGoogle}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.31 1.05-3.71 1.05-2.85 0-5.27-1.92-6.13-4.51H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.87 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.69-2.83z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.69 2.83c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335"/>
            </svg>
            <span className="text-[10px] uppercase tracking-widest font-bold">Google Authorization</span>
          </Button>

          {isDbEmpty && !showBootstrap && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3"
            >
              <ShieldAlert className="h-6 w-6 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Database Empty</p>
                <p className="text-[10px] text-[var(--color-text-dim)] leading-relaxed">
                  No active users found. You need to bootstrap the first SuperAdmin account to gain control.
                </p>
              </div>
              <Button 
                onClick={() => setShowBootstrap(true)}
                type="button"
                variant="outline"
                className="w-full h-10 border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-white transition-all text-[10px] uppercase tracking-widest font-bold"
              >
                Launch Bootstrap Wizard
              </Button>
            </motion.div>
          )}

          <AnimatePresence>
            {showBootstrap && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              >
                <div className="w-full max-w-sm bg-[var(--color-bg-card)] border border-amber-500/30 p-8 rounded-3xl shadow-2xl space-y-6">
                  <div className="text-center space-y-2">
                    <div className="h-12 w-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <ShieldAlert className="h-6 w-6 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-text-main)]">Bootstrap SuperAdmin</h3>
                    <p className="text-xs text-[var(--color-text-dim)]">This will generate the root identity for your new CRM instance.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--color-bg-main)] border border-[var(--color-border-main)] space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase font-bold text-[var(--color-text-dim)] tracking-widest">Default Identity</span>
                      <span className="text-xs font-mono text-amber-500 font-bold">initial_admin</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase font-bold text-[var(--color-text-dim)] tracking-widest">Default Secret</span>
                      <span className="text-xs font-mono text-amber-500 font-bold">Password@123</span>
                    </div>
                  </div>

                  <p className="text-[9px] text-center text-[var(--color-text-dim)] italic">
                    Note: You can change these credentials in the Settings panel after logging in.
                  </p>

                  <div className="flex gap-3 pt-2">
                    <Button 
                      className="flex-1 h-11 bg-amber-600 text-white hover:bg-amber-700 font-bold uppercase tracking-widest text-[10px]"
                      onClick={handleBootstrap}
                      disabled={loading}
                    >
                      {loading ? 'Bootstrapping...' : 'Initialize System'}
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-11 px-6 border-[var(--color-border-main)] text-[var(--color-text-dim)] hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-[10px]"
                      onClick={() => setShowBootstrap(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <div className="pt-6 text-center">
          <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-dim)] opacity-50 font-mono">
            Encrypted Connection Established
          </p>
        </div>
      </motion.div>
    </div>
  );
}

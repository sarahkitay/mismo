import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { Login } from '@/pages/Login';
import { SetPassword } from '@/pages/SetPassword';
import { AuthenticatedApp } from '@/AuthenticatedApp';

import './App.css';

function isPasswordSetupLanding(): boolean {
  if (typeof window === 'undefined') return false;
  // Legacy vendor redirect puts tokens in the hash.
  const hash = window.location.hash;
  if (/type=(invite|recovery)/.test(hash)) return true;
  // Branded Mismo links: /auth/confirm?token_hash=…&type=invite|magiclink|recovery
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (tokenHash && type && ['invite', 'recovery', 'magiclink', 'email'].includes(type)) {
    return true;
  }
  return window.location.pathname.replace(/\/$/, '') === '/auth/confirm' && Boolean(tokenHash);
}

const IS_PASSWORD_SETUP_LINK = isPasswordSetupLanding();

function App() {
  const dataStore = useDataStore();
  const [passwordSetupDone, setPasswordSetupDone] = useState(false);

  if (IS_PASSWORD_SETUP_LINK && !passwordSetupDone) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <SetPassword onDone={() => setPasswordSetupDone(true)} />
      </>
    );
  }

  if (!dataStore.session) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <Login dataStore={dataStore} />
      </>
    );
  }

  return <AuthenticatedApp key={dataStore.session.userId} dataStore={dataStore} />;
}

export default App;

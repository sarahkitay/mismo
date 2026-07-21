import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { Login } from '@/pages/Login';
import { SetPassword } from '@/pages/SetPassword';
import { AuthenticatedApp } from '@/AuthenticatedApp';

import './App.css';

// Capture the landing hash once at load; Supabase clears it after parsing.
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';
const IS_PASSWORD_SETUP_LINK = /type=(invite|recovery)/.test(INITIAL_HASH);

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

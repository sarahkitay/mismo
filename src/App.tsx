import { Toaster } from '@/components/ui/sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { Login } from '@/pages/Login';
import { AuthenticatedApp } from '@/AuthenticatedApp';

import './App.css';

function App() {
  const dataStore = useDataStore();

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

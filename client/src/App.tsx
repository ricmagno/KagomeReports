import React from 'react';
import { AuthProvider } from './components/auth/AuthProvider';
import { ToastProvider } from './hooks/ToastContext';
import { Dashboard } from './components/layout/Dashboard';
import './styles/globals.css';

function App() {
  return (
    <div className="App">
      <ToastProvider>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </ToastProvider>
    </div>
  );
}

export default App;

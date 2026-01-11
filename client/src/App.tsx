import React from 'react';
import { AuthProvider } from './components/auth/AuthProvider';
import { Dashboard } from './components/layout/Dashboard';
import './styles/globals.css';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </div>
  );
}

export default App;

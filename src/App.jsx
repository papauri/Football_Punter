import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary title="Live Match Prediction Engine">
      <Dashboard />
    </ErrorBoundary>
  );
}

export default App;

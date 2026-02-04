import FormView from './components/FormView';
import NotFound from './components/NotFound';

function App() {
  // Simple routing based on URL path
  const path = window.location.pathname;
  const formIdMatch = path.match(/^\/form\/([a-f0-9-]+)$/);
  
  if (formIdMatch) {
    return <FormView formId={formIdMatch[1]} />;
  }
  
  if (path === '/') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Form Submission Portal</h1>
          <p className="text-muted-foreground">Please use a valid form link to access forms.</p>
        </div>
      </div>
    );
  }
  
  return <NotFound />;
}

export default App;
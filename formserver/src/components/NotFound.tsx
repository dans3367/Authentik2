import React from 'react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Form Not Found</h2>
        <p className="text-muted-foreground">The form you're looking for doesn't exist or has been deactivated.</p>
      </div>
    </div>
  );
};

export default NotFound;
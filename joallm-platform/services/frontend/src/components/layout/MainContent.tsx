import React from 'react';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-transparent px-3 pb-3 md:px-4 md:pb-4">
      <div className="app-panel min-h-full overflow-x-hidden">
        {children}
      </div>
    </main>
  );
}

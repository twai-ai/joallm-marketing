import React from 'react';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-white">
      <div className="min-h-full">
        {children}
      </div>
    </main>
  );
}
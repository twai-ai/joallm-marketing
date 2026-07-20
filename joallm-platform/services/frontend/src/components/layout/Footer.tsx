import React from 'react';
import { FooterLogo } from '../ui/Logo';

export function Footer() {
  return (
    <footer className="border-t border-red-100 bg-white/90 py-6 px-6 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <FooterLogo />
          <div className="text-sm text-gray-600">
            <p>Connected AI workspace for chat, knowledge, workflows, and governed adoption.</p>
            <p className="text-xs text-gray-500 mt-1">
              © 2026 JoaLLM.AI. All rights reserved.
            </p>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <a href="#" className="hover:text-joa-primary transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-joa-primary transition-colors">
            Terms of Service
          </a>
          <a href="mailto:support@joallm.ai" className="hover:text-joa-primary transition-colors">
            Support
          </a>
          <a href="/docs" className="hover:text-joa-primary transition-colors">
            Documentation
          </a>
        </div>
      </div>
    </footer>
  );
}

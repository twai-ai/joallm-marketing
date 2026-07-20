import React from 'react';
import { FooterLogo } from '../ui/Logo';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-6 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <FooterLogo />
          <div className="text-sm text-gray-600">
            <p>Jack of all Large Language Models</p>
            <p className="text-xs text-gray-500 mt-1">
              © 2024 JoaLLM.AI. All rights reserved.
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
          <a href="#" className="hover:text-joa-primary transition-colors">
            Support
          </a>
          <a href="#" className="hover:text-joa-primary transition-colors">
            Documentation
          </a>
        </div>
      </div>
    </footer>
  );
}


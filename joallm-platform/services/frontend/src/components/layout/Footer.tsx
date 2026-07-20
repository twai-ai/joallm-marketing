import { FooterLogo } from '../ui/Logo';
import { PLATFORM_NAME } from '../../constants/product';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/90 py-6 px-6 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <FooterLogo />
          <div className="text-sm text-slate-600">
            <p>Institutional knowledge, relationship intelligence, and guided AI workspaces.</p>
            <p className="text-xs text-slate-500 mt-1">
              © 2026 {PLATFORM_NAME}. All rights reserved.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm text-slate-600">
          <a href="#" className="hover:text-teal-700 transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-teal-700 transition-colors">
            Terms of Service
          </a>
          <a href="mailto:support@joallm.ai" className="hover:text-teal-700 transition-colors">
            Support
          </a>
          <a href="/docs" className="hover:text-teal-700 transition-colors">
            Documentation
          </a>
        </div>
      </div>
    </footer>
  );
}

import React, { useState, useEffect } from 'react';
import { Logo } from './ui/Logo';

const navLinks = [
  { label: 'Platform', section: 'features' },
  { label: 'Use Cases', section: 'use-cases' },
  { label: 'Demo', section: 'demo' },
  { label: 'Security', section: 'security' },
  { label: 'Pricing', section: 'pricing' },
  { label: 'Technology', section: 'tech' },
];

export const Navigation: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'pt-3'
          : 'pt-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`lp-nav-shell flex items-center justify-between h-16 ${
            isScrolled ? 'lp-nav-shell-scrolled' : ''
          }`}
        >
          {/* Logo — click scrolls to top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="focus:outline-none"
          >
            <Logo size="sm" variant="header" />
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(link => (
              <button
                key={link.section}
                onClick={() => scrollTo(link.section)}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-joa-primary"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => scrollTo('contact')}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-joa-primary"
            >
              Talk to Us
            </button>
            <button
              onClick={() => window.open('https://platform.joallm.ai/', '_blank')}
              className="lp-btn-primary"
              style={{ padding: '8px 20px', fontSize: '14px' }}
            >
              Try Platform →
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-joa-dark transition-colors hover:bg-black/5"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mx-4 mt-3 rounded-3xl bg-white/95 border border-white shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map(link => (
              <button
                key={link.section}
                onClick={() => scrollTo(link.section)}
                className="text-left px-4 py-2.5 rounded-lg text-sm font-medium text-joa-text hover:bg-gray-50 hover:text-joa-primary transition-colors"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => scrollTo('contact')}
              className="text-left px-4 py-2.5 rounded-lg text-sm font-medium text-joa-text hover:bg-gray-50 hover:text-joa-primary transition-colors"
            >
              Talk to Us
            </button>
            <div className="pt-3 mt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  window.open('https://platform.joallm.ai/', '_blank');
                  setIsMobileMenuOpen(false);
                }}
                className="lp-btn-primary w-full justify-center"
                style={{ padding: '10px 20px' }}
              >
                Try Platform →
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

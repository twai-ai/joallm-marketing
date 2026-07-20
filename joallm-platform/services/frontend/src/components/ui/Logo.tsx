import { useMemo, useState } from 'react';
import { PLATFORM_NAME, PLATFORM_SHORT_NAME } from '../../constants/product';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'header' | 'sidebar' | 'footer' | 'standalone';
}

export function Logo({
  size = 'md',
  showText = true,
  className = '',
  variant = 'header',
}: LogoProps) {
  const sizeMap = {
    xs: { width: 'w-4', height: 'h-4', textSize: 'text-xs' },
    sm: { width: 'w-6', height: 'h-6', textSize: 'text-sm' },
    md: { width: 'w-8', height: 'h-8', textSize: 'text-lg' },
    lg: { width: 'w-12', height: 'h-12', textSize: 'text-xl' },
    xl: { width: 'w-16', height: 'h-16', textSize: 'text-2xl' },
  };

  const logoCandidates = useMemo(() => {
    const shared = [
      '/JoaLLM-logo-standard.png',
      '/JoaLLM-logo.png',
      '/JoaLLM-logo-2-logo.png',
      '/JoaLLM-logo-2-logo (1).png',
      '/JoaLLM-logo-2-logo (2).png',
    ];

    if (size === 'lg' || size === 'xl') {
      return ['/JoaLLM-logo-large.png', '/JoaLLM-logo-medium.png', ...shared];
    }

    return ['/JoaLLM-logo-medium.png', '/JoaLLM-logo-large.png', ...shared];
  }, [size]);

  const [logoIndex, setLogoIndex] = useState(0);

  const getTextColors = () => {
    switch (variant) {
      case 'sidebar':
        return {
          primary: 'text-teal-300',
          secondary: 'text-white',
        };
      case 'footer':
        return {
          primary: 'text-teal-700',
          secondary: 'text-slate-600',
        };
      default:
        return {
          primary: 'text-slate-950',
          secondary: 'text-teal-700',
        };
    }
  };

  const { width, height, textSize } = sizeMap[size];
  const logoSrc = logoCandidates[Math.min(logoIndex, logoCandidates.length - 1)];
  const textColors = getTextColors();

  return (
    <div className={`logo-container flex items-center space-x-2.5 ${className}`}>
      <img
        src={logoSrc}
        alt={`${PLATFORM_NAME} logo`}
        className={`${width} ${height} object-contain select-none`}
        draggable={false}
        onError={() => {
          setLogoIndex((current) =>
            current < logoCandidates.length - 1 ? current + 1 : current,
          );
        }}
      />
      {showText && (
        <h1 className={`${textSize} font-bold tracking-tight select-none`}>
          <span className={textColors.primary}>{PLATFORM_SHORT_NAME}</span>
          <span className={`${textColors.secondary} ${size === 'xs' ? 'text-xs' : 'text-sm'} font-semibold`}>
            {' '}
            Marketing
          </span>
        </h1>
      )}
    </div>
  );
}

export function HeaderLogo() {
  return <Logo size="md" variant="header" />;
}

export function SidebarLogo() {
  return <Logo size="sm" variant="sidebar" />;
}

export function FooterLogo() {
  return <Logo size="sm" variant="footer" />;
}

export function StandaloneLogo() {
  return <Logo size="lg" variant="standalone" />;
}

export function CompactLogo() {
  return <Logo size="xs" showText={false} />;
}


import React from 'react';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'header' | 'sidebar' | 'footer' | 'standalone';
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  variant = 'header'
}) => {
  // Logo size mapping
  const sizeMap = {
    xs: { width: 'w-4', height: 'h-4', textSize: 'text-xs' },
    sm: { width: 'w-6', height: 'h-6', textSize: 'text-sm' },
    md: { width: 'w-8', height: 'h-8', textSize: 'text-lg' },
    lg: { width: 'w-12', height: 'h-12', textSize: 'text-xl' },
    xl: { width: 'w-16', height: 'h-16', textSize: 'text-2xl' }
  };

  // Logo file selection based on size and variant
  const getLogoSrc = () => {
    if (size === 'xs' || size === 'sm' || size === 'md') {
      return '/atrisi-logo-md.png';
    }
    if (size === 'lg') {
      return '/atrisi-logo-lg.png';
    }
    return '/atrisi-logo.png';
  };

  // Text color based on variant
  const getTextColors = () => {
    switch (variant) {
      case 'sidebar':
        return {
          joa: 'text-joa-primary',
          llm: 'text-white',
          ai: 'text-gray-300'
        };
      case 'footer':
        return {
          joa: 'text-joa-primary',
          llm: 'text-gray-600',
          ai: 'text-gray-500'
        };
      default: // header, standalone
        return {
          joa: 'text-joa-primary',
          llm: 'text-joa-secondary',
          ai: 'text-joa-dark'
        };
    }
  };

  const { width, height, textSize } = sizeMap[size];
  const logoSrc = getLogoSrc();
  const textColors = getTextColors();

  return (
    <div className={`logo-container flex items-center space-x-2 ${className}`}>
      <img
        src={logoSrc}
        alt="ATRISI Marketing logo"
        className={`${width} ${height} rounded-md object-contain`}
      />
      {showText && (
        <h1 className={`${textSize} font-bold`}>
          <span className={textColors.joa}>ATRISI</span>
          <span className={`${textColors.llm} ${size === 'xs' ? 'text-xs' : 'text-sm'} font-semibold`}> Marketing</span>
        </h1>
      )}
    </div>
  );
}

// Preset logo components for common use cases
export const HeaderLogo: React.FC = () => {
  return <Logo size="md" variant="header" />;
};

export const SidebarLogo: React.FC = () => {
  return <Logo size="sm" variant="sidebar" />;
};

export const FooterLogo: React.FC = () => {
  return <Logo size="sm" variant="footer" />;
};

export const StandaloneLogo: React.FC = () => {
  return <Logo size="lg" variant="standalone" />;
};

export const CompactLogo: React.FC = () => {
  return <Logo size="xs" showText={false} />;
};

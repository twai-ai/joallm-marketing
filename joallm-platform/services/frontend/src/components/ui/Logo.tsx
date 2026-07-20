import { PLATFORM_NAME, PLATFORM_SHORT_NAME } from '../../constants/product';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'header' | 'sidebar' | 'footer' | 'standalone';
}

const ATRISI_LOGO_MD = '/atrisi-logo-md.png';
const ATRISI_LOGO_LG = '/atrisi-logo-lg.png';
const ATRISI_LOGO_FULL = '/atrisi-logo.png';

export function Logo({
  size = 'md',
  showText = true,
  className = '',
  variant = 'header',
}: LogoProps) {
  const sizeMap = {
    xs: { width: 'w-7', height: 'h-7', textSize: 'text-xs', src: ATRISI_LOGO_MD },
    sm: { width: 'w-8', height: 'h-8', textSize: 'text-sm', src: ATRISI_LOGO_MD },
    md: { width: 'w-9', height: 'h-9', textSize: 'text-lg', src: ATRISI_LOGO_MD },
    lg: { width: 'w-14', height: 'h-14', textSize: 'text-xl', src: ATRISI_LOGO_LG },
    xl: { width: 'w-20', height: 'h-20', textSize: 'text-2xl', src: ATRISI_LOGO_FULL },
  };

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

  const { width, height, textSize, src } = sizeMap[size];
  const textColors = getTextColors();

  return (
    <div className={`logo-container flex items-center space-x-2.5 ${className}`}>
      <img
        src={src}
        alt={`${PLATFORM_NAME} logo`}
        className={`${width} ${height} rounded-md object-contain select-none shrink-0`}
        draggable={false}
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

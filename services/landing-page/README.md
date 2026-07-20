# JoaLLM Landing Page

A modern, responsive landing page for JoaLLM - The Swiss Army Knife for Large Language Models.

## Features

- **Modern Design**: Clean, professional design with smooth animations and brand-consistent styling
- **Brand Theme**: Custom JoaLLM brand colors and design system matching the commercial application
- **Dark Mode**: Complete dark/light theme support with system preference detection
- **Responsive**: Fully responsive design that works on all devices
- **Interactive Demo**: Live demo showcasing RAG capabilities, workflow automation, and multi-LLM support
- **Modern Components**: Advanced UI components including theme toggle, modern cards, and enhanced buttons
- **Tech Stack Showcase**: Comprehensive overview of the actual technology stack used
- **Performance Optimized**: Built with Vite for fast loading times and optimized bundle sizes

## Tech Stack

- **React 19.1.1** - Modern React with TypeScript and latest features
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework with custom brand theme
- **TypeScript** - Type-safe JavaScript
- **Dark Mode** - Complete dark/light theme support
- **Responsive Design** - Mobile-first responsive layout

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd joallm-landing-page
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── Hero.tsx          # Hero section with main CTA
│   ├── Features.tsx      # Features showcase
│   ├── Demo.tsx          # Interactive demo section
│   ├── TechStack.tsx     # Technology stack overview
│   ├── CTA.tsx           # Call-to-action section
│   └── Footer.tsx        # Footer with links
├── App.tsx               # Main app component
├── main.tsx              # App entry point
└── index.css             # Global styles and Tailwind imports
```

## Brand Theme

The landing page uses the official JoaLLM brand theme that matches the commercial application:

### **Brand Colors**
- **Primary Red**: `#8B0000` (Joa text color)
- **Secondary Black**: `#000000` (LLM text color)
- **Background**: `#E8EDF2` (Light blue-grey from logo)
- **Accent Blue**: `#3B82F6` (Links and highlights)

### **Logo Usage**
- Uses official JoaLLM logo variants from the commercial project
- Consistent branding across all components with proper Logo component
- Proper logo sizing and responsive behavior
- Multiple logo variants: small, medium, and large for different contexts

### **Logo Files**
The landing page includes optimized logo variants in the `public/` folder:

**Available Logo Files:**
- `JoaLLM-logo.png` - Original logo (fallback)
- `JoaLLM-logo-standard.png` - Standard variant
- `JoaLLM-logo-medium.png` - Medium variant (for headers and navigation)
- `JoaLLM-logo-large.png` - Large variant (for hero sections and prominent displays)

**Note:** Logo files were renamed from the original commercial project variants (which had parentheses in filenames) to clean names for better browser compatibility and easier URL handling.

### **Logo Component**
The landing page includes a comprehensive Logo component (`src/components/ui/Logo.tsx`) that provides:

**Available Variants:**
- `size`: `xs`, `sm`, `md`, `lg`, `xl` for different logo sizes
- `variant`: `header`, `sidebar`, `footer`, `standalone` for different styling contexts
- `showText`: Boolean to show/hide the "JoaLLM.AI" text
- `className`: Additional CSS classes for custom styling

**Usage Examples:**
```tsx
// Header navigation
<Logo size="sm" variant="header" />

// Hero section
<Logo size="xl" className="text-6xl md:text-8xl" />

// Footer
<Logo size="sm" variant="footer" />
```

## Customization

### Colors

The color scheme is based on the JoaLLM brand and can be customized in `src/index.css`:

```css
:root {
  --joa-primary: #8B0000;     /* Brand red */
  --joa-secondary: #000000;   /* Brand black */
  --joa-bg: #E8EDF2;          /* Brand background */
  --joa-accent: #3B82F6;      /* Accent blue */
}
```

### Content

Update the content in each component file to match your specific needs:

- **Hero.tsx**: Main headline, subtitle, and CTA buttons with brand colors
- **Features.tsx**: 9 core features including RAG, workflows, notebooks, and multi-LLM support
- **Demo.tsx**: Interactive demo showcasing RAG document intelligence and workflow automation
- **TechStack.tsx**: Updated technology stack reflecting React 19.1.1 and modern tools
- **CTA.tsx**: Final call-to-action content
- **Navigation.tsx**: Modern navigation with theme toggle and proper branding
- **ui/Logo.tsx**: Reusable Logo component with multiple variants and sizes

### Theme Toggle

The landing page includes a theme toggle that:
- Detects system preference (dark/light mode)
- Saves user preference to localStorage
- Provides smooth transitions between themes
- Maintains brand consistency in both themes

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the Vite configuration
3. Deploy with zero configuration

### Netlify

1. Build the project: `npm run build`
2. Deploy the `dist` folder to Netlify
3. Configure redirects for SPA routing if needed

### GitHub Pages

1. Install gh-pages: `npm install --save-dev gh-pages`
2. Add deploy script to package.json:
```json
"scripts": {
  "deploy": "gh-pages -d dist"
}
```
3. Build and deploy: `npm run build && npm run deploy`

## Performance

The landing page is optimized for performance with:

- **Code Splitting**: Automatic code splitting with Vite
- **Image Optimization**: Optimized images and lazy loading
- **CSS Optimization**: Purged unused CSS with Tailwind
- **Bundle Analysis**: Use `npm run build -- --analyze` to analyze bundle size

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
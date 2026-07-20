import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { UseCases } from './components/UseCases';
import { EnterpriseTrust } from './components/EnterpriseTrust';
import { CustomEngineering } from './components/CustomEngineering';
import { Demo } from './components/Demo';
import { RAGModes } from './components/RAGModes';
import { Pricing } from './components/Pricing';
import { TechStack } from './components/TechStack';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-joa-bg">
      <Navigation />
      <Hero />
      <Features />
      <UseCases />
      <Demo />
      <RAGModes />
      <EnterpriseTrust />
      <Pricing />
      <CustomEngineering />
      <TechStack />
      <CTA />
      <Footer />
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { LcMsCalibrationTool } from './tools/lc-ms-calibration/LcMsCalibrationTool';
import { UnitsTool } from './tools/units/UnitsTool';
import { TOOLS_REGISTRY, ToolMetadata } from './config/toolsRegistry';

export const App: React.FC = () => {
  const [currentToolId, setCurrentToolId] = useState<string | null>(() => {
    // 支援直接透過 hash 進入工具，如 #lc-ms-calibration
    const hash = window.location.hash.replace('#', '');
    return hash && TOOLS_REGISTRY.some(t => t.id === hash) ? hash : null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && TOOLS_REGISTRY.some(t => t.id === hash)) {
        setCurrentToolId(hash);
      } else {
        setCurrentToolId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectTool = (toolId: string) => {
    window.location.hash = toolId;
    setCurrentToolId(toolId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    window.location.hash = '';
    setCurrentToolId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentTool: ToolMetadata | null =
    TOOLS_REGISTRY.find(t => t.id === currentToolId) || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-teal-500 selection:text-white">
      {/* Navbar */}
      <Navbar currentTool={currentTool} onNavigateHome={handleNavigateHome} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!currentToolId ? (
          <HomePage onSelectTool={handleSelectTool} />
        ) : currentToolId === 'units' ? (
          <UnitsTool />
        ) : currentToolId === 'lc-ms-calibration' ? (
          <LcMsCalibrationTool />
        ) : (
          <div className="text-center py-20 space-y-4">
            <h2 className="text-xl font-bold text-slate-700">此工具即將在後續週次推出！</h2>
            <button
              onClick={handleNavigateHome}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
            >
              返回工具目錄
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;

import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  ArrowRight,
  Sparkles,
  Shield,
  Calendar,
  FlaskConical
} from 'lucide-react';
import {
  TOOLS_REGISTRY,
  CATEGORIES,
  ToolCategory,
} from '../config/toolsRegistry';

interface HomePageProps {
  onSelectTool: (toolId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectTool }) => {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lab_favorites') || '["lc-ms-calibration"]');
    } catch {
      return ['lc-ms-calibration'];
    }
  });

  const toggleFavorite = (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated: string[];
    if (favorites.includes(toolId)) {
      updated = favorites.filter(id => id !== toolId);
    } else {
      updated = [...favorites, toolId];
    }
    setFavorites(updated);
    localStorage.setItem('lab_favorites', JSON.stringify(updated));
  };

  const filteredTools = useMemo(() => {
    return TOOLS_REGISTRY.filter(tool => {
      const matchCategory =
        selectedCategory === 'all' || tool.category === selectedCategory;
      const matchSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    }).sort((a, b) => {
      // 釘選排最前
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.weekNumber - b.weekNumber;
    });
  }, [selectedCategory, searchQuery, favorites]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 rounded-3xl text-white p-8 sm:p-10 shadow-xl border border-teal-700/30">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            <span>水質檢驗與環境分析實驗室</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            我的實驗室工具箱
          </h1>
          <p className="text-teal-100/80 text-sm leading-relaxed">
            每週加入一個專用檢驗計算工具。所有運算 100% 於本機瀏覽器完成，數據完全保密，支援 Excel 整欄貼上與專業品管（QA/QC）警示判定。
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-xs text-teal-200/90 font-medium">
            <div className="flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>零伺服器傳輸（100% 數據保密）</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-teal-400" />
              <span>每週新增迭代更新</span>
            </div>
          </div>
        </div>

        {/* Background decorative illustration */}
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10 pointer-events-none">
          <FlaskConical className="w-80 h-80" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/60 rounded-xl">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  selectedCategory === cat.id
                    ? 'bg-white text-teal-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋工具名稱、標籤或關鍵字..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Tools Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map(tool => {
          const Icon = tool.icon;
          const isFav = favorites.includes(tool.id);
          const isReady = tool.status === 'ready';

          return (
            <div
              key={tool.id}
              onClick={() => isReady && onSelectTool(tool.id)}
              className={`group relative bg-white border rounded-2xl p-6 shadow-sm transition-all flex flex-col justify-between ${
                isReady
                  ? 'border-slate-200 hover:shadow-md hover:border-teal-400 cursor-pointer'
                  : 'border-slate-200/80 bg-slate-50/50 opacity-80'
              }`}
            >
              <div>
                {/* Card Header: Icon, Week Tag, Favorite */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`p-3 rounded-xl ${
                      isReady
                        ? 'bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      第 {tool.weekNumber} 週
                    </span>

                    <button
                      onClick={e => toggleFavorite(tool.id, e)}
                      className={`p-1.5 rounded-lg transition ${
                        isFav
                          ? 'text-amber-400 hover:text-amber-500'
                          : 'text-slate-300 hover:text-slate-500'
                      }`}
                      title={isFav ? '取消最愛' : '加入常用工具'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Title & Status */}
                <div className="space-y-1 mb-2.5">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition-colors">
                      {tool.name}
                    </h3>
                  </div>

                  {isReady ? (
                    <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ● 已上線・即開即用
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      ⏱ 即將推出（預計下週）
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-4">
                  {tool.description}
                </p>
              </div>

              <div>
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {tool.tags.map(t => (
                    <span
                      key={t}
                      className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                {/* Card Action Link */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {isReady ? (
                    <span className="text-teal-700 font-bold flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                      <span>開始使用此工具</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">即將於後續週次釋出</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

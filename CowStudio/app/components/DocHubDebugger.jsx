import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Activity, 
  ChevronRight, 
  RefreshCcw, 
  Trash2, 
  Layers,
  Code2
} from 'lucide-react';
const DocHubDebugger = ({ initialDoc }) => {
  const [doc, setDoc] = useState(initialDoc || { title: 'Cow Studio', components: [] });
  const [selectedComponent, setSelectedComponent] = useState(null);
  useEffect(() => {
    if (initialDoc) {
      setDoc(initialDoc);
    }
  }, [initialDoc]);
  return (
    <div className="flex flex-col h-full bg-transparent text-slate-600 dark:text-slate-400 font-sans">
      {}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {doc.components.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <Package size={28} className="text-slate-200 dark:text-slate-600" />
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500 font-bold">No Components Detected</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Render a template to see DocHub structure</p>
          </div>
        ) : (
          doc.components.map((comp, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedComponent(selectedComponent === comp ? null : comp)}
              className={`
                group relative border rounded-2xl p-5 cursor-pointer transition-all duration-300
                ${selectedComponent === comp 
                  ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-900 shadow-[0_10px_30px_rgba(99,102,241,0.08)] ring-1 ring-indigo-100 dark:ring-indigo-900/30' 
                  : 'bg-white/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50'}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                    ${selectedComponent === comp ? 'bg-indigo-500 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:bg-slate-100 dark:group-hover:bg-slate-600'}
                  `}>
                    <Code2 size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{comp.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">ID: {comp.id || `c_${i}`}</div>
                  </div>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`text-slate-300 dark:text-slate-600 transition-transform duration-300 ${selectedComponent === comp ? 'rotate-90 text-indigo-400' : ''}`} 
                />
              </div>
              {}
              {selectedComponent === comp && (
                <div className="mt-4 pt-4 border-t border-indigo-100/50 dark:border-indigo-900/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-1 h-3 bg-indigo-400 rounded-full"></div>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">属性配置 Props</span>
                    </div>
                    <div className="bg-slate-900 dark:bg-black rounded-lg p-3 overflow-x-auto shadow-inner">
                      <pre className="text-[11px] font-mono text-indigo-300 dark:text-indigo-400 leading-relaxed">
                        {JSON.stringify(comp.props || { theme: 'light' }, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors shadow-sm">
                      <RefreshCcw size={12} />
                      刷新
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-red-500 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm">
                      <Trash2 size={12} />
                      移除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {}
      <div className="p-5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DocHub 引擎状态</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-[10px] text-slate-400 mb-0.5 font-medium">解析器</div>
            <div className="text-xs font-bold text-slate-700">Ready</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-[10px] text-slate-400 mb-0.5 font-medium">已缓存</div>
            <div className="text-xs font-bold text-slate-700">{doc.components.length} 个实例</div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DocHubDebugger;

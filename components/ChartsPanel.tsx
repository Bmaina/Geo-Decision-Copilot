import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { AnalysisResult } from '../types';

interface ChartsPanelProps {
  analysis: AnalysisResult | null;
}

const ChartsPanel: React.FC<ChartsPanelProps> = ({ analysis }) => {
  if (!analysis || !analysis.chartData || analysis.chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 bg-slate-800/50 rounded-lg border border-slate-700">
        <p>No analytical data available for visualization.</p>
      </div>
    );
  }

  // Group data by category if needed, for now just showing a main metric chart
  // Filter for unique names to avoid duplicates if AI hallucinates them
  const uniqueData = Array.from(new Set(analysis.chartData.map(d => d.name)))
    .map(name => {
      return analysis.chartData.find(d => d.name === name);
    })
    .filter(Boolean);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 p-3 rounded shadow-lg">
          <p className="font-bold text-slate-100">{label}</p>
          <p className="text-blue-400">
            {payload[0].payload.category}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="h-1/2 bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Comparative Metrics</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={uniqueData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis
                dataKey="name"
                type="category"
                stroke="#94a3b8"
                width={100}
                tick={{fontSize: 12}}
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.4}} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {uniqueData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="h-1/2 bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-lg overflow-y-auto">
         <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Location Ranking</h3>
         <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                <tr>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Score</th>
                </tr>
            </thead>
            <tbody>
                {analysis.locations.sort((a,b) => b.score - a.score).map((loc) => (
                    <tr key={loc.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-100">{loc.name}</td>
                        <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium
                                ${loc.type === 'recommended' ? 'bg-green-900 text-green-300' :
                                  loc.type === 'risk' ? 'bg-red-900 text-red-300' :
                                  loc.type === 'competitor' ? 'bg-amber-900 text-amber-300' :
                                  'bg-blue-900 text-blue-300'}`}>
                                {loc.type}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{loc.score}</td>
                    </tr>
                ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default ChartsPanel;

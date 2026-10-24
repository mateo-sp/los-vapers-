import { motion } from 'motion/react';
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export default function StatsCard({
  title,
  value,
  icon,
  colorClass,
  description,
  trend,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-md hover:shadow-lg hover:border-white/25 transition-all flex flex-col justify-between h-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">{title}</p>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1.5 sm:mt-2 tracking-tight font-mono truncate">
            {value}
          </h3>
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl ${colorClass} text-white shadow-lg shadow-black/10 shrink-0`}>
          {icon}
        </div>
      </div>
      
      {(description || trend) && (
        <div className="mt-3.5 sm:mt-4 pt-3 sm:pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs">
          {description && <span className="text-slate-400 font-medium">{description}</span>}
          {trend && (
            <span
              className={`font-semibold px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] whitespace-nowrap ${
                trend.isPositive 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function TrendIndicator({ value, previousValue, higherIsBetter = true }) {
  if (!previousValue) return null;
  const diff = value - previousValue;
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  const worsened = higherIsBetter ? diff < 0 : diff > 0;

  if (diff === 0) return <Minus className="w-4 h-4 text-gray-400" />;
  if (improved) return <TrendingDown className="w-4 h-4 text-emerald-500" />;
  if (worsened) return <TrendingUp className="w-4 h-4 text-red-500" />;
  return null;
}

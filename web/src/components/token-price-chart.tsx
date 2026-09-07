'use client';

import { AreaSeries, ColorType, createChart, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { ChartPoint } from '@/lib/types';

export function TokenPriceChart({ data }: { data: ChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#1a1c19' },
        textColor: '#8f9482',
      },
      grid: {
        vertLines: { color: '#2a2c27' },
        horzLines: { color: '#2a2c27' },
      },
      crosshair: {
        vertLine: { color: '#d8c483' },
        horzLine: { color: '#d8c483' },
      },
      rightPriceScale: {
        borderColor: '#2a2c27',
      },
      timeScale: {
        borderColor: '#2a2c27',
      },
      height: 340,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#d8c483',
      topColor: 'rgba(216, 196, 131, 0.28)',
      bottomColor: 'rgba(216, 196, 131, 0.02)',
    });

    series.setData(
      data.map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })),
    );
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data]);

  return <div ref={containerRef} className="h-[340px] w-full" />;
}

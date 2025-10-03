/**
 * Responsive font scaling utilities for dashboard components
 * Handles text truncation and scaling for panels with financial data
 */
import { useState, useEffect } from 'react';

export interface TextScaleConfig {
  minFontSize: number;
  maxFontSize: number;
  minWidth: number;
  maxWidth: number;
  preserveAspectRatio?: boolean;
}

export interface NumberDisplayProps {
  value: number | string;
  format?: 'currency' | 'percentage' | 'decimal' | 'integer';
  precision?: number;
  className?: string;
  maxLength?: number;
}

const DEFAULT_SCALE_CONFIG: TextScaleConfig = {
  minFontSize: 10,
  maxFontSize: 16,
  minWidth: 100,
  maxWidth: 300,
};

/**
 * Calculate responsive font size based on container width
 */
export function getResponsiveFontSize(
  containerWidth: number,
  config: TextScaleConfig = DEFAULT_SCALE_CONFIG
): number {
  const { minFontSize, maxFontSize, minWidth, maxWidth } = config;

  if (containerWidth <= minWidth) return minFontSize;
  if (containerWidth >= maxWidth) return maxFontSize;

  return minFontSize + ((containerWidth - minWidth) / (maxWidth - minWidth)) * (maxFontSize - minFontSize);
}

/**
 * Format numbers with consistent display rules
 */
export function formatNumberDisplay(
  value: number | string,
  format: NumberDisplayProps['format'] = 'decimal',
  precision: number = 2
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (!Number.isFinite(num)) return '—';

  switch (format) {
    case 'currency':
      if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(precision)}M`;
      if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(precision)}K`;
      return `$${num.toFixed(precision)}`;

    case 'percentage':
      return `${(num * 100).toFixed(precision)}%`;

    case 'integer':
      return Math.round(num).toLocaleString();

    case 'decimal':
    default:
      return num.toFixed(precision);
  }
}

/**
 * Hook for responsive text sizing (use in components)
 */
export function useResponsiveText(
  containerRef: React.RefObject<HTMLElement>,
  config: TextScaleConfig = DEFAULT_SCALE_CONFIG
) {
  const [fontSize, setFontSize] = useState(config.maxFontSize);

  useEffect(() => {
    const updateFontSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setFontSize(getResponsiveFontSize(width, config));
      }
    };

    updateFontSize();

    const resizeObserver = new ResizeObserver(updateFontSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [containerRef, config]);

  return { fontSize };
}

/**
 * Truncate text with ellipsis for overflow handling
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '…';
}

/**
 * CSS classes for responsive number display
 */
export const responsiveNumberClasses = {
  base: 'font-mono font-semibold tabular-nums',
  small: 'text-xs md:text-sm lg:text-base',
  medium: 'text-sm md:text-base lg:text-lg',
  large: 'text-base md:text-lg lg:text-xl',
  currency: 'text-emerald-400',
  negative: 'text-red-400',
  positive: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-500',
} as const;

/**
 * Combine responsive classes based on value
 */
export function getValueClasses(
  value: number,
  isCurrency: boolean = false
): string {
  const classes: string[] = [responsiveNumberClasses.base, responsiveNumberClasses.medium];

  if (isCurrency) classes.push(responsiveNumberClasses.currency);

  if (value < 0) classes.push(responsiveNumberClasses.negative);
  else if (value > 0) classes.push(responsiveNumberClasses.positive);

  return classes.join(' ');
}

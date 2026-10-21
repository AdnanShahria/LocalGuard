import React from 'react';

interface BrandLogoProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'squircle' | 'shield-only';
  showText?: boolean;
  subtext?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  variant = 'squircle',
  showText = false,
  subtext,
}) => {
  const pixelSize =
    typeof size === 'number'
      ? size
      : size === 'xs'
      ? 20
      : size === 'sm'
      ? 28
      : size === 'md'
      ? 36
      : size === 'lg'
      ? 44
      : 56;

  const idSuffix = React.useId().replace(/:/g, '');

  return (
    <div className={`inline-flex items-center space-x-2.5 ${className}`}>
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-200 hover:scale-105"
        style={{
          filter: 'drop-shadow(0 2px 8px rgba(0, 113, 227, 0.22))',
        }}
      >
        <defs>
          {/* Apple HIG Dynamic Gradient */}
          <linearGradient
            id={`brandGrad-${idSuffix}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#0071E3" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>

          {/* Top specular reflection / inner rim highlight */}
          <linearGradient
            id={`specularGrad-${idSuffix}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
          </linearGradient>

          {/* Shield Inner Gradient */}
          <linearGradient
            id={`shieldGrad-${idSuffix}`}
            x1="50%"
            y1="0%"
            x2="50%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0.92" />
          </linearGradient>
        </defs>

        {variant === 'squircle' && (
          <>
            {/* Apple iOS Continuous Squircle Body */}
            <rect
              x="3"
              y="3"
              width="94"
              height="94"
              rx="24"
              fill={`url(#brandGrad-${idSuffix})`}
            />

            {/* Specular Inner Rim */}
            <rect
              x="3.75"
              y="3.75"
              width="92.5"
              height="92.5"
              rx="23.25"
              fill="none"
              stroke={`url(#specularGrad-${idSuffix})`}
              strokeWidth="1.5"
            />
          </>
        )}

        {/* Precision Vector Shield */}
        <g
          transform={
            variant === 'squircle'
              ? 'translate(22, 20) scale(0.56)'
              : 'translate(10, 10) scale(0.8)'
          }
          filter="drop-shadow(0 2px 4px rgba(0, 0, 0, 0.16))"
        >
          {/* Shield Path */}
          <path
            d="M50 4L12 18V48C12 73 28 92 50 98C72 92 88 73 88 48V18L50 4Z"
            fill={`url(#shieldGrad-${idSuffix})`}
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Shield Core Emblem: Focus Target & Check */}
          <circle
            cx="50"
            cy="48"
            r="19"
            fill="#2563EB"
            fillOpacity="0.14"
            stroke="#2563EB"
            strokeWidth="3.5"
          />

          {/* Center checkmark / focus dot */}
          <path
            d="M42 48.5L47.5 54L59 42"
            fill="none"
            stroke="#2563EB"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-900 tracking-tight leading-none text-base">
              LocalGuard
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 font-semibold tracking-wide">
              Active Protection
            </span>
          </div>
          {subtext && (
            <p className="text-[11px] text-slate-500 font-normal leading-tight mt-0.5">
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lbBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9f1239" />
          <stop offset="100%" stopColor="#4c0519" />
        </linearGradient>
        <linearGradient id="lbGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="url(#lbBg)" />
      <path
        d="M256 385 C256 385 130 295 130 195 C130 140 172 100 224 100 C242 100 250 110 256 120 C262 110 270 100 288 100 C340 100 382 140 382 195 C382 295 256 385 256 385 Z"
        fill="none"
        stroke="url(#lbGold)"
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="222" r="10" fill="#FFFBEB" />
    </svg>
  );
};

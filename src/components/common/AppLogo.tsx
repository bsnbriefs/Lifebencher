import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  variant?: 'mark' | 'lockup';
}

const MARK = '/brand/lifebencher-mark.png';

export const AppLogo: React.FC<AppLogoProps> = ({ size = 32, className = '', variant = 'mark' }) => {
  const width = variant === 'lockup' ? Math.round(size * 1.15) : size;
  return (
    <img
      src={MARK}
      alt="Lifebencher Match"
      width={width}
      height={size}
      className={`object-contain shrink-0 ${className}`}
      style={{ width, height: size }}
    />
  );
};

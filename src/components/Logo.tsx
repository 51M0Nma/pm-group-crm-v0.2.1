import React from 'react';
import { useApp } from '../AppContext';

interface LogoProps {
  theme?: 'light' | 'dark';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ theme = 'dark', className = "h-10 w-auto" }) => {
  const { logoUrl } = useApp();
  const pmColor = theme === 'dark' ? '#FFFFFF' : '#0F212D';
  const goldColor = '#BC8F55';

  if (logoUrl) {
    return (
      <div className={`flex items-center ${className}`}>
        <img src={logoUrl} alt="Logo" className="h-full w-auto object-contain max-h-12" />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <svg
        viewBox="0 0 280 100"
        className="h-full w-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Icon: The unique arch and spiral shape */}
        <g transform="translate(10, 10)">
          {/* Main Arch and spiral */}
          <path
            d="M5 75V35C5 18.4315 18.4315 5 35 5C51.5685 5 65 18.4315 65 35M65 35C65 46.0457 56.0457 55 45 55C33.9543 55 25 46.0457 25 35C25 23.9543 33.9543 15 45 15C52.7486 15 59.3905 19.412 62.4935 25.861"
            stroke={goldColor}
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right partial swoosh leg */}
          <path
            d="M78 35C78 44 78 75 78 75"
            stroke={goldColor}
            strokeWidth="11"
            strokeLinecap="round"
          />
        </g>

        {/* PM Text: Custom paths for the thick rounded font */}
        <g transform="translate(115, 12)" fill={pmColor}>
          {/* P */}
          <path d="M0 5.6C0 2.50701 2.50701 0 5.6 0H41.5651C52.8509 0 62 9.14912 62 20.4349V22.2598C62 33.5456 52.8509 42.6948 41.5651 42.6948H12.3V78.4H0V5.6ZM12.3 31.0662H39.2941C44.7093 31.0662 49.1 26.6755 49.1 21.2603V21.1413C49.1 15.7262 44.7093 11.3355 39.2941 11.3355H12.3V31.0662Z" />
          
          {/* M - Custom geometric path to match the reference */}
          <path d="M78.4 0H92.4L112.5 35.8L132.6 0H146.6V78.4H133.4V24.5L114.7 57.2C113.8 58.8 111.2 58.8 110.3 57.2L91.6 24.5V78.4H78.4V0Z" />
        </g>
      </svg>
    </div>
  );
};

import React from 'react';
import { Compass, Heart, MessageCircle, User } from 'lucide-react';
import { motion } from 'motion/react';
import { NavigationTab } from '../../types';
import { sounds } from '../../lib/sound';

interface BottomNavProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  unreadCount?: number;
  newMatchesCount?: number;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
  newMatchesCount = 0
}) => {
  const navItems: NavItem[] = [
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'matches', label: 'Matches', icon: Heart, badge: newMatchesCount },
    { id: 'messages', label: 'Messages', icon: MessageCircle, badge: unreadCount },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-t border-stone-200/80 safe-area-bottom shadow-lg"
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around relative">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                sounds.playTap();
                onSelectTab(item.id);
              }}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-transform active:scale-90 select-none cursor-pointer"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active animated indicator pill behind icon */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavActiveIndicator"
                  className="absolute -top-0.5 w-10 h-1 bg-gradient-to-r from-rose-700 via-rose-800 to-amber-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isActive ? 'text-rose-900 stroke-[2.3]' : 'text-stone-400 stroke-[1.8]'
                  }`}
                />

                {/* Badge for unread / new items */}
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-700 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#FAF8F5]">
                    {item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] font-medium tracking-tight mt-1 transition-colors ${
                  isActive ? 'text-rose-900 font-semibold' : 'text-stone-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

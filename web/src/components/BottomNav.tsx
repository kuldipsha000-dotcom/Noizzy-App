import React from 'react';
import { Home, Search, Library, HardDrive } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const BottomNav: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const tabs = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: Search, label: 'Search', path: '/search' },
        { icon: Library, label: 'Library', path: '/library' },
        { icon: HardDrive, label: 'Downloads', path: '/downloads' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-[80] flex md:hidden border-t border-white/10"
            style={{
                background: 'rgba(10, 10, 10, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
        >
            {tabs.map(({ icon: Icon, label, path }) => {
                const isActive = location.pathname === path;
                return (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
                    >
                        <Icon
                            className={`w-6 h-6 transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}
                            strokeWidth={isActive ? 2.5 : 2}
                        />
                        <span className={`text-[10px] font-semibold tracking-wide transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default BottomNav;

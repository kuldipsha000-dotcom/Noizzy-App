import React, { useState, useEffect, useRef } from 'react';
import { Home, Search as SearchIcon, Play, X, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { musicApi } from '../services/api';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import SafeImage from './SafeImage';

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    
    const setCurrentSong = usePlayerStore(state => state.setCurrentSong);
    const addToQueue = usePlayerStore(state => state.addToQueue);
    
    const recentSearches = useLibraryStore(state => state.recentSearches);
    const addToRecentSearches = useLibraryStore(state => state.addToRecentSearches);
    const removeFromRecentSearches = useLibraryStore(state => state.removeFromRecentSearches);
    const clearRecentSearches = useLibraryStore(state => state.clearRecentSearches);

    // Keyboard shortcut to focus search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim()) {
                setIsLoading(true);
                try {
                    const data = await musicApi.search(query);
                    const songs = data.filter((item: any) => item.type === 'SONG').slice(0, 20);
                    setResults(songs);
                } catch (error) {
                    console.error("Search failed:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const handlePlaySong = (song: any) => {
        const songData = {
            videoId: song.videoId,
            title: song.name || song.title || 'Unknown',
            artist: song.artist?.name || song.artist || 'Unknown Artist',
            thumbnailUrl: song.thumbnails?.[0]?.url || song.thumbnailUrl || '',
            duration: song.duration?.toString() || ''
        };
        setCurrentSong(songData);
        addToQueue(songData);
        addToRecentSearches(songData);
        setIsFocused(false);
        setQuery('');
        inputRef.current?.blur();
    };

    return (
        <div
            className="h-14 relative z-50 flex shrink-0 items-center justify-between px-5 border-b border-white/5"
            style={{
                background: 'rgba(0, 0, 0, 0)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
        >
            {/* Left: Home button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/')}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${location.pathname === '/'
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                >
                    <Home className="w-4 h-4" />
                </button>
            </div>

            {/* Center: Search Bar — hidden on mobile (use Search page instead) */}
            <div className="hidden md:flex flex-1 max-w-3xl mx-4 relative group" ref={searchRef}>
                <div 
                    className={`relative flex items-center border transition-colors rounded-full overflow-hidden ${
                        isFocused ? 'border-white/30' : 'border-white/10 hover:border-white/20'
                    }`}
                    style={{
                        background: isFocused ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                    }}
                >
                    <div className={`pl-4 pr-2 flex items-center justify-center transition-colors ${
                        isFocused ? 'text-white' : 'text-spotify-light-grey group-hover:text-white/80'
                    }`}>
                        <SearchIcon className="w-5 h-5" />
                    </div>
                    
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="What do you want to play?"
                        className="w-full bg-transparent text-white text-[15px] py-3 px-2 focus:outline-none placeholder-spotify-light-grey font-medium"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsFocused(true);
                        }}
                        onFocus={() => setIsFocused(true)}
                    />
                    
                    {query && (
                        <button 
                            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                            className="absolute right-3 p-1 hover:bg-white/10 rounded-full text-spotify-light-grey hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    
                    {/* Keyboard Shortcut Hint */}
                    {!query && (
                        <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center gap-1 pointer-events-none">
                            <kbd className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-semibold text-spotify-light-grey">⌘K</kbd>
                        </div>
                    )}
                </div>

                {/* Search Dropdown */}
                {isFocused && (
                    <div 
                        className="absolute top-full left-0 right-0 mt-2 border border-white/5 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[70vh] flex flex-col pt-2 pb-2"
                        style={{
                            background: 'rgba(20, 20, 20, 0.75)',
                            backdropFilter: 'blur(40px)',
                            WebkitBackdropFilter: 'blur(40px)',
                        }}
                    >
                        {isLoading && results.length === 0 ? (
                            <div className="p-8 text-center text-spotify-light-grey">
                                <div className="w-6 h-6 border-2 border-spotify-light-grey border-t-white rounded-full animate-spin mx-auto mb-3"></div>
                                Searching...
                            </div>
                        ) : query.trim() ? (
                            results.length > 0 ? (
                                <div className="overflow-y-auto hide-scrollbar">
                                    {results.map((song) => (
                                        <div 
                                            key={song.videoId}
                                            onClick={() => handlePlaySong(song)}
                                            className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 cursor-pointer group transition-colors"
                                        >
                                            <div className="relative w-12 h-12 shrink-0 bg-spotify-grey rounded overflow-hidden">
                                                <SafeImage 
                                                    src={song.thumbnails?.[0]?.url || song.thumbnailUrl} 
                                                    alt={song.name || song.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex">
                                                    <Play className="w-6 h-6 text-white ml-1" fill="white" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-medium truncate text-[15px]">{song.name || song.title}</div>
                                                <div className="text-sm text-spotify-light-grey truncate flex items-center gap-1">
                                                    <span>Song</span>
                                                    <span className="text-[10px]">•</span>
                                                    <span>{song.artist?.name || song.artist}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : !isLoading ? (
                                <div className="p-8 text-center text-spotify-light-grey">
                                    No results found for "{query}"
                                </div>
                            ) : null
                        ) : (
                            /* Recent Searches */
                            recentSearches?.length > 0 ? (
                                <div className="overflow-y-auto hide-scrollbar">
                                    <div className="px-4 py-2 text-xs font-bold text-spotify-light-grey uppercase tracking-wider">
                                        Recent Searches
                                    </div>
                                    {recentSearches.map((song, i) => (
                                        <div 
                                            key={`recent-${song.videoId}-${i}`}
                                            onClick={() => handlePlaySong(song)}
                                            className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 cursor-pointer group transition-colors"
                                        >
                                            <div className="w-10 h-10 flex items-center justify-center text-spotify-light-grey group-hover:text-white transition-colors bg-white/5 rounded-full">
                                                <Clock className="w-5 h-5 pointer-events-none" />
                                            </div>
                                            <div className="relative w-12 h-12 shrink-0 bg-spotify-grey rounded overflow-hidden">
                                                <SafeImage 
                                                    src={song.thumbnailUrl} 
                                                    alt={song.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex">
                                                    <Play className="w-6 h-6 text-white ml-1" fill="white" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-medium truncate text-[15px]">{song.title}</div>
                                                <div className="text-sm text-spotify-light-grey truncate flex items-center gap-1">
                                                    <span>Song</span>
                                                    <span className="text-[10px]">•</span>
                                                    <span>{song.artist}</span>
                                                </div>
                                            </div>
                                            <X 
                                                className="w-5 h-5 text-spotify-light-grey opacity-0 group-hover:opacity-100 hover:text-white transition-all ml-2" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFromRecentSearches(song.videoId);
                                                }}
                                            />
                                        </div>
                                    ))}
                                    {recentSearches.length > 0 && (
                                        <div className="pt-2 px-4 pb-1 mt-1 border-t border-white/10">
                                            <button 
                                                onClick={clearRecentSearches}
                                                className="text-sm font-semibold text-spotify-light-grey hover:text-white hover:underline transition-all px-2 py-1"
                                            >
                                                Clear recent searches
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-spotify-light-grey">
                                    No recent searches
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
            </div>
        </div>
    );
};

export default Navbar;

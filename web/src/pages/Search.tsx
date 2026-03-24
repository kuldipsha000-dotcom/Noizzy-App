import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Heart, MoreHorizontal, ListPlus } from 'lucide-react';
import { musicApi } from '../services/api';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore, type Song } from '../store/libraryStore';
import SafeImage from '../components/SafeImage';
import { useNavigate } from 'react-router-dom';

const Search = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const setCurrentSong = usePlayerStore(state => state.setCurrentSong);
    const addToQueue = usePlayerStore(state => state.addToQueue);
    const navigate = useNavigate();

    const playlists = useLibraryStore(state => state.playlists);
    const likedSongs = useLibraryStore(state => state.likedSongs);
    const toggleLikedSong = useLibraryStore(state => state.toggleLikedSong);
    const addSongToPlaylist = useLibraryStore(state => state.addSongToPlaylist);
    const recentSearches = useLibraryStore(state => state.recentSearches);
    const addToRecentSearches = useLibraryStore(state => state.addToRecentSearches);
    const removeFromRecentSearches = useLibraryStore(state => state.removeFromRecentSearches);
    const clearRecentSearches = useLibraryStore(state => state.clearRecentSearches);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim()) {
                setIsLoading(true);
                try {
                    const data = await musicApi.search(query);
                    setResults(data);
                    setIsLoading(false);
                } catch (error) {
                    console.error("Search failed:", error);
                    setIsLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const toSongData = (song: any): Song => ({
        videoId: song.videoId,
        title: song.name || song.title || 'Unknown',
        artist: song.artist?.name || song.artist || 'Unknown Artist',
        thumbnailUrl: song.thumbnails?.[0]?.url || song.thumbnailUrl || '',
        duration: song.duration?.toString() || ''
    });

    const handlePlaySong = (song: any) => {
        const songData = toSongData(song);
        setCurrentSong(songData);
        addToQueue(songData);
        addToRecentSearches(songData);
    };

    const handleResultClick = (item: any) => {
        if (item.type === 'ALBUM' || item.type === 'PLAYLIST') {
            navigate(`/discover/${item.browseId}`);
        } else {
            handlePlaySong(item);
        }
    };

    const handleLike = (e: React.MouseEvent, song: any) => {
        e.stopPropagation();
        toggleLikedSong(toSongData(song));
    };

    const handleAddToPlaylist = (e: React.MouseEvent, playlistId: string, song: any) => {
        e.stopPropagation();
        addSongToPlaylist(playlistId, toSongData(song));
        setMenuOpen(null);
    };

    const isLiked = (videoId: string) => likedSongs.some(s => s.videoId === videoId);

    return (
        <div className="p-4 md:p-8 h-full flex flex-col">
            <div className="w-full max-w-xl mb-6 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-spotify-black" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-3.5 border border-transparent rounded-full leading-5 bg-white text-spotify-black placeholder-spotify-grey focus:outline-none focus:ring-2 focus:ring-white text-sm font-semibold transition-all shadow-md focus:shadow-xl"
                    placeholder="What do you want to listen to?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                />
            </div>

            {query ? (
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                         <div className="flex justify-center mt-20">
                             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spotify-green"></div>
                         </div>
                    ) : results.length > 0 ? (
                        <>
                            <h2 className="text-2xl font-bold mb-4">Top Results</h2>
                            <div className="flex flex-col gap-3 w-full max-w-4xl">
                                {results.map((song, index) => (
                                    <div 
                                        key={song.videoId || song.browseId || index} 
                                        className="flex items-center gap-3 p-3 bg-white/5 rounded-lg group transition-colors cursor-pointer hover:bg-white/10"
                                        onClick={() => handleResultClick(song)}
                                    >
                                        <div className="w-8 text-center text-spotify-light-grey shrink-0">{index + 1}</div>
                                        <div className="w-12 h-12 bg-spotify-grey rounded overflow-hidden shrink-0">
                                            {song.thumbnails?.[1]?.url && (
                                                <SafeImage src={song.thumbnails[1].url} alt={song.name} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white truncate group-hover:text-spotify-green transition-colors text-base">{song.name}</span>
                                                {song.type === 'ALBUM' && (
                                                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white font-bold tracking-wide">Album</span>
                                                )}
                                                {song.type === 'PLAYLIST' && (
                                                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white font-bold tracking-wide">Playlist</span>
                                                )}
                                            </div>
                                            <span className="text-xs text-spotify-light-grey truncate">{song.artist?.name}</span>
                                        </div>
                                        <span className="text-xs text-spotify-light-grey w-12 text-right shrink-0">
                                            {song.duration ? Math.floor(song.duration/60) + ':' + (song.duration%60).toString().padStart(2, '0') : ''}
                                        </span>
                                        <div className="flex items-center gap-4 text-spotify-light-grey opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleLike(e, song)}
                                                className={`hover:text-white transition-colors ${isLiked(song.videoId) ? 'text-spotify-green' : ''}`}
                                                title={isLiked(song.videoId) ? 'Unlike' : 'Like'}
                                            >
                                                <Heart className="w-4 h-4" fill={isLiked(song.videoId) ? 'currentColor' : 'none'} />
                                            </button>
                                            
                                            {/* More menu with Add to Playlist */}
                                            <div className="relative" ref={menuOpen === song.videoId ? menuRef : undefined}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMenuOpen(menuOpen === song.videoId ? null : song.videoId);
                                                    }}
                                                    className="hover:text-white"
                                                >
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </button>
                                                
                                                {menuOpen === song.videoId && (
                                                    <div className="absolute right-0 bottom-8 bg-spotify-grey rounded-md shadow-2xl py-1 min-w-50 z-50 border border-spotify-grey/30 max-h-48 sm:max-h-64 overflow-y-auto">
                                                        <div className="px-3 py-2 text-xs text-spotify-light-grey font-semibold uppercase tracking-wider border-b border-spotify-grey/30">
                                                            Add to playlist
                                                        </div>
                                                        {playlists.length === 0 ? (
                                                            <div className="px-3 py-2 text-sm text-spotify-light-grey">
                                                                No playlists yet
                                                            </div>
                                                        ) : (
                                                            playlists.map(pl => (
                                                                <button
                                                                    key={pl.id}
                                                                    onClick={(e) => handleAddToPlaylist(e, pl.id, song)}
                                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors text-left"
                                                                >
                                                                    <ListPlus className="w-4 h-4 text-spotify-light-grey" />
                                                                    <span className="truncate">{pl.name}</span>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center mt-20">
                            <h3 className="text-xl font-bold mb-2">No results found for "{query}"</h3>
                            <p className="text-spotify-light-grey">Please make sure your words are spelled correctly or use less or different keywords.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-6">Search History</h2>
                    <div className="flex flex-col gap-2 w-full max-w-xl">
                        {recentSearches.length === 0 ? (
                            <div className="text-spotify-light-grey text-sm">No search history yet.</div>
                        ) : (
                            recentSearches.slice(0, 15).map((song, idx) => (
                                <div key={song.videoId || idx} className="flex items-center gap-4 p-2 hover:bg-white/10 rounded-md group transition-colors cursor-pointer">
                                    <div className="w-10 text-center text-spotify-light-grey">{idx + 1}</div>
                                    <div className="w-12 h-12 bg-spotify-grey rounded overflow-hidden shrink-0">
                                        {song.thumbnailUrl && (
                                            <SafeImage src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0" onClick={() => {
                                        setCurrentSong(song);
                                        addToRecentSearches(song);
                                    }}>
                                        <div className="font-semibold text-white truncate">{song.title}</div>
                                        <div className="text-sm text-spotify-light-grey truncate">{song.artist}</div>
                                    </div>
                                    <div className="text-sm text-spotify-light-grey w-16 text-right">
                                        {song.duration ? Math.floor(Number(song.duration)/60) + ':' + (Number(song.duration)%60).toString().padStart(2, '0') : ''}
                                    </div>
                                    <button
                                        onClick={() => removeFromRecentSearches(song.videoId)}
                                        className="ml-2 text-spotify-light-grey hover:text-red-400 transition-colors text-xs px-2 py-1 rounded-full border border-white/10"
                                        title="Remove from history"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))
                        )}
                        {recentSearches.length > 0 && (
                            <button
                                onClick={clearRecentSearches}
                                className="mt-4 bg-spotify-green text-black font-bold text-sm rounded-full px-4 py-2 hover:scale-105 transition-all"
                            >
                                Clear History
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Search;

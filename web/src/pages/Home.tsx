import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SafeImage from '../components/SafeImage';
import { Heart, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';

import { musicApi, normalizeSong } from '../services/api';

// Global module-level cache for Home feed thumbnails
const thumbnailCache: Record<string, string | null> = {};

// Helper component to fetch and display a thumbnail for a given query
const ThumbnailCard = ({ query, fallbackGradient, children }: { query: string, fallbackGradient: string, children: React.ReactNode }) => {
    // Initialize synchronously from cache if available
    const [thumb, setThumb] = useState<string | null>(thumbnailCache[query] !== undefined ? thumbnailCache[query] : null);

    useEffect(() => {
        // Break early if we already have a cached answer (even if it's explicitly null)
        if (thumbnailCache[query] !== undefined) {
            setThumb(thumbnailCache[query]);
            return;
        }

        let mounted = true;
        musicApi.search(query, 'songs').then(results => {
            if (mounted && results.length > 0) {
                const song = normalizeSong(results[0]);
                if (song.thumbnailUrl) {
                    thumbnailCache[query] = song.thumbnailUrl;
                    setThumb(song.thumbnailUrl);
                } else {
                    thumbnailCache[query] = null;
                }
            } else if (mounted) {
                thumbnailCache[query] = null;
            }
        }).catch(err => {
            console.log('Err fetching thumb', err);
            if (mounted) thumbnailCache[query] = null;
        });
        
        return () => { mounted = false; }
    }, [query]);

    return (
        <div className="w-full h-full relative">
            {thumb ? (
                <SafeImage src={thumb} alt="cover" className="w-full h-full object-cover" />
            ) : (
                <div className={`w-full h-full bg-linear-to-br ${fallbackGradient}`}></div>
            )}
            {/* Dark overlay to ensure text legibility if needed, combined with children */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
            {children}
        </div>
    );
};

// Helper component for horizontal scrolling sections with arrows
const ScrollableSection = ({ title, children }: { title: string, children: React.ReactNode }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (e: React.MouseEvent, direction: 'left' | 'right') => {
        e.preventDefault();
        e.stopPropagation();
        if (!scrollRef.current) return;

        const container = scrollRef.current;
        const scrollAmount = container.clientWidth * 0.75;
        const targetScroll = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
        const startScroll = container.scrollLeft;
        const distance = targetScroll - startScroll;
        const duration = 400;
        let startTime: number | null = null;

        const animation = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);

            // easeInOutQuad
            const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            container.scrollLeft = startScroll + distance * ease;

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        };
        requestAnimationFrame(animation);
    };

    return (
        <div className="mb-10 group/section pointer-events-auto">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-bold hover:underline cursor-pointer text-white">{title}</h2>
                <div className="flex gap-3">
                    <button
                        onClick={(e) => scroll(e, 'left')}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white transition-all z-10"
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                        }}
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="w-5 h-5 pointer-events-none" />
                    </button>
                    <button
                        onClick={(e) => scroll(e, 'right')}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white transition-all z-10"
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                        }}
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="w-5 h-5 pointer-events-none" />
                    </button>
                </div>
            </div>
            {/* Scroll Container */}
            <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto hide-scrollbar pb-4 snap-x w-full pt-4 -mt-4"
                style={{ scrollBehavior: 'auto' }}
            >
                {children}
            </div>
        </div>
    );
};

const Home = () => {
    const navigate = useNavigate();
    const likedSongs = useLibraryStore(s => s.likedSongs);
    const playlists = useLibraryStore(s => s.playlists);

    const quickItems = [
        ...(likedSongs.length > 0 ? [{
            id: 'liked',
            name: 'Liked Songs',
            thumb: null as string | null,
            gradient: 'from-indigo-600 to-blue-400',
            isLiked: true,
            songs: likedSongs,
        }] : []),
        ...playlists.map(p => ({
            id: p.id,
            name: p.name,
            thumb: p.coverUrl || p.songs[0]?.thumbnailUrl || null,
            gradient: '',
            isLiked: false,
            songs: p.songs,
        })),
    ];

    // Extract unique artists for personalized recommendations
    const likedArtists = Array.from(new Set(likedSongs.map(s => s.artist))).filter(Boolean);

    // Made For You: 12 mixes based on top liked artists (or defaults if not enough)
    const madeForYouArtists = [
        ...likedArtists,
        'Arijit Singh', 'The Weeknd', 'Taylor Swift', 'Bad Bunny', 'Drake',
        'Lana Del Rey', 'Kendrick Lamar', 'Daft Punk', 'Arctic Monkeys', 'Frank Ocean',
        'Rihanna', 'Eminem'
    ].slice(0, 12);

    // Recently Played: Next 12 artists or genres
    const recentArtists = [
        ...likedArtists.slice(5),
        'Ed Sheeran', 'Dua Lipa', 'Post Malone', 'Billie Eilish', 'Justin Bieber',
        'Bruno Mars', 'Ariana Grande', 'Coldplay', 'Imagine Dragons', 'Maroon 5',
        'Katy Perry', 'Shawn Mendes'
    ].slice(0, 12);

    return (
        <div className="p-4 md:p-6 pb-8">
            {/* Quick Access Cards Grid - Top level like reference */}
            {quickItems.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 lg:gap-4 mb-8 md:mb-10">
                    {quickItems.slice(0, 8).map(item => (
                        <div
                            key={item.id}
                            onClick={() => navigate(`/playlist/${item.id}`)}
                            className="flex items-center bg-white/4 hover:bg-white/8 backdrop-blur-2xl border border-white/5 shadow-sm hover:shadow-md rounded-md overflow-hidden h-16 group cursor-pointer transition-all duration-300"
                        >
                            <div className={`w-16 h-16 shrink-0 ${item.isLiked ? `bg-linear-to-br ${item.gradient}` : 'bg-spotify-card border-r border-white/5'} flex items-center justify-center`}>
                                {item.isLiked ? (
                                    <Heart className="w-6 h-6 text-white" fill="white" />
                                ) : item.thumb ? (
                                    <SafeImage src={item.thumb} alt={item.name} className="w-full h-full object-cover shadow-sm" />
                                ) : (
                                    <div className="w-full h-full bg-spotify-card"></div>
                                )}
                            </div>
                            <span className="flex-1 text-[15px] font-bold px-4 truncate tracking-wide text-white/95">{item.name}</span>
                            <div className="w-12 h-12 bg-[#1ed760] rounded-full items-center justify-center mr-4 shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hidden group-hover:flex hover:scale-105 hover:bg-[#1fdf64]">
                                <Play className="w-6 h-6 text-black ml-1" fill="black" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New Music Friday Section */}
            <ScrollableSection title="It's New Music Friday!">
                {[
                    { title: 'Release Radar', desc: 'Catch all the latest music from artists you follow.', grad: 'from-gray-700 to-gray-900', query: `New releases ${likedArtists[0] || 'hits'}` },
                    { title: 'New in Dance', desc: 'Beats just got hardcore with these fresh drops.', grad: 'from-orange-500 to-amber-700', query: `New dance EDM hits ${likedArtists[1] || ''}` },
                    { title: 'New Music Hindi', desc: 'Get ready to witness the sound of new Bollywood.', grad: 'from-red-600 to-rose-900', query: `New Hindi songs bollywood ${likedArtists[2] || ''}` },
                    { title: 'New Music I-Pop', desc: 'Latest music from the Indian Pop scene.', grad: 'from-purple-600 to-indigo-900', query: `Indian pop new hits ${likedArtists[3] || ''}` },
                    { title: 'New Music Punjabi', desc: 'The hottest new tracks from Punjab.', grad: 'from-emerald-600 to-teal-900', query: `Latest punjabi songs ${likedArtists[4] || ''}` },
                    { title: 'Global Top 50', desc: 'The most played tracks right now.', grad: 'from-blue-600 to-cyan-900', query: `Global top 50 playlist` },
                    { title: 'Viral Hits', desc: 'Songs making waves on the internet.', grad: 'from-pink-600 to-rose-900', query: `Viral hits songs` },
                    { title: 'Acoustic Chill', desc: 'Unwind with stripped down acoustic tracks.', grad: 'from-amber-700 to-orange-900', query: `Acoustic chill relaxing` },
                    { title: 'Workout Hype', desc: 'High energy beats for your next session.', grad: 'from-red-700 to-orange-600', query: `workout gym hype edm` }
                ].map((card, i) => (
                    <div
                        key={i}
                        onClick={() => navigate(`/discover/${encodeURIComponent(card.query)}`)}
                        className="min-w-45 w-45 xl:min-w-50 xl:w-50 bg-white/4 hover:bg-white/8 backdrop-blur-2xl border border-white/5 shadow-md hover:shadow-xl p-4 rounded-xl transition-all duration-300 cursor-pointer group shrink-0"
                    >
                        <div className="w-full aspect-square rounded-lg bg-black/20 mb-4 overflow-hidden relative shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                            <ThumbnailCard query={card.query} fallbackGradient={card.grad}>
                                <div className="absolute inset-0 flex items-end p-3 bg-linear-to-t from-black/80 via-black/20 to-transparent">
                                    <span className="font-black text-white text-xl md:text-2xl leading-tight drop-shadow-md z-10 relative">{card.title.replace('New Music ', '')}</span>
                                </div>
                                <div className="absolute bottom-2 right-2 w-12 h-12 bg-[#1ed760] rounded-full items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300 hidden group-hover:flex hover:scale-105 hover:bg-[#1fdf64] z-20">
                                    <Play className="w-6 h-6 text-black ml-1" fill="black" />
                                </div>
                            </ThumbnailCard>
                        </div>
                        <p className="text-sm text-[#a7a7a7] line-clamp-2 leading-relaxed font-medium">{card.desc}</p>
                    </div>
                ))}
            </ScrollableSection>

            {/* Made For You Section */}
            <ScrollableSection title="Made For You">
                {madeForYouArtists.map((artistName, i) => (
                    <div
                        key={i}
                        onClick={() => navigate(`/discover/${encodeURIComponent(`${artistName} mix`)}`)}
                        className="min-w-45 w-45 xl:min-w-50 xl:w-50 bg-white/4 hover:bg-white/8 backdrop-blur-2xl border border-white/5 shadow-md hover:shadow-xl p-4 rounded-xl transition-all duration-300 cursor-pointer group shrink-0"
                    >
                        <div className="w-full aspect-square rounded-lg bg-black/20 mb-4 overflow-hidden relative shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                            <ThumbnailCard
                                query={`${artistName} mix`}
                                fallbackGradient={['from-green-900 to-green-500', 'from-pink-900 to-pink-500', 'from-amber-900 to-amber-500', 'from-blue-900 to-blue-500', 'from-red-900 to-red-500'][i % 5]}
                            >
                                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                                <div className="absolute -left-2 top-2 font-black text-white/90 text-[40px] leading-none opacity-50 truncate w-full pl-4 z-10 drop-shadow-lg">{artistName.split(' ')[0]}</div>
                                <div className="absolute bottom-2 right-2 w-12 h-12 bg-[#1ed760] rounded-full items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300 hidden group-hover:flex hover:scale-105 hover:bg-[#1fdf64] z-20">
                                    <Play className="w-6 h-6 text-black ml-1" fill="black" />
                                </div>
                            </ThumbnailCard>
                        </div>
                        <p className="text-sm text-[#a7a7a7] line-clamp-2 leading-relaxed font-medium">A personalized mix filled with {artistName} and similar artists.</p>
                    </div>
                ))}
            </ScrollableSection>

            {/* Recently Played Section */}
            <ScrollableSection title="More of what you like">
                {recentArtists.map((artistName, i) => (
                    <div
                        key={i}
                        onClick={() => navigate(`/discover/${encodeURIComponent(`${artistName} best songs`)}`)}
                        className="min-w-45 w-45 xl:min-w-50 xl:w-50 bg-white/4 hover:bg-white/8 backdrop-blur-2xl border border-white/5 shadow-md hover:shadow-xl p-4 rounded-xl transition-all duration-300 cursor-pointer group shrink-0"
                    >
                        <div className="w-full aspect-square rounded-lg bg-black/20 mb-4 overflow-hidden relative shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                            <ThumbnailCard
                                query={`${artistName} best songs`}
                                fallbackGradient={['from-slate-600 to-zinc-900', 'from-lime-600 to-green-900', 'from-violet-500 to-indigo-900', 'from-cyan-600 to-blue-900', 'from-amber-500 to-yellow-900'][i % 5]}
                            >
                                <div className="absolute bottom-2 right-2 w-12 h-12 bg-[#1ed760] rounded-full items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300 hidden group-hover:flex hover:scale-105 hover:bg-[#1fdf64] z-20">
                                    <Play className="w-6 h-6 text-black ml-1" fill="black" />
                                </div>
                            </ThumbnailCard>
                        </div>
                        <p className="font-bold text-base truncate pt-1 tracking-wide text-white/95 mb-1">{artistName}</p>
                        <p className="text-sm text-[#a7a7a7] truncate font-medium">Artist</p>
                    </div>
                ))}
            </ScrollableSection>

            {/* Developer Footer */}
            <div className="mt-6 border-t border-white/5 pt-2 flex flex-col items-center justify-center text-center">
                <p className="text-[#a7a7a7] font-medium text-xs tracking-wide">
                    Developed by <a href="https://github.com/kuldipsha000-dotcom?tab=projects" target="_blank" rel="noopener noreferrer" className="text-white hover:text-spotify-green transition-colors cursor-pointer font-bold">Kuldip Sha</a>
                </p>
                <p className="text-white/30 text-[10px] font-mono tracking-widest uppercase mt-0.5">Version 1.1.0</p>
            </div>
        </div>
    );
};

export default Home;

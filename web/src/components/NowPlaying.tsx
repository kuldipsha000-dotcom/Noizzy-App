import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, ListMusic, Maximize2, Volume2, VolumeX, Plus, ListPlus, Check, Sparkles, X, Download, Loader2 } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { musicApi } from '../services/api';
import { useAudio } from '../contexts/AudioContext';

// Vivid preset palette — used as hash-based fallback when CORS fails
const PALETTE: [number, number, number][] = [
    [30, 215, 96],   // spotify green
    [235, 100, 52],  // orange
    [52, 152, 219],  // blue
    [155, 89, 182],  // purple
    [231, 76, 60],   // red
    [26, 188, 156],  // teal
    [241, 196, 15],  // yellow
    [52, 73, 94],    // dark slate
    [211, 84, 0],    // burnt orange
    [142, 68, 173],  // violet
];

// Hash a string to a palette index
function hashColor(s: string): [number, number, number] {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
}

// Try fetching an image as a Blob to get around CORS canvas-taint
async function extractColorFromUrl(url: string): Promise<[number, number, number] | null> {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 16; canvas.height = 16;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0, 16, 16);
                    const data = ctx.getImageData(0, 0, 16, 16).data;
                    let r = 0, g = 0, b = 0, count = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] < 128) continue;
                        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
                    }
                    URL.revokeObjectURL(blobUrl);
                    if (!count) { resolve(null); return; }
                    r = Math.round(r / count);
                    g = Math.round(g / count);
                    b = Math.round(b / count);
                    // Boost saturation for muted/grey tones
                    const max = Math.max(r, g, b), min = Math.min(r, g, b);
                    if (max - min < 40) {
                        // Very grey — use hash fallback instead
                        resolve(null); return;
                    }
                    // Amplify saturation
                    const avg = (r + g + b) / 3;
                    const sat = 1.5;
                    resolve([
                        Math.min(255, Math.round(avg + (r - avg) * sat)),
                        Math.min(255, Math.round(avg + (g - avg) * sat)),
                        Math.min(255, Math.round(avg + (b - avg) * sat)),
                    ]);
                } catch {
                    URL.revokeObjectURL(blobUrl);
                    resolve(null);
                }
            };
            img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
            img.src = blobUrl;
        });
    } catch {
        return null;
    }
}

const NowPlaying: React.FC<{ mobileFullscreen?: boolean; onClose?: () => void }> = ({ mobileFullscreen = false, onClose }) => {
    const audioRef = useAudio();
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
    const [showLyrics, setShowLyrics] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const handleDownload = async () => {
        if (!currentSong || isDownloading) return;
        try {
            setIsDownloading(true);
            setDownloadProgress(0);
            
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.protocol === 'app:';
            
            if (isLocal) {
                setDownloadProgress(50);
                await musicApi.downloadLocalSong({
                    videoId: currentSong.videoId,
                    title: currentSong.title,
                    artist: currentSong.artist,
                    thumbnailUrl: currentSong.thumbnailUrl
                });
                setDownloadProgress(100);
            } else {
                await musicApi.downloadSong(
                    currentSong.videoId,
                    currentSong.title,
                    (pct) => setDownloadProgress(pct)
                );
            }
            
            // Brief flash of 100% before dismissing
            setTimeout(() => {
                setIsDownloading(false);
                setDownloadProgress(0);
            }, 800);
        } catch (error) {
            console.error("Failed to download song", error);
            setIsDownloading(false);
            setDownloadProgress(0);
        }
    };
    const menuRef = useRef<HTMLDivElement>(null);
    const lyricsRef = useRef<HTMLDivElement>(null);
    const fullscreenLyricsRef = useRef<HTMLDivElement>(null);

    // Lyrics state
    const [lyrics, setLyrics] = useState<{ time: number; text: string }[] | null>(null);
    const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [activeLine, setActiveLine] = useState(-1);

    const currentSong = usePlayerStore(s => s.currentSong);
    const isPlaying = usePlayerStore(s => s.isPlaying);
    const volume = usePlayerStore(s => s.volume);
    const setIsPlaying = usePlayerStore(s => s.setIsPlaying);
    const setVolume = usePlayerStore(s => s.setVolume);
    const nextSong = usePlayerStore(s => s.nextSong);
    const previousSong = usePlayerStore(s => s.previousSong);
    const setAccentColor = usePlayerStore(s => s.setAccentColor);
    const accentColor = usePlayerStore(s => s.accentColor);
    const shuffleMode = usePlayerStore(s => s.shuffleMode);
    const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
    const loopMode = usePlayerStore(s => s.loopMode);
    const toggleLoop = usePlayerStore(s => s.toggleLoop);

    const toggleLikedSong = useLibraryStore(s => s.toggleLikedSong);
    const isLiked = useLibraryStore(s => s.isLiked);
    const playlists = useLibraryStore(s => s.playlists);
    const addSongToPlaylist = useLibraryStore(s => s.addSongToPlaylist);
    const removeSongFromPlaylist = useLibraryStore(s => s.removeSongFromPlaylist);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowPlaylistMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Sync with global audio element for time/duration/loading state
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onDurationChange = () => {
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };
        const onWaiting = () => setIsLoading(true);
        const onCanPlay = () => {
            setIsLoading(false);
            // Ensure duration is set when audio can play
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('canplay', onCanPlay);
        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('canplay', onCanPlay);
        };
    }, [audioRef.current]);

    // Reset time when song changes
    useEffect(() => {
        setCurrentTime(0);
        setDuration(0);
    }, [currentSong?.videoId]);

    // Fetch lyrics when song changes
    useEffect(() => {
        setLyrics(null);
        setPlainLyrics(null);
        setActiveLine(-1);
        if (!currentSong) return;
        setLyricsLoading(true);
        const artist = encodeURIComponent(currentSong.artist || '');
        const title = encodeURIComponent(currentSong.title || '');
        fetch(`https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}`)
            .then(r => r.json())
            .then(data => {
                if (data.syncedLyrics) {
                    // Parse LRC format: [mm:ss.xx] text
                    const lines = data.syncedLyrics.split('\n').map((line: string) => {
                        const match = line.match(/^\[(\d+):(\d+\.\d+)\](.*)$/);
                        if (!match) return null;
                        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
                        return { time, text: match[3].trim() };
                    }).filter(Boolean);
                    setLyrics(lines);
                    setPlainLyrics(null);
                } else if (data.plainLyrics) {
                    setLyrics(null);
                    setPlainLyrics(data.plainLyrics);
                } else {
                    setLyrics(null);
                    setPlainLyrics(null);
                }
            })
            .catch(() => { setLyrics(null); setPlainLyrics(null); })
            .finally(() => setLyricsLoading(false));
    }, [currentSong?.videoId]);

    // Track active lyrics line based on current playback time
    useEffect(() => {
        if (!lyrics) return;
        let idx = -1;
        for (let i = 0; i < lyrics.length; i++) {
            if (currentTime >= lyrics[i].time) idx = i;
            else break;
        }
        if (idx !== activeLine) {
            setActiveLine(idx);
            // Auto-scroll sidebar lyrics
            if (lyricsRef.current && idx >= 0) {
                const el = lyricsRef.current.querySelector(`[data-line="${idx}"]`) as HTMLElement;
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // Auto-scroll fullscreen lyrics
            if (fullscreenLyricsRef.current && idx >= 0) {
                const children = fullscreenLyricsRef.current.children;
                if (children[idx]) {
                    (children[idx] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }, [currentTime, lyrics]);

    // Extract dominant color from album art — async blob-fetch (CORS-safe) + hash fallback
    useEffect(() => {
        if (!currentSong) return;
        // Apply an instant fallback color from the song name so theme always changes
        setAccentColor(hashColor((currentSong.title || '') + (currentSong.artist || '')));
        // Then try to get a real color from the thumbnail
        if (!currentSong.thumbnailUrl) return;
        let cancelled = false;
        extractColorFromUrl(currentSong.thumbnailUrl).then(color => {
            if (!cancelled && color) setAccentColor(color);
        });
        return () => { cancelled = true; };
    }, [currentSong?.videoId]);


    // Setup Media Session API (keyboard media keys & native OS controls)
    useEffect(() => {
        if ('mediaSession' in navigator && currentSong) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentSong.title,
                artist: currentSong.artist,
                artwork: displayThumbnail ? [
                    { src: displayThumbnail, sizes: '512x512', type: 'image/jpeg' }
                ] : []
            });

            navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
            navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
            navigator.mediaSession.setActionHandler('previoustrack', () => previousSong());
            navigator.mediaSession.setActionHandler('nexttrack', () => nextSong());
        }
    }, [currentSong, setIsPlaying, nextSong, previousSong]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key) {
                case ' ':
                    e.preventDefault(); // Prevent page scroll
                    setIsPlaying(!isPlaying);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nextSong();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    previousSong();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(Math.min(1, volume + 0.05));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(Math.max(0, volume - 0.05));
                    break;
                case 'm':
                case 'M':
                    e.preventDefault();
                    // If currently muted (or very close), restore to 1 (or we could save previous volume, but 1 is easy)
                    setVolume(volume > 0 ? 0 : 1);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, volume, setIsPlaying, setVolume, nextSong, previousSong]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        if (audioRef.current && !isNaN(v)) {
            audioRef.current.currentTime = Math.max(0, Math.min(v, duration || 0));
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const fmt = (time: number | string | null | undefined) => {
        const numTime = Number(time);
        if (!numTime || isNaN(numTime)) return '0:00';
        
        const minutes = Math.floor(numTime / 60);
        const seconds = Math.floor(numTime % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const liked = currentSong ? isLiked(currentSong.videoId) : false;

    const displayThumbnail = currentSong?.thumbnailUrl || null;

    return (
        <>
        <div
            className={mobileFullscreen
                ? "w-full h-full flex flex-col overflow-y-auto hide-scrollbar"
                : "w-85 shrink-0 border-l border-white/5 flex flex-col h-full overflow-y-auto hide-scrollbar"
            }
            style={mobileFullscreen ? {
                background: `linear-gradient(180deg, rgba(${accentColor[0]},${accentColor[1]},${accentColor[2]},0.6) 0%, #0a0a0a 60%)`,
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
            } : {
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
            }}
        >
            {/* Mobile close/down button */}
            {mobileFullscreen && onClose && (
                <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Now Playing</span>
                    <div className="w-7" />
                </div>
            )}

            {currentSong ? (
                <>
                    {/* Large Album Art */}
                    <div className="px-6 pt-4 pb-2 flex justify-center">
                        <div className={`relative transition-all duration-300 ${showLyrics ? 'w-40 h-40' : 'w-52 h-52'}`}>
                            {/* Circular album art with vinyl effect */}
                            <div className={`w-full h-full rounded-full overflow-hidden border-[6px] border-white/10 shadow-2xl ${isPlaying && !isLoading ? 'album-spin' : 'album-spin paused'}`}>
                                {displayThumbnail ? (
                                    <img
                                        src={displayThumbnail}
                                        alt={currentSong.title}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // maxresdefault.jpg can 404 — fall back to hqdefault
                                            const t = e.currentTarget;
                                            if (t.src.includes('maxresdefault')) {
                                                t.src = t.src.replace('maxresdefault', 'hqdefault');
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-spotify-grey flex items-center justify-center">
                                        <ListMusic className="w-16 h-16 text-spotify-light-grey" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Song Info */}
                    <div className="px-6 text-center mb-0.5">
                        <h3 className="font-bold text-base text-white truncate">{currentSong.title}</h3>
                        <p className="text-sm text-spotify-light-grey truncate">{currentSong.artist}</p>
                    </div>

                    {/* Action Icons Row */}
                    <div className="flex items-center justify-center gap-5 px-6 mb-3 relative">
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                                className={`transition-colors ${showPlaylistMenu ? 'text-white' : 'text-spotify-light-grey hover:text-white'}`}
                                title="Add to Playlist"
                            >
                                {currentSong && playlists.some(pl => pl.songs.some(s => s.videoId === currentSong.videoId)) ? (
                                    <Check className="w-5 h-5 text-spotify-green" />
                                ) : (
                                    <Plus className="w-5 h-5" />
                                )}
                            </button>
                            
                            {/* Playlist Dropdown Menu */}
                            {showPlaylistMenu && (
                                <div 
                                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 rounded-md shadow-2xl py-1 min-w-50 z-50 border border-white/10 max-h-48 sm:max-h-64 overflow-y-auto"
                                    style={{
                                        background: 'rgba(30, 30, 30, 0.65)',
                                        backdropFilter: 'blur(24px)',
                                        WebkitBackdropFilter: 'blur(24px)',
                                    }}
                                >
                                    <div className="px-3 py-2 text-xs text-spotify-light-grey font-semibold uppercase tracking-wider border-b border-spotify-grey/30">
                                        Add to playlist
                                    </div>
                                    {playlists.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-spotify-light-grey">
                                            No playlists yet
                                        </div>
                                    ) : (
                                        playlists.map(pl => {
                                            const isInPlaylist = currentSong && pl.songs.some(s => s.videoId === currentSong.videoId);
                                            return (
                                                <button
                                                    key={pl.id}
                                                    onClick={() => {
                                                        if (currentSong) {
                                                            if (isInPlaylist) {
                                                                removeSongFromPlaylist(pl.id, currentSong.videoId);
                                                            } else {
                                                                addSongToPlaylist(pl.id, currentSong);
                                                            }
                                                        }
                                                        setShowPlaylistMenu(false);
                                                    }}
                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors text-left"
                                                >
                                                    {isInPlaylist ? (
                                                        <Check className="w-4 h-4 text-spotify-green shrink-0" />
                                                    ) : (
                                                        <ListPlus className="w-4 h-4 text-spotify-light-grey shrink-0" />
                                                    )}
                                                    <span className="truncate">{isInPlaylist ? `Remove from ` : `Add to `}<span className="font-semibold">{pl.name}</span></span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Download button with circular progress ring */}
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="relative transition-colors text-spotify-light-grey hover:text-white disabled:opacity-70"
                                title="Download Song"
                            >
                                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                {isDownloading && (
                                    <svg className="absolute -inset-1 w-7 h-7" viewBox="0 0 28 28" fill="none">
                                        <circle cx="14" cy="14" r="12" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
                                        <circle
                                            cx="14" cy="14" r="12"
                                            stroke="#1ed760"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 12}`}
                                            strokeDashoffset={`${2 * Math.PI * 12 * (1 - downloadProgress / 100)}`}
                                            transform="rotate(-90 14 14)"
                                            className="transition-all duration-300"
                                        />
                                    </svg>
                                )}
                            </button>

                            <button
                                onClick={() => toggleLikedSong(currentSong)}
                                className={`transition-colors ${liked ? 'text-spotify-green' : 'text-spotify-light-grey hover:text-white'}`}
                                title="Like Song"
                            >
                                <Heart className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} />
                            </button>
                        </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="px-6 flex items-center justify-center gap-5 mb-2">
                        <button 
                            onClick={toggleShuffle} 
                            className={`relative transition-colors ${shuffleMode !== 'off' ? 'text-spotify-green' : 'text-spotify-light-grey hover:text-white'}`}
                            title={`Shuffle: ${shuffleMode}`}
                        >
                            <Shuffle className="w-4 h-4" />
                            {shuffleMode === 'normal' && (
                                <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center justify-center">
                                    <div className="h-1 w-1 rounded-full bg-spotify-green"></div>
                                </div>
                            )}
                            {shuffleMode === 'smart' && (
                                <>
                                    <Sparkles className="absolute -top-1 -right-1 w-2.5 h-2.5 text-spotify-green fill-spotify-green" />
                                    <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center justify-center">
                                        <div className="h-1 w-1 rounded-full bg-spotify-green"></div>
                                    </div>
                                </>
                            )}
                        </button>
                        <button onClick={previousSong} className="text-white hover:scale-110 transition-transform">
                            <SkipBack className="w-5 h-5" fill="white" />
                        </button>
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            disabled={isLoading}
                            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            ) : isPlaying ? (
                                <Pause className="w-5 h-5" fill="black" />
                            ) : (
                                <Play className="w-5 h-5 ml-0.5" fill="black" />
                            )}
                        </button>
                        <button onClick={nextSong} className="text-white hover:scale-110 transition-transform">
                            <SkipForward className="w-5 h-5" fill="white" />
                        </button>
                        <button 
                            onClick={toggleLoop} 
                            className={`transition-colors ${loopMode !== 'off' ? 'text-spotify-green' : 'text-spotify-light-grey hover:text-white'}`}
                            title={`Repeat: ${loopMode}`}
                        >
                            {loopMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                            {loopMode !== 'off' && (
                                <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center justify-center">
                                    <div className="h-1 w-1 rounded-full bg-spotify-green"></div>
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="px-6 flex items-center gap-2 mb-4">
                        <span className="text-[10px] text-spotify-light-grey w-8 text-right tabular-nums">{fmt(currentTime)}</span>
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="progress-bar flex-1"
                            style={{
                                background: `linear-gradient(to right, white ${(currentTime / (duration || 100)) * 100}%, rgba(255,255,255,0.2) 0%)`
                            }}
                        />
                        <span className="text-[10px] text-spotify-light-grey w-8 tabular-nums">{fmt(duration)}</span>
                    </div>

                    {/* Bottom Controls Row */}
                    <div className="px-6 flex items-center justify-center gap-4 mb-4">
                        <button 
                            onClick={() => setShowLyrics(!showLyrics)}
                            className={`transition-colors ${showLyrics ? 'text-white' : 'text-spotify-light-grey hover:text-white'}`}
                            title="Toggle Lyrics"
                        >
                            <ListMusic className="w-4 h-4" />
                        </button>
                        <button className="text-spotify-light-grey hover:text-white transition-colors"
                            onClick={() => setIsFullscreen(true)}
                            title="Fullscreen"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setVolume(volume > 0 ? 0 : 1)}
                            className="text-spotify-light-grey hover:text-white transition-colors"
                        >
                            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="volume-bar w-20"
                            style={{
                                background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) 0%)`
                            }}
                        />
                    </div>

                    {showLyrics && (
                    <div className="px-5 pb-4 flex-1 min-h-0">
                        <div className="h-px bg-white/10 mb-3" />
                        <p className="text-xs font-bold uppercase text-white/40 tracking-widest mb-3 text-center">Lyrics</p>
                        <div ref={lyricsRef} className="overflow-y-auto max-h-44 hide-scrollbar space-y-1">
                            {lyricsLoading ? (
                                <p className="text-center text-white/30 text-sm py-6 animate-pulse">Fetching lyrics…</p>
                            ) : lyrics ? (
                                lyrics.map((line, i) => (
                                    <p
                                        key={i}
                                        data-line={i}
                                        className={`text-center text-sm transition-all duration-300 leading-relaxed py-0.5 ${
                                            i === activeLine
                                                ? 'text-white font-bold text-[15px] scale-105 origin-center'
                                                : i < activeLine
                                                ? 'text-white/30'
                                                : 'text-white/50'
                                        }`}
                                    >
                                        {line.text || '\u266a'}
                                    </p>
                                ))
                            ) : plainLyrics ? (
                                <div className="text-center text-sm text-white/60 leading-relaxed whitespace-pre-line">{plainLyrics}</div>
                            ) : (
                                <p className="text-center text-white/25 text-sm py-6">No lyrics found</p>
                            )}
                        </div>
                    </div>
                    )}
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-spotify-light-grey px-6">
                    <ListMusic className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-sm text-center opacity-60">Select a song to start playing</p>
                </div>
            )}
        </div>

        {/* ── FULLSCREEN OVERLAY ── */}
        {isFullscreen && currentSong && (
            <div
                className="fixed inset-0 z-200 flex flex-col md:flex-row items-stretch transition-all duration-500 overflow-y-auto md:overflow-hidden"
                style={{ 
                    background: `radial-gradient(ellipse 120% 100% at 30% 40%, rgb(${accentColor[0]},${accentColor[1]},${accentColor[2]}) 0%, #0a0a0a 85%)`,
                }}
            >
                {/* Dark tint overlay — same as home page ambient effect */}
                <div className="absolute inset-0 bg-black/55 pointer-events-none" />

                {/* Close button */}
                <button
                    onClick={() => setIsFullscreen(false)}
                    className="absolute top-4 right-4 md:top-6 md:right-6 z-10 text-white/60 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6 md:w-7 md:h-7" />
                </button>

                {/* Center: Spinning Record */}
                <div className="flex-1 flex flex-col items-center justify-center py-6 md:py-0">
                    <div className="relative">
                        {/* Outer vinyl ring */}
                        <div className="w-48 h-48 md:w-72 md:h-72 rounded-full bg-black/30 flex items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.6)]">
                            <div className={`w-44 h-44 md:w-64 md:h-64 rounded-full overflow-hidden border-[6px] border-white/10 shadow-2xl ${isPlaying && !isLoading ? 'album-spin' : 'album-spin paused'}`}>
                                {displayThumbnail ? (
                                    <img src={displayThumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center" style={{ background: `rgba(0,0,0,0.4)` }}>
                                        <ListMusic className="w-12 h-12 md:w-20 md:h-20 text-white/30" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mobile Lyrics - 2-3 lines between thumbnail and player */}
                    {lyrics && lyrics.length > 0 && activeLine >= 0 && (
                    <div className="md:hidden mt-6 w-full px-8 h-20 flex flex-col items-center justify-center">
                        <div className="space-y-1 text-center w-full overflow-hidden">
                            {[activeLine - 1, activeLine, activeLine + 1].map((lineIdx) => {
                                if (lineIdx < 0 || lineIdx >= lyrics.length) return null;
                                const line = lyrics[lineIdx];
                                return (
                                    <p
                                        key={lineIdx}
                                        className={`text-sm transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis ${
                                            lineIdx === activeLine
                                                ? 'text-white font-bold text-base scale-105'
                                                : 'text-white/40'
                                        }`}
                                    >
                                        {line.text || '♪'}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                    )}
                </div>

                {/* Bottom/Right: Song info + Lyrics */}
                <div className="flex-1 flex flex-col justify-center px-4 md:pr-16 md:pl-8 py-4 md:py-0 w-full md:max-w-[50%]">
                    {/* Song title & artist */}
                    <div className="mb-4 md:mb-6 text-center md:text-left">
                        <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-1 drop-shadow-lg">{currentSong.title}</h1>
                        <p className="text-white/70 text-base md:text-xl font-medium">{currentSong.artist}</p>
                    </div>

                    {/* Lyrics - Hidden on mobile, shown on desktop */}
                    <div ref={fullscreenLyricsRef} className="hidden md:flex overflow-y-auto hide-scrollbar max-h-[55vh] space-y-2 text-center w-full px-4 flex-col">
                        {lyricsLoading ? (
                            <p className="text-white/40 text-lg animate-pulse">Fetching lyrics…</p>
                        ) : lyrics ? (
                            lyrics.map((line, i) => (
                                <p
                                    key={i}
                                    className={`text-2xl leading-snug transition-all duration-300 ${
                                        i === activeLine
                                            ? 'text-white font-bold scale-105 origin-center'
                                            : i < activeLine
                                            ? 'text-white/30'
                                            : 'text-white/60'
                                    }`}
                                    style={i === activeLine ? {
                                        textShadow: `0 0 20px rgba(${accentColor[0]},${accentColor[1]},${accentColor[2]},0.9), 0 0 40px rgba(${accentColor[0]},${accentColor[1]},${accentColor[2]},0.5), 0 0 8px rgba(255,255,255,0.8)`
                                    } : undefined}
                                >
                                    {line.text || '♪'}
                                </p>
                            ))
                        ) : plainLyrics ? (
                            <div className="text-2xl text-white/70 leading-relaxed whitespace-pre-line text-center">{plainLyrics}</div>
                        ) : (
                            <p className="text-white/30 text-xl">No lyrics found</p>
                        )}
                    </div>

                    {/* Progress + controls */}
                    <div className="mt-4 md:mt-8 space-y-2 md:space-y-3">
                        <div className="flex items-center gap-2 md:gap-3">
                            <span className="text-white/50 text-xs md:text-sm tabular-nums">{fmt(currentTime)}</span>
                            <input
                                type="range" min={0} max={duration || 100} value={currentTime}
                                onChange={handleSeek}
                                className="progress-bar flex-1"
                                style={{ background: `linear-gradient(to right, white ${(currentTime / (duration || 100)) * 100}%, rgba(255,255,255,0.2) 0%)` }}
                            />
                            <span className="text-white/50 text-xs md:text-sm tabular-nums">{fmt(duration)}</span>
                        </div>
                        <div className="flex items-center justify-center gap-4 md:gap-8">
                            {/* Fullscreen download button with circular ring */}
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="relative text-white/80 hover:text-white transition-all disabled:opacity-70"
                                title="Download Song"
                            >
                                {isDownloading ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <Download className="w-5 h-5 md:w-6 md:h-6" />}
                                {isDownloading && (
                                    <svg className="absolute -inset-1.5 w-8 h-8 md:w-9 md:h-9" viewBox="0 0 36 36" fill="none">
                                        <circle cx="18" cy="18" r="16" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
                                        <circle
                                            cx="18" cy="18" r="16"
                                            stroke="#1ed760"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 16}`}
                                            strokeDashoffset={`${2 * Math.PI * 16 * (1 - downloadProgress / 100)}`}
                                            transform="rotate(-90 18 18)"
                                            className="transition-all duration-300"
                                        />
                                    </svg>
                                )}
                            </button>
                            <button onClick={previousSong} className="text-white/80 hover:text-white hover:scale-110 transition-all"><SkipBack className="w-5 h-5 md:w-7 md:h-7" fill="white" /></button>
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                disabled={isLoading}
                                className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 shadow-lg"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : isPlaying ? (
                                    <Pause className="w-5 h-5 md:w-7 md:h-7" fill="black" />
                                ) : (
                                    <Play className="w-5 h-5 md:w-7 md:h-7 ml-0.5" fill="black" />
                                )}
                            </button>
                            <button onClick={nextSong} className="text-white/80 hover:text-white hover:scale-110 transition-all"><SkipForward className="w-5 h-5 md:w-7 md:h-7" fill="white" /></button>
                            <button 
                                onClick={toggleLoop} 
                                className={`relative transition-colors ${loopMode !== 'off' ? 'text-spotify-green' : 'text-white/80 hover:text-white'}`}
                                title={`Repeat: ${loopMode}`}
                            >
                                {loopMode === 'one' ? <Repeat1 className="w-5 h-5 md:w-6 md:h-6" /> : <Repeat className="w-5 h-5 md:w-6 md:h-6" />}
                                {loopMode !== 'off' && (
                                    <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center justify-center">
                                        <div className="h-1.5 w-1.5 rounded-full bg-spotify-green"></div>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default NowPlaying;

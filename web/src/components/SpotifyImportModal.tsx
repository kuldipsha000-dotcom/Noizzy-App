import { useState, useRef, useEffect } from 'react';
import { X, Music, Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { spotifyApi, musicApi, normalizeSong } from '../services/api';
import type { SpotifyTrackData } from '../services/api';
import { useLibraryStore } from '../store/libraryStore';

interface Props {
    onClose: () => void;
}

type Step = 'input' | 'preview' | 'importing' | 'done' | 'error';

const LOADING_MESSAGES = [
    "Matching to YouTube Music...",
    "Please be patient, finding the perfect matches...",
    "You have a really nice music taste! 🎵",
    "I like your songs in this playlist! 🔥",
    "Wow, what an amazing playlist! 😍",
    "Searching the depths of YouTube for these gems 💎",
    "Your music choices are absolutely top-notch! 👌",
    "Importing your favorite tracks securely...",
    "Good vibes loading... ✨",
    "Just a little bit more time... ⏳",
    "These songs are pure fire! 🔥🔥",
    "Ensuring you get the best audio quality...",
    "Listening to these songs will definitely set the mood! 🎧",
    "Syncing your vibe to our servers...",
    "Just a few more songs left to match...",
    "Your songs are being imported safely 🛡️",
    "Setting up the perfect playback experience...",
    "Almost there, finalizing the touches... 🪄",
    "Thanks for waiting, almost done! 🙏"
];

const SpotifyImportModal = ({ onClose }: Props) => {
    const [step, setStep] = useState<Step>('input');
    const [url, setUrl] = useState('');
    const [playlistName, setPlaylistName] = useState('');
    const [tracks, setTracks] = useState<SpotifyTrackData[]>([]);
    const [playlistCover, setPlaylistCover] = useState<string | undefined>(undefined);
    const [errorMsg, setErrorMsg] = useState('');
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [messageIndex, setMessageIndex] = useState(0);

    const { createPlaylist, addSongToPlaylist } = useLibraryStore();
    const abortRef = useRef(false);

    // Increment message every 3.5 seconds while importing
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (step === 'importing') {
            interval = setInterval(() => {
                setMessageIndex(prev => {
                    const next = prev + 1;
                    return next >= LOADING_MESSAGES.length ? prev : next;
                });
            }, 3500);
        }
        return () => clearInterval(interval);
    }, [step]);

    const handleFetch = async () => {
        if (!url.trim()) return;
        setStep('preview');
        setErrorMsg('');
        try {
            const result = await spotifyApi.importPlaylist(url.trim());
            setPlaylistName(result.playlistName);
            setPlaylistCover(result.coverArt);
            setTracks(result.tracks);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch playlist';
            setErrorMsg(message.includes('400') ? 'Invalid Spotify playlist URL' : message.includes('credentials') ? 'Spotify API credentials not configured in server .env file.' : message);
            setStep('error');
        }
    };

    const handleImport = async () => {
        setStep('importing');
        setMessageIndex(0); // Reset messages
        abortRef.current = false;
        setImportProgress({ current: 0, total: tracks.length });

        // Create the playlist first
        const pl = createPlaylist(playlistName, `Imported from Spotify`, playlistCover);

        for (let i = 0; i < tracks.length; i++) {
            if (abortRef.current) break;
            const track = tracks[i];
            try {
                // Search YouTube Music for matching track
                const searchQuery = `${track.title} ${track.artist}`;
                const results = await musicApi.search(searchQuery);
                if (results && results.length > 0) {
                    const song = normalizeSong(results[0]);
                    addSongToPlaylist(pl.id, song);
                }
            } catch {
                // Skip song if not found
            }
            setImportProgress({ current: i + 1, total: tracks.length });
        }

        setStep('done');
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
                style={{
                    background: 'rgba(20, 20, 20, 0.85)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center">
                            <Music className="w-4 h-4 text-black" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Import from Spotify</h2>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5">
                    {/* Step: Input URL */}
                    {step === 'input' && (
                        <div className="space-y-5">
                            <p className="text-sm text-white/60">
                                Paste any public Spotify playlist link and we'll import it, matching each song to YouTube Music automatically.
                            </p>
                            <div>
                                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Spotify Playlist URL</label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleFetch()}
                                    placeholder="https://open.spotify.com/playlist/..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#1DB954]/50 placeholder-white/30 transition-colors"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleFetch}
                                disabled={!url.trim()}
                                className="w-full py-3 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Fetch Playlist
                            </button>
                        </div>
                    )}

                    {/* Step: Loading */}
                    {step === 'preview' && tracks.length === 0 && !errorMsg && (
                        <div className="py-12 flex flex-col items-center gap-4">
                            <Loader2 className="w-10 h-10 text-[#1DB954] animate-spin" />
                            <p className="text-white/60 text-sm">Fetching playlist from Spotify...</p>
                        </div>
                    )}

                    {/* Step: Preview tracks */}
                    {step === 'preview' && tracks.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-white">{playlistName}</h3>
                                    <p className="text-xs text-white/50 mt-0.5">{tracks.length} songs found</p>
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-1 hide-scrollbar rounded-xl">
                                {tracks.slice(0, 50).map((track, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {track.albumArt ? (
                                                <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <Music className="w-4 h-4 text-white/40" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white truncate">{track.title}</div>
                                            <div className="text-xs text-white/50 truncate">{track.artist}</div>
                                        </div>
                                    </div>
                                ))}
                                {tracks.length > 50 && (
                                    <div className="text-center text-xs text-white/40 py-2">+ {tracks.length - 50} more songs</div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setStep('input'); setTracks([]); }}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all text-sm"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleImport}
                                    className="flex-1 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Import All
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Importing */}
                    {step === 'importing' && (
                        <div className="py-8 space-y-5">
                            <div className="flex flex-col items-center gap-3 text-center px-4">
                                <Loader2 className="w-10 h-10 text-[#1DB954] animate-spin" />
                                <p className="text-white font-semibold flex items-center gap-2">Importing songs</p>
                                <p 
                                    key={messageIndex} 
                                    className="text-white/50 text-sm h-5 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2"
                                >
                                    {LOADING_MESSAGES[messageIndex]}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-white/50">
                                    <span>{importProgress.current} of {importProgress.total}</span>
                                    <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-[#1DB954] rounded-full transition-all duration-300"
                                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step: Done */}
                    {step === 'done' && (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <CheckCircle2 className="w-14 h-14 text-[#1DB954]" />
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">Import Complete!</h3>
                                <p className="text-sm text-white/50 mt-1">
                                    "{playlistName}" has been added to your library
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold rounded-full transition-all hover:scale-[1.02]"
                            >
                                Go to Library
                            </button>
                        </div>
                    )}

                    {/* Step: Error */}
                    {step === 'error' && (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <AlertCircle className="w-14 h-14 text-red-400" />
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">Something went wrong</h3>
                                <p className="text-sm text-red-300/80 mt-1 max-w-sm">{errorMsg}</p>
                            </div>
                            <button
                                onClick={() => { setStep('input'); setErrorMsg(''); }}
                                className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SpotifyImportModal;

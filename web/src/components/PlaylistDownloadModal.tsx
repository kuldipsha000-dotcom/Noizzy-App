import React from 'react';
import { X, Download, CheckSquare, Square, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import SafeImage from './SafeImage';
import { useDownloadStore } from '../store/downloadStore';

const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isFSASupported = () => {
    if (typeof window === 'undefined') return false;
    if (isMobile()) return false; // Don't use FSA on mobile
    return 'showDirectoryPicker' in window;
};

const PlaylistDownloadModal: React.FC = () => {
    const {
        showModal,
        status,
        playlistName,
        coverUrl,
        songs,
        checked,
        currentIndex,
        progress,
        results,
        activeDownloads,
        completedCount,
        closeModal,
        setChecked,
        cancelDownload,
        startDownload
    } = useDownloadStore();

    if (!showModal) return null;

    const total = songs.filter(s => checked.has(s.videoId));

    const toggleAll = () => {
        if (checked.size === songs.length) {
            setChecked(new Set());
        } else {
            setChecked(new Set(songs.map(s => s.videoId)));
        }
    };

    const toggleOne = (videoId: string) => {
        setChecked(prev => {
            const next = new Set(prev);
            next.has(videoId) ? next.delete(videoId) : next.add(videoId);
            return next;
        });
    };

    const failedCount = results.filter(r => !r.success).length;
    const successCount = results.filter(r => r.success).length;
    const isDownloading = status === 'downloading' || status === 'picking-folder';

    const fmtDuration = (dur?: string) => {
        if (!dur) return '';
        const s = parseInt(dur);
        if (isNaN(s)) return '';
        return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    };

    return (
        <div
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-300"
            onClick={e => { if (!isDownloading && e.target === e.currentTarget) closeModal(); }}
        >
            <div
                className="relative w-[95vw] md:w-[560px] max-h-[90vh] md:max-h-[85vh] flex flex-col rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
                style={{
                    background: 'rgba(20, 20, 20, 0.65)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
                }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 flex-shrink-0">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-spotify-grey shadow-lg ring-1 ring-white/10">
                        {coverUrl
                            ? <SafeImage src={coverUrl} alt={playlistName} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-700" />
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-xs text-white/50 uppercase font-semibold tracking-wider mb-0.5">Download Playlist</p>
                        <h2 className="text-lg md:text-xl font-bold text-white truncate">{playlistName}</h2>
                        <p className="text-xs md:text-sm text-white/50">{songs.length} songs</p>
                    </div>
                    <button onClick={closeModal} title="Minimize to background" className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex-shrink-0">
                        <X className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>

                <div className="h-px bg-white/10 mx-4 md:mx-6" />

                {/* Not Supported */}
                {!isFSASupported() && !isMobile() ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-8 md:py-10 px-6 md:px-8 text-center">
                        <AlertTriangle className="w-8 md:w-10 h-8 md:h-10 text-yellow-400" />
                        <p className="text-white font-semibold text-base md:text-lg">Browser Not Supported</p>
                        <p className="text-white/50 text-xs md:text-sm leading-relaxed">
                            Your browser doesn't support direct folder download.<br />
                            Please use <span className="text-white font-semibold">Chrome</span>, <span className="text-white font-semibold">Brave</span>, or <span className="text-white font-semibold">Edge</span>.
                        </p>
                        <button onClick={closeModal} className="mt-3 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs md:text-sm text-white transition-colors">
                            Close
                        </button>
                    </div>
                ) : (status === 'done' || status === 'cancelled') ? (
                    /* Done / Cancelled summary */
                    <div className="flex flex-col items-center justify-center gap-3 py-8 md:py-10 px-6 md:px-8 text-center">
                        {status === 'done' && failedCount === 0 ? (
                            <>
                                <CheckCircle2 className="w-10 md:w-12 h-10 md:h-12 text-spotify-green drop-shadow-[0_0_15px_rgba(29,185,84,0.5)]" />
                                <p className="text-white font-bold text-lg md:text-xl">All songs downloaded!</p>
                                <p className="text-white/60 text-xs md:text-sm">{successCount} song{successCount !== 1 ? 's' : ''} saved</p>
                            </>
                        ) : status === 'cancelled' ? (
                            <>
                                <AlertTriangle className="w-8 md:w-10 h-8 md:h-10 text-yellow-500" />
                                <p className="text-white font-bold text-lg md:text-xl">Download cancelled</p>
                                <p className="text-white/60 text-xs md:text-sm">{successCount} song{successCount !== 1 ? 's' : ''} saved before cancellation</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-10 md:w-12 h-10 md:h-12 text-spotify-green drop-shadow-[0_0_15px_rgba(29,185,84,0.5)]" />
                                <p className="text-white font-bold text-lg md:text-xl">Download complete</p>
                                <p className="text-white/60 text-xs md:text-sm">
                                    <span className="text-spotify-green font-semibold">{successCount} downloaded</span>
                                    {failedCount > 0 && <> · <span className="text-red-400 font-semibold">{failedCount} failed</span></>}
                                </p>
                                {failedCount > 0 && (
                                    <div className="w-full mt-2 max-h-40 overflow-y-auto rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-left">
                                        <p className="text-xs text-red-400 font-semibold mb-2 uppercase tracking-wide">Failed songs:</p>
                                        <div className="space-y-1">
                                            {results.filter(r => !r.success).map(r => {
                                                const song = songs.find(s => s.videoId === r.videoId);
                                                return (
                                                    <div key={r.videoId} className="flex items-center gap-2">
                                                        <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                        <span className="text-xs text-white/70 truncate">
                                                            {song ? `${song.title} — ${song.artist}` : r.videoId}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <button
                            onClick={closeModal}
                            className="mt-4 md:mt-6 px-6 md:px-8 py-2 md:py-2.5 bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-xs md:text-sm rounded-full hover:scale-105 transition-all shadow-lg"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Song List */}
                        <div className="flex-1 overflow-y-auto hide-scrollbar px-2 py-3">
                            {!isDownloading && (
                                <div
                                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/10 rounded-xl mx-2 mb-2 transition-colors group"
                                    onClick={toggleAll}
                                >
                                    {checked.size === songs.length
                                        ? <CheckSquare className="w-4 h-4 text-spotify-green flex-shrink-0 drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />
                                        : <Square className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors flex-shrink-0" />
                                    }
                                    <span className="text-xs md:text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                                        {checked.size === songs.length ? 'Deselect all' : 'Select all'}
                                    </span>
                                    <span className="ml-auto text-[10px] md:text-xs font-semibold text-white/40 bg-white/5 py-1 px-2 md:px-2.5 rounded-full">{checked.size} selected</span>
                                </div>
                            )}

                            <div className="space-y-1">
                                {(isDownloading ? songs.filter(s => checked.has(s.videoId)) : songs).map((song, idx) => {
                                    const isChecked = checked.has(song.videoId);
                                    // If downloading, arr is already filtered, so idx + 1 matches currentIndex exactly
                                    const isCurrentlyDownloading = isDownloading && currentIndex === idx + 1;
                                    const result = results.find(r => r.videoId === song.videoId);

                                    return (
                                        <div
                                            key={song.videoId}
                                            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl mx-2 transition-all ${
                                                !isDownloading ? 'cursor-pointer hover:bg-white/10' : ''
                                            } ${isCurrentlyDownloading ? 'bg-white/10 ring-1 ring-white/10' : ''}`}
                                            onClick={() => !isDownloading && toggleOne(song.videoId)}
                                        >
                                            <div className="w-4 flex-shrink-0 flex justify-center text-xs">
                                                {isDownloading ? (
                                                    result?.success
                                                        ? <CheckCircle2 className="w-4 h-4 text-spotify-green drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />
                                                        : result && !result.success
                                                        ? <X className="w-4 h-4 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]" />
                                                        : isCurrentlyDownloading
                                                        ? <Loader2 className="w-4 h-4 text-spotify-green animate-spin" />
                                                        : <div className="w-4 h-4 rounded-full border border-white/20" />
                                                ) : (
                                                    isChecked
                                                        ? <CheckSquare className="w-4 h-4 text-spotify-green drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" />
                                                        : <Square className="w-4 h-4 text-white/30" />
                                                )}
                                            </div>

                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-white/5 overflow-hidden flex-shrink-0 shadow-sm border border-white/5">
                                                {song.thumbnailUrl && (
                                                    <SafeImage src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className={`text-xs md:text-sm font-semibold truncate transition-colors ${
                                                    isCurrentlyDownloading ? 'text-spotify-green' : isChecked || isDownloading ? 'text-white' : 'text-white/40'
                                                }`}>
                                                    {song.title}
                                                </div>
                                                <div className="text-[10px] md:text-xs text-white/40 truncate">{song.artist}</div>
                                                {isCurrentlyDownloading && (
                                                    <div className="mt-1.5 h-1 rounded-full bg-black/40 overflow-hidden w-full ring-1 ring-white/10">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-spotify-green to-[#1ed760] rounded-full transition-all duration-300"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <span className="text-[10px] md:text-xs font-medium text-white/30 flex-shrink-0 font-mono">
                                                {fmtDuration(song.duration)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Downloads Panel — shows all 3 parallel slots */}
                        {isDownloading && (
                            <div className="px-4 md:px-6 py-3 md:py-4 bg-gradient-to-t from-black/60 to-black/20 border-t border-white/10 flex-shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Downloading</span>
                                    <span className="font-mono bg-spotify-green/20 px-3 py-1 rounded-full text-xs font-bold text-spotify-green">
                                        {completedCount} / {total.length}
                                    </span>
                                </div>
                                {/* Total progress bar */}
                                <div className="h-1.5 rounded-full bg-black/70 overflow-hidden ring-1 ring-white/20 mb-3">
                                    <div
                                        className="h-full bg-gradient-to-r from-spotify-green to-[#1ed760] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(29,185,84,0.6)]"
                                        style={{ width: `${(completedCount / total.length) * 100}%` }}
                                    />
                                </div>
                                {/* Active slot rows */}
                                <div className="space-y-1.5">
                                    {activeDownloads.size === 0 ? (
                                        <div className="flex items-center gap-2 text-white/30 text-xs">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Starting downloads...</span>
                                        </div>
                                    ) : (
                                        Array.from(activeDownloads.entries()).map(([vid, title]) => (
                                            <div key={vid} className="flex items-center gap-2">
                                                <Loader2 className="w-3.5 h-3.5 text-spotify-green animate-spin flex-shrink-0" />
                                                <span className="text-xs text-white/80 truncate">{title}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-end gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 border-t border-white/10 flex-shrink-0 bg-white/5">
                            <button
                                onClick={isDownloading ? cancelDownload : closeModal}
                                className="w-full md:w-auto px-4 md:px-5 py-2.5 text-sm font-semibold text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
                            >
                                {isDownloading ? 'Cancel Download' : 'Cancel'}
                            </button>
                            {!isDownloading && (
                                <button
                                    onClick={startDownload}
                                    disabled={total.length === 0}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-sm rounded-full hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100 shadow-[0_4px_14px_rgba(29,185,84,0.4)]"
                                >
                                    <Download className="w-4 h-4 flex-shrink-0" />
                                    Download ({total.length})
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PlaylistDownloadModal;

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useAudio } from '../contexts/AudioContext';

const MiniPlayer: React.FC = () => {
    const audioRef = useAudio();
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const currentSong = usePlayerStore(s => s.currentSong);
    const isPlaying = usePlayerStore(s => s.isPlaying);
    const setIsPlaying = usePlayerStore(s => s.setIsPlaying);
    const nextSong = usePlayerStore(s => s.nextSong);
    const setMobileNowPlayingOpen = usePlayerStore(s => s.setMobileNowPlayingOpen);

    // Listen to the global audio element for time/duration updates
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onDurationChange = () => audio.duration && setDuration(audio.duration);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('durationchange', onDurationChange);
        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('durationchange', onDurationChange);
        };
    }, [audioRef.current]);

    if (!currentSong) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        /* Mini player bar — above bottom nav, only on mobile */
        <div
            className="fixed bottom-[60px] left-0 right-0 z-[79] md:hidden"
            style={{
                background: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
        >
            {/* Progress bar */}
            <div className="w-full h-0.5 bg-white/10">
                <div
                    className="h-full bg-white/60 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Content */}
            <div
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                onClick={() => setMobileNowPlayingOpen(true)}
            >
                {/* Thumbnail */}
                {currentSong.thumbnailUrl ? (
                    <img
                        src={currentSong.thumbnailUrl}
                        alt={currentSong.title}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                ) : (
                    <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0" />
                )}

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{currentSong.title}</p>
                    <p className="text-white/50 text-xs truncate">{currentSong.artist}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-8 h-8 flex items-center justify-center text-white"
                    >
                        {isPlaying
                            ? <Pause className="w-5 h-5" fill="white" />
                            : <Play className="w-5 h-5 ml-0.5" fill="white" />
                        }
                    </button>
                    <button
                        onClick={() => nextSong()}
                        className="w-8 h-8 flex items-center justify-center text-white/70"
                    >
                        <SkipForward className="w-5 h-5" fill="currentColor" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MiniPlayer;

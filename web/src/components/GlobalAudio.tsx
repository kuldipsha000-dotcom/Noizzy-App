import { useRef, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { musicApi } from '../services/api';
import { AudioContext } from '../contexts/AudioContext';

/**
 * GlobalAudio wraps one <audio> element and exposes it via AudioContext.
 * All components (NowPlaying, MiniPlayer) read from this single ref.
 */
const GlobalAudio = ({ children }: { children: React.ReactNode }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    const currentSong = usePlayerStore(s => s.currentSong);
    const isPlaying = usePlayerStore(s => s.isPlaying);
    const volume = usePlayerStore(s => s.volume);
    const loopMode = usePlayerStore(s => s.loopMode);
    const setIsPlaying = usePlayerStore(s => s.setIsPlaying);
    const nextSong = usePlayerStore(s => s.nextSong);

    // Load song when it changes
    useEffect(() => {
        if (currentSong && audioRef.current) {
            const url = (currentSong as any).isOffline && (currentSong as any).filename
                ? musicApi.getLocalStreamUrl((currentSong as any).filename)
                : musicApi.getStreamUrl(currentSong.videoId);
            audioRef.current.src = url;
            audioRef.current.load();
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(() => {});
        }
    }, [currentSong?.videoId]);

    // Sync play/pause
    useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.play().catch(() => {});
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying]);

    // Sync volume
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    return (
        <AudioContext.Provider value={audioRef}>
            <audio
                ref={audioRef}
                preload="auto"
                onEnded={() => {
                    if (loopMode === 'one' && audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(() => {});
                    } else {
                        nextSong();
                    }
                }}
                onError={() => setIsPlaying(false)}
            />
            {children}
        </AudioContext.Provider>
    );
};

export default GlobalAudio;

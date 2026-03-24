import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { musicApi } from '../services/api';

const Player: React.FC = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentSong = usePlayerStore(state => state.currentSong);
    const isPlaying = usePlayerStore(state => state.isPlaying);
    const volume = usePlayerStore(state => state.volume);
    const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
    const setVolume = usePlayerStore(state => state.setVolume);
    const nextSong = usePlayerStore(state => state.nextSong);
    const previousSong = usePlayerStore(state => state.previousSong);
    const shuffleMode = usePlayerStore(state => state.shuffleMode);
    const toggleShuffle = usePlayerStore(state => state.toggleShuffle);

    // Update audio source when current song changes
    useEffect(() => {
        if (currentSong && audioRef.current) {
            const streamUrl = musicApi.getStreamUrl(currentSong.videoId);
            setIsLoading(true);
            setError(null);
            audioRef.current.src = streamUrl;
            audioRef.current.load();
            
            audioRef.current.play().then(() => {
                setIsPlaying(true);
                setIsLoading(false);
            }).catch(err => {
                console.error('Playback failed:', err);
                setError('Failed to play audio');
                setIsLoading(false);
            });
        }
    }, [currentSong?.videoId]);

    // Sync play/pause state
    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(() => {});
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying]);

    // Sync volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (audioRef.current && !isNaN(value)) {
            audioRef.current.currentTime = Math.max(0, Math.min(value, duration || 0));
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const formatTime = (time: number | any) => {
        // Safe parsing of time values coming from different API sources
        const numTime = Number(time);
        if (!numTime || isNaN(numTime)) return '0:00';
        
        const minutes = Math.floor(numTime / 60);
        const seconds = Math.floor(numTime % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => setIsPlaying(!isPlaying);

    const toggleMute = () => {
        if (volume > 0) {
             setVolume(0);
        } else {
             setVolume(1);
        }
    };

    if (!currentSong) return (
         <div className="h-full flex items-center justify-center text-spotify-light-grey">
            Select a song to start playing
         </div>
    );

    return (
        <>
            {/* Hidden HTML5 Audio Element */}
            <audio
                ref={audioRef}
                onTimeUpdate={() => {
                    if (audioRef.current) {
                        setCurrentTime(audioRef.current.currentTime);
                    }
                }}
                onDurationChange={() => {
                    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
                        setDuration(audioRef.current.duration);
                    }
                }}
                onEnded={() => nextSong()}
                onError={(e) => {
                    console.error('Audio error:', e);
                    setError('Audio playback error');
                    setIsLoading(false);
                }}
                onWaiting={() => setIsLoading(true)}
                onCanPlay={() => {
                    setIsLoading(false);
                    // Ensure duration is set when audio can play
                    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
                        setDuration(audioRef.current.duration);
                    }
                }}
                preload="auto"
                playsInline
                crossOrigin="anonymous"
            />
            <div className="h-full flex flex-col md:flex-row md:items-center md:justify-between px-4 py-2 md:py-0 relative gap-3 md:gap-0">
            {/* Left Box: Now Playing Info - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-4 w-1/3 min-w-[180px]">
                <div className="w-14 h-14 bg-spotify-grey rounded flex-shrink-0 overflow-hidden relative group">
                     {currentSong.thumbnailUrl && (
                        <img src={currentSong.thumbnailUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                     )}
                </div>
                <div className="flex flex-col justify-center min-w-0">
                    <span className="text-sm font-semibold hover:underline cursor-pointer truncate text-white">{currentSong.title}</span>
                    <span className="text-xs text-spotify-light-grey hover:underline cursor-pointer truncate">{currentSong.artist}</span>
                    {isLoading && <span className="text-xs text-spotify-green animate-pulse">Loading...</span>}
                    {error && <span className="text-xs text-red-400">{error}</span>}
                </div>
            </div>

            {/* Middle Box: Controls - Full width on mobile */}
            <div className="flex flex-col items-center justify-center w-full md:max-w-[722px] md:w-2/5">
                <div className="flex items-center gap-4 md:gap-6 mb-2">
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
                    <button onClick={previousSong} className="text-spotify-light-grey hover:text-white transition-colors"><SkipBack className="w-5 h-5" fill="currentColor"/></button>
                    
                    <button 
                         onClick={togglePlay}
                         disabled={isLoading}
                         className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : isPlaying ? (
                            <Pause className="w-4 h-4" fill="black" />
                        ) : (
                            <Play className="w-4 h-4 ml-1" fill="black" />
                        )}
                    </button>
                    
                    <button onClick={nextSong} className="text-spotify-light-grey hover:text-white transition-colors"><SkipForward className="w-5 h-5" fill="currentColor" /></button>
                    <button className="text-spotify-light-grey hover:text-white transition-colors"><Repeat className="w-4 h-4" /></button>
                </div>
                
                <div className="flex items-center gap-2 w-full text-xs text-spotify-light-grey">
                    <span className="w-8 md:w-10 text-right text-xs">{formatTime(currentTime)}</span>
                    <input 
                        type="range" 
                        min={0} 
                        max={Math.max(duration || 100, 100)} 
                        value={currentTime} 
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-spotify-grey rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer accent-spotify-green hover:accent-spotify-green"
                    />
                    <span className="w-8 md:w-10 text-left text-xs">{formatTime(duration || 0)}</span>
                </div>
            </div>

            {/* Right Box: Extra Controls (Volume) - Hidden on mobile */}
            <div className="hidden md:flex items-center justify-end gap-3 w-1/3 min-w-[150px]">
                <button onClick={toggleMute} className="text-spotify-light-grey hover:text-white transition-colors">
                     {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input 
                    type="range" 
                    min={0} 
                    max={1} 
                    step={0.01}
                    value={volume} 
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-24 h-1 bg-spotify-grey rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer accent-spotify-green hover:accent-spotify-green"
                />
            </div>
            </div>
        </>
    );
};

export default Player;

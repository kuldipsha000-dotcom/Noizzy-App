import { create } from 'zustand';
import { musicApi } from '../services/api';

interface Song {
    videoId: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    duration?: string;
    isOffline?: boolean;
    filename?: string;
}

interface PlayerState {
    currentSong: Song | null;
    queue: Song[];
    isPlaying: boolean;
    volume: number;
    progress: number;
    accentColor: [number, number, number];
    shuffleMode: 'off' | 'normal' | 'smart';
    loopMode: 'off' | 'all' | 'one';
    originalQueue: Song[];
    isMobileNowPlayingOpen: boolean;
    
    // Actions
    setCurrentSong: (song: Song) => void;
    setQueue: (songs: Song[]) => void;
    addToQueue: (song: Song) => void;
    setIsPlaying: (isPlaying: boolean) => void;
    setVolume: (volume: number) => void;
    setProgress: (progress: number) => void;
    setAccentColor: (color: [number, number, number]) => void;
    nextSong: () => void;
    previousSong: () => void;
    toggleShuffle: () => Promise<void>;
    toggleLoop: () => void;
    setMobileNowPlayingOpen: (open: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
    currentSong: null,
    queue: [],
    isPlaying: false,
    volume: 1,
    progress: 0,
    accentColor: [120, 80, 180] as [number, number, number], // default purple/violet theme
    shuffleMode: 'off',
    loopMode: 'off',
    originalQueue: [],
    isMobileNowPlayingOpen: false,

    setCurrentSong: (song) => set({ currentSong: song, isPlaying: true }),
    setQueue: (songs) => set({ queue: songs, originalQueue: songs, shuffleMode: 'off' }),
    addToQueue: (song) => set((state) => ({ queue: [...state.queue, song], originalQueue: [...state.originalQueue, song] })),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setVolume: (volume) => set({ volume }),
    setProgress: (progress) => set({ progress }),
    setAccentColor: (color) => set({ accentColor: color }),
    setMobileNowPlayingOpen: (open) => set({ isMobileNowPlayingOpen: open }),
    
    nextSong: async () => {
        const { currentSong, queue, loopMode } = get();
        if (!currentSong) return;
        
        const currentIndex = queue.findIndex(s => s.videoId === currentSong.videoId);
        
        // Reached end of queue
        if (loopMode === 'all' && queue.length > 0) {
            set({ currentSong: queue[0], isPlaying: true, progress: 0 });
            return;
        }

        // Loop One -> just restart the same song
        if (loopMode === 'one') {
            set({ isPlaying: false, progress: 0 }); // trigger re-play
            setTimeout(() => set({ isPlaying: true }), 50);
            return;
        }

        // If there is a next song in the queue, play it
        if (currentIndex !== -1 && currentIndex < queue.length - 1) {
            set({ currentSong: queue[currentIndex + 1], isPlaying: true, progress: 0 });
        } else {
            // We reached the end of the queue, let's fetch auto-play recommendations!
            try {
                const recommendations = await musicApi.getUpNext(currentSong.videoId);
                if (recommendations && recommendations.length > 0) {
                    // Append recommendations to the queue
                    const newQueue = [...queue, ...recommendations];
                    set({ 
                        queue: newQueue, 
                        currentSong: recommendations[0], // Play the first recommendation
                        isPlaying: true, 
                        progress: 0 
                    });
                }
            } catch (error) {
                console.error("Failed to fetch Up Next recommendations for autoplay", error);
                // Pause if no more songs
                set({ isPlaying: false });
            }
        }
    },
    
    previousSong: () => {
         const { currentSong, queue } = get();
        if (!currentSong || queue.length === 0) return;
        
        const currentIndex = queue.findIndex(s => s.videoId === currentSong.videoId);
        if (currentIndex > 0) {
            set({ currentSong: queue[currentIndex - 1], isPlaying: true, progress: 0 });
        }
    },

    toggleShuffle: async () => {
        const { shuffleMode, queue, currentSong, originalQueue } = get();
        
        if (shuffleMode === 'off') {
            // off -> normal: shuffle remaining queue
            const baseQueue = originalQueue.length > 0 ? originalQueue : [...queue];
            
            let newQueue = [...baseQueue];
            if (currentSong) {
                newQueue = newQueue.filter(s => s.videoId !== currentSong.videoId);
                for (let i = newQueue.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
                }
                newQueue = [currentSong, ...newQueue];
            } else {
                for (let i = newQueue.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
                }
            }

            set({ shuffleMode: 'normal', queue: newQueue, originalQueue: baseQueue });
        } else if (shuffleMode === 'normal') {
            // normal -> smart: fetch recommendations and inject
            set({ shuffleMode: 'smart' });
            
            if (currentSong) {
                try {
                    const recommendations = await musicApi.getUpNext(currentSong.videoId);
                    if (recommendations && recommendations.length > 0) {
                        const currentQ = get().queue;
                        const cIdx = currentQ.findIndex(s => s.videoId === currentSong.videoId);
                        
                        if (cIdx !== -1) {
                            // Insert top 5 recommendations right after the current song
                            const newQ = [...currentQ];
                            const filteredRecs = recommendations
                                .filter((r: any) => !newQ.some(qs => qs.videoId === r.videoId))
                                .slice(0, 5);
                            newQ.splice(cIdx + 1, 0, ...filteredRecs);
                            set({ queue: newQ });
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch smart shuffle recommendations", error);
                }
            }
        } else {
            // smart -> off: restore original sequence
            // Revert back to un-shuffled state
            set({ shuffleMode: 'off', queue: originalQueue });
        }
    },

    toggleLoop: () => {
        const current = get().loopMode;
        if (current === 'off') set({ loopMode: 'all' });
        else if (current === 'all') set({ loopMode: 'one' });
        else set({ loopMode: 'off' });
    }
}));

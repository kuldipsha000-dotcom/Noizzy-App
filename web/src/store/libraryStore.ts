import { create } from 'zustand';

// UUID generator with fallback for browsers that don't support crypto.randomUUID
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for browsers without crypto.randomUUID support
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export interface Song {
    videoId: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    duration?: string;
}

export interface Playlist {
    id: string;
    name: string;
    description: string;
    coverUrl?: string;
    customThumbnail?: string; // base64 data URL from user upload
    isPinned?: boolean;
    songs: Song[];
    createdAt: number;
}

interface LibraryState {
    playlists: Playlist[];
    likedSongs: Song[];
    recentSearches: Song[];

    // Search History actions
    addToRecentSearches: (song: Song) => void;
    removeFromRecentSearches: (videoId: string) => void;
    clearRecentSearches: () => void;

    // Playlist actions
    createPlaylist: (name: string, description?: string, coverUrl?: string) => Playlist;
    deletePlaylist: (id: string) => void;
    renamePlaylist: (id: string, name: string) => void;
    updatePlaylist: (id: string, changes: { name?: string; customThumbnail?: string }) => void;
    togglePinPlaylist: (id: string) => void;
    addSongToPlaylist: (playlistId: string, song: Song) => void;
    removeSongFromPlaylist: (playlistId: string, videoId: string) => void;

    // Liked songs actions
    toggleLikedSong: (song: Song) => void;
    isLiked: (videoId: string) => boolean;
}

// Load from localStorage
const loadState = () => {
    try {
        const playlists = localStorage.getItem('yt-music-playlists');
        const likedSongs = localStorage.getItem('yt-music-liked-songs');
        const recentSearches = localStorage.getItem('yt-music-recent-searches');
        return {
            playlists: playlists ? JSON.parse(playlists) : [],
            likedSongs: likedSongs ? JSON.parse(likedSongs) : [],
            recentSearches: recentSearches ? JSON.parse(recentSearches) : [],
        };
    } catch {
        return { playlists: [], likedSongs: [], recentSearches: [] };
    }
};

// Save to localStorage
const saveState = (playlists: Playlist[], likedSongs: Song[], recentSearches: Song[]) => {
    try {
        localStorage.setItem('yt-music-playlists', JSON.stringify(playlists));
        localStorage.setItem('yt-music-liked-songs', JSON.stringify(likedSongs));
        localStorage.setItem('yt-music-recent-searches', JSON.stringify(recentSearches));
    } catch {
        // Ignore storage errors
    }
};

const initial = loadState();

export const useLibraryStore = create<LibraryState>((set, get) => ({
    playlists: initial.playlists,
    likedSongs: initial.likedSongs,
    recentSearches: initial.recentSearches,

    createPlaylist: (name, description = '', coverUrl?: string) => {
        const newPlaylist: Playlist = {
            id: generateUUID(),
            name,
            description,
            coverUrl,
            songs: [],
            createdAt: Date.now(),
        };
        const updated = [...get().playlists, newPlaylist];
        set({ playlists: updated });
        saveState(get().playlists, get().likedSongs, get().recentSearches);
        return newPlaylist;
    },

    deletePlaylist: (id) => {
        set((state) => ({
            playlists: state.playlists.filter(p => p.id !== id)
        }));
        saveState(get().playlists, get().likedSongs, get().recentSearches);
    },

    renamePlaylist: (id, name) => {
        set((state) => ({
            playlists: state.playlists.map(p => p.id === id ? { ...p, name } : p)
        }));
        saveState(get().playlists, get().likedSongs, get().recentSearches);
    },

    updatePlaylist: (id, changes) => {
        set((state) => ({
            playlists: state.playlists.map(p => p.id === id ? { ...p, ...changes } : p)
        }));
        saveState(get().playlists, get().likedSongs, get().recentSearches);
    },

    togglePinPlaylist: (id) => {
        set((state) => ({
            playlists: state.playlists.map(p => p.id === id ? { ...p, isPinned: !p.isPinned } : p)
        }));
        saveState(get().playlists, get().likedSongs, get().recentSearches);
    },

    addSongToPlaylist: (playlistId, song) => {
        set((state) => ({
            playlists: state.playlists.map(p => {
                if (p.id === playlistId && !p.songs.some(s => s.videoId === song.videoId)) {
                    return { ...p, songs: [...p.songs, song] };
                }
                return p;
            })
        }));
        saveState(get().playlists, get().likedSongs, get().recentSearches);
    },

    removeSongFromPlaylist: (playlistId, videoId) => {
        set((state) => ({
            playlists: state.playlists.map(p => {
                if (p.id === playlistId) {
                    return { ...p, songs: p.songs.filter(s => s.videoId !== videoId) };
                }
                return p;
            })
        }));
        saveState(get().playlists, get().likedSongs, get().recentSearches);
    },

    toggleLikedSong: (song) => {
        set((state) => {
            const exists = state.likedSongs.some(s => s.videoId === song.videoId);
            const likedSongs = exists
                ? state.likedSongs.filter(s => s.videoId !== song.videoId)
                : [...state.likedSongs, song];
            return { likedSongs };
        });
        saveState(get().playlists, get().likedSongs, get().recentSearches);
    },

    isLiked: (videoId) => {
        return get().likedSongs.some(s => s.videoId === videoId);
    },

    addToRecentSearches: (song) => {
        const { recentSearches, playlists, likedSongs } = get();
        const filtered = recentSearches.filter(s => s.videoId !== song.videoId);
        const newHistory = [song, ...filtered].slice(0, 20); // Keep max 20
        
        set({ recentSearches: newHistory });
        saveState(playlists, likedSongs, newHistory);
    },
    removeFromRecentSearches: (videoId) => {
        const { recentSearches, playlists, likedSongs } = get();
        const newHistory = recentSearches.filter(s => s.videoId !== videoId);
        set({ recentSearches: newHistory });
        saveState(playlists, likedSongs, newHistory);
    },
    clearRecentSearches: () => {
        set({ recentSearches: [] });
        saveState(get().playlists, get().likedSongs, []);
    }
}));

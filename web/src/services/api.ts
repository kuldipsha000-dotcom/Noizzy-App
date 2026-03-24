import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
const MUSIC_API_URL = import.meta.env.VITE_MUSIC_API_URL || 'http://127.0.0.1:5001/api';

export const normalizeSong = (song: any) => ({
    videoId: song.videoId || '',
    title: song.name || song.title || 'Unknown',
    artist: typeof song.artist === 'string' ? song.artist : (song.artist?.name || 'Unknown Artist'),
    // thumbnails are sorted descending by width on the backend, so [0] is always highest res
    thumbnailUrl: song.thumbnails?.[0]?.url || song.thumbnailUrl || '',
    duration: song.duration != null ? String(song.duration) : undefined,
});

export const musicApi = {
    search: async (query: string, type?: string) => {
        const response = await axios.get(`${MUSIC_API_URL}/music/search`, { 
            params: { q: query, ...(type ? { type } : {}) } 
        });
        return response.data;
    },

    browse: async (browseId: string) => {
        const response = await axios.get(`${MUSIC_API_URL}/music/browse`, { params: { id: browseId } });
        return response.data;
    },

    getStreamUrl: (videoId: string) => {
        return `${MUSIC_API_URL}/music/stream/${videoId}`;
    },

    getDownloadUrl: (videoId: string, safeTitle: string) => {
        return `${MUSIC_API_URL}/music/download/${videoId}/${encodeURIComponent(safeTitle)}.mp3`;
    },


    getUpNext: async (videoId: string) => {
        const response = await axios.get(`${MUSIC_API_URL}/music/upnext`, {
            params: { videoId }
        });
        // Normalize the songs so they match the Song interface (name -> title, etc.)
        return (response.data as any[]).map(normalizeSong);
    },

    // Desktop App functionality: Tell python to download directly to filesystem
    downloadLocalSong: async (song: { videoId: string, title?: string, artist?: string, thumbnailUrl?: string, duration?: string, sessionId?: string }, signal?: AbortSignal) => {
        const response = await fetch(`${MUSIC_API_URL}/music/download-local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(song),
            signal
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Download failed: ${response.status}`);
        }
        return response.json();
    },

    cancelAllDownloads: async (sessionId?: string) => {
        const response = await fetch(`${MUSIC_API_URL}/music/cancel-downloads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId || '__all__' })
        });
        return response.json();
    },

    // Desktop App functionality: Fetch all downloaded songs from local filesystem
    getLocalLibrary: async () => {
        const response = await fetch(`${MUSIC_API_URL}/music/local-library`);
        if (!response.ok) return [];
        return response.json();
    },

    deleteLocalSong: async (filename: string) => {
        const response = await fetch(`${MUSIC_API_URL}/music/download-local/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
        return response.json();
    },

    // Desktop App functionality: Get stream URL for locally downloaded song
    getLocalStreamUrl: (filename: string) => {
        return `${MUSIC_API_URL}/music/local-stream/${encodeURIComponent(filename)}`;
    },

    downloadSong: async (videoId: string, title?: string, onProgress?: (pct: number) => void, signal?: AbortSignal) => {
        // Clean up the title for use as filename in the URL path
        const safeTitle = title
            ? title.replace(/[^a-zA-Z0-9 \-_()\[\]]/g, '').trim() || 'download'
            : 'download';
        // Embed the filename in the URL path so the browser uses it as the download name
        const url = `${MUSIC_API_URL}/music/download/${videoId}/${encodeURIComponent(safeTitle)}.mp3`;
        
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);

        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (total && onProgress) {
                onProgress(Math.round((received / total) * 100));
            }
        }

        // Assemble and trigger the download
        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');link.href = href;
        link.download = `${safeTitle}.mp3`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(href);
        }, 100);
    }
};

export const userApi = {
    getPlaylists: async (userId: string) => {
        const response = await axios.get(`${API_URL}/users/playlists/${userId}`);
        return response.data;
    },
    createPlaylist: async (data: { name: string, userId: string, description?: string }) => {
        const response = await axios.post(`${API_URL}/users/playlists`, data);
        return response.data;
    },
    getLikedSongs: async (userId: string) => {
        const response = await axios.get(`${API_URL}/users/liked-songs/${userId}`);
        return response.data;
    },
    toggleLikedSong: async (userId: string, song: any, action: 'add' | 'remove') => {
        const response = await axios.post(`${API_URL}/users/liked-songs/toggle`, { userId, song, action });
        return response.data;
    }
};

export interface SpotifyTrackData {
    title: string;
    artist: string;
    duration: string;
    albumArt: string;
    spotifyId: string;
}

export interface SpotifyImportResult {
    playlistName: string;
    description: string;
    coverArt?: string;
    totalTracks: number;
    tracks: SpotifyTrackData[];
}

export const spotifyApi = {
    importPlaylist: async (playlistUrl: string): Promise<SpotifyImportResult> => {
        const response = await axios.post(`${MUSIC_API_URL}/spotify/import`, { playlistUrl });
        return response.data;
    }
};

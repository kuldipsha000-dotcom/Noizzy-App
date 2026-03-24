import { create } from 'zustand';
import { musicApi } from '../services/api';

export interface Song {
    videoId: string;
    title: string;
    artist: string;
    thumbnailUrl?: string;
    duration?: string;
}

export interface SongResult {
    videoId: string;
    success: boolean;
    error?: string;
}

export type DownloadStatus = 'idle' | 'picking-folder' | 'downloading' | 'done' | 'cancelled';

export interface DownloadState {
    showModal: boolean;
    status: DownloadStatus;
    playlistName: string;
    coverUrl?: string;
    songs: Song[];
    checked: Set<string>;
    currentIndex: number;
    currentSongName: string;
    progress: number;
    results: SongResult[];
    abortController: AbortController | null;
    activeDownloads: Map<string, string>;
    completedCount: number;
    sessionId: string | null;
    
    openModal: (playlistName: string, coverUrl: string | undefined, songs: Song[]) => void;
    closeModal: () => void;
    setChecked: (checked: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    setStatus: (status: DownloadStatus) => void;
    setProgressData: (index: number, name: string, progress: number) => void;
    setResults: (results: SongResult[]) => void;
    setAbortController: (ctrl: AbortController | null) => void;
    cancelDownload: () => void;
    reset: () => void;
    startDownload: () => Promise<void>;
}

function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'download';
}

function generateSessionId(): string {
    return `dl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
    showModal: false,
    status: 'idle',
    playlistName: '',
    coverUrl: undefined,
    songs: [],
    checked: new Set(),
    currentIndex: 0,
    currentSongName: '',
    progress: 0,
    results: [],
    abortController: null,
    activeDownloads: new Map(),
    completedCount: 0,
    sessionId: null,

    openModal: (playlistName, coverUrl, songs) => set({ 
        showModal: true, 
        playlistName, 
        coverUrl, 
        songs,
        ...(get().status === 'idle' || get().status === 'done' || get().status === 'cancelled' ? {
            checked: new Set(songs.map(s => s.videoId)),
            status: 'idle',
            results: [],
            progress: 0,
            currentIndex: 0
        } : {})
    }),
    closeModal: () => set({ showModal: false }),
    setChecked: (checked) => set((state) => ({
        checked: typeof checked === 'function' ? checked(state.checked) : checked
    })),
    setStatus: (status) => set({ status }),
    setProgressData: (index, name, progress) => set({ currentIndex: index, currentSongName: name, progress }),
    setResults: (results) => set({ results }),
    setAbortController: (ctrl) => set({ abortController: ctrl }),
    cancelDownload: () => {
        const { abortController, sessionId } = get();
        // Abort all pending fetch calls (this unblocks any await immediately)
        if (abortController) {
            abortController.abort();
        }
        // Tell backend to kill the ffmpeg/yt-dlp subprocesses for this session
        musicApi.cancelAllDownloads(sessionId ?? undefined).catch(console.error);
        set({ status: 'cancelled' });
    },
    reset: () => set({
        showModal: false,
        status: 'idle',
        playlistName: '',
        coverUrl: undefined,
        songs: [],
        checked: new Set(),
        currentIndex: 0,
        currentSongName: '',
        progress: 0,
        results: [],
        abortController: null,
        activeDownloads: new Map(),
        completedCount: 0,
        sessionId: null,
    }),

    startDownload: async () => {
        const state = get();
        const total = state.songs.filter(s => state.checked.has(s.videoId));
        if (total.length === 0) return;

        // Generate a unique session ID for this entire bulk download
        const sessionId = generateSessionId();

        set({ status: 'downloading', activeDownloads: new Map(), completedCount: 0, sessionId });
        const abortController = new AbortController();
        set({ abortController });

        const isLocal = window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1'
            || window.location.protocol === 'file:'
            || window.location.protocol === 'app:';

        const songResults: SongResult[] = [];

        for (let i = 0; i < total.length; i++) {
            if (get().status === 'cancelled') break;

            const song = total[i];
            const safeTitle = sanitizeFilename(`${song.title} - ${song.artist}`);
            const safeFilename = `${safeTitle}.mp3`;

            set({
                currentIndex: i + 1,
                currentSongName: song.title,
                progress: 0,
                activeDownloads: new Map([[song.videoId, song.title]])
            });

            try {
                if (isLocal) {
                    set({ progress: 20 });
                    await musicApi.downloadLocalSong(
                        { ...song, title: safeTitle, sessionId },
                        abortController.signal
                    );
                    set({ progress: 100 });
                } else {
                    const url = musicApi.getDownloadUrl(song.videoId, safeTitle);
                    const response = await fetch(url, { signal: abortController.signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const contentLength = response.headers.get('Content-Length');
                    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
                    const reader = response.body!.getReader();
                    const chunks: Uint8Array[] = [];
                    let received = 0;

                    while (true) {
                        if (get().status === 'cancelled') { reader.cancel(); break; }
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        received += value.length;
                        if (totalBytes) set({ progress: Math.round((received / totalBytes) * 100) });
                    }

                    if (get().status !== 'cancelled') {
                        const blob = new Blob(chunks as unknown as BlobPart[], { type: 'audio/mpeg' });
                        const blobUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = safeFilename;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                        set({ progress: 100 });
                    }
                }

                songResults.push({ videoId: song.videoId, success: true });
            } catch (err: any) {
                if (err?.name === 'AbortError' || get().status === 'cancelled') {
                    songResults.push({ videoId: song.videoId, success: false, error: 'Cancelled' });
                    break;
                }
                console.error(`Failed to download: ${song.title}`, err);
                songResults.push({ videoId: song.videoId, success: false, error: err?.message || 'Unknown error' });
            }

            set(s => ({ activeDownloads: new Map(), completedCount: s.completedCount + 1 }));
            if (get().status !== 'cancelled') await new Promise(r => setTimeout(r, 200));
        }

        set({ results: songResults, activeDownloads: new Map() });
        if (get().status !== 'cancelled') {
            set({ status: 'done', progress: 0 });
        }
    }
}));



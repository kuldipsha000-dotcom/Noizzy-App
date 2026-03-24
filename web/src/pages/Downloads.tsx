import React, { useEffect, useState } from 'react';
import { Play, HardDrive, Music, Trash2 } from 'lucide-react';
import { musicApi } from '../services/api';
import { usePlayerStore } from '../store/playerStore';

interface DownloadedSong {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl?: string;
  duration?: string;
  filename: string;
}

const Downloads = () => {
    const [songs, setSongs] = useState<DownloadedSong[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const setQueue = usePlayerStore(s => s.setQueue);
    const setCurrentSong = usePlayerStore(s => s.setCurrentSong);
    const currentSong = usePlayerStore(s => s.currentSong);

    useEffect(() => {
        const loadDownloads = async () => {
            try {
                const library = await musicApi.getLocalLibrary();
                setSongs(library);
            } catch (err) {
                console.error("Failed to load local library", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadDownloads();
    }, []);

    const handlePlaySong = (_song: DownloadedSong, index: number) => {
        // Tag song as offline so GlobalAudio knows to intercept the stream
        const queueSongs = songs.map(s => ({
            ...s,
            thumbnailUrl: s.thumbnailUrl || '',
            isOffline: true
        }));
        
        setQueue(queueSongs);
        setCurrentSong(queueSongs[index]);
    };

    const handleDelete = async (e: React.MouseEvent, song: DownloadedSong) => {
        e.stopPropagation(); // prevent playing
        try {
            await musicApi.deleteLocalSong(song.filename);
            setSongs(prev => prev.filter(s => s.videoId !== song.videoId));
        } catch (err) {
            console.error("Failed to delete song", err);
            alert("Failed to delete song.");
        }
    };

    const formatDuration = (dur: string | number | undefined) => {
        if (!dur) return '';
        if (typeof dur === 'string' && dur.includes(':')) return dur;
        const totalSeconds = Number(dur);
        if (isNaN(totalSeconds)) return '';
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-full">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-purple-500/20 rounded-2xl">
                    <HardDrive className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Offline Downloads</h1>
                    <p className="text-gray-400 mt-1">{songs.length} saved tracks directly on your hard drive</p>
                </div>
            </div>

            {songs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Music className="w-16 h-16 mb-4 opacity-50" />
                    <h2 className="text-xl text-white mb-2">No downloaded tracks</h2>
                    <p>Download a playlist to listen offline without interruptions.</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {songs.map((song, idx) => {
                        const isPlaying = currentSong?.videoId === song.videoId;

                        return (
                            <div
                                key={song.videoId}
                                onClick={() => handlePlaySong(song, idx)}
                                className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-300 group
                                    ${isPlaying ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                                    {song.thumbnailUrl ? (
                                        <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                            <Music className="w-5 h-5 text-gray-500" />
                                        </div>
                                    )}
                                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity
                                        ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <Play className={`w-5 h-5 ${isPlaying ? 'text-purple-400' : 'text-white'} fill-current`} />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-medium truncate ${isPlaying ? 'text-purple-400' : 'text-white'}`}>
                                        {song.title}
                                    </h3>
                                    <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                                </div>
                                {song.duration && (
                                    <div className="text-sm text-gray-400 tabular-nums">
                                        {formatDuration(song.duration)}
                                    </div>
                                )}
                                <div className="ml-2 flex-shrink-0">
                                    <button 
                                        onClick={(e) => handleDelete(e, song)}
                                        className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-full hover:bg-white/5 opacity-0 group-hover:opacity-100"
                                        title="Delete Download"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Downloads;

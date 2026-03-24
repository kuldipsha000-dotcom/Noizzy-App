import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, ArrowLeft, Clock, Loader2, Plus, Check, Shuffle, Download as DownloadIcon, Pin } from 'lucide-react';
import { musicApi, normalizeSong } from '../services/api';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useDownloadStore } from '../store/downloadStore';

const DiscoverPlaylist = () => {
    const { id } = useParams<{ id: string }>(); // Contains the search query, URI encoded
    const navigate = useNavigate();
    
    const [songs, setSongs] = useState<any[]>([]);
    const [playlistData, setPlaylistData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const setCurrentSong = usePlayerStore(state => state.setCurrentSong);
    const setQueue = usePlayerStore(state => state.setQueue);
    const toggleShuffle = usePlayerStore(state => state.toggleShuffle);
    const shuffleMode = usePlayerStore(state => state.shuffleMode);
    
    const openDownloadModal = useDownloadStore(state => state.openModal);
    const createPlaylist = useLibraryStore(state => state.createPlaylist);
    const addSongToPlaylist = useLibraryStore(state => state.addSongToPlaylist);
    const [isSaved, setIsSaved] = useState(false);
    
    const likedSongs = useLibraryStore(state => state.likedSongs);
    const toggleLikedSong = useLibraryStore(state => state.toggleLikedSong);
    const isLiked = (videoId: string) => likedSongs.some(s => s.videoId === videoId);

    // Dynamic title from absolute ID parsing
    const title = playlistData?.title || decodeURIComponent(id || '').replace(/playlist new|EDM hits|bollywood|hits|best songs mix/gi, '').trim();

    useEffect(() => {
        const fetchSongs = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                // If the string is long (looks like a browseId for Album, Playlist, or Mix)
                // Attempt to browse it absolutely
                if (id.length > 20 || id.startsWith('MPRE') || id.startsWith('VL') || id.startsWith('PL') || id.startsWith('RD')) {
                    const data = await musicApi.browse(decodeURIComponent(id));
                    setPlaylistData(data);
                    setSongs(data.songs.map(normalizeSong));
                } else {
                    // Fallback to legacy string search (e.g. from Spotify imports)
                    const results = await musicApi.search(decodeURIComponent(id));
                    setSongs(results.map(normalizeSong));
                }
            } catch (e) {
                console.error("Failed to fetch playlist/album", e);
                // Last ditch fallback for string searches
                try {
                    const results = await musicApi.search(decodeURIComponent(id));
                    setSongs(results.map(normalizeSong));
                } catch(e2) {}
            } finally {
                setIsLoading(false);
            }
        };
        fetchSongs();
    }, [id]);

    const handlePlayAll = () => {
        if (songs.length > 0) {
            setCurrentSong(songs[0]);
            setQueue(songs);
        }
    };

    const handleSmartShuffleAll = async () => {
        if (songs.length > 0) {
            const randomIdx = Math.floor(Math.random() * songs.length);
            setCurrentSong(songs[randomIdx]);
            setQueue(songs);
            if (shuffleMode === 'off') {
                await toggleShuffle();
                await toggleShuffle();
            } else if (shuffleMode === 'normal') {
                await toggleShuffle();
            }
        }
    };

    const handleSaveToLibrary = () => {
        if (isSaved) return;
        const newPl = createPlaylist(title, playlistData?.description || 'Saved from YouTube Music', playlistData?.thumbnails?.[0]?.url || songs[0]?.thumbnailUrl);
        songs.forEach(song => addSongToPlaylist(newPl.id, song));
        setIsSaved(true);
    };

    const handlePlaySong = (index: number) => {
        setCurrentSong(songs[index]);
        setQueue(songs);
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-spotify-green animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-8 h-full flex flex-col overflow-y-auto hide-scrollbar">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6 mb-6 sm:mb-8 shrink-0">
                <button onClick={() => navigate(-1)} className="text-spotify-light-grey hover:text-white self-start">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-32 h-32 sm:w-48 sm:h-48 bg-spotify-grey rounded shadow-2xl flex items-center justify-center overflow-hidden shrink-0">
                    {playlistData?.thumbnails?.[0]?.url || (songs.length > 0 && songs[0].thumbnailUrl) ? (
                        <img 
                            src={playlistData?.thumbnails?.[0]?.url || songs[0].thumbnailUrl} 
                            alt={title} 
                            className="w-full h-full object-cover" 
                        />
                    ) : (
                        <div className="w-full h-full bg-linear-to-br from-indigo-500 to-purple-800"></div>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase text-spotify-light-grey">
                        {id?.startsWith('MPRE') ? 'Album' : 'Playlist / Mix'}
                    </span>
                    <h1 className="text-2xl sm:text-5xl font-black mb-2 sm:mb-4 mt-1 capitalize">{title}</h1>
                    
                    {playlistData?.description && (
                         <div className="text-sm text-spotify-light-grey mb-4 max-w-2xl line-clamp-3 leading-relaxed">
                             {playlistData.description}
                         </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-spotify-light-grey">
                        <span className="font-semibold text-white">YouTube Music</span>
                        <span>•</span>
                        <span>{songs.length} songs</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0 justify-center sm:justify-start">
                <button
                    onClick={handlePlayAll}
                    disabled={songs.length === 0}
                    className="w-14 h-14 bg-spotify-green rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl disabled:opacity-50 disabled:hover:scale-100"
                >
                    <Play className="w-6 h-6 text-black ml-1" fill="black" />
                </button>
                <button
                    onClick={handleSmartShuffleAll}
                    disabled={songs.length === 0}
                    className="w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all shadow-xl disabled:opacity-50 group relative"
                    title="Smart Shuffle"
                >
                    <Shuffle className="w-5 h-5 text-spotify-green group-hover:scale-110 transition-transform" />
                </button>
                <button
                    onClick={() => openDownloadModal(title, playlistData?.thumbnails?.[0]?.url || songs[0]?.thumbnailUrl, songs)}
                    disabled={songs.length === 0}
                    className="text-spotify-light-grey hover:text-white transition-colors disabled:opacity-40"
                    title="Download Mix"
                >
                    <DownloadIcon className="w-6 h-6" />
                </button>
                <button
                    onClick={handleSaveToLibrary}
                    disabled={songs.length === 0 || isSaved}
                    className={`transition-colors ${isSaved ? 'text-spotify-green' : 'text-spotify-light-grey hover:text-white'}`}
                    title={isSaved ? 'Saved to Library' : 'Save to Library'}
                >
                    <Pin className="w-6 h-6" fill={isSaved ? 'currentColor' : 'none'} />
                </button>
            </div>

            {/* Song List */}
            <div className="w-full pb-8 sm:overflow-x-auto">
                {/* Table header */}
                <div className="flex items-center gap-1 sm:gap-4 px-1 sm:px-2 py-2 border-b border-spotify-grey/30 text-xs sm:text-sm text-spotify-light-grey mb-4">
                    <div className="w-8 sm:w-10 text-center">#</div>
                    <div className="w-8 sm:w-12"></div>
                    <div className="flex-1 min-w-0">Title</div>
                    <div className="w-10 sm:w-20 text-right"><Clock className="w-3 h-3 sm:w-4 sm:h-4 inline" /></div>
                    <div className="w-6 sm:w-10"></div>
                </div>

                {songs.map((song, index) => (
                    <div
                        key={song.videoId}
                        onClick={() => handlePlaySong(index)}
                        className="flex items-center gap-1 sm:gap-4 p-1 sm:p-2 hover:bg-white/10 rounded-md group transition-colors cursor-pointer"
                    >
                        <div className="w-8 sm:w-10 text-center text-xs sm:text-sm text-spotify-light-grey group-hover:hidden">
                            {index + 1}
                        </div>
                        <div className="w-8 sm:w-10 justify-center hidden group-hover:flex">
                            <Play className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="white" />
                        </div>

                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-spotify-grey rounded overflow-hidden shrink-0">
                            {song.thumbnailUrl && (
                                <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate group-hover:text-spotify-green transition-colors text-xs sm:text-base">{song.title}</div>
                            <div className="text-xs sm:text-sm text-spotify-light-grey truncate">{song.artist}</div>
                        </div>

                        <div className="w-10 sm:w-20 text-right text-xs sm:text-sm text-spotify-light-grey">
                            {song.duration ? Math.floor(parseInt(song.duration)/60) + ':' + (parseInt(song.duration)%60).toString().padStart(2, '0') : ''}
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleLikedSong(song);
                            }}
                            className={`w-6 sm:w-10 transition-all ${isLiked(song.videoId) ? 'text-spotify-green opacity-100' : 'text-spotify-light-grey opacity-0 group-hover:opacity-100 hover:text-white'}`}
                        >
                            {isLiked(song.videoId) ? <Check className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DiscoverPlaylist;

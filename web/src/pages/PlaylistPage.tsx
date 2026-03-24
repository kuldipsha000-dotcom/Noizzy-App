import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Trash2, ArrowLeft, Music, Clock, Heart, Shuffle, Pencil, X, Pin, Download as DownloadIcon } from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import SafeImage from '../components/SafeImage';
import PlaylistCover from '../components/PlaylistCover';
import { useDownloadStore } from '../store/downloadStore';

const PlaylistPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const isLikedPlaylist = id === 'liked';
    const likedSongs = useLibraryStore(state => state.likedSongs);
    const storePlaylists = useLibraryStore(state => state.playlists);

    // Create a mock playlist object for the 'Liked Songs' view
    const playlist = isLikedPlaylist ? {
        id: 'liked',
        name: 'Liked Songs',
        description: 'Songs you have liked',
        songs: likedSongs,
        createdAt: Date.now()
    } : storePlaylists.find(p => p.id === id);

    const removeSongFromPlaylist = useLibraryStore(state => state.removeSongFromPlaylist);
    const toggleLikedSong = useLibraryStore(state => state.toggleLikedSong);
    const deletePlaylist = useLibraryStore(state => state.deletePlaylist);
    const updatePlaylist = useLibraryStore(state => state.updatePlaylist);
    const togglePinPlaylist = useLibraryStore(state => state.togglePinPlaylist);
    const setCurrentSong = usePlayerStore(state => state.setCurrentSong);
    const setQueue = usePlayerStore(state => state.setQueue);
    const toggleShuffle = usePlayerStore(state => state.toggleShuffle);
    const shuffleMode = usePlayerStore(state => state.shuffleMode);

    const isPinned = !isLikedPlaylist && playlist && (playlist as any).isPinned;

    // Download global store
    const openDownloadModal = useDownloadStore(state => state.openModal);

    // Edit modal state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');

    const openEdit = () => {
        if (!playlist) return;
        setEditName(playlist.name);
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (!playlist || !id) return;
        updatePlaylist(id, { name: editName.trim() || playlist.name });
        setIsEditing(false);
    };

    if (!playlist) {
        return (
            <div className="p-4 sm:p-8 flex flex-col items-center justify-center h-full">
                <p className="text-spotify-light-grey text-base sm:text-lg mb-4">Playlist not found</p>
                <button
                    onClick={() => navigate('/library')}
                    className="text-spotify-green hover:underline"
                >
                    Go to Library
                </button>
            </div>
        );
    }

    const handlePlayAll = () => {
        if (playlist.songs.length > 0) {
            setCurrentSong(playlist.songs[0]);
            setQueue(playlist.songs);
        }
    };

    const handleSmartShuffleAll = async () => {
        if (playlist.songs.length > 0) {
            const randomIdx = Math.floor(Math.random() * playlist.songs.length);
            setCurrentSong(playlist.songs[randomIdx]);
            setQueue(playlist.songs);
            if (shuffleMode === 'off') {
                await toggleShuffle();
                await toggleShuffle();
            } else if (shuffleMode === 'normal') {
                await toggleShuffle();
            }
        }
    };

    const handlePlaySong = (index: number) => {
        setCurrentSong(playlist.songs[index]);
        setQueue(playlist.songs);
    };

    const handleRemoveSong = (e: React.MouseEvent, videoId: string) => {
        e.stopPropagation();
        if (isLikedPlaylist) {
            const songToUnlike = playlist.songs.find(s => s.videoId === videoId);
            if (songToUnlike) toggleLikedSong(songToUnlike);
        } else {
            removeSongFromPlaylist(playlist.id, videoId);
        }
    };

    const handleDeletePlaylist = () => {
        deletePlaylist(playlist.id);
        navigate('/library');
    };

    const totalDuration = playlist.songs.reduce((acc, s) => {
        const dur = parseInt(s.duration || '0');
        return acc + (isNaN(dur) ? 0 : dur);
    }, 0);
    const totalMinutes = Math.floor(totalDuration / 60);

    return (
        <div className="p-2 sm:p-8 w-full max-w-full overflow-y-auto hide-scrollbar">
            {/* Edit Modal - glassmorphism */}
            {isEditing && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsEditing(false)}>
                    <div
                        className="rounded-2xl p-6 w-96 shadow-2xl border border-white/10"
                        style={{ background: 'rgba(30,30,30,0.7)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold">Edit Playlist</h2>
                            <button onClick={() => setIsEditing(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        <label className="text-xs text-white/50 mb-1.5 block font-semibold uppercase tracking-wider">Playlist Name</label>
                        <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                            className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-spotify-green mb-5 border border-white/10"
                            placeholder="Playlist title..."
                            autoFocus
                        />

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">Cancel</button>
                            <button
                                onClick={handleSaveEdit}
                                className="px-5 py-2 bg-spotify-green text-black font-bold text-sm rounded-full hover:scale-105 transition-all"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 mb-6 sm:mb-8 shrink-0">
                <div className="flex w-full sm:w-auto items-center justify-between">
                    <button onClick={() => navigate(-1)} className="text-spotify-light-grey hover:text-white mb-2 sm:mb-0">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                </div>
                <div className={`w-32 h-32 sm:w-48 sm:h-48 rounded shadow-2xl overflow-hidden shrink-0 ${isLikedPlaylist ? 'bg-linear-to-br from-indigo-500 to-blue-400 flex items-center justify-center' : ''}`}> 
                    {isLikedPlaylist ? (
                        <Heart className="w-16 h-16 sm:w-20 sm:h-20 text-white" fill="white" />
                    ) : (
                        <PlaylistCover playlist={playlist as any} className="w-full h-full" size="lg" />
                    )}
                </div>
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full sm:w-auto">
                    <span className="text-xs font-bold uppercase text-spotify-light-grey">Playlist</span>
                    <div className="flex items-center gap-2 mt-1 mb-2 sm:mb-4">
                        <h1 className="text-2xl sm:text-5xl font-black wrap-break-word max-w-[90vw] sm:max-w-none">{playlist.name}</h1>
                        {!isLikedPlaylist && (
                            <button
                                onClick={openEdit}
                                className="text-white/40 hover:text-white transition-colors self-end mb-1"
                                title="Edit playlist"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-spotify-light-grey">
                        <span className="font-semibold text-white">{playlist.songs.length} song{playlist.songs.length !== 1 ? 's' : ''}</span>
                        {totalMinutes > 0 && (
                            <>
                                <span>•</span>
                                <span>about {totalMinutes} min</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0 justify-center sm:justify-start">
                <button
                    onClick={handlePlayAll}
                    disabled={playlist.songs.length === 0}
                    className="w-14 h-14 bg-spotify-green rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl disabled:opacity-50 disabled:hover:scale-100"
                >
                    <Play className="w-6 h-6 text-black ml-1" fill="black" />
                </button>
                <button
                    onClick={handleSmartShuffleAll}
                    disabled={playlist.songs.length === 0}
                    className="w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all shadow-xl disabled:opacity-50 group relative"
                    title="Smart Shuffle"
                >
                    <Shuffle className="w-5 h-5 text-spotify-green group-hover:scale-110 transition-transform" />
                </button>
                {!isLikedPlaylist && (
                    <>
                        {/* Download Playlist */}
                        <button
                            onClick={() => openDownloadModal(
                                playlist.name, 
                                (playlist as any).customThumbnail || playlist.songs[0]?.thumbnailUrl,
                                playlist.songs
                            )}
                            disabled={playlist.songs.length === 0}
                            className="text-spotify-light-grey hover:text-white transition-colors disabled:opacity-40"
                            title="Download Playlist"
                        >
                            <DownloadIcon className="w-6 h-6" />
                        </button>
                        {/* Pin playlist */}
                        <button
                            onClick={() => togglePinPlaylist(playlist.id)}
                            className={`transition-colors ${isPinned ? 'text-spotify-green' : 'text-spotify-light-grey hover:text-white'}`}
                            title={isPinned ? 'Unpin playlist' : 'Pin playlist'}
                        >
                            <Pin className="w-6 h-6" fill={isPinned ? 'currentColor' : 'none'} />
                        </button>
                        {/* Delete playlist */}
                        <button
                            onClick={handleDeletePlaylist}
                            className="text-spotify-light-grey hover:text-red-400 transition-colors"
                            title="Delete playlist"
                        >
                            <Trash2 className="w-6 h-6" />
                        </button>
                    </>
                )}
            </div>

            {/* Song List */}
            {playlist.songs.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-50">
                    <Music className="w-12 h-12 sm:w-16 sm:h-16 text-spotify-light-grey mb-4" />
                    <h3 className="text-lg sm:text-xl font-bold mb-2">This playlist is empty</h3>
                    <p className="text-spotify-light-grey mb-4 text-sm sm:text-base">Search for songs and add them here</p>
                    <button
                        onClick={() => navigate('/search')}
                        className="bg-white text-black font-bold text-xs sm:text-sm px-4 sm:px-6 py-2 sm:py-3 rounded-full hover:scale-105 transition-all"
                    >
                        Find songs
                    </button>
                </div>
            ) : (
                <div className="w-full pb-8 sm:overflow-x-auto">
                    {/* Table header */}
                    <div className="flex items-center gap-1 sm:gap-4 px-2 sm:px-2 py-2 border-b border-spotify-grey/30 text-xs sm:text-sm text-spotify-light-grey">
                        <div className="w-8 sm:w-10 text-center">#</div>
                        <div className="w-10 sm:w-12"></div>
                        <div className="flex-1">Title</div>
                        <div className="w-14 sm:w-20 text-right"><Clock className="w-4 h-4 inline" /></div>
                        <div className="w-8 sm:w-10"></div>
                    </div>

                    {playlist.songs.map((song, index) => (
                        <div
                            key={song.videoId}
                            onClick={() => handlePlaySong(index)}
                            className="flex items-center gap-1 sm:gap-4 p-1 sm:p-2 hover:bg-white/10 rounded-md group transition-colors cursor-pointer"
                        >
                            <div className="w-8 sm:w-10 text-center text-spotify-light-grey group-hover:hidden">
                                {index + 1}
                            </div>
                            <div className="w-8 sm:w-10 justify-center hidden group-hover:flex">
                                <Play className="w-4 h-4 text-white" fill="white" />
                            </div>

                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-spotify-grey rounded overflow-hidden shrink-0">
                                {song.thumbnailUrl && (
                                    <SafeImage src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white truncate group-hover:text-spotify-green transition-colors text-sm sm:text-base">{song.title}</div>
                                <div className="text-xs sm:text-sm text-spotify-light-grey truncate">{song.artist}</div>
                            </div>

                            <div className="w-14 sm:w-20 text-right text-xs sm:text-sm text-spotify-light-grey">
                                {song.duration ? Math.floor(parseInt(song.duration) / 60) + ':' + (parseInt(song.duration) % 60).toString().padStart(2, '0') : ''}
                            </div>

                            <button
                                onClick={(e) => handleRemoveSong(e, song.videoId)}
                                className="w-8 sm:w-10 text-spotify-light-grey hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                title="Remove from playlist"
                            >
                                <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PlaylistPage;

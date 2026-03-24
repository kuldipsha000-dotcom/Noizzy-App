import { useState } from 'react';
import { Music, Trash2, Play } from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { useNavigate } from 'react-router-dom';
import SpotifyImportModal from '../components/SpotifyImportModal';
import SafeImage from '../components/SafeImage';

const Library = () => {
    const playlists = useLibraryStore(state => state.playlists);
    const createPlaylist = useLibraryStore(state => state.createPlaylist);

    const deletePlaylist = useLibraryStore(state => state.deletePlaylist);
    const setCurrentSong = usePlayerStore(state => state.setCurrentSong);
    const setQueue = usePlayerStore(state => state.setQueue);
    const navigate = useNavigate();
    const [showSpotifyModal, setShowSpotifyModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");

    const handlePlayPlaylist = (playlistId: string) => {
        const pl = playlists.find(p => p.id === playlistId);
        if (pl && pl.songs.length > 0) {
            setCurrentSong(pl.songs[0]);
            setQueue(pl.songs);
        }
    };

    const handleDeletePlaylist = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deletePlaylist(id);
    };

    return (
        <div className="p-4 md:p-8">
            {showSpotifyModal && <SpotifyImportModal onClose={() => setShowSpotifyModal(false)} />}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
                    <div className="rounded-2xl p-6 w-[340px] shadow-2xl border border-white/10 bg-[#181818]" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Create Playlist</h2>
                        <input
                            type="text"
                            value={newPlaylistName}
                            onChange={e => setNewPlaylistName(e.target.value)}
                            className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-spotify-green mb-5 border border-white/10"
                            placeholder="Playlist name..."
                            autoFocus
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">Cancel</button>
                            <button
                                onClick={() => {
                                    if (newPlaylistName.trim()) {
                                        const pl = createPlaylist(newPlaylistName.trim());
                                        setShowCreateModal(false);
                                        setNewPlaylistName("");
                                        navigate(`/playlist/${pl.id}`);
                                    }
                                }}
                                className="px-5 py-2 bg-spotify-green text-black font-bold text-sm rounded-full hover:scale-105 transition-all"
                                disabled={!newPlaylistName.trim()}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button className="bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full cursor-default">Playlists</button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-spotify-green text-black text-xs font-semibold px-4 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95"
                    >
                        + Create Playlist
                    </button>
                </div>
                <button
                    onClick={() => setShowSpotifyModal(true)}
                    className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full font-semibold text-xs md:text-sm transition-all hover:scale-105 active:scale-95"
                    style={{ background: '#1DB954', color: '#000' }}
                >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    <span className="hidden sm:inline">Import from Spotify</span>
                    <span className="sm:hidden">Import</span>
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6 mt-4">
                {/* User Playlists */}
                {playlists.map((pl) => (
                    <div
                        key={pl.id}
                        onClick={() => navigate(`/playlist/${pl.id}`)}
                        className="bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-[40px] border border-white/5 shadow-md hover:shadow-xl p-3 md:p-4 rounded-xl transition-all duration-300 cursor-pointer group relative flex flex-col"
                    >
                        <div className="w-full aspect-square rounded-lg bg-black/20 mb-4 overflow-hidden relative shadow-[0_8px_24px_rgba(0,0,0,0.4)] flex items-center justify-center">
                            {pl.coverUrl ? (
                                <SafeImage src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                            ) : pl.songs.length > 0 && pl.songs[0].thumbnailUrl ? (
                                <SafeImage src={pl.songs[0].thumbnailUrl} alt={pl.name} className="w-full h-full object-cover" />
                            ) : (
                                <Music className="w-12 h-12 text-[#b3b3b3]" />
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors pointer-events-none"></div>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(pl.id); }}
                                className="absolute bottom-2 right-2 w-12 h-12 bg-[#1ed760] rounded-full items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300 hidden group-hover:flex hover:scale-105 hover:bg-[#1fdf64] z-20 text-black"
                            >
                                <Play className="w-6 h-6 text-black ml-1" fill="black" />
                            </button>
                        </div>
                        <div className="flex items-start justify-between min-w-0 gap-2 mb-1">
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-white text-base truncate mb-1 relative z-10">{pl.name}</h3>
                                <p className="text-sm text-[#a7a7a7] font-medium truncate">{pl.songs.length} song{pl.songs.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button
                                onClick={(e) => handleDeletePlaylist(e, pl.id)}
                                className="text-[#a7a7a7] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-full hover:bg-white/10 z-20"
                                title="Delete playlist"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Empty state if no playlists */}
                {playlists.length === 0 && (
                    <div className="bg-spotify-black/50 p-4 rounded-md flex flex-col items-center justify-center h-64 border-2 border-dashed border-spotify-grey/30">
                        <Music className="w-12 h-12 text-spotify-light-grey mb-3" />
                        <p className="text-sm text-spotify-light-grey text-center">Create your first playlist from the sidebar</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Library;

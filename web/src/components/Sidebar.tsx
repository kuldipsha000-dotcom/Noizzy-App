import React, { useState } from 'react';
import { Heart, PlusCircle, Library, Music, X, HardDrive } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLibraryStore } from '../store/libraryStore';
import PlaylistCover from './PlaylistCover';
import DownloadProgressWidget from './DownloadProgressWidget';
import SpotifyImportModal from './SpotifyImportModal';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const rawPlaylists = useLibraryStore(state => state.playlists);
  // Pinned playlists float to the top
  const playlists = [...rawPlaylists].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });
  const createPlaylist = useLibraryStore(state => state.createPlaylist);

  const handleCreate = () => {
    const name = newPlaylistName.trim();
    if (name) {
      createPlaylist(name);
      setNewPlaylistName('');
      setShowCreateModal(false);
    }
  };

  const navItems = [
    { icon: Library, path: '/library', label: 'Library' },
    { icon: HardDrive, path: '/downloads', label: 'Downloads' },
  ];

  return (
    <>
      <div 
        className="w-[72px] flex-shrink-0 flex flex-col items-center py-4 gap-1 border-r border-white/5"
        style={{
          background: 'rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Logo */}
        <div className="w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center mb-4">
          <Music className="w-5 h-5 text-black" />
        </div>

        {/* Nav Icons */}
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200 ${isActive
                  ? 'text-white'
                  : 'text-spotify-light-grey hover:text-white'
                }`}
            >
              <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
            </Link>
          );
        })}

        {/* Divider */}
        <div className="w-6 h-px bg-white/10 my-2"></div>

        {/* Create Playlist */}
        <button
          onClick={() => setShowCreateModal(true)}
          title="Create Playlist"
          className="w-12 h-12 flex items-center justify-center rounded-lg text-spotify-light-grey hover:text-white transition-all"
        >
          <PlusCircle className="w-5 h-5" />
        </button>

        {/* Liked Songs */}
        <Link
          to="/playlist/liked"
          title="Liked Songs"
          className="w-12 h-12 flex items-center justify-center rounded-lg transition-all opacity-80 hover:opacity-100"
        >
          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-blue-400 rounded flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 text-white" fill="white" />
          </div>
        </Link>

        {/* Playlist Thumbnails */}
        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col items-center gap-3 mt-2 w-full px-3">
          {playlists.map(pl => (
            <Link
              key={pl.id}
              to={`/playlist/${pl.id}`}
              title={pl.isPinned ? `${pl.name} (Pinned)` : pl.name}
              className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-spotify-grey hover:ring-2 hover:ring-white/30 transition-all"
            >
              <PlaylistCover playlist={pl} className="w-full h-full" size="sm" />
              {pl.isPinned && (
                <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-spotify-green rounded-full ring-1 ring-black" />
              )}
            </Link>
          ))}
        </div>

        {/* Global Download Progress Widget (renders only when needed) */}
        <DownloadProgressWidget />
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={() => setShowCreateModal(false)}>
          <div 
            className="rounded-xl p-6 w-96 shadow-2xl border border-white/10" 
            style={{
              background: 'rgba(30, 30, 30, 0.6)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Create Playlist</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-spotify-light-grey hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="w-full bg-white/10 text-white px-4 py-3 rounded-lg text-sm placeholder-spotify-light-grey focus:outline-none focus:ring-2 focus:ring-spotify-green/50 mb-5 border border-white/5"
            />
            <div className="flex justify-between items-center gap-3">
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setShowSpotifyModal(true);
                }}
                className="text-sm font-semibold text-spotify-green hover:text-white transition-colors"
                title="Import Playlist from Spotify"
              >
                Import from Spotify
              </button>
              <div className="flex gap-3">
                <button onClick={() => setShowCreateModal(false)} className="text-sm font-semibold text-spotify-light-grey hover:text-white px-5 py-2">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!newPlaylistName.trim()}
                  className="bg-spotify-green text-black text-sm font-bold px-6 py-2 rounded-full hover:scale-105 hover:brightness-110 transition-all disabled:opacity-40 disabled:hover:scale-100"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSpotifyModal && <SpotifyImportModal onClose={() => setShowSpotifyModal(false)} />}
    </>
  );
};

export default Sidebar;

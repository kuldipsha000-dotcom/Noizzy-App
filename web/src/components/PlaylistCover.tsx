import React from 'react';
import { Music } from 'lucide-react';
import type { Playlist } from '../store/libraryStore';

interface PlaylistCoverProps {
    playlist: Playlist | { id: string; name: string; songs: any[]; customThumbnail?: string; coverUrl?: string };
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const PlaylistCover: React.FC<PlaylistCoverProps> = ({ playlist, className = '', size = 'md' }) => {
    // 1. Use custom uploaded thumbnail if set
    if (playlist.customThumbnail) {
        return (
            <img
                src={playlist.customThumbnail}
                alt={playlist.name}
                className={`object-cover ${className}`}
            />
        );
    }

    // 2. Use Spotify/import cover if set
    if (playlist.coverUrl) {
        return (
            <img
                src={playlist.coverUrl}
                alt={playlist.name}
                className={`object-cover ${className}`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
        );
    }

    const thumbs = playlist.songs
        .map(s => s.thumbnailUrl)
        .filter(Boolean)
        .slice(0, 4);

    // 3. Auto-collage: 4 thumbnails → 2x2 grid
    if (thumbs.length >= 4) {
        return (
            <div className={`grid grid-cols-2 grid-rows-2 overflow-hidden ${className}`}>
                {thumbs.map((url, i) => (
                    <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                ))}
            </div>
        );
    }

    // 4. Single thumbnail
    if (thumbs.length > 0) {
        return (
            <img
                src={thumbs[0]}
                alt={playlist.name}
                className={`object-cover ${className}`}
            />
        );
    }

    // 5. Placeholder
    const bgColors: Record<string, string> = {
        'liked': 'from-indigo-800 to-purple-900',
    };
    const bg = bgColors[playlist.id] || 'from-[#282828] to-[#121212]';
    const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';

    return (
        <div className={`bg-gradient-to-br ${bg} flex items-center justify-center ${className}`}>
            <Music className={`${iconSize} text-white/40`} />
        </div>
    );
};

export default PlaylistCover;

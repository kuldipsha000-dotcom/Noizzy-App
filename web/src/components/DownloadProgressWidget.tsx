import React from 'react';
import { useDownloadStore } from '../store/downloadStore';
import { Download, Loader2, CheckCircle2, AlertTriangle, ChevronUp } from 'lucide-react';

const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const DownloadProgressWidget: React.FC = () => {
    const { status, playlistName, currentIndex, songs, checked, progress, showModal, openModal } = useDownloadStore();

    // Only show if we are actively downloading or just finished/cancelled, and the modal is CLOSED
    if (status === 'idle' || status === 'picking-folder' || showModal) return null;

    const total = songs.filter(s => checked.has(s.videoId)).length;
    const isDownloading = status === 'downloading';
    const mobile = isMobile();
    
    const handleReopen = () => {
        openModal(playlistName, undefined, songs);
        useDownloadStore.setState({ showModal: true });
    };

    // Mobile layout: Bottom-center widget above MiniPlayer
    if (mobile) {
        return (
            <div 
                onClick={handleReopen}
                className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-[75] md:hidden"
                title="View Download Progress"
            >
                <div className="flex flex-col items-center justify-center gap-2 p-3 bg-spotify-green/90 hover:bg-spotify-green text-black rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95 shadow-lg">
                    {status === 'done' ? (
                        <CheckCircle2 className="w-5 h-5" />
                    ) : status === 'cancelled' ? (
                        <AlertTriangle className="w-5 h-5" />
                    ) : (
                        <div className="relative">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    )}
                    
                    <span className="text-xs font-bold text-black">
                        {isDownloading ? `${currentIndex}/${total}` : status}
                    </span>
                </div>
            </div>
        );
    }

    // Desktop layout: Original widget design
    return (
        <div 
            onClick={handleReopen}
            className="group relative flex flex-col items-center justify-center p-3 mt-auto mb-4 mx-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg overflow-hidden"
            title="View Download Progress"
        >
            {/* Background progress fill */}
            {isDownloading && (
                <div 
                    className="absolute bottom-0 left-0 right-0 bg-spotify-green/20 transition-all duration-500 z-0"
                    style={{ height: `${((currentIndex - 1) / total) * 100 + (progress / total)}%` }}
                />
            )}
            
            <div className="relative z-10 flex flex-col items-center">
                {status === 'done' ? (
                    <CheckCircle2 className="w-6 h-6 text-spotify-green drop-shadow-[0_0_8px_rgba(29,185,84,0.5)]" />
                ) : status === 'cancelled' ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                ) : (
                    <div className="relative">
                        <Download className="w-5 h-5 text-spotify-green animate-pulse drop-shadow-[0_0_8px_rgba(29,185,84,0.5)]" />
                        <Loader2 className="w-8 h-8 text-white/20 animate-spin absolute -inset-1.5" />
                    </div>
                )}
                
                <span className="text-[10px] uppercase tracking-wider font-bold mt-2 text-white/50 group-hover:text-white transition-colors">
                    {isDownloading ? `${currentIndex}/${total}` : status}
                </span>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                    <ChevronUp className="w-5 h-5 text-white" />
                </div>
            </div>
        </div>
    );
};

export default DownloadProgressWidget;

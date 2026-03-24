import { HashRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import NowPlaying from './components/NowPlaying';
import BottomNav from './components/BottomNav';
import MiniPlayer from './components/MiniPlayer';
import GlobalAudio from './components/GlobalAudio';
import Downloads from './pages/Downloads';
import ErrorBoundary from './components/ErrorBoundary';
import DownloadProgressWidget from './components/DownloadProgressWidget';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistPage from './pages/PlaylistPage';
import DiscoverPlaylist from './pages/DiscoverPlaylist';
import PlaylistDownloadModal from './components/PlaylistDownloadModal';
import { usePlayerStore } from './store/playerStore';

const Layout = () => {
  const accentColor = usePlayerStore(s => s.accentColor);
  const isMobileNowPlayingOpen = usePlayerStore(s => s.isMobileNowPlayingOpen);
  const setMobileNowPlayingOpen = usePlayerStore(s => s.setMobileNowPlayingOpen);
  const currentSong = usePlayerStore(s => s.currentSong);
  const [r, g, b] = accentColor;

  return (
    <ErrorBoundary>
      <GlobalAudio>
        {/* One unified background spanning the full screen */}
        <div
          className="h-screen flex text-white overflow-hidden"
          style={{
            background: `
              linear-gradient(180deg, rgba(${r},${g},${b},0.35) 0%, rgba(${r},${g},${b},0.05) 40%, #111111 100%)
            `,
            transition: 'background 1.2s ease',
          }}
        >
          {/* Narrow Icon Sidebar — hidden on mobile */}
          <div className="hidden md:flex flex-shrink-0">
            <Sidebar />
          </div>

          {/* Main Content Area — transparent, inherits root bg */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <Navbar />
            {/* Extra bottom padding on mobile to account for mini player + bottom nav */}
            <div className={`flex-1 overflow-y-auto ${currentSong ? 'pb-28 md:pb-0' : 'pb-16 md:pb-0'}`}>
              <Outlet />
            </div>
          </div>

          {/* Right Panel: Now Playing — hidden on mobile (use full-screen overlay instead) */}
          <div className="hidden md:flex flex-shrink-0 overflow-hidden h-full">
            <NowPlaying />
          </div>
        </div>

        {/* Mobile-only: full-screen Now Playing overlay */}
        {isMobileNowPlayingOpen && (
          <div className="fixed inset-0 z-[90] md:hidden">
            <NowPlaying
              mobileFullscreen
              onClose={() => setMobileNowPlayingOpen(false)}
            />
          </div>
        )}

        {/* Mobile: Download Progress Widget (when modal is minimized) */}
        <div className="md:hidden">
          <DownloadProgressWidget />
        </div>

        {/* Mobile: Mini Player above bottom nav */}
        <div className="md:hidden">
          <MiniPlayer />
        </div>

        {/* Mobile: Bottom Navigation */}
        <div className="md:hidden">
          <BottomNav />
        </div>

        {/* Global Modals */}
        <PlaylistDownloadModal />
      </GlobalAudio>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="library" element={<Library />} />
          <Route path="playlist/:id" element={<PlaylistPage />} />
          <Route path="discover/:id" element={<DiscoverPlaylist />} />
          <Route path="downloads" element={<Downloads />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

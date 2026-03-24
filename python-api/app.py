from flask import Flask, request, jsonify, Response, redirect, stream_with_context # type: ignore
from flask_cors import CORS # type: ignore
from ytmusicapi import YTMusic # type: ignore
import yt_dlp # type: ignore
import requests # type: ignore
from pytubefix import YouTube # type: ignore
from pytubefix.cli import on_progress # type: ignore
import threading
import logging
import re
import os
import sys

app = Flask(__name__)
CORS(app)

# ─── ffmpeg path discovery ───────────────────────────────────────────────────
def _find_ffmpeg() -> str | None:
    """Find ffmpeg.exe: same dir as script/exe → parent dir → MEIPASS."""
    candidates = []
    base = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
    candidates.append(os.path.join(base, 'ffmpeg.exe'))
    candidates.append(os.path.join(os.path.dirname(base), 'ffmpeg.exe'))
    if hasattr(sys, '_MEIPASS'):
        candidates.append(os.path.join(sys._MEIPASS, 'ffmpeg.exe'))  # type: ignore[attr-defined]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

FFMPEG_LOCATION: str | None = _find_ffmpeg()
FFMPEG_DIR: str | None = os.path.dirname(FFMPEG_LOCATION) if FFMPEG_LOCATION else None

# Windows flag — prevents console windows from flashing when spawning ffmpeg
CREATE_NO_WINDOW: int = 0x08000000 if os.name == 'nt' else 0

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize YTMusic (no auth needed for search)
ytmusic = YTMusic()
logger.info("YTMusic API initialized")

# yt-dlp options for extracting audio URLs
YDL_OPTS = {
    'format': 'bestaudio/best',
    'quiet': True,
    'no_warnings': True,
    'extract_flat': False,
    'noplaylist': True,
    'ffmpeg_location': FFMPEG_LOCATION,
    'extractor_args': {
        'youtube': {
            'player_client': ['ios', 'tv', 'web']
        }
    }
}


@app.route('/api/music/search', methods=['GET'])
def search_music():
    """Search for songs using ytmusicapi."""
    query = request.args.get('q', '').strip()
    req_type = request.args.get('type', '').strip()
    if not query:
        return jsonify({'error': 'Search query is required'}), 400

    try:
        if req_type == 'songs':
            results = ytmusic.search(query, filter='songs', limit=10)
        else:
            try:
                results = ytmusic.search(query, filter=None, limit=20)
            except Exception as filter_error:
                logger.warning(f"Unfiltered search failed: {filter_error}. Using multi-query fallback.")
                songs = ytmusic.search(query, filter='songs', limit=10)
                albums = ytmusic.search(query, filter='albums', limit=5)
                playlists = ytmusic.search(query, filter='playlists', limit=5)
                results = songs + albums + playlists

        # Transform results to match frontend expected format
        items = []
        for item in results:
            r_type = item.get('resultType')
            if r_type not in ['song', 'video', 'album', 'playlist']:
                continue

            thumbnails = sorted(
                item.get('thumbnails', []),
                key=lambda t: t.get('width', 0),
                reverse=True
            )

            artist_name = ''
            artists = item.get('artists', [])
            if isinstance(artists, list) and artists:
                artist_name = artists[0].get('name', 'Unknown Artist')
            elif isinstance(artists, dict):
                artist_name = artists.get('name', 'Unknown Artist')

            album_name = ''
            album = item.get('album')
            if isinstance(album, dict):
                album_name = album.get('name', '')

            duration_seconds = None
            duration_str = item.get('duration', '')
            if duration_str:
                parts = str(duration_str).split(':')
                try:
                    if len(parts) == 2:
                        duration_seconds = int(parts[0]) * 60 + int(parts[1])
                    elif len(parts) == 3:
                        duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                except ValueError:
                    pass

            frontend_type = 'SONG'
            if r_type == 'album':
                frontend_type = 'ALBUM'
            elif r_type == 'playlist':
                frontend_type = 'PLAYLIST'

            items.append({
                'type': frontend_type,
                'videoId': item.get('videoId', ''),
                'browseId': item.get('browseId', ''),
                'name': item.get('title', 'Unknown'),
                'artist': {'name': artist_name},
                'album': {'name': album_name},
                'thumbnails': thumbnails,
                'duration': duration_seconds,
            })

        return jsonify(items)

    except Exception as e:
        import traceback
        logger.error(f"Search error:\n{traceback.format_exc()}")
        return jsonify({'error': 'Failed to search music'}), 500


@app.route('/api/music/browse', methods=['GET'])
def browse_music():
    """Fetch all songs from a YT Music Playlist or Album using its browseId."""
    browse_id = request.args.get('id', '').strip()
    if not browse_id:
        return jsonify({'error': 'Browse ID is required'}), 400

    try:
        results = []
        is_album = browse_id.startswith('MPRE')
        
        if is_album:
            data = ytmusic.get_album(browse_id)
            tracks = data.get('tracks', [])
            album_thumbnail = data.get('thumbnails', [])
            album_name = data.get('title', '')
            for item in tracks:
                artist_name = ''
                artists = item.get('artists', [])
                if isinstance(artists, list) and artists:
                    artist_name = artists[0].get('name', 'Unknown Artist')
                
                results.append({
                    'type': 'SONG',
                    'videoId': item.get('videoId', ''),
                    'name': item.get('title', 'Unknown'),
                    'artist': {'name': artist_name},
                    'album': {'name': album_name},
                    'thumbnails': album_thumbnail,
                    'duration': item.get('duration_seconds')
                })
                
        else:
            clean_id = browse_id
            if clean_id.startswith('VL'):
                clean_id = clean_id[2:]
                
            try:
                if clean_id.startswith('RD'):
                    data = ytmusic.get_watch_playlist(playlistId=clean_id, limit=100)
                else:
                    data = ytmusic.get_playlist(clean_id, limit=100)
            except Exception as e:
                logger.error(f"ytmusicapi failed to fetch playlist {clean_id}: {e}")
                return jsonify({'error': 'Playlist is private or inaccessible'}), 404

            tracks = data.get('tracks', [])
            for item in tracks:
                artist_name = ''
                artists = item.get('artists', [])
                if isinstance(artists, list) and artists:
                    artist_name = artists[0].get('name', 'Unknown Artist')
                
                album_name = ''
                album = item.get('album')
                if isinstance(album, dict):
                    album_name = album.get('name', '')
                    
                duration_seconds = item.get('duration_seconds')
                if not duration_seconds:
                    duration_str = item.get('duration', '')
                    if duration_str:
                        parts = str(duration_str).split(':')
                        try:
                            if len(parts) == 2:
                                duration_seconds = int(parts[0]) * 60 + int(parts[1])
                            elif len(parts) == 3:
                                duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                        except ValueError:
                            pass

                results.append({
                    'type': 'SONG',
                    'videoId': item.get('videoId', ''),
                    'name': item.get('title', 'Unknown'),
                    'artist': {'name': artist_name},
                    'album': {'name': album_name},
                    'thumbnails': item.get('thumbnails', data.get('thumbnails', [])),
                    'duration': duration_seconds
                })
                
        return jsonify({
            'title': data.get('title', 'Mix' if browse_id.startswith('RD') else 'Unknown Playlist/Album'),
            'description': data.get('description', ''),
            'thumbnails': data.get('thumbnails', []),
            'songs': results
        })

    except Exception as e:
        logger.error(f"Browse error: {e}")
        return jsonify({'error': 'Failed to browse music'}), 500

@app.route('/api/music/upnext', methods=['GET'])
def get_up_next():
    """Fetch 'Up Next' auto-play recommendations based on a videoId."""
    video_id = request.args.get('videoId', '').strip()
    if not video_id:
        return jsonify({'error': 'videoId is required'}), 400

    try:
        # get_watch_playlist returns the current song + recommend "up next" songs
        watch_data = ytmusic.get_watch_playlist(videoId=video_id, limit=20)
        tracks = watch_data.get('tracks', [])
        
        songs = []
        # Usually the first track is the requested videoId, following are recommendations
        for item in tracks:
            if item.get('videoId') == video_id:
                continue # Skip the song we are currently playing

            item_video_id = item.get('videoId', '')
            
            # get_watch_playlist returns empty thumbnails[] for tracks.
            # Build URLs directly from videoId — YouTube always serves these:
            if item_video_id:
                thumbnails = [
                    {'url': f'https://i.ytimg.com/vi/{item_video_id}/maxresdefault.jpg', 'width': 1280, 'height': 720},
                    {'url': f'https://i.ytimg.com/vi/{item_video_id}/hqdefault.jpg', 'width': 480, 'height': 360},
                ]
            else:
                thumbnails = []

            artist_name = ''
            artists = item.get('artists', [])
            if artists:
                artist_name = artists[0].get('name', 'Unknown Artist')

            album_name = ''
            album = item.get('album')
            if album:
                album_name = album.get('name', '')
                
            duration_seconds = None
            duration_str = item.get('length', '') # get_watch_playlist uses 'length'
            if duration_str:
                parts = str(duration_str).split(':')
                try:
                    if len(parts) == 2:
                        duration_seconds = int(parts[0]) * 60 + int(parts[1])
                    elif len(parts) == 3:
                        duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                except ValueError:
                    pass

            songs.append({
                'type': 'SONG',
                'videoId': item.get('videoId', ''),
                'name': item.get('title', 'Unknown'),
                'artist': {'name': artist_name},
                'album': {'name': album_name},
                'thumbnails': thumbnails,
                'duration': duration_seconds,
            })

        return jsonify(songs)

    except Exception as e:
        logger.error(f"Up Next error: {e}")
        return jsonify({'error': f'Failed to fetch recommendations: {str(e)}'}), 500


@app.route('/api/music/stream/<video_id>', methods=['GET'])
def stream_audio(video_id):
    """Extract audio stream URL with pytubefix and proxy audio to client."""
    if not video_id:
        return jsonify({'error': 'Video ID is required'}), 400

    url = f'https://music.youtube.com/watch?v={video_id}'

    # First attempt with fast pytubefix
    try:
        yt = YouTube(url, use_oauth=False, allow_oauth_cache=True)
        stream = yt.streams.get_audio_only()
        if stream and stream.url:
            return redirect(stream.url)
    except Exception as e:
        logger.warning(f"pytubefix failed for {video_id}, falling back to yt-dlp: {e}")

    # Fallback to robust yt-dlp
    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = ydl.extract_info(url, download=False)

        # Find best audio-only format
        formats = info.get('formats', [])
        audio_format = None

        # Prefer audio-only formats sorted by quality
        audio_only = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
        if audio_only:
            # Sort by audio bitrate (abr), pick highest
            audio_only.sort(key=lambda f: f.get('abr', 0) or 0, reverse=True)
            audio_format = audio_only[0]
        else:
            # Fallback: any format with audio
            with_audio = [f for f in formats if f.get('acodec') != 'none']
            if with_audio:
                audio_format = with_audio[-1]

        if not audio_format or not isinstance(audio_format, dict) or not audio_format.get('url'):
            return jsonify({'error': 'No audio stream found'}), 404

        stream_url = str(audio_format.get('url', '')) # type: ignore
        return redirect(stream_url)

    except Exception as e:
        logger.error(f"Streaming error: {e}")
        return jsonify({'error': f'Failed to stream audio: {str(e)}'}), 500


@app.route('/api/spotify/import', methods=['POST'])
def import_spotify_playlist():
    """Scrape Spotify Embed widget for playlist metadata without official API keys."""
    data = request.json or {}
    playlist_url = data.get('playlistUrl', '').strip()
    
    if not playlist_url:
        return jsonify({'error': 'playlistUrl is required'}), 400

    # Extract playlist ID from URL (e.g., https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...)
    match = re.search(r'playlist/([a-zA-Z0-9]+)', playlist_url)
    if not match:
        return jsonify({'error': 'Invalid Spotify playlist URL'}), 400
        
    playlist_id = match.group(1)
    embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    try:
        res = requests.get(embed_url, headers=headers, timeout=10)
        res.raise_for_status()
        
        # Extract the hidden __NEXT_DATA__ JSON payload from the HTML
        json_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>', res.text)
        if not json_match:
            return jsonify({'error': 'Could not extract playlist data. Spotify may have changed their embed structure.'}), 500
            
        import json
        state = json.loads(json_match.group(1))
        
        # Navigate the JSON tree
        entity = state.get('props', {}).get('pageProps', {}).get('state', {}).get('data', {}).get('entity', {})
        
        playlist_name = entity.get('name', 'Unknown Playlist')
        description = entity.get('description', '')
        cover_art = entity.get('coverArt', {}).get('sources', [{}])[0].get('url', '')
        
        track_list = entity.get('trackList', [])
        formatted_tracks = []
        
        for t in track_list:
            # We don't want greyed out/unplayable local files
            if t.get('isPlayable') is False:
                continue
                
            formatted_tracks.append({
                'title': t.get('title', 'Unknown Title'),
                'artist': t.get('subtitle', 'Unknown Artist'),
                'duration': t.get('duration', 0) // 1000, # ms to seconds
                'albumArt': t.get('coverArt', {}).get('extractedColors', {}).get('colorDark', {}).get('hex', '') or t.get('coverArt', {}).get('sources', [{}])[0].get('url', ''),
                'spotifyId': t.get('uri', '').split(':')[-1]
            })
            
        return jsonify({
            'playlistName': playlist_name,
            'description': description,
            'coverArt': cover_art,
            'totalTracks': len(formatted_tracks),
            'tracks': formatted_tracks
        })
        
    except Exception as e:
        logger.error(f"Spotify Scraper error: {e}")
        return jsonify({'error': f'Failed to parse Spotify embed: {str(e)}'}), 500

@app.route('/api/music/stream-url/<video_id>', methods=['GET'])
def get_stream_url(video_id):
    """Return the direct audio stream URL (for debugging/testing)."""
    if not video_id:
        return jsonify({'error': 'Video ID is required'}), 400

    url = f'https://music.youtube.com/watch?v={video_id}'

    # First attempt with fast pytubefix
    try:
        yt = YouTube(url, use_oauth=False, allow_oauth_cache=True)
        stream = yt.streams.get_audio_only()
        if stream and stream.url:
            return jsonify({
                'url': stream.url,
                'format': 'pytubefix',
                'ext': stream.mime_type.split('/')[-1] if stream.mime_type else '',
                'abr': getattr(stream, 'abr', 0),
                'acodec': getattr(stream, 'audio_codec', ''),
            })
    except Exception as e:
        logger.warning(f"pytubefix get_stream_url failed for {video_id}, falling back: {e}")

    # Fallback to robust yt-dlp
    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = ydl.extract_info(url, download=False)

        formats = info.get('formats', [])
        audio_only = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
        if audio_only:
            audio_only.sort(key=lambda f: f.get('abr', 0) or 0, reverse=True)
            audio_format = audio_only[0]
        else:
            with_audio = [f for f in formats if f.get('acodec') != 'none']
            audio_format = with_audio[-1] if with_audio else None

        if not audio_format:
            return jsonify({'error': 'No audio stream found'}), 404

        return jsonify({
            'url': audio_format['url'],
            'format': audio_format.get('format', ''),
            'ext': audio_format.get('ext', ''),
            'abr': audio_format.get('abr', 0),
            'acodec': audio_format.get('acodec', ''),
        })

    except Exception as e:
        logger.error(f"Stream URL error: {e}")
        return jsonify({'error': str(e)}), 500



# ─── Download cancellation system ───────────────────────────────────────────
# Maps session_id -> threading.Event  (set = cancelled)
cancel_events: dict = {}
# Maps session_id -> list of Popen objects
active_procs: dict = {}

def _kill_procs_for_session(session_id: str):
    """Kill all tracked ffmpeg subprocesses for a session."""
    import subprocess
    procs = active_procs.pop(session_id, [])
    for proc in procs:
        if proc and proc.poll() is None:
            try:
                if os.name == 'nt':
                    subprocess.run(
                        ['taskkill', '/F', '/T', '/PID', str(proc.pid)],
                        creationflags=CREATE_NO_WINDOW, capture_output=True
                    )
                else:
                    import signal
                    proc.send_signal(signal.SIGTERM)
            except Exception as e:
                logger.warning(f"Could not kill proc {proc.pid}: {e}")

@app.route('/api/music/cancel-downloads', methods=['POST'])
def cancel_all_downloads():
    """Cancel all active downloads for all sessions."""
    data = request.json or {}
    session_id = data.get('sessionId', '__all__')
    killed_sessions = []

    if session_id == '__all__':
        for sid in list(cancel_events.keys()):
            cancel_events[sid].set()
            _kill_procs_for_session(sid)
            killed_sessions.append(sid)
    else:
        if session_id in cancel_events:
            cancel_events[session_id].set()
            _kill_procs_for_session(session_id)
            killed_sessions.append(session_id)

    return jsonify({'success': True, 'cancelled_sessions': killed_sessions})

@app.route('/api/music/download/<video_id>/<filename>', methods=['GET'])
def download_audio(video_id, filename):
    """Download audio as MP3 - filename in URL so browser names it correctly."""
    if not video_id:
        return jsonify({'error': 'Video ID is required'}), 400

    title = request.args.get('title', filename.replace('.mp3', ''))
    safe_title = "".join([c for c in title if c.isalnum() or c in " -_()[]"]).strip()
    if not safe_title:
        safe_title = f"song_{video_id}"

    import tempfile, urllib.parse
    try:
        url = f'https://music.youtube.com/watch?v={video_id}'
        tmpdir = tempfile.mkdtemp()
        out_path = os.path.join(tmpdir, safe_title)
        
        download_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'outtmpl': f"{out_path}.%(ext)s",
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        if FFMPEG_DIR:
            download_opts['ffmpeg_location'] = FFMPEG_DIR
        
        with yt_dlp.YoutubeDL(download_opts) as ydl:
            ydl.download([url])
        
        mp3_path = out_path + '.mp3'
        if not os.path.exists(mp3_path):
            return jsonify({'error': 'Conversion failed — maybe ffmpeg is missing'}), 500
        
        filename_quoted = urllib.parse.quote(f"{safe_title}.mp3")

        def generate():
            with open(mp3_path, 'rb') as f:
                while chunk := f.read(1024 * 1024):
                    yield chunk
            try:
                os.remove(mp3_path)
                os.rmdir(tmpdir)
            except: pass

        return Response(
            generate(),
            content_type='audio/mpeg',
            headers={
                'Content-Disposition': f"attachment; filename*=UTF-8''{filename_quoted}",
                'Content-Length': str(os.path.getsize(mp3_path)),
                'Access-Control-Expose-Headers': 'Content-Disposition',
            }
        )
    except Exception as e:
        logger.error(f"Download error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/music/download-local', methods=['POST'])
def download_audio_local():
    """Download audio directly to C:\\VibraMusicDownloads.
    
    Expects JSON: { videoId, title, artist, thumbnailUrl, duration, sessionId }
    The cancel endpoint POST /api/music/cancel-downloads?sessionId=X stops the download.
    """
    import json as _json, subprocess
    data = request.json or {}
    video_id = data.get('videoId')
    title = data.get('title', f"song_{video_id}")
    artist = data.get('artist', 'Unknown Artist')
    thumbnail = data.get('thumbnailUrl', '')
    duration = data.get('duration', '')
    session_id = data.get('sessionId', 'default')

    if not video_id:
        return jsonify({'error': 'Video ID is required'}), 400

    safe_title = "".join([c for c in title if c.isalnum() or c in " -_()[]"]).strip()
    if not safe_title:
        safe_title = f"song_{video_id}"

    # Get or create a cancel event for this session
    if session_id not in cancel_events:
        cancel_events[session_id] = threading.Event()
    cancel_ev = cancel_events[session_id]

    try:
        yt_url = f'https://music.youtube.com/watch?v={video_id}'
        dest_dir = r"C:\VibraMusicDownloads"
        os.makedirs(dest_dir, exist_ok=True)

        out_path = os.path.join(dest_dir, safe_title)
        mp3_path = out_path + '.mp3'
        json_path = out_path + '.json'

        def write_metadata():
            metadata = {
                'videoId': video_id,
                'title': title,
                'artist': artist,
                'thumbnailUrl': thumbnail,
                'duration': str(duration),
                'filename': f"{safe_title}.mp3"
            }
            with open(json_path, 'w', encoding='utf-8') as f:
                _json.dump(metadata, f, ensure_ascii=False, indent=2)

        # Serve from cache if already downloaded
        if os.path.exists(mp3_path):
            if cancel_ev.is_set():
                return jsonify({'error': 'Cancelled'}), 499
            write_metadata()
            return jsonify({'success': True, 'path': mp3_path, 'cached': True})

        if cancel_ev.is_set():
            return jsonify({'error': 'Cancelled'}), 499

        # Progress hook — called every few KB by yt-dlp.
        # Raising here aborts the download immediately.
        class CancelledError(Exception): pass

        def cancel_hook(d):
            if cancel_ev.is_set():
                raise CancelledError("Download cancelled by user")

        download_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'outtmpl': f"{out_path}.%(ext)s",
            'socket_timeout': 20,
            'progress_hooks': [cancel_hook],
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        if FFMPEG_DIR:
            download_opts['ffmpeg_location'] = FFMPEG_DIR

        try:
            with yt_dlp.YoutubeDL(download_opts) as ydl:
                ydl.download([yt_url])
        except CancelledError:
            # Clean up partial download
            for ext in ['.mp3', '.webm', '.m4a', '.opus', '.part']:
                try: os.remove(out_path + ext)
                except: pass
            return jsonify({'error': 'Cancelled'}), 499

        if not os.path.exists(mp3_path):
            return jsonify({'error': 'Download failed — ensure ffmpeg.exe is in the app folder'}), 500

        write_metadata()
        return jsonify({'success': True, 'path': mp3_path, 'cached': False})

    except Exception as e:
        logger.error(f"Local Download error for {video_id}: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/music/download-local/<path:filename>', methods=['DELETE'])
def delete_local_audio(filename):
    """Delete a downloaded MP3 and its corresponding JSON manifest."""
    dest_dir = r"C:\VibraMusicDownloads"
    # Ensure no path traversal
    safe_name = os.path.basename(filename)
    mp3_path = os.path.join(dest_dir, safe_name)
    json_path = os.path.join(dest_dir, safe_name.replace('.mp3', '.json'))
    
    deleted = False
    try:
        if os.path.exists(mp3_path):
            os.remove(mp3_path)
            deleted = True
        if os.path.exists(json_path):
            os.remove(json_path)
            deleted = True
            
        return jsonify({'success': deleted})
    except Exception as e:
        logger.error(f"Failed to delete local file {filename}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music/local-library', methods=['GET'])
def get_local_library():
    """Scan the downloads directory and return all saved metadata manifests."""
    import glob
    dest_dir = r"C:\VibraMusicDownloads"
    if not os.path.exists(dest_dir):
        return jsonify([])
        
    library = []
    json_files = glob.glob(os.path.join(dest_dir, '*.json'))
    
    for j_path in json_files:
        try:
            import json
            with open(j_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                # Verify the MP3 actually exists
                if os.path.exists(os.path.join(dest_dir, metadata.get('filename', ''))):
                    library.append(metadata)
        except Exception as e:
            logger.error(f"Failed to read metadata {j_path}: {e}")
            
    return jsonify(library)

from flask import send_from_directory # Ensure this is imported

@app.route('/api/music/local-stream/<path:filename>', methods=['GET'])
def serve_local_audio(filename):
    """Serve the local MP3 file directly to the audio tag."""
    dest_dir = r"C:\VibraMusicDownloads"
    return send_from_directory(dest_dir, filename)

@app.route('/', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'YT Music Python API is running'})


if __name__ == '__main__':
    # threaded=True is CRITICAL: it lets the /cancel-downloads endpoint respond
    # while yt-dlp is blocking another request thread.
    # debug=False and use_reloader=False prevent fork-bombing on Windows (PyInstaller).
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False, threaded=True)

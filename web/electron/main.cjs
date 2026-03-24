const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let apiProcess = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
            if (wins[0].isMinimized()) wins[0].restore();
            wins[0].focus();
        }
    });
}

// Poll until the Python backend is ready, then run callback
function waitForApi(url, retries, interval, callback) {
    http.get(url, (res) => {
        callback(); // Backend is up
    }).on('error', () => {
        if (retries > 0) {
            setTimeout(() => waitForApi(url, retries - 1, interval, callback), interval);
        } else {
            console.error('API failed to start in time, loading UI anyway.');
            callback();
        }
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#000000',
        title: "Noizzy",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            autoplayPolicy: "no-user-gesture-required",
            webSecurity: false
        }
    });

    // Allow all external requests (images, audio, API) from YouTube/Google CDN
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Origin'] = 'https://music.youtube.com';
        details.requestHeaders['Referer'] = 'https://music.youtube.com/';
        callback({ requestHeaders: details.requestHeaders });
    });

    // Remove restrictive CSP headers that block external resources
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        delete headers['content-security-policy'];
        delete headers['x-frame-options'];
        callback({ responseHeaders: headers });
    });

    win.setMenuBarVisibility(false);

    const distIndex = path.join(__dirname, '../dist/index.html');
    const fs = require('fs');
    const hasBuiltDist = fs.existsSync(distIndex);
    const isDev = !app.isPackaged && !hasBuiltDist;

    if (isDev) {
        win.loadURL('http://localhost:5173');
    } else {
        // Resolve api.exe: packaged app uses process.resourcesPath, 
        // unpackaged run uses the python-api/dist folder next to web/
        const apiPath = app.isPackaged
            ? path.join(process.resourcesPath, 'api.exe')
            : path.join(__dirname, '../../python-api/dist/api.exe');
        
        const apiDir = path.dirname(apiPath);

        const { execSync } = require('child_process');
        try {
            // Kill any zombie python backends from previous crashes (like the run-noizzy.bat script does)
            execSync('taskkill /f /im api.exe', { stdio: 'ignore' });
        } catch(e) {
            // Ignore errors if no process was running
        }

        apiProcess = spawn(apiPath, [], {
            detached: false,
            windowsHide: true,
            cwd: apiDir
        });

        apiProcess.stdout.on('data', (data) => console.log(`API: ${data}`));
        apiProcess.stderr.on('data', (data) => console.error(`API Error: ${data}`));

        // Wait up to 30 seconds for the backend to be ready, then load the UI
        waitForApi('http://127.0.0.1:5001/', 60, 500, () => {
            win.loadFile(distIndex);
        });
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (apiProcess) {
        apiProcess.kill();
    }
});

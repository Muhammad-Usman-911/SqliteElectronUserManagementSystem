const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const puppeteer = require('puppeteer-core');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const url = require('url');

// Import the database with the correct path management
const db = require('./database');

let mainWindow;
let puppeteerWindow = null;

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false;

// Auto-updater variables
let updateAvailable = false;
let updateInfo = null;

// Function to get Chrome path based on platform
function getChromePath() {
    switch (process.platform) {
        case 'win32':
            return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        case 'darwin':
            return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        case 'linux':
            return '/usr/bin/google-chrome';
        default:
            throw new Error('Unsupported platform');
    }
}

// Create main application window
app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        
    });
    mainWindow.maximize();
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    // Check for updates after the window is created
    setTimeout(() => {
        checkForUpdates();
    }, 2000);
});

// Auto-updater functions
function checkForUpdates() {
    autoUpdater.checkForUpdates()
        .catch(err => {
            log.error('Error checking for updates:', err);
        });
}

// Update event listeners
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    updateAvailable = true;
    updateInfo = info;
    
    // Notify the renderer process about the update
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', {
            version: info.version,
            releaseNotes: info.releaseNotes
        });
    }
});

autoUpdater.on('update-not-available', () => {
    log.info('No updates available');
});

autoUpdater.on('download-progress', (progressObj) => {
    let logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    log.info(logMessage);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', progressObj.percent);
    }
});

autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded');
    }
});

autoUpdater.on('error', (err) => {
    log.error('Error during update:', err);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', err.message);
    }
});

// IPC handlers for update actions
ipcMain.handle('start-update-download', () => {
    if (updateAvailable) {
        autoUpdater.downloadUpdate();
        return { success: true };
    }
    return { success: false, message: 'No update available' };
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
});


function createPuppeteerWindow() {
    // If a window already exists, focus it but don't create a new one
    if (puppeteerWindow && !puppeteerWindow.isDestroyed()) {
        puppeteerWindow.focus();
        return puppeteerWindow;
    }

    // Create a new browser window for puppeteer
    puppeteerWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        title: 'Facebook Login',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            partition: 'facebook' // Use a persistent session
        }
    });

    // Handle window close event - just hide the window instead of destroying it
    puppeteerWindow.on('close', (event) => {
        event.preventDefault();
        puppeteerWindow.hide();
        return false;
    });

    return puppeteerWindow;
}

// Handle Facebook Login with separate browser window
ipcMain.handle("login-facebook", async (event, { email, password }) => {
    try {
        // Create a separate browser window for puppeteer
        const fbWindow = createPuppeteerWindow();
        
        // Show the window
        fbWindow.show();
        
        // Navigate to Facebook login page
        fbWindow.loadURL('https://www.facebook.com');
        
        // Wait for page to load
        await new Promise(resolve => {
            fbWindow.webContents.once('did-finish-load', resolve);
        });
        
        // Execute Facebook login script
        await fbWindow.webContents.executeJavaScript(`
            (async () => {
                // Wait for email field
                const emailField = document.querySelector('#email');
                if (emailField) {
                    emailField.value = "${email}";
                    document.querySelector('#pass').value = "${password}";
                    document.querySelector('button[name="login"]').click();
                }
                return true;
            })()
        `);
        
        // Wait for login to complete (wait for Home/News Feed text)
        await new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
                try {
                    const isLoggedIn = await fbWindow.webContents.executeJavaScript(`
                        document.body.innerText.includes('Home') || 
                        document.body.innerText.includes('News Feed')
                    `);
                    
                    const hasCaptcha = await fbWindow.webContents.executeJavaScript(`
                        !!document.querySelector('iframe[title*="reCAPTCHA"]')
                    `);
                    
                    const has2FA = await fbWindow.webContents.executeJavaScript(`
                        !!document.querySelector('input[name="approvals_code"]')
                    `);
                    
                    if (isLoggedIn) {
                        clearInterval(checkInterval);
                        resolve(true);
                    } else if (hasCaptcha) {
                        mainWindow.webContents.send('show-notification', {
                            title: 'CAPTCHA Required',
                            message: 'Please complete the CAPTCHA to continue'
                        });
                    } else if (has2FA) {
                        mainWindow.webContents.send('show-notification', {
                            title: '2FA Required',
                            message: 'Please complete the two-factor authentication'
                        });
                    }
                } catch (err) {
                    // Window might be navigating, just continue checking
                }
            }, 1000);
            
            // Set a timeout for login
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Login timeout exceeded'));
            }, 60000);
        });
        
        // Get cookies from the browser window
        const cookies = await fbWindow.webContents.session.cookies.get({});
        
        // Extract user info
        const nickname = email.split('@')[0];
        
        // Save to database
        const savedId = await saveAccountToDB({
            user_name: nickname,
            email: email,
            password: password,
            cookies: JSON.stringify(cookies),
            type: 'facebook'
        });
        
        // Note: We don't close the window, we keep it open as requested
        // But we show a success message to the user
        mainWindow.webContents.send('show-notification', {
            title: 'Login Successful',
            message: 'Facebook account has been saved successfully!'
        });
        
        return {
            success: true,
            message: 'Facebook login successful!'
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Facebook login error:', errorMessage);
        
        return { 
            success: false, 
            error: errorMessage 
        };
    }
});

// Database helper functions
async function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM user WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

async function updateUserCookies(id, cookies) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE user SET cookies = ? WHERE id = ?",
            [cookies, id],
            function (err) {
                if (err) reject(err);
                resolve(this.changes);
            }
        );
    });
}

// Save account to database
async function saveAccountToDB(userData) {
    console.log('Facebook Saving User ! : ', userData);
    return new Promise((resolve, reject) => {
        const { user_name, email, password, cookies, type } = userData;
        db.run(
            "INSERT INTO user (user_name, email, password, cookies, type) VALUES (?, ?, ?, ?, ?)",
            [user_name, email, password, cookies, type],
            function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Add a new user
ipcMain.handle("add-user", async (event, user) => {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO user (user_name, email, password, cookies) VALUES (?, ?, ?, ?)",
            [user.user_name, user.email, user.password, user.cookies], function (err) {
                if (err) reject(err);
                resolve(this.lastID);
            }
        );
    });
});

// Get all users
ipcMain.handle("get-users", async () => {
    try {
        return await new Promise((resolve, reject) => {
            db.all("SELECT * FROM user", [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to fetch users");
    }
});

// Delete user
ipcMain.handle("delete-user", async (event, id) => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM user WHERE id = ?", [id], function (err) {
            if (err) reject(err);
            resolve(true);
        });
    });
});

// Update user
ipcMain.handle("update-user", async (event, user) => {
    return new Promise((resolve, reject) => {
        db.run("UPDATE user SET user_name = ?, email = ?, password = ?, cookies = ?, two_fa_code = ? WHERE id = ?",
            [user.user_name, user.email, user.password, user.cookies, user.twoFA, user.id], function (err) {
                if (err) reject(err);
                resolve(true);
            }
        );
    });
});

// Login with saved account
ipcMain.handle("login-saved-account", async (event, id) => {
    try {
        // Create a separate browser window for the saved account login
        const fbWindow = createPuppeteerWindow();
        fbWindow.show();
        
        const user = await getUserById(id);
        if (!user || !user.cookies) {
            throw new Error("No saved cookies found");
        }
        
        // Load cookies
        const cookies = JSON.parse(user.cookies);
        for (const cookie of cookies) {
            try {
                await fbWindow.webContents.session.cookies.set({
                    url: 'https://www.facebook.com',
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain || '.facebook.com',
                    path: cookie.path || '/',
                    secure: cookie.secure !== undefined ? cookie.secure : true,
                    httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : true,
                    expirationDate: cookie.expirationDate || (Math.floor(Date.now() / 1000) + 31536000) // 1 year from now if not specified
                });
            } catch (err) {
                console.log('Error setting cookie:', err);
                // Continue with other cookies
            }
        }
        
        // Navigate to Facebook
        fbWindow.loadURL('https://www.facebook.com');
        
        // Wait for page to load
        await new Promise(resolve => {
            fbWindow.webContents.once('did-finish-load', resolve);
        });
        
        // Check if logged in
        const isLoggedIn = await fbWindow.webContents.executeJavaScript(`
            document.body.innerText.includes('Home') || 
            document.body.innerText.includes('News Feed')
        `);
        
        if (!isLoggedIn) {
            // Cookies expired, try regular login
            fbWindow.loadURL('https://www.facebook.com/login');
            
            // Wait for login page
            await new Promise(resolve => {
                fbWindow.webContents.once('did-finish-load', resolve);
            });
            
            // Execute login
            await fbWindow.webContents.executeJavaScript(`
                (async () => {
                    const emailField = document.querySelector('#email');
                    if (emailField) {
                        emailField.value = "${user.email}";
                        document.querySelector('#pass').value = "${user.password}";
                        document.querySelector('[name="login"]').click();
                    }
                    return true;
                })()
            `);
            
            // Wait for login to complete
            await new Promise((resolve, reject) => {
                const checkInterval = setInterval(async () => {
                    try {
                        const success = await fbWindow.webContents.executeJavaScript(`
                            document.body.innerText.includes('Home') || 
                            document.body.innerText.includes('News Feed')
                        `);
                        
                        if (success) {
                            clearInterval(checkInterval);
                            resolve(true);
                        }
                    } catch (err) {
                        // Window might be navigating, just continue checking
                    }
                }, 1000);
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Login timeout exceeded'));
                }, 30000);
            });
            
            // Update cookies
            const newCookies = await fbWindow.webContents.session.cookies.get({});
            await updateUserCookies(id, JSON.stringify(newCookies));
        }
        
        // Display a notification in the main window about successful login
        mainWindow.webContents.send('show-notification', {
            title: 'Login Successful',
            message: 'Facebook account has been logged in successfully!'
        });
        
        // Note: Window remains open as requested
        
        return { success: true, message: "Logged in successfully!" };
    } catch (error) {
        console.error('Saved account login error:', error);
        
        mainWindow.webContents.send('show-notification', {
            title: 'Login Failed',
            message: error.message
        });
        
        return { success: false, message: error.message };
    }
});

// Handle app events
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});


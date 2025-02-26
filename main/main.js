// /**
//  * 
//  * I have one table user table
//  * with columns: id (pk), name, email, password,cookies and type
//  * type can be mannual or facebook.
//  * 
//  * 
//  *  
//  */


// const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// const puppeteer = require('puppeteer-core');
// const db = require('./database');
// const path = require('path');

// let mainWindow;

// // Function to get Chrome path based on platform
// function getChromePath() {
//     switch (process.platform) {
//         case 'win32':
//             return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
//         case 'darwin':
//             return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
//         case 'linux':
//             return '/usr/bin/google-chrome';
//         default:
//             throw new Error('Unsupported platform');
//     }
// }

// app.whenReady().then(() => {
//     mainWindow = new BrowserWindow({
//         width: 800,
//         height: 600,
//         webPreferences: {
//             nodeIntegration: true,
//             contextIsolation: false
//         }
//     });

//     mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
// });

// // Handle Facebook Login with Cookie Management
// ipcMain.handle("login-facebook", async (event, { email, password }) => {

//     let browser;
//     try {
//         // Launch Puppeteer setup remains the same...
//         browser = await puppeteer.launch({
//             executablePath: process.env.CHROME_EXECUTABLE_PATH || getChromePath(),
//             headless: false,
//             args: ['--no-sandbox', '--disable-setuid-sandbox'],
//         });

//         const page = await browser.newPage();
//         await page.setDefaultNavigationTimeout(0);
//         await page.setDefaultTimeout(0);

//         // Login flow remains the same...
//         await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle0' });
//         await page.waitForSelector('#email', { visible: true });
//         await page.type('#email', email);
//         await page.waitForSelector('#pass', { visible: true });
//         await page.type('#pass', password);

//         await Promise.all([
//             page.click('button[name="login"]'),
//             page.waitForNavigation({ waitUntil: 'domcontentloaded' })
//         ]);

//         // CAPTCHA and 2FA handling remains the same...
//         const recaptchaSelector = 'iframe[title*="reCAPTCHA"]';
//         if (await page.$(recaptchaSelector)) {
//             console.log('CAPTCHA detected! Waiting for user to solve it...');
//             await dialog.showMessageBox({
//                 type: 'info',
//                 buttons: ['OK'],
//                 title: 'Solve CAPTCHA',
//                 message: 'A CAPTCHA has been detected. Please solve it manually in the opened browser window.',
//             });
//             await page.waitForFunction(() => {
//                 return !document.querySelector('iframe[title*="reCAPTCHA"]');
//             }, { timeout: 0 });
//         }

//         const twoFactorSelector = 'input[name="approvals_code"]';
//         if (await page.$(twoFactorSelector)) {
//             console.log('2FA detected! Waiting for user input...');
//             await dialog.showMessageBox({
//                 type: 'info',
//                 buttons: ['OK'],
//                 title: 'Two-Factor Authentication',
//                 message: 'Facebook requires 2FA. Please enter the code manually in the opened browser window.',
//             });
//             await page.waitForFunction(() => {
//                 return document.body.innerText.includes('News Feed') || document.body.innerText.includes('Home');
//             }, { timeout: 0 });
//         }

//         await page.waitForFunction(() => {
//             return document.body.innerText.includes('Home') || document.body.innerText.includes('News Feed');
//         }, { timeout: 0 });

//         // Extract User Info
//         const userData = await page.evaluate(() => {
//             return {
//                 automation: true,
//                 pageTitle: document.title,
//                 currentUrl: window.location.href
//             };
//         });
//         // Get Cookies
//         const cookies = await page.cookies();
//         // console.log('Cookies:', cookies);
//         // console.log('Login successful:', userData);
//         // Save to database
//         try {
//             const nickname = email.split('@')[0]; // Use email username as default nickname
//             const savedId = await saveAccountToDB({
//                 name: nickname,
//                 email: email,
//                 password: password,
//                 cookies: JSON.stringify(cookies),
//                 type: 'facebook'
//             });

//             return { 
//                 success: true, 
//             };
//         } catch (dbError) {
//             throw new Error(`Failed to save account: ${dbError.message}`);
//         }

//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : String(error);
//         console.error('Facebook login error:', errorMessage);
//         return { success: false, error: errorMessage };
//     } finally {
//         if (browser) await browser.close();
//     }
// });

// // Database helper functions remain the same
// async function getUserById(id) {
//     return new Promise((resolve, reject) => {
//         db.get("SELECT * FROM user WHERE id = ?", [id], (err, row) => {
//             if (err) reject(err);
//             resolve(row);
//         });
//     });
// }

// async function updateUserCookies(id, cookies) {
//     return new Promise((resolve, reject) => {
//         db.run("UPDATE user SET cookies = ? WHERE id = ?",
//             [cookies, id],
//             function (err) {
//                 if (err) reject(err);
//                 resolve(this.changes);
//             }
//         );
//     });
// }

// // Modified function to save account to database
// async function saveAccountToDB(userData) {
//     console.log('Facebook Saving User ! : ',userData);
//     return new Promise((resolve, reject) => {
//         const { name, email, password, cookies, type } = userData;
//         db.run(
//             "INSERT INTO user (name, email, password, cookies, type) VALUES (?, ?, ?, ?, ?)",
//             [name, email, password, cookies, type],
//             function(err) {
//                 if (err) reject(err);
//                 resolve(this.lastID);
//             }
//         );
//     });
// }



// // ---------------------------------------------------------------------


// // Add a new user
// ipcMain.handle("add-user", async (event, user) => {
//     return new Promise((resolve, reject) => {
//         db.run("INSERT INTO user (name, email, password, cookies, two_fa_code) VALUES (?, ?, ?, ?, ?)",
//             [user.name, user.email, user.password, user.cookies, user.twoFA], function (err) {
//                 if (err) reject(err);
//                 resolve(this.lastID);
//             }
//         );
//     });
// });

// // Get all users
// ipcMain.handle("get-users", async () => {
//     return new Promise((resolve, reject) => {
//         db.all("SELECT * FROM user", [], (err, rows) => {
//             if (err) reject(err);
//             resolve(rows);
//         });
//     });
// });

// // Delete user
// ipcMain.handle("delete-user", async (event, id) => {
//     return new Promise((resolve, reject) => {
//         db.run("DELETE FROM user WHERE id = ?", [id], function (err) {
//             if (err) reject(err);
//             resolve(true);
//         });
//     });
// });

// // Update user
// ipcMain.handle("update-user", async (event, user) => {
//     return new Promise((resolve, reject) => {
//         db.run("UPDATE user SET name = ?, email = ?, password = ?, cookies = ?, two_fa_code = ? WHERE id = ?",
//             [user.name, user.email, user.password, user.cookies, user.twoFA, user.id], function (err) {
//                 if (err) reject(err);
//                 resolve(true);
//             }
//         );
//     });
// });


// // -------------- LOGIN WITH COOKIES -----------------
// // Modified saved account login handler
// ipcMain.handle("login-saved-account", async (event, id) => {
//     let browser;
//     try {
//         const user = await getUserById(id);
//         if (!user || !user.cookies) {
//             throw new Error("No saved cookies found");
//         }

//         browser = await puppeteer.launch({
//             headless: false,
//             executablePath: getChromePath(),
//             args: ['--no-sandbox', '--disable-setuid-sandbox']
//         });

//         const page = await browser.newPage();
//         const cookies = JSON.parse(user.cookies);
//         await page.setCookie(...cookies);
//         await page.goto("https://www.facebook.com", { waitUntil: 'networkidle0' });

//         const isLoggedIn = await page.evaluate(() => {
//             return document.body.innerText.includes('Home') ||
//                    document.body.innerText.includes('News Feed');
//         });

//         if (!isLoggedIn) {
//             // Cookies expired, try regular login
//             await page.goto("https://www.facebook.com/login", { waitUntil: 'networkidle0' });
//             await page.type("#email", user.email);
//             await page.type("#pass", user.password);
//             await page.click('[name="login"]');

//             await page.waitForFunction(
//                 () => document.body.innerText.includes('Home') ||
//                       document.body.innerText.includes('News Feed'),
//                 { timeout: 30000 }
//             );

//             // Update cookies in database
//             const newCookies = await page.cookies();
//             await updateUserCookies(id, JSON.stringify(newCookies));
//         }

//         return { success: true, message: "Logged in successfully!" };
//     } catch (error) {
//         console.error('Saved account login error:', error);
//         return { success: false, message: error.message };
//     } finally {
//         if (browser) await browser.close();
//     }
// });


const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const puppeteer = require('puppeteer-core');
const db = require('./database');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWindow;

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false;

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

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

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
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Would you like to download it now?`,
        buttons: ['Yes', 'No']
    }).then((buttonIndex) => {
        if (buttonIndex.response === 0) {
            autoUpdater.downloadUpdate();
            
            // Show download progress dialog
            let progressWindow = new BrowserWindow({
                width: 400,
                height: 150,
                alwaysOnTop: true,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });
            
            progressWindow.loadFile(path.join(__dirname, '../renderer/progress.html'));
            progressWindow.setMenuBarVisibility(false);
            
            // Share progress with window
            autoUpdater.on('download-progress', (progressObj) => {
                let logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
                log.info(logMessage);
                progressWindow.webContents.send('download-progress', progressObj.percent);
            });
            
            autoUpdater.on('update-downloaded', () => {
                progressWindow.close();
            });
        }
    });
});

autoUpdater.on('update-not-available', () => {
    log.info('No updates available');
});

autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded');
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The application will restart to install the update.',
        buttons: ['Restart Now', 'Later']
    }).then((buttonIndex) => {
        if (buttonIndex.response === 0) {
            autoUpdater.quitAndInstall(false, true);
        }
    });
});

autoUpdater.on('error', (err) => {
    log.error('Error during update:', err);
    dialog.showErrorBox('Update Error', 'An error occurred while updating: ' + err.message);
});

// Handle Facebook Login with Cookie Management
ipcMain.handle("login-facebook", async (event, { email, password }) => {

    let browser;
    try {
        // Launch Puppeteer setup remains the same...
        browser = await puppeteer.launch({
            executablePath: process.env.CHROME_EXECUTABLE_PATH || getChromePath(),
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(0);
        await page.setDefaultTimeout(0);

        // Login flow remains the same...
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#email', { visible: true });
        await page.type('#email', email);
        await page.waitForSelector('#pass', { visible: true });
        await page.type('#pass', password);

        await Promise.all([
            page.click('button[name="login"]'),
            page.waitForNavigation({ waitUntil: 'domcontentloaded' })
        ]);

        // CAPTCHA and 2FA handling remains the same...
        const recaptchaSelector = 'iframe[title*="reCAPTCHA"]';
        if (await page.$(recaptchaSelector)) {
            console.log('CAPTCHA detected! Waiting for user to solve it...');
            await dialog.showMessageBox({
                type: 'info',
                buttons: ['OK'],
                title: 'Solve CAPTCHA',
                message: 'A CAPTCHA has been detected. Please solve it manually in the opened browser window.',
            });
            await page.waitForFunction(() => {
                return !document.querySelector('iframe[title*="reCAPTCHA"]');
            }, { timeout: 0 });
        }

        const twoFactorSelector = 'input[name="approvals_code"]';
        if (await page.$(twoFactorSelector)) {
            console.log('2FA detected! Waiting for user input...');
            await dialog.showMessageBox({
                type: 'info',
                buttons: ['OK'],
                title: 'Two-Factor Authentication',
                message: 'Facebook requires 2FA. Please enter the code manually in the opened browser window.',
            });
            await page.waitForFunction(() => {
                return document.body.innerText.includes('News Feed') || document.body.innerText.includes('Home');
            }, { timeout: 0 });
        }

        await page.waitForFunction(() => {
            return document.body.innerText.includes('Home') || document.body.innerText.includes('News Feed');
        }, { timeout: 0 });

        // Extract User Info
        const userData = await page.evaluate(() => {
            return {
                automation: true,
                pageTitle: document.title,
                currentUrl: window.location.href
            };
        });
        // Get Cookies
        const cookies = await page.cookies();
        // console.log('Cookies:', cookies);
        // console.log('Login successful:', userData);
        // Save to database
        try {
            const nickname = email.split('@')[0]; // Use email username as default nickname
            const savedId = await saveAccountToDB({
                name: nickname,
                email: email,
                password: password,
                cookies: JSON.stringify(cookies),
                type: 'facebook'
            });

            return { 
                success: true, 
            };
        } catch (dbError) {
            throw new Error(`Failed to save account: ${dbError.message}`);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Facebook login error:', errorMessage);
        return { success: false, error: errorMessage };
    } finally {
        if (browser) await browser.close();
    }
});

// Database helper functions remain the same
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

// Modified function to save account to database
async function saveAccountToDB(userData) {
    console.log('Facebook Saving User ! : ',userData);
    return new Promise((resolve, reject) => {
        const { name, email, password, cookies, type } = userData;
        db.run(
            "INSERT INTO user (name, email, password, cookies, type) VALUES (?, ?, ?, ?, ?)",
            [name, email, password, cookies, type],
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
        db.run("INSERT INTO user (name, email, password, cookies, two_fa_code) VALUES (?, ?, ?, ?, ?)",
            [user.name, user.email, user.password, user.cookies, user.twoFA], function (err) {
                if (err) reject(err);
                resolve(this.lastID);
            }
        );
    });
});

// Get all users
ipcMain.handle("get-users", async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM user", [], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
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
        db.run("UPDATE user SET name = ?, email = ?, password = ?, cookies = ?, two_fa_code = ? WHERE id = ?",
            [user.name, user.email, user.password, user.cookies, user.twoFA, user.id], function (err) {
                if (err) reject(err);
                resolve(true);
            }
        );
    });
});

// -------------- LOGIN WITH COOKIES -----------------
// Modified saved account login handler
ipcMain.handle("login-saved-account", async (event, id) => {
    let browser;
    try {
        const user = await getUserById(id);
        if (!user || !user.cookies) {
            throw new Error("No saved cookies found");
        }

        browser = await puppeteer.launch({
            headless: false,
            executablePath: getChromePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        const cookies = JSON.parse(user.cookies);
        await page.setCookie(...cookies);
        await page.goto("https://www.facebook.com", { waitUntil: 'networkidle0' });

        const isLoggedIn = await page.evaluate(() => {
            return document.body.innerText.includes('Home') ||
                   document.body.innerText.includes('News Feed');
        });

        if (!isLoggedIn) {
            // Cookies expired, try regular login
            await page.goto("https://www.facebook.com/login", { waitUntil: 'networkidle0' });
            await page.type("#email", user.email);
            await page.type("#pass", user.password);
            await page.click('[name="login"]');

            await page.waitForFunction(
                () => document.body.innerText.includes('Home') ||
                      document.body.innerText.includes('News Feed'),
                { timeout: 30000 }
            );

            // Update cookies in database
            const newCookies = await page.cookies();
            await updateUserCookies(id, JSON.stringify(newCookies));
        }

        return { success: true, message: "Logged in successfully!" };
    } catch (error) {
        console.error('Saved account login error:', error);
        return { success: false, message: error.message };
    } finally {
        if (browser) await browser.close();
    }
});
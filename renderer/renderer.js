const { ipcRenderer } = require('electron');

// Tab switching functionality
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`${tab.dataset.form}Form`).classList.add('active');
    });
});

// Show status message
function showStatus(message, isError = false) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${isError ? 'error' : 'success'}`;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Handle manual account submission
// document.getElementById('accountForm').addEventListener('submit', async (e) => {
//     e.preventDefault();

//     const user = {
//         user_name: document.getElementById('name').value,
//         email: document.getElementById('email').value,
//         password: document.getElementById('password').value,
//         loginType: 'manual'
//     };

//     try {
//         await ipcRenderer.invoke('add-user', user);
//         showStatus('Account added successfully!');
//         e.target.reset();
//         loadAccounts();
//     } catch (error) {
//         showStatus('Failed to add account: ' + error.message, true);
//     }
// });

// New Code for addition 
// Handle manual account submission with improved error handling
document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = {
        user_name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        loginType: 'manual',
        cookies: null
    };

    try {
        console.log('Adding new manual account:', user);
        await ipcRenderer.invoke('add-user', user);
        showStatus('Account added successfully!');
        e.target.reset();
        loadAccounts();
    } catch (error) {
        console.error('Failed to add account:', error);
        showStatus('Failed to add account: ' + (error.message || 'Unknown error'), true);
    }
});

// Handle Facebook login submission
document.getElementById('fbForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const loginData = {
        email: document.getElementById('fbEmail').value,
        password: document.getElementById('fbPassword').value
    };

    try {
        showStatus('Facebook Login Started! Please wait...', false);
        const result = await ipcRenderer.invoke('login-facebook', loginData);
        if (result.success) {
            showStatus('Facebook login successful!');
            e.target.reset();
            loadAccounts();
        } else {
            showStatus(result.message || 'Login failed', true);
        }
    } catch (error) {
        showStatus('Login failed: ' + error.message, true);
    }
});

// Load accounts
// async function loadAccounts() {
//     try {
//         const accounts = await ipcRenderer.invoke('get-users');
//         console.log('Accounts : ',accounts);
//         const list = document.getElementById('accountsList');
//         list.innerHTML = accounts.map(acc => `
//             <tr>
//                 <td>${acc.user_name}</td>
//                 <td>${acc.email}</td>
//                 <td>${acc.cookies ? 'Facebook' : 'Manual'}</td>
//                 <td class="action-buttons">
//                     ${acc.cookies ? 
//                         `<button class="login-btn" onclick="loginWithSavedAccount(${acc.id})">Login</button>` : 
//                         ''
//                     }
//                     <button class="edit-btn" onclick="editUser(${acc.id})">Edit</button>
//                     <button class="delete-btn" onclick="deleteUser(${acc.id})">Delete</button>
//                 </td>
//             </tr>
//         `).join('');
//     } catch (error) {
//         showStatus('Failed to load accounts: ' + error.message, true);
//     }
// }

// new loadAccount 
// Load accounts
async function loadAccounts() {
    try {
        console.log('Requesting accounts from main process...');
        const accounts = await ipcRenderer.invoke('get-users');
        console.log('Received accounts:', accounts);

        const list = document.getElementById('accountsList');

        if (!accounts || accounts.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center;">No accounts found</td></tr>';
            return;
        }

        list.innerHTML = accounts.map(acc => `
          <tr>
              <td>${acc.user_name || 'N/A'}</td>
              <td>${acc.email || 'N/A'}</td>
              <td>${acc.type || (acc.cookies ? 'Facebook' : 'Manual')}</td>
              <td class="action-buttons">
                  ${acc.cookies || acc.type === 'facebook' ?
                `<button class="login-btn" onclick="loginWithSavedAccount(${acc.id})">Login</button>` :
                ''
            }
                  <button class="edit-btn" onclick="editUser(${acc.id})">Edit</button>
                  <button class="delete-btn" onclick="deleteUser(${acc.id})">Delete</button>
              </td>
          </tr>
      `).join('');
    } catch (error) {
        console.error('Failed to load accounts:', error);
        showStatus('Failed to load accounts: ' + error.message, true);
    }
}


// Login with saved account
async function loginWithSavedAccount(id) {
    try {
        showStatus('Logging in with saved account...', false);
        const result = await ipcRenderer.invoke('login-saved-account', id);
        if (result.success) {
            showStatus('Logged in successfully!');
        } else {
            showStatus(result.message, true);
        }
    } catch (error) {
        showStatus('Login failed: ' + error.message, true);
    }
}

// Delete user
async function deleteUser(id) {
    try {
        await ipcRenderer.invoke('delete-user', id);
        showStatus('Account deleted successfully!');
        loadAccounts();
    } catch (error) {
        showStatus('Failed to delete account: ' + error.message, true);
    }
}

// Edit user
async function editUser(id) {
    try {
        const accounts = await ipcRenderer.invoke('get-users');
        const user = accounts.find(acc => acc.id === id);
        if (user) {
            if (user.cookies) {
                document.querySelector('[data-form="facebook"]').click();
                document.getElementById('fbEmail').value = user.email;
                document.getElementById('fbPassword').value = user.password;
            } else {
                document.querySelector('[data-form="manual"]').click();
                document.getElementById('name').value = user.user_name;
                document.getElementById('email').value = user.email;
                document.getElementById('password').value = user.password;
            }
            await deleteUser(id);
        }
    } catch (error) {
        showStatus('Failed to edit account: ' + error.message, true);
    }
}

// Toggle app content visibility (used during Facebook login)
ipcRenderer.on('toggle-app-visibility', (event, visible) => {
    const containers = document.querySelectorAll('.container');
    containers.forEach(container => {
        container.style.display = visible ? 'block' : 'none';
    });

    if (!visible) {
        // Add message that Facebook login is in progress
        const loginMsg = document.createElement('div');
        loginMsg.id = 'login-message';
        loginMsg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
            z-index: 1001;
        `;
        loginMsg.textContent = 'Facebook login in progress... Please complete any required verification.';
        document.body.appendChild(loginMsg);
    } else {
        // Remove message
        const loginMsg = document.getElementById('login-message');
        if (loginMsg) {
            loginMsg.remove();
        }
    }
});

// Show custom notification
ipcRenderer.on('show-notification', (event, { title, message }) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #0066cc;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        z-index: 1002;
    `;

    notification.innerHTML = `
        <h4 style="margin: 0 0 10px 0;">${title}</h4>
        <p style="margin: 0;">${message}</p>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
});

// Update notification handling
window.addEventListener('DOMContentLoaded', () => {
    // Create update notification element if it doesn't exist
    if (!document.getElementById('update-notification')) {
        const updateNotification = document.createElement('div');
        updateNotification.id = 'update-notification';
        updateNotification.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0;">Update Available</h3>
            </div>
            <p id="update-message">A new version is available. Please update to get the latest features.</p>
            <div id="update-progress" style="display: none;">
                <div style="background: #333; border-radius: 5px; height: 10px; overflow: hidden; margin: 10px 0;">
                    <div id="progress-bar" style="background: #0066cc; height: 100%; width: 0%; transition: width 0.3s;"></div>
                </div>
                <p id="progress-text" style="text-align: center; margin: 5px 0;">0%</p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="later-btn" style="padding: 8px 12px; border: none; border-radius: 5px; background: #404040; color: #fff; cursor: pointer;">Later</button>
                <button id="update-btn" style="padding: 8px 12px; border: none; border-radius: 5px; background: #0066cc; color: #fff; cursor: pointer;">Update Now</button>
            </div>
        `;

        // Style the notification
        updateNotification.style.cssText = `
            display: none;
            position: fixed;
            top: 10px;
            right: 10px;
            background: #006600;
            color: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 1000;
            max-width: 300px;
        `;

        document.body.appendChild(updateNotification);

        // Add event listeners for update buttons
        document.getElementById('update-btn').addEventListener('click', async () => {
            const updateDownloaded = localStorage.getItem('updateDownloaded') === 'true';

            if (updateDownloaded) {
                // If update is downloaded, install it
                await ipcRenderer.invoke('install-update');
            } else {
                // Otherwise start the download
                const result = await ipcRenderer.invoke('start-update-download');
                if (!result.success) {
                    document.getElementById('update-message').textContent = result.message;
                }
            }
        });

        document.getElementById('later-btn').addEventListener('click', () => {
            document.getElementById('update-notification').style.display = 'none';
        });
    }

    // Check if there was a pending update on load
    if (localStorage.getItem('updateAvailable') === 'true') {
        const version = localStorage.getItem('updateVersion');
        document.getElementById('update-message').textContent = `Version ${version || 'new'} is available. Download now?`;
        document.getElementById('update-notification').style.display = 'block';

        if (localStorage.getItem('updateDownloaded') === 'true') {
            document.getElementById('update-message').textContent = 'Update downloaded. Restart now to install?';
            document.getElementById('update-btn').textContent = 'Restart Now';
        }
    }
});

// Listen for update available
ipcRenderer.on('update-available', (event, info) => {
    document.getElementById('update-message').textContent = `Version ${info.version} is available. Download now?`;
    document.getElementById('update-notification').style.display = 'block';

    // Save in localStorage to persist between app refreshes
    localStorage.setItem('updateAvailable', 'true');
    localStorage.setItem('updateVersion', info.version);
});

// Listen for download progress
ipcRenderer.on('download-progress', (event, percent) => {
    const updateProgress = document.getElementById('update-progress');
    const updateBtn = document.getElementById('update-btn');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    updateProgress.style.display = 'block';
    updateBtn.disabled = true;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
});

// Listen for update downloaded
ipcRenderer.on('update-downloaded', () => {
    const updateProgress = document.getElementById('update-progress');
    const updateBtn = document.getElementById('update-btn');
    const updateMessage = document.getElementById('update-message');

    updateProgress.style.display = 'none';
    updateBtn.disabled = false;
    updateMessage.textContent = 'Update downloaded. Restart now to install?';
    updateBtn.textContent = 'Restart Now';

    // Update stored status
    localStorage.setItem('updateDownloaded', 'true');
});

// Listen for update errors
ipcRenderer.on('update-error', (event, message) => {
    const updateMessage = document.getElementById('update-message');
    const updateBtn = document.getElementById('update-btn');

    updateMessage.textContent = `Update error: ${message}`;
    updateBtn.disabled = false;
});

// Load accounts when the page loads
loadAccounts();
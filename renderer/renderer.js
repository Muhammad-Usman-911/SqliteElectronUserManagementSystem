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

// Status message handler
function showStatus(message, isError = false) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${isError ? 'error' : 'success'}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Manual account form handler
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

// Facebook login form handler
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

// Load accounts from database
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

// Delete user account
async function deleteUser(id) {
    try {
        await ipcRenderer.invoke('delete-user', id);
        showStatus('Account deleted successfully!');
        loadAccounts();
    } catch (error) {
        showStatus('Failed to delete account: ' + error.message, true);
    }
}

// Edit user account
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

// Handle Facebook login visibility toggling
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

// Display custom notifications
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

// Update button handler - modified to auto-restart
document.getElementById('update-btn').addEventListener('click', async () => {
    try {
        const updateBtn = document.getElementById('update-btn');
        updateBtn.disabled = true;
        updateBtn.textContent = 'Processing...';
        
        const updateDownloaded = localStorage.getItem('updateDownloaded') === 'true';
        console.log('Update button clicked. Update downloaded:', updateDownloaded);
        
        if (updateDownloaded) {
            // If update is downloaded, install it
            console.log('Sending install-update command to main process');
            await ipcRenderer.invoke('install-update');
        } else {
            // Otherwise start the download
            console.log('Sending start-update-download command to main process');
            const result = await ipcRenderer.invoke('start-update-download');
            
            if (!result || !result.success) {
                updateBtn.disabled = false;
                updateBtn.textContent = 'Update 🆕';
                document.getElementById('update-message').textContent = result?.message || 'Update failed to start';
                showStatus('Update download failed: ' + (result?.message || 'Unknown error'), true);
            } else {
                document.getElementById('update-progress').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Update action failed:', error);
        document.getElementById('update-message').textContent = 'Update failed: ' + error.message;
        document.getElementById('update-btn').disabled = false;
        document.getElementById('update-btn').textContent = 'Update 🆕';
        showStatus('Update action failed: ' + error.message, true);
    }
});

// Close update notification
document.getElementById('later-btn').addEventListener('click', () => {
    document.getElementById('update-notification').style.display = 'none';
});

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
    // Check for updates on load
    ipcRenderer.invoke('check-for-updates').catch(err => {
        console.error('Failed to check for updates:', err);
    });
    
    // Load accounts when the page loads
    loadAccounts();
});

// Handle update available notification
ipcRenderer.on('update-available', (event, info) => {
    document.getElementById('update-message').textContent = `Version ${info.version || 'new'} is available. Download now?`;
    document.getElementById('update-notification').style.display = 'block';
    document.getElementById('update-btn').disabled = false;
    document.getElementById('update-btn').textContent = 'Update 🆕';

    // Store update status in localStorage
    localStorage.setItem('updateAvailable', 'true');
    localStorage.setItem('updateVersion', info.version || 'new');
    localStorage.setItem('updateDownloaded', 'false');
});

// Update download progress
ipcRenderer.on('download-progress', (event, percent) => {
    const updateProgress = document.getElementById('update-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    updateProgress.style.display = 'block';
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
});

// Auto-install update when downloaded
ipcRenderer.on('update-downloaded', () => {
    // Store the fact that update is downloaded
    localStorage.setItem('updateDownloaded', 'true');
    
    // Automatically install instead of showing notification
    ipcRenderer.invoke('install-update');
});

// Show update errors
ipcRenderer.on('update-error', (event, message) => {
    const updateMessage = document.getElementById('update-message');
    const updateBtn = document.getElementById('update-btn');
    const updateProgress = document.getElementById('update-progress');

    updateMessage.textContent = `Update error: ${message}`;
    updateBtn.disabled = false;
    updateBtn.textContent = 'Try Again';
    updateProgress.style.display = 'none';
    
    showStatus('Update error: ' + message, true);
});
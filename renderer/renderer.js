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
document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        loginType: 'manual'
    };

    try {
        await ipcRenderer.invoke('add-user', user);
        showStatus('Account added successfully!');
        e.target.reset();
        loadAccounts();
    } catch (error) {
        showStatus('Failed to add account: ' + error.message, true);
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
        console.log('Facebook Login Started!');
        const result = await ipcRenderer.invoke('login-facebook', loginData);
        console.log('Login Facebook data : ',result);
        console.log('Login Facebook data Cookies:  ',result.cookies);
        if (result.success) {
            showStatus('Facebook login successful!');
            e.target.reset();
            loadAccounts();
        } else {
            showStatus(result.message, true);
        }
    } catch (error) {
        showStatus('Login failed: ' + error.message, true);
    }
});

// Load accounts
async function loadAccounts() {
    try {
        const accounts = await ipcRenderer.invoke('get-users');
        const list = document.getElementById('accountsList');
        list.innerHTML = accounts.map(acc => `
            <tr>
                <td>${acc.name}</td>
                <td>${acc.email}</td>
                <td>${acc.cookies ? 'Facebook' : 'Manual'}</td>
                <td class="action-buttons">
                    ${acc.cookies ? 
                        `<button class="login-btn" onclick="loginWithSavedAccount(${acc.id})">Login</button>` : 
                        ''
                    }
                    <button class="edit-btn" onclick="editUser(${acc.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteUser(${acc.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showStatus('Failed to load accounts: ' + error.message, true);
    }
}

// Login with saved account
async function loginWithSavedAccount(id) {
    try {
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
                document.getElementById('name').value = user.name;
                document.getElementById('email').value = user.email;
                document.getElementById('password').value = user.password;
            }
            await deleteUser(id);
        }
    } catch (error) {
        showStatus('Failed to edit account: ' + error.message, true);
    }
}

// Load accounts when the page loads
loadAccounts();
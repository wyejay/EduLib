// ---------- script.js ----------
// Global variables (ids updated to match index.html)
let currentUser = null;
let allFiles = [];
let categories = [];
let currentCategory = 'all';

// Elements – ids now match the HTML file
const authSection    = document.getElementById('auth-container');
const mainNav        = document.querySelector('nav');
const userInfo       = document.getElementById('user-stats');
const fileGrid       = document.getElementById('files-container');
const searchInput    = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const uploadForm     = document.getElementById('upload-form');
const settingsModal  = document.getElementById('settings-modal');

// Rest of the file is identical (no further changes)
document.addEventListener('DOMContentLoaded', function () {
  initializeTheme();
  initializeGridSize();
  checkAuthStatus();
  setupEventListeners();
  checkInviteCode();
});

// Check for invite code in URL
function checkInviteCode() {
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite');
  const email = urlParams.get('email');

  if (inviteCode && email) {
    document.getElementById('register-email').value = email;
    document.getElementById('register-form').dataset.inviteCode = inviteCode;
    switchAuthTab('register');
    showStatus('Please complete your registration using the invitation.', 'success', 'authStatus');
  }
}

// Theme management
function initializeTheme() {
  const stored = localStorage.getItem('theme');
  const theme  = stored || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function setTheme(theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// Grid size
function initializeGridSize() {
  const size = localStorage.getItem('gridSize') || 'auto';
  updateGridSize(size);
}

function updateGridSize(size) {
  localStorage.setItem('gridSize', size);
  const grids = [fileGrid];
  grids.forEach(grid => {
    if (size === 'auto') {
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    } else {
      grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    }
  });
}

// Auth helpers
function switchAuthTab(tab) {
  const loginTab    = document.getElementById('login-tab-btn');
  const registerTab = document.getElementById('register-tab-btn');
  const loginForm   = document.getElementById('login-form');
  const registerForm= document.getElementById('register-form');

  [loginTab, registerTab].forEach(t => t.classList.remove('active'));
  document.getElementById(`${tab}-tab-btn`).classList.add('active');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  }
}

// Check login status
async function checkAuthStatus() {
  try {
    const res  = await fetch('/user-info');
    const data = await res.json();
    if (data.logged_in) {
      currentUser = data.user;
      showMainApp();
      loadFiles();
    } else {
      showAuthScreen();
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    showAuthScreen();
  }
}

function showAuthScreen() {
  authSection.style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
}

function showMainApp() {
  authSection.style.display = 'none';
  document.getElementById('app-container').style.display = 'block';

  // admin button
  if (currentUser.is_admin) {
    document.getElementById('admin-nav').classList.remove('hidden');
  }

  // user stats
  userInfo.innerHTML = `📤 ${currentUser.uploads_count} uploads • 📥 ${currentUser.downloads_count} downloads ${currentUser.is_admin ? ' • 👑 Admin' : ''}`;
}

// Navigation
function showSection(section) {
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.querySelector(`nav button[data-section="${section}"]`).classList.add('active');

  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`${section}-section`).classList.add('active');

  if (section === 'browse') loadFiles();
  if (section === 'support') loadSupportTickets();
  if (section === 'admin') loadAdminData();
}

// Load files
async function loadFiles() {
  try {
    const res   = await fetch('/files');
    const data  = await res.json();
    allFiles    = data.files || [];
    categories  = data.categories || [];

    // populate category dropdowns
    [categoryFilter, document.getElementById('upload-category')].forEach(sel => {
      sel.innerHTML = '<option value="all">All Categories</option>';
      categories.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
    });

    renderFiles();
  } catch (err) {
    console.error('loadFiles failed:', err);
  }
}

function renderFiles() {
  const container = fileGrid;
  container.innerHTML = '';

  let files = allFiles;
  const search = searchInput.value.trim().toLowerCase();
  const cat    = categoryFilter.value;
  const onlyFeatured = document.getElementById('featured-only').checked;

  if (cat && cat !== 'all') files = files.filter(f => f.category === cat);
  if (search) files = files.filter(f =>
    f.original_name.toLowerCase().includes(search) ||
    (f.description || '').toLowerCase().includes(search) ||
    (f.tags || []).some(t => t.toLowerCase().includes(search))
  );
  if (onlyFeatured) files = files.filter(f => f.is_featured);

  if (!files.length) {
    container.innerHTML = '<div class="empty-state"><h3>No files found</h3></div>';
    return;
  }

  files.forEach(file => container.appendChild(createFileCard(file)));
}

function createFileCard(file) {
  const div = document.createElement('div');
  div.className = 'file-card';
  div.innerHTML = `
    <h4 class="file-title">${file.original_name} ${file.is_featured ? '<span class="featured-badge">⭐ Featured</span>' : ''}</h4>
    <div class="file-meta">
      ${file.size_mb} MB • ${file.category}<br>
      👤 ${file.uploaded_by} • 📥 ${file.download_count} downloads
    </div>
    <p class="text-muted">${file.description || ''}</p>
    <div class="file-actions">
      <button class="btn btn-warning" onclick="previewFile(${file.id})">Preview</button>
      <button class="btn btn-primary" onclick="downloadFile(${file.id})">Download</button>
      ${(file.uploader_id === currentUser.id || currentUser.is_admin) ? `<button class="btn btn-danger" onclick="deleteFile(${file.id})">Delete</button>` : ''}
    </div>
  `;
  return div;
}

// File actions
function previewFile(id) { window.open(`/preview/${id}`, '_blank'); }

async function downloadFile(id) {
  const a = document.createElement('a');
  a.href = `/download/${id}`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function deleteFile(id) {
  if (!confirm('Delete this file?')) return;
  await fetch(`/delete/${id}`, { method: 'DELETE' });
  loadFiles();
}

// Forms
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('login-username').value.trim(),
      password: document.getElementById('login-password').value
    })
  });
  const data = await res.json();
  if (res.ok) {
    currentUser = data.user;
    showMainApp();
    loadFiles();
  } else {
    alert(data.error || 'Login failed');
  }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('register-username').value.trim(),
      email: document.getElementById('register-email').value.trim(),
      password: document.getElementById('register-password').value,
      invite_code: document.getElementById('invite-code').value.trim()
    })
  });
  const data = await res.json();
  if (res.ok) {
    alert('Registration successful! Please log in.');
    switchAuthTab('login');
  } else {
    alert(data.error || 'Registration failed');
  }
});

document.getElementById('upload-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('pdf', document.getElementById('pdf-file').files[0]);
  fd.append('category', document.getElementById('upload-category').value);
  fd.append('description', document.getElementById('upload-description').value.trim());
  fd.append('tags', document.getElementById('upload-tags').value.trim());

  const res = await fetch('/upload', { method: 'POST', body: fd });
  const data = await res.json();
  if (res.ok) {
    alert('Upload success!');
    e.target.reset();
    loadFiles();
  } else {
    alert(data.error || 'Upload failed');
  }
});

document.getElementById('invite-form').addEventListener('submit', async e => {
  e.preventDefault();
  const res = await fetch('/send-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('invite-email').value.trim(),
      message: document.getElementById('invite-message').value.trim()
    })
  });
  const data = await res.json();
  alert(res.ok ? 'Invitation sent!' : (data.error || 'Failed'));
});

document.getElementById('support-form').addEventListener('submit', async e => {
  e.preventDefault();
  const res = await fetch('/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: document.getElementById('ticket-title').value.trim(),
      description: document.getElementById('ticket-description').value.trim(),
      priority: document.getElementById('ticket-priority').value
    })
  });
  const data = await res.json();
  alert(res.ok ? 'Ticket created!' : (data.error || 'Failed'));
});

// Support tickets
async function loadSupportTickets() {
  try {
    const res = await fetch('/support/tickets');
    const data = await res.json();
    const container = document.getElementById('tickets-container');
    container.innerHTML = '';
    if (!data.tickets.length) { container.innerHTML = '<p>No tickets yet.</p>'; return; }
    container.innerHTML = data.tickets.map(t => `
      <div class="ticket-card">
        <strong>${t.title}</strong> <span class="priority-badge priority-${t.priority}">${t.priority}</span> <span class="status-badge status-${t.status}">${t.status}</span><br>
        <p>${t.description}</p>
        ${t.admin_response ? `<div class="admin-reply"><strong>Admin:</strong> ${t.admin_response}</div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// Admin helpers
function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('active');

  document.querySelectorAll('.admin-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`admin-${tab}`).classList.remove('hidden');

  if (tab === 'analytics') loadAnalytics();
  if (tab === 'users') loadAdminUsers();
  if (tab === 'files') loadAdminFiles();
  if (tab === 'tickets') loadAdminTickets();
}

async function loadAdminData() { loadAnalytics(); }

async function loadAnalytics() {
  try {
    const res  = await fetch('/analytics');
    const data = await res.json();
    const c    = document.getElementById('analytics-container');
    c.innerHTML = `
      <div class="analytics-grid">
        <div class="stat-card"><div class="stat-number">${data.stats.total_users}</div><div class="stat-label">Users</div></div>
        <div class="stat-card"><div class="stat-number">${data.stats.total_files}</div><div class="stat-label">Files</div></div>
        <div class="stat-card"><div class="stat-number">${data.stats.total_downloads}</div><div class="stat-label">Downloads</div></div>
        <div class="stat-card"><div class="stat-number">${data.stats.total_size_mb} MB</div><div class="stat-label">Storage</div></div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function loadAdminUsers() {
  try {
    const res = await fetch('/admin/users');
    const data = await res.json();
    const c = document.getElementById('users-container');
    c.innerHTML = data.users.map(u => `
      <div class="user-card">
        <div>
          <strong>${u.username} ${u.is_admin ? '👑' : ''} ${!u.is_active ? '❌' : ''}</strong><br>
          <small>${u.email} • uploads: ${u.uploads_count}</small>
        </div>
        <div>
          ${!u.is_admin ? `
            <button class="btn btn-sm ${u.is_active ? 'btn-warning' : 'btn-secondary'}" onclick="toggleUser(${u.id})">${u.is_active ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function toggleUser(id) {
  await fetch(`/admin/users/${id}/toggle-status`, { method: 'POST' });
  loadAdminUsers();
}

async function deleteUser(id) {
  if (!confirm('Delete user and all files?')) return;
  await fetch(`/admin/users/${id}/delete`, { method: 'DELETE' });
  loadAdminUsers();
}

async function loadAdminFiles() {
  try {
    const res = await fetch('/files');
    const data = await res.json();
    const c = document.getElementById('admin-files-container');
    c.innerHTML = data.files.map(f => `
      <div class="admin-file-card">
        <div>
          <strong>${f.original_name}</strong> ${f.is_featured ? '⭐' : ''}<br>
          <small>${f.category} • ${f.uploaded_by}</small>
        </div>
        <div>
          <button class="btn btn-sm ${f.is_featured ? 'btn-warning' : 'btn-secondary'}" onclick="toggleFeatured(${f.id})">${f.is_featured ? 'Unfeature' : 'Feature'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteFile(${f.id})">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function toggleFeatured(id) {
  await fetch(`/admin/files/featured/${id}`, { method: 'POST' });
  loadAdminFiles();
  loadFiles();
}

async function loadAdminTickets() {
  try {
    const res = await fetch('/support/tickets');
    const data = await res.json();
    const c = document.getElementById('admin-tickets-container');
    c.innerHTML = data.tickets.map(t => `
      <div class="ticket-card">
        <strong>${t.title}</strong> (${t.user})<br>
        <p>${t.description}</p>
        ${t.admin_response ? `<div>Admin: ${t.admin_response}</div>` : `
          <textarea id="resp-${t.id}" placeholder="Response" rows="2"></textarea>
          <button class="btn btn-sm" onclick="respondTicket(${t.id}, 'resolved')">Resolve</button>
          <button class="btn btn-sm" onclick="respondTicket(${t.id}, 'in-progress')">In Progress</button>
        `}
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function respondTicket(id, status) {
  const resp = document.getElementById(`resp-${id}`).value.trim();
  if (!resp) return alert('Enter response');
  await fetch(`/admin/tickets/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: resp, status })
  });
  loadAdminTickets();
}

async function createBackup() {
  const res = await fetch('/admin/backup', { method: 'POST' });
  const data = await res.json();
  alert(res.ok ? data.message : (data.error || 'Backup failed'));
}

// Logout
async function logout() {
  await fetch('/logout', { method: 'POST' });
  location.reload();
}

// Settings modal
function showSettings() { settingsModal.classList.add('active'); }
function hideSettings() { settingsModal.classList.remove('active'); }

async function exportData() {
  if (!currentUser) return;
  const blob = new Blob([JSON.stringify({ user: currentUser, files: allFiles.filter(f => f.uploader_id === currentUser.id) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `edulibrary-${currentUser.username}.json`;
  a.click();
}

// Attach listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-input').addEventListener('input', renderFiles);
  document.getElementById('category-filter').addEventListener('change', renderFiles);
  document.getElementById('featured-only').addEventListener('change', renderFiles);
});

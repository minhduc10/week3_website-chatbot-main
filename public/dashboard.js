class Dashboard {
  constructor() {
    const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    // If you deploy frontend on a different domain than backend, set PROD_API_BASE env via HTML or hardcode here
    const prodBase = window.PROD_API_BASE || '/api';
    this.apiBaseUrl = isLocal ? 'http://localhost:3000/api' : prodBase;
    this.sessionsEl = document.getElementById('sessions');
    this.messagesEl = document.getElementById('messages');
    this.selectedSessionEl = document.getElementById('selectedSession');
    this.selectedMetaEl = document.getElementById('selectedMeta');
    this.searchInput = document.getElementById('searchInput');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.deleteBtn = document.getElementById('deleteBtn');

    this.currentSessionId = null;

    this.attachEvents();
    this.loadSessions();
  }

  attachEvents() {
    this.searchInput.addEventListener('input', () => this.filterSessions());
    this.refreshBtn.addEventListener('click', () => {
      if (this.currentSessionId) this.loadConversation(this.currentSessionId);
      else this.loadSessions();
    });
    this.deleteBtn.addEventListener('click', () => this.handleDelete());
  }

  async loadSessions() {
    this.sessions = [];
    this.sessionsEl.innerHTML = '<li>Loading...</li>';
    try {
      const res = await fetch(`${this.apiBaseUrl}/sessions`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sessions request failed: ${res.status} ${text.slice(0, 120)}`);
      }
      const data = await res.json();
      this.sessions = data.sessions || [];
      this.renderSessions();
    } catch (e) {
      this.sessionsEl.innerHTML = '<li>Failed to load sessions</li>';
      console.error(e);
    }
  }

  async handleDelete() {
    if (!this.currentSessionId) return;
    const ok = confirm('Bạn có chắc muốn xóa cuộc thoại này? Hành động này không thể hoàn tác.');
    if (!ok) return;
    try {
      const res = await fetch(`${this.apiBaseUrl}/conversation/${this.currentSessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Delete failed: ${res.status} ${text.slice(0, 120)}`);
      }
      // Clear selection and reload the sessions list
      this.currentSessionId = null;
      this.selectedSessionEl.textContent = 'Select a session';
      this.selectedMetaEl.textContent = '';
      this.messagesEl.innerHTML = '';
      await this.loadSessions();
    } catch (e) {
      alert('Xóa cuộc thoại thất bại. Vui lòng thử lại.');
      console.error(e);
    }
  }

  renderSessions() {
    const q = this.searchInput.value?.toLowerCase() || '';
    const filtered = this.sessions.filter(s => (s.sessionId || '').toLowerCase().includes(q));
    this.sessionsEl.innerHTML = '';
    filtered.forEach(s => {
      const li = document.createElement('li');
      li.className = `session-item ${this.currentSessionId === s.sessionId ? 'active' : ''}`;
      li.innerHTML = `
        <div class="session-id">${s.sessionId}</div>
        <div class="session-meta">${this.formatTime(s.createdAt)} • ${s.messageCount} messages</div>
      `;
      li.addEventListener('click', () => {
        this.currentSessionId = s.sessionId;
        this.renderSessions();
        this.loadConversation(s.sessionId);
      });
      this.sessionsEl.appendChild(li);
    });
  }

  async loadConversation(sessionId) {
    this.selectedSessionEl.textContent = sessionId;
    this.selectedMetaEl.textContent = 'Loading...';
    this.messagesEl.innerHTML = '';
    try {
      const res = await fetch(`${this.apiBaseUrl}/conversation/${sessionId}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Conversation request failed: ${res.status} ${text.slice(0, 120)}`);
      }
      const data = await res.json();
      const msgs = data.messages || [];
      this.selectedMetaEl.textContent = `Created: ${this.formatTime(data.createdAt)} • Last activity: ${this.formatTime(data.lastActivity)}`;
      msgs.forEach(m => this.messagesEl.appendChild(this.renderMessage(m)));
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    } catch (e) {
      this.selectedMetaEl.textContent = 'Failed to load conversation';
      console.error(e);
    }
  }

  renderMessage(m) {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    div.innerHTML = `
      <div class="role">${m.role}</div>
      <div class="text"></div>
    `;
    div.querySelector('.text').innerHTML = this.linkify(m.content);
    return div;
  }

  filterSessions() {
    this.renderSessions();
  }

  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
  }

  linkify(text) {
    const escaped = (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    return escaped.replace(urlRegex, (url) => {
      const href = url.startsWith('http') ? url : `http://${url}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }).replace(/\n/g, '<br>');
  }
}

document.addEventListener('DOMContentLoaded', () => new Dashboard());



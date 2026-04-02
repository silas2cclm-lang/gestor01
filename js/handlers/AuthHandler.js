class AuthHandler {
  constructor(app) {
    this.app = app;
    this.currentPin = '';
  }

  init() {
    const role = sessionStorage.getItem('vthink_auth_role');
    if (role) {
      document.getElementById('login-modal').style.display = 'none';
      this.app.applyPermissions();
    }

    document.getElementById('login-username')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('pin-dots')?.focus();
    });

    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('login-modal');
      if (modal && modal.style.display !== 'none' && document.activeElement.id !== 'login-username') {
        if (e.key >= '0' && e.key <= '9') this.addPin(e.key);
        else if (e.key === 'Backspace') this.addPin('clear');
        else if (e.key === 'Enter') this.addPin('enter');
      }
    });

    this.createLogoutButton();
  }

  addPin(val) {
    const username = document.getElementById('login-username')?.value.trim();
    if (!username && val !== 'enter') {
      document.getElementById('login-username').style.borderColor = 'var(--status-parado)';
      document.getElementById('login-username').focus();
      const pinError = document.getElementById('pin-error');
      pinError.innerText = "Digite o usuário primeiro.";
      pinError.classList.add('visible');
      setTimeout(() => pinError.classList.remove('visible'), 2000);
      return;
    }

    if (val === 'clear') this.currentPin = this.currentPin.slice(0, -1);
    else if (val === 'enter') { this.checkPin(); return; }
    else { if (this.currentPin.length < 6) this.currentPin += val; }

    this.updatePinDots();
    if (this.currentPin.length === 6) setTimeout(() => this.checkPin(), 100);
  }

  updatePinDots() {
    document.querySelectorAll('.pin-dot').forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < this.currentPin.length);
    });
  }

  async checkPin() {
    const usernameEl = document.getElementById('login-username');
    const username = usernameEl?.value.trim() || '';
    const pinError = document.getElementById('pin-error');

    if (!username) {
      usernameEl.style.borderColor = 'var(--status-parado)';
      usernameEl.focus();
      pinError.innerText = "Digite o usuário antes do PIN.";
      pinError.classList.add('visible');
      this.currentPin = '';
      this.updatePinDots();
      setTimeout(() => pinError.classList.remove('visible'), 3000);
      return;
    }

    if (!this.app.db) {
      pinError.innerText = "Erro: Firebase não conectado. Use modo Local.";
      pinError.classList.add('visible');
      return;
    }

    try {
      const snapshot = await this.app.db.ref(`users/${username}`).once('value');
      const userData = snapshot.val();

      if (userData?.pin === this.currentPin) {
        document.getElementById('login-modal').style.display = 'none';
        sessionStorage.setItem('vthink_auth_user', username);
        sessionStorage.setItem('vthink_auth_role', userData.role || 'viewer');
        this.app.applyPermissions();
      } else {
        pinError.innerText = "Usuário ou PIN incorreto.";
        pinError.classList.add('visible');
        this.currentPin = '';
        this.updatePinDots();
        setTimeout(() => pinError.classList.remove('visible'), 2000);
      }
    } catch (err) {
      console.error("Erro na autenticação:", err);
      pinError.innerText = "Erro ao conectar com o servidor.";
      pinError.classList.add('visible');
    }
  }

  logout() {
    sessionStorage.removeItem('vthink_auth_user');
    sessionStorage.removeItem('vthink_auth_role');
    location.reload();
  }

  createLogoutButton() {
    if (!document.getElementById('btn-logout')) {
      const footer = document.querySelector('.sidebar-footer');
      if (footer) {
        const btnLogout = document.createElement('button');
        btnLogout.id = 'btn-logout';
        btnLogout.className = 'footer-btn';
        btnLogout.title = 'Sair';
        btnLogout.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        btnLogout.onclick = () => this.logout();
        footer.appendChild(btnLogout);
      }
    }
  }

  get role() {
    return sessionStorage.getItem('vthink_auth_role') || 'viewer';
  }

  canEdit() {
    return this.role !== 'viewer' && (!this.app.isProjectLocked || this.role === 'admin');
  }
}

window.AuthHandler = AuthHandler;

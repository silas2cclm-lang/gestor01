class StorageHandler {
  constructor(app) {
    this.app = app;
    this.saveMode = localStorage.getItem('vthink_save_mode') || 'online';
    this.saveTimer = null;
  }

  init() {
    this.loadLocalData();
    this.initFirebaseSync();
    this.updateSaveModeUI();
  }

  initFirebase() {
    const firebaseConfig = {
      apiKey: "AIzaSyAusGKr-yDVyGwHq2tROQ78SAwoq_VViGQ",
      authDomain: "gerenciar-projetos-cclm-01.firebaseapp.com",
      databaseURL: "https://gerenciar-projetos-cclm-01-default-rtdb.firebaseio.com",
      projectId: "gerenciar-projetos-cclm-01",
      storageBucket: "gerenciar-projetos-cclm-01.firebasestorage.app",
      messagingSenderId: "628531693879",
      appId: "1:628531693879:web:47590be61cacf0e5f0b2b2"
    };

    try {
      firebase.initializeApp(firebaseConfig);
      this.app.db = firebase.database();
    } catch (e) {
      console.error("Firebase init error:", e);
    }
  }

  loadLocalData() {
    const localData = localStorage.getItem('vthink_data_v2');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed.projects) this.app.state.projects = parsed.projects;
        if (parsed.groups) this.app.state.groups = parsed.groups;
        if (parsed.tasks) this.app.state.tasks = parsed.tasks;
        if (parsed.geralCollapsed !== undefined) this.app.state.geralCollapsed = parsed.geralCollapsed;
        this.normalizeOrders();
      } catch (e) {}
    }
  }

  initFirebaseSync() {
    this.app.db?.ref('data').on('value', (snapshot) => {
      const val = snapshot.val();
      if (!val) return;

      if (this.saveMode === 'online') {
        this.parseFirebaseData(val);
        this.app.renderAll();
      } else if (!localStorage.getItem('vthink_data_v2')) {
        this.parseFirebaseData(val);
      }
    });
  }

  normalizeOrders() {
    this.app.state.groups.forEach((g, idx) => {
      if (g.order === undefined) g.order = idx;
    });
    
    const taskOrders = {};
    this.app.state.tasks.forEach((t, idx) => {
      if (t.order === undefined) {
        if (!taskOrders[t.groupId]) taskOrders[t.groupId] = 0;
        t.order = taskOrders[t.groupId]++;
      }
    });
  }

  parseFirebaseData(val) {
    if (Array.isArray(val)) {
      const pList = [], gList = [], tList = [];
      val.forEach((p, idx) => {
        const pid = p.id ? 'p' + p.id : 'p' + Date.now() + idx;
        pList.push({
          id: pid,
          name: p.name || 'Projeto Herdado',
          details: { venda: '', cliente: p.client || '', local: '', equipamento: '', elaborado: '', aprovado: '', revisao: p.version || '', dataElab: '' }
        });
        
        if (p.groups) {
          p.groups.forEach((g, gIdx) => {
            const gid = g.id ? 'g' + g.id : 'g' + Date.now() + idx + gIdx;
            gList.push({ id: gid, title: g.title || 'Grupo', color: g.color || '#c4c4c4', projectId: pid, order: g.order !== undefined ? g.order : gIdx });
            
            if (g.tasks) {
              g.tasks.forEach((t, tIdx) => {
                const tid = t.id ? 't' + t.id : 't' + Date.now() + idx + gIdx + tIdx;
                tList.push({
                  id: tid, groupId: gid, title: t.desc || t.title || 'Tarefa',
                  assignee: t.resp || '', startDate: t.startDate || new Date().toISOString().split('T')[0],
                  dueDate: t.endDate || new Date().toISOString().split('T')[0],
                  status: t.status || 'Parado', urgency: t.urgency || 'Normal', comments: t.comments || [],
                  order: t.order !== undefined ? t.order : tIdx
                });
              });
            }
          });
        }
      });
      this.app.state.projects = pList;
      this.app.state.groups = gList;
      this.app.state.tasks = tList;
      this.app.state.categories = [];
      if (pList.length > 0) this.app.state.activeProjectId = pList[0].id;
    } else {
      this.app.state.categories = val.categories || [];
      this.app.state.projects = val.projects || this.app.state.projects;
      this.app.state.groups = val.groups || this.app.state.groups;
      this.app.state.tasks = val.tasks || this.app.state.tasks;
      this.normalizeOrders();
    }
  }

  save() {
    if (!this.app.authHandler?.canEdit()) {
      console.warn("Acesso Negado: Não é possível salvar.");
      return;
    }

    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.updateSyncUI(true);
    
    this.saveTimer = setTimeout(() => {
      const dataToSave = {
        categories: this.app.state.categories,
        projects: this.app.state.projects,
        groups: this.app.state.groups,
        tasks: this.app.state.tasks,
        geralCollapsed: this.app.state.geralCollapsed
      };

      if (this.saveMode === 'local') {
        localStorage.setItem('vthink_data_v2', JSON.stringify(dataToSave));
        setTimeout(() => this.updateSyncUI(false), 800);
      } else {
        this.app.db.ref('data').set(dataToSave)
          .then(() => {
            setTimeout(() => this.updateSyncUI(false), 800);
            this.logAction('save_online', { projectsCount: this.app.state.projects.length });
          })
          .catch(err => {
            console.error("Erro ao salvar:", err);
            this.updateSyncUI(false);
          });
      }
    }, 500);
  }

  updateSyncUI(isSyncing) {
    const icon = document.getElementById('sync-icon');
    if (!icon) return;
    icon.innerHTML = isSyncing
      ? '<i class="fas fa-sync fa-spin" style="color:var(--primary);" title="Sincronizando..."></i>'
      : '<i class="fas fa-check-circle" style="color:var(--status-feito);" title="Sincronizado"></i>';
  }

  updateSaveModeUI() {
    const btnLocal = document.getElementById('btn-mode-local');
    const btnOnline = document.getElementById('btn-mode-online');
    if (!btnLocal || !btnOnline) return;
    
    btnLocal.classList.toggle('active', this.saveMode === 'local');
    btnOnline.classList.toggle('active', this.saveMode === 'online');
  }

  async switchSaveMode(mode) {
    if (mode === 'local') {
      alert("⚠️ Você mudou para o modo de Salvamento LOCAL. As alterações não serão enviadas para o servidor e os dados permanecerão apenas nesta máquina.");
    }

    if (mode === 'online' && this.saveMode === 'local') {
      const confirmPull = confirm("⚠️ Modo Nuvem. Deseja CARREGAR os dados salvos na Nuvem antes de sincronizar?\n\n[OK] Carregar da Nuvem\n[Cancelar] Manter versão local e Sobrescrever Nuvem");
      if (confirmPull) {
        this.updateSyncUI(true);
        try {
          const snapshot = await this.app.db.ref('data').once('value');
          if (snapshot.exists()) {
            this.parseFirebaseData(snapshot.val());
            localStorage.setItem('vthink_data_v2', JSON.stringify({ projects: this.app.state.projects, groups: this.app.state.groups, tasks: this.app.state.tasks }));
            this.app.renderAll();
          }
        } catch (err) {
          alert("Erro ao acessar a Nuvem.");
          this.updateSyncUI(false);
          return;
        }
        this.updateSyncUI(false);
      }
    }
    
    this.saveMode = mode;
    localStorage.setItem('vthink_save_mode', mode);
    this.updateSaveModeUI();
    this.save();
  }

  logAction(action, details = {}) {
    const user = sessionStorage.getItem('vthink_auth_user') || 'unknown';
    this.app.db?.ref('logs').push({
      user,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }

  backup() {
    const backupData = {
      ...this.app.state,
      backupInfo: { timestamp: new Date().toISOString(), mode: this.saveMode, version: "V-Think 0.55" }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const el = document.createElement('a');
    el.href = dataStr;
    el.download = `vthink_backup_${this.saveMode}_${new Date().toISOString().split('T')[0]}.json`;
    el.click();
  }

  restore(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (this.saveMode === 'online') {
      const confirmRestore = confirm("⚠️ Os dados atuais no servidor serão sobrescritos. Deseja continuar?");
      if (!confirmRestore) { e.target.value = ''; return; }
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedState = JSON.parse(evt.target.result);
        if (importedState.projects && (importedState.tasks || importedState.groups)) {
          Object.assign(this.app.state, importedState);
          this.save();
          this.app.renderAll();
          alert("Restauração concluída com sucesso!");
        } else {
          alert('Arquivo JSON inválido para V-Think.');
        }
      } catch (err) {
        alert("Erro ao ler JSON da restauração.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }
}

window.StorageHandler = StorageHandler;

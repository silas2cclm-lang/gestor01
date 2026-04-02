class VThinkApp {
  constructor() {
    this.state = {
      activeProjectId: "p1",
      geralCollapsed: false,
      categories: [],
      projects: [{
        id: "p1",
        name: "Projeto CCLM",
        details: { venda: '', cliente: '', local: '', equipamento: '', elaborado: '', aprovado: '', revisao: '' }
      }],
      groups: [
        { id: "g1", title: "Para Fazer", color: "#579bfc", projectId: "p1", order: 0 },
        { id: "g2", title: "Em Andamento", color: "#fdab3d", projectId: "p1", order: 1 },
        { id: "g3", title: "Concluídas", color: "#00c875", projectId: "p1", order: 2 }
      ],
      tasks: [
        { id: "t1", groupId: "g1", title: "Levantamento de Requisitos", assignee: "Ana P.", startDate: "2026-03-22", dueDate: "2026-03-25", status: "Parado", urgency: "Normal", comments: [], order: 0 },
        { id: "t2", groupId: "g2", title: "Desenvolvimento da Interface", assignee: "Carlos R.", startDate: "2026-03-23", dueDate: "2026-03-29", status: "Fazendo", urgency: "Importante", comments: [], order: 0 },
        { id: "t3", groupId: "g3", title: "Reunião de Alinhamento", assignee: "Ana P.", startDate: "2026-03-20", dueDate: "2026-03-20", status: "Feito", urgency: "Normal", comments: [], order: 0 }
      ]
    };

    this.db = null;
    this.confirmCallback = null;
    
    this.STATUS_OPTIONS = ["Parado", "Fazendo", "Feito"];
    this.URGENCY_OPTIONS = ["Normal", "Importante", "Urgente", "Crítico"];

    this.authHandler = new AuthHandler(this);
    this.storageHandler = new StorageHandler(this);
    this.projectHandler = new ProjectHandler(this);
    this.groupHandler = new GroupHandler(this);
    this.taskHandler = new TaskHandler(this);
    this.ganttHandler = new GanttHandler(this);
    this.dashboardHandler = new DashboardHandler(this);
  }

  init() {
    this.storageHandler.initFirebase();
    this.storageHandler.init();
    this.authHandler.init();
    this.projectHandler.init();
    this.groupHandler.init();
    this.taskHandler.init();
    this.ganttHandler.init();
    this.dashboardHandler.init();
    this.setupEventListeners();
    this.renderAll();
    this.applyPermissions();
  }

  setupEventListeners() {
    document.getElementById('btn-backup')?.addEventListener('click', () => this.storageHandler.backup());
    document.getElementById('import-file')?.addEventListener('change', (e) => this.storageHandler.restore(e));
  }

  renderAll() {
    this.projectHandler.renderProjectList();
    this.projectHandler.renderProjectDetails();
    this.refreshActiveView();
    if (this.ganttHandler) this.ganttHandler.updateProjectStatusIndicator();
  }

  refreshActiveView() {
    const viewBoard = document.getElementById('view-board');
    const viewGantt = document.getElementById('view-gantt');
    const viewDashboard = document.getElementById('view-dashboard');
    const headerSegments = document.querySelector('.view-segmented-control');
    const summaryBar = document.getElementById('project-summary-bar');
    const pdfBtn = document.getElementById('btn-export-pdf');
    const projectActions = document.querySelector('.project-actions');
    const btnDelete = document.getElementById('btn-delete-project');
    const mainHeader = document.getElementById('main-header');

    if (!this.state.activeProjectId) {
      // Estamos no modo Dashboard
      if (mainHeader) mainHeader.style.display = 'none';
      if (viewBoard) viewBoard.style.display = 'none';
      if (viewGantt) viewGantt.style.display = 'none';
      if (viewDashboard) viewDashboard.style.display = 'block';
    } else {
      if (mainHeader) mainHeader.style.display = 'flex';
      if (viewDashboard) viewDashboard.style.display = 'none';
      if (headerSegments) headerSegments.style.display = 'flex';
      if (summaryBar) summaryBar.style.display = 'flex';
      if (projectActions) projectActions.style.display = 'flex';
      if (btnDelete) btnDelete.style.display = 'block';
      
      const activeBtn = document.querySelector('.view-segment.active');
      const isBoard = !activeBtn || activeBtn.dataset.view === 'board';
      
      if (isBoard) {
        if (viewBoard) viewBoard.style.display = 'block';
        if (viewGantt) viewGantt.style.display = 'none';
        this.groupHandler.renderBoard();
      } else {
        if (viewBoard) viewBoard.style.display = 'none';
        if (viewGantt) viewGantt.style.display = 'block';
        this.ganttHandler.renderGantt();
      }
    }
  }

  get activeProject() {
    return this.state.projects.find(p => p.id === this.state.activeProjectId);
  }

  get isProjectLocked() {
    return this.activeProject?.isLocked || false;
  }

  applyPermissions() {
    const isAdmin = this.authHandler.role === 'admin';
    const isViewer = this.authHandler.role === 'viewer';

    document.querySelectorAll('.btn-new-project, .btn-new-category, .group-delete-btn, .task-delete-btn, #add-group-btn, #btn-delete-project, .tree-category-delete, .tree-category-move, #btn-clone-project, .group-clone-btn, .task-clone-btn').forEach(el => {
      el.style.display = 'block';
    });
    document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = false);
    document.querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = true);

    const lockBtn = document.getElementById('btn-project-lock');
    if (lockBtn) {
      lockBtn.innerHTML = `<i class="fas fa-${this.isProjectLocked ? 'lock' : 'unlock'}"></i>`;
      lockBtn.style.color = this.isProjectLocked ? 'var(--status-parado)' : 'var(--text-muted)';
      lockBtn.title = this.isProjectLocked ? 'Projeto Bloqueado' : 'Projeto Desbloqueado';
    }

    if (isViewer) {
      document.querySelectorAll('.btn-new-project, .btn-new-category, .group-delete-btn, .task-delete-btn, #add-group-btn, #btn-delete-project, .tree-category-delete, #btn-clone-project, .group-clone-btn, .task-clone-btn, .tree-category-move').forEach(el => el.style.display = 'none');
      document.querySelectorAll('input, select, textarea').forEach(el => { if (!el.id.includes('search') && el.id !== 'login-username') el.disabled = true; });
      document.querySelectorAll('[contenteditable]').forEach(el => { if (el.id !== 'login-username') el.contentEditable = false; });
    } else if (this.isProjectLocked && !isAdmin) {
      document.querySelectorAll('.group-delete-btn, .task-delete-btn, #add-group-btn, #btn-delete-project, .tree-category-delete, .group-clone-btn, .task-clone-btn, .tree-category-move').forEach(el => el.style.display = 'none');
      document.querySelectorAll('input, select, textarea').forEach(el => { if (!el.id.includes('search') && el.id !== 'login-username') el.disabled = true; });
      document.querySelectorAll('[contenteditable]').forEach(el => { if (el.id !== 'login-username') el.contentEditable = false; });
    }

    document.getElementById('btn-backup').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('btn-restore').style.display = isAdmin ? 'flex' : 'none';
  }

  showConfirm(msg, callback) {
    document.getElementById('confirm-msg').innerText = msg;
    document.getElementById('confirm-modal').style.display = 'block';
    document.getElementById('overlay').classList.add('visible');
    this.confirmCallback = callback;
  }

  closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    document.getElementById('overlay').classList.remove('visible');
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
  }

  dragStart(e, id) { this.taskHandler.dragStart(e, id); }
  dragEnd(e) { this.taskHandler.dragEnd(e); }
  dragOver(e) { this.taskHandler.dragOver(e); }
  dragLeave(e) { this.taskHandler.dragLeave(e); }
  dropTask(e, gid) { this.taskHandler.dropTask(e, gid); }
  updateProjectStatusIndicator() { this.ganttHandler.updateProjectStatusIndicator(); }
}

const app = new VThinkApp();

window.app = app;
window.selectProject = (id) => app.projectHandler.selectProject(id);
window.filterProjects = (term) => { window.currentSearchTerm = term; app.projectHandler.renderProjectList(); };
window.clearSearch = () => { window.currentSearchTerm = ''; app.projectHandler.renderProjectList(); };
window.customConfirm = (msg, cb) => app.showConfirm(msg, cb);
window.closeConfirm = (res) => res && app.closeConfirmModal();
window.logout = () => app.authHandler.logout();
window.addPin = (val) => app.authHandler.addPin(val);
window.switchSaveMode = (mode) => app.storageHandler.switchSaveMode(mode);
window.save = () => app.storageHandler.save();
window.seedUsers = () => { const users = { 'admin': { pin: '082900', role: 'admin' }, 'editor': { pin: '123456', role: 'editor' }, 'viewer': { pin: '654321', role: 'viewer' } }; app.db.ref('users').set(users).then(() => alert("Usuários iniciais criados!")); };
window.renderProjectDetails = () => app.projectHandler.renderProjectDetails();
window.updateProjectDetail = (field, value) => app.projectHandler.updateProjectDetail(field, value);
window.toggleCategory = (id) => app.projectHandler.toggleCategory(id);
window.renameCategory = (id, name) => app.projectHandler.renameCategory(id, name);
window.deleteCategory = (id) => app.projectHandler.deleteCategory(id);
window.moveCategory = (id, dir) => app.projectHandler.moveCategory(id, dir);
window.updateGroupTitle = (id, title) => app.groupHandler.updateGroupTitle(id, title);
window.updateGroupColor = (id, color) => app.groupHandler.updateGroupColor(id, color);
window.updateTask = (id, field, value) => app.taskHandler.updateTask(id, field, value);
window.deleteGroup = (id) => app.groupHandler.deleteGroup(id);
window.deleteTask = (id) => app.taskHandler.deleteTask(id);
window.cloneGroup = (id) => app.groupHandler.cloneGroup(id);
window.cloneTask = (id) => app.taskHandler.cloneTask(id);
window.moveTask = (id, dir) => app.taskHandler.moveTask(id, dir);
window.moveGroup = (id, dir) => app.groupHandler.moveGroup(id, dir);
window.handleQuickAdd = (e, gid, el) => app.taskHandler.handleQuickAdd(e, gid, el);
window.quickAddBtn = (gid) => app.taskHandler.quickAddBtn(gid);
window.dragStart = (e, id) => app.dragStart(e, id);
window.dragEnd = (e) => app.dragEnd(e);
window.dragOver = (e) => app.dragOver(e);
window.dragLeave = (e) => app.dragLeave(e);
window.dropTask = (e, gid) => app.dropTask(e, gid);
window.openComments = (id) => app.taskHandler.openComments(id);
window.deleteComment = (tid, idx) => app.taskHandler.deleteComment(tid, idx);
window.deleteCurrentProject = () => app.projectHandler.deleteCurrentProject();
window.cloneCurrentProject = () => app.projectHandler.cloneCurrentProject();
window.toggleProjectLock = () => app.projectHandler.toggleProjectLock();
window.expandAllCategories = () => { app.state.categories.forEach(c => c.collapsed = false); app.storageHandler.save(); app.projectHandler.renderProjectList(); };
window.collapseAllCategories = () => { app.state.categories.forEach(c => c.collapsed = true); app.storageHandler.save(); app.projectHandler.renderProjectList(); };
window.toggleSidebar = () => {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  sidebar.classList.toggle('collapsed');
  toggleBtn.classList.toggle('toggle-right');
};

document.addEventListener('DOMContentLoaded', () => app.init());

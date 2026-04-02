class ProjectHandler {
  constructor(app) {
    this.app = app;
    this.currentSettingCategoryId = null;
  }

  init() {
    document.getElementById('add-project-btn')?.addEventListener('click', () => this.addProject());
    document.getElementById('add-category-btn')?.addEventListener('click', () => this.addCategory());
    document.getElementById('project-title')?.addEventListener('blur', (e) => this.updateProjectTitle(e));
    document.getElementById('btn-toggle-pd')?.addEventListener('click', () => this.toggleProjectDetails());
    document.getElementById('btn-delete-project')?.addEventListener('click', () => this.deleteCurrentProject());
    document.getElementById('btn-clone-project')?.addEventListener('click', () => this.cloneCurrentProject());
    document.getElementById('btn-project-lock')?.addEventListener('click', () => this.toggleProjectLock());
    document.getElementById('overlay')?.addEventListener('click', () => {
      this.closeCategoryModal();
    });
    this.updateProjectSummary();
  }

  selectProject(id) {
    this.app.state.activeProjectId = id;
    this.app.renderAll();
    this.updateProjectSummary();
  }

  addProject() {
    const newId = 'p' + Date.now();
    this.app.state.projects.push({
      id: newId,
      name: 'Novo Projeto',
      details: { venda: '', categoria: '', cliente: '', local: '', equipamento: '', elaborado: '', aprovado: '', revisao: '', dataElab: '', tituloCronograma: '' }
    });
    this.app.state.activeProjectId = newId;
    this.app.storageHandler.save();
    this.app.renderAll();
  }

  addCategory() {
    this.currentSettingCategoryId = null;
    document.getElementById('cat-modal-title').innerText = 'Nova Categoria';
    document.getElementById('cat-name-input').value = '';
    
    // Hide clone/delete buttons for new categories
    const actionRow = document.querySelector('.category-modal-actions');
    if (actionRow) actionRow.style.display = 'none';
    
    this.openCategoryModal();
  }

  openCategoryModal() {
    document.getElementById('category-modal')?.classList.add('active');
    document.getElementById('overlay')?.classList.add('visible');
    document.getElementById('cat-name-input')?.focus();
  }

  closeCategoryModal() {
    document.getElementById('category-modal')?.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('visible');
    this.currentSettingCategoryId = null;
  }

  openCategorySettings(catId) {
    const cat = this.app.state.categories.find(c => c.id === catId);
    if (!cat) return;

    this.currentSettingCategoryId = catId;
    document.getElementById('cat-modal-title').innerText = 'Configurar Categoria';
    document.getElementById('cat-name-input').value = cat.name;

    // Show clone/delete buttons for existing categories
    const actionRow = document.querySelector('.category-modal-actions');
    if (actionRow) actionRow.style.display = 'block';

    this.openCategoryModal();
  }

  saveCategorySettings() {
    const nameInput = document.getElementById('cat-name-input');
    const name = nameInput.value.trim();
    if (!name) {
      alert("Por favor, insira um nome para a categoria.");
      return;
    }

    if (this.currentSettingCategoryId) {
      // Edit
      const cat = this.app.state.categories.find(c => c.id === this.currentSettingCategoryId);
      if (cat) cat.name = name;
    } else {
      // New
      this.app.state.categories.push({ id: 'c' + Date.now(), name: name, collapsed: false });
    }

    this.app.storageHandler.save();
    this.closeCategoryModal();
    this.renderProjectList();
    this.renderProjectDetails();
  }

  deleteCategoryFromModal() {
    if (!this.currentSettingCategoryId) return;
    const catId = this.currentSettingCategoryId;
    this.closeCategoryModal();
    this.deleteCategory(catId);
  }

  cloneCategoryFromModal() {
    if (!this.currentSettingCategoryId) return;
    const catId = this.currentSettingCategoryId;
    this.closeCategoryModal();
    this.cloneCategory(catId);
  }

  cloneCategory(catId) {
    const originalCat = this.app.state.categories.find(c => c.id === catId);
    if (!originalCat) return;

    this.app.showConfirm(`Deseja clonar a categoria "${originalCat.name}" e todos os seus projetos?`, () => {
      const newCatId = 'c' + Date.now();
      const newCat = { 
        ...originalCat, 
        id: newCatId, 
        name: originalCat.name + " (Cópia)", 
        collapsed: false 
      };
      this.app.state.categories.push(newCat);

      // Clone Projects
      const projectsToClone = this.app.state.projects.filter(p => p.details?.categoria === catId);
      
      projectsToClone.forEach(p => {
        const newProjectId = 'p' + Date.now() + Math.random().toString(36).slice(2, 5);
        const clonedProject = JSON.parse(JSON.stringify(p));
        clonedProject.id = newProjectId;
        clonedProject.details.categoria = newCatId;
        clonedProject.name += " (Cópia)";
        clonedProject.isLocked = false;
        this.app.state.projects.push(clonedProject);

        // Clone Groups for this project
        const projGroups = this.app.state.groups.filter(g => g.projectId === p.id);
        projGroups.forEach(g => {
          const newGroupId = 'g' + Date.now() + Math.random().toString(36).slice(2, 7);
          const clonedGroup = { ...g, id: newGroupId, projectId: newProjectId };
          this.app.state.groups.push(clonedGroup);

          // Clone Tasks for this group
          const groupTasks = this.app.state.tasks.filter(t => t.groupId === g.id);
          groupTasks.forEach(t => {
            const clonedTask = { 
              ...t, 
              id: 't' + Date.now() + Math.random().toString(36).slice(2, 7), 
              groupId: newGroupId 
            };
            this.app.state.tasks.push(clonedTask);
          });
        });
      });

      this.app.storageHandler.save();
      this.renderProjectList();
      alert("Categoria clonada com sucesso!");
    });
  }

  updateProjectTitle(e) {
    const p = this.activeProject;
    if (p) {
      p.name = e.target.innerText;
      this.app.storageHandler.save();
      this.app.renderProjectList();
    }
  }

  toggleProjectDetails() {
    const container = document.getElementById('project-details-container');
    const btn = document.getElementById('btn-toggle-pd');
    if (!container || !btn) return;
    
    const isActive = container.classList.toggle('active');
    btn.classList.toggle('active', isActive);
    
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isActive ? 'fas fa-times' : 'fas fa-info-circle';
    }
  }

  toggleProjectLock() {
    const proj = this.activeProject;
    if (!proj) return;

    const isLocked = proj.isLocked || false;
    
    if (isLocked) {
      if (this.app.authHandler.role !== 'admin') {
        alert("Apenas administradores podem destravar um projeto.");
        return;
      }
      proj.isLocked = false;
      this.app.storageHandler.logAction('unlock_project', { name: proj.name });
    } else {
      if (this.app.authHandler.role !== 'admin' && this.app.authHandler.role !== 'editor') {
        alert("Você não tem permissão para travar este projeto.");
        return;
      }
      proj.isLocked = true;
      this.app.storageHandler.logAction('lock_project', { name: proj.name });
    }
    
    this.app.storageHandler.save();
    this.app.applyPermissions();
  }

  deleteCurrentProject() {
    if (this.app.authHandler.role !== 'admin') {
      alert("Apenas administradores podem excluir projetos.");
      return;
    }
    
    this.app.showConfirm(`Tem certeza que deseja EXCLUIR o projeto inteiro? Todos os grupos e tarefas serão apagados permanentemente.`, () => {
      const pId = this.app.state.activeProjectId;
      this.app.state.projects = this.app.state.projects.filter(p => p.id !== pId);
      this.app.state.groups = this.app.state.groups.filter(g => g.projectId !== pId);
      
      const validGroupIds = this.app.state.groups.map(g => g.id);
      this.app.state.tasks = this.app.state.tasks.filter(t => validGroupIds.includes(t.groupId));
      
      if (this.app.state.projects.length > 0) {
        this.app.state.activeProjectId = this.app.state.projects[0].id;
      } else {
        const newId = 'p' + Date.now();
        this.app.state.projects.push({ id: newId, name: 'Meu Primeiro Projeto', details: {} });
        this.app.state.activeProjectId = newId;
      }
      
      this.app.storageHandler.save();
      this.app.renderAll();
      this.app.storageHandler.logAction('delete_project', { name: this.activeProject?.name || 'Unknown' });
    });
  }

  cloneCurrentProject() {
    if (this.app.authHandler.role !== 'admin' && this.app.authHandler.role !== 'editor') return;
    
    this.app.showConfirm("Tem certeza que deseja DUPLICAR o projeto inteiro?", () => {
      const originalProject = this.activeProject;
      if (!originalProject) return;

      const newProjectId = 'p' + Date.now();
      const clonedProject = JSON.parse(JSON.stringify(originalProject));
      clonedProject.id = newProjectId;
      clonedProject.name += " (Cópia)";
      clonedProject.isLocked = false;
      this.app.state.projects.push(clonedProject);

      const projGroups = this.app.state.groups.filter(g => g.projectId === originalProject.id);
      projGroups.forEach(g => {
        const newGroupId = 'g' + Date.now() + Math.random().toString(36).slice(2, 7);
        const clonedGroup = { ...g, id: newGroupId, projectId: newProjectId };
        this.app.state.groups.push(clonedGroup);

        const groupTasks = this.app.state.tasks.filter(t => t.groupId === g.id);
        groupTasks.forEach(t => {
          const clonedTask = { ...t, id: 't' + Date.now() + Math.random().toString(36).slice(2, 7), groupId: newGroupId };
          this.app.state.tasks.push(clonedTask);
        });
      });

      this.app.state.activeProjectId = newProjectId;
      this.app.storageHandler.save();
      this.selectProject(newProjectId);
    });
  }

  get activeProject() {
    return this.app.state.projects.find(p => p.id === this.app.state.activeProjectId);
  }

  get isProjectLocked() {
    return this.activeProject?.isLocked || false;
  }

  renderProjectList() {
    const container = document.getElementById('sidebar-tree');
    if (!container) return;

    const searchTerm = (window.currentSearchTerm || '').toLowerCase().trim();
    
    let html = `
      <div class="tree-section">
        <div class="tree-section-header" onclick="app.projectHandler.toggleSection()">
          <i class="fas fa-folder-open tree-icon"></i>
          <span class="tree-label">Projetos</span>
          <span class="tree-count">${this.app.state.projects.length}</span>
          <i class="fas fa-chevron-down tree-arrow"></i>
        </div>
        <div class="tree-categories" id="tree-categories">`;

    this.app.state.categories.forEach(cat => {
      let catProjects = this.app.state.projects.filter(p => p.details?.categoria === cat.id);
      if (searchTerm) catProjects = catProjects.filter(p => p.name.toLowerCase().includes(searchTerm));
      if (searchTerm && catProjects.length === 0) return;

      const isExpanded = !cat.collapsed;
      html += `
        <div class="tree-category">
          <div class="tree-category-header">
            <button class="tree-category-config" onclick="event.stopPropagation(); app.projectHandler.openCategorySettings('${cat.id}')" title="Configurar Categoria">
              <i class="fas fa-cog"></i>
            </button>
            <div class="tree-category-left" onclick="app.projectHandler.toggleCategory('${cat.id}')">
              <i class="fas fa-chevron-right tree-arrow ${isExpanded ? '' : 'collapsed'}"></i>
              <span class="tree-label">${cat.name}</span>
              <span class="tree-count">${catProjects.length}</span>
            </div>
            <div class="tree-category-actions">
              <button class="tree-category-move" onclick="event.stopPropagation(); app.projectHandler.moveCategory('${cat.id}', 'up')" title="Mover para Cima"><i class="fas fa-chevron-up"></i></button>
              <button class="tree-category-move" onclick="event.stopPropagation(); app.projectHandler.moveCategory('${cat.id}', 'down')" title="Mover para Baixo"><i class="fas fa-chevron-down"></i></button>
            </div>
          </div>
          <div class="tree-projects" style="display: ${isExpanded || searchTerm ? 'block' : 'none'};">
            ${catProjects.map(p => `
              <div class="tree-project ${p.id === this.app.state.activeProjectId ? 'active' : ''}" onclick="app.projectHandler.selectProject('${p.id}')">
                <span class="tree-dot"></span>
                <span class="tree-name">${p.name}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    });

    let uncategorized = this.app.state.projects.filter(p => !p.details?.categoria);
    if (searchTerm) uncategorized = uncategorized.filter(p => p.name.toLowerCase().includes(searchTerm));

    if (uncategorized.length > 0) {
      const isGeralExpanded = !this.app.state.geralCollapsed;
      html += `
        <div class="tree-category">
          <div class="tree-category-header">
            <div class="tree-category-left" onclick="app.projectHandler.toggleGeral()">
              <i class="fas fa-chevron-right tree-arrow ${isGeralExpanded ? '' : 'collapsed'}" style="opacity: 0.5;"></i>
              <i class="fas fa-folder tree-folder" style="opacity: 0.7;"></i>
              <span class="tree-label">Geral</span>
              <span class="tree-count">${uncategorized.length}</span>
            </div>
          </div>
          <div class="tree-projects" style="display: ${isGeralExpanded ? 'block' : 'none'};">
            ${uncategorized.map(p => `
              <div class="tree-project ${p.id === this.app.state.activeProjectId ? 'active' : ''}" onclick="app.projectHandler.selectProject('${p.id}')">
                <span class="tree-dot"></span>
                <span class="tree-name">${p.name}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
    this.app.applyPermissions();

    const activeP = this.activeProject;
    if (activeP) {
      const titleEl = document.getElementById('project-title');
      if (titleEl) titleEl.innerText = activeP.name;
      this.app.updateProjectStatusIndicator();
    }
  }

  toggleCategory(catId) {
    const cat = this.app.state.categories.find(c => c.id === catId);
    if (cat) {
      cat.collapsed = !cat.collapsed;
      this.app.storageHandler.save();
      this.renderProjectList();
    }
  }

  toggleGeral() {
    this.app.state.geralCollapsed = !this.app.state.geralCollapsed;
    this.app.storageHandler.save();
    this.renderProjectList();
  }

  toggleSection() {
    const categoriesDiv = document.getElementById('tree-categories');
    const header = document.querySelector('.tree-section-header');
    if (categoriesDiv) {
      const isHidden = categoriesDiv.style.display === 'none';
      categoriesDiv.style.display = isHidden ? 'block' : 'none';
      header?.classList.toggle('collapsed', !isHidden);
    }
  }

  moveCategory(catId, direction) {
    const index = this.app.state.categories.findIndex(c => c.id === catId);
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
      [this.app.state.categories[index], this.app.state.categories[index - 1]] = [this.app.state.categories[index - 1], this.app.state.categories[index]];
    } else if (direction === 'down' && index < this.app.state.categories.length - 1) {
      [this.app.state.categories[index], this.app.state.categories[index + 1]] = [this.app.state.categories[index + 1], this.app.state.categories[index]];
    } else return;
    
    this.app.storageHandler.save();
    this.renderProjectList();
  }

  renameCategory(catId, newName) {
    const cat = this.app.state.categories.find(c => c.id === catId);
    if (cat && newName.trim()) {
      cat.name = newName.trim();
      this.app.storageHandler.save();
    }
    this.renderProjectList();
  }

  deleteCategory(catId) {
    const cat = this.app.state.categories.find(c => c.id === catId);
    if (!cat) return;
    
    const catProjects = this.app.state.projects.filter(p => p.details?.categoria === catId);
    const projectCount = catProjects.length;
    
    const message = projectCount > 0
      ? `A categoria "${cat.name}" contém ${projectCount} projeto(s).\n\nAo excluir, os projetos serão movidos para "Geral".\n\nDeseja continuar?`
      : `Deseja excluir a categoria "${cat.name}"?`;
    
    this.app.showConfirm(message, () => {
      catProjects.forEach(p => { p.details.categoria = ''; });
      this.app.state.categories = this.app.state.categories.filter(c => c.id !== catId);
      this.app.storageHandler.save();
      this.renderProjectList();
    });
  }

  renderProjectDetails() {
    const p = this.activeProject;
    if (!p) return;
    
    p.details = { venda: '', categoria: '', cliente: '', local: '', equipamento: '', elaborado: '', aprovado: '', revisao: '', dataElab: '', dataLimite: '', tituloCronograma: '', ...p.details };
    
    const fields = [
      { id: 'categoria', label: 'Categoria', icon: 'fa-folder', type: 'select' },
      { id: 'venda', label: 'Nº de Venda', icon: 'fa-hashtag' },
      { id: 'cliente', label: 'Cliente', icon: 'fa-building', placeholder: 'Nome do cliente', wide: true },
      { id: 'local', label: 'Local/Área', icon: 'fa-map-marker-alt', placeholder: 'Local da obra', wide: true },
      { id: 'equipamento', label: 'Equipamento', icon: 'fa-cogs', placeholder: 'Tipo de equipamento', wide: true, equip: true },
      { id: 'elaborado', label: 'Elaborado por', icon: 'fa-user-edit', placeholder: 'Responsável' },
      { id: 'aprovado', label: 'Aprovado por', icon: 'fa-user-check', placeholder: 'Aprovador' },
      { id: 'dataElab', label: 'Data Elab.', icon: 'fa-calendar', type: 'date' },
      { id: 'dataLimite', label: 'Data Limite', icon: 'fa-calendar-check', type: 'date' },
      { id: 'revisao', label: 'Revisão', icon: 'fa-code-branch', placeholder: 'Ex: 01', narrow: true },
      { id: 'tituloCronograma', label: 'Título Cronograma', icon: 'fa-heading', placeholder: 'Título exibido no PDF do cronograma', wide: true }
    ];

    const html = fields.map(f => {
      let inputHtml = '';
      
      if (f.type === 'select') {
        inputHtml = `<select onchange="app.projectHandler.updateProjectDetail('${f.id}', this.value)" class="detail-select">
            <option value="">Geral (Sem categoria)</option>
            ${this.app.state.categories.map(c => `<option value="${c.id}" ${p.details[f.id] === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>`;
      } else if (f.type === 'date') {
        inputHtml = `<input type="date" value="${p.details[f.id] || ''}" onchange="app.projectHandler.updateProjectDetail('${f.id}', this.value)" class="detail-date-input">`;
      } else {
        inputHtml = `<input type="text" value="${p.details[f.id] || ''}" onblur="app.projectHandler.updateProjectDetail('${f.id}', this.value)" placeholder="${f.placeholder || ''}" list="assignees-list" class="detail-text-input">`;
      }
      
      return `<div class="input-group-top${f.wide ? ' field-wide' : ''}${f.equip ? ' field-equip' : ''}${f.narrow ? ' field-narrow' : ''}">
        <label><i class="fas ${f.icon}"></i>${f.label}</label>
        ${inputHtml}
      </div>`;
    }).join('');

    const pdGrid = document.getElementById('pd-grid');
    if (pdGrid) pdGrid.innerHTML = html;
  }

  updateProjectDetail(field, value) {
    if (!this.app.authHandler?.canEdit()) return;
    if (this.activeProject?.details) {
      this.activeProject.details[field] = value;
      this.app.storageHandler.save();
      
      // Se mudar a categoria, re-renderiza o sidebar para o projeto ir para o lugar certo
      if (field === 'categoria') {
        this.renderProjectList();
      }

      // Atualiza o sumário no cabeçalho se um dos campos principais mudar
      const summaryFields = ['venda', 'cliente', 'local', 'equipamento'];
      if (summaryFields.includes(field)) {
        this.updateProjectSummary();
      }
    }
  }

  updateProjectSummary() {
    const p = this.activeProject;
    if (!p) return;
    
    const details = p.details || {};
    const elements = {
      'venda': document.getElementById('summary-venda'),
      'cliente': document.getElementById('summary-cliente'),
      'local': document.getElementById('summary-local'),
      'equipamento': document.getElementById('summary-equipamento')
    };

    for (const [key, el] of Object.entries(elements)) {
      if (el) el.innerText = details[key] || '---';
    }
  }
}

window.ProjectHandler = ProjectHandler;

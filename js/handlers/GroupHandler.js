class GroupHandler {
  constructor(app) {
    this.app = app;
    this.initialLoadComplete = false;
  }

  init() {
    document.getElementById('add-group-btn')?.addEventListener('click', () => this.addGroup());
  }

  addGroup() {
    const maxOrder = Math.max(0, ...this.app.state.groups.filter(g => g.projectId === this.app.state.activeProjectId).map(g => g.order || 0));
    this.app.state.groups.push({
      id: 'g' + Date.now(),
      title: 'Novo Grupo',
      color: '#c4c4c4',
      projectId: this.app.state.activeProjectId,
      order: maxOrder + 1
    });
    this.app.storageHandler.save();
    this.renderBoard();
  }

  renderBoard() {
    const container = document.getElementById('groups-container');
    if (!container) return;

    const projGroups = this.app.state.groups
      .filter(g => g.projectId === this.app.state.activeProjectId)
      .sort((a, b) => a.order - b.order);

    const allAssignees = [...new Set(this.app.state.tasks.map(t => t.assignee).filter(a => a?.trim()))].sort();
    const datalistHtml = `<datalist id="assignees-list">${allAssignees.map(a => `<option value="${a}">`).join('')}</datalist>`;

    if (projGroups.length === 0) {
      container.innerHTML = datalistHtml + `<div class="empty-state">Nenhum grupo neste projeto.</div>`;
      return;
    }

    let html = datalistHtml;
    projGroups.forEach(group => {
      const groupTasks = this.app.state.tasks.filter(t => t.groupId === group.id).sort((a, b) => a.order - b.order);
      html += this.renderGroupSection(group, groupTasks);
    });

    container.innerHTML = html;
    
    if (this.initialLoadComplete) {
      container.classList.add('no-animations');
    } else {
      this.initialLoadComplete = true;
      setTimeout(() => container.classList.add('no-animations'), 500);
    }
    
    this.app.updateProjectStatusIndicator();
    this.app.applyPermissions();
  }

  renderGroupSection(group, groupTasks) {
    return `
      <div class="group-section" style="--group-color: ${group.color};">
        <div class="group-header">
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="btn-icon tooltip group-move-btn" onclick="app.groupHandler.moveGroup('${group.id}', 'up')" title="Mover para Cima"><i class="fas fa-chevron-up"></i></button>
            <button class="btn-icon tooltip group-move-btn" onclick="app.groupHandler.moveGroup('${group.id}', 'down')" title="Mover para Baixo"><i class="fas fa-chevron-down"></i></button>
          </div>
          <h3 class="group-title" contenteditable="true" spellcheck="false" onblur="app.groupHandler.updateGroupTitle('${group.id}', this.innerText)">${group.title}</h3>
          <span class="task-count">${groupTasks.length} tarefas</span>
          <div class="group-actions">
            <input type="color" value="${group.color}" class="color-picker tooltip" title="Mudar Cor" onchange="app.groupHandler.updateGroupColor('${group.id}', this.value)" />
            <button class="btn-icon tooltip group-action-btn" onclick="app.groupHandler.cloneGroup('${group.id}')" title="Clonar Grupo"><i class="fas fa-clone"></i></button>
            <button class="btn-icon tooltip group-action-btn group-delete-btn" onclick="app.groupHandler.deleteGroup('${group.id}')" title="Excluir Grupo"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <table class="tasks-table">
          <thead>
            <tr>
              <th class="cell-desc">Tarefa</th>
              <th class="cell-assignee">Responsável</th>
              <th class="cell-date">Início</th>
              <th class="cell-estimated">Prazo (d)</th>
              <th class="cell-date">Entrega</th>
              <th class="cell-days">Status</th>
              <th class="cell-status">Progresso</th>
              <th class="cell-urgency">Urgência</th>
              <th class="cell-actions" title="Comentários"><i class="fas fa-comment"></i></th>
              <th class="cell-actions"></th>
            </tr>
          </thead>
          <tbody ondragover="app.dragOver(event)" ondragleave="app.dragLeave(event)" ondrop="app.dropTask(event, '${group.id}')">
            ${groupTasks.map(task => this.app.taskHandler.renderTaskRow(task, group.color)).join('')}
          </tbody>
        </table>
        <div class="group-footer">
          <input type="text" placeholder="Adicionar nova tarefa..." class="quick-add-task" id="quick-input-${group.id}" onkeypress="app.taskHandler.handleQuickAdd(event, '${group.id}', this)" />
          <button class="btn-primary" onclick="app.taskHandler.quickAddBtn('${group.id}')">Adicionar</button>
        </div>
      </div>`;
  }

  updateGroupTitle(id, newTitle) {
    const g = this.app.state.groups.find(g => g.id === id);
    if (g) {
      g.title = newTitle;
      this.app.storageHandler.save();
    }
  }

  updateGroupColor(id, color) {
    const g = this.app.state.groups.find(g => g.id === id);
    if (g) {
      g.color = color;
      this.app.storageHandler.save();
      this.renderBoard();
    }
  }

  moveGroup(groupId, direction) {
    const group = this.app.state.groups.find(g => g.id === groupId);
    if (!group) return;
    
    const projGroups = this.app.state.groups.filter(g => g.projectId === group.projectId).sort((a, b) => a.order - b.order);
    const groupIndex = projGroups.findIndex(g => g.id === groupId);
    
    if ((direction === 'up' && groupIndex <= 0) || (direction === 'down' && groupIndex >= projGroups.length - 1)) return;
    
    const currentOrder = group.order;
    const otherGroup = direction === 'up' ? projGroups[groupIndex - 1] : projGroups[groupIndex + 1];
    
    group.order = otherGroup.order;
    otherGroup.order = currentOrder;
    
    this.app.storageHandler.save();
    this.app.refreshActiveView();
  }

  deleteGroup(id) {
    if (!this.app.authHandler?.canEdit() && this.app.authHandler.role !== 'admin') {
      alert("Acesso Negado: Você não tem permissão para excluir grupos.");
      return;
    }
    this.app.showConfirm("Tem certeza que deseja excluir este grupo inteiro?", () => {
      this.app.state.groups = this.app.state.groups.filter(g => g.id !== id);
      this.app.state.tasks = this.app.state.tasks.filter(t => t.groupId !== id);
      this.app.storageHandler.save();
      this.renderBoard();
    });
  }

  cloneGroup(groupId) {
    if (!this.app.authHandler?.canEdit()) return;
    const originalGroup = this.app.state.groups.find(g => g.id === groupId);
    if (!originalGroup) return;

    const newGroupId = 'g' + Date.now() + Math.random().toString(36).slice(2, 7);
    const clonedGroup = { ...originalGroup, id: newGroupId, title: originalGroup.title + " (Cópia)" };
    clonedGroup.order = Math.max(0, ...this.app.state.groups.filter(g => g.projectId === originalGroup.projectId).map(g => g.order || 0)) + 1;
    
    this.app.state.groups.push(clonedGroup);

    const groupTasks = this.app.state.tasks.filter(t => t.groupId === groupId);
    groupTasks.forEach(t => {
      const clonedTask = { ...t, id: 't' + Date.now() + Math.random().toString(36).slice(2, 7), groupId: newGroupId };
      this.app.state.tasks.push(clonedTask);
    });

    this.app.storageHandler.save();
    this.renderBoard();
  }
}

window.GroupHandler = GroupHandler;

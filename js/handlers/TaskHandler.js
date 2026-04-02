class TaskHandler {
  constructor(app) {
    this.app = app;
    this.activeCommentTaskId = null;
  }

  init() {
    document.getElementById('close-comment-panel')?.addEventListener('click', () => this.closeComments());
    document.getElementById('overlay')?.addEventListener('click', () => this.app.closeConfirmModal());
    document.getElementById('btn-add-comment')?.addEventListener('click', () => this.addComment());
  }

  renderTaskRow(task, groupColor) {
    const statusClass = `status-${task.status.toLowerCase()}`;
    const urgClass = task.urgency === 'Normal' ? 'urg-normal' : task.urgency === 'Importante' ? 'urg-important' : task.urgency === 'Urgente' ? 'urg-urgent' : 'urg-critical';
    const hasComments = task.comments?.length > 0;
    const daysBadge = this.calcDaysBadge(task);

    return `
      <tr class="task-row" draggable="true" ondragstart="app.dragStart(event, '${task.id}')" ondragend="app.dragEnd(event)">
        <td class="task-cell cell-desc" style="--group-color: ${groupColor};">
          <div class="task-desc-wrapper">
            <div class="move-btn-group">
              <button class="btn-icon" onclick="app.taskHandler.moveTask('${task.id}', 'up')" title="Mover para Cima"><i class="fas fa-chevron-up"></i></button>
              <button class="btn-icon" onclick="app.taskHandler.moveTask('${task.id}', 'down')" title="Mover para Baixo"><i class="fas fa-chevron-down"></i></button>
            </div>
            <input type="text" class="task-desc-input" value="${task.title}" onblur="app.taskHandler.updateTask('${task.id}', 'title', this.value)">
          </div>
        </td>
        <td class="task-cell cell-assignee">
          <input type="text" class="task-assignee-input" value="${task.assignee}" placeholder="Sem resp." onblur="app.taskHandler.updateTask('${task.id}', 'assignee', this.value)" list="assignees-list">
        </td>
        <td class="task-cell cell-date">
          <input type="date" class="task-date-input" value="${task.startDate}" onchange="app.taskHandler.updateTask('${task.id}', 'startDate', this.value)">
        </td>
        <td class="task-cell cell-estimated">
          <input type="number" class="task-days-input" value="${task.estimatedDays || 1}" min="1" onchange="app.taskHandler.updateTask('${task.id}', 'estimatedDays', parseInt(this.value))">
        </td>
        <td class="task-cell cell-date">
          <input type="date" class="task-date-input" value="${task.dueDate}" disabled title="Calculado automaticamente">
        </td>
        <td class="task-cell cell-days">${daysBadge}</td>
        <td class="task-cell cell-status">
          <select class="status-select ${statusClass}" onchange="app.taskHandler.updateTask('${task.id}', 'status', this.value)">
            ${this.app.STATUS_OPTIONS.map(opt => `<option value="${opt}" ${task.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </td>
        <td class="task-cell cell-urgency">
          <select class="urgency-select ${urgClass}" onchange="app.taskHandler.updateTask('${task.id}', 'urgency', this.value)">
            ${this.app.URGENCY_OPTIONS.map(opt => `<option value="${opt}" ${task.urgency === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </td>
        <td class="task-cell cell-actions">
          <button class="btn-icon ${hasComments ? 'has-comments' : ''}" onclick="app.taskHandler.openComments('${task.id}')" title="Comentários">
            <i class="${hasComments ? 'fas' : 'far'} fa-comment-alt"></i>
            ${hasComments ? `<span class="comment-count">${task.comments.length}</span>` : ''}
          </button>
        </td>
        <td class="task-cell cell-actions">
          <div class="task-actions">
            <button class="btn-icon" onclick="app.taskHandler.cloneTask('${task.id}')" title="Clonar"><i class="fas fa-clone"></i></button>
            <button class="btn-icon task-delete-btn" onclick="app.taskHandler.deleteTask('${task.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }

  calcDaysBadge(task) {
    if (!task.startDate || !task.dueDate) return '<span class="days-badge days-normal">-</span>';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate + 'T00:00:00');
    const duration = task.estimatedDays || 1;
    const statusClass = `status-${task.status.toLowerCase()}`;
    
    if (task.status === 'Feito') {
      return `<span class="days-badge ${statusClass} days-done"><i class="fas fa-check"></i> ${duration}d</span>`;
    }
    
    const daysUntilDue = Math.round((due - today) / (1000 * 60 * 60 * 24));
    if (daysUntilDue < 0) {
      return `<span class="days-badge ${statusClass} days-overdue"><i class="fas fa-exclamation-triangle"></i> ${Math.abs(daysUntilDue)}d</span>`;
    }
    return `<span class="days-badge ${statusClass} days-normal">${duration}d</span>`;
  }

  calculateDueDate(startDate, days) {
    if (!startDate || !days) return startDate;
    const date = new Date(startDate + 'T00:00:00');
    date.setDate(date.getDate() + (parseInt(days) - 1));
    return date.toISOString().split('T')[0];
  }

  updateTask(id, field, value) {
    if (!this.app.authHandler?.canEdit()) return;
    const task = this.app.state.tasks.find(t => t.id === id);
    if (task) {
      task[field] = value;
      
      if (field === 'startDate' || field === 'estimatedDays') {
        task.dueDate = this.calculateDueDate(task.startDate, task.estimatedDays || 1);
      }
      
      this.app.storageHandler.save();
      this.app.groupHandler.renderBoard();
    }
  }

  moveTask(taskId, direction) {
    const task = this.app.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const groupTasks = this.app.state.tasks.filter(t => t.groupId === task.groupId).sort((a, b) => a.order - b.order);
    const taskIndex = groupTasks.findIndex(t => t.id === taskId);
    
    if ((direction === 'up' && taskIndex <= 0) || (direction === 'down' && taskIndex >= groupTasks.length - 1)) return;
    
    const currentOrder = task.order;
    const otherTask = direction === 'up' ? groupTasks[taskIndex - 1] : groupTasks[taskIndex + 1];
    
    task.order = otherTask.order;
    otherTask.order = currentOrder;
    
    this.app.storageHandler.save();
    this.app.refreshActiveView();
  }

  deleteTask(id) {
    if (!this.app.authHandler?.canEdit()) return;
    this.app.showConfirm("Tem certeza que deseja excluir esta tarefa?", () => {
      this.app.state.tasks = this.app.state.tasks.filter(t => t.id !== id);
      this.app.storageHandler.save();
      this.app.groupHandler.renderBoard();
    });
  }

  cloneTask(taskId) {
    if (!this.app.authHandler?.canEdit()) return;
    const originalTask = this.app.state.tasks.find(t => t.id === taskId);
    if (!originalTask) return;

    const clonedTask = { ...originalTask, id: 't' + Date.now() + Math.random().toString(36).slice(2, 7), title: originalTask.title + " (Cópia)" };
    clonedTask.order = Math.max(0, ...this.app.state.tasks.filter(t => t.groupId === originalTask.groupId).map(t => t.order || 0)) + 1;
    
    const taskIndex = this.app.state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex > -1) {
      this.app.state.tasks.splice(taskIndex + 1, 0, clonedTask);
    } else {
      this.app.state.tasks.push(clonedTask);
    }

    this.app.storageHandler.save();
    this.app.groupHandler.renderBoard();
  }

  handleQuickAdd(e, groupId, inputEl) {
    if (e.key === 'Enter') {
      this.createTask(inputEl.value.trim(), groupId);
      inputEl.value = '';
    }
  }

  quickAddBtn(groupId) {
    const inputEl = document.getElementById('quick-input-' + groupId);
    if (inputEl) {
      this.createTask(inputEl.value.trim(), groupId);
      inputEl.value = '';
    }
  }

  createTask(title, groupId) {
    if (!this.app.authHandler?.canEdit() || !title.trim()) return;
    
    const maxOrder = Math.max(0, ...this.app.state.tasks.filter(t => t.groupId === groupId).map(t => t.order || 0));
    const today = new Date().toISOString().split('T')[0];
    const estimatedDays = 1;
    const dueDate = this.calculateDueDate(today, estimatedDays);
    
    this.app.state.tasks.push({
      id: 't' + Date.now(),
      groupId,
      title: title.trim(),
      assignee: '',
      startDate: today,
      estimatedDays: estimatedDays,
      dueDate: dueDate,
      status: 'Parado',
      urgency: 'Normal',
      comments: [],
      order: maxOrder + 1
    });
    
    this.app.storageHandler.save();
    this.app.groupHandler.renderBoard();
  }

  openComments(taskId) {
    this.activeCommentTaskId = taskId;
    const task = this.app.state.tasks.find(t => t.id === taskId);
    document.getElementById('comment-panel')?.classList.add('open');
    document.getElementById('overlay')?.classList.add('visible');
    this.renderCommentsList(task);
  }

  closeComments() {
    document.getElementById('comment-panel')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('visible');
    this.activeCommentTaskId = null;
  }

  addComment() {
    if (!this.app.authHandler?.canEdit() || !this.activeCommentTaskId) return;
    
    const input = document.getElementById('new-comment-input');
    const text = input?.value.trim();
    if (!text) return;

    const task = this.app.state.tasks.find(t => t.id === this.activeCommentTaskId);
    if (task) {
      if (!task.comments) task.comments = [];
      task.comments.push({ text, date: new Date().toLocaleString('pt-BR') });
      input.value = '';
      this.app.storageHandler.save();
      this.renderCommentsList(task);
      this.app.groupHandler.renderBoard();
    }
  }

  renderCommentsList(task) {
    const container = document.getElementById('comments-list');
    if (!container) return;
    if (!task?.comments?.length) {
      container.innerHTML = `<p class="no-comments">Nenhum comentário ainda.</p>`;
      return;
    }

    const canEdit = this.app.authHandler?.canEdit();
    container.innerHTML = task.comments.map((c, idx) => `
      <div class="comment-item">
        <p class="comment-text">${c.text}</p>
        <div class="comment-footer">
          <span class="comment-date"><i class="far fa-clock"></i> ${c.date}</span>
          ${canEdit ? `<button class="btn-delete-comment" onclick="app.taskHandler.deleteComment('${task.id}', ${idx})"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
    `).join('');
  }

  deleteComment(taskId, commentIdx) {
    if (!this.app.authHandler?.canEdit()) return;
    const task = this.app.state.tasks.find(t => t.id === taskId);
    if (task?.comments?.[commentIdx]) {
      this.app.showConfirm("Deseja excluir este comentário?", () => {
        task.comments.splice(commentIdx, 1);
        this.app.storageHandler.save();
        this.renderCommentsList(task);
        this.app.groupHandler.renderBoard();
      });
    }
  }

  dragStart(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
    e.currentTarget.style.opacity = '0.4';
  }

  dragEnd(e) {
    e.currentTarget.style.opacity = '1';
  }

  dragOver(e) {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)';
  }

  dragLeave(e) {
    e.currentTarget.style.backgroundColor = '';
  }

  dropTask(e, groupId) {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '';
    const taskId = e.dataTransfer.getData('text/plain');
    const task = this.app.state.tasks.find(t => t.id === taskId);
    if (task && task.groupId !== groupId) {
      task.groupId = groupId;
      this.app.storageHandler.save();
      this.app.groupHandler.renderBoard();
    }
  }
}

window.TaskHandler = TaskHandler;

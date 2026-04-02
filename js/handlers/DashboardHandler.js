class DashboardHandler {
  constructor(app) {
    this.app = app;
    this.initialLoadComplete = false;
  }

  init() {
    const btn = document.getElementById('nav-dashboard-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.app.state.activeProjectId = null;
        this.app.refreshActiveView();
        this.renderDashboard();
      });
    }
  }

  // Abre determinado projeto clicando no dashboard e muda a view pra Tabela
  openProject(projectId) {
    this.app.projectHandler.selectProject(projectId);
    document.getElementById('btn-view-board').click();
  }

  renderDashboard() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    // Calcular Métricas Atuais
    const today = new Date();
    today.setHours(0,0,0,0);

    const parseDateInput = (str) => {
      if (!str) return null;
      if (str.includes('/')) {
        const p = str.split('/');
        return new Date(p[2], p[1]-1, p[0]);
      }
      if (str.includes('-')) {
        const p = str.split('-');
        return new Date(p[0], p[1]-1, p[2]);
      }
      return null;
    };

    let totalProjects = this.app.state.projects.length;
    let projectsDone = 0;
    let projectsInProgress = 0;
    let projectsDelayed = [];
    let projectsOverview = [];

    // Métricas de Tempo
    let sumTasksDuration = 0;
    let countDoneTasks = 0;

    this.app.state.projects.forEach(p => {
      const pGroups = this.app.state.groups.filter(g => g.projectId === p.id);
      const grpIds = pGroups.map(g => g.id);
      const pTasks = this.app.state.tasks.filter(t => grpIds.includes(t.groupId));

      let hasDelayedTasks = false;
      let totalPTasks = pTasks.length;
      let donePTasks = 0;
      let maxDate = null;

      pTasks.forEach(t => {
        if (t.dueDate) {
            const parts = t.dueDate.split('-');
            const taskDate = new Date(parts[0], parts[1]-1, parts[2]);
            if (!maxDate || taskDate > maxDate) {
                maxDate = taskDate;
            }
        }

        if (t.status === 'Feito') {
            donePTasks++;
            
            // Calculo de média de dias para tarefa
            if (t.startDate && t.dueDate) {
                const sTemp = t.startDate.split('-');
                const sDate = new Date(sTemp[0], sTemp[1]-1, sTemp[2]);
                const dTemp = t.dueDate.split('-');
                const dDate = new Date(dTemp[0], dTemp[1]-1, dTemp[2]);
                
                const diffTime = Math.abs(dDate - sDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                sumTasksDuration += diffDays;
                countDoneTasks++;
            }
        } else {
            // Checar se está atrasada
            if (t.dueDate) {
                const parts = t.dueDate.split('-');
                const taskDate = new Date(parts[0], parts[1]-1, parts[2]);
                if (taskDate < today) {
                    hasDelayedTasks = true;
                }
            }
        }
      });

      const limitDate = parseDateInput(p.details?.dataLimite);
      let hasLimitExceeded = false;
      if (limitDate) {
        // Se a data de entrega máxima prevista para tarefas abertas for maior que o limite do projeto
        pTasks.forEach(t => {
          if (t.status !== 'Feito' && t.dueDate) {
            const tDate = parseDateInput(t.dueDate);
            if (tDate && tDate > limitDate) {
              hasLimitExceeded = true;
            }
          }
        });
      }

      let daysDiff = null;
      let dueDateString = "Sem previsão";
      if (maxDate) {
        dueDateString = ("0" + maxDate.getDate()).slice(-2) + "/" + ("0" + (maxDate.getMonth() + 1)).slice(-2) + "/" + maxDate.getFullYear();
        daysDiff = Math.ceil((maxDate - today) / (1000 * 60 * 60 * 24));
      }

      const progress = totalPTasks === 0 ? 0 : Math.round((donePTasks / totalPTasks) * 100);

      if (progress === 100 && totalPTasks > 0) {
        projectsDone++;
      } else if (progress > 0 || totalPTasks > 0) {
        projectsInProgress++;
      }

      const formatDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
      };

      if (hasDelayedTasks) {
        projectsDelayed.push({ project: p, progress: progress, dueDateString, daysDiff, hasLimitExceeded, dataLimite: formatDate(p.details?.dataLimite), delayedTasks: pTasks.filter(t => {
            if(t.status === 'Feito' || !t.dueDate) return false;
            const parts = t.dueDate.split('-');
            return new Date(parts[0], parts[1]-1, parts[2]) < today;
        }).length });
      }

      projectsOverview.push({ project: p, progress: progress, totalTasks: totalPTasks, doneTasks: donePTasks, hasDelayedTasks, dueDateString, daysDiff, hasLimitExceeded, dataLimite: formatDate(p.details?.dataLimite) });
    });

    const avgTaskTimeDays = countDoneTasks > 0 ? (sumTasksDuration / countDoneTasks).toFixed(1) : 0;

    const html = `
      <div class="dash-grid">
        <div class="dash-card">
            <div class="dash-card-icon" style="color: var(--primary); background: rgba(0, 115, 234, 0.1);"><i class="fas fa-project-diagram"></i></div>
            <div class="dash-card-info">
                <h3>Total de Projetos</h3>
                <span>${totalProjects}</span>
            </div>
        </div>
        <div class="dash-card">
            <div class="dash-card-icon" style="color: var(--status-fazendo); background: rgba(0, 115, 234, 0.1);"><i class="fas fa-spinner fa-spin-hover"></i></div>
            <div class="dash-card-info">
                <h3>Em Andamento</h3>
                <span>${projectsInProgress}</span>
            </div>
        </div>
        <div class="dash-card">
            <div class="dash-card-icon" style="color: #2e7d32; background: rgba(46, 125, 50, 0.1);"><i class="fas fa-check-circle"></i></div>
            <div class="dash-card-info">
                <h3>Finalizados</h3>
                <span>${projectsDone}</span>
            </div>
        </div>
        <div class="dash-card">
            <div class="dash-card-icon" style="color: var(--status-parado); background: rgba(255, 203, 0, 0.1);"><i class="fas fa-clock"></i></div>
            <div class="dash-card-info">
                <h3>Tempo Méd/Tarefa</h3>
                <span>${avgTaskTimeDays} dias</span>
            </div>
        </div>
      </div>

      <div class="dash-sections">
        <div class="dash-section">
            <div class="dash-section-header">
                <h3><i class="fas fa-exclamation-triangle" style="color: var(--urg-critical)"></i> Projetos Atrasados (${projectsDelayed.length})</h3>
            </div>
            <div class="dash-list">
                ${projectsDelayed.length === 0 ? '<div class="dash-empty">Nenhum projeto atrasado. Excelente trabalho!</div>' : 
                projectsDelayed.map(d => `
                    <div class="dash-list-item" onclick="app.dashboardHandler.openProject('${d.project.id}')" title="Clique para abrir: ${d.project.name}">
                        <div class="dash-item-left">
                            <span class="dash-item-title">${d.project.name}</span>
                            <span class="dash-item-subtitle">${d.delayedTasks} tarefa(s) em atraso</span>
                        </div>
                        <div class="dash-date-info">
                            <span class="dash-date-label">Previsão</span>
                            <span class="dash-date-val"><i class="far fa-calendar-alt"></i> ${d.dueDateString}</span>
                        </div>
                        <div class="dash-date-info">
                            <span class="dash-date-label">Data Limite</span>
                            <span class="dash-date-val"><i class="fas fa-calendar-check"></i> ${d.dataLimite}</span>
                        </div>
                        <div class="dash-badge-col">
                            <span class="status-badge error">Atrasado</span>
                            ${d.hasLimitExceeded ? '<span class="status-badge critical" title="Cronograma ultrapassou a data limite do projeto"><i class="fas fa-exclamation-circle"></i> Prazo Excedido</span>' : ''}
                        </div>
                        <div class="dash-progress-col">
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width: ${d.progress}%; background: ${d.progress===100 ? '#2e7d32' : (d.progress>0?'var(--primary)':'var(--status-default)')};"></div>
                            </div>
                            <span class="progress-label">${d.progress}%</span>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="dash-section">
            <div class="dash-section-header">
                <h3><i class="fas fa-list-alt" style="color: var(--text-muted)"></i> Resumo Geral</h3>
            </div>
            <div class="dash-list">
                ${projectsOverview.sort((a,b) => b.progress - a.progress).map(o => `
                    <div class="dash-list-item" onclick="app.dashboardHandler.openProject('${o.project.id}')" title="Clique para abrir: ${o.project.name}">
                        <div class="dash-item-left">
                            <span class="dash-item-title">${o.project.name}</span>
                            <span class="dash-item-subtitle">${o.doneTasks} / ${o.totalTasks} Tarefas Concluídas</span>
                        </div>
                        <div class="dash-date-info">
                            <span class="dash-date-label">Previsão</span>
                            <span class="dash-date-val"><i class="far fa-calendar-alt"></i> ${o.dueDateString}</span>
                        </div>
                        <div class="dash-date-info">
                            <span class="dash-date-label">Data Limite</span>
                            <span class="dash-date-val"><i class="fas fa-calendar-check"></i> ${o.dataLimite}</span>
                        </div>
                        <div class="dash-badge-col">
                            ${o.hasDelayedTasks ? '<span class="status-badge error">Atrasado</span>' : (o.progress === 100 && o.totalTasks > 0 ? '<span class="status-badge success">Feito</span>' : '<span class="status-badge info">Em Dia</span>')}
                            ${o.hasLimitExceeded ? '<span class="status-badge critical" title="Cronograma ultrapassou a data limite do projeto"><i class="fas fa-exclamation-circle"></i> Prazo Excedido</span>' : ''}
                        </div>
                        <div class="dash-progress-col">
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width: ${o.progress}%; background: ${o.progress===100 ? '#2e7d32' : (o.progress>0?'var(--primary)':'var(--status-default)')};"></div>
                            </div>
                            <span class="progress-label">${o.progress}%</span>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
                    </div>
                `).join('')}
            </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    
    if (this.initialLoadComplete) {
      container.classList.add('no-animations');
    } else {
      this.initialLoadComplete = true;
      setTimeout(() => container.classList.add('no-animations'), 500);
    }
  }
}

window.DashboardHandler = DashboardHandler;

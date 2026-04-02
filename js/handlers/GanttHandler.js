class GanttHandler {
  constructor(app) {
    this.app = app;
  }

  init() {
    document.getElementById('btn-view-board')?.addEventListener('click', () => this.switchView('board'));
    document.getElementById('btn-view-gantt')?.addEventListener('click', () => this.switchView('gantt'));
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => window.print());
  }

  switchView(view) {
    const btnBoard = document.getElementById('btn-view-board');
    const btnGantt = document.getElementById('btn-view-gantt');
    const viewBoardEl = document.getElementById('view-board');
    const viewGanttEl = document.getElementById('view-gantt');
    const btnExportPdf = document.getElementById('btn-export-pdf');

    if (view === 'board') {
      btnBoard?.classList.add('active');
      btnGantt?.classList.remove('active');
      if (viewBoardEl) viewBoardEl.style.display = 'block';
      if (viewGanttEl) viewGanttEl.style.display = 'none';
      if (btnExportPdf) btnExportPdf.style.display = 'none';
      this.app.groupHandler.renderBoard();
    } else {
      btnGantt?.classList.add('active');
      btnBoard?.classList.remove('active');
      if (viewGanttEl) viewGanttEl.style.display = 'block';
      if (viewBoardEl) viewBoardEl.style.display = 'none';
      if (btnExportPdf) btnExportPdf.style.display = 'flex';
      this.renderGantt();
    }
  }

  renderGantt() {
    const container = document.getElementById('gantt-container');
    if (!container) return;

    const projGroups = this.app.state.groups.filter(g => g.projectId === this.app.state.activeProjectId).sort((a, b) => a.order - b.order);
    
    if (projGroups.length === 0) {
      container.innerHTML = `<div class="empty-state">Nenhum grupo neste projeto.</div>`;
      return;
    }

    let allTasks = [];
    projGroups.forEach(g => {
      const groupTasks = this.app.state.tasks.filter(t => t.groupId === g.id).sort((a, b) => a.order - b.order);
      allTasks = allTasks.concat(groupTasks);
    });

    if (allTasks.length === 0) {
      container.innerHTML = `<div class="empty-state">Adicione tarefas na visão de quadro antes de visualizar o cronograma.</div>`;
      return;
    }

    let minDate = new Date(allTasks[0].startDate + "T00:00:00");
    let maxDate = new Date(allTasks[0].dueDate + "T00:00:00");
    allTasks.forEach(t => {
      const s = new Date(t.startDate + "T00:00:00");
      const d = new Date(t.dueDate + "T00:00:00");
      if (s < minDate) minDate = s;
      if (d > maxDate) maxDate = d;
    });

    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 2);

    const dateList = [];
    const curr = new Date(minDate);
    while (curr <= maxDate) {
      dateList.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const MAX_COLS = 50;
    const chunks = [];
    for (let i = 0; i < dateList.length; i += MAX_COLS) {
      chunks.push(dateList.slice(i, i + MAX_COLS));
    }

    container.innerHTML = chunks.map((chunkDates, idx) => this.buildGanttPage(chunkDates, projGroups, allTasks, idx + 1, chunks.length)).join('');
  }

  buildGanttPage(dates, groups, tasks, pageNum, totalPages) {
    const proj = this.app.projectHandler.activeProject;
    const pName = proj?.name || '';
    const det = proj?.details || {};

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const dayAbbr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const todayStr = new Date().toISOString().split('T')[0];

    let monthColspans = [];
    let currentMonth = dates[0].getMonth();
    let currentYear = dates[0].getFullYear();
    let currentCount = 0;

    dates.forEach(d => {
      if (d.getMonth() === currentMonth) currentCount++;
      else {
        monthColspans.push({ month: currentMonth, year: currentYear, count: currentCount });
        currentMonth = d.getMonth();
        currentYear = d.getFullYear();
        currentCount = 1;
      }
    });
    monthColspans.push({ month: currentMonth, year: currentYear, count: currentCount });

    let headerHtml = `<tr><th class="gantt-desc-col"></th>`;
    monthColspans.forEach(m => {
      headerHtml += `<th colspan="${m.count}" class="gantt-month-col">${monthNames[m.month]} ${m.year}</th>`;
    });
    headerHtml += `</tr><tr><th class="gantt-desc-col">Tarefa / Descrição</th>`;

    dates.forEach(d => {
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dateStr = d.toISOString().split('T')[0];
      const isToday = dateStr === todayStr;
      headerHtml += `<th class="gantt-day-col ${isWeekend ? 'weekend' : ''} ${isToday ? 'gantt-today-col' : ''}">
        <span class="${isToday ? 'today-header' : ''}">
          <span style="font-weight:700;">${dayAbbr[d.getDay()]}</span>
          <span style="font-weight:800;">${d.getDate()}</span>
        </span>
      </th>`;
    });
    headerHtml += `</tr>`;

    let bodyHtml = '';
    groups.forEach(g => {
      const groupTasks = tasks.filter(t => t.groupId === g.id).sort((a, b) => a.order - b.order);
      groupTasks.forEach(t => {
        const tStart = new Date(t.startDate + "T00:00:00");
        const tEnd = new Date(t.dueDate + "T00:00:00");
        const taskDuration = Math.round((tEnd - tStart) / (1000 * 60 * 60 * 24)) + 1;

        bodyHtml += `<tr><td class="gantt-desc-col" style="border-left: 6px solid ${g.color};">${t.title}</td>`;

        dates.forEach(d => {
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dateStr = d.toISOString().split('T')[0];
          const isTodayCell = dateStr === todayStr;
          const dTime = d.getTime();
          const sTime = tStart.getTime();
          const eTime = tEnd.getTime();

          let cellContent = '';
          if (dTime >= sTime && dTime <= eTime) {
            const isStart = dTime === sTime;
            const isEnd = dTime === eTime;
            const opacity = t.status === 'Feito' ? '0.7' : '1';
            
            cellContent = `<div class="gantt-bar ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${!isStart && !isEnd ? 'mid' : ''}" style="background:${g.color};opacity:${opacity};">
              ${isStart ? `<span class="gantt-bar-label">${taskDuration}d</span>` : ''}
              ${t.status === 'Feito' && isEnd ? '<i class="fas fa-check-circle"></i>' : ''}
            </div>`;
          }

          bodyHtml += `<td class="gantt-cell ${isWeekend ? 'weekend' : ''} ${isTodayCell ? 'gantt-today-col' : ''}">${cellContent}</td>`;
        });
        bodyHtml += `</tr>`;
      });
    });

    const describedTasks = tasks.filter(t => t.title?.trim() && t.title !== 'Tarefa' && t.title !== 'Nova tarefa');
    const totalTasks = describedTasks.length;
    const doneTasks = describedTasks.filter(t => t.status === 'Feito').length;
    const pctDone = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const progressColor = pctDone === 100 ? 'var(--status-feito)' : pctDone >= 50 ? 'var(--status-fazendo)' : 'var(--primary)';

    return `
      <div class="gantt-page">
        <div class="gantt-page-header">
          <table class="print-legend">
            <tr>
              <td class="l-label">CLIENTE</td>
              <td class="l-value">${det.cliente || ''}</td>
              <td class="l-label">Nº VENDA</td>
              <td class="l-value">${det.venda || ''}</td>
              <td rowspan="4" class="gantt-logo-cell">
                <div class="logo-container">
                  <img src="Logo/Logo CCLM.png">
                  <span>Colaboração Técnica:</span>
                  <img src="Logo/logo quimiwater.png">
                </div>
              </td>
            </tr>
            <tr><td class="l-label">LOCAL / ÁREA</td><td class="l-value" colspan="3">${det.local || ''}</td></tr>
            <tr><td class="l-label">EQUIPAMENTO</td><td class="l-value" colspan="3">${det.equipamento || ''}</td></tr>
            <tr><td colspan="4" class="l-title">${det.tituloCronograma ? det.tituloCronograma.toUpperCase() : 'CRONOGRAMA GERAL - ' + pName.toUpperCase()}</td></tr>
          </table>
        </div>
        <div class="gantt-progress-summary">
          <span class="progress-text"><i class="fas fa-tasks"></i>${doneTasks} de ${totalTasks} tarefas concluídas</span>
          <div class="progress-track"><div class="progress-fill" style="width:${pctDone}%;background:${progressColor};"></div></div>
          <span class="progress-pct" style="color:${progressColor};">${pctDone}%</span>
        </div>
        <table class="gantt-table"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>
        <div class="gantt-page-footer">
          <table class="print-legend footer-legend">
            <tr>
              <td class="l-label">ELABORADO</td><td class="l-value">${det.elaborado || ''}</td>
              <td class="l-label">APROVADO</td><td class="l-value">${det.aprovado || ''}</td>
              <td class="l-label">DATA ELAB.</td><td class="l-value">${det.dataElab || ''}</td>
              <td class="l-label">REVISÃO</td><td class="l-value">${det.revisao || ''}</td>
              <td class="l-label">FOLHA</td><td class="l-value">${pageNum} / ${totalPages}</td>
            </tr>
          </table>
        </div>
      </div>`;
  }

  updateProjectStatusIndicator() {
    const indicator = document.getElementById('project-status-indicator');
    if (!indicator) return;

    const projGroups = this.app.state.groups.filter(g => g.projectId === this.app.state.activeProjectId);
    const projTasks = this.app.state.tasks.filter(t => projGroups.some(g => g.id === t.groupId));
    const describedTasks = projTasks.filter(t => t.title?.trim() && t.title !== 'Tarefa');

    let pctRaw = 0;
    let doneCount = 0;
    if (describedTasks.length > 0) {
      doneCount = describedTasks.filter(t => t.status === 'Feito').length;
      pctRaw = Math.round((doneCount / describedTasks.length) * 100);
    }

    const progressColor = pctRaw === 100 ? 'var(--status-feito)' : pctRaw >= 50 ? 'var(--status-fazendo)' : 'var(--primary)';
    const progressBarHtml = `
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width:${pctRaw}%;background:${progressColor};"></div>
      </div>
      <span class="progress-label">${doneCount}/${describedTasks.length} (${pctRaw}%)</span>`;

    const totalEstimatedDays = projTasks.reduce((sum, t) => sum + (parseInt(t.estimatedDays) || 1), 0);
    const estimatedPill = `<span class="project-status-pill pill-estimated"><i class="fas fa-stopwatch"></i> ${totalEstimatedDays} DIAS ESTIMADOS DE PROJETO</span>`;

    if (projTasks.length === 0) {
      indicator.innerHTML = `
        <div class="status-pills-stack">
          <span class="project-status-pill pill-remaining"><i class="fas fa-info-circle"></i> Sem tarefas</span>
        </div>`;
      return;
    }

    const allDone = describedTasks.length > 0 && describedTasks.every(t => t.status === 'Feito');
    let pStatus = '';
    
    if (allDone) {
      pStatus = `<span class="project-status-pill pill-done"><i class="fas fa-check-circle"></i> Projeto Finalizado</span>`;
    } else {
      let maxDue = null;
      projTasks.forEach(t => {
        if (t.status !== 'Feito' && t.dueDate) {
          const d = new Date(t.dueDate + 'T00:00:00');
          if (!maxDue || d > maxDue) maxDue = d;
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = maxDue ? Math.round((maxDue - today) / (1000 * 60 * 60 * 24)) : null;

      if (diff !== null) {
        if (diff < 0) pStatus = `<span class="project-status-pill pill-overdue"><i class="fas fa-exclamation-circle"></i> ${Math.abs(diff)} dia${Math.abs(diff) !== 1 ? 's' : ''} em atraso</span>`;
        else if (diff === 0) pStatus = `<span class="project-status-pill pill-overdue"><i class="fas fa-clock"></i> Vence hoje</span>`;
        else pStatus = `<span class="project-status-pill pill-remaining"><i class="fas fa-calendar-alt"></i> ${diff} dia${diff !== 1 ? 's' : ''} para conclusão</span>`;
      }
    }

    indicator.innerHTML = `
      <div class="status-pills-stack">
        ${pStatus}
        ${estimatedPill}
      </div>
      <div class="progress-container">${progressBarHtml}</div>`;
  }
}

window.GanttHandler = GanttHandler;

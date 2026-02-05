document.addEventListener('DOMContentLoaded', () => {
  const db = firebase.firestore();
  const mode = document.body.dataset.mode || 'month';

  // Tema: reutiliza preferência gravada
  const storedTheme = localStorage.getItem('admin-theme');
  if (storedTheme === 'dark') {
    document.body.classList.add('admin-dark');
  }

  const summaryEl = document.getElementById('period-summary');
  const chartCanvas = document.getElementById('period-bar');
  const historyTableBody = document.querySelector('#history-table tbody');
  const exportCsvButton = document.getElementById('export-csv');
  const exportTxtButton = document.getElementById('export-txt');
  const monthPicker = document.getElementById('month-picker');
  const monthApply = document.getElementById('month-apply');
  const weekStart = document.getElementById('week-start');
  const weekEnd = document.getElementById('week-end');
  const weekApply = document.getElementById('week-apply');

  loadData();

  async function loadData() {
    try {
      const snapshot = await db.collection('satisfaction_logs').get();
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logs.sort((a, b) => {
        const dateA = new Date(a.data.split('/').reverse().join('-') + 'T' + a.hora);
        const dateB = new Date(b.data.split('/').reverse().join('-') + 'T' + b.hora);
        return dateB - dateA;
      });

      if (mode === 'history') {
        renderHistory(logs, 500);
      } else if (mode === 'export') {
        wireExportButtons(logs);
      } else {
        const filtered = filterByMode(logs, mode);
        renderSummaryAndChart(filtered, modeLabel(mode));
        renderHistory(filtered, 200);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      alert('Não foi possível carregar os dados.');
    }
  }

  function filterByMode(logs, m) {
    const now = new Date();

    // Dia: sempre o dia corrente
    if (m === 'day') {
      const today = now.toLocaleDateString('pt-PT');
      return logs.filter(l => l.data === today);
    }

    // Semana: permitir escolher intervalo
    if (m === 'week') {
      let start, end;
      if (weekStart?.value && weekEnd?.value) {
        start = new Date(weekStart.value);
        end = new Date(weekEnd.value);
      } else {
        end = new Date(now.toDateString());
        start = new Date(end);
        start.setDate(end.getDate() - 6);
      }
      if (start > end) [start, end] = [end, start];
      return logs.filter(l => {
        const [d, mo, y] = l.data.split('/').map(Number);
        const dt = new Date(`${y}-${mo}-${d}`);
        return dt >= start && dt <= end;
      });
    }

    // Mês: permitir escolher mês/ano (input type month)
    let month = now.getMonth();
    let year = now.getFullYear();
    if (monthPicker?.value) {
      const [y, m] = monthPicker.value.split('-').map(Number);
      year = y;
      month = m - 1;
    }
    return logs.filter(l => {
      const [d, mo, y] = l.data.split('/').map(Number);
      return (mo - 1) === month && y === year;
    });
  }

  function renderSummaryAndChart(logs, label) {
    if (summaryEl) {
      const { counts, total } = getCounts(logs);
      const pct = k => total > 0 ? ((counts[k] / total) * 100).toFixed(1) : '0.0';
      summaryEl.innerHTML = `
        <div class="d-flex flex-wrap gap-3">
          <div><strong>Total:</strong> ${total}</div>
          <div>😀 ${counts.muito_satisfeito} (${pct('muito_satisfeito')}%)</div>
          <div>🙂 ${counts.satisfeito} (${pct('satisfeito')}%)</div>
          <div>😡 ${counts.insatisfeito} (${pct('insatisfeito')}%)</div>
        </div>
      `;
    }

    if (chartCanvas) {
      const { counts } = getCounts(logs);
      const ctx = chartCanvas.getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['😀 Muito Satisfeito', '🙂 Satisfeito', '😡 Insatisfeito'],
          datasets: [{
            label,
            data: [counts.muito_satisfeito, counts.satisfeito, counts.insatisfeito],
            backgroundColor: [
              'rgba(40, 167, 69, 0.5)',
              'rgba(255, 193, 7, 0.5)',
              'rgba(220, 53, 69, 0.5)'
            ],
            borderColor: [
              'rgba(40, 167, 69, 1)',
              'rgba(255, 193, 7, 1)',
              'rgba(220, 53, 69, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  // --- Listeners para seleção de mês e semana ---
  if (monthPicker && monthApply) {
    // Preencher com mês atual por defeito
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthPicker.value = defaultMonth;
    monthApply.onclick = () => loadData();
  }

  if (weekStart && weekEnd && weekApply) {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
    const startStr = startDate.toISOString().split('T')[0];
    weekStart.value = startStr;
    weekEnd.value = endStr;
    weekApply.onclick = () => loadData();
  }

  function renderHistory(logs, limit = 500) {
    if (!historyTableBody) return;
    const rows = logs.slice(0, limit);
    historyTableBody.innerHTML = '';
    rows.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${log.id || 'N/A'}</td>
        <td>${log.satisfacao ? log.satisfacao.replace('_', ' ') : 'N/A'}</td>
        <td>${log.data || 'N/A'}</td>
        <td>${log.hora || 'N/A'}</td>
        <td>${log.diaSemana || 'N/A'}</td>
      `;
      historyTableBody.appendChild(tr);
    });
  }

  function wireExportButtons(logs) {
    if (exportCsvButton) {
      exportCsvButton.onclick = () => exportToCsv(logs);
    }
    if (exportTxtButton) {
      exportTxtButton.onclick = () => exportToTxt(logs);
    }
  }

  function getCounts(logs) {
    const counts = { muito_satisfeito: 0, satisfeito: 0, insatisfeito: 0 };
    logs.forEach(l => { if (l.satisfacao && counts[l.satisfacao] !== undefined) counts[l.satisfacao]++; });
    return { counts, total: logs.length };
  }

  function modeLabel(m) {
    if (m === 'day') return 'Hoje';
    if (m === 'week') return 'Últimos 7 dias';
    return 'Mês atual';
  }

  function exportToCsv(logs) {
    const headers = 'ID;Satisfacao;Data;Hora;Dia da Semana';
    const rows = logs.map(log => `${log.id || ''};${log.satisfacao || ''};${log.data || ''};${log.hora || ''};${log.diaSemana || ''}`);
    const csvBody = `${headers}\n${rows.join('\n')}`;
    const csvContent = `data:text/csv;charset=utf-8,sep=;\n${csvBody}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'satisfacao_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportToTxt(logs) {
  const rows = logs.map(log => `ID: ${log.id || ''}; Satisfacao: ${log.satisfacao || ''}; Data: ${log.data || ''}; Hora: ${log.hora || ''}; Dia: ${log.diaSemana || ''}`);
    const txtContent = `data:text/plain;charset=utf-8,${rows.join('\n')}`;
    const encodedUri = encodeURI(txtContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'satisfacao_export.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    // Tema e status
    const themeToggle = document.getElementById('theme-toggle');
    const statusIndicator = document.getElementById('status-indicator');

    const dateFilterInput = document.getElementById('date-filter');
    const filterButton = document.getElementById('filter-button');
    const exportCsvButton = document.getElementById('export-csv');
    const exportTxtButton = document.getElementById('export-txt');
    const compareDate1Input = document.getElementById('compare-date-1');
    const compareDate2Input = document.getElementById('compare-date-2');
    const compareButton = document.getElementById('compare-button');
    const compareResultDiv = document.getElementById('compare-result');

    let barChart = null;
    let pieChart = null;
    let evolutionChart = null;
    let monthlyChart = null;
    let weeklyChart = null;
    let dailyChart = null;
    let allLogs = []; // Cache para todos os registos

    // Carrega o dashboard assim que a página é aberta
    loadDashboardData();

    // --- Tema escuro/claro ---
    const storedTheme = localStorage.getItem('admin-theme');
    if (storedTheme === 'dark') {
        document.body.classList.add('admin-dark');
        if (themeToggle) themeToggle.textContent = 'Modo claro';
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('admin-dark');
            localStorage.setItem('admin-theme', isDark ? 'dark' : 'light');
            themeToggle.textContent = isDark ? 'Modo claro' : 'Modo escuro';
        });
    }

    // --- Indicador online/offline ---
    function updateStatus() {
        if (!statusIndicator) return;
        const online = navigator.onLine;
        statusIndicator.textContent = online ? 'Estado: online' : 'Estado: offline';
        statusIndicator.className = online ? 'badge bg-success-subtle text-success' : 'badge bg-danger-subtle text-danger';
    }
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();

    // --- Lógica do Dashboard ---

    async function loadDashboardData() {
        try {
            const snapshot = await db.collection('satisfaction_logs').get();
            allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Ordena os logs por data e hora (mais recentes primeiro)
            allLogs.sort((a, b) => {
                const dateA = new Date(a.data.split('/').reverse().join('-') + 'T' + a.hora);
                const dateB = new Date(b.data.split('/').reverse().join('-') + 'T' + b.hora);
                return dateB - dateA;
            });
            displayData(allLogs);
            renderPeriods(allLogs);
        } catch (error) {
            console.error("Erro ao carregar dados do dashboard: ", error);
            alert("Não foi possível carregar os dados. Verifique a consola para mais detalhes.");
        }
    }

    function displayData(logs) {
        updateTotalsAndPercentages(logs);
        updateCharts(logs);
        renderEvolutionChart(logs);
        updateHistoryTable(logs);
    }

    function renderPeriods(logs) {
        // Mês atual
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const monthlyLogs = logs.filter(l => {
            const [d, m, y] = l.data.split('/').map(Number);
            return (m - 1) === month && y === year;
        });
        updatePeriodSection(monthlyLogs, 'monthly', 'Mês atual');

        // Últimos 7 dias (rolling)
        const today = new Date(now.toDateString());
        const sevenAgo = new Date(today);
        sevenAgo.setDate(today.getDate() - 6);
        const weeklyLogs = logs.filter(l => {
            const [d, m, y] = l.data.split('/').map(Number);
            const dt = new Date(`${y}-${m}-${d}`);
            return dt >= sevenAgo && dt <= today;
        });
        updatePeriodSection(weeklyLogs, 'weekly', 'Últimos 7 dias');

        // Hoje
        const todayStr = now.toLocaleDateString('pt-PT');
        const dailyLogs = logs.filter(l => l.data === todayStr);
        updatePeriodSection(dailyLogs, 'daily', 'Hoje');
    }

    function updatePeriodSection(logs, key, label) {
        const summaryEl = document.getElementById(`${key}-summary`);
        const chartId = `${key}-bar`;
        const chartRefMap = { monthly: 'monthlyChart', weekly: 'weeklyChart', daily: 'dailyChart' };

        const { counts, total } = getCounts(logs);
        const pct = t => total > 0 ? ((counts[t] / total) * 100).toFixed(1) : '0.0';

        summaryEl.innerHTML = `
            <div class="d-flex flex-wrap gap-3">
                <div><strong>Total:</strong> ${total}</div>
                <div>😀 ${counts.muito_satisfeito} (${pct('muito_satisfeito')}%)</div>
                <div>🙂 ${counts.satisfeito} (${pct('satisfeito')}%)</div>
                <div>😡 ${counts.insatisfeito} (${pct('insatisfeito')}%)</div>
            </div>
        `;

        const chartData = {
            labels: ['😀 Muito Satisfeito', '🙂 Satisfeito', '😡 Insatisfeito'],
            datasets: [{
                label: label,
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
        };

        const ctx = document.getElementById(chartId)?.getContext('2d');
        if (!ctx) return;
        // Destroy existing chart
        if (key === 'monthly' && monthlyChart) monthlyChart.destroy();
        if (key === 'weekly' && weeklyChart) weeklyChart.destroy();
        if (key === 'daily' && dailyChart) dailyChart.destroy();

        const chart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });

        if (key === 'monthly') monthlyChart = chart;
        if (key === 'weekly') weeklyChart = chart;
        if (key === 'daily') dailyChart = chart;
    }

    function getCounts(logs) {
        const counts = { muito_satisfeito: 0, satisfeito: 0, insatisfeito: 0 };
        logs.forEach(l => { if (l.satisfacao && counts[l.satisfacao] !== undefined) counts[l.satisfacao]++; });
        return { counts, total: logs.length };
    }

    function updateTotalsAndPercentages(logs) {
        const totalsDiv = document.getElementById('totals');
        const percentagesDiv = document.getElementById('percentages');
        
        const totalCount = logs.length;
        const satisfactionCounts = {
            muito_satisfeito: 0,
            satisfeito: 0,
            insatisfeito: 0
        };

        logs.forEach(log => {
            if(log.satisfacao) {
                satisfactionCounts[log.satisfacao]++;
            }
        });

        totalsDiv.innerHTML = `
            <h3>Totais</h3>
            <p>😀 Muito Satisfeito: ${satisfactionCounts.muito_satisfeito}</p>
            <p>🙂 Satisfeito: ${satisfactionCounts.satisfeito}</p>
            <p>😡 Insatisfeito: ${satisfactionCounts.insatisfeito}</p>
            <p><strong>Total de Respostas: ${totalCount}</strong></p>
        `;

        percentagesDiv.innerHTML = `
            <h3>Percentagens</h3>
            <p>Muito Satisfeito: ${totalCount > 0 ? ((satisfactionCounts.muito_satisfeito / totalCount) * 100).toFixed(2) : 0}%</p>
            <p>Satisfeito: ${totalCount > 0 ? ((satisfactionCounts.satisfeito / totalCount) * 100).toFixed(2) : 0}%</p>
            <p>Insatisfeito: ${totalCount > 0 ? ((satisfactionCounts.insatisfeito / totalCount) * 100).toFixed(2) : 0}%</p>
        `;
    }

    function updateCharts(logs) {
        const satisfactionCounts = {
            muito_satisfeito: 0,
            satisfeito: 0,
            insatisfeito: 0
        };

        logs.forEach(log => {
             if(log.satisfacao) {
                satisfactionCounts[log.satisfacao]++;
            }
        });

        const chartData = {
            labels: ['😀 Muito Satisfeito', '🙂 Satisfeito', '😡 Insatisfeito'],
            datasets: [{
                label: 'Número de Respostas',
                data: [
                    satisfactionCounts.muito_satisfeito,
                    satisfactionCounts.satisfeito,
                    satisfactionCounts.insatisfeito
                ],
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
        };

        // Gráfico de Barras
        const barCtx = document.getElementById('bar-chart').getContext('2d');
        if (barChart) barChart.destroy();
        barChart = new Chart(barCtx, {
            type: 'bar',
            data: chartData,
            options: {
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                },
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Distribuição das Respostas' }
                }
            }
        });

        // Gráfico Circular
        const pieCtx = document.getElementById('pie-chart').getContext('2d');
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCtx, {
            type: 'pie',
            data: chartData,
             options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Percentagem de Satisfação' }
                }
            }
        });
    }

    // --- Histórico com paginação simples ---
    const PAGE_SIZE = 50;
    let currentPage = 0;

    function renderHistoryPage(logs) {
        const tableBody = document.querySelector('#history-table tbody');
        const pageIndicator = document.getElementById('history-page');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const start = currentPage * PAGE_SIZE;
        const slice = logs.slice(start, start + PAGE_SIZE);
        slice.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${log.id || 'N/A'}</td>
                <td>${log.satisfacao ? log.satisfacao.replace('_', ' ') : 'N/A'}</td>
                <td>${log.data || 'N/A'}</td>
                <td>${log.hora || 'N/A'}</td>
                <td>${log.diaSemana || 'N/A'}</td>
            `;
            tableBody.appendChild(row);
        });
        if (pageIndicator) {
            const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
            pageIndicator.textContent = `${currentPage + 1} / ${totalPages}`;
        }
    }

    function attachHistoryPagination(logs) {
        const prevBtn = document.getElementById('history-prev');
        const nextBtn = document.getElementById('history-next');
        const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
        if (prevBtn) prevBtn.onclick = () => {
            currentPage = Math.max(0, currentPage - 1);
            renderHistoryPage(logs);
        };
        if (nextBtn) nextBtn.onclick = () => {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
            renderHistoryPage(logs);
        };
        // reset para a primeira página ao aplicar filtros
        currentPage = 0;
        renderHistoryPage(logs);
    }

    function updateHistoryTable(logs) {
        attachHistoryPagination(logs);
    }

    // --- Filtros e Exportação ---

    filterButton.addEventListener('click', () => {
        const filterDate = dateFilterInput.value;
        if (filterDate) {
            // Converte a data do input (YYYY-MM-DD) para o formato da BD (DD/MM/YYYY)
            const formattedDate = filterDate.split('-').reverse().join('/');
            const filteredLogs = allLogs.filter(log => log.data === formattedDate);
            displayData(filteredLogs);
        } else {
            displayData(allLogs); // Se o filtro estiver vazio, mostra todos os dados
        }
    });

    // Filtros rápidos
    const quickFilters = document.querySelectorAll('[data-quick-filter]');
    quickFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.quickFilter;
            const now = new Date();
            let filtered = allLogs;
            if (type === 'today') {
                const todayStr = now.toLocaleDateString('pt-PT');
                filtered = allLogs.filter(l => l.data === todayStr);
            } else if (type === 'yesterday') {
                const y = new Date(now);
                y.setDate(y.getDate() - 1);
                const yStr = y.toLocaleDateString('pt-PT');
                filtered = allLogs.filter(l => l.data === yStr);
            } else if (type === 'last7') {
                const start = new Date(now.toDateString());
                start.setDate(start.getDate() - 6);
                filtered = allLogs.filter(l => {
                    const [d, m, y] = l.data.split('/').map(Number);
                    const dt = new Date(`${y}-${m}-${d}`);
                    return dt >= start && dt <= now;
                });
            }
            displayData(filtered);
        });
    });

    compareButton.addEventListener('click', () => {
        const d1 = compareDate1Input.value;
        const d2 = compareDate2Input.value;

        if (!d1 || !d2) {
            compareResultDiv.innerHTML = '<span class="text-danger">Escolha os dois dias para comparar.</span>';
            return;
        }

        const f1 = d1.split('-').reverse().join('/');
        const f2 = d2.split('-').reverse().join('/');

        const day1Logs = allLogs.filter(log => log.data === f1);
        const day2Logs = allLogs.filter(log => log.data === f2);

        const stats1 = buildStats(day1Logs);
        const stats2 = buildStats(day2Logs);

        compareResultDiv.innerHTML = renderCompare(stats1, stats2, f1, f2);
    });

    function buildStats(logs) {
        const total = logs.length;
        const counts = { muito_satisfeito: 0, satisfeito: 0, insatisfeito: 0 };
        logs.forEach(l => { if (l.satisfacao) counts[l.satisfacao]++; });
        const pct = key => total > 0 ? ((counts[key] / total) * 100).toFixed(1) : '0.0';
        return { total, counts, pct };
    }

    function renderCompare(a, b, labelA, labelB) {
        return `
            <div class="row g-3">
                <div class="col-12 col-lg-6">
                    <div class="p-3 rounded border bg-light">
                        <div class="fw-semibold">${labelA}</div>
                        <div class="text-muted small mb-2">Total: ${a.total}</div>
                        <div>😀 ${a.counts.muito_satisfeito} (${a.pct('muito_satisfeito')}%)</div>
                        <div>🙂 ${a.counts.satisfeito} (${a.pct('satisfeito')}%)</div>
                        <div>😡 ${a.counts.insatisfeito} (${a.pct('insatisfeito')}%)</div>
                    </div>
                </div>
                <div class="col-12 col-lg-6">
                    <div class="p-3 rounded border bg-light">
                        <div class="fw-semibold">${labelB}</div>
                        <div class="text-muted small mb-2">Total: ${b.total}</div>
                        <div>😀 ${b.counts.muito_satisfeito} (${b.pct('muito_satisfeito')}%)</div>
                        <div>🙂 ${b.counts.satisfeito} (${b.pct('satisfeito')}%)</div>
                        <div>😡 ${b.counts.insatisfeito} (${b.pct('insatisfeito')}%)</div>
                    </div>
                </div>
            </div>
        `;
    }

    function exportToCsv(logs) {
        const headers = 'ID;Satisfacao;Data;Hora;Dia da Semana';
        const rows = logs.map(log =>
            `${log.id || ''};${log.satisfacao || ''};${log.data || ''};${log.hora || ''};${log.diaSemana || ''}`
        );
        const csvBody = `${headers}\n${rows.join('\n')}`;
        // Indicador de separador para Excel na primeira linha
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
        const rows = logs.map(log => 
            `ID: ${log.id || ''}; Satisfacao: ${log.satisfacao || ''}; Data: ${log.data || ''}; Hora: ${log.hora || ''}; Dia: ${log.diaSemana || ''}`
        );
        const txtContent = rows.join('\n');
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = 'satisfacao_export.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function copyToClipboard(logs) {
        const rows = logs.map(log => 
            `ID: ${log.id || ''}; Satisfacao: ${log.satisfacao || ''}; Data: ${log.data || ''}; Hora: ${log.hora || ''}; Dia: ${log.diaSemana || ''}`
        );
        const text = rows.join('\n');
        navigator.clipboard.writeText(text)
            .then(() => alert('Copiado para o clipboard.'))
            .catch(() => alert('Não foi possível copiar.')); 
    }

    exportCsvButton.addEventListener('click', () => {
        const filterDate = dateFilterInput.value;
        const logsToExport = filterDate 
            ? allLogs.filter(log => log.data === filterDate.split('-').reverse().join('/'))
            : allLogs;
        exportToCsv(logsToExport);
    });

    exportTxtButton.addEventListener('click', () => {
        const filterDate = dateFilterInput.value;
        const logsToExport = filterDate
            ? allLogs.filter(log => log.data === filterDate.split('-').reverse().join('/'))
            : allLogs;
        exportToTxt(logsToExport);
    });

    const copyButton = document.getElementById('copy-clipboard');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const filterDate = dateFilterInput.value;
            const logsToCopy = filterDate
                ? allLogs.filter(log => log.data === filterDate.split('-').reverse().join('/'))
                : allLogs;
            copyToClipboard(logsToCopy);
        });
    }

    function renderEvolutionChart(logs) {
        const ctx = document.getElementById('evolution-chart')?.getContext('2d');
        if (!ctx) return;

        // Inicializar arrays para os 12 meses
        const dataVerySatisfied = new Array(12).fill(0);
        const dataSatisfied = new Array(12).fill(0);
        const dataNotSatisfied = new Array(12).fill(0);

        // Processar logs
        logs.forEach(log => {
            if (!log.data) return;
            // Assumindo formato DD/MM/YYYY
            const parts = log.data.split('/');
            if (parts.length !== 3) return;
            
            const monthIndex = parseInt(parts[1], 10) - 1; // 0-11
            
            // Opcional: Filtrar apenas ano atual ou mostrar tudo acumulado por mês
            // Se tivermos dados de múltiplos anos, isso agrupará todos os "Janeiros" juntos.
            // Para "evolução", geralmente queremos ver o ano corrente.
            // Vou assumir que queremos ver todos os dados acumulados por mês para simplificar,
            // ou podemos filtrar pelo ano atual se necessário. 
            // Como o pedido é "evolução mensal", agrupamento por mês é o padrão.

            if (monthIndex >= 0 && monthIndex < 12) {
                if (log.satisfacao === 'muito_satisfeito') dataVerySatisfied[monthIndex]++;
                else if (log.satisfacao === 'satisfeito') dataSatisfied[monthIndex]++;
                else if (log.satisfacao === 'insatisfeito') dataNotSatisfied[monthIndex]++;
            }
        });

        if (evolutionChart) evolutionChart.destroy();

        evolutionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                datasets: [
                    {
                        label: '😀 Muito Satisfeito',
                        data: dataVerySatisfied,
                        backgroundColor: 'rgba(40, 167, 69, 0.6)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '🙂 Satisfeito',
                        data: dataSatisfied,
                        backgroundColor: 'rgba(255, 193, 7, 0.6)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '😡 Insatisfeito',
                        data: dataNotSatisfied,
                        backgroundColor: 'rgba(220, 53, 69, 0.6)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Evolução de Satisfação por Mês' }
                }
            }
        });
    }

    // --- Reset Database Lógica ---
    const resetDbBtn = document.getElementById('reset-db-btn');
    if (resetDbBtn) {
        resetDbBtn.addEventListener('click', async () => {
            const confirmed = confirm("⚠️ PERIGO: Tem a certeza que deseja APAGAR TODOS os registos?\n\nIsto limpará todo o histórico e reiniciará o contador de IDs para 1.\nEsta ação é irreversível.");
            
            if (confirmed) {
                const doubleCheck = confirm("Confirme novamente: Apagar TUDO?");
                if (doubleCheck) {
                    try {
                        const batch = db.batch();
                        
                        // 1. Apagar todos os registos de satisfação
                        const snapshot = await db.collection('satisfaction_logs').get();
                        snapshot.forEach(doc => {
                            batch.delete(doc.ref);
                        });

                        // 2. Reiniciar o contador de IDs
                        const counterRef = db.collection('metadata').doc('counters');
                        batch.set(counterRef, { current_satisfaction_id: 0 });

                        // Commit
                        await batch.commit();
                        
                        alert("Base de dados limpa com sucesso! O sistema foi reiniciado.");
                        location.reload();
                    } catch (error) {
                        console.error("Erro ao limpar base de dados:", error);
                        alert("Ocorreu um erro ao tentar limpar os dados. Verifique a consola.");
                    }
                }
            }
        });
    }
});
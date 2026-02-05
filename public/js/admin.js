document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const loginContainer = document.getElementById('login-container');
    const adminContainer = document.getElementById('admin-container');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const dateFilterInput = document.getElementById('date-filter');
    const filterButton = document.getElementById('filter-button');
    const exportCsvButton = document.getElementById('export-csv');
    const exportTxtButton = document.getElementById('export-txt');

    let barChart = null;
    let pieChart = null;
    let allLogs = []; // Cache para todos os registos

    // Lógica de Autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            loginContainer.classList.add('hidden');
            adminContainer.classList.remove('hidden');
            loadDashboardData(); // Carrega todos os dados ao entrar
        } else {
            loginContainer.classList.remove('hidden');
            adminContainer.classList.add('hidden');
        }
    });

    loginButton.addEventListener('click', () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                alert('Erro no login: ' + error.message);
            });
    });

    logoutButton.addEventListener('click', () => {
        auth.signOut();
    });

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
        } catch (error) {
            console.error("Erro ao carregar dados do dashboard: ", error);
            alert("Não foi possível carregar os dados. Verifique a consola para mais detalhes.");
        }
    }

    function displayData(logs) {
        updateTotalsAndPercentages(logs);
        updateCharts(logs);
        updateHistoryTable(logs);
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

    function updateHistoryTable(logs) {
        const tableBody = document.querySelector('#history-table tbody');
        tableBody.innerHTML = ''; // Limpa a tabela

        // Limita a 100 registos para não sobrecarregar
        const logsToShow = logs.slice(0, 100); 

        logsToShow.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${log.satisfacao ? log.satisfacao.replace('_', ' ') : 'N/A'}</td>
                <td>${log.data || 'N/A'}</td>
                <td>${log.hora || 'N/A'}</td>
                <td>${log.diaSemana || 'N/A'}</td>
            `;
            tableBody.appendChild(row);
        });
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

    function exportToCsv(logs) {
        const headers = 'Satisfacao,Data,Hora,Dia da Semana';
        const rows = logs.map(log => 
            `${log.satisfacao || ''},${log.data || ''},${log.hora || ''},${log.diaSemana || ''}`
        );
        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join('\n')}`;
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
            `Satisfacao: ${log.satisfacao || ''}, Data: ${log.data || ''}, Hora: ${log.hora || ''}, Dia: ${log.diaSemana || ''}`
        );
        const txtContent = `data:text/plain;charset=utf-8,${rows.join('\n')}`;
        const encodedUri = encodeURI(txtContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'satisfacao_export.txt');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
});

document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggling
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    // Check local storage for theme
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if(currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
    
    themeBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if(isLight) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
        updateChartColors();
    });

    // Chart logic
    let captacaoChartInstance = null;
    let lineChartInstance = null;
    let currentUnitId = 'imovel-1';

    const unitData = {
        'imovel-1': {
            name: 'Margarida - Garden',
            prosoluto: [3500, 3450, 3400, 3350, 3300, 3250, 3200, 3150, 3100, 3050, 3000, 2950, 2900, 2850],
            parcela: [1800, 1850, 1900, 1950, 2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400, 2450]
        },
        'imovel-2': {
            name: 'Margarida - Garden Fit',
            prosoluto: [4200, 4100, 4000, 3900, 3800, 3700, 3600, 3500, 3400, 3300, 3200, 3100, 3000, 2900],
            parcela: [2500, 2550, 2600, 2650, 2700, 2750, 2800, 2850, 2900, 2950, 3000, 3050, 3100, 3150]
        },
        'imovel-3': {
            name: 'Margarida - Super Garden',
            prosoluto: [2800, 2750, 2700, 2650, 2600, 2550, 2500, 2450, 2400, 2350, 2300, 2250, 2200, 2150],
            parcela: [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850]
        },
        'imovel-4': {
            name: 'Margarida - Tipo',
            prosoluto: [2800, 2750, 2700, 2650, 2600, 2550, 2500, 2450, 2400, 2350, 2300, 2250, 2200, 2150],
            parcela: [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850]
        },
        'imovel-5': {
            name: 'Margarida - Tipo/Moto',
            prosoluto: [2800, 2750, 2700, 2650, 2600, 2550, 2500, 2450, 2400, 2350, 2300, 2250, 2200, 2150],
            parcela: [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850]
        }
    };

    function getChartColors() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return {
            textColor: isLight ? '#5f6368' : '#9aa0a6',
            gridColor: isLight ? '#dadce0' : '#2d3139',
            blue: '#1976d2',
            green: '#2e7d32',
            orange: '#f57f17'
        };
    }

    function renderCharts() {
        const colors = getChartColors();

        // Destroy previous charts if they exist
        if(captacaoChartInstance) captacaoChartInstance.destroy();
        if(lineChartInstance) lineChartInstance.destroy();

        Chart.defaults.color = colors.textColor;
        Chart.defaults.font.family = "'Inter', sans-serif";

        // Captacao Chart
        const ctxCap = document.getElementById('captacaoChart');
        if (ctxCap) {
            captacaoChartInstance = new Chart(ctxCap.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Ano 1', 'Ano 2', 'Ano 3', 'Ano 4', 'Ano 5'],
                    datasets: [{
                        label: 'Captação',
                        data: [50, 80, 110, 150, 200],
                        borderColor: colors.green,
                        backgroundColor: colors.green + '33', // with transparency
                        fill: true,
                        tension: 0,
                        pointBackgroundColor: colors.green,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: colors.gridColor } },
                        y: { grid: { color: colors.gridColor } }
                    }
                }
            });
        }

        // Line Chart
        const ctxLine = document.getElementById('lineChart');
        if (ctxLine) {
            const chartData = unitData[currentUnitId];
            lineChartInstance = new Chart(ctxLine.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6', 'Mês 7', 'Mês 8', 'Mês 9', 'Mês 10', 'Mês 11', 'Mês 12', 'Mês 13', 'Mês 14'],
                    datasets: [
                        {
                            label: 'Prosoluto',
                            data: chartData.prosoluto,
                            borderColor: colors.blue,
                            borderWidth: 2,
                            tension: 0.1
                        },
                        {
                            label: 'Parcela',
                            data: chartData.parcela,
                            borderColor: colors.orange,
                            borderWidth: 2,
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { color: colors.gridColor } },
                        y: { grid: { color: colors.gridColor } }
                    }
                }
            });
            
            // update title
            const titleEl = document.getElementById('chart-title-unit');
            if(titleEl) titleEl.textContent = chartData.name;
        }
    }

    function updateChartColors() {
        renderCharts();
    }
    
    // Row Click Listeners
    const tableRows = document.querySelectorAll('.clickable-row');
    tableRows.forEach(row => {
        row.addEventListener('click', () => {
            // Remove active class
            tableRows.forEach(r => r.classList.remove('active-row'));
            row.classList.add('active-row');
            
            currentUnitId = row.getAttribute('data-id');
            renderCharts(); // Re-render to update lineChart
        });
    });

    // Toast logic
    const generateBtn = document.querySelector('.generate-btn');
    const toast = document.getElementById('toast-notification');
    
    if (generateBtn && toast) {
        generateBtn.addEventListener('click', () => {
            toast.classList.add('show');
            
            // Hide after 5 seconds
            setTimeout(() => {
                toast.classList.remove('show');
            }, 5000);
        });
    }

    renderCharts();
});

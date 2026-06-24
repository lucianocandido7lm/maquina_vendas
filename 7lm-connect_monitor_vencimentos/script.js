document.addEventListener('DOMContentLoaded', () => {
    // Colors based on styles.css
    const textPrimary = '#e2e8f0';
    const textSecondary = '#94a3b8';
    const borderColor = '#2a3143';

    // Chart 1: Status de Autorização (Donut)
    const ctxDonut = document.getElementById('autorizacaoChart');
    if (ctxDonut) {
        new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: ['Aguardando', 'Autorizado', 'Programado', 'Pago'],
                datasets: [{
                    data: [19, 18, 7, 136],
                    backgroundColor: ['#f59e0b', '#22c55e', '#eab308', '#0ea5e9'], /* Updated to match Kanban */
                    borderWidth: 0,
                    hoverOffset: 4,
                    cutout: '75%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#151a25',
                        titleColor: textPrimary,
                        bodyColor: textSecondary,
                        borderColor: borderColor,
                        borderWidth: 1
                    }
                }
            }
        });
    }

    // Chart 2: Programação de Pagamentos (Bar)
    const ctxBar = document.getElementById('progBarChart');
    if (ctxBar) {
        new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'],
                datasets: [{
                    label: 'Fluxo Próximos 30 dias',
                    data: [25, 30, 15, 60, 45, 10, 80, 50, 65, 35, 90, 20, 40, 55, 70, 85],
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#151a25',
                        titleColor: textPrimary,
                        bodyColor: textSecondary,
                        borderColor: borderColor,
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textSecondary,
                            font: { size: 10 }
                        }
                    },
                    y: {
                        grid: {
                            color: borderColor,
                            drawBorder: false,
                            borderDash: [4, 4]
                        },
                        ticks: {
                            display: false
                        }
                    }
                }
            }
        });
    }

});

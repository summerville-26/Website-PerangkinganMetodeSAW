/**
 * Sistem Pendukung Keputusan - SAW
 * Vanilla JavaScript (ES6) Implementation
 */

// ==========================================
// STATE MANAGEMENT (sessionStorage)
// ==========================================

const STORAGE_KEYS = {
    KRITERIA: 'saw_kriteria',
    ALTERNATIF: 'saw_alternatif',
    PENILAIAN: 'saw_penilaian',
    THEME: 'saw_theme'
};

const state = {
    kriteria: JSON.parse(sessionStorage.getItem(STORAGE_KEYS.KRITERIA)) || [],
    alternatif: JSON.parse(sessionStorage.getItem(STORAGE_KEYS.ALTERNATIF)) || [],
    penilaian: JSON.parse(sessionStorage.getItem(STORAGE_KEYS.PENILAIAN)) || {},
    theme: sessionStorage.getItem(STORAGE_KEYS.THEME) || 'light',
    
    // Store calculation results for PDF export
    lastResults: null,
    lastNormalizedMatrix: null
};

function saveState(key, data) {
    state[key] = data;
    sessionStorage.setItem(STORAGE_KEYS[key.toUpperCase()], JSON.stringify(data));
    updateDashboard();
}

// ==========================================
// THEME & UI UTILITIES
// ==========================================

function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
}

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    sessionStorage.setItem(STORAGE_KEYS.THEME, state.theme);
    updateThemeIcon();
    
    // Update charts theme
    if (window.rankingChartInstance) updateChartTheme(window.rankingChartInstance);
    if (window.bobotChartInstance) updateChartTheme(window.bobotChartInstance);
}

function updateThemeIcon() {
    const btn = document.getElementById('themeToggleBtn');
    const settingBtn = document.getElementById('settingThemeBtn');
    if (state.theme === 'dark') {
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        if(settingBtn) settingBtn.innerHTML = '<i class="fa-solid fa-sun"></i> Light Mode';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        if(settingBtn) settingBtn.innerHTML = '<i class="fa-solid fa-moon"></i> Dark Mode';
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="toast-content"><p>${message}</p></div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    // reset form if inside this modal
    const form = document.querySelector(`#${modalId} form`);
    if(form) form.reset();
}

// Confirmation Dialog Logic
let confirmCallback = null;
function confirmAction(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    openModal('confirmModal');
}

document.getElementById('confirmActionBtn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeModal('confirmModal');
});

// ==========================================
// NAVIGATION & LAYOUT
// ==========================================

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all links and pages
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked link and target page
        e.currentTarget.classList.add('active');
        const targetId = e.currentTarget.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        
        // Update Header Title
        document.getElementById('pageTitle').textContent = e.currentTarget.textContent.trim();
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }

        // Trigger specific logic when entering a page
        if (targetId === 'dashboard-page') updateDashboard();
        if (targetId === 'penilaian-page') renderPenilaianTable();
        if (targetId === 'saw-page') {
            document.getElementById('sawContent').classList.add('d-none');
            document.getElementById('sawAlertContainer').innerHTML = '';
            calculateSAW();
        }
    });
});

// Mobile Sidebar Toggle
document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
});

document.getElementById('closeSidebarBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
});

// ==========================================
// KRITERIA MODULE
// ==========================================

function renderKriteria() {
    const tbody = document.querySelector('#kriteriaTable tbody');
    const emptyState = document.getElementById('kriteriaEmptyState');
    const table = document.getElementById('kriteriaTable');
    
    tbody.innerHTML = '';
    
    if (state.kriteria.length === 0) {
        table.classList.add('d-none');
        emptyState.classList.remove('d-none');
    } else {
        table.classList.remove('d-none');
        emptyState.classList.add('d-none');
        
        state.kriteria.forEach((k, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${k.kode}</strong></td>
                <td>${k.nama}</td>
                <td><span class="badge ${k.jenis === 'Benefit' ? 'badge-benefit' : 'badge-cost'}">${k.jenis}</span></td>
                <td>${k.bobot}%</td>
                <td>
                    <button class="btn-icon" onclick="editKriteria('${k.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete" onclick="deleteKriteria('${k.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    checkTotalBobot();
    updateDashboard();
}

function saveKriteria() {
    const idInput = document.getElementById('kriteriaId').value;
    const kode = document.getElementById('kriteriaKode').value.trim();
    const nama = document.getElementById('kriteriaNama').value.trim();
    const jenis = document.getElementById('kriteriaJenis').value;
    const bobot = parseFloat(document.getElementById('kriteriaBobot').value);

    if (!kode || !nama || !jenis || isNaN(bobot)) {
        showToast('Semua field harus diisi dengan benar.', 'error');
        return;
    }
    
    if (bobot < 0) {
        showToast('Bobot tidak boleh negatif.', 'error');
        return;
    }

    if (idInput) {
        // Edit mode
        const index = state.kriteria.findIndex(k => k.id === idInput);
        if (index !== -1) {
            state.kriteria[index] = { id: idInput, kode, nama, jenis, bobot };
            showToast('Data kriteria berhasil diubah.');
        }
    } else {
        // Add mode
        const newId = 'K' + Date.now();
        state.kriteria.push({ id: newId, kode, nama, jenis, bobot });
        showToast('Data kriteria berhasil ditambahkan.');
    }

    saveState('kriteria', state.kriteria);
    renderKriteria();
    closeModal('kriteriaModal');
}

function editKriteria(id) {
    const kriteria = state.kriteria.find(k => k.id === id);
    if (kriteria) {
        document.getElementById('kriteriaId').value = kriteria.id;
        document.getElementById('kriteriaKode').value = kriteria.kode;
        document.getElementById('kriteriaNama').value = kriteria.nama;
        document.getElementById('kriteriaJenis').value = kriteria.jenis;
        document.getElementById('kriteriaBobot').value = kriteria.bobot;
        document.getElementById('kriteriaModalTitle').textContent = 'Edit Kriteria';
        openModal('kriteriaModal');
    }
}

function deleteKriteria(id) {
    confirmAction('Apakah Anda yakin ingin menghapus kriteria ini? Data penilaian yang terkait dengan kriteria ini mungkin akan terpengaruh.', () => {
        const filtered = state.kriteria.filter(k => k.id !== id);
        saveState('kriteria', filtered);
        
        // Clean up penilaian data associated with this kriteria
        Object.keys(state.penilaian).forEach(altId => {
            if(state.penilaian[altId][id] !== undefined) {
                delete state.penilaian[altId][id];
            }
        });
        saveState('penilaian', state.penilaian);
        
        renderKriteria();
        showToast('Data kriteria berhasil dihapus.');
    });
}

function checkTotalBobot() {
    const total = state.kriteria.reduce((sum, k) => sum + k.bobot, 0);
    const indicator = document.getElementById('weightIndicator');
    const text = indicator.querySelector('.indicator-text');
    const icon = document.getElementById('weightIcon');

    text.textContent = `Total Bobot: ${total}%`;

    if (total === 100) {
        indicator.style.borderColor = 'var(--success)';
        text.classList.remove('text-warning');
        text.classList.add('text-success');
        icon.className = 'fa-solid fa-circle-check text-success';
        return true;
    } else {
        indicator.style.borderColor = 'var(--warning)';
        text.classList.remove('text-success');
        text.classList.add('text-warning');
        icon.className = 'fa-solid fa-circle-exclamation text-warning';
        return false;
    }
}

// Search Kriteria
document.getElementById('searchKriteria').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#kriteriaTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

// Modal specific logic
document.querySelector('[onclick="openModal(\'kriteriaModal\')"]').addEventListener('click', () => {
    document.getElementById('formKriteria').reset();
    document.getElementById('kriteriaId').value = '';
    document.getElementById('kriteriaModalTitle').textContent = 'Tambah Kriteria';
});

// ==========================================
// ALTERNATIF MODULE
// ==========================================

function renderAlternatif() {
    const tbody = document.querySelector('#alternatifTable tbody');
    const emptyState = document.getElementById('alternatifEmptyState');
    const table = document.getElementById('alternatifTable');
    
    tbody.innerHTML = '';
    
    if (state.alternatif.length === 0) {
        table.classList.add('d-none');
        emptyState.classList.remove('d-none');
    } else {
        table.classList.remove('d-none');
        emptyState.classList.add('d-none');
        
        state.alternatif.forEach((a, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${a.kode}</strong></td>
                <td>${a.nama}</td>
                <td>
                    <button class="btn-icon" onclick="editAlternatif('${a.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete" onclick="deleteAlternatif('${a.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    updateDashboard();
}

function saveAlternatif() {
    const idInput = document.getElementById('alternatifId').value;
    const kode = document.getElementById('alternatifKode').value.trim();
    const nama = document.getElementById('alternatifNama').value.trim();

    if (!kode || !nama) {
        showToast('Semua field harus diisi.', 'error');
        return;
    }

    if (idInput) {
        const index = state.alternatif.findIndex(a => a.id === idInput);
        if (index !== -1) {
            state.alternatif[index] = { id: idInput, kode, nama };
            showToast('Data alternatif berhasil diubah.');
        }
    } else {
        const newId = 'A' + Date.now();
        state.alternatif.push({ id: newId, kode, nama });
        
        // Initialize empty penilaian for new alternatif
        state.penilaian[newId] = {};
        
        showToast('Data alternatif berhasil ditambahkan.');
    }

    saveState('alternatif', state.alternatif);
    saveState('penilaian', state.penilaian);
    renderAlternatif();
    closeModal('alternatifModal');
}

function editAlternatif(id) {
    const alt = state.alternatif.find(a => a.id === id);
    if (alt) {
        document.getElementById('alternatifId').value = alt.id;
        document.getElementById('alternatifKode').value = alt.kode;
        document.getElementById('alternatifNama').value = alt.nama;
        document.getElementById('alternatifModalTitle').textContent = 'Edit Alternatif';
        openModal('alternatifModal');
    }
}

function deleteAlternatif(id) {
    confirmAction('Apakah Anda yakin ingin menghapus alternatif ini?', () => {
        const filtered = state.alternatif.filter(a => a.id !== id);
        saveState('alternatif', filtered);
        
        // Clean up penilaian data
        if(state.penilaian[id]) {
            delete state.penilaian[id];
            saveState('penilaian', state.penilaian);
        }
        
        renderAlternatif();
        showToast('Data alternatif berhasil dihapus.');
    });
}

// Search Alternatif
document.getElementById('searchAlternatif').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#alternatifTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

document.querySelector('[onclick="openModal(\'alternatifModal\')"]').addEventListener('click', () => {
    document.getElementById('formAlternatif').reset();
    document.getElementById('alternatifId').value = '';
    document.getElementById('alternatifModalTitle').textContent = 'Tambah Alternatif';
});

// ==========================================
// PENILAIAN MODULE
// ==========================================

function renderPenilaianTable() {
    const theadTr = document.getElementById('penilaianTableHeader');
    const tbody = document.querySelector('#penilaianTable tbody');
    const emptyState = document.getElementById('penilaianEmptyState');
    const table = document.getElementById('penilaianTable');
    const btnSimpan = document.getElementById('btnSimpanPenilaian');

    // Reset Table
    theadTr.innerHTML = '<th>Alternatif</th>';
    tbody.innerHTML = '';

    if (state.kriteria.length === 0 || state.alternatif.length === 0) {
        table.classList.add('d-none');
        btnSimpan.style.display = 'none';
        emptyState.classList.remove('d-none');
        return;
    }

    table.classList.remove('d-none');
    btnSimpan.style.display = 'inline-flex';
    emptyState.classList.add('d-none');

    // Generate Headers
    state.kriteria.forEach(k => {
        const th = document.createElement('th');
        th.innerHTML = `${k.kode} <br><small class="text-muted">${k.nama}</small>`;
        theadTr.appendChild(th);
    });

    // Generate Rows
    state.alternatif.forEach(alt => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${alt.kode}</strong> - ${alt.nama}</td>`;
        
        state.kriteria.forEach(krit => {
            const td = document.createElement('td');
            const val = state.penilaian[alt.id] && state.penilaian[alt.id][krit.id] !== undefined ? state.penilaian[alt.id][krit.id] : '';
            td.innerHTML = `<input type="number" step="any" min="0" data-alt="${alt.id}" data-krit="${krit.id}" value="${val}" placeholder="0">`;
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
}

document.getElementById('btnSimpanPenilaian').addEventListener('click', () => {
    const inputs = document.querySelectorAll('#penilaianTable input');
    let hasEmpty = false;

    inputs.forEach(input => {
        const altId = input.getAttribute('data-alt');
        const kritId = input.getAttribute('data-krit');
        const val = parseFloat(input.value);

        if (!state.penilaian[altId]) {
            state.penilaian[altId] = {};
        }

        if (isNaN(val)) {
            hasEmpty = true;
        } else {
            state.penilaian[altId][kritId] = val;
        }
    });

    saveState('penilaian', state.penilaian);
    
    if (hasEmpty) {
        showToast('Beberapa nilai kosong disetel ke 0 secara otomatis.', 'warning');
    } else {
        showToast('Data penilaian berhasil disimpan.');
    }
});

// ==========================================
// SAW CALCULATION MODULE
// ==========================================

function calculateSAW() {
    const alertContainer = document.getElementById('sawAlertContainer');
    const sawContent = document.getElementById('sawContent');
    
    alertContainer.innerHTML = '';
    sawContent.classList.add('d-none');

    // Validations
    if (state.kriteria.length === 0 || state.alternatif.length === 0) {
        alertContainer.innerHTML = `<div class="alert alert-warning"><i class="fa-solid fa-circle-exclamation"></i> Data Kriteria atau Alternatif belum lengkap.</div>`;
        return;
    }

    if (!checkTotalBobot()) {
        alertContainer.innerHTML = `<div class="alert alert-warning"><i class="fa-solid fa-scale-unbalanced"></i> Total bobot kriteria harus tepat 100%. Saat ini: ${state.kriteria.reduce((s, k)=>s+k.bobot,0)}%. Silakan sesuaikan di menu Kriteria.</div>`;
        return;
    }

    // Check if matrix is fully filled
    let isMatrixComplete = true;
    for (let alt of state.alternatif) {
        for (let krit of state.kriteria) {
            if (!state.penilaian[alt.id] || state.penilaian[alt.id][krit.id] === undefined) {
                isMatrixComplete = false;
                break;
            }
        }
    }

    if (!isMatrixComplete) {
        alertContainer.innerHTML = `<div class="alert alert-warning"><i class="fa-solid fa-table-cells"></i> Matriks penilaian belum lengkap. Harap isi semua nilai di menu Penilaian.</div>`;
        return;
    }

    // PROSES SAW
    
    // 1. Matriks Keputusan (X)
    renderMatrixTable('matrixTable', state.penilaian);

    // 2. Normalisasi (R)
    const normalizedMatrix = {};
    const minMaxValues = {}; // store min/max per kriteria

    // Cari min/max per kriteria
    state.kriteria.forEach(krit => {
        let values = [];
        state.alternatif.forEach(alt => {
            values.push(state.penilaian[alt.id][krit.id]);
        });
        
        if (krit.jenis === 'Benefit') {
            minMaxValues[krit.id] = Math.max(...values);
        } else {
            minMaxValues[krit.id] = Math.min(...values);
        }
    });

    // Hitung normalisasi
    state.alternatif.forEach(alt => {
        normalizedMatrix[alt.id] = {};
        state.kriteria.forEach(krit => {
            const x = state.penilaian[alt.id][krit.id];
            let r = 0;
            if (krit.jenis === 'Benefit') {
                r = minMaxValues[krit.id] === 0 ? 0 : x / minMaxValues[krit.id];
            } else {
                r = x === 0 ? 0 : minMaxValues[krit.id] / x;
            }
            normalizedMatrix[alt.id][krit.id] = r;
        });
    });

    renderMatrixTable('normTable', normalizedMatrix, true);

    // 3. Nilai Preferensi (V)
    const results = [];
    state.alternatif.forEach(alt => {
        let v = 0;
        state.kriteria.forEach(krit => {
            const w = krit.bobot / 100; // Convert percent to decimal
            const r = normalizedMatrix[alt.id][krit.id];
            v += (w * r);
        });
        results.push({
            alt: alt,
            val: v
        });
    });

    // 4. Perankingan
    results.sort((a, b) => b.val - a.val);
    
    // Simpan hasil untuk Dashboard & PDF
    state.lastResults = results;
    state.lastNormalizedMatrix = normalizedMatrix;
    
    const rankTbody = document.querySelector('#rankTable tbody');
    rankTbody.innerHTML = '';
    
    results.forEach((res, index) => {
        const tr = document.createElement('tr');
        const rank = index + 1;
        let badge = '';
        if (rank === 1) {
            tr.style.backgroundColor = 'var(--primary-light)';
            badge = '<span class="badge text-white" style="background-color: var(--primary); margin-left: 10px;"><i class="fa-solid fa-trophy"></i> Alternatif Terbaik</span>';
        }
        
        tr.innerHTML = `
            <td><strong>#${rank}</strong></td>
            <td><strong>${res.alt.kode}</strong> - ${res.alt.nama} ${badge}</td>
            <td><strong>${res.val.toFixed(4)}</strong></td>
        `;
        rankTbody.appendChild(tr);
    });

    sawContent.classList.remove('d-none');
    showToast('Perhitungan SAW berhasil diselesaikan.');
    
    // Update Dashboard Charts & Report
    updateDashboard();
    renderLaporan();
    
    // Scroll to results
    setTimeout(() => {
        sawContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function renderMatrixTable(tableId, dataMatrix, isDecimal = false) {
    const tableHeader = document.getElementById(`${tableId}Header`);
    const tbody = document.querySelector(`#${tableId} tbody`);
    
    tableHeader.innerHTML = '<th>Alternatif</th>';
    tbody.innerHTML = '';

    state.kriteria.forEach(k => {
        const th = document.createElement('th');
        th.textContent = k.kode;
        th.title = k.nama;
        tableHeader.appendChild(th);
    });

    state.alternatif.forEach(alt => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${alt.kode}</strong></td>`;
        
        state.kriteria.forEach(krit => {
            const td = document.createElement('td');
            const val = dataMatrix[alt.id][krit.id];
            td.textContent = isDecimal ? parseFloat(val).toFixed(3) : val;
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
}

// ==========================================
// DASHBOARD & CHARTS
// ==========================================

window.rankingChartInstance = null;
window.bobotChartInstance = null;

function updateDashboard() {
    // Stats
    document.getElementById('dashTotalKriteria').textContent = state.kriteria.length;
    document.getElementById('dashTotalAlternatif').textContent = state.alternatif.length;
    
    // Count filled matrix items
    let filled = 0;
    Object.keys(state.penilaian).forEach(altId => {
        Object.keys(state.penilaian[altId]).forEach(() => filled++);
    });
    document.getElementById('dashTotalPenilaian').textContent = filled;

    // Best Alternatif
    if (state.lastResults && state.lastResults.length > 0) {
        document.getElementById('dashBestAlternatif').textContent = state.lastResults[0].alt.nama;
    } else {
        document.getElementById('dashBestAlternatif').textContent = '-';
    }

    // Generate Charts
    generateCharts();
}

function generateCharts() {
    // Common Chart Styles based on theme
    const textColor = state.theme === 'dark' ? '#f9fafb' : '#4b5563';
    const gridColor = state.theme === 'dark' ? '#374151' : '#e5e7eb';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Ranking Chart
    const ctxRank = document.getElementById('rankingChart');
    if (ctxRank) {
        let labels = [];
        let data = [];
        
        if (state.lastResults) {
            // Show top 5 or all if less
            const chartData = state.lastResults.slice(0, 5);
            labels = chartData.map(r => r.alt.kode);
            data = chartData.map(r => r.val);
        }

        if (window.rankingChartInstance) window.rankingChartInstance.destroy();
        
        window.rankingChartInstance = new Chart(ctxRank, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nilai Preferensi',
                    data: data,
                    backgroundColor: '#4f46e5',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: gridColor }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Bobot Chart
    const ctxBobot = document.getElementById('bobotChart');
    if (ctxBobot) {
        const labels = state.kriteria.map(k => k.kode);
        const data = state.kriteria.map(k => k.bobot);
        
        // Generate nice colors
        const colors = [
            '#4f46e5', '#10b981', '#f59e0b', '#ef4444', 
            '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16'
        ];

        if (window.bobotChartInstance) window.bobotChartInstance.destroy();

        window.bobotChartInstance = new Chart(ctxBobot, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }
}

function updateChartTheme(chartInstance) {
    if(!chartInstance) return;
    const textColor = state.theme === 'dark' ? '#f9fafb' : '#4b5563';
    const gridColor = state.theme === 'dark' ? '#374151' : '#e5e7eb';
    
    chartInstance.options.color = textColor;
    if(chartInstance.options.scales && chartInstance.options.scales.y) {
        chartInstance.options.scales.y.grid.color = gridColor;
    }
    chartInstance.update();
}

// ==========================================
// LAPORAN & PDF EXPORT
// ==========================================

function renderLaporan() {
    const container = document.getElementById('laporanContent');
    const btnExport = document.getElementById('btnExportPDF');

    if (!state.lastResults) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-file-circle-xmark empty-icon"></i>
                <p>Belum ada laporan.</p>
                <p class="text-muted text-sm">Lakukan perhitungan SAW terlebih dahulu untuk melihat laporan.</p>
            </div>
        `;
        btnExport.disabled = true;
        return;
    }

    btnExport.disabled = false;
    
    // Copy table structure from SAW page to Laporan page for preview
    let html = `
        <div class="alert alert-warning mb-4" style="background-color: var(--success-light); border-color: var(--success); color: var(--success);">
            <i class="fa-solid fa-trophy"></i> Alternatif terbaik adalah <strong>${state.lastResults[0].alt.nama}</strong> dengan nilai preferensi <strong>${state.lastResults[0].val.toFixed(4)}</strong>.
        </div>
        
        <div class="mb-4">
            <h4 style="margin-bottom: 0.5rem;">Tahap 1: Matriks Keputusan (X)</h4>
            <div class="table-responsive">
                ${document.getElementById('matrixTable').outerHTML}
            </div>
        </div>

        <div class="mb-4">
            <h4 style="margin-bottom: 0.5rem;">Tahap 2: Matriks Normalisasi (R)</h4>
            <div class="table-responsive">
                ${document.getElementById('normTable').outerHTML}
            </div>
        </div>

        <div class="mb-4">
            <h4 style="margin-bottom: 0.5rem;">Tahap 3 & 4: Hasil Akhir Perankingan</h4>
            <div class="table-responsive">
                ${document.getElementById('rankTable').outerHTML}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function exportPDF() {
    if (!state.lastResults) return;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Settings
        const primaryColor = [79, 70, 229];
        
        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("LAPORAN SISTEM PENDUKUNG KEPUTUSAN", 14, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text("Metode: Simple Additive Weighting (SAW)", 14, 28);
        
        const date = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.setFontSize(10);
        doc.text(`Tanggal Cetak: ${date}`, 14, 34);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 38, 196, 38);

        // Kriteria
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text("1. Data Kriteria", 14, 48);
        
        const kriteriaBody = state.kriteria.map(k => [k.kode, k.nama, k.jenis, `${k.bobot}%`]);
        doc.autoTable({
            startY: 52,
            head: [['Kode', 'Nama Kriteria', 'Jenis', 'Bobot']],
            body: kriteriaBody,
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 9 }
        });

        // Alternatif & Matriks
        doc.setFont("helvetica", "bold");
        doc.text("2. Data Alternatif & Matriks Keputusan", 14, doc.lastAutoTable.finalY + 10);
        
        const matrixHead = ['Alternatif', ...state.kriteria.map(k => k.kode)];
        const matrixBody = state.alternatif.map(alt => {
            const row = [`${alt.kode} - ${alt.nama}`];
            state.kriteria.forEach(k => {
                row.push(state.penilaian[alt.id][k.id] || 0);
            });
            return row;
        });

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 14,
            head: [matrixHead],
            body: matrixBody,
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 9 }
        });

        // Matriks Normalisasi
        doc.setFont("helvetica", "bold");
        doc.text("3. Matriks Normalisasi (R)", 14, doc.lastAutoTable.finalY + 10);
        
        const normBody = state.alternatif.map(alt => {
            const row = [`${alt.kode}`];
            state.kriteria.forEach(k => {
                row.push(state.lastNormalizedMatrix && state.lastNormalizedMatrix[alt.id] ? state.lastNormalizedMatrix[alt.id][k.id].toFixed(3) : 0);
            });
            return row;
        });

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 14,
            head: [matrixHead],
            body: normBody,
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 9 }
        });

        // Hasil Perankingan
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.text("4. Hasil Perankingan", 14, 20);

        const rankBody = state.lastResults.map((r, i) => [
            i + 1,
            `${r.alt.kode} - ${r.alt.nama}`,
            r.val.toFixed(4)
        ]);

        doc.autoTable({
            startY: 25,
            head: [['Ranking', 'Alternatif', 'Nilai Preferensi']],
            body: rankBody,
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 10, fontStyle: 'bold' },
            didParseCell: function(data) {
                if (data.row.index === 0 && data.section === 'body') {
                    data.cell.styles.fillColor = [224, 231, 255]; // highlight first row
                }
            }
        });

        // Kesimpulan
        const bestAlt = state.lastResults[0];
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Kesimpulan: Alternatif terbaik adalah ${bestAlt.alt.nama} dengan nilai tertinggi ${bestAlt.val.toFixed(4)}.`, 14, doc.lastAutoTable.finalY + 15);

        doc.save(`Laporan_SPK_SAW_${Date.now()}.pdf`);
        showToast('Laporan PDF berhasil diunduh.');
    } catch (e) {
        console.error(e);
        showToast('Terjadi kesalahan saat membuat PDF.', 'error');
    }
}

// ==========================================
// PENGATURAN MODULE
// ==========================================

function confirmReset() {
    confirmAction('Perhatian! Seluruh data kriteria, alternatif, dan penilaian akan dihapus permanen dari browser ini. Apakah Anda yakin?', () => {
        sessionStorage.clear();
        // Keep theme
        sessionStorage.setItem(STORAGE_KEYS.THEME, state.theme);
        
        state.kriteria = [];
        state.alternatif = [];
        state.penilaian = {};
        state.lastResults = null;
        state.lastNormalizedMatrix = null;
        
        renderKriteria();
        renderAlternatif();
        renderPenilaianTable();
        
        document.getElementById('sawContent').classList.add('d-none');
        document.getElementById('sawAlertContainer').innerHTML = '';
        renderLaporan();
        
        showToast('Sistem berhasil direset.');
    });
}

function exportJSON() {
    const dataToExport = {
        kriteria: state.kriteria,
        alternatif: state.alternatif,
        penilaian: state.penilaian
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `Backup_SPK_SAW_${Date.now()}.json`);
    dlAnchorElem.click();
    showToast('Data berhasil diexport.');
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if(data.kriteria && data.alternatif && data.penilaian) {
                saveState('kriteria', data.kriteria);
                saveState('alternatif', data.alternatif);
                saveState('penilaian', data.penilaian);
                
                renderKriteria();
                renderAlternatif();
                renderPenilaianTable();
                
                showToast('Data berhasil diimport.');
            } else {
                showToast('Format file JSON tidak valid.', 'error');
            }
        } catch (err) {
            showToast('Gagal membaca file JSON.', 'error');
        }
        event.target.value = ''; // reset file input
    };
    reader.readAsText(file);
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderKriteria();
    renderAlternatif();
    updateDashboard();
});

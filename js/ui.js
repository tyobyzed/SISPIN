/**
 * UI Service Module
 * Handles all UI rendering, navigation, and user interactions
 */

const UIService = {
    currentPage: 'beranda',
    virtualScrollInstances: new Map(),

    /**
     * Initialize UI service
     */
    init() {
        this.renderNavigation();
        this.renderCurrentPage();
        this.updateDateTime();
        this.setupEventListeners();
        this.initializeVirtualScrolling();
        
        // Update date time every second
        setInterval(() => this.updateDateTime(), 1000);
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for config changes
        window.addEventListener('configChange', (e) => {
            this.handleConfigChange(e.detail);
        });

        // Listen for window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    },

    /**
     * Handle configuration changes
     */
    handleConfigChange({ key, value }) {
        switch (key) {
            case 'app_title':
                document.getElementById('loginTitle').textContent = value;
                break;
            case 'welcome_message':
                document.getElementById('loginSubtitle').textContent = value;
                break;
            case 'footer_text':
                document.getElementById('footerText').textContent = value;
                break;
            case 'primary_color':
                this.updatePrimaryColor(value);
                break;
            case 'font_family':
                document.body.style.fontFamily = value;
                break;
            case 'font_size':
                document.body.style.fontSize = value + 'px';
                break;
        }
    },

    /**
     * Update primary color
     */
    updatePrimaryColor(color) {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary-color: ${color};
            }
            .bg-primary { background-color: ${color}; }
            .text-primary { color: ${color}; }
            .border-primary { border-color: ${color}; }
        `;
        document.head.appendChild(style);
    },

    /**
     * Handle window resize
     */
    handleResize() {
        // Reinitialize virtual scrolling if needed
        this.virtualScrollInstances.forEach((instance, key) => {
            if (instance.container && instance.container.offsetParent) {
                this.updateVirtualScroll(key);
            }
        });
    },

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K for quick navigation
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showQuickNavigation();
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    },

    /**
     * Show quick navigation modal
     */
    showQuickNavigation() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">Navigasi Cepat</h3>
                <input type="text" id="quickNavInput" placeholder="Cari menu..." 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <div id="quickNavResults" class="mt-4 max-h-60 overflow-y-auto"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#quickNavInput');
        const results = modal.querySelector('#quickNavResults');
        
        input.focus();
        
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const pages = Object.entries(DataService.pages)
                .filter(([key, page]) => AuthService.hasPermission(key))
                .map(([key, page]) => ({ key, ...page }));
            
            const filtered = pages.filter(page => 
                page.title.toLowerCase().includes(query)
            );
            
            results.innerHTML = filtered.map(page => `
                <button onclick="UIService.navigateTo('${page.key}'); this.closest('.fixed').remove();" 
                        class="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center">
                    <span class="text-xl mr-3">${page.icon}</span>
                    <span>${page.title}</span>
                </button>
            `).join('');
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    /**
     * Close all modals
     */
    closeModals() {
        document.querySelectorAll('.fixed.z-50').forEach(modal => {
            if (modal.querySelector('.bg-white')) {
                modal.remove();
            }
        });
    },

    /**
     * Render navigation menu
     */
    renderNavigation() {
        const nav = document.getElementById('navigation');
        if (!nav) return;
        
        const userPermissions = Object.keys(DataService.pages)
            .filter(key => AuthService.hasPermission(key));
        
        nav.innerHTML = userPermissions.map(pageKey => {
            const page = DataService.pages[pageKey];
            const isActive = this.currentPage === pageKey;
            
            return `
                <button onclick="UIService.navigateTo('${pageKey}')" 
                        class="nav-item w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left
                               ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}">
                    <span class="text-lg">${page.icon}</span>
                    <span>${page.title}</span>
                </button>
            `;
        }).join('');
    },

    /**
     * Navigate to page
     */
    navigateTo(pageKey) {
        if (!AuthService.hasPermission(pageKey)) {
            NotificationService.show('Anda tidak memiliki akses ke halaman ini', 'error');
            return;
        }
        
        this.currentPage = pageKey;
        document.getElementById('pageTitle').textContent = DataService.pages[pageKey].title;
        
        this.renderNavigation();
        this.renderCurrentPage();
        
        // Update URL without reload
        const url = new URL(window.location);
        url.searchParams.set('page', pageKey);
        window.history.pushState({}, '', url);
    },

    /**
     * Render current page
     */
    renderCurrentPage() {
        const content = document.getElementById('content');
        if (!content) return;
        
        const page = DataService.pages[this.currentPage];
        
        content.innerHTML = `
            <div class="fade-in">
                <div class="mb-6">
                    <h2 class="text-2xl font-bold text-gray-900 flex items-center">
                        <span class="mr-3 text-3xl">${page.icon}</span>
                        ${page.title}
                    </h2>
                </div>
                ${this.renderPageContent()}
            </div>
        `;

        // Initialize page-specific features
        this.initializePageFeatures();
    },

    /**
     * Render page content based on current page
     */
    renderPageContent() {
        switch (this.currentPage) {
            case 'beranda':
                return this.renderBeranda();
            case 'intra':
                return this.renderIntraKurikuler();
            case 'kokurikuler':
                return this.renderKokurikuler();
            case 'wali':
                return this.renderGuruWali();
            case 'jurnal':
                return this.renderJurnal();
            case 'bk':
                return this.renderBimbinganKonseling();
            case 'manajemen':
                return this.renderManajemenData();
            case 'persetujuan':
                return this.renderPersetujuan();
            default:
                return '<p>Halaman tidak ditemukan.</p>';
        }
    },

    /**
     * Initialize page-specific features
     */
    initializePageFeatures() {
        switch (this.currentPage) {
            case 'kokurikuler':
                setTimeout(() => this.showKokurikulerTab('kegiatan'), 100);
                break;
            case 'wali':
                setTimeout(() => this.showWaliTab('data'), 100);
                break;
            case 'bk':
                setTimeout(() => this.showBKTab('absensi'), 100);
                break;
            case 'manajemen':
                setTimeout(() => this.showManajemenTab('guru'), 100);
                break;
        }
    },

    /**
     * Render Beranda (Dashboard)
     */
    renderBeranda() {
        const stats = DataService.getStatistics();
        const currentTime = new Date();
        const greeting = currentTime.getHours() < 12 ? 'Selamat Pagi' : 
                           currentTime.getHours() < 15 ? 'Selamat Siang' : 
                           currentTime.getHours() < 18 ? 'Selamat Sore' : 'Selamat Malam';

        return `
            <!-- Welcome Banner -->
            <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 rounded-2xl shadow-xl p-8 mb-8 text-white relative overflow-hidden">
                <div class="absolute inset-0 bg-black opacity-10"></div>
                <div class="absolute -top-4 -right-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                <div class="absolute -bottom-4 -left-4 w-32 h-32 bg-white opacity-5 rounded-full"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-3xl font-bold mb-2">${greeting}, ${AuthService.currentUser.name}! 👋</h1>
                            <p class="text-blue-100 text-lg">Selamat datang kembali di SISPIN - SMA Negeri 20 Medan</p>
                            <p class="text-blue-200 text-sm mt-2">Role: ${AuthService.getRoleDisplayName(AuthService.currentUser.role)} | ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div class="hidden md:block">
                            <div class="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                <span class="text-4xl">${AuthService.getRoleIcon(AuthService.currentUser.role)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                ${this.renderStatCard('Intra Kurikuler', stats.intra, '📚', 'from-blue-500 to-blue-600', 'Data pembelajaran')}
                ${this.renderStatCard('Kokurikuler', stats.kokurikuler, '🎯', 'from-green-500 to-green-600', 'Kegiatan siswa')}
                ${this.renderStatCard('Jurnal & Supervisi', stats.jurnal, '📝', 'from-yellow-500 to-orange-500', 'Catatan harian')}
                ${this.renderStatCard('Total Siswa', stats.siswa, '👥', 'from-purple-500 to-purple-600', 'Data terdaftar')}
            </div>

            <!-- Additional Stats for Teachers -->
            ${AuthService.currentUser.role === 'guru' || AuthService.currentUser.role === 'admin' || AuthService.currentUser.role === 'bk' ? `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    ${this.renderStatCard('Absensi Hari Ini', stats.absensi, '📋', 'from-blue-400 to-blue-500', 'Data kehadiran')}
                    ${this.renderStatCard('Data Nilai', stats.nilai, '📊', 'from-green-400 to-green-500', 'Penilaian siswa')}
                    ${this.renderStatCard('Catatan Perilaku', stats.perilaku, '😊', 'from-orange-400 to-orange-500', 'Monitoring karakter')}
                </div>
            ` : ''}

            <!-- Quick Actions -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                ${this.renderQuickActions()}
                ${this.renderSchoolInfo()}
            </div>
            
            <!-- Recent Activities -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-4">
                    <h3 class="text-lg font-semibold text-white flex items-center">
                        <span class="mr-2">📈</span>
                        Aktivitas Terbaru
                    </h3>
                </div>
                <div class="p-6">
                    ${this.renderRecentActivities()}
                </div>
            </div>
        `;
    },

    /**
     * Render stat card
     */
    renderStatCard(title, value, icon, gradient, subtitle) {
        return `
            <div class="bg-gradient-to-br ${gradient} rounded-xl shadow-lg p-6 text-white card-hover transform transition-all duration-300">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-white text-sm font-medium opacity-90">${title}</p>
                        <p class="text-3xl font-bold">${value}</p>
                        <p class="text-white text-xs mt-1 opacity-75">${subtitle}</p>
                    </div>
                    <div class="bg-white bg-opacity-20 rounded-full p-3">
                        <span class="text-3xl">${icon}</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render quick actions
     */
    renderQuickActions() {
        const actions = AuthService.currentUser.role === 'siswa' ? [
            { icon: '📚', label: 'Lihat Pembelajaran', page: 'intra' },
            { icon: '🎯', label: 'Lihat Kegiatan', page: 'kokurikuler' },
            { icon: '📝', label: 'Lihat Jurnal', page: 'jurnal' },
            { icon: '💬', label: 'Bimbingan BK', page: 'bk' }
        ] : [
            { icon: '📚', label: 'Intra Kurikuler', page: 'intra' },
            { icon: '👨‍🏫', label: 'Guru Wali', page: 'wali' },
            { icon: '📝', label: 'Jurnal', page: 'jurnal' },
            { icon: '🎯', label: 'Kokurikuler', page: 'kokurikuler' }
        ];

        return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                    <h3 class="text-lg font-semibold text-white flex items-center">
                        <span class="mr-2">⚡</span>
                        Aksi Cepat
                    </h3>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-2 gap-4">
                        ${actions.map(action => `
                            <button onclick="UIService.navigateTo('${action.page}')" 
                                    class="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 text-center transition-colors group">
                                <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">${action.icon}</div>
                                <div class="text-sm font-medium text-blue-800">${action.label}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render school info
     */
    renderSchoolInfo() {
        return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4">
                    <h3 class="text-lg font-semibold text-white flex items-center">
                        <span class="mr-2">🏫</span>
                        Informasi Sekolah
                    </h3>
                </div>
                <div class="p-6">
                    <div class="space-y-4">
                        <div class="flex items-center">
                            <div class="bg-blue-100 rounded-full p-2 mr-3">
                                <span class="text-lg">🎓</span>
                            </div>
                            <div>
                                <p class="font-medium text-gray-800">SMA Negeri 20 Medan</p>
                                <p class="text-sm text-gray-600">Sekolah Menengah Atas</p>
                            </div>
                        </div>
                        <div class="flex items-center">
                            <div class="bg-green-100 rounded-full p-2 mr-3">
                                <span class="text-lg">📍</span>
                            </div>
                            <div>
                                <p class="font-medium text-gray-800">Medan, Sumatera Utara</p>
                                <p class="text-sm text-gray-600">Indonesia</p>
                            </div>
                        </div>
                        <div class="flex items-center">
                            <div class="bg-purple-100 rounded-full p-2 mr-3">
                                <span class="text-lg">💻</span>
                            </div>
                            <div>
                                <p class="font-medium text-gray-800">SISPIN v2.0</p>
                                <p class="text-sm text-gray-600">Sistem Informasi Sekolah Pintar</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render recent activities
     */
    renderRecentActivities() {
        const recentData = DataService.allData
            .filter(d => AuthService.currentUser.role === 'siswa' ? d.approved === true : true)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        if (recentData.length === 0) {
            return '<p class="text-gray-500 text-center py-8">Belum ada aktivitas terbaru.</p>';
        }

        return recentData.map(item => `
            <div class="flex items-center py-3 border-b border-gray-100 last:border-b-0">
                <div class="flex-shrink-0">
                    <span class="text-2xl">${this.getTypeIcon(item.type)}</span>
                </div>
                <div class="ml-4 flex-1">
                    <p class="text-sm font-medium text-gray-900">${item.title}</p>
                    <p class="text-sm text-gray-500">oleh ${item.author} • ${this.formatDate(item.date)}</p>
                </div>
                ${item.approved ? '<span class="text-green-600 text-sm">✓ Disetujui</span>' : 
                  AuthService.currentUser.role === 'siswa' ? '<span class="text-yellow-600 text-sm">⏳ Menunggu</span>' : ''}
            </div>
        `).join('');
    },

    /**
     * Initialize virtual scrolling
     */
    initializeVirtualScrolling() {
        if (!AppConfig.get('performance.enable_virtual_scrolling')) return;
        
        // Find all tables that need virtual scrolling
        document.querySelectorAll('table[data-virtual-scroll]').forEach(table => {
            const container = table.parentElement;
            const key = table.dataset.virtualScroll;
            
            this.virtualScrollInstances.set(key, {
                container,
                table,
                rowHeight: 60,
                visibleRows: 10
            });
            
            this.setupVirtualScroll(key);
        });
    },

    /**
     * Setup virtual scrolling for a specific table
     */
    setupVirtualScroll(key) {
        const instance = this.virtualScrollInstances.get(key);
        if (!instance) return;
        
        const { container, table, rowHeight, visibleRows } = instance;
        
        container.style.height = `${rowHeight * visibleRows}px`;
        container.style.overflowY = 'auto';
        
        container.addEventListener('scroll', () => {
            this.updateVirtualScroll(key);
        });
        
        this.updateVirtualScroll(key);
    },

    /**
     * Update virtual scroll
     */
    updateVirtualScroll(key) {
        const instance = this.virtualScrollInstances.get(key);
        if (!instance) return;
        
        const { container, table, rowHeight } = instance;
        const scrollTop = container.scrollTop;
        const startIndex = Math.floor(scrollTop / rowHeight);
        
        // Update visible rows
        // This is a simplified implementation
        // In production, you'd want to render only visible rows
    },

    /**
     * Update date time
     */
    updateDateTime() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const dateTimeElement = document.getElementById('currentDateTime');
        if (dateTimeElement) {
            dateTimeElement.textContent = now.toLocaleDateString('id-ID', options);
        }
    },

    /**
     * Format date
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Get type icon
     */
    getTypeIcon(type) {
        const icons = {
            intra: '📚',
            kokurikuler: '🎯',
            wali: '👨‍🏫',
            jurnal: '📝',
            bk: '💬',
            guru: '👩‍🏫',
            siswa: '👨‍🎓',
            kelas: '🏫',
            kebiasaan: '🌟',
            absensi: '📋',
            nilai: '📊',
            perilaku: '😊',
            bk_absensi: '📋',
            bk_pelanggaran: '⚠️'
        };
        return icons[type] || '📄';
    },

    /**
     * Show loading overlay
     */
    showLoading(message = 'Memproses...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.querySelector('span').textContent = message;
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    /**
     * Show confirmation dialog
     */
    showConfirmation(message, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Konfirmasi</h3>
                <p class="text-gray-600 mb-4">${message}</p>
                <div class="flex justify-end space-x-3">
                    <button onclick="this.closest('.fixed').remove(); ${onCancel ? `(${onCancel})()` : ''}" 
                            class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Batal
                    </button>
                    <button onclick="this.closest('.fixed').remove(); ${onConfirm}()" 
                            class="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700">
                        Ya
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    /**
     * Render Intra Kurikuler page
     */
    renderIntraKurikuler() {
        const data = DataService.getFilteredData('intra');
        
        return `
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-lg font-medium text-gray-900">Data Perencanaan Intra Kurikuler</h3>
                    ${AuthService.currentUser.role === 'guru' || AuthService.currentUser.role === 'admin' || AuthService.currentUser.role === 'bk' ? `
                        <button onclick="UIService.showAddForm('intra')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                            Tambah Data
                        </button>
                    ` : ''}
                </div>
                <div class="p-6">
                    ${this.renderDataTable(data, 'intra')}
                </div>
            </div>
        `;
    },

    /**
     * Render Kokurikuler page
     */
    renderKokurikuler() {
        return `
            <div class="space-y-6">
                <!-- Navigation Tabs -->
                <div class="bg-white rounded-lg shadow">
                    <div class="border-b border-gray-200">
                        <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                            <button onclick="UIService.showKokurikulerTab('kegiatan')" id="tabKegiatan" 
                                    class="kokurikuler-tab border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                                🎯 Data Kegiatan Kokurikuler
                            </button>
                            <button onclick="UIService.showKokurikulerTab('kebiasaan')" id="tabKebiasaan" 
                                    class="kokurikuler-tab border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                                🇮🇩 Tujuh Kebiasaan Anak Indonesia Hebat
                            </button>
                        </nav>
                    </div>
                </div>

                <!-- Tab Content -->
                <div id="kokurikulerTabContent">
                    <!-- Content will be loaded here -->
                </div>
            </div>
        `;
    },

    /**
     * Show Kokurikuler Tab
     */
    showKokurikulerTab(tabType) {
        // Update tab styling
        document.querySelectorAll('.kokurikuler-tab').forEach(tab => {
            tab.classList.remove('border-blue-500', 'text-blue-600');
            tab.classList.add('border-transparent', 'text-gray-500');
        });
        
        const activeTab = document.getElementById(tabType === 'kegiatan' ? 'tabKegiatan' : 'tabKebiasaan');
        if (activeTab) {
            activeTab.classList.remove('border-transparent', 'text-gray-500');
            activeTab.classList.add('border-blue-500', 'text-blue-600');
        }

        // Load content
        const contentDiv = document.getElementById('kokurikulerTabContent');
        if (tabType === 'kegiatan') {
            contentDiv.innerHTML = this.renderKegiatanKokurikuler();
        } else {
            contentDiv.innerHTML = this.renderKebiasaanKokurikuler();
        }
    },

    /**
     * Render Kegiatan Kokurikuler Tab
     */
    renderKegiatanKokurikuler() {
        const data = DataService.getFilteredData('kokurikuler');
        
        return `
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-medium text-gray-900">Data Kegiatan Kokurikuler</h3>
                        <p class="text-sm text-gray-600 mt-1">Kelola data kegiatan ekstrakurikuler dan kokurikuler sekolah</p>
                    </div>
                    ${AuthService.currentUser.role === 'guru' || AuthService.currentUser.role === 'admin' || AuthService.currentUser.role === 'bk' ? `
                        <button onclick="UIService.showAddForm('kokurikuler')" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBoxbox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                            Tambah Kegiatan
                        </button>
                    ` : ''}
                </div>
                <div class="p-6">
                    ${this.renderDataTable(data, 'kokurikuler')}
                </div>
            </div>
        `;
    },

    /**
     * Render Kebiasaan Kokurikuler Tab
     */
    renderKebiasaanKokurikuler() {
        const data = DataService.getFilteredData('kebiasaan');
        
        const kebiasaanList = [
            { id: 'bangun_pagi', icon: '🌅', title: 'Bangun Pagi', desc: 'Bangun sebelum jam 06:00' },
            { id: 'beribadah', icon: '🤲', title: 'Beribadah', desc: 'Melaksanakan ibadah sesuai agama' },
            { id: 'berolahraga', icon: '🏃', title: 'Berolahraga', desc: 'Aktivitas fisik minimal 30 menit' },
            { id: 'makan_sehat', icon: '🥗', title: 'Makan Sehat dan Bergizi', desc: 'Konsumsi makanan bergizi seimbang' },
            { id: 'gemar_belajar', icon: '📚', title: 'Gemar Belajar', desc: 'Belajar mandiri di luar jam sekolah' },
            { id: 'bermasyarakat', icon: '🤝', title: 'Bermasyarakat', desc: 'Berinteraksi positif dengan lingkungan' },
            { id: 'tidur_cepat', icon: '😴', title: 'Tidur Cepat', desc: 'Tidur sebelum jam 22:00' }
        ];

        const today = new Date().toISOString().split('T')[0];

        return `
            <!-- Kebiasaan Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                ${kebiasaanList.map(kebiasaan => {
                    const todayData = data.filter(d => 
                        d.date === today && 
                        d.kebiasaan_type === kebiasaan.id
                    );
                    const count = todayData.length;
                    
                    return `
                        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between mb-3">
                                <div class="text-3xl">${kebiasaan.icon}</div>
                                <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                    ${count} siswa
                                </span>
                            </div>
                            <h4 class="font-semibold text-gray-900 mb-1">${kebiasaan.title}</h4>
                            <p class="text-sm text-gray-600 mb-3">${kebiasaan.desc}</p>
                            ${AuthService.currentUser.role === 'guru' || AuthService.currentUser.role === 'admin' || AuthService.currentUser.role === 'bk' ? `
                                <button onclick="UIService.showAddForm('kebiasaan')" 
                                        class="w-full bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700 transition-colors">
                                    Input Data
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Data Table -->
            <div>
                <h4 class="text-lg font-semibold text-gray-900 mb-4">Riwayat Data Kebiasaan</h4>
                ${this.renderDataTable(data, 'kebiasaan')}
            </div>
        `;
    },

    /**
     * Render Guru Wali page
     */
    renderGuruWali() {
        return `
            <div class="space-y-6">
                <!-- Navigation Tabs -->
                <div class="bg-white rounded-lg shadow">
                    <div class="border-b border-gray-200">
                        <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                            <button onclick="UIService.showWaliTab('data')" id="tabWaliData" 
                                    class="wali-tab border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                                👨‍🎓 Daftar Siswa
                            </button>
                            <button onclick="UIService.showWaliTab('absensi')" id="tabWaliAbsensi" 
                                    class="wali-tab border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                                📋 Absensi Siswa
                            </button>
                            <button onclick="UIService.showWaliTab('nilai')" id="tabWaliNilai" 
                                    class="wali-tab border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                                📊 Nilai Siswa
                            </button>
                            <button onclick="UIService.showWaliTab('perilaku')" id="tabWaliPerilaku" 
                                    class="wali-tab border-transparent text-gray-500 hover:text-gray-700 hover:border-gray

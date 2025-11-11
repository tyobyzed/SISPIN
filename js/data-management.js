/**
 * Data Management Module
 * Handles CRUD operations, data validation, and business logic
 */

const DataService = {
    // Data storage
    allData: [],
    cache: new Map(),
    cacheTimer: null,

    // Page definitions
    pages: {
        beranda: { title: 'Beranda', icon: '🏠' },
        intra: { title: 'Perencanaan Intra Kurikuler', icon: '📚' },
        kokurikuler: { title: 'Perencanaan Kokurikuler', icon: '🎯' },
        wali: { title: 'Guru Wali', icon: '👨‍🏫' },
        jurnal: { title: 'Jurnal dan Supervisi', icon: '📝' },
        bk: { title: 'Bimbingan Konseling', icon: '💬' },
        manajemen: { title: 'Manajemen Data', icon: '⚙️' },
        persetujuan: { title: 'Persetujuan Data', icon: '✅' }
    },

    /**
     * Initialize data service
     */
    async init() {
        await this.initializeDataSDK();
        this.setupCache();
        this.setupDataHandlers();
    },

    /**
     * Initialize Data SDK
     */
    async initializeDataSDK() {
        if (window.dataSdk) {
            const result = await window.dataSdk.init({
                onDataChanged: (data) => this.handleDataChange(data),
                onError: (error) => this.handleDataError(error)
            });
            
            if (!result.isOk) {
                console.error('Failed to initialize Data SDK');
                NotificationService.show('Gagal menginisialisasi data service', 'error');
            }
        }
    },

    /**
     * Setup data caching
     */
    setupCache() {
        if (!AppConfig.get('performance.cache_enabled')) return;
        
        // Clear expired cache items periodically
        this.cacheTimer = setInterval(() => {
            const now = Date.now();
            const ttl = AppConfig.get('performance.cache_ttl');
            
            for (let [key, value] of this.cache.entries()) {
                if (now - value.timestamp > ttl) {
                    this.cache.delete(key);
                }
            }
        }, 60000); // Check every minute
    },

    /**
     * Setup data handlers
     */
    setupDataHandlers() {
        // Listen for data changes
        window.addEventListener('dataChange', (e) => {
            this.handleDataChange(e.detail);
        });
    },

    /**
     * Handle data changes
     */
    handleDataChange(data) {
        this.allData = data;
        this.updateUsersFromData(data);
        this.invalidateCache();
        
        // Update UI if user is logged in
        if (AuthService.currentUser) {
            UIService.renderCurrentPage();
        }
    },

    /**
     * Handle data errors
     */
    handleDataError(error) {
        console.error('Data error:', error);
        NotificationService.show('Terjadi kesalahan pada data: ' + error.message, 'error');
    },

    /**
     * Update users from data
     */
    updateUsersFromData(data) {
        // Keep default users and add new ones
        const defaultUsers = {
            'admin': { password: 'admin123', role: 'admin', name: 'Administrator' },
            'kepsek': { password: 'kepsek123', role: 'kepsek', name: 'Kepala Sekolah' },
            'guru': { password: 'guru123', role: 'guru', name: 'Guru Matematika' },
            'bk': { password: 'bk123', role: 'bk', name: 'Guru BK' },
            'siswa': { password: 'siswa123', role: 'siswa', name: 'Siswa/Orang Tua' }
        };

        // Start with default users
        Object.assign(AuthService.users, defaultUsers);

        // Add users from guru data
        const guruUsers = data.filter(d => d.type === 'guru' && d.username && d.password);
        guruUsers.forEach(guru => {
            AuthService.users[guru.username] = {
                password: guru.password,
                role: guru.role || 'guru',
                name: guru.title,
                nip: guru.nip,
                mapel: guru.mapel
            };
        });
    },

    /**
     * Get cached data
     */
    getCachedData(key) {
        if (!AppConfig.get('performance.cache_enabled')) return null;
        
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < AppConfig.get('performance.cache_ttl')) {
            return cached.data;
        }
        
        return null;
    },

    /**
     * Set cached data
     */
    setCachedData(key, data) {
        if (!AppConfig.get('performance.cache_enabled')) return;
        
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    },

    /**
     * Invalidate cache
     */
    invalidateCache() {
        this.cache.clear();
    },

    /**
     * Get filtered data with caching
     */
    getFilteredData(type, filters = {}) {
        const cacheKey = `${type}_${JSON.stringify(filters)}`;
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        let filteredData = this.allData.filter(d => d.type === type);
        
        // Apply role-based filtering
        if (AuthService.currentUser) {
            if (AuthService.currentUser.role === 'siswa') {
                filteredData = filteredData.filter(d => d.approved === true);
            } else if (AuthService.currentUser.role === 'guru' || AuthService.currentUser.role === 'bk') {
                filteredData = filteredData.filter(d => d.author === AuthService.currentUser.name);
            }
        }
        
        // Apply additional filters
        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (value !== undefined && value !== '') {
                filteredData = filteredData.filter(item => {
                    if (key.includes('.')) {
                        const keys = key.split('.');
                        let itemValue = item;
                        for (const k of keys) {
                            itemValue = itemValue?.[k];
                        }
                        return itemValue === value;
                    } else {
                        return item[key] === value;
                    }
                });
            }
        });
        
        // Sort by date (newest first)
        filteredData.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
        
        // Cache the result
        this.setCachedData(cacheKey, filteredData);
        
        return filteredData;
    },

    /**
     * Create new data
     */
    async createData(type, data) {
        try {
            // Validate data
            const validation = this.validateData(type, data);
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            // Check data limit
            if (this.allData.length >= AppConfig.get('max_data_items')) {
                throw new Error('Batas maksimum data telah tercapai');
            }
            
            // Prepare data
            const newData = {
                type,
                ...data,
                author: AuthService.currentUser.name,
                createdAt: new Date().toISOString(),
                approved: AuthService.currentUser.role === 'admin' || AuthService.currentUser.role === 'kepsek'
            };
            
            // Create via SDK
            const result = await window.dataSdk.create(newData);
            
            if (result.isOk) {
                this.invalidateCache();
                NotificationService.show('Data berhasil disimpan', 'success');
                return result.data;
            } else {
                throw new Error('Gagal menyimpan data');
            }
        } catch (error) {
            console.error('Create data error:', error);
            NotificationService.show('Error: ' + error.message, 'error');
            throw error;
        }
    },

    /**
     * Update data
     */
    async updateData(id, data) {
        try {
            // Find existing data
            const existingData = this.allData.find(d => d.__backendId === id);
            if (!existingData) {
                throw new Error('Data tidak ditemukan');
            }
            
            // Validate update permissions
            if (!this.canUpdateData(existingData)) {
                throw new Error('Tidak memiliki izin untuk mengupdate data ini');
            }
            
            // Prepare update data
            const updateData = {
                ...existingData,
                ...data,
                updatedAt: new Date().toISOString()
            };
            
            // Update via SDK
            const result = await window.dataSdk.update(updateData);
            
            if (result.isOk) {
                this.invalidateCache();
                NotificationService.show('Data berhasil diupdate', 'success');
                return result.data;
            } else {
                throw new Error('Gagal mengupdate data');
            }
        } catch (error) {
            console.error('Update data error:', error);
            NotificationService.show('Error: ' + error.message, 'error');
            throw error;
        }
    },

    /**
     * Delete data
     */
    async deleteData(id) {
        try {
            // Find existing data
            const existingData = this.allData.find(d => d.__backendId === id);
            if (!existingData) {
                throw new Error('Data tidak ditemukan');
            }
            
            // Validate delete permissions
            if (!this.canDeleteData(existingData)) {
                throw new Error('Tidak memiliki izin untuk menghapus data ini');
            }
            
            // Delete via SDK
            const result = await window.dataSdk.delete(existingData);
            
            if (result.isOk) {
                this.invalidateCache();
                NotificationService.show('Data berhasil dihapus', 'success');
                return true;
            } else {
                throw new Error('Gagal menghapus data');
            }
        } catch (error) {
            console.error('Delete data error:', error);
            NotificationService.show('Error: ' + error.message, 'error');
            throw error;
        }
    },

    /**
     * Validate data based on type
     */
    validateData(type, data) {
        const validators = {
            guru: this.validateGuruData,
            siswa: this.validateSiswaData,
            kelas: this.validateKelasData,
            intra: this.validateIntraData,
            jurnal: this.validateJurnalData,
            absensi: this.validateAbsensiData,
            nilai: this.validateNilaiData,
            perilaku: this.validatePerilakuData,
            bk_absensi: this.validateBKAbsensiData,
            bk_pelanggaran: this.validateBKPelanggaranData
        };
        
        const validator = validators[type];
        if (validator) {
            return validator(data);
        }
        
        // Basic validation for unknown types
        if (!data.title || !data.content) {
            return {
                valid: false,
                message: 'Title dan content wajib diisi'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate guru data
     */
    validateGuruData(data) {
        const required = ['title', 'nip', 'mapel', 'role', 'username', 'password'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate NIP format (18 digits)
        if (!/^\d{18}$/.test(data.nip)) {
            return {
                valid: false,
                message: 'NIP harus 18 digit'
            };
        }
        
        // Validate password
        const passwordValidation = SecurityService.validatePassword(data.password);
        if (!passwordValidation.valid) {
            return passwordValidation;
        }
        
        // Check username uniqueness
        if (AuthService.users[data.username] && AuthService.users[data.username].username !== data.username) {
            return {
                valid: false,
                message: 'Username sudah digunakan'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate siswa data
     */
    validateSiswaData(data) {
        const required = ['title', 'nisn', 'jenis_kelamin', 'class'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate NISN (10 digits)
        if (!/^\d{10}$/.test(data.nisn)) {
            return {
                valid: false,
                message: 'NISN harus 10 digit'
            };
        }
        
        // Validate jenis kelamin
        if (!['L', 'P'].includes(data.jenis_kelamin)) {
            return {
                valid: false,
                message: 'Jenis kelamin harus L atau P'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate kelas data
     */
    validateKelasData(data) {
        const required = ['title', 'tingkat', 'jurusan'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate tingkat
        if (!['X', 'XI', 'XII'].includes(data.tingkat)) {
            return {
                valid: false,
                message: 'Tingkat harus X, XI, atau XII'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate intra data
     */
    validateIntraData(data) {
        const required = ['judul_modul', 'mata_pelajaran', 'kelas', 'fase', 'penulis'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        return { valid: true };
    },

    /**
     * Validate jurnal data
     */
    validateJurnalData(data) {
        const required = ['nama_guru', 'kelas', 'hari', 'tanggal', 'mata_pelajaran', 'materi_pokok'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate time format
        if (data.waktu_mulai && data.waktu_selesai) {
            if (data.waktu_mulai >= data.waktu_selesai) {
                return {
                    valid: false,
                    message: 'Waktu mulai harus sebelum waktu selesai'
                };
            }
        }
        
        return { valid: true };
    },

    /**
     * Validate absensi data
     */
    validateAbsensiData(data) {
        const required = ['student_name', 'class', 'status', 'date'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate status
        const validStatus = ['Hadir', 'Sakit', 'Izin', 'Alpha'];
        if (!validStatus.includes(data.status)) {
            return {
                valid: false,
                message: 'Status tidak valid'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate nilai data
     */
    validateNilaiData(data) {
        const required = ['student_name', 'class', 'mata_pelajaran', 'jenis_penilaian', 'nilai', 'date'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate nilai range
        const nilai = parseFloat(data.nilai);
        if (isNaN(nilai) || nilai < 0 || nilai > 100) {
            return {
                valid: false,
                message: 'Nilai harus antara 0 dan 100'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate perilaku data
     */
    validatePerilakuData(data) {
        const required = ['student_name', 'class', 'jenis_perilaku', 'catatan', 'date'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate jenis perilaku
        const validTypes = ['Positif', 'Negatif', 'Netral'];
        if (!validTypes.includes(data.jenis_perilaku)) {
            return {
                valid: false,
                message: 'Jenis perilaku tidak valid'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate BK absensi data
     */
    validateBKAbsensiData(data) {
        const required = ['student_name', 'class', 'status', 'date', 'waktu'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate status
        const validStatus = ['Hadir', 'Sakit', 'Izin', 'Alpha', 'Terlambat'];
        if (!validStatus.includes(data.status)) {
            return {
                valid: false,
                message: 'Status tidak valid'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate BK pelanggaran data
     */
    validateBKPelanggaranData(data) {
        const required = ['student_name', 'class', 'kategori_pelanggaran', 'jenis_pelanggaran', 'lokasi', 'kronologi', 'tindak_lanjut'];
        
        for (const field of required) {
            if (!data[field]) {
                return {
                    valid: false,
                    message: `${field} wajib diisi`
                };
            }
        }
        
        // Validate kategori
        const validKategori = ['Ringan', 'Sedang', 'Berat'];
        if (!validKategori.includes(data.kategori_pelanggaran)) {
            return {
                valid: false,
                message: 'Kategori pelanggaran tidak valid'
            };
        }
        
        return { valid: true };
    },

    /**
     * Check if user can update data
     */
    canUpdateData(data) {
        if (!AuthService.currentUser) return false;
        
        // Admin can update everything
        if (AuthService.currentUser.role === 'admin') return true;
        
        // Users can only update their own data
        return data.author === AuthService.currentUser.name;
    },

    /**
     * Check if user can delete data
     */
    canDeleteData(data) {
        if (!AuthService.currentUser) return false;
        
        // Admin can delete everything
        if (AuthService.currentUser.role === 'admin') return true;
        
        // Users can only delete their own data
        return data.author === AuthService.currentUser.name;
    },

    /**
     * Get statistics for dashboard
     */
    getStatistics() {
        const stats = {
            intra: this.allData.filter(d => d.type === 'intra').length,
            kokurikuler: this.allData.filter(d => d.type === 'kokurikuler').length,
            jurnal: this.allData.filter(d => d.type === 'jurnal').length,
            siswa: this.allData.filter(d => d.type === 'siswa').length,
            guru: this.allData.filter(d => d.type === 'guru').length,
            absensi: this.allData.filter(d => d.type === 'absensi').length,
            nilai: this.allData.filter(d => d.type === 'nilai').length,
            perilaku: this.allData.filter(d => d.type === 'perilaku').length,
            bk_absensi: this.allData.filter(d => d.type === 'bk_absensi').length,
            bk_pelanggaran: this.allData.filter(d => d.type === 'bk_pelanggaran').length
        };
        
        return stats;
    },

    /**
     * Export data to format
     */
    exportData(type, format = 'json') {
        const data = this.getFilteredData(type);
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            case 'excel':
                return this.convertToExcel(data, type);
            default:
                throw new Error('Format tidak didukung');
        }
    },

    /**
     * Convert data to CSV
     */
    convertToCSV(data) {
        if (!data.length) return '';
        
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row => 
            headers.map(header => {
                const value = row[header] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',')
        );
        
        return [csvHeaders, ...csvRows].join('\n');
    },

    /**
     * Convert data to Excel
     */
    convertToExcel(data, type) {
        if (!window.XLSX) {
            throw new Error('Library XLSX tidak tersedia');
        }
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, type);
        
        return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    }
};

// Export for use in other modules
window.DataService = DataService;

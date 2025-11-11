/**
 * Configuration Management Module
 * Handles application configuration and settings
 */

const AppConfig = {
    // Default configuration
    defaults: {
        app_title: 'SMA Negeri 20 Medan',
        welcome_message: 'Selamat datang di SISPIN',
        footer_text: '© 2024 SISPIN - SMA Negeri 20 Medan',
        primary_color: '#2563eb',
        font_family: 'Inter',
        font_size: 16,
        max_data_items: 999,
        session_timeout: 1800000, // 30 minutes
        enable_notifications: true,
        enable_export: true,
        enable_backup: true,
        security: {
            enable_csrf: true,
            sanitize_input: true,
            encrypt_sensitive: true,
            max_login_attempts: 5,
            password_min_length: 6
        },
        performance: {
            enable_virtual_scrolling: true,
            enable_lazy_loading: true,
            cache_enabled: true,
            cache_ttl: 300000 // 5 minutes
        }
    },

    // Current configuration
    current: {},

    /**
     * Initialize configuration
     */
    init() {
        this.load();
        this.setupEventListeners();
    },

    /**
     * Load configuration from storage or defaults
     */
    load() {
        try {
            const stored = localStorage.getItem('sispin_config');
            this.current = stored ? { ...this.defaults, ...JSON.parse(stored) } : { ...this.defaults };
        } catch (error) {
            console.error('Error loading config:', error);
            this.current = { ...this.defaults };
        }
    },

    /**
     * Save configuration to storage
     */
    save() {
        try {
            localStorage.setItem('sispin_config', JSON.stringify(this.current));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    },

    /**
     * Get configuration value
     */
    get(key) {
        return key.split('.').reduce((obj, i) => obj?.[i], this.current);
    },

    /**
     * Set configuration value
     */
    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, i) => {
            if (!obj[i]) obj[i] = {};
            return obj[i];
        }, this.current);
        
        target[lastKey] = value;
        this.save();
        this.notifyChange(key, value);
    },

    /**
     * Setup event listeners for configuration changes
     */
    setupEventListeners() {
        if (window.elementSdk) {
            window.elementSdk.init({
                defaultConfig: this.defaults,
                onConfigChange: (config) => {
                    Object.keys(config).forEach(key => {
                        this.set(key, config[key]);
                    });
                },
                mapToCapabilities: (config) => ({
                    recolorables: [
                        {
                            get: () => config.primary_color || this.defaults.primary_color,
                            set: (value) => {
                                this.set('primary_color', value);
                                window.elementSdk.setConfig({ primary_color: value });
                            }
                        }
                    ],
                    borderables: [],
                    fontEditable: {
                        get: () => config.font_family || this.defaults.font_family,
                        set: (value) => {
                            this.set('font_family', value);
                            window.elementSdk.setConfig({ font_family: value });
                        }
                    },
                    fontSizeable: {
                        get: () => config.font_size || this.defaults.font_size,
                        set: (value) => {
                            this.set('font_size', value);
                            window.elementSdk.setConfig({ font_size: value });
                        }
                    }
                }),
                mapToEditPanelValues: (config) => new Map([
                    ['app_title', config.app_title || this.defaults.app_title],
                    ['welcome_message', config.welcome_message || this.defaults.welcome_message],
                    ['footer_text', config.footer_text || this.defaults.footer_text]
                ])
            });
        }
    },

    /**
     * Notify listeners of configuration changes
     */
    notifyChange(key, value) {
        window.dispatchEvent(new CustomEvent('configChange', {
            detail: { key, value }
        }));
    },

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.current = { ...this.defaults };
        this.save();
        window.location.reload();
    }
};

// Export for use in other modules
window.AppConfig = AppConfig;

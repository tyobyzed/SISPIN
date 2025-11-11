/**
 * Security Module
 * Handles input sanitization, XSS prevention, and other security measures
 */

const SecurityService = {
    /**
     * Sanitize input to prevent XSS
     */
    sanitizeInput(input) {
        if (!input) return '';
        
        if (typeof input !== 'string') {
            input = String(input);
        }
        
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\//g, '&#x2F;');
    },

    /**
     * Sanitize HTML content
     */
    sanitizeHTML(html) {
        if (!html) return '';
        
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    },

    /**
     * Generate CSRF token
     */
    generateCSRFToken() {
        const array = new Uint32Array(16);
        window.crypto.getRandomValues(array);
        return Array.from(array, dec => dec.toString(16)).join('');
    },

    /**
     * Validate CSRF token
     */
    validateCSRFToken(token) {
        const storedToken = sessionStorage.getItem('csrf_token');
        return token && storedToken && token === storedToken;
    },

    /**
     * Set CSRF token
     */
    setCSRFToken() {
        const token = this.generateCSRFToken();
        sessionStorage.setItem('csrf_token', token);
        
        // Add to all forms
        document.querySelectorAll('form').forEach(form => {
            let csrfInput = form.querySelector('input[name="csrf_token"]');
            if (!csrfInput) {
                csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = 'csrf_token';
                form.appendChild(csrfInput);
            }
            csrfInput.value = token;
        });
    },

    /**
     * Encrypt sensitive data (simple implementation)
     * In production, use proper encryption libraries
     */
    encryptData(data) {
        if (!AppConfig.get('security.encrypt_sensitive')) return data;
        
        try {
            // Simple base64 encoding for demo
            // In production, use proper encryption like AES
            return btoa(encodeURIComponent(JSON.stringify(data)));
        } catch (error) {
            console.error('Encryption error:', error);
            return data;
        }
    },

    /**
     * Decrypt sensitive data
     */
    decryptData(encryptedData) {
        if (!AppConfig.get('security.encrypt_sensitive')) return encryptedData;
        
        try {
            // Simple base64 decoding for demo
            return JSON.parse(decodeURIComponent(atob(encryptedData)));
        } catch (error) {
            console.error('Decryption error:', error);
            return encryptedData;
        }
    },

    /**
     * Validate password strength
     */
    validatePassword(password) {
        const minLength = AppConfig.get('security.password_min_length');
        
        if (password.length < minLength) {
            return {
                valid: false,
                message: `Password minimal ${minLength} karakter`
            };
        }
        
        if (!/[a-z]/.test(password)) {
            return {
                valid: false,
                message: 'Password harus mengandung huruf kecil'
            };
        }
        
        if (!/[A-Z]/.test(password)) {
            return {
                valid: false,
                message: 'Password harus mengandung huruf besar'
            };
        }
        
        if (!/[0-9]/.test(password)) {
            return {
                valid: false,
                message: 'Password harus mengandung angka'
            };
        }
        
        return {
            valid: true,
            message: 'Password kuat'
        };
    },

    /**
     * Rate limiting helper
     */
    RateLimiter: {
        attempts: {},
        
        isAllowed(key, maxAttempts = 5, windowMs = 60000) {
            const now = Date.now();
            const userAttempts = this.attempts[key] || [];
            
            // Remove old attempts
            const validAttempts = userAttempts.filter(time => now - time < windowMs);
            this.attempts[key] = validAttempts;
            
            if (validAttempts.length >= maxAttempts) {
                return false;
            }
            
            validAttempts.push(now);
            return true;
        },
        
        reset(key) {
            delete this.attempts[key];
        }
    },

    /**
     * Content Security Policy helper
     */
    setCSP() {
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
            "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-src 'none'",
            "object-src 'none'"
        ].join('; ');
        
        // In production, set proper CSP headers
        // This is a client-side simulation
        console.log('CSP:', csp);
    },

    /**
     * Initialize security measures
     */
    init() {
        // Set CSP
        this.setCSP();
        
        // Set CSRF token
        if (AppConfig.get('security.enable_csrf')) {
            this.setCSRFToken();
            setInterval(() => this.setCSRFToken(), 300000); // Refresh every 5 minutes
        }
        
        // Add security headers simulation
        this.addSecurityHeaders();
        
        // Setup input sanitization
        this.setupInputSanitization();
    },

    /**
     * Add security headers (client-side simulation)
     */
    addSecurityHeaders() {
        // In production, these should be set server-side
        const securityHeaders = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        };
        
        console.log('Security Headers:', securityHeaders);
    },

    /**
     * Setup input sanitization
     */
    setupInputSanitization() {
        if (!AppConfig.get('security.sanitize_input')) return;
        
        // Sanitize all input fields on blur
        document.addEventListener('blur', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.target.type !== 'password') {
                    e.target.value = this.sanitizeInput(e.target.value);
                }
            }
        }, true);
        
        // Sanitize form data on submit
        document.addEventListener('submit', (e) => {
            const formData = new FormData(e.target);
            const sanitizedData = new FormData();
            
            for (let [key, value] of formData.entries()) {
                if (key !== 'password' && key !== 'csrf_token') {
                    sanitizedData.append(key, this.sanitizeInput(value));
                } else {
                    sanitizedData.append(key, value);
                }
            }
            
            // Store sanitized data for form submission
            e.target._sanitizedData = sanitizedData;
        }, true);
    }
};

// Export for use in other modules
window.SecurityService = SecurityService;

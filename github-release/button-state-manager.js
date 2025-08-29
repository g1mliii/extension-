// ButtonStateManager - iOS 26 Liquid Glass Button State Management System
// Provides visual feedback states (idle, loading, success, error) for all buttons

export class ButtonStateManager {
    constructor() {
        this.states = new Map();
        this.animations = new Map();
        this.originalTexts = new Map();
        this.theme = {
            // iOS 26 Liquid Glass Theme Colors
            accentBlue: '#93C5FD',
            accentSecondary: '#DBEAFE',
            accentTertiary: '#60A5FA',
            glassBackground: 'rgba(30, 41, 59, 0.8)',
            textPrimary: 'rgba(248, 250, 252, 0.95)',
            successColor: '#34D399',
            errorColor: '#F87171',
            warningColor: '#FBBF24',
            backdropFilter: 'blur(40px) saturate(150%) brightness(1.05)'
        };
        
        this.initializeStyles();
    }
    
    initializeStyles() {
        // Inject CSS styles for button states if not already present
        if (!document.getElementById('button-state-manager-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'button-state-manager-styles';
            styleSheet.textContent = this.getButtonStateStyles();
            document.head.appendChild(styleSheet);
        }
    }
    
    getButtonStateStyles() {
        return `
            /* iOS 26 Liquid Glass Button State Styles */
            .btn-state-managed {
                position: relative;
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                will-change: transform, box-shadow, background;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
                font-weight: 600;
                border-radius: 12px;
                backdrop-filter: ${this.theme.backdropFilter};
                -webkit-backdrop-filter: ${this.theme.backdropFilter};
                box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3);
            }
            
            .btn-state-managed::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1;
            }
            
            .btn-state-managed:hover::before {
                left: 100%;
            }
            
            .btn-state-managed .btn-content {
                position: relative;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            /* Loading State */
            .btn-loading {
                background: ${this.theme.glassBackground} !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                color: ${this.theme.textPrimary} !important;
                cursor: not-allowed !important;
                pointer-events: none;
            }
            
            .btn-loading:hover {
                transform: none !important;
                box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3) !important;
            }
            
            /* Success State */
            .btn-success {
                background: ${this.theme.successColor} !important;
                border: 1px solid ${this.theme.successColor} !important;
                color: white !important;
                box-shadow: 
                    inset 0 1px 2px rgba(255, 255, 255, 0.3),
                    0 4px 16px rgba(52, 211, 153, 0.3) !important;
            }
            
            .btn-success:hover {
                box-shadow: 
                    inset 0 1px 2px rgba(255, 255, 255, 0.4),
                    0 6px 20px rgba(52, 211, 153, 0.4) !important;
            }
            
            /* Error State */
            .btn-error {
                background: ${this.theme.errorColor} !important;
                border: 1px solid ${this.theme.errorColor} !important;
                color: white !important;
                box-shadow: 
                    inset 0 1px 2px rgba(255, 255, 255, 0.3),
                    0 4px 16px rgba(248, 113, 113, 0.3) !important;
            }
            
            .btn-error:hover {
                box-shadow: 
                    inset 0 1px 2px rgba(255, 255, 255, 0.4),
                    0 6px 20px rgba(248, 113, 113, 0.4) !important;
            }
            
            /* Idle State */
            .btn-idle {
                background: ${this.theme.accentBlue} !important;
                border: 1px solid ${this.theme.accentBlue} !important;
                color: rgba(30, 58, 138, 0.9) !important;
                box-shadow: 
                    inset 0 1px 2px rgba(255, 255, 255, 0.3),
                    0 4px 16px rgba(147, 197, 253, 0.3) !important;
            }
            
            .btn-idle:hover {
                background: ${this.theme.accentSecondary} !important;
                border-color: ${this.theme.accentTertiary} !important;
                transform: translateY(-1px) scale(1.02) !important;
                box-shadow: 
                    inset 0 1px 2px rgba(255, 255, 255, 0.4),
                    0 6px 20px rgba(147, 197, 253, 0.4) !important;
            }
            
            .btn-idle:active {
                transform: translateY(0) scale(0.98) !important;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            
            /* Loading Spinner */
            .liquid-spinner {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: rgba(255, 255, 255, 0.8);
                animation: liquidSpin 1s ease-in-out infinite;
            }
            
            @keyframes liquidSpin {
                to { transform: rotate(360deg); }
            }
            
            /* Success Checkmark */
            .liquid-checkmark {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                font-size: 10px;
                font-weight: 900;
                animation: liquidCheckmarkPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            @keyframes liquidCheckmarkPop {
                0% { transform: scale(0); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
            
            /* Error X */
            .liquid-error {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                font-size: 10px;
                font-weight: 900;
                animation: liquidErrorShake 0.5s ease-in-out;
            }
            
            @keyframes liquidErrorShake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-2px); }
                75% { transform: translateX(2px); }
            }
            
            /* Warning Icon */
            .liquid-warning {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                font-size: 10px;
                font-weight: 900;
                animation: liquidWarningPulse 1s ease-in-out infinite;
            }
            
            @keyframes liquidWarningPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        `;
    }
    
    /**
     * Set button state with visual feedback
     * @param {string|HTMLElement} buttonSelector - Button ID, class, or element
     * @param {string} state - 'idle', 'loading', 'success', 'error', 'warning'
     * @param {Object} options - Configuration options
     */
    setState(buttonSelector, state, options = {}) {
        try {
            const button = typeof buttonSelector === 'string' 
                ? document.querySelector(buttonSelector) 
                : buttonSelector;
                
            if (!button) {
                console.warn('ButtonStateManager: Button not found:', buttonSelector);
                return;
            }
        
        const buttonId = button.id || button.className || 'unknown';
        const previousState = this.states.get(buttonId);
        
        // Store original text if not already stored
        if (!this.originalTexts.has(buttonId)) {
            this.originalTexts.set(buttonId, button.textContent.trim());
        }
        
        // Add state management class if not present
        if (!button.classList.contains('btn-state-managed')) {
            button.classList.add('btn-state-managed');
        }
        
        // Wrap content if not already wrapped
        if (!button.querySelector('.btn-content')) {
            const content = button.innerHTML;
            button.innerHTML = `<span class="btn-content">${content}</span>`;
        }
        
        const contentSpan = button.querySelector('.btn-content');
        
        // Apply state styling and content
        this.applyStateStyles(button, contentSpan, state, options);
        
        // Handle smooth animations
        if (options.animate !== false) {
            this.animateStateChange(button, previousState, state);
        }
        
        // Auto-reset after duration
        if (options.duration && state !== 'idle') {
            setTimeout(() => {
                this.setState(button, 'idle', { animate: true });
            }, options.duration);
        }
        
            this.states.set(buttonId, state);
            
        } catch (error) {
            console.error('ButtonStateManager: Error in setState:', error);
            
            // Report error to error handler if available
            if (window.errorHandler) {
                window.errorHandler.handleComponentError('button-state-manager', error, {
                    buttonSelector,
                    state,
                    options,
                    context: 'setState method'
                });
            }
            
            // Fallback: basic button state without styling
            try {
                const button = typeof buttonSelector === 'string' 
                    ? document.querySelector(buttonSelector) 
                    : buttonSelector;
                    
                if (button) {
                    if (state === 'loading') {
                        button.disabled = true;
                        button.textContent = options.loadingText || 'Loading...';
                    } else if (state === 'idle') {
                        button.disabled = false;
                        button.textContent = options.idleText || button.dataset.originalText || 'Submit';
                    }
                }
            } catch (fallbackError) {
                console.error('ButtonStateManager: Fallback also failed:', fallbackError);
            }
        }
    }
    
    applyStateStyles(button, contentSpan, state, options) {
        // Remove all state classes
        button.classList.remove('btn-loading', 'btn-success', 'btn-error', 'btn-idle', 'btn-warning');
        
        // Apply new state class
        button.classList.add(`btn-${state}`);
        
        const buttonId = button.id || button.className || 'unknown';
        const originalText = this.originalTexts.get(buttonId) || button.textContent;
        
        // Update button content based on state
        switch (state) {
            case 'loading':
                contentSpan.innerHTML = `<span class="liquid-spinner"></span> ${options.loadingText || 'Loading...'}`;
                button.disabled = true;
                break;
                
            case 'success':
                contentSpan.innerHTML = `<span class="liquid-checkmark">✓</span> ${options.successText || 'Success!'}`;
                button.disabled = false;
                break;
                
            case 'error':
                contentSpan.innerHTML = `<span class="liquid-error">✗</span> ${options.errorText || 'Error'}`;
                button.disabled = false;
                break;
                
            case 'warning':
                contentSpan.innerHTML = `<span class="liquid-warning">⚠</span> ${options.warningText || 'Warning'}`;
                button.disabled = false;
                break;
                
            case 'idle':
            default:
                contentSpan.innerHTML = options.idleText || originalText;
                button.disabled = false;
                break;
        }
    }
    
    animateStateChange(button, previousState, newState) {
        // Clear any existing animation
        const buttonId = button.id || button.className || 'unknown';
        if (this.animations.has(buttonId)) {
            clearTimeout(this.animations.get(buttonId));
        }
        
        // iOS-style smooth transitions with scale effect
        button.style.transform = 'scale(0.95)';
        
        const animationId = setTimeout(() => {
            button.style.transform = '';
            
            // Add subtle glow effect for success/error states
            if (newState === 'success' || newState === 'error') {
                button.style.filter = 'brightness(1.1)';
                setTimeout(() => {
                    button.style.filter = '';
                }, 200);
            }
            
            this.animations.delete(buttonId);
        }, 100);
        
        this.animations.set(buttonId, animationId);
    }
    
    /**
     * Get current state of a button
     * @param {string|HTMLElement} buttonSelector - Button ID, class, or element
     * @returns {string} Current state
     */
    getState(buttonSelector) {
        const button = typeof buttonSelector === 'string' 
            ? document.querySelector(buttonSelector) 
            : buttonSelector;
            
        if (!button) return null;
        
        const buttonId = button.id || button.className || 'unknown';
        return this.states.get(buttonId) || 'idle';
    }
    
    /**
     * Reset button to idle state
     * @param {string|HTMLElement} buttonSelector - Button ID, class, or element
     */
    reset(buttonSelector) {
        this.setState(buttonSelector, 'idle', { animate: true });
    }
    
    /**
     * Reset all managed buttons to idle state
     */
    resetAll() {
        const managedButtons = document.querySelectorAll('.btn-state-managed');
        managedButtons.forEach(button => {
            this.reset(button);
        });
    }
    
    /**
     * Initialize button with state management
     * @param {string|HTMLElement} buttonSelector - Button ID, class, or element
     * @param {Object} options - Initial configuration
     */
    initializeButton(buttonSelector, options = {}) {
        const button = typeof buttonSelector === 'string' 
            ? document.querySelector(buttonSelector) 
            : buttonSelector;
            
        if (!button) {
            console.warn('ButtonStateManager: Button not found for initialization:', buttonSelector);
            return;
        }
        
        // Set initial state
        this.setState(button, 'idle', { animate: false, ...options });
        
        // Add hover effects if not disabled
        if (!options.disableHover) {
            button.addEventListener('mouseenter', () => {
                if (this.getState(button) === 'idle') {
                    button.style.transform = 'translateY(-1px) scale(1.02)';
                }
            });
            
            button.addEventListener('mouseleave', () => {
                if (this.getState(button) === 'idle') {
                    button.style.transform = '';
                }
            });
        }
    }
    
    /**
     * Cleanup method to remove all state management
     */
    cleanup() {
        // Clear all animations
        this.animations.forEach(animationId => clearTimeout(animationId));
        this.animations.clear();
        
        // Reset all buttons
        this.resetAll();
        
        // Clear state tracking
        this.states.clear();
        this.originalTexts.clear();
        
        // Remove injected styles
        const styleSheet = document.getElementById('button-state-manager-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
    }
}

// Create and export singleton instance
export const buttonStateManager = new ButtonStateManager();

// Auto-initialize on DOM content loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('ButtonStateManager: Initialized');
    });
} else {
    console.log('ButtonStateManager: Initialized');
}
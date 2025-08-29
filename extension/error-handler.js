// ErrorHandler - Comprehensive Error Handling and Graceful Degradation System
// Provides fallback strategies for all UI components and ensures extension remains functional

export class ErrorHandler {
    constructor() {
        this.errors = new Map();
        this.fallbackStates = new Map();
        this.componentStates = new Map();
        this.errorThresholds = {
            component: 3, // Max errors per component before fallback
            global: 10,   // Max global errors before emergency mode
            timeWindow: 300000 // 5 minutes
        };

        this.fallbackStrategies = {
            'button-state-manager': this.buttonStateManagerFallback.bind(this),
            'notification-manager': this.notificationManagerFallback.bind(this),
            'trust-score-tooltip': this.trustScoreTooltipFallback.bind(this),
            'compact-rating-manager': this.compactRatingManagerFallback.bind(this),
            'compact-popup': this.compactPopupFallback.bind(this),
            'local-score-calculator': this.localScoreCalculatorFallback.bind(this),
            'warning-indicator-system': this.warningIndicatorSystemFallback.bind(this),
            'affiliate-manager': this.affiliateManagerFallback.bind(this)
        };

        this.isEmergencyMode = false;
        this.initializeErrorHandling();
    }

    initializeErrorHandling() {
        // Global error handlers
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, event.filename, event.lineno);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handlePromiseRejection(event.reason);
        });

        // Component initialization monitoring
        this.monitorComponentInitialization();

        console.log('ErrorHandler: Comprehensive error handling initialized');
    }

    /**
     * Handle component errors with fallback strategies
     * @param {string} componentName - Name of the component
     * @param {Error} error - The error that occurred
     * @param {Object} context - Additional context about the error
     */
    handleComponentError(componentName, error, context = {}) {
        const errorKey = `${componentName}_${Date.now()}`;
        const errorInfo = {
            component: componentName,
            error: error,
            context: context,
            timestamp: Date.now(),
            stack: error.stack
        };

        this.errors.set(errorKey, errorInfo);

        // Check if component has exceeded error threshold
        const componentErrors = this.getComponentErrors(componentName);

        if (componentErrors.length >= this.errorThresholds.component) {
            console.warn(`ErrorHandler: Component ${componentName} exceeded error threshold, activating fallback`);
            this.activateFallback(componentName, error);
        }

        // Check global error threshold
        if (this.errors.size >= this.errorThresholds.global) {
            this.activateEmergencyMode();
        }

        // Log error for debugging
        console.error(`ErrorHandler: Component error in ${componentName}:`, error, context);

        // Clean up old errors
        this.cleanupOldErrors();
    }

    /**
     * Activate fallback strategy for a component
     * @param {string} componentName - Name of the component
     * @param {Error} error - The error that triggered fallback
     */
    activateFallback(componentName, error) {
        if (this.fallbackStates.has(componentName)) {
            console.log(`ErrorHandler: Fallback already active for ${componentName}`);
            return;
        }

        const fallbackStrategy = this.fallbackStrategies[componentName];
        if (fallbackStrategy) {
            try {
                const fallbackResult = fallbackStrategy(error);
                this.fallbackStates.set(componentName, {
                    active: true,
                    strategy: fallbackResult,
                    activatedAt: Date.now(),
                    originalError: error
                });

                console.log(`ErrorHandler: Fallback activated for ${componentName}`);
                this.showUserFriendlyError(componentName, error);

            } catch (fallbackError) {
                console.error(`ErrorHandler: Fallback strategy failed for ${componentName}:`, fallbackError);
                this.activateEmergencyMode();
            }
        } else {
            console.warn(`ErrorHandler: No fallback strategy defined for ${componentName}`);
        }
    }

    /**
     * Button State Manager Fallback Strategy
     */
    buttonStateManagerFallback(error) {
        console.log('ErrorHandler: Activating ButtonStateManager fallback');

        // Create minimal button state management
        const fallbackButtonManager = {
            setState: (buttonSelector, state, options = {}) => {
                try {
                    const button = typeof buttonSelector === 'string'
                        ? document.querySelector(buttonSelector)
                        : buttonSelector;

                    if (!button) return;

                    // Simple state management without advanced styling
                    switch (state) {
                        case 'loading':
                            button.disabled = true;
                            button.textContent = options.loadingText || 'Loading...';
                            button.style.opacity = '0.7';
                            break;
                        case 'success':
                            button.disabled = false;
                            button.textContent = options.successText || 'Success!';
                            button.style.backgroundColor = '#34D399';
                            button.style.color = 'white';
                            break;
                        case 'error':
                            button.disabled = false;
                            button.textContent = options.errorText || 'Error';
                            button.style.backgroundColor = '#F87171';
                            button.style.color = 'white';
                            break;
                        case 'idle':
                        default:
                            button.disabled = false;
                            button.textContent = options.idleText || button.dataset.originalText || 'Submit';
                            button.style.opacity = '1';
                            button.style.backgroundColor = '';
                            button.style.color = '';
                            break;
                    }

                    // Auto-reset after duration
                    if (options.duration && state !== 'idle') {
                        setTimeout(() => {
                            fallbackButtonManager.setState(button, 'idle');
                        }, options.duration);
                    }

                } catch (fallbackError) {
                    console.error('ErrorHandler: ButtonStateManager fallback error:', fallbackError);
                }
            },

            reset: (buttonSelector) => {
                fallbackButtonManager.setState(buttonSelector, 'idle');
            }
        };

        // Replace global buttonStateManager
        if (window.buttonStateManager) {
            window.buttonStateManager = fallbackButtonManager;
        }

        return fallbackButtonManager;
    }

    /**
     * Notification Manager Fallback Strategy
     */
    notificationManagerFallback(error) {
        console.log('ErrorHandler: Activating NotificationManager fallback');

        // Create minimal notification system using browser alerts as last resort
        const fallbackNotificationManager = {
            show: (text, type = 'info', options = {}) => {
                try {
                    // Try to use existing message bar first
                    const messageBar = document.getElementById('message-bar');
                    const messageContent = document.getElementById('message-content');

                    if (messageBar && messageContent) {
                        messageContent.textContent = text;
                        messageBar.className = `message-bar show ${type}`;

                        // Simple auto-hide
                        setTimeout(() => {
                            messageBar.className = 'message-bar hidden';
                        }, options.duration || 3000);

                        return 'fallback_notification';
                    } else {
                        // Last resort: console log and browser alert for critical errors
                        console.log(`${type.toUpperCase()}: ${text}`);
                        if (type === 'error') {
                            alert(`Error: ${text}`);
                        }
                        return null;
                    }
                } catch (fallbackError) {
                    console.error('ErrorHandler: NotificationManager fallback error:', fallbackError);
                    console.log(`FALLBACK MESSAGE (${type}): ${text}`);
                    return null;
                }
            },

            hideNotification: () => {
                try {
                    const messageBar = document.getElementById('message-bar');
                    if (messageBar) {
                        messageBar.className = 'message-bar hidden';
                    }
                } catch (fallbackError) {
                    console.error('ErrorHandler: NotificationManager hide fallback error:', fallbackError);
                }
            }
        };

        // Replace global notificationManager
        if (window.notificationManager) {
            window.notificationManager = fallbackNotificationManager;
        }

        return fallbackNotificationManager;
    }

    /**
     * Trust Score Tooltip Fallback Strategy
     */
    trustScoreTooltipFallback(error) {
        console.log('ErrorHandler: Activating TrustScoreTooltip fallback');

        const fallbackTooltip = {
            show: () => {
                try {
                    // Simple alert with trust score explanation
                    const explanation = `Trust Score Explanation:
                    
• Domain Security (40%): SSL certificates, domain age, security scans
• Community Ratings (60%): User ratings, reports, and feedback

Score Ranges:
• 75%+ Excellent - Highly trusted
• 50%+ Good - Generally trustworthy  
• 25%+ Fair - Exercise caution
• <25% Poor - Be very cautious`;

                    alert(explanation);
                } catch (fallbackError) {
                    console.error('ErrorHandler: TrustScoreTooltip fallback error:', fallbackError);
                }
            },

            hide: () => {
                // No-op for fallback
            },

            updateScore: (score, data) => {
                // Store for potential use
                this.lastKnownScore = score;
                this.lastKnownData = data;
            }
        };

        return fallbackTooltip;
    }

    /**
     * Compact Rating Manager Fallback Strategy
     */
    compactRatingManagerFallback(error) {
        console.log('ErrorHandler: Activating CompactRatingManager fallback');

        const fallbackRatingManager = {
            init: () => {
                try {
                    // Enable basic form elements
                    const ratingSelect = document.getElementById('rating-score');
                    const submitButton = document.getElementById('submit-rating-btn');

                    if (ratingSelect) ratingSelect.style.display = 'block';
                    if (submitButton) {
                        submitButton.style.display = 'block';
                        submitButton.textContent = 'Submit Rating';
                    }

                    // Hide compact interface if it's causing issues
                    const compactInterface = document.querySelector('.ultra-compact-rating');
                    if (compactInterface) {
                        compactInterface.style.display = 'none';
                    }

                    // Show basic rating section
                    const ratingSection = document.getElementById('rating-section');
                    if (ratingSection) {
                        ratingSection.style.display = 'block';
                    }

                } catch (fallbackError) {
                    console.error('ErrorHandler: CompactRatingManager fallback error:', fallbackError);
                }
            },

            reset: () => {
                try {
                    const ratingSelect = document.getElementById('rating-score');
                    const checkboxes = ['is-spam', 'is-misleading', 'is-scam'];

                    if (ratingSelect) ratingSelect.value = '';
                    checkboxes.forEach(id => {
                        const checkbox = document.getElementById(id);
                        if (checkbox) checkbox.checked = false;
                    });
                } catch (fallbackError) {
                    console.error('ErrorHandler: CompactRatingManager reset fallback error:', fallbackError);
                }
            },

            onTrustScoreUpdate: (score, data) => {
                // Store for potential use
                this.lastKnownScore = score;
            }
        };

        // Initialize fallback
        fallbackRatingManager.init();

        return fallbackRatingManager;
    }

    /**
     * Compact Popup Fallback Strategy
     */
    compactPopupFallback(error) {
        console.log('ErrorHandler: Activating CompactPopup fallback');

        const fallbackPopup = {
            initialize: () => {
                try {
                    // Ensure popup works in standard mode
                    const popup = document.body;
                    if (popup) {
                        popup.style.minWidth = '350px';
                        popup.style.minHeight = '400px';
                    }

                    // Disable compact mode features that might be causing issues
                    console.log('ErrorHandler: Compact popup disabled, using standard mode');

                } catch (fallbackError) {
                    console.error('ErrorHandler: CompactPopup fallback error:', fallbackError);
                }
            }
        };

        fallbackPopup.initialize();
        return fallbackPopup;
    }

    /**
       * Local Score Calculator Fallback Strategy
       */
    localScoreCalculatorFallback(error) {
        console.log('ErrorHandler: Activating LocalScoreCalculator fallback');

        const fallbackCalculator = {
            calculateRatingImpact: (rating, flags) => {
                try {
                    // Simple calculation without complex logic
                    const baseScore = (rating - 1) * 25; // 1=0, 2=25, 3=50, 4=75, 5=100
                    let penalties = 0;

                    if (flags.spam) penalties += 30;
                    if (flags.misleading) penalties += 25;
                    if (flags.scam) penalties += 40;

                    const effectiveScore = Math.max(0, baseScore - penalties);
                    const currentScore = this.lastKnownScore || 50;
                    const newScore = Math.max(0, Math.min(100, currentScore + (effectiveScore - 50) * 0.1));

                    return {
                        currentTrustScore: currentScore,
                        newTrustScore: newScore,
                        impact: newScore - currentScore,
                        effectiveRating: effectiveScore,
                        newRatingCount: 1
                    };
                } catch (fallbackError) {
                    console.error('ErrorHandler: LocalScoreCalculator fallback error:', fallbackError);
                    return {
                        currentTrustScore: 50,
                        newTrustScore: 50,
                        impact: 0,
                        effectiveRating: 50,
                        newRatingCount: 1
                    };
                }
            },

            updateCurrentScore: (score, data) => {
                this.lastKnownScore = score;
            },

            formatImpact: (impact) => {
                const value = impact.impact || 0;
                return value >= 0 ? `+${value.toFixed(0)}` : value.toFixed(0);
            }
        };

        return fallbackCalculator;
    }

    /**
     * Warning Indicator System Fallback Strategy
     */
    warningIndicatorSystemFallback(error) {
        console.log('ErrorHandler: Activating WarningIndicatorSystem fallback');

        const fallbackWarningSystem = {
            updateWarnings: (trustScore, data) => {
                try {
                    // Simple text-based warnings
                    let warningText = '';

                    if (trustScore < 25) {
                        warningText = '⚠️ Low Trust Score';
                    } else if (data.spam_reports_count > 5) {
                        warningText = '🚫 High Spam Reports';
                    } else if (data.scam_reports_count > 2) {
                        warningText = '🚨 Scam Reports';
                    }

                    // Display warning in URL box if needed
                    if (warningText) {
                        const urlBox = document.querySelector('.url-display-box');
                        if (urlBox && !urlBox.querySelector('.fallback-warning')) {
                            const warningElement = document.createElement('div');
                            warningElement.className = 'fallback-warning';
                            warningElement.textContent = warningText;
                            warningElement.style.cssText = `
                                color: #F87171;
                                font-size: 12px;
                                margin-top: 4px;
                                text-align: center;
                            `;
                            urlBox.appendChild(warningElement);
                        }
                    }

                } catch (fallbackError) {
                    console.error('ErrorHandler: WarningIndicatorSystem fallback error:', fallbackError);
                }
            }
        };

        return fallbackWarningSystem;
    }

    /**
     * Affiliate Manager Fallback Strategy
     */
    affiliateManagerFallback(error) {
        console.log('ErrorHandler: Activating AffiliateManager fallback');

        const fallbackAffiliateManager = {
            initialize: () => {
                try {
                    // Hide affiliate section if it's causing issues
                    const affiliateSection = document.querySelector('.affiliate-section');
                    if (affiliateSection) {
                        affiliateSection.style.display = 'none';
                    }

                    console.log('ErrorHandler: Affiliate section disabled due to errors');

                } catch (fallbackError) {
                    console.error('ErrorHandler: AffiliateManager fallback error:', fallbackError);
                }
            }
        };

        fallbackAffiliateManager.initialize();
        return fallbackAffiliateManager;
    }

    /**
     * Show user-friendly error messages with liquid glass styling
     */
    showUserFriendlyError(componentName, error) {
        try {
            const userMessages = {
                'button-state-manager': 'Button animations disabled for better performance',
                'notification-manager': 'Using simplified notifications',
                'trust-score-tooltip': 'Trust score help available via simple dialog',
                'compact-rating-manager': 'Using standard rating interface',
                'compact-popup': 'Using standard popup mode',
                'local-score-calculator': 'Using simplified score calculations',
                'warning-indicator-system': 'Using basic warning display',
                'affiliate-manager': 'Affiliate links temporarily disabled'
            };

            const message = userMessages[componentName] || 'Some features temporarily simplified';

            // Try to show via notification manager (might be fallback version)
            if (window.notificationManager) {
                window.notificationManager.show(message, 'warning', { duration: 5000 });
            } else {
                // Last resort: console log
                console.warn(`User Notice: ${message}`);
            }

        } catch (displayError) {
            console.error('ErrorHandler: Failed to show user-friendly error:', displayError);
        }
    }

    /**
     * Activate emergency mode when too many errors occur
     */
    activateEmergencyMode() {
        if (this.isEmergencyMode) return;

        this.isEmergencyMode = true;
        console.error('ErrorHandler: Emergency mode activated - too many errors detected');

        try {
            // Disable all advanced features and use basic functionality only
            this.disableAdvancedFeatures();

            // Show emergency notification
            const emergencyMessage = 'Extension running in safe mode due to errors. Basic functionality available.';

            if (window.notificationManager) {
                window.notificationManager.show(emergencyMessage, 'error', { persistent: true });
            } else {
                alert(emergencyMessage);
            }

            // Log emergency state
            console.error('ErrorHandler: Emergency mode details:', {
                totalErrors: this.errors.size,
                activeFallbacks: Array.from(this.fallbackStates.keys()),
                timestamp: new Date().toISOString()
            });

        } catch (emergencyError) {
            console.error('ErrorHandler: Emergency mode activation failed:', emergencyError);
        }
    }

    /**
     * Disable advanced features in emergency mode
     */
    disableAdvancedFeatures() {
        try {
            // Hide complex UI elements
            const elementsToHide = [
                '.ultra-compact-rating',
                '.trust-score-tooltip',
                '.notification-enhanced',
                '.affiliate-section'
            ];

            elementsToHide.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.display = 'none';
                });
            });

            // Show basic elements
            const basicElements = [
                '#rating-score',
                '#submit-rating-btn',
                '#is-spam',
                '#is-misleading',
                '#is-scam'
            ];

            basicElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.style.display = 'block';
                }
            });

            // Simplify popup styling
            document.body.style.background = '#1e293b';
            document.body.style.color = '#f8fafc';

            console.log('ErrorHandler: Advanced features disabled, basic mode active');

        } catch (disableError) {
            console.error('ErrorHandler: Failed to disable advanced features:', disableError);
        }
    }

    /**
     * Monitor component initialization and detect failures
     */
    monitorComponentInitialization() {
        // Check if components are properly initialized after DOM load
        const checkComponents = () => {
            const expectedComponents = [
                { name: 'buttonStateManager', global: 'buttonStateManager' },
                { name: 'notificationManager', global: 'notificationManager' },
                { name: 'trustScoreTooltip', global: 'trustScoreTooltip' },
                { name: 'compactRatingManager', global: 'compactRatingManager' },
                { name: 'localScoreCalculator', global: 'localScoreCalculator' }
            ];

            expectedComponents.forEach(component => {
                if (!window[component.global]) {
                    console.warn(`ErrorHandler: Component ${component.name} not found globally`);
                    this.handleComponentError(component.name, new Error('Component not initialized'), {
                        type: 'initialization_failure',
                        expected: component.global
                    });
                }
            });
        };

        // Check after DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(checkComponents, 1000); // Give components time to initialize
            });
        } else {
            setTimeout(checkComponents, 1000);
        }
    }

    /**
     * Handle global JavaScript errors
     */
    handleGlobalError(error, filename, lineno) {
        const errorInfo = {
            type: 'global_error',
            error: error,
            filename: filename,
            lineno: lineno,
            timestamp: Date.now()
        };

        // Try to identify which component caused the error
        let componentName = 'unknown';
        if (filename) {
            if (filename.includes('button-state-manager')) componentName = 'button-state-manager';
            else if (filename.includes('notification-manager')) componentName = 'notification-manager';
            else if (filename.includes('trust-score-tooltip')) componentName = 'trust-score-tooltip';
            else if (filename.includes('compact-rating-manager')) componentName = 'compact-rating-manager';
            else if (filename.includes('popup.js')) componentName = 'main-popup';
        }

        this.handleComponentError(componentName, error, errorInfo);
    }

    /**
     * Handle unhandled promise rejections
     */
    handlePromiseRejection(reason) {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        this.handleComponentError('promise-rejection', error, {
            type: 'unhandled_promise_rejection',
            reason: reason
        });
    }

    /**
     * Get errors for a specific component
     */
    getComponentErrors(componentName) {
        const now = Date.now();
        const timeWindow = this.errorThresholds.timeWindow;

        return Array.from(this.errors.values()).filter(errorInfo =>
            errorInfo.component === componentName &&
            (now - errorInfo.timestamp) < timeWindow
        );
    }

    /**
     * Clean up old errors outside the time window
     */
    cleanupOldErrors() {
        const now = Date.now();
        const timeWindow = this.errorThresholds.timeWindow;

        for (const [key, errorInfo] of this.errors.entries()) {
            if ((now - errorInfo.timestamp) > timeWindow) {
                this.errors.delete(key);
            }
        }
    }

    /**
     * Get current error status
     */
    getErrorStatus() {
        return {
            totalErrors: this.errors.size,
            activeFallbacks: Array.from(this.fallbackStates.keys()),
            isEmergencyMode: this.isEmergencyMode,
            componentStates: Object.fromEntries(this.componentStates),
            recentErrors: Array.from(this.errors.values()).slice(-5)
        };
    }

    /**
     * Test error scenarios for development
     */
    testErrorScenarios() {
        if (process.env.NODE_ENV !== 'development') return;

        console.log('ErrorHandler: Testing error scenarios...');

        // Test component error
        this.handleComponentError('test-component', new Error('Test error'), { test: true });

        // Test fallback activation
        this.activateFallback('button-state-manager', new Error('Test fallback'));

        console.log('ErrorHandler: Test completed, status:', this.getErrorStatus());
    }

    /**
     * Recovery method to attempt to restore normal operation
     */
    attemptRecovery() {
        console.log('ErrorHandler: Attempting recovery...');

        try {
            // Clear old errors
            this.cleanupOldErrors();

            // Reset emergency mode if error count is low
            if (this.errors.size < this.errorThresholds.global / 2) {
                this.isEmergencyMode = false;
                console.log('ErrorHandler: Emergency mode deactivated');
            }

            // Try to reinitialize failed components
            for (const [componentName, fallbackState] of this.fallbackStates.entries()) {
                if (Date.now() - fallbackState.activatedAt > 60000) { // 1 minute
                    console.log(`ErrorHandler: Attempting to recover ${componentName}`);
                    // Component-specific recovery logic could be added here
                }
            }

        } catch (recoveryError) {
            console.error('ErrorHandler: Recovery attempt failed:', recoveryError);
        }
    }

    /**
     * Cleanup method
     */
    cleanup() {
        this.errors.clear();
        this.fallbackStates.clear();
        this.componentStates.clear();
        this.isEmergencyMode = false;

        console.log('ErrorHandler: Cleanup completed');
    }
}

// Create and export singleton instance
export const errorHandler = new ErrorHandler();

// Make available globally for debugging and component access
window.errorHandler = errorHandler;

// Auto-initialize on DOM content loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('ErrorHandler: Comprehensive error handling system ready');
    });
} else {
    console.log('ErrorHandler: Comprehensive error handling system ready');
}

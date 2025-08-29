// NotificationManager - Enhanced iOS 26 Liquid Glass Notification System
// Enhances the existing message bar with advanced features and better management

export class NotificationManager {
    constructor() {
        this.activeNotifications = new Map();
        this.notificationQueue = [];
        this.isProcessingQueue = false;
        this.defaultDurations = {
            info: 3000,
            success: 4000,
            warning: 5000,
            error: 6000
        };
        
        this.initializeNotificationSystem();
    }
    
    initializeNotificationSystem() {
        // Enhance existing message bar with additional features
        this.messageBar = document.getElementById('message-bar');
        this.messageContent = document.getElementById('message-content');
        this.messageClose = document.getElementById('message-close');
        
        if (!this.messageBar || !this.messageContent || !this.messageClose) {
            console.warn('NotificationManager: Required DOM elements not found');
            return;
        }
        
        this.setupEnhancedStyling();
        this.setupEventListeners();
        this.injectEnhancedStyles();
        
        console.log('NotificationManager: Enhanced notification system initialized');
    }
    
    setupEnhancedStyling() {
        // Add enhanced classes to existing message bar
        this.messageBar.classList.add('notification-enhanced');
        
        // Create notification icon container
        if (!this.messageBar.querySelector('.notification-icon')) {
            const iconContainer = document.createElement('div');
            iconContainer.className = 'notification-icon';
            this.messageBar.insertBefore(iconContainer, this.messageContent);
        }
        
        this.notificationIcon = this.messageBar.querySelector('.notification-icon');
    }
    
    setupEventListeners() {
        // Enhanced hover-to-persist behavior
        this.messageBar.addEventListener('mouseenter', () => {
            this.pauseAutoHide();
        });
        
        this.messageBar.addEventListener('mouseleave', () => {
            this.resumeAutoHide();
        });
        
        // Enhanced close button
        this.messageClose.addEventListener('click', () => {
            this.hideNotification(true);
        });
        
        // Keyboard accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hideNotification(true);
            }
        });
    }
    
    injectEnhancedStyles() {
        if (!document.getElementById('notification-manager-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'notification-manager-styles';
            styleSheet.textContent = this.getEnhancedStyles();
            document.head.appendChild(styleSheet);
        }
    }
    
    getEnhancedStyles() {
        return `
            /* Enhanced iOS 26 Liquid Glass Notification Styles - Overlay */
            .notification-enhanced {
                backdrop-filter: blur(20px) saturate(150%) brightness(1.1) !important;
                -webkit-backdrop-filter: blur(20px) saturate(150%) brightness(1.1) !important;
                box-shadow: 
                    0 4px 20px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
                border: 1px solid rgba(255, 255, 255, 0.25) !important;
                position: fixed !important;
                overflow: hidden;
            }
            
            .notification-enhanced::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(255, 255, 255, 0.1), 
                    transparent);
                transition: left 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1;
            }
            
            .notification-enhanced.show::before {
                left: 100%;
            }
            
            .notification-icon {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(20px);
                position: relative;
                z-index: 2;
                font-size: 12px;
                font-weight: 900;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .notification-enhanced.success .notification-icon {
                background: rgba(52, 211, 153, 0.3);
                color: #34D399;
                animation: successIconPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            .notification-enhanced.error .notification-icon {
                background: rgba(248, 113, 113, 0.3);
                color: #F87171;
                animation: errorIconShake 0.6s ease-in-out;
            }
            
            .notification-enhanced.warning .notification-icon {
                background: rgba(251, 191, 36, 0.3);
                color: #FBBF24;
                animation: warningIconPulse 1s ease-in-out infinite;
            }
            
            .notification-enhanced.info .notification-icon {
                background: rgba(147, 197, 253, 0.3);
                color: #93C5FD;
                animation: infoIconGlow 2s ease-in-out infinite;
            }
            
            @keyframes successIconPop {
                0% { transform: scale(0) rotate(-180deg); }
                50% { transform: scale(1.3) rotate(-90deg); }
                100% { transform: scale(1) rotate(0deg); }
            }
            
            @keyframes errorIconShake {
                0%, 100% { transform: translateX(0) rotate(0deg); }
                25% { transform: translateX(-3px) rotate(-5deg); }
                75% { transform: translateX(3px) rotate(5deg); }
            }
            
            @keyframes warningIconPulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
            }
            
            @keyframes infoIconGlow {
                0%, 100% { box-shadow: 0 0 5px rgba(147, 197, 253, 0.3); }
                50% { box-shadow: 0 0 15px rgba(147, 197, 253, 0.6); }
            }
            
            /* Enhanced slide animations - Overlay Compatible */
            .notification-enhanced.slide-in {
                animation: enhancedSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            .notification-enhanced.slide-out {
                animation: enhancedSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            @keyframes enhancedSlideIn {
                0% {
                    transform: translateX(-50%) translateY(-120%) scale(0.8);
                    opacity: 0;
                    filter: blur(5px);
                }
                60% {
                    transform: translateX(-50%) translateY(5%) scale(1.05);
                    opacity: 0.9;
                    filter: blur(1px);
                }
                100% {
                    transform: translateX(-50%) translateY(0) scale(1);
                    opacity: 1;
                    filter: blur(0px);
                }
            }
            
            @keyframes enhancedSlideOut {
                0% {
                    transform: translateX(-50%) translateY(0) scale(1);
                    opacity: 1;
                    filter: blur(0px);
                }
                100% {
                    transform: translateX(-50%) translateY(-100%) scale(0.9);
                    opacity: 0;
                    filter: blur(3px);
                }
            }
            
            /* Hover effects - Overlay Compatible */
            .notification-enhanced:hover {
                transform: translateX(-50%) translateY(-2px) scale(1.02) !important;
                box-shadow: 
                    0 6px 25px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
            }
            
            .notification-enhanced:hover .notification-icon {
                transform: scale(1.1);
                box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
            }
            
            /* Progress bar for auto-dismiss */
            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 2px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 0 0 12px 12px;
                transition: width linear;
                z-index: 3;
            }
            
            .notification-enhanced.success .notification-progress {
                background: rgba(52, 211, 153, 0.6);
            }
            
            .notification-enhanced.error .notification-progress {
                background: rgba(248, 113, 113, 0.6);
            }
            
            .notification-enhanced.warning .notification-progress {
                background: rgba(251, 191, 36, 0.6);
            }
            
            .notification-enhanced.info .notification-progress {
                background: rgba(147, 197, 253, 0.6);
            }
            
            /* Queue indicator */
            .notification-queue-indicator {
                position: absolute;
                top: -8px;
                right: 10px;
                background: rgba(255, 255, 255, 0.2);
                color: rgba(255, 255, 255, 0.8);
                font-size: 10px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 8px;
                backdrop-filter: blur(20px);
                z-index: 4;
                animation: queuePulse 1s ease-in-out infinite;
            }
            
            @keyframes queuePulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
        `;
    }
    
    /**
     * Show enhanced notification with iOS 26 liquid glass styling
     * @param {string} text - Notification text
     * @param {string} type - Notification type (info, success, error, warning)
     * @param {Object} options - Additional options
     */
    show(text, type = 'info', options = {}) {
        try {
            const notification = {
                id: this.generateId(),
                text,
                type,
                options: {
                    duration: options.duration || this.defaultDurations[type],
                    persistent: options.persistent || false,
                    icon: options.icon || this.getDefaultIcon(type),
                    showProgress: options.showProgress !== false,
                    ...options
                },
                timestamp: Date.now()
            };
        
        // Add to queue if another notification is showing
        if (this.isVisible()) {
            this.notificationQueue.push(notification);
            this.updateQueueIndicator();
            return notification.id;
        }
        
            this.displayNotification(notification);
            return notification.id;
            
        } catch (error) {
            console.error('NotificationManager: Error in show:', error);
            
            // Report error to error handler if available
            if (window.errorHandler) {
                window.errorHandler.handleComponentError('notification-manager', error, {
                    text,
                    type,
                    options,
                    context: 'show method'
                });
            }
            
            // Fallback: use basic message bar or console
            try {
                const messageBar = document.getElementById('message-bar');
                const messageContent = document.getElementById('message-content');
                
                if (messageBar && messageContent) {
                    messageContent.textContent = text;
                    messageBar.className = `message-bar show ${type}`;
                    
                    setTimeout(() => {
                        messageBar.className = 'message-bar hidden';
                    }, 3000);
                } else {
                    console.log(`FALLBACK NOTIFICATION (${type}): ${text}`);
                }
            } catch (fallbackError) {
                console.error('NotificationManager: Fallback also failed:', fallbackError);
                console.log(`CONSOLE FALLBACK (${type}): ${text}`);
            }
            
            return null;
        }
    }
    
    displayNotification(notification) {
        this.currentNotification = notification;
        this.activeNotifications.set(notification.id, notification);
        
        // Set content and icon
        this.messageContent.textContent = notification.text;
        this.notificationIcon.textContent = notification.options.icon;
        
        // Clear existing classes and set new type
        this.messageBar.className = 'message-bar notification-enhanced';
        this.messageBar.classList.add(notification.type);
        
        // Add progress bar if enabled
        if (notification.options.showProgress && !notification.options.persistent) {
            this.addProgressBar(notification.options.duration);
        }
        
        // Show with enhanced animation
        setTimeout(() => {
            this.messageBar.classList.add('show', 'slide-in');
        }, 10);
        
        // Auto-hide unless persistent
        if (!notification.options.persistent) {
            this.scheduleAutoHide(notification.options.duration);
        }
        
        // Log for debugging
        console.log(`NotificationManager: Showing ${notification.type} notification:`, notification.text);
    }
    
    addProgressBar(duration) {
        // Remove existing progress bar
        const existingProgress = this.messageBar.querySelector('.notification-progress');
        if (existingProgress) {
            existingProgress.remove();
        }
        
        // Create new progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'notification-progress';
        progressBar.style.width = '100%';
        this.messageBar.appendChild(progressBar);
        
        // Animate progress bar
        setTimeout(() => {
            progressBar.style.transition = `width ${duration}ms linear`;
            progressBar.style.width = '0%';
        }, 50);
        
        this.progressBar = progressBar;
    }
    
    scheduleAutoHide(duration) {
        this.clearAutoHideTimer();
        this.autoHideTimer = setTimeout(() => {
            this.hideNotification();
        }, duration);
    }
    
    pauseAutoHide() {
        if (this.autoHideTimer && this.progressBar) {
            // Pause progress bar animation
            const computedStyle = window.getComputedStyle(this.progressBar);
            const currentWidth = computedStyle.width;
            this.progressBar.style.width = currentWidth;
            this.progressBar.style.transition = 'none';
            
            // Clear timer
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
            
            console.log('NotificationManager: Auto-hide paused');
        }
    }
    
    resumeAutoHide() {
        if (this.currentNotification && !this.currentNotification.options.persistent && this.progressBar) {
            // Calculate remaining time based on progress bar width
            const currentWidth = parseFloat(this.progressBar.style.width) || 0;
            const remainingPercent = currentWidth / 100;
            const remainingTime = this.currentNotification.options.duration * remainingPercent;
            
            if (remainingTime > 100) { // Only resume if significant time remaining
                // Resume progress bar animation
                this.progressBar.style.transition = `width ${remainingTime}ms linear`;
                this.progressBar.style.width = '0%';
                
                // Schedule auto-hide
                this.scheduleAutoHide(remainingTime);
                
                console.log(`NotificationManager: Auto-hide resumed (${remainingTime}ms remaining)`);
            } else {
                // Too little time remaining, hide immediately
                this.hideNotification();
            }
        }
    }
    
    hideNotification(immediate = false) {
        if (!this.isVisible()) return;
        
        this.clearAutoHideTimer();
        
        if (immediate) {
            this.messageBar.classList.remove('show', 'slide-in');
            this.messageBar.classList.add('slide-out');
        } else {
            this.messageBar.classList.add('slide-out');
        }
        
        // Clean up after animation
        setTimeout(() => {
            this.messageBar.classList.remove('show', 'slide-in', 'slide-out');
            this.messageBar.className = 'message-bar hidden';
            
            // Remove progress bar
            const progressBar = this.messageBar.querySelector('.notification-progress');
            if (progressBar) {
                progressBar.remove();
            }
            
            // Clear current notification
            if (this.currentNotification) {
                this.activeNotifications.delete(this.currentNotification.id);
                this.currentNotification = null;
            }
            
            // Process queue
            this.processQueue();
            
        }, immediate ? 100 : 400);
        
        console.log('NotificationManager: Notification hidden');
    }
    
    processQueue() {
        if (this.notificationQueue.length > 0 && !this.isProcessingQueue) {
            this.isProcessingQueue = true;
            
            setTimeout(() => {
                const nextNotification = this.notificationQueue.shift();
                if (nextNotification) {
                    this.displayNotification(nextNotification);
                }
                this.updateQueueIndicator();
                this.isProcessingQueue = false;
            }, 200); // Small delay between notifications
        }
    }
    
    updateQueueIndicator() {
        const existingIndicator = this.messageBar.querySelector('.notification-queue-indicator');
        
        if (this.notificationQueue.length > 0) {
            if (!existingIndicator) {
                const indicator = document.createElement('div');
                indicator.className = 'notification-queue-indicator';
                this.messageBar.appendChild(indicator);
            }
            const indicator = this.messageBar.querySelector('.notification-queue-indicator');
            indicator.textContent = `+${this.notificationQueue.length}`;
        } else if (existingIndicator) {
            existingIndicator.remove();
        }
    }
    
    getDefaultIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || 'ℹ';
    }
    
    isVisible() {
        return this.messageBar && this.messageBar.classList.contains('show');
    }
    
    clearAutoHideTimer() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
    }
    
    generateId() {
        return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Clear all notifications and queue
     */
    clearAll() {
        this.hideNotification(true);
        this.notificationQueue = [];
        this.activeNotifications.clear();
        this.updateQueueIndicator();
        console.log('NotificationManager: All notifications cleared');
    }
    
    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            current: this.currentNotification,
            queue: this.notificationQueue.length,
            active: this.activeNotifications.size
        };
    }
    
    /**
     * Cleanup method
     */
    cleanup() {
        this.clearAll();
        this.clearAutoHideTimer();
        
        // Remove injected styles
        const styleSheet = document.getElementById('notification-manager-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
        
        console.log('NotificationManager: Cleanup completed');
    }
}

// Create and export singleton instance
export const notificationManager = new NotificationManager();

// Auto-initialize on DOM content loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('NotificationManager: Enhanced notification system ready');
    });
} else {
    console.log('NotificationManager: Enhanced notification system ready');
}
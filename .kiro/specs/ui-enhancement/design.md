# Design Document

## Overview

This design document outlines the comprehensive UI enhancement for the URL Rating Extension, focusing on improved visual feedback, streamlined interfaces, and monetization features. The enhancement builds upon the existing glassmorphism design while introducing modern interaction patterns, local rating calculations, and integrated advertising capabilities.

## Architecture

### Component Architecture

The UI enhancement follows a modular component-based architecture with iOS 26 liquid glass glassmorphism design:

```
UI Enhancement Architecture
├── Website Overlay System (Content Script)
│   ├── Circular Trust Score Overlay
│   ├── iOS 26 Liquid Glass Styling
│   ├── Backdrop Filter Effects
│   └── Dismissible Interface
├── Visual Feedback System
│   ├── Button State Manager (Pastel Blue Theme)
│   ├── Loading Indicators (Liquid Glass)
│   ├── Success/Error Notifications (Glassmorphism)
│   └── Animation Controller (iOS-style)
├── Trust Score Explanation System
│   ├── Tooltip Component (Backdrop Filter)
│   ├── Scoring Algorithm Display
│   └── Interactive Help System
├── Rating Submission Interface
│   ├── Compact Rating Form (Liquid Glass)
│   ├── Local Score Calculator
│   ├── Real-time Preview (Pastel Blue)
│   └── Submission Feedback
├── Information Display System
│   ├── Smart Warning Indicators (Glassmorphism)
│   ├── Threshold Calculator
│   └── Dynamic Content Filters
└── Monetization Components
    ├── Google Ads Integration (Themed)
    ├── Affiliate Link Manager (Liquid Glass)
    └── Revenue Analytics
```

### State Management

The enhanced UI uses a centralized state management system:

```javascript
const UIState = {
    // Visual feedback states
    buttonStates: new Map(), // button_id -> {loading, success, error, idle}
    notifications: [], // Array of active notifications
    
    // Rating calculation states
    currentScore: null,
    localCalculation: null,
    ratingPreview: null,
    
    // Monetization states
    adsLoaded: false,
    affiliateTracking: new Map(),
    
    // User interaction states
    tooltipVisible: false,
    activeTooltip: null
};
```

## Components and Interfaces

### 1. Website Overlay System (Content Script)

#### Circular Trust Score Overlay
The overlay system provides an unobtrusive trust score display directly on websites using iOS 26 liquid glass design:

```javascript
class TrustScoreOverlay {
    constructor() {
        this.overlay = null;
        this.isVisible = false;
        this.currentUrl = window.location.href;
        this.theme = {
            // iOS 26 Liquid Glass Colors (matching extension)
            primaryGlass: 'rgba(30, 41, 59, 0.8)',
            accentBlue: '#93C5FD',
            textPrimary: 'rgba(248, 250, 252, 0.95)',
            backdropFilter: 'blur(40px) saturate(150%) brightness(1.05)',
            borderColor: 'rgba(71, 85, 105, 0.4)',
            glowColor: 'rgba(147, 197, 253, 0.3)'
        };
    }
    
    async initialize() {
        // Only show on main pages, not iframes
        if (window !== window.top) return;
        
        // Fetch trust score for current URL
        const trustScore = await this.fetchTrustScore();
        
        // Create and show overlay
        this.createOverlay(trustScore);
        this.showOverlay();
        
        // Auto-hide after 8 seconds unless user interacts
        this.scheduleAutoHide();
    }
    
    createOverlay(trustScore) {
        this.overlay = document.createElement('div');
        this.overlay.id = 'url-rater-overlay';
        this.overlay.className = 'url-rater-overlay';
        
        this.overlay.innerHTML = `
            <div class="overlay-container">
                <div class="trust-circle-mini">
                    <svg class="circular-progress-mini" viewBox="0 0 100 100">
                        <circle class="progress-ring-bg-mini" cx="50" cy="50" r="45"/>
                        <circle class="progress-ring-fill-mini" cx="50" cy="50" r="45" 
                                style="stroke-dasharray: 283; stroke-dashoffset: ${283 - (trustScore / 100) * 283}"/>
                    </svg>
                    <div class="score-display-mini">
                        <span class="score-number-mini">${trustScore}</span>
                    </div>
                </div>
                <button class="overlay-close" title="Close trust score">×</button>
            </div>
        `;
        
        // Apply iOS 26 liquid glass styling
        this.applyLiquidGlassStyles();
        
        // Bind events
        this.bindOverlayEvents();
        
        document.body.appendChild(this.overlay);
    }
    
    applyLiquidGlassStyles() {
        const styles = `
            .url-rater-overlay {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999;
                pointer-events: auto;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
                opacity: 0;
                transform: translateY(-20px) scale(0.8);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .url-rater-overlay.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            
            .overlay-container {
                position: relative;
                width: 80px;
                height: 80px;
                background: ${this.theme.primaryGlass};
                backdrop-filter: ${this.theme.backdropFilter};
                -webkit-backdrop-filter: ${this.theme.backdropFilter};
                border: 1px solid ${this.theme.borderColor};
                border-radius: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 
                    0 25px 80px rgba(0, 0, 0, 0.4),
                    0 0 0 1px rgba(255, 255, 255, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1),
                    0 0 20px ${this.theme.glowColor};
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .overlay-container:hover {
                transform: translateY(-2px) scale(1.05);
                box-shadow: 
                    0 30px 100px rgba(0, 0, 0, 0.5),
                    0 0 0 1px rgba(255, 255, 255, 0.08),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15),
                    0 0 30px ${this.theme.glowColor};
            }
            
            .trust-circle-mini {
                position: relative;
                width: 60px;
                height: 60px;
            }
            
            .circular-progress-mini {
                position: absolute;
                width: 60px;
                height: 60px;
                transform: rotate(-90deg);
            }
            
            .progress-ring-bg-mini {
                fill: none;
                stroke: rgba(255, 255, 255, 0.1);
                stroke-width: 4;
                stroke-linecap: round;
            }
            
            .progress-ring-fill-mini {
                fill: none;
                stroke: ${this.theme.accentBlue};
                stroke-width: 4;
                stroke-linecap: round;
                filter: drop-shadow(0 0 8px ${this.theme.glowColor});
                transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .score-display-mini {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
            }
            
            .score-number-mini {
                font-size: 16px;
                font-weight: 900;
                color: ${this.theme.accentBlue};
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
                letter-spacing: -0.02em;
            }
            
            .overlay-close {
                position: absolute;
                top: -8px;
                right: -8px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: rgba(239, 68, 68, 0.8);
                backdrop-filter: ${this.theme.backdropFilter};
                -webkit-backdrop-filter: ${this.theme.backdropFilter};
                border: 1px solid rgba(239, 68, 68, 0.9);
                color: white;
                font-size: 14px;
                font-weight: 900;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transform: scale(0.8);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            }
            
            .overlay-container:hover .overlay-close {
                opacity: 1;
                transform: scale(1);
            }
            
            .overlay-close:hover {
                background: rgba(239, 68, 68, 1);
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
            }
        `;
        
        // Inject styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
    bindOverlayEvents() {
        // Click to open extension popup
        this.overlay.querySelector('.overlay-container').addEventListener('click', (e) => {
            if (e.target.classList.contains('overlay-close')) return;
            this.openExtensionPopup();
        });
        
        // Close button
        this.overlay.querySelector('.overlay-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideOverlay();
        });
        
        // Keyboard accessibility
        this.overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideOverlay();
            }
        });
    }
    
    showOverlay() {
        if (!this.overlay) return;
        
        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
            this.isVisible = true;
        });
    }
    
    hideOverlay() {
        if (!this.overlay) return;
        
        this.overlay.classList.remove('visible');
        this.isVisible = false;
        
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }, 400);
    }
    
    scheduleAutoHide() {
        setTimeout(() => {
            if (this.isVisible && !this.overlay.matches(':hover')) {
                this.hideOverlay();
            }
        }, 8000);
    }
    
    async fetchTrustScore() {
        try {
            // Use same API as extension
            const response = await fetch(`chrome-extension://${chrome.runtime.id}/api/trust-score?url=${encodeURIComponent(this.currentUrl)}`);
            const data = await response.json();
            return data.trust_score || 50;
        } catch (error) {
            console.log('Trust score fetch failed, using default');
            return 50;
        }
    }
    
    openExtensionPopup() {
        // Send message to background script to open popup
        chrome.runtime.sendMessage({ action: 'openPopup' });
    }
}

// Initialize overlay when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TrustScoreOverlay().initialize();
    });
} else {
    new TrustScoreOverlay().initialize();
}
```

### 2. Enhanced Visual Feedback System

#### Button State Manager (iOS 26 Liquid Glass Theme)
```javascript
class ButtonStateManager {
    constructor() {
        this.states = new Map();
        this.animations = new Map();
        this.theme = {
            // iOS 26 Liquid Glass Theme Colors
            accentBlue: '#93C5FD',
            accentSecondary: '#DBEAFE',
            accentTertiary: '#60A5FA',
            glassBackground: 'rgba(30, 41, 59, 0.8)',
            textPrimary: 'rgba(248, 250, 252, 0.95)',
            successColor: '#34D399',
            errorColor: '#F87171',
            backdropFilter: 'blur(40px) saturate(150%) brightness(1.05)'
        };
    }
    
    setState(buttonId, state, options = {}) {
        // States: 'idle', 'loading', 'success', 'error'
        const button = document.getElementById(buttonId);
        const previousState = this.states.get(buttonId);
        
        // Store original text if not already stored
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }
        
        // Apply iOS 26 liquid glass styling
        this.applyLiquidGlassStyles(button, state, options);
        
        // Handle smooth animations
        if (options.animate !== false) {
            this.animateStateChange(button, previousState, state);
        }
        
        // Auto-reset after duration
        if (options.duration && state !== 'idle') {
            setTimeout(() => this.setState(buttonId, 'idle'), options.duration);
        }
        
        this.states.set(buttonId, state);
    }
    
    applyLiquidGlassStyles(button, state, options) {
        // Remove all state classes
        button.classList.remove('btn-loading', 'btn-success', 'btn-error', 'btn-idle');
        
        // Apply new state class
        button.classList.add(`btn-${state}`);
        
        // Apply iOS 26 liquid glass base styles
        const baseStyles = `
            backdrop-filter: ${this.theme.backdropFilter};
            -webkit-backdrop-filter: ${this.theme.backdropFilter};
            border-radius: 12px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3);
        `;
        
        // Update button content and styling based on state
        switch (state) {
            case 'loading':
                button.innerHTML = `<span class="liquid-spinner"></span> ${options.loadingText || 'Loading...'}`;
                button.disabled = true;
                button.style.cssText = baseStyles + `
                    background: ${this.theme.glassBackground};
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: ${this.theme.textPrimary};
                    cursor: not-allowed;
                `;
                break;
            case 'success':
                button.innerHTML = `<span class="liquid-checkmark">✓</span> ${options.successText || 'Success!'}`;
                button.style.cssText = baseStyles + `
                    background: ${this.theme.successColor};
                    border: 1px solid ${this.theme.successColor};
                    color: white;
                    box-shadow: 
                        inset 0 1px 2px rgba(255, 255, 255, 0.3),
                        0 4px 16px rgba(52, 211, 153, 0.3);
                `;
                break;
            case 'error':
                button.innerHTML = `<span class="liquid-error">✗</span> ${options.errorText || 'Error'}`;
                button.style.cssText = baseStyles + `
                    background: ${this.theme.errorColor};
                    border: 1px solid ${this.theme.errorColor};
                    color: white;
                    box-shadow: 
                        inset 0 1px 2px rgba(255, 255, 255, 0.3),
                        0 4px 16px rgba(248, 113, 113, 0.3);
                `;
                break;
            case 'idle':
                button.innerHTML = options.idleText || button.dataset.originalText;
                button.disabled = false;
                button.style.cssText = baseStyles + `
                    background: ${this.theme.accentBlue};
                    border: 1px solid ${this.theme.accentBlue};
                    color: rgba(30, 58, 138, 0.9);
                    box-shadow: 
                        inset 0 1px 2px rgba(255, 255, 255, 0.3),
                        0 4px 16px rgba(147, 197, 253, 0.3);
                `;
                break;
        }
    }
    
    animateStateChange(button, previousState, newState) {
        // iOS-style smooth transitions
        button.style.transform = 'scale(0.95)';
        
        requestAnimationFrame(() => {
            button.style.transform = 'scale(1)';
            
            // Add subtle glow effect for success/error states
            if (newState === 'success' || newState === 'error') {
                button.style.filter = 'brightness(1.1)';
                setTimeout(() => {
                    button.style.filter = 'brightness(1)';
                }, 200);
            }
        });
    }
}
```

#### Notification System (iOS 26 Liquid Glass)
```javascript
class NotificationManager {
    constructor() {
        this.container = this.createContainer();
        this.notifications = [];
        this.theme = {
            accentBlue: '#93C5FD',
            successColor: '#34D399',
            errorColor: '#F87171',
            warningColor: '#FBBF24',
            glassBackground: 'rgba(30, 41, 59, 0.9)',
            textPrimary: 'rgba(248, 250, 252, 0.95)',
            backdropFilter: 'blur(40px) saturate(150%) brightness(1.05)'
        };
    }
    
    show(message, type = 'info', duration = 3000) {
        const notification = this.createLiquidGlassNotification(message, type);
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // iOS-style slide-in animation
        requestAnimationFrame(() => {
            notification.classList.add('notification-visible');
        });
        
        // Auto-remove with fade-out
        if (duration > 0) {
            setTimeout(() => this.remove(notification), duration);
        }
        
        return notification;
    }
    
    createLiquidGlassNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `liquid-notification liquid-notification-${type}`;
        
        const colors = {
            info: this.theme.accentBlue,
            success: this.theme.successColor,
            error: this.theme.errorColor,
            warning: this.theme.warningColor
        };
        
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };
        
        notification.innerHTML = `
            <div class="liquid-notification-content">
                <span class="liquid-notification-icon">${icons[type]}</span>
                <span class="liquid-notification-message">${message}</span>
                <button class="liquid-notification-close">×</button>
            </div>
        `;
        
        // Apply iOS 26 liquid glass styling
        notification.style.cssText = `
            background: ${this.theme.glassBackground};
            backdrop-filter: ${this.theme.backdropFilter};
            -webkit-backdrop-filter: ${this.theme.backdropFilter};
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-left: 4px solid ${colors[type]};
            border-radius: 16px;
            padding: 12px 16px;
            margin-bottom: 8px;
            color: ${this.theme.textPrimary};
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
            font-weight: 500;
            box-shadow: 
                0 8px 25px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.1),
                0 0 20px ${colors[type]}40;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        // Bind close event
        notification.querySelector('.liquid-notification-close').addEventListener('click', () => {
            this.remove(notification);
        });
        
        return notification;
    }
    
    createContainer() {
        const container = document.createElement('div');
        container.id = 'liquid-notifications-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 350px;
            pointer-events: none;
        `;
        
        document.body.appendChild(container);
        return container;
    }
    
    remove(notification) {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 400);
    }
}
```

### 3. Trust Score Explanation System

#### Tooltip Component (iOS 26 Liquid Glass)
```javascript
class TrustScoreTooltip {
    constructor() {
        this.tooltip = null;
        this.isVisible = false;
        this.bindEvents();
    }
    
    bindEvents() {
        const scoreElement = document.getElementById('trust-score');
        const questionMark = this.createQuestionMark();
        
        // Insert question mark next to score
        scoreElement.parentNode.insertBefore(questionMark, scoreElement.nextSibling);
        
        // Hover events
        questionMark.addEventListener('mouseenter', () => this.show());
        questionMark.addEventListener('mouseleave', () => this.hide());
        questionMark.addEventListener('click', () => this.toggle());
    }
    
    createQuestionMark() {
        const element = document.createElement('span');
        element.className = 'trust-score-help';
        element.innerHTML = '?';
        element.title = 'Click to learn how trust scores are calculated';
        return element;
    }
    
    show() {
        if (this.isVisible) return;
        
        this.tooltip = this.createTooltip();
        document.body.appendChild(this.tooltip);
        
        // Position tooltip
        this.positionTooltip();
        
        // Animate in
        requestAnimationFrame(() => {
            this.tooltip.classList.add('tooltip-visible');
        });
        
        this.isVisible = true;
    }
    
    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'liquid-trust-tooltip';
        tooltip.innerHTML = `
            <div class="liquid-tooltip-header">
                <h4>Trust Score Calculation</h4>
                <button class="liquid-tooltip-close">×</button>
            </div>
            <div class="liquid-tooltip-content">
                <div class="liquid-scoring-breakdown">
                    <div class="liquid-score-component">
                        <span class="liquid-component-label">Domain Analysis</span>
                        <span class="liquid-component-weight">40%</span>
                        <div class="liquid-component-bar">
                            <div class="liquid-bar-fill" style="width: 40%"></div>
                        </div>
                    </div>
                    <div class="liquid-score-component">
                        <span class="liquid-component-label">Community Ratings</span>
                        <span class="liquid-component-weight">60%</span>
                        <div class="liquid-component-bar">
                            <div class="liquid-bar-fill" style="width: 60%"></div>
                        </div>
                    </div>
                </div>
                <div class="liquid-score-ranges">
                    <div class="liquid-score-range excellent">90-100: Excellent</div>
                    <div class="liquid-score-range good">70-89: Good</div>
                    <div class="liquid-score-range fair">50-69: Fair</div>
                    <div class="liquid-score-range poor">30-49: Poor</div>
                    <div class="liquid-score-range very-poor">0-29: Very Poor</div>
                </div>
                <div class="liquid-tooltip-footer">
                    <small>Scores combine technical security analysis with user feedback</small>
                </div>
            </div>
        `;
        
        // Apply iOS 26 liquid glass styling
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(30, 41, 59, 0.95);
            backdrop-filter: blur(40px) saturate(150%) brightness(1.05);
            -webkit-backdrop-filter: blur(40px) saturate(150%) brightness(1.05);
            border: 1px solid rgba(71, 85, 105, 0.4);
            border-radius: 20px;
            padding: 20px;
            max-width: 320px;
            color: rgba(248, 250, 252, 0.95);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
            box-shadow: 
                0 25px 80px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.1),
                0 0 20px rgba(147, 197, 253, 0.3);
            z-index: 10001;
            opacity: 0;
            transform: scale(0.8) translateY(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        // Bind close event
        tooltip.querySelector('.liquid-tooltip-close').addEventListener('click', () => this.hide());
        
        return tooltip;
    }
}
```

### 4. Compact Rating Submission Interface (iOS 26 Liquid Glass)

#### Streamlined Rating Form
The current rating form will be redesigned to be more compact and visually integrated with iOS 26 liquid glass aesthetics:

```html
<!-- New Compact Rating Interface with iOS 26 Liquid Glass -->
<div class="liquid-rating-interface">
    <div class="liquid-rating-header">
        <span class="liquid-rating-title">Rate this site</span>
        <div class="liquid-score-preview" id="liquid-score-preview">
            <span class="liquid-preview-label">Impact:</span>
            <span class="liquid-preview-value" id="liquid-preview-value">+0</span>
        </div>
    </div>
    
    <div class="liquid-rating-controls">
        <div class="liquid-star-rating" id="liquid-star-rating">
            <button class="liquid-star" data-rating="1">★</button>
            <button class="liquid-star" data-rating="2">★</button>
            <button class="liquid-star" data-rating="3">★</button>
            <button class="liquid-star" data-rating="4">★</button>
            <button class="liquid-star" data-rating="5">★</button>
        </div>
        
        <div class="liquid-flag-controls">
            <button class="liquid-flag-btn" data-flag="spam" title="Report as spam">
                <span class="flag-icon">🚫</span>
            </button>
            <button class="liquid-flag-btn" data-flag="misleading" title="Report as misleading">
                <span class="flag-icon">⚠️</span>
            </button>
            <button class="liquid-flag-btn" data-flag="scam" title="Report as scam">
                <span class="flag-icon">🚨</span>
            </button>
        </div>
        
        <button class="liquid-submit-rating" id="liquid-submit-rating">
            <span class="submit-text">Submit Rating</span>
        </button>
    </div>
</div>

<style>
.liquid-rating-interface {
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(40px) saturate(150%) brightness(1.05);
    -webkit-backdrop-filter: blur(40px) saturate(150%) brightness(1.05);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 20px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 
        0 8px 25px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.05),
        inset 0 2px 4px rgba(255, 255, 255, 0.08);
}

.liquid-rating-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.liquid-rating-title {
    font-size: 14px;
    font-weight: 600;
    color: #93C5FD;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
}

.liquid-score-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.liquid-preview-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
}

.liquid-preview-value {
    font-size: 12px;
    font-weight: 700;
    color: #93C5FD;
    min-width: 20px;
    text-align: center;
}

.liquid-preview-value.positive {
    color: #34D399;
}

.liquid-preview-value.negative {
    color: #F87171;
}

.liquid-rating-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.liquid-star-rating {
    display: flex;
    gap: 4px;
    justify-content: center;
}

.liquid-star {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}

.liquid-star:hover,
.liquid-star.active {
    background: #93C5FD;
    border-color: #93C5FD;
    color: rgba(30, 58, 138, 0.9);
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(147, 197, 253, 0.3);
}

.liquid-flag-controls {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.liquid-flag-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    width: 40px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}

.liquid-flag-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
}

.liquid-flag-btn.active {
    background: rgba(239, 68, 68, 0.8);
    border-color: rgba(239, 68, 68, 0.9);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.liquid-submit-rating {
    background: #93C5FD;
    border: 1px solid #93C5FD;
    border-radius: 12px;
    padding: 10px 20px;
    color: rgba(30, 58, 138, 0.9);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(40px) saturate(150%) brightness(1.05);
    -webkit-backdrop-filter: blur(40px) saturate(150%) brightness(1.05);
    box-shadow: 
        inset 0 1px 2px rgba(255, 255, 255, 0.3),
        0 4px 16px rgba(147, 197, 253, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
}

.liquid-submit-rating:hover {
    background: #DBEAFE;
    transform: translateY(-1px) scale(1.02);
    box-shadow: 
        inset 0 1px 2px rgba(255, 255, 255, 0.4),
        0 6px 20px rgba(147, 197, 253, 0.4);
}
</style>
```

#### Local Score Calculator
```javascript
class LocalScoreCalculator {
    constructor() {
        this.penalties = {
            spam: -30,
            misleading: -25,
            scam: -40
        };
        this.currentScore = 0;
        this.currentRatingCount = 0;
    }
    
    calculateImpact(starRating, flags, currentScore, ratingCount) {
        // Convert star rating to 0-100 scale
        const ratingScore = (starRating - 1) * 25; // 1★=0, 2★=25, 3★=50, 4★=75, 5★=100
        
        // Apply flag penalties
        let effectiveScore = ratingScore;
        flags.forEach(flag => {
            if (this.penalties[flag]) {
                effectiveScore += this.penalties[flag];
            }
        });
        
        // Ensure score stays within bounds
        effectiveScore = Math.max(0, Math.min(100, effectiveScore));
        
        // Calculate weighted average with existing ratings
        const totalRatings = ratingCount + 1;
        const newScore = ((currentScore * ratingCount) + effectiveScore) / totalRatings;
        
        return {
            effectiveRating: effectiveScore,
            newOverallScore: Math.round(newScore),
            impact: Math.round(newScore - currentScore)
        };
    }
    
    updatePreview(starRating, flags) {
        const calculation = this.calculateImpact(
            starRating, 
            flags, 
            this.currentScore, 
            this.currentRatingCount
        );
        
        const previewElement = document.getElementById('preview-value');
        const impact = calculation.impact;
        
        previewElement.textContent = impact >= 0 ? `+${impact}` : `${impact}`;
        previewElement.className = `preview-value ${impact >= 0 ? 'positive' : 'negative'}`;
        
        return calculation;
    }
}
```

### 4. Smart Information Display System

#### Warning Indicator Component
```javascript
class WarningIndicatorSystem {
    constructor() {
        this.thresholds = {
            spam: 0.20,      // 20% of ratings
            misleading: 0.15, // 15% of ratings
            scam: 0.10       // 10% of ratings
        };
    }
    
    updateWarnings(stats) {
        const container = document.querySelector('.warning-indicators');
        container.innerHTML = ''; // Clear existing warnings
        
        const totalRatings = stats.rating_count || 0;
        if (totalRatings === 0) return;
        
        // Check each warning type
        Object.entries(this.thresholds).forEach(([type, threshold]) => {
            const count = stats[`${type}_reports_count`] || 0;
            const percentage = count / totalRatings;
            
            if (percentage >= threshold) {
                const warning = this.createWarningIndicator(type, percentage, count);
                container.appendChild(warning);
            }
        });
    }
    
    createWarningIndicator(type, percentage, count) {
        const indicator = document.createElement('div');
        indicator.className = `warning-indicator warning-${type}`;
        
        const icons = {
            spam: '🚫',
            misleading: '⚠️',
            scam: '🚨'
        };
        
        const labels = {
            spam: 'High Spam Reports',
            misleading: 'Misleading Content',
            scam: 'Scam Reports'
        };
        
        indicator.innerHTML = `
            <span class="warning-icon">${icons[type]}</span>
            <span class="warning-text">${labels[type]}</span>
            <span class="warning-stats">${Math.round(percentage * 100)}% (${count})</span>
        `;
        
        return indicator;
    }
}
```

### 5. Google Ads Integration

#### Ads Manager Component
```javascript
class GoogleAdsManager {
    constructor() {
        this.adUnits = new Map();
        this.isInitialized = false;
        this.config = {
            publisherId: 'ca-pub-XXXXXXXXXX', // To be configured
            adSlots: {
                header: 'XXXXXXXXXX',
                sidebar: 'XXXXXXXXXX',
                footer: 'XXXXXXXXXX'
            }
        };
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Load Google AdSense script
            await this.loadAdSenseScript();
            
            // Initialize ad units
            this.initializeAdUnits();
            
            this.isInitialized = true;
            console.log('Google Ads initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Google Ads:', error);
        }
    }
    
    loadAdSenseScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.config.publisherId}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            
            script.onload = resolve;
            script.onerror = reject;
            
            document.head.appendChild(script);
        });
    }
    
    createAdUnit(slotId, size = 'auto') {
        const adContainer = document.createElement('div');
        adContainer.className = 'ad-container';
        
        const adUnit = document.createElement('ins');
        adUnit.className = 'adsbygoogle';
        adUnit.style.display = 'block';
        adUnit.setAttribute('data-ad-client', this.config.publisherId);
        adUnit.setAttribute('data-ad-slot', this.config.adSlots[slotId]);
        adUnit.setAttribute('data-ad-format', size);
        
        adContainer.appendChild(adUnit);
        
        // Push to AdSense
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (error) {
            console.error('AdSense push error:', error);
        }
        
        return adContainer;
    }
}
```

### 6. Affiliate Link System

#### Affiliate Manager Component
```javascript
class AffiliateManager {
    constructor() {
        this.affiliateLinks = {
            '1password': {
                url: 'https://1password.com/?ref=AFFILIATE_ID',
                name: '1Password',
                icon: '1P',
                description: 'Secure password manager'
            },
            'nordvpn': {
                url: 'https://nordvpn.com/?ref=AFFILIATE_ID',
                name: 'NordVPN',
                icon: 'VPN',
                description: 'Secure VPN service'
            }
        };
        this.analytics = new Map();
    }
    
    trackClick(affiliateId) {
        const timestamp = Date.now();
        const clickData = {
            affiliateId,
            timestamp,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        // Store locally
        this.analytics.set(`${affiliateId}_${timestamp}`, clickData);
        
        // Send to analytics endpoint
        this.sendAnalytics(clickData);
        
        console.log('Affiliate click tracked:', affiliateId);
    }
    
    async sendAnalytics(clickData) {
        try {
            await fetch('/api/affiliate-analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clickData)
            });
        } catch (error) {
            console.error('Failed to send affiliate analytics:', error);
        }
    }
    
    renderAffiliateLinks() {
        const container = document.querySelector('.affiliate-links');
        container.innerHTML = '';
        
        Object.entries(this.affiliateLinks).forEach(([id, link]) => {
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.className = 'affiliate-link';
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            
            linkElement.innerHTML = `
                <div class="affiliate-icon">${link.icon}</div>
                <span class="affiliate-name">${link.name}</span>
            `;
            
            linkElement.addEventListener('click', () => this.trackClick(id));
            container.appendChild(linkElement);
        });
    }
}
```

## Data Models

### UI State Model
```typescript
interface UIState {
    // Visual feedback
    buttonStates: Map<string, ButtonState>;
    notifications: Notification[];
    
    // Rating system
    currentScore: number | null;
    localCalculation: ScoreCalculation | null;
    ratingPreview: RatingPreview | null;
    
    // Monetization
    adsLoaded: boolean;
    affiliateTracking: Map<string, ClickData>;
    
    // User interaction
    tooltipVisible: boolean;
    activeTooltip: string | null;
}

interface ButtonState {
    state: 'idle' | 'loading' | 'success' | 'error';
    text: string;
    disabled: boolean;
    timestamp: number;
}

interface ScoreCalculation {
    starRating: number;
    flags: string[];
    effectiveScore: number;
    impact: number;
    newOverallScore: number;
}

interface ClickData {
    affiliateId: string;
    timestamp: number;
    url: string;
    userAgent: string;
}
```

### Warning Threshold Model
```typescript
interface WarningThresholds {
    spam: number;      // Percentage threshold (0.0 - 1.0)
    misleading: number;
    scam: number;
}

interface WarningIndicator {
    type: 'spam' | 'misleading' | 'scam';
    percentage: number;
    count: number;
    severity: 'low' | 'medium' | 'high';
}
```

## Error Handling

### Graceful Degradation Strategy
```javascript
class ErrorHandler {
    constructor() {
        this.fallbackStrategies = new Map();
        this.setupFallbacks();
    }
    
    setupFallbacks() {
        // Google Ads fallback
        this.fallbackStrategies.set('ads', () => {
            console.log('Ads failed to load, showing placeholder');
            document.querySelectorAll('.ad-container').forEach(container => {
                container.innerHTML = '<div class="ad-fallback">Advertisement</div>';
            });
        });
        
        // Affiliate links fallback
        this.fallbackStrategies.set('affiliate', () => {
            console.log('Affiliate system failed, hiding section');
            document.querySelector('.affiliate-section').style.display = 'none';
        });
        
        // Local calculation fallback
        this.fallbackStrategies.set('calculation', () => {
            console.log('Local calculation failed, using simple preview');
            document.getElementById('preview-value').textContent = '~';
        });
    }
    
    handleError(component, error) {
        console.error(`Error in ${component}:`, error);
        
        const fallback = this.fallbackStrategies.get(component);
        if (fallback) {
            fallback();
        }
        
        // Show user-friendly error message
        this.showUserError(component, error);
    }
}
```

## Testing Strategy

### Component Testing
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Component interaction and data flow
- **Visual Tests**: UI appearance and animations
- **Performance Tests**: Rendering speed and memory usage

### User Experience Testing
- **Usability Tests**: User interaction patterns
- **Accessibility Tests**: Screen reader compatibility
- **Cross-browser Tests**: Chrome, Firefox, Safari, Edge
- **Mobile Tests**: Responsive design validation

### Monetization Testing
- **Ad Loading Tests**: Google Ads integration
- **Click Tracking Tests**: Affiliate link analytics
- **Revenue Tests**: Conversion rate optimization
- **Compliance Tests**: Privacy and advertising standards

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Load ads and affiliate content after core UI
2. **Debouncing**: Limit rapid user interactions
3. **Caching**: Store calculation results and UI states
4. **Minification**: Compress CSS and JavaScript
5. **CDN Usage**: External resource optimization

### Memory Management
- Clean up event listeners on component destruction
- Limit notification history to prevent memory leaks
- Periodic cleanup of analytics data
- Efficient DOM manipulation patterns

## Content Script Integration

### Manifest V3 Content Script Configuration
```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-scripts/trust-overlay.js"],
      "css": ["content-scripts/trust-overlay.css"],
      "run_at": "document_end",
      "all_frames": false
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["icons/*.png", "content-scripts/*.css"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### Content Script Communication
```javascript
// Background script message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openPopup') {
        chrome.action.openPopup();
    }
    
    if (message.action === 'getTrustScore') {
        // Fetch trust score and send back to content script
        fetchTrustScoreForUrl(message.url).then(score => {
            sendResponse({ trustScore: score });
        });
        return true; // Keep message channel open
    }
});

// Content script to extension communication
chrome.runtime.sendMessage({
    action: 'getTrustScore',
    url: window.location.href
}, (response) => {
    if (response && response.trustScore) {
        updateOverlayScore(response.trustScore);
    }
});
```

### iOS 26 Liquid Glass CSS Framework
```css
/* iOS 26 Liquid Glass Base Styles */
:root {
    --liquid-glass-primary: rgba(30, 41, 59, 0.8);
    --liquid-glass-secondary: rgba(51, 65, 85, 0.6);
    --liquid-glass-accent: #93C5FD;
    --liquid-glass-text: rgba(248, 250, 252, 0.95);
    --liquid-glass-border: rgba(71, 85, 105, 0.4);
    --liquid-glass-glow: rgba(147, 197, 253, 0.3);
    --liquid-glass-backdrop: blur(40px) saturate(150%) brightness(1.05);
    --liquid-glass-shadow: 0 25px 80px rgba(0, 0, 0, 0.4), 
                           0 0 0 1px rgba(255, 255, 255, 0.05), 
                           inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.liquid-glass-base {
    background: var(--liquid-glass-primary);
    backdrop-filter: var(--liquid-glass-backdrop);
    -webkit-backdrop-filter: var(--liquid-glass-backdrop);
    border: 1px solid var(--liquid-glass-border);
    border-radius: 20px;
    box-shadow: var(--liquid-glass-shadow);
    color: var(--liquid-glass-text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
}

.liquid-glass-button {
    @extend .liquid-glass-base;
    background: var(--liquid-glass-accent);
    border-color: var(--liquid-glass-accent);
    color: rgba(30, 58, 138, 0.9);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3),
                0 4px 16px var(--liquid-glass-glow);
}

.liquid-glass-button:hover {
    transform: translateY(-1px) scale(1.02);
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4),
                0 6px 20px var(--liquid-glass-glow);
}
```

This design provides a comprehensive foundation for implementing the enhanced UI with iOS 26 liquid glass glassmorphism aesthetic, including the website overlay system and ensuring optimal user experience with at-a-glance information visibility.
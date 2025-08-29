// TrustScoreTooltip - iOS 26 Liquid Glass Trust Score Explanation System
// Provides detailed explanations and breakdowns of trust score calculations

export class TrustScoreTooltip {
    constructor() {
        this.isVisible = false;
        this.tooltip = null;
        this.triggerButton = null;
        this.currentScore = 0;
        this.currentData = null;

        this.scoreRanges = {
            excellent: { min: 75, max: 100, color: '#34D399', label: 'Excellent', description: 'Highly trusted site with strong security and positive community feedback' },
            good: { min: 50, max: 74, color: '#93C5FD', label: 'Good', description: 'Generally trustworthy site with good reputation and security' },
            fair: { min: 25, max: 49, color: '#FBBF24', label: 'Fair', description: 'Mixed signals - exercise caution and verify information' },
            poor: { min: 1, max: 24, color: '#F87171', label: 'Poor', description: 'Low trust score - be very cautious with this site' },
            unknown: { min: 0, max: 0, color: 'rgba(255, 255, 255, 0.4)', label: 'Unknown', description: 'No rating data available yet' }
        };

        this.initializeTooltipSystem();
    }

    initializeTooltipSystem() {
        this.createTriggerButton();
        this.createTooltipContainer();
        this.setupEventListeners();
        this.injectStyles();

        console.log('TrustScoreTooltip: Tooltip system initialized');
    }

    createTriggerButton() {
        // Use the existing trust score tooltip button from HTML
        this.triggerButton = document.getElementById('trust-score-tooltip-btn');
        if (!this.triggerButton) {
            console.warn('TrustScoreTooltip: Trust score tooltip button not found in HTML');
            return;
        }

        // Set accessibility attributes
        this.triggerButton.setAttribute('aria-label', 'Explain trust score');
        console.log('TrustScoreTooltip: Using existing HTML button');
    }

    createTooltipContainer() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'trust-score-tooltip hidden';
        this.tooltip.setAttribute('role', 'dialog');
        this.tooltip.setAttribute('aria-labelledby', 'tooltip-title');
        this.tooltip.setAttribute('aria-describedby', 'tooltip-content');

        this.tooltip.innerHTML = `
            <div class="tooltip-header">
                <h3 id="tooltip-title">Trust Score</h3>
                <button class="tooltip-close" aria-label="Close tooltip">&times;</button>
            </div>
            <div class="tooltip-content" id="tooltip-content">
                <div class="calculation-explanation">
                    <h4>How It's Calculated</h4>
                    <div class="calc-item">
                        <div class="calc-icon">🔒</div>
                        <div class="calc-text">
                            <strong>Domain Security (40%)</strong>
                            <span>SSL certificates, domain age, security scans</span>
                        </div>
                    </div>
                    <div class="calc-item">
                        <div class="calc-icon">👥</div>
                        <div class="calc-text">
                            <strong>Community Ratings (60%)</strong>
                            <span>User ratings, reports, and feedback</span>
                        </div>
                    </div>
                </div>
                
                <div class="score-ranges">
                    <h4>Score Ranges</h4>
                    <div class="range-list">
                        <div class="range-item excellent">
                            <div class="range-bar"></div>
                            <span class="range-label">75%+ Excellent</span>
                        </div>
                        <div class="range-item good">
                            <div class="range-bar"></div>
                            <span class="range-label">50%+ Good</span>
                        </div>
                        <div class="range-item fair">
                            <div class="range-bar"></div>
                            <span class="range-label">25%+ Fair</span>
                        </div>
                        <div class="range-item poor">
                            <div class="range-bar"></div>
                            <span class="range-label">&lt;25% Poor</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.tooltip);
    }

    setupEventListeners() {
        if (!this.triggerButton || !this.tooltip) return;

        // Show tooltip on button click
        this.triggerButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTooltip();
        });

        // Close tooltip on close button click
        const closeBtn = this.tooltip.querySelector('.tooltip-close');
        closeBtn.addEventListener('click', () => {
            this.hideTooltip();
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hideTooltip();
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.tooltip.contains(e.target) && e.target !== this.triggerButton) {
                this.hideTooltip();
            }
        });

        // Prevent tooltip from closing when clicking inside
        this.tooltip.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    injectStyles() {
        if (!document.getElementById('trust-score-tooltip-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'trust-score-tooltip-styles';
            styleSheet.textContent = this.getTooltipStyles();
            document.head.appendChild(styleSheet);
        }
    }

    getTooltipStyles() {
        return `
            /* Trust Score Help Button */
            .trust-score-help-btn {
                position: absolute;
                top: -8px;
                right: -8px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: rgba(147, 197, 253, 0.8);
                backdrop-filter: blur(20px) saturate(150%);
                -webkit-backdrop-filter: blur(20px) saturate(150%);
                border: 1px solid rgba(147, 197, 253, 0.6);
                color: rgba(30, 58, 138, 0.9);
                font-size: 12px;
                font-weight: 900;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10;
                box-shadow: 
                    0 4px 12px rgba(147, 197, 253, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
            }
            
            .trust-score-help-btn:hover {
                background: rgba(147, 197, 253, 1);
                transform: scale(1.1);
                box-shadow: 
                    0 6px 16px rgba(147, 197, 253, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4);
            }
            
            .trust-score-help-btn:active {
                transform: scale(0.95);
                transition: all 0.1s ease;
            }
            
            /* Trust Score Tooltip */
            .trust-score-tooltip {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                width: 280px;
                max-width: calc(100vw - 40px);
                max-height: 60vh;
                background: rgba(15, 23, 42, 0.98);
                backdrop-filter: var(--glass-backdrop-strong);
                -webkit-backdrop-filter: var(--glass-backdrop-strong);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-lg);
                box-shadow:
                    var(--shadow-xl),
                    0 0 0 1px rgba(255, 255, 255, 0.05),
                    var(--shadow-glow-subtle);
                z-index: 2000;
                opacity: 0;
                pointer-events: none;
                transition: all var(--transition-normal);
                overflow: hidden;
            }
            
            .trust-score-tooltip.show {
                opacity: 1;
                pointer-events: all;
                transform: translate(-50%, -50%) scale(1);
            }
            
            .trust-score-tooltip.hidden {
                display: none;
            }
            
            /* Tooltip Header */
            .tooltip-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(255, 255, 255, 0.03);
            }
            
            .tooltip-header h3 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
                color: #93C5FD;
                font-family: inherit;
            }
            
            .tooltip-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                font-size: 20px;
                font-weight: bold;
                cursor: pointer;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.3s ease;
            }
            
            .tooltip-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 1);
                transform: scale(1.1);
            }
            
            /* Tooltip Content */
            .tooltip-content {
                padding: 16px;
                color: rgba(255, 255, 255, 0.85);
                font-size: 12px;
                line-height: 1.4;
                overflow-y: auto;
                max-height: 40vh;
            }
            
            /* Calculation Explanation */
            .calculation-explanation {
                margin-bottom: 16px;
            }
            
            .calculation-explanation h4 {
                margin: 0 0 10px 0;
                font-size: 13px;
                font-weight: 600;
                color: #DBEAFE;
            }
            
            .calc-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                margin-bottom: 8px;
                padding: 8px 10px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.04);
            }
            
            .calc-icon {
                font-size: 14px;
                flex-shrink: 0;
                margin-top: 1px;
            }
            
            .calc-text {
                flex: 1;
            }
            
            .calc-text strong {
                display: block;
                color: #DBEAFE;
                margin-bottom: 2px;
                font-size: 12px;
            }
            
            .calc-text span {
                color: rgba(255, 255, 255, 0.65);
                font-size: 11px;
            }
            

            
            /* Score Ranges */
            .range-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .range-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.04);
            }
            
            .range-bar {
                width: 16px;
                height: 3px;
                border-radius: 2px;
                flex-shrink: 0;
            }
            
            .range-item.excellent .range-bar {
                background: #34D399;
                box-shadow: 0 0 6px rgba(52, 211, 153, 0.3);
            }
            
            .range-item.good .range-bar {
                background: #93C5FD;
                box-shadow: 0 0 6px rgba(147, 197, 253, 0.3);
            }
            
            .range-item.fair .range-bar {
                background: #FBBF24;
                box-shadow: 0 0 6px rgba(251, 191, 36, 0.3);
            }
            
            .range-item.poor .range-bar {
                background: #F87171;
                box-shadow: 0 0 6px rgba(248, 113, 113, 0.3);
            }
            
            .range-label {
                font-weight: 500;
                color: rgba(255, 255, 255, 0.8);
                font-size: 11px;
            }
            

            
            /* Animations */
            @keyframes tooltipSlideIn {
                0% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8) rotateY(-15deg);
                    filter: blur(10px);
                }
                100% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1) rotateY(0deg);
                    filter: blur(0px);
                }
            }
            
            @keyframes tooltipSlideOut {
                0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1) rotateY(0deg);
                    filter: blur(0px);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8) rotateY(15deg);
                    filter: blur(10px);
                }
            }
            
            .trust-score-tooltip.slide-in {
                animation: tooltipSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            .trust-score-tooltip.slide-out {
                animation: tooltipSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;
    }

    /**
     * Update tooltip with current trust score data
     * @param {number} score - Current trust score (0-100)
     * @param {Object} data - Additional score data
     */
    updateScore(score, data = null) {
        this.currentScore = score;
        this.currentData = data;

        // Tooltip no longer displays current score, just shows explanation
        console.log(`TrustScoreTooltip: Score updated to ${score}% (tooltip shows explanation only)`);
    }

    getScoreRange(score) {
        if (score >= 75) return this.scoreRanges.excellent;
        if (score >= 50) return this.scoreRanges.good;
        if (score >= 25) return this.scoreRanges.fair;
        if (score > 0) return this.scoreRanges.poor;
        return this.scoreRanges.unknown;
    }

    showTooltip() {
        if (!this.tooltip || this.isVisible) return;

        this.isVisible = true;
        this.tooltip.classList.remove('hidden');

        setTimeout(() => {
            this.tooltip.classList.add('show', 'slide-in');
        }, 10);

        // Focus management for accessibility
        const closeBtn = this.tooltip.querySelector('.tooltip-close');
        if (closeBtn) closeBtn.focus();

        console.log('TrustScoreTooltip: Tooltip shown');
    }

    hideTooltip() {
        if (!this.tooltip || !this.isVisible) return;

        this.isVisible = false;
        this.tooltip.classList.add('slide-out');
        this.tooltip.classList.remove('show', 'slide-in');

        setTimeout(() => {
            this.tooltip.classList.add('hidden');
            this.tooltip.classList.remove('slide-out');
        }, 300);

        // Return focus to trigger button
        if (this.triggerButton) this.triggerButton.focus();

        console.log('TrustScoreTooltip: Tooltip hidden');
    }

    toggleTooltip() {
        if (this.isVisible) {
            this.hideTooltip();
        } else {
            this.showTooltip();
        }
    }

    /**
     * Check if tooltip is currently visible
     * @returns {boolean}
     */
    isTooltipVisible() {
        return this.isVisible;
    }

    /**
     * Alias for showTooltip() for compatibility
     */
    show() {
        this.showTooltip();
    }

    /**
     * Alias for hideTooltip() for compatibility
     */
    hide() {
        this.hideTooltip();
    }

    /**
     * Cleanup method
     */
    cleanup() {
        this.hideTooltip();

        if (this.triggerButton) {
            this.triggerButton.remove();
        }

        if (this.tooltip) {
            this.tooltip.remove();
        }

        // Remove injected styles
        const styleSheet = document.getElementById('trust-score-tooltip-styles');
        if (styleSheet) {
            styleSheet.remove();
        }

        console.log('TrustScoreTooltip: Cleanup completed');
    }
}

// Create and export singleton instance
export const trustScoreTooltip = new TrustScoreTooltip();

// Auto-initialize on DOM content loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('TrustScoreTooltip: Trust score tooltip system ready');
    });
} else {
    console.log('TrustScoreTooltip: Trust score tooltip system ready');
}
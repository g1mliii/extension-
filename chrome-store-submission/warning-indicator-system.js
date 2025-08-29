// Warning Indicator System - iOS 26 Liquid Glass Design
// Implements smart warning badges for trust scores and content quality issues

class WarningIndicatorSystem {
    constructor() {
        this.container = null;
        this.activeWarnings = new Map();
        this.thresholds = {
            // Trust score thresholds
            lowTrustScore: 50,
            
            // Report percentage thresholds (based on total ratings)
            spamThreshold: 20,      // >20% spam reports
            misleadingThreshold: 15, // >15% misleading reports
            scamThreshold: 10       // >10% scam reports
        };
        
        this.theme = {
            // iOS 26 Liquid Glass Colors
            primaryGlass: 'rgba(30, 41, 59, 0.9)',
            warningColor: '#FBBF24',
            dangerColor: '#F87171',
            criticalColor: '#DC2626',
            textPrimary: 'rgba(248, 250, 252, 0.95)',
            backdropFilter: 'blur(40px) saturate(150%) brightness(1.05)',
            borderColor: 'rgba(71, 85, 105, 0.4)',
            glowWarning: 'rgba(251, 191, 36, 0.4)',
            glowDanger: 'rgba(248, 113, 113, 0.4)',
            glowCritical: 'rgba(220, 38, 38, 0.4)'
        };
        
        this.init();
    }
    
    init() {
        this.createWarningContainer();
        this.injectStyles();
    }
    
    createWarningContainer() {
        // Find the trust score layout container
        const trustScoreLayout = document.querySelector('.trust-score-layout');
        if (!trustScoreLayout) {
            console.error('Trust score layout not found for warning indicators');
            return;
        }
        
        // Create warning indicators container
        this.container = document.createElement('div');
        this.container.className = 'warning-indicators-container';
        this.container.innerHTML = `
            <div class="warning-indicators-grid" id="warning-indicators-grid">
                <!-- Warning indicators will be dynamically added here -->
            </div>
        `;
        
        // Insert after the score-main-row but before url-display-box
        const scoreMainRow = trustScoreLayout.querySelector('.score-main-row');
        const urlDisplayBox = trustScoreLayout.querySelector('.url-display-box');
        
        if (scoreMainRow && urlDisplayBox) {
            trustScoreLayout.insertBefore(this.container, urlDisplayBox);
        } else if (scoreMainRow) {
            scoreMainRow.parentNode.insertBefore(this.container, scoreMainRow.nextSibling);
        }
    }
    
    updateWarnings(trustScore, data = {}) {
        if (!this.container) {
            console.warn('Warning container not initialized');
            return;
        }
        
        const warnings = this.calculateWarnings(trustScore, data);
        this.displayWarnings(warnings);
    }
    
    calculateWarnings(trustScore, data = {}) {
        const warnings = [];
        
        // Low trust score warning
        if (trustScore < this.thresholds.lowTrustScore) {
            let severity = 'warning';
            let message = 'Low Trust Score';
            let icon = '⚠️';
            
            if (trustScore < 25) {
                severity = 'critical';
                message = 'Very Low Trust';
                icon = '🚨';
            } else if (trustScore < 35) {
                severity = 'danger';
                message = 'Poor Trust Score';
                icon = '⚠️';
            }
            
            warnings.push({
                id: 'low-trust',
                type: 'trust-score',
                severity,
                message,
                icon,
                value: `${Math.round(trustScore)}%`
            });
        }
        
        // Calculate report percentages
        const totalRatings = parseInt(data.rating_count) || 0;
        const spamReports = parseInt(data.spam_reports_count) || 0;
        const misleadingReports = parseInt(data.misleading_reports_count) || 0;
        const scamReports = parseInt(data.scam_reports_count) || 0;
        
        if (totalRatings > 0) {
            const spamPercentage = (spamReports / totalRatings) * 100;
            const misleadingPercentage = (misleadingReports / totalRatings) * 100;
            const scamPercentage = (scamReports / totalRatings) * 100;
            
            // High spam reports warning
            if (spamPercentage > this.thresholds.spamThreshold) {
                warnings.push({
                    id: 'high-spam',
                    type: 'content-quality',
                    severity: spamPercentage > 40 ? 'danger' : 'warning',
                    message: 'High Spam Reports',
                    icon: '🚫',
                    value: `${Math.round(spamPercentage)}%`
                });
            }
            
            // High misleading reports warning
            if (misleadingPercentage > this.thresholds.misleadingThreshold) {
                warnings.push({
                    id: 'misleading-content',
                    type: 'content-quality',
                    severity: misleadingPercentage > 30 ? 'danger' : 'warning',
                    message: 'Misleading Content',
                    icon: '⚠️',
                    value: `${Math.round(misleadingPercentage)}%`
                });
            }
            
            // High scam reports warning
            if (scamPercentage > this.thresholds.scamThreshold) {
                warnings.push({
                    id: 'suspicious-activity',
                    type: 'content-quality',
                    severity: scamPercentage > 25 ? 'critical' : 'danger',
                    message: 'Suspicious Activity',
                    icon: '🚨',
                    value: `${Math.round(scamPercentage)}%`
                });
            }
        }
        
        return warnings;
    }
    
    displayWarnings(warnings) {
        const grid = this.container.querySelector('#warning-indicators-grid');
        if (!grid) return;
        
        // Clear existing warnings
        this.clearWarnings();
        
        if (warnings.length === 0) {
            // Hide container if no warnings
            this.container.style.display = 'none';
            return;
        }
        
        // Show container and add warnings
        this.container.style.display = 'block';
        
        warnings.forEach(warning => {
            const warningElement = this.createWarningElement(warning);
            grid.appendChild(warningElement);
            this.activeWarnings.set(warning.id, warningElement);
            
            // Animate in
            requestAnimationFrame(() => {
                warningElement.classList.add('warning-visible');
            });
        });
    }
    
    createWarningElement(warning) {
        const element = document.createElement('div');
        element.className = `warning-indicator warning-${warning.severity}`;
        element.dataset.warningId = warning.id;
        
        const colors = {
            warning: {
                background: this.theme.warningColor,
                glow: this.theme.glowWarning
            },
            danger: {
                background: this.theme.dangerColor,
                glow: this.theme.glowDanger
            },
            critical: {
                background: this.theme.criticalColor,
                glow: this.theme.glowCritical
            }
        };
        
        const color = colors[warning.severity] || colors.warning;
        
        element.innerHTML = `
            <div class="warning-content">
                <span class="warning-icon">${warning.icon}</span>
                <div class="warning-text">
                    <span class="warning-message">${warning.message}</span>
                    <span class="warning-value">${warning.value}</span>
                </div>
            </div>
        `;
        
        // Apply dynamic styling
        element.style.cssText = `
            background: ${color.background}95;
            border: 1px solid ${color.background};
            box-shadow: 
                0 4px 16px ${color.glow},
                inset 0 1px 2px rgba(255, 255, 255, 0.2);
        `;
        
        return element;
    }
    
    clearWarnings() {
        const grid = this.container?.querySelector('#warning-indicators-grid');
        if (!grid) return;
        
        // Animate out existing warnings
        const existingWarnings = grid.querySelectorAll('.warning-indicator');
        existingWarnings.forEach(warning => {
            warning.classList.remove('warning-visible');
            setTimeout(() => {
                if (warning.parentNode) {
                    warning.parentNode.removeChild(warning);
                }
            }, 300);
        });
        
        this.activeWarnings.clear();
    }
    
    injectStyles() {
        const styleId = 'warning-indicator-styles';
        if (document.getElementById(styleId)) return;
        
        const styles = `
            .warning-indicators-container {
                margin: 12px 0 8px 0;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .warning-indicators-container[style*="display: block"] {
                opacity: 1;
                transform: translateY(0);
            }
            
            .warning-indicators-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
            }
            
            .warning-indicator {
                display: flex;
                align-items: center;
                padding: 6px 10px;
                border-radius: 12px;
                backdrop-filter: ${this.theme.backdropFilter};
                -webkit-backdrop-filter: ${this.theme.backdropFilter};
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
                font-size: 11px;
                font-weight: 600;
                opacity: 0;
                transform: scale(0.8) translateY(10px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }
            
            .warning-indicator.warning-visible {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
            
            .warning-indicator::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .warning-indicator:hover::before {
                left: 100%;
            }
            
            .warning-indicator:hover {
                transform: scale(1.05) translateY(-2px);
                filter: brightness(1.1);
            }
            
            .warning-indicator:active {
                transform: scale(0.98) translateY(0);
                transition: all 0.1s ease;
            }
            
            .warning-content {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .warning-icon {
                font-size: 12px;
                line-height: 1;
            }
            
            .warning-text {
                display: flex;
                flex-direction: column;
                gap: 1px;
            }
            
            .warning-message {
                font-weight: 700;
                line-height: 1.1;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            }
            
            .warning-value {
                font-size: 9px;
                font-weight: 500;
                opacity: 0.9;
                line-height: 1;
            }
            
            /* Responsive adjustments */
            @media (max-width: 400px) {
                .warning-indicators-grid {
                    gap: 4px;
                }
                
                .warning-indicator {
                    padding: 4px 8px;
                    font-size: 10px;
                }
                
                .warning-icon {
                    font-size: 11px;
                }
                
                .warning-value {
                    font-size: 8px;
                }
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
    // Public method to get current warnings for testing
    getActiveWarnings() {
        return Array.from(this.activeWarnings.keys());
    }
    
    // Public method to update thresholds if needed
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
    }
    

}

// Create and export singleton instance
const warningIndicatorSystem = new WarningIndicatorSystem();
export { warningIndicatorSystem };
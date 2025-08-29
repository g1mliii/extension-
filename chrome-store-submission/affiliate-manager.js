// affiliate-manager.js - iOS 26 Liquid Glass Affiliate Link Management System

class AffiliateManager {
    constructor() {
        this.affiliateLinks = new Map();
        this.trackingData = new Map();
        this.theme = {
            // iOS 26 Liquid Glass Theme Colors
            primaryGlass: 'rgba(30, 41, 59, 0.8)',
            accentBlue: '#93C5FD',
            accentSecondary: '#DBEAFE',
            textPrimary: 'rgba(248, 250, 252, 0.95)',
            textSecondary: 'rgba(226, 232, 240, 0.85)',
            borderColor: 'rgba(71, 85, 105, 0.4)',
            borderHighlight: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(40px) saturate(150%) brightness(1.05)',
            glowColor: 'rgba(147, 197, 253, 0.3)',
            successColor: '#34D399',
            shadowMd: '0 4px 16px rgba(0, 0, 0, 0.45)',
            shadowLg: '0 8px 25px rgba(0, 0, 0, 0.45)',
            shadowInner: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        };
        
        // Initialize affiliate programs
        this.initializeAffiliatePrograms();
        this.bindEvents();
    }
    
    initializeAffiliatePrograms() {
        // Current affiliate programs
        this.affiliateLinks.set('1password', {
            id: '1password',
            name: '1Password',
            icon: '1P',
            description: 'Secure password manager',
            url: 'https://1password.com/?utm_source=url-rater&utm_medium=extension&utm_campaign=security-tools',
            category: 'password-manager',
            priority: 1,
            active: true
        });
        
        this.affiliateLinks.set('nordvpn', {
            id: 'nordvpn',
            name: 'NordVPN',
            icon: 'VPN',
            description: 'Secure VPN service',
            url: 'https://nordvpn.com/?utm_source=url-rater&utm_medium=extension&utm_campaign=security-tools',
            category: 'vpn',
            priority: 2,
            active: true
        });
        
        // Future affiliate programs (inactive for now)
        this.affiliateLinks.set('malwarebytes', {
            id: 'malwarebytes',
            name: 'Malwarebytes',
            icon: 'MB',
            description: 'Anti-malware protection',
            url: 'https://malwarebytes.com/?utm_source=url-rater&utm_medium=extension&utm_campaign=security-tools',
            category: 'antivirus',
            priority: 3,
            active: false // Will be activated later
        });
        
        this.affiliateLinks.set('protonmail', {
            id: 'protonmail',
            name: 'ProtonMail',
            icon: 'PM',
            description: 'Secure email service',
            url: 'https://protonmail.com/?utm_source=url-rater&utm_medium=extension&utm_campaign=security-tools',
            category: 'email',
            priority: 4,
            active: false // Will be activated later
        });
    }
    
    bindEvents() {
        // Update existing affiliate links with enhanced functionality
        this.updateExistingAffiliateLinks();
        
        // Initialize tracking
        this.initializeTracking();
    }
    
    updateExistingAffiliateLinks() {
        const onePasswordLink = document.getElementById('affiliate-1password');
        const nordVpnLink = document.getElementById('affiliate-nordvpn');
        
        if (onePasswordLink) {
            this.enhanceAffiliateLink(onePasswordLink, '1password');
        }
        
        if (nordVpnLink) {
            this.enhanceAffiliateLink(nordVpnLink, 'nordvpn');
        }
        
        // Apply liquid glass styling to affiliate section
        this.applyLiquidGlassStyling();
    }
    
    enhanceAffiliateLink(linkElement, affiliateId) {
        const affiliate = this.affiliateLinks.get(affiliateId);
        if (!affiliate || !affiliate.active) return;
        
        // Remove existing event listeners
        const newElement = linkElement.cloneNode(true);
        linkElement.parentNode.replaceChild(newElement, linkElement);
        
        // Add enhanced click handler
        newElement.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleAffiliateClick(affiliateId, affiliate.url);
        });
        
        // Add hover effects
        newElement.addEventListener('mouseenter', () => {
            this.showAffiliateTooltip(newElement, affiliate);
        });
        
        newElement.addEventListener('mouseleave', () => {
            this.hideAffiliateTooltip();
        });
        
        // Update element attributes
        newElement.title = affiliate.description;
        newElement.setAttribute('data-affiliate-id', affiliateId);
        
        // Apply enhanced liquid glass styling
        this.applyLinkStyling(newElement);
    }
    
    applyLinkStyling(linkElement) {
        // Enhanced iOS 26 liquid glass styling for individual links
        linkElement.style.cssText += `
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            will-change: transform, box-shadow, background;
        `;
        
        // Add shimmer effect on hover
        const shimmerEffect = document.createElement('div');
        shimmerEffect.className = 'affiliate-shimmer';
        shimmerEffect.style.cssText = `
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
            z-index: 1;
        `;
        
        linkElement.appendChild(shimmerEffect);
        
        // Trigger shimmer on hover
        linkElement.addEventListener('mouseenter', () => {
            shimmerEffect.style.left = '100%';
            setTimeout(() => {
                shimmerEffect.style.left = '-100%';
            }, 600);
        });
    }
    
    applyLiquidGlassStyling() {
        const affiliateSection = document.querySelector('.affiliate-section');
        if (!affiliateSection) return;
        
        // Enhanced liquid glass styling for the entire section
        affiliateSection.style.cssText += `
            background: ${this.theme.primaryGlass};
            backdrop-filter: ${this.theme.backdropFilter};
            -webkit-backdrop-filter: ${this.theme.backdropFilter};
            border: 1px solid ${this.theme.borderColor};
            border-radius: 16px;
            box-shadow: 
                ${this.theme.shadowLg},
                0 0 0 1px rgba(255, 255, 255, 0.06),
                ${this.theme.shadowInner},
                0 0 20px ${this.theme.glowColor};
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        `;
        
        // Add subtle gradient overlay
        const gradientOverlay = document.createElement('div');
        gradientOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            opacity: 0.8;
            pointer-events: none;
        `;
        affiliateSection.appendChild(gradientOverlay);
        
        // Enhanced hover effects
        affiliateSection.addEventListener('mouseenter', () => {
            affiliateSection.style.transform = 'translateY(-2px)';
            affiliateSection.style.boxShadow = `
                0 12px 35px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.08),
                inset 0 1px 0 rgba(255, 255, 255, 0.15),
                0 0 30px ${this.theme.glowColor}
            `;
        });
        
        affiliateSection.addEventListener('mouseleave', () => {
            affiliateSection.style.transform = 'translateY(0)';
            affiliateSection.style.boxShadow = `
                ${this.theme.shadowLg},
                0 0 0 1px rgba(255, 255, 255, 0.06),
                ${this.theme.shadowInner},
                0 0 20px ${this.theme.glowColor}
            `;
        });
    }
    
    handleAffiliateClick(affiliateId, url) {
        const affiliate = this.affiliateLinks.get(affiliateId);
        if (!affiliate) return;
        
        // Track the click
        this.trackAffiliateClick(affiliateId);
        
        // Show feedback
        this.showClickFeedback(affiliateId);
        
        // Open the affiliate link
        chrome.tabs.create({ url: url });
        
        console.log('Affiliate link clicked:', {
            id: affiliateId,
            name: affiliate.name,
            url: url,
            timestamp: new Date().toISOString()
        });
    }
    
    trackAffiliateClick(affiliateId) {
        const currentData = this.trackingData.get(affiliateId) || {
            clicks: 0,
            lastClick: null,
            firstClick: null
        };
        
        const now = new Date().toISOString();
        
        this.trackingData.set(affiliateId, {
            clicks: currentData.clicks + 1,
            lastClick: now,
            firstClick: currentData.firstClick || now
        });
        
        // Save to localStorage for persistence
        this.saveTrackingData();
    }
    
    saveTrackingData() {
        try {
            const trackingObject = Object.fromEntries(this.trackingData);
            localStorage.setItem('urlrater_affiliate_tracking', JSON.stringify(trackingObject));
        } catch (error) {
            console.error('Error saving affiliate tracking data:', error);
        }
    }
    
    loadTrackingData() {
        try {
            const saved = localStorage.getItem('urlrater_affiliate_tracking');
            if (saved) {
                const trackingObject = JSON.parse(saved);
                this.trackingData = new Map(Object.entries(trackingObject));
            }
        } catch (error) {
            console.error('Error loading affiliate tracking data:', error);
        }
    }
    
    initializeTracking() {
        this.loadTrackingData();
    }
    
    showClickFeedback(affiliateId) {
        const affiliate = this.affiliateLinks.get(affiliateId);
        if (!affiliate) return;
        
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = 'affiliate-click-feedback';
        feedback.textContent = `Opening ${affiliate.name}...`;
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.8);
            background: ${this.theme.successColor};
            color: white;
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: ${this.theme.backdropFilter};
            -webkit-backdrop-filter: ${this.theme.backdropFilter};
            box-shadow: 0 8px 25px rgba(52, 211, 153, 0.3);
        `;
        
        document.body.appendChild(feedback);
        
        // Animate in
        requestAnimationFrame(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translate(-50%, -50%) scale(1)';
        });
        
        // Remove after delay
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translate(-50%, -50%) scale(0.8)';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 1500);
    }
    
    showAffiliateTooltip(linkElement, affiliate) {
        // Remove existing tooltip
        this.hideAffiliateTooltip();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'affiliate-tooltip';
        tooltip.innerHTML = `
            <div class="affiliate-tooltip-content">
                <div class="affiliate-tooltip-header">
                    <span class="affiliate-tooltip-icon">${affiliate.icon}</span>
                    <span class="affiliate-tooltip-name">${affiliate.name}</span>
                </div>
                <div class="affiliate-tooltip-description">${affiliate.description}</div>
                <div class="affiliate-tooltip-footer">Click to visit ${affiliate.name}</div>
            </div>
        `;
        
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: ${this.theme.backdropFilter};
            -webkit-backdrop-filter: ${this.theme.backdropFilter};
            border: 1px solid ${this.theme.borderColor};
            border-radius: 12px;
            padding: 12px;
            color: ${this.theme.textPrimary};
            font-size: 11px;
            font-weight: 500;
            z-index: 1000;
            opacity: 0;
            transform: translateY(10px) scale(0.9);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 
                0 8px 25px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            pointer-events: none;
            max-width: 200px;
        `;
        
        // Position tooltip
        const rect = linkElement.getBoundingClientRect();
        tooltip.style.top = (rect.top - 80) + 'px';
        tooltip.style.left = (rect.left + rect.width / 2 - 100) + 'px';
        
        document.body.appendChild(tooltip);
        this.currentTooltip = tooltip;
        
        // Animate in
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0) scale(1)';
        });
    }
    
    hideAffiliateTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.style.opacity = '0';
            this.currentTooltip.style.transform = 'translateY(10px) scale(0.9)';
            
            setTimeout(() => {
                if (this.currentTooltip && this.currentTooltip.parentNode) {
                    this.currentTooltip.parentNode.removeChild(this.currentTooltip);
                }
                this.currentTooltip = null;
            }, 300);
        }
    }
    
    // Future methods for backend integration
    async submitAffiliateProgram(programData) {
        // This will be implemented when backend approval system is ready
        console.log('Affiliate program submission (future feature):', programData);
        
        // For now, just store locally for future approval
        const pendingPrograms = JSON.parse(localStorage.getItem('urlrater_pending_affiliates') || '[]');
        pendingPrograms.push({
            ...programData,
            submittedAt: new Date().toISOString(),
            status: 'pending'
        });
        localStorage.setItem('urlrater_pending_affiliates', JSON.stringify(pendingPrograms));
        
        return {
            success: true,
            message: 'Affiliate program submitted for review',
            id: Date.now().toString()
        };
    }
    
    async getAffiliateAnalytics() {
        // Return current tracking data
        const analytics = {};
        
        for (const [id, data] of this.trackingData) {
            const affiliate = this.affiliateLinks.get(id);
            if (affiliate) {
                analytics[id] = {
                    name: affiliate.name,
                    clicks: data.clicks,
                    lastClick: data.lastClick,
                    firstClick: data.firstClick,
                    category: affiliate.category
                };
            }
        }
        
        return analytics;
    }
    
    // Method to activate future affiliate programs
    activateAffiliateProgram(affiliateId) {
        const affiliate = this.affiliateLinks.get(affiliateId);
        if (affiliate) {
            affiliate.active = true;
            console.log(`Activated affiliate program: ${affiliate.name}`);
            
            // If this is a new program, we'd need to add it to the UI
            // For now, just log the activation
        }
    }
    
    // Method to get affiliate statistics
    getAffiliateStats() {
        const stats = {
            totalPrograms: this.affiliateLinks.size,
            activePrograms: Array.from(this.affiliateLinks.values()).filter(a => a.active).length,
            totalClicks: Array.from(this.trackingData.values()).reduce((sum, data) => sum + data.clicks, 0),
            programsByCategory: {}
        };
        
        // Group by category
        for (const affiliate of this.affiliateLinks.values()) {
            if (!stats.programsByCategory[affiliate.category]) {
                stats.programsByCategory[affiliate.category] = 0;
            }
            stats.programsByCategory[affiliate.category]++;
        }
        
        return stats;
    }
}

// Create and export singleton instance
const affiliateManager = new AffiliateManager();

// Make available globally for testing and other modules
window.affiliateManager = affiliateManager;

export { affiliateManager };
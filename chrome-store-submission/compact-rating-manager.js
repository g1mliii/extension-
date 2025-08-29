// Compact Rating Manager - iOS 26 Liquid Glass Design
// Handles the streamlined rating submission interface

import { localScoreCalculator } from './local-score-calculator.js';

class CompactRatingManager {
    constructor() {
        this.selectedRating = 0;
        this.selectedFlags = new Set();
        this.currentTrustScore = 50; // Default baseline
        this.isInitialized = false;
        this.isSubmitting = false; // Prevent double submissions
        
        // Double-tap functionality
        this.lastTapTime = 0;
        this.lastTappedRating = 0;
        this.doubleTapDelay = 500; // 500ms window for double-tap
        
        // Penalty values for local calculation (matching backend algorithm)
        this.penalties = {
            spam: 30,
            misleading: 25,
            scam: 40
        };
        
        // Rating guide tooltip
        this.ratingGuideTooltip = null;
        this.ratingGuideButton = null;
        this.isGuideVisible = false;
        
        this.init();
    }
    
    init() {
        try {
            if (this.isInitialized) return;
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
                return;
            }
        
        // Get DOM elements
        this.starContainer = document.getElementById('compact-star-rating');
        this.flagContainer = document.querySelector('.ultra-compact-flags');
        this.submitButton = document.getElementById('submit-rating-btn'); // Use existing hidden button
        this.previewValue = null; // Will be created for impact preview
        
        // Create impact preview element
        this.createImpactPreview();
        
        // Hidden form elements for compatibility
        this.hiddenRatingSelect = document.getElementById('rating-score');
        this.hiddenSpamCheckbox = document.getElementById('is-spam');
        this.hiddenMisleadingCheckbox = document.getElementById('is-misleading');
        this.hiddenScamCheckbox = document.getElementById('is-scam');
        this.hiddenSubmitButton = document.getElementById('submit-rating-btn');
        
        if (!this.starContainer || !this.flagContainer) {
            console.warn('Compact rating elements not found:', {
                starContainer: !!this.starContainer,
                flagContainer: !!this.flagContainer,
                ratingSection: !!document.getElementById('rating-section')
            });
            // Retry after a short delay in case elements are added dynamically or become visible
            setTimeout(() => {
                this.isInitialized = false;
                this.init();
            }, 1000); // Increased delay to 1 second
            return;
        }
        
        this.bindEvents();
        this.createRatingGuideTooltip();
        // Preview removed for ultra-compact design
        this.isInitialized = true;
        
            console.log('Compact Rating Manager initialized successfully');
            
        } catch (error) {
            console.error('CompactRatingManager: Error in init:', error);
            
            // Report error to error handler if available
            if (window.errorHandler) {
                window.errorHandler.handleComponentError('compact-rating-manager', error, {
                    context: 'initialization',
                    isInitialized: this.isInitialized
                });
            }
            
            // Fallback: enable basic rating form
            try {
                const ratingSelect = document.getElementById('rating-score');
                const submitButton = document.getElementById('submit-rating-btn');
                
                if (ratingSelect) ratingSelect.style.display = 'block';
                if (submitButton) {
                    submitButton.style.display = 'block';
                    submitButton.textContent = 'Submit Rating';
                }
                
                console.log('CompactRatingManager: Fallback to basic rating form');
            } catch (fallbackError) {
                console.error('CompactRatingManager: Fallback initialization failed:', fallbackError);
            }
        }
    }
    
    bindEvents() {
        // Star rating events
        const stars = this.starContainer.querySelectorAll('.ultra-star-expanded');
        stars.forEach((star) => {
            const rating = parseInt(star.dataset.rating);
            
            // Hover effects - only show preview if no rating is primed
            star.addEventListener('mouseenter', () => {
                if (this.selectedRating === 0) {
                    this.highlightStars(rating);
                }
            });
            
            star.addEventListener('mouseleave', () => {
                if (this.selectedRating === 0) {
                    this.highlightStars(0);
                } else {
                    this.highlightStars(this.selectedRating);
                }
            });
            
            // Click to select, double-click to submit
            star.addEventListener('click', () => {
                this.handleStarClick(rating);
            });
        });
        
        // Flag button events
        const flagButtons = this.flagContainer.querySelectorAll('.ultra-flag-btn');
        flagButtons.forEach(button => {
            const flag = button.dataset.flag;
            
            button.addEventListener('click', () => {
                this.toggleFlag(flag);
            });
        });
        
        // Submit button removed - using double-tap instead
        
        // Rating guide button event
        this.ratingGuideButton = document.getElementById('rating-guide-btn');
        if (this.ratingGuideButton) {
            this.ratingGuideButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleRatingGuide();
            });
        }
    }
    
    highlightStars(rating) {
        const stars = this.starContainer.querySelectorAll('.ultra-star-expanded');
        stars.forEach((star, index) => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
    
    handleStarClick(rating) {
        // Check if this star is already selected (primed)
        if (this.selectedRating === rating) {
            // Second click on same star - submit rating
            this.submitRating();
            return;
        }
        
        // First click - prime the rating (clear any previous selection)
        this.selectedRating = rating;
        this.selectRating(rating);
        
        // Add visual feedback that star is primed and ready to submit
        this.showPrimedEffect(rating);
    }
    
    selectRating(rating) {
        this.selectedRating = rating;
        this.highlightStars(rating);
        
        // Update hidden form element for compatibility
        if (this.hiddenRatingSelect) {
            this.hiddenRatingSelect.value = rating;
        }
        
        // Add selection animation
        const selectedStar = this.starContainer.querySelector(`[data-rating="${rating}"]`);
        if (selectedStar) {
            selectedStar.style.transform = 'scale(1.2)';
            setTimeout(() => {
                selectedStar.style.transform = '';
            }, 200);
        }
        
        // Update impact preview
        this.updatePreview();
        
        console.log('Rating selected:', rating);
    }
    
    showPrimedEffect(rating) {
        const selectedStar = this.starContainer.querySelector(`[data-rating="${rating}"]`);
        if (selectedStar) {
            // Remove primed effect from all stars first
            const allStars = this.starContainer.querySelectorAll('.ultra-star-expanded');
            allStars.forEach(star => {
                star.classList.remove('primed');
                star.style.animation = '';
            });
            
            // Add primed class for visual feedback
            selectedStar.classList.add('primed');
            
            // Pulse effect to show it's ready to submit
            selectedStar.style.animation = 'pulse 1.5s ease-in-out infinite';
            
            // Visual feedback is enough - no notification needed
            // The primed state with green glow and pulse is sufficient feedback
        }
    }
    
    toggleFlag(flag) {
        const button = this.flagContainer.querySelector(`[data-flag="${flag}"]`);
        if (!button) return;
        
        if (this.selectedFlags.has(flag)) {
            this.selectedFlags.delete(flag);
            button.classList.remove('active');
        } else {
            this.selectedFlags.add(flag);
            button.classList.add('active');
        }
        
        // Update hidden form elements for compatibility
        if (flag === 'spam' && this.hiddenSpamCheckbox) {
            this.hiddenSpamCheckbox.checked = this.selectedFlags.has('spam');
        }
        if (flag === 'misleading' && this.hiddenMisleadingCheckbox) {
            this.hiddenMisleadingCheckbox.checked = this.selectedFlags.has('misleading');
        }
        if (flag === 'scam' && this.hiddenScamCheckbox) {
            this.hiddenScamCheckbox.checked = this.selectedFlags.has('scam');
        }
        
        // Add toggle animation
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
        
        // Update impact preview
        this.updatePreview();
        
        console.log('Flag toggled:', flag, this.selectedFlags.has(flag));
    }
    
    createImpactPreview() {
        // Create impact preview container
        const ratingSection = document.querySelector('.ultra-compact-rating');
        if (!ratingSection) return;
        
        // Check if preview already exists
        if (document.getElementById('rating-impact-preview')) return;
        
        const previewContainer = document.createElement('div');
        previewContainer.id = 'rating-impact-preview';
        previewContainer.className = 'rating-impact-preview hidden';
        previewContainer.innerHTML = `
            <div class="impact-preview-content">
                <span class="impact-label">Impact:</span>
                <span class="impact-value" id="impact-value">+0</span>
                <span class="impact-arrow" id="impact-arrow">→</span>
            </div>
            <div class="impact-details" id="impact-details">
                <div class="before-after">
                    <span class="before-score" id="before-score">50%</span>
                    <span class="arrow">→</span>
                    <span class="after-score" id="after-score">50%</span>
                </div>
            </div>
        `;
        
        // Insert before the star rating
        ratingSection.insertBefore(previewContainer, this.starContainer);
        
        // Store references
        this.previewContainer = previewContainer;
        this.impactValue = document.getElementById('impact-value');
        this.impactArrow = document.getElementById('impact-arrow');
        this.impactDetails = document.getElementById('impact-details');
        this.beforeScore = document.getElementById('before-score');
        this.afterScore = document.getElementById('after-score');
    }
    
    updatePreview() {
        if (!this.previewContainer || this.selectedRating === 0) {
            this.hidePreview();
            return;
        }
        
        try {
            // Calculate impact using LocalScoreCalculator
            const flags = {
                spam: this.selectedFlags.has('spam'),
                misleading: this.selectedFlags.has('misleading'),
                scam: this.selectedFlags.has('scam')
            };
            
            const impact = localScoreCalculator.calculateRatingImpact(this.selectedRating, flags);
            const visualIndicators = localScoreCalculator.getVisualIndicators(impact);
            
            // Update impact value
            this.impactValue.textContent = localScoreCalculator.formatImpact(impact);
            this.impactValue.style.color = visualIndicators.color;
            
            // Update arrow
            this.impactArrow.textContent = visualIndicators.icon;
            this.impactArrow.style.color = visualIndicators.color;
            
            // Update before/after scores
            this.beforeScore.textContent = `${impact.currentTrustScore.toFixed(0)}%`;
            this.afterScore.textContent = `${impact.newTrustScore.toFixed(0)}%`;
            this.afterScore.style.color = visualIndicators.color;
            
            // Show preview
            this.showPreview();
            
            console.log('Rating impact calculated:', impact);
            
        } catch (error) {
            console.error('Error calculating rating impact:', error);
            this.hidePreview();
        }
    }
    
    showPreview() {
        if (this.previewContainer) {
            this.previewContainer.classList.remove('hidden');
            this.previewContainer.classList.add('visible');
        }
    }
    
    hidePreview() {
        if (this.previewContainer) {
            this.previewContainer.classList.remove('visible');
            this.previewContainer.classList.add('hidden');
        }
    }
    
    calculateRatingImpact() {
        if (this.selectedRating === 0) return 0;
        
        // Convert 1-5 star rating to 0-100 scale
        const baseScore = (this.selectedRating - 1) * 25; // 1=0, 2=25, 3=50, 4=75, 5=100
        
        // Apply flag penalties
        let penalties = 0;
        this.selectedFlags.forEach(flag => {
            penalties += this.penalties[flag] || 0;
        });
        
        const effectiveScore = Math.max(0, baseScore - penalties);
        
        // Calculate impact relative to current trust score
        const impact = effectiveScore - this.currentTrustScore;
        
        return Math.round(impact);
    }
    
    updateCurrentTrustScore(score, data = {}) {
        this.currentTrustScore = score || 50;
        
        // Update LocalScoreCalculator with current score and data
        localScoreCalculator.updateCurrentScore(score, data);
        
        // Update preview if rating is selected
        if (this.selectedRating > 0) {
            this.updatePreview();
        }
    }
    
    submitRating() {
        if (this.selectedRating === 0) {
            // Show error notification
            if (window.notificationManager) {
                window.notificationManager.show('Please select a star rating first', 'error');
            }
            return;
        }
        
        // Prevent double submission
        if (this.isSubmitting) {
            console.log('Rating submission already in progress');
            return;
        }
        
        this.isSubmitting = true;
        
        // Calculate and show immediate UI update before server response
        this.showImmediateScoreUpdate();
        
        // Trigger the hidden submit button to maintain compatibility with existing code
        if (this.hiddenSubmitButton) {
            this.hiddenSubmitButton.click();
        }
        
        // Add success animation to the interface
        this.animateSubmission();
        
        console.log('Rating submitted:', {
            rating: this.selectedRating,
            flags: Array.from(this.selectedFlags),
            impact: this.calculateRatingImpact()
        });
        
        // Reset submission flag after a delay
        setTimeout(() => {
            this.isSubmitting = false;
        }, 2000);
    }
    
    showImmediateScoreUpdate() {
        try {
            // Calculate impact using LocalScoreCalculator
            const flags = {
                spam: this.selectedFlags.has('spam'),
                misleading: this.selectedFlags.has('misleading'),
                scam: this.selectedFlags.has('scam')
            };
            
            const impact = localScoreCalculator.calculateRatingImpact(this.selectedRating, flags);
            
            // Update trust score display immediately with local calculation
            const trustScoreSpan = document.getElementById('trust-score');
            const progressRing = document.getElementById('progress-ring');
            
            if (trustScoreSpan) {
                // Animate the score change
                const currentScore = parseFloat(trustScoreSpan.textContent.replace('%', ''));
                const newScore = impact.newTrustScore;
                
                this.animateScoreChange(trustScoreSpan, progressRing, currentScore, newScore);
                
                // Save the locally calculated score to cache so it persists on extension reopen
                this.saveLocalScoreToCache(impact);
                
                // No notification needed - the visual score change and preview are sufficient feedback
            }
            
        } catch (error) {
            console.error('Error showing immediate score update:', error);
        }
    }
    
    saveLocalScoreToCache(impact) {
        try {
            // Get current URL from global accessor
            const currentUrl = window.getCurrentUrl ? window.getCurrentUrl() : document.getElementById('current-url')?.textContent;
            if (!currentUrl) {
                console.warn('Cannot save local score - no current URL available');
                return;
            }
            
            // Create updated data with the new local score
            const updatedData = {
                ...localScoreCalculator.currentData,
                final_trust_score: impact.newTrustScore,
                trust_score: impact.newTrustScore,
                rating_count: impact.newRatingCount,
                data_source: 'local_calculation',
                local_update: true,
                timestamp: Date.now()
            };
            
            // Save to cache using the same cache system as popup.js
            const LOCALSTORAGE_PREFIX = 'urlrater_stats_';
            const cacheData = {
                data: updatedData,
                timestamp: Date.now()
            };
            
            // Save to localStorage
            try {
                localStorage.setItem(LOCALSTORAGE_PREFIX + currentUrl, JSON.stringify(cacheData));
                console.log('Local score saved to cache:', {
                    url: currentUrl,
                    newScore: impact.newTrustScore,
                    ratingCount: impact.newRatingCount
                });
            } catch (storageError) {
                console.error('Error saving to localStorage:', storageError);
            }
            
            // Also update the in-memory cache if available
            if (window.statsCache) {
                window.statsCache.set(currentUrl, cacheData);
            }
            
        } catch (error) {
            console.error('Error saving local score to cache:', error);
        }
    }
    
    animateScoreChange(scoreElement, progressElement, fromScore, toScore) {
        const duration = 1000; // 1 second animation
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate score
            const currentScore = fromScore + (toScore - fromScore) * easeOutCubic;
            
            // Update display
            scoreElement.textContent = `${Math.round(currentScore)}%`;
            
            // Update progress ring if available
            if (progressElement) {
                this.updateProgressRing(progressElement, currentScore);
            }
            
            // Continue animation
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    updateProgressRing(progressElement, score) {
        // Calculate the circumference of the circle (2 * π * radius)
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        
        // Calculate the stroke-dashoffset based on percentage
        const percentage = Math.max(0, Math.min(100, score));
        const offset = circumference - (percentage / 100) * circumference;
        
        // Determine color based on score
        let strokeColor;
        if (score >= 75) {
            strokeColor = '#34D399'; // Green for 75%+ (good/excellent)
        } else if (score >= 50) {
            strokeColor = '#93C5FD'; // Blue for 50-74% (fair/good)
        } else if (score >= 25) {
            strokeColor = '#FBBF24'; // Yellow for 25-49% (poor/fair)
        } else if (score > 0) {
            strokeColor = '#F87171'; // Red for 1-24% (very poor)
        } else {
            strokeColor = 'rgba(255, 255, 255, 0.2)'; // Gray for unknown
        }
        
        // Update the progress ring
        progressElement.style.strokeDasharray = circumference;
        progressElement.style.strokeDashoffset = offset;
        progressElement.style.stroke = strokeColor;
        
        // Add a subtle glow effect based on score
        if (score > 0) {
            progressElement.style.filter = `drop-shadow(0 0 8px ${strokeColor}80)`;
        } else {
            progressElement.style.filter = 'none';
        }
    }
    
    animateSubmission() {
        // Create flying stars effect
        const selectedStars = this.starContainer.querySelectorAll('.ultra-star-expanded.active');
        
        selectedStars.forEach((star, index) => {
            // Clone the star for animation
            const flyingStar = star.cloneNode(true);
            flyingStar.style.position = 'fixed';
            flyingStar.style.zIndex = '10000';
            flyingStar.style.pointerEvents = 'none';
            flyingStar.style.fontSize = '24px';
            flyingStar.style.color = '#34D399';
            flyingStar.style.textShadow = '0 0 10px rgba(52, 211, 153, 0.8)';
            
            // Get star position
            const rect = star.getBoundingClientRect();
            flyingStar.style.left = rect.left + 'px';
            flyingStar.style.top = rect.top + 'px';
            
            document.body.appendChild(flyingStar);
            
            // Animate star flying away
            const randomX = (Math.random() - 0.5) * 400; // Random horizontal direction
            const randomY = -200 - Math.random() * 100; // Fly upward
            const randomRotation = Math.random() * 720 - 360; // Random rotation
            
            flyingStar.style.transition = 'all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            flyingStar.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${randomRotation}deg) scale(0.2)`;
            flyingStar.style.opacity = '0';
            
            // Remove the flying star after animation
            setTimeout(() => {
                if (flyingStar.parentNode) {
                    flyingStar.parentNode.removeChild(flyingStar);
                }
            }, 1200);
            
            // Stagger the animation for multiple stars
            setTimeout(() => {
                flyingStar.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${randomRotation}deg) scale(0.2)`;
                flyingStar.style.opacity = '0';
            }, index * 100);
        });
        
        // Add success glow to the interface
        const ratingInterface = document.querySelector('.ultra-compact-rating');
        if (ratingInterface) {
            ratingInterface.style.boxShadow = '0 0 30px rgba(52, 211, 153, 0.6)';
            ratingInterface.style.transform = 'scale(1.02)';
            
            setTimeout(() => {
                ratingInterface.style.boxShadow = '';
                ratingInterface.style.transform = '';
            }, 800);
        }
    }
    
    reset() {
        // Reset all selections
        this.selectedRating = 0;
        this.selectedFlags.clear();
        
        // Reset UI
        this.highlightStars(0);
        
        // Remove primed effects from all stars
        const allStars = this.starContainer.querySelectorAll('.ultra-star-expanded');
        allStars.forEach(star => {
            star.classList.remove('primed');
            star.style.animation = '';
        });
        
        // Hide impact preview
        this.hidePreview();
        
        const flagButtons = this.flagContainer.querySelectorAll('.ultra-flag-btn');
        flagButtons.forEach(button => {
            button.classList.remove('active');
        });
        
        // Reset hidden form elements
        if (this.hiddenRatingSelect) this.hiddenRatingSelect.value = '';
        if (this.hiddenSpamCheckbox) this.hiddenSpamCheckbox.checked = false;
        if (this.hiddenMisleadingCheckbox) this.hiddenMisleadingCheckbox.checked = false;
        if (this.hiddenScamCheckbox) this.hiddenScamCheckbox.checked = false;
        
        console.log('Compact rating interface reset');
    }
    
    // Method to be called when trust score is updated
    onTrustScoreUpdate(score, data = {}) {
        this.updateCurrentTrustScore(score, data);
    }
    
    // Method to force initialization when rating section becomes visible
    forceInit() {
        this.isInitialized = false;
        this.init();
    }
    
    // Method to be called after successful rating submission
    onRatingSubmitted() {
        // Reset submission flag
        this.isSubmitting = false;
        
        // Don't reset immediately - let the animation play first
        setTimeout(() => {
            this.reset();
        }, 1500); // Wait for flying stars animation to complete
    }
    
    createRatingGuideTooltip() {
        // Create tooltip container
        this.ratingGuideTooltip = document.createElement('div');
        this.ratingGuideTooltip.className = 'rating-guide-tooltip hidden';
        this.ratingGuideTooltip.setAttribute('role', 'dialog');
        this.ratingGuideTooltip.setAttribute('aria-labelledby', 'rating-guide-title');
        
        this.ratingGuideTooltip.innerHTML = `
            <div class="rating-guide-header">
                <h3 id="rating-guide-title">Rating Guide</h3>
                <button class="rating-guide-close" aria-label="Close guide">&times;</button>
            </div>
            <div class="rating-guide-content">
                <h4>How Ratings Work</h4>
                <ul>
                    <li><span class="highlight">⭐ Star Ratings:</span> Higher stars improve the site's trust score</li>
                    <li><span class="highlight">🔴 Quality Issues:</span> Flagging issues reduces the trust score</li>
                    <li><span class="highlight">📊 Community Impact:</span> Your rating helps other users make informed decisions</li>
                </ul>
                
                <h4>Quality Issue Types</h4>
                <ul>
                    <li><span class="highlight">Spam/Ads:</span> Excessive advertising, spam content, or poor functionality</li>
                    <li><span class="highlight">Misleading:</span> False or deceptive information</li>
                    <li><span class="highlight">Suspicious:</span> Potentially harmful or fraudulent activity</li>
                </ul>
            </div>
        `;
        
        document.body.appendChild(this.ratingGuideTooltip);
        
        // Setup event listeners
        const closeBtn = this.ratingGuideTooltip.querySelector('.rating-guide-close');
        closeBtn.addEventListener('click', () => {
            this.hideRatingGuide();
        });
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isGuideVisible && 
                !this.ratingGuideTooltip.contains(e.target) && 
                e.target !== this.ratingGuideButton) {
                this.hideRatingGuide();
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isGuideVisible) {
                this.hideRatingGuide();
            }
        });
        
        // Prevent tooltip from closing when clicking inside
        this.ratingGuideTooltip.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    toggleRatingGuide() {
        if (this.isGuideVisible) {
            this.hideRatingGuide();
        } else {
            this.showRatingGuide();
        }
    }
    
    showRatingGuide() {
        if (!this.ratingGuideTooltip) return;
        
        this.ratingGuideTooltip.classList.remove('hidden');
        this.ratingGuideTooltip.classList.add('show');
        this.isGuideVisible = true;
        
        // Focus management for accessibility
        this.ratingGuideTooltip.focus();
    }
    
    hideRatingGuide() {
        if (!this.ratingGuideTooltip) return;
        
        this.ratingGuideTooltip.classList.remove('show');
        this.ratingGuideTooltip.classList.add('hidden');
        this.isGuideVisible = false;
        
        // Return focus to trigger button
        if (this.ratingGuideButton) {
            this.ratingGuideButton.focus();
        }
    }
}

// Create global instance
const compactRatingManager = new CompactRatingManager();

// Make available globally for debugging
window.compactRatingManager = compactRatingManager;

// Export for use in other modules
export { compactRatingManager };
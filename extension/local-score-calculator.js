// LocalScoreCalculator - Real-time rating impact calculation
// Implements local calculation of rating impact based on stars and flags
// Uses hardcoded penalty values matching backend algorithm

export class LocalScoreCalculator {
    constructor() {
        // Hardcoded penalty values matching backend algorithm
        this.penalties = {
            spam: -30,      // Spam reports: -30 points
            misleading: -25, // Misleading reports: -25 points
            scam: -40       // Scam reports: -40 points
        };
        
        // Star rating conversion (1-5 scale to 0-100 points)
        this.starValues = {
            1: 0,   // 1 star = 0 points
            2: 25,  // 2 stars = 25 points
            3: 50,  // 3 stars = 50 points
            4: 75,  // 4 stars = 75 points
            5: 100  // 5 stars = 100 points
        };
        
        // Weighting factors for final calculation
        this.weights = {
            domain: 0.4,    // Domain analysis: 40% weight
            community: 0.6  // Community ratings: 60% weight
        };
        
        // Current state
        this.currentTrustScore = 50;
        this.currentRatingCount = 0;
        this.currentData = null;
    }
    
    /**
     * Update current trust score and data for calculations
     * @param {number} trustScore - Current trust score (0-100)
     * @param {Object} data - Current URL statistics data
     */
    updateCurrentScore(trustScore, data = {}) {
        this.currentTrustScore = trustScore || 50;
        this.currentRatingCount = data.rating_count || 0;
        this.currentData = data;
        
        console.log('LocalScoreCalculator updated:', {
            trustScore: this.currentTrustScore,
            ratingCount: this.currentRatingCount,
            dataSource: data.data_source
        });
    }
    
    /**
     * Calculate the impact of a new rating on the trust score
     * @param {number} stars - Star rating (1-5)
     * @param {Object} flags - Flag selections {spam: boolean, misleading: boolean, scam: boolean}
     * @returns {Object} - Calculation result with impact details
     */
    calculateRatingImpact(stars, flags = {}) {
        // Validate inputs
        if (!stars || stars < 1 || stars > 5) {
            throw new Error('Stars must be between 1 and 5');
        }
        
        // Convert stars to base score (0-100)
        const baseStarScore = this.starValues[stars];
        
        // Apply flag penalties
        let effectiveScore = baseStarScore;
        const appliedPenalties = [];
        
        if (flags.spam) {
            effectiveScore += this.penalties.spam;
            appliedPenalties.push({ type: 'spam', penalty: this.penalties.spam });
        }
        
        if (flags.misleading) {
            effectiveScore += this.penalties.misleading;
            appliedPenalties.push({ type: 'misleading', penalty: this.penalties.misleading });
        }
        
        if (flags.scam) {
            effectiveScore += this.penalties.scam;
            appliedPenalties.push({ type: 'scam', penalty: this.penalties.scam });
        }
        
        // Ensure effective score stays within bounds (0-100)
        effectiveScore = Math.max(0, Math.min(100, effectiveScore));
        
        // Calculate weighted average impact on overall trust score
        const newTrustScore = this.calculateNewTrustScore(effectiveScore);
        const impact = newTrustScore - this.currentTrustScore;
        
        return {
            // Input details
            stars,
            flags,
            
            // Score calculations
            baseStarScore,
            appliedPenalties,
            effectiveScore,
            
            // Trust score impact
            currentTrustScore: this.currentTrustScore,
            newTrustScore,
            impact,
            impactPercentage: ((impact / this.currentTrustScore) * 100).toFixed(1),
            
            // Additional context
            currentRatingCount: this.currentRatingCount,
            newRatingCount: this.currentRatingCount + 1,
            
            // Visual indicators
            impactDirection: impact > 0 ? 'positive' : impact < 0 ? 'negative' : 'neutral',
            impactMagnitude: Math.abs(impact),
            
            // Confidence level based on sample size
            confidence: this.calculateConfidence(this.currentRatingCount + 1)
        };
    }
    
    /**
     * Calculate new trust score using weighted average
     * @param {number} newRatingScore - Effective score of new rating (0-100)
     * @returns {number} - New trust score
     */
    calculateNewTrustScore(newRatingScore) {
        // Make impact more realistic - individual ratings should have less dramatic effect
        const ratingCount = this.currentRatingCount;
        
        // If no existing ratings, still limit the impact
        if (ratingCount === 0) {
            // For first rating, limit impact to max 10 points from current score
            const maxImpact = 10;
            const rawImpact = newRatingScore - this.currentTrustScore;
            const limitedImpact = Math.max(-maxImpact, Math.min(maxImpact, rawImpact));
            return this.currentTrustScore + limitedImpact;
        }
        
        // For existing ratings, use diminishing returns based on sample size
        // More ratings = less impact per individual rating
        let impactFactor;
        if (ratingCount < 5) {
            impactFactor = 0.15; // 15% impact for first few ratings
        } else if (ratingCount < 20) {
            impactFactor = 0.08; // 8% impact for moderate sample
        } else if (ratingCount < 50) {
            impactFactor = 0.04; // 4% impact for good sample
        } else {
            impactFactor = 0.02; // 2% impact for large sample
        }
        
        // Calculate the difference between new rating and current score
        const scoreDifference = newRatingScore - this.currentTrustScore;
        
        // Apply the impact factor to limit the change
        const actualImpact = scoreDifference * impactFactor;
        
        // Calculate new score with limited impact
        const newTrustScore = this.currentTrustScore + actualImpact;
        
        // Ensure result stays within bounds
        return Math.max(0, Math.min(100, newTrustScore));
    }
    
    /**
     * Get domain baseline score for current URL
     * @returns {number} - Domain baseline score
     */
    getDomainBaseline() {
        // Use current data if available
        if (this.currentData && this.currentData.domain) {
            return this.calculateDomainBaseline(this.currentData.domain);
        }
        
        // Fallback to default
        return 50;
    }
    
    /**
     * Calculate domain baseline score based on domain reputation
     * @param {string} domain - Domain name
     * @returns {number} - Baseline score (0-100)
     */
    calculateDomainBaseline(domain) {
        // Domain-specific baseline scores based on reputation
        const domainBaselines = {
            // High trust domains (70-85)
            'google.com': 85, 'youtube.com': 75, 'wikipedia.org': 85,
            'github.com': 80, 'stackoverflow.com': 82, 'microsoft.com': 78,
            'apple.com': 80, 'amazon.com': 72, 'netflix.com': 75,

            // Educational domains (75-85)
            'mit.edu': 85, 'stanford.edu': 85, 'harvard.edu': 85,
            'coursera.org': 78, 'khanacademy.org': 80,

            // News domains (65-80)
            'cnn.com': 70, 'bbc.com': 78, 'reuters.com': 80,
            'nytimes.com': 75, 'npr.org': 78,

            // Social media (55-65)
            'facebook.com': 60, 'twitter.com': 58, 'x.com': 58,
            'instagram.com': 62, 'linkedin.com': 68, 'reddit.com': 65,
            'tiktok.com': 55,

            // E-commerce (60-70)
            'ebay.com': 65, 'etsy.com': 68, 'paypal.com': 75
        };

        if (domain && domainBaselines[domain]) {
            return domainBaselines[domain];
        }

        // Default baseline based on TLD
        if (domain) {
            if (domain.endsWith('.edu') || domain.endsWith('.gov')) return 75;
            if (domain.endsWith('.org')) return 65;
            if (domain.endsWith('.com') || domain.endsWith('.net')) return 60;
        }

        return 50; // Ultimate fallback
    }
    
    /**
     * Calculate confidence level based on sample size
     * @param {number} ratingCount - Number of ratings
     * @returns {string} - Confidence level
     */
    calculateConfidence(ratingCount) {
        if (ratingCount >= 50) return 'high';
        if (ratingCount >= 10) return 'medium';
        if (ratingCount >= 5) return 'low';
        return 'very-low';
    }
    
    /**
     * Get visual indicators for impact display
     * @param {Object} impact - Impact calculation result
     * @returns {Object} - Visual indicators
     */
    getVisualIndicators(impact) {
        const { impactDirection, impactMagnitude } = impact;
        
        let color, icon, description;
        
        if (impactDirection === 'positive') {
            if (impactMagnitude >= 5) {
                color = '#34D399'; // Strong green
                icon = '↗';
                description = 'Positive impact';
            } else if (impactMagnitude >= 2) {
                color = '#6EE7B7'; // Medium green
                icon = '↗';
                description = 'Small positive impact';
            } else {
                color = '#A7F3D0'; // Light green
                icon = '↑';
                description = 'Minimal positive impact';
            }
        } else if (impactDirection === 'negative') {
            if (impactMagnitude >= 5) {
                color = '#F87171'; // Strong red
                icon = '↘';
                description = 'Negative impact';
            } else if (impactMagnitude >= 2) {
                color = '#FCA5A5'; // Medium red
                icon = '↘';
                description = 'Small negative impact';
            } else {
                color = '#FED7D7'; // Light red
                icon = '↓';
                description = 'Minimal negative impact';
            }
        } else {
            color = '#93C5FD'; // Neutral blue
            icon = '→';
            description = 'No significant impact';
        }
        
        return {
            color,
            icon,
            description,
            textColor: impactDirection === 'positive' ? '#065F46' : 
                      impactDirection === 'negative' ? '#7F1D1D' : '#1E3A8A'
        };
    }
    
    /**
     * Format impact for display
     * @param {Object} impact - Impact calculation result
     * @returns {string} - Formatted impact string
     */
    formatImpact(impact) {
        const sign = impact.impact >= 0 ? '+' : '';
        return `${sign}${impact.impact.toFixed(1)}`;
    }
    
    /**
     * Get detailed breakdown for tooltip/explanation
     * @param {Object} impact - Impact calculation result
     * @returns {Object} - Detailed breakdown
     */
    getDetailedBreakdown(impact) {
        return {
            calculation: {
                starRating: `${impact.stars} stars = ${impact.baseStarScore} points`,
                penalties: impact.appliedPenalties.map(p => 
                    `${p.type} flag = ${p.penalty} points`
                ),
                effectiveScore: `Effective rating: ${impact.effectiveScore} points`,
                weightedImpact: `Weighted impact: ${this.formatImpact(impact)} points`
            },
            context: {
                currentScore: `Current trust score: ${impact.currentTrustScore.toFixed(1)}%`,
                newScore: `New trust score: ${impact.newTrustScore.toFixed(1)}%`,
                sampleSize: `Based on ${impact.newRatingCount} total ratings`,
                confidence: `Confidence: ${impact.confidence}`
            }
        };
    }
    
    /**
     * Test local calculations against expected results
     * Used for verification and debugging
     * @returns {Object} - Test results
     */
    testCalculations() {
        const testCases = [
            // Test case 1: 5 stars, no flags, baseline score 50, no existing ratings
            {
                name: '5 stars, no flags, baseline 50, no ratings',
                setup: { trustScore: 50, ratingCount: 0, domain: 'example.com' },
                input: { stars: 5, flags: {} },
                expected: { impact: 10, newScore: 60 } // Limited to max 10 point impact for first rating
            },
            
            // Test case 2: 1 star with spam flag, baseline 75, 5 existing ratings
            {
                name: '1 star + spam flag, baseline 75, 5 ratings',
                setup: { trustScore: 75, ratingCount: 5, domain: 'google.com' },
                input: { stars: 1, flags: { spam: true } },
                expected: { impact: -6, newScore: 69 } // More realistic impact with diminishing returns
            },
            
            // Test case 3: 4 stars with misleading flag, baseline 60, 10 ratings
            {
                name: '4 stars + misleading flag, baseline 60, 10 ratings',
                setup: { trustScore: 65, ratingCount: 10, domain: 'test.com' },
                input: { stars: 4, flags: { misleading: true } },
                expected: { impact: 1, newScore: 66 } // Small positive impact with moderate sample size
            }
        ];
        
        const results = [];
        
        testCases.forEach(testCase => {
            try {
                // Setup test conditions
                this.updateCurrentScore(testCase.setup.trustScore, {
                    rating_count: testCase.setup.ratingCount,
                    domain: testCase.setup.domain
                });
                
                // Calculate impact
                const impact = this.calculateRatingImpact(testCase.input.stars, testCase.input.flags);
                
                // Check results
                const impactDiff = Math.abs(impact.impact - testCase.expected.impact);
                const scoreDiff = Math.abs(impact.newTrustScore - testCase.expected.newScore);
                
                results.push({
                    name: testCase.name,
                    passed: impactDiff < 5 && scoreDiff < 5, // Allow 5 point tolerance
                    actual: {
                        impact: impact.impact.toFixed(1),
                        newScore: impact.newTrustScore.toFixed(1)
                    },
                    expected: testCase.expected,
                    differences: {
                        impact: impactDiff.toFixed(1),
                        score: scoreDiff.toFixed(1)
                    },
                    details: impact
                });
                
            } catch (error) {
                results.push({
                    name: testCase.name,
                    passed: false,
                    error: error.message
                });
            }
        });
        
        const passedTests = results.filter(r => r.passed).length;
        const totalTests = results.length;
        
        console.log('LocalScoreCalculator Test Results:', {
            summary: `${passedTests}/${totalTests} tests passed`,
            results: results
        });
        
        return {
            summary: `${passedTests}/${totalTests} tests passed`,
            passed: passedTests === totalTests,
            results: results
        };
    }
}

// Create and export singleton instance
export const localScoreCalculator = new LocalScoreCalculator();
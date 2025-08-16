# Requirements Document

## Introduction

The URL Rating Extension is experiencing API errors with the URL/stats GET and POST endpoints in the Supabase edge functions. Users are unable to fetch URL statistics or submit ratings, which are core features of the extension. This debugging effort aims to identify and resolve the root causes of these API failures to restore full functionality.

## Requirements

### Requirement 1

**User Story:** As a user, I want to view trust scores and statistics for any URL, so that I can make informed decisions about website trustworthiness.

#### Acceptance Criteria

1. WHEN a user opens the extension on any webpage THEN the system SHALL fetch and display URL statistics without errors
2. WHEN the API returns URL statistics THEN the system SHALL display trust score, rating count, and report counts correctly
3. IF no statistics exist for a specific URL THEN the system SHALL fall back to domain-level statistics (e.g., YouTube video falls back to youtube.com rating)
4. WHEN displaying statistics THEN the system SHALL show the most accurate available data (URL-specific preferred over domain-level)
5. WHEN there are network or API errors THEN the system SHALL display clear error messages to the user
6. WHEN no data exists for URL or domain THEN the system SHALL display appropriate baseline scores and messaging

### Requirement 2

**User Story:** As an authenticated user, I want to submit ratings and reports for URLs, so that I can contribute to the community trust scoring system.

#### Acceptance Criteria

1. WHEN an authenticated user submits a rating THEN the system SHALL successfully save the rating to the database
2. WHEN a rating is submitted THEN the system SHALL save the domain information for domain analysis
3. WHEN a rating is submitted THEN the system SHALL check if domain exists in cache and trigger analysis if needed
4. WHEN a rating is submitted THEN the system SHALL provide immediate feedback to the user showing their rating was received
5. WHEN a rating is submitted THEN the system SHALL return current statistics even if background processing is still occurring
6. WHEN there are authentication issues THEN the system SHALL return appropriate 401 errors with clear messages
7. WHEN there are validation errors THEN the system SHALL return 400 errors with specific field validation messages

### Requirement 3

**User Story:** As a developer, I want comprehensive error logging and debugging information, so that I can quickly identify and resolve API issues.

#### Acceptance Criteria

1. WHEN API errors occur THEN the system SHALL log detailed error information including request/response data
2. WHEN database operations fail THEN the system SHALL log specific database error messages and context
3. WHEN authentication fails THEN the system SHALL log authentication error details without exposing sensitive data
4. WHEN CORS issues occur THEN the system SHALL log CORS-related error information

### Requirement 4

**User Story:** As a system administrator, I want proper request routing and path handling, so that API endpoints respond correctly to all valid requests.

#### Acceptance Criteria

1. WHEN requests are made to /url-stats THEN the system SHALL route to the correct handler function
2. WHEN requests are made to /rating THEN the system SHALL route to the correct handler function
3. WHEN invalid paths are requested THEN the system SHALL return 404 errors with appropriate messages
4. WHEN OPTIONS requests are made THEN the system SHALL return proper CORS headers

### Requirement 5

**User Story:** As a user, I want consistent authentication handling across all API endpoints, so that my login status is properly recognized.

#### Acceptance Criteria

1. WHEN making authenticated requests THEN the system SHALL properly validate JWT tokens
2. WHEN tokens are invalid or expired THEN the system SHALL return 401 errors with refresh instructions
3. WHEN making unauthenticated requests to public endpoints THEN the system SHALL allow access without authentication
4. WHEN authentication headers are malformed THEN the system SHALL return clear validation error messages
5. WHEN accessing URL statistics THEN the system SHALL work regardless of authentication status
6. WHEN submitting ratings THEN the system SHALL require authentication but provide clear feedback about auth requirements

### Requirement 6

**User Story:** As a system administrator, I want background processing to handle rating aggregation and domain analysis, so that the system can scale efficiently while providing immediate user feedback.

#### Acceptance Criteria

1. WHEN ratings are submitted THEN the system SHALL mark them for processing by the 5-minute cron job
2. WHEN the cron job runs THEN the system SHALL process unprocessed ratings and update URL statistics
3. WHEN processing ratings THEN the system SHALL update both URL-specific and domain-level statistics
4. WHEN domain analysis is needed THEN the system SHALL check cache first before triggering new analysis
5. WHEN users submit ratings THEN the system SHALL provide immediate feedback without waiting for background processing
6. WHEN background processing fails THEN the system SHALL log errors and retry on next cron cycle

### Requirement 7

**User Story:** As a system administrator, I want the system to operate within API limits and scale efficiently, so that costs remain manageable and performance stays optimal.

#### Acceptance Criteria

1. WHEN making external API calls THEN the system SHALL implement proper caching to avoid redundant requests
2. WHEN users request URL statistics THEN the system SHALL use cached data when available and fresh
3. WHEN multiple requests are made for the same data THEN the system SHALL batch or deduplicate requests
4. WHEN API rate limits are approached THEN the system SHALL implement backoff strategies and queue management
5. WHEN caching data THEN the system SHALL respect appropriate TTL values to balance freshness with efficiency
6. WHEN processing ratings THEN the system SHALL batch operations to minimize database calls
7. WHEN triggering domain analysis THEN the system SHALL check cache expiration before making external API calls
/**
 * Validation utilities for email, URL, and other common validations
 */

/**
 * Validates email address using a more robust regex pattern
 * This pattern is more strict than the basic one and rejects invalid formats
 */
export const isValidEmail = (email: string): boolean => {
  // RFC 5322 compliant email regex (simplified but more robust)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
};

/**
 * Validates URL using Node.js URL constructor
 * Ensures the URL is properly formatted and has a valid protocol
 */
export const isValidUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates tags array
 * - Maximum 20 tags
 * - Each tag must be 2-30 characters
 * - Trims whitespace and converts to lowercase
 */
export const validateTags = (tags: string[]): { isValid: boolean; error?: string; normalized?: string[] } => {
  if (!Array.isArray(tags)) {
    return { isValid: false, error: 'Tags must be an array' };
  }

  if (tags.length > 20) {
    return { isValid: false, error: 'Cannot have more than 20 tags' };
  }

  const normalized: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') {
      return { isValid: false, error: 'Each tag must be a string' };
    }

    const trimmed = tag.trim();
    if (trimmed.length < 2) {
      return { isValid: false, error: 'Each tag must be at least 2 characters long' };
    }
    if (trimmed.length > 30) {
      return { isValid: false, error: 'Each tag cannot exceed 30 characters' };
    }

    normalized.push(trimmed.toLowerCase());
  }

  return { isValid: true, normalized };
};


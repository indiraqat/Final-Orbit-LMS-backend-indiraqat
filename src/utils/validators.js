const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a plain object against a small rule schema.
 *
 * schema = {
 *   fieldName: {
 *     required: true,
 *     type: 'string' | 'number' | 'boolean',
 *     minLength: 8,
 *     maxLength: 255,
 *     email: true,
 *     enum: ['ADMIN', 'INTERN'],
 *   },
 *   ...
 * }
 *
 * Returns an array of human-readable error strings — empty array means valid.
 */
function validate(data, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data ? data[field] : undefined;
    const isEmpty = value === undefined || value === null || value === '';

    if (rules.required && isEmpty) {
      errors.push(`"${field}" is required.`);
      continue;
    }

    if (isEmpty) continue; // optional field, nothing else to check

    if (rules.type && typeof value !== rules.type) {
      errors.push(`"${field}" must be a ${rules.type}.`);
      continue;
    }

    if (rules.type === 'string') {
      if (rules.minLength !== undefined && value.trim().length < rules.minLength) {
        errors.push(`"${field}" must be at least ${rules.minLength} characters.`);
      }
      if (rules.maxLength !== undefined && value.trim().length > rules.maxLength) {
        errors.push(`"${field}" must be at most ${rules.maxLength} characters.`);
      }
      if (rules.email && !EMAIL_REGEX.test(value.trim())) {
        errors.push(`"${field}" must be a valid email address.`);
      }
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`"${field}" must be one of: ${rules.enum.join(', ')}.`);
    }
  }

  return errors;
}

module.exports = { validate, EMAIL_REGEX };

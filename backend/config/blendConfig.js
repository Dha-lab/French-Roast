/**
 * Shared Authoritative Coffee Blend Configuration for Whole Bean
 *
 * French Roast Signature Whole Bean Blend Rules:
 * - Robusta minimum: 0%
 * - Robusta maximum: 20%
 * - Arabica minimum: 80%
 * - Arabica maximum: 100%
 * - Arabica percentage + Robusta percentage must always equal exactly 100%
 * - Chicory is excluded (0.0% — 100% Pure Coffee Beans)
 *
 * Default Whole Bean Formulation:
 * - Arabica: 80% (200.0 g per 250 g pack)
 * - Robusta: 20% (50.0 g per 250 g pack)
 * - Chicory: 0% (0.0 g)
 */

export const APPROVED_WHOLE_BEAN_RECIPE = Object.freeze({
  customizationEnabled: true,
  arabicaPercentage: 80,
  robustaPercentage: 20,
  chicoryPercentage: 0,
  defaultArabica: 80,
  defaultRobusta: 20,
  defaultChicory: 0,
  minArabica: 80,
  maxArabica: 100,
  minRobusta: 0,
  maxRobusta: 20,
  minChicory: 0,
  maxChicory: 0,
  step: 1,
  packWeight: 250,
  totalGrams: 250,
  arabicaGrams: 200.0,
  robustaGrams: 50.0,
  chicoryGrams: 0.0,
  productType: 'Whole Bean',
  version: 1
});

// Legacy fallback for historical Powder orders
export const APPROVED_POWDER_RECIPE = Object.freeze({
  arabicaPercentage: 80,
  robustaPercentage: 20,
  chicoryPercentage: 0,
  packWeight: 250,
  totalGrams: 250,
  arabicaGrams: 200.0,
  robustaGrams: 50.0,
  chicoryGrams: 0.0,
  customizationEnabled: false,
  minArabica: 80,
  maxArabica: 80,
  minRobusta: 20,
  maxRobusta: 20,
  minChicory: 0,
  maxChicory: 0,
  step: 1,
  productType: 'Powder',
  version: 1
});

/**
 * Calculates exact grams for a given pack weight and percentage.
 * Exact rounding to 1 decimal place.
 */
export const calculateGrams = (packWeight, percentage) => {
  return Math.round((packWeight * (percentage / 100)) * 10) / 10;
};


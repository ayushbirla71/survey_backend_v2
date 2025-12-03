/**
 * Quota Management Utility Functions
 */

/**
 * Calculate total quota from count or percentage
 */
export function calculateTotalQuota(quotas, total_target) {
  if (!quotas || quotas.length === 0) return 0;

  return quotas.reduce((sum, quota) => {
    if (quota.quota_type === "COUNT") {
      return sum + (quota.target_count || 0);
    } else if (quota.quota_type === "PERCENTAGE") {
      return sum + Math.round((quota.target_percentage / 100) * total_target);
    }
    return sum;
  }, 0);
}

/**
 * Validate that percentage quotas sum to 100%
 */
export function validatePercentageQuotas(quotas) {
  if (!quotas || quotas.length === 0) return { valid: true };

  const percentageQuotas = quotas.filter((q) => q.quota_type === "PERCENTAGE");
  if (percentageQuotas.length === 0) return { valid: true };

  const totalPercentage = percentageQuotas.reduce(
    (sum, q) => sum + (q.target_percentage || 0),
    0
  );

  if (Math.abs(totalPercentage - 100) > 0.01) {
    return {
      valid: false,
      message: `Percentage quotas must sum to 100% (current: ${totalPercentage}%)`,
      currentTotal: totalPercentage,
    };
  }

  return { valid: true };
}

/**
 * Validate quota configuration
 */
export function validateQuotaConfiguration(quotaConfig) {
  const {
    total_target,
    age_quotas,
    gender_quotas,
    location_quotas,
    category_quotas,
  } = quotaConfig;

  const errors = [];

  // Helper to validate a quota group
  const validateQuotaGroup = (quotas, fieldName, displayName) => {
    if (!quotas || quotas.length === 0) return;

    // Check COUNT quotas sum
    const countQuotas = quotas.filter((q) => q.quota_type === "COUNT");
    if (countQuotas.length > 0 && countQuotas.length === quotas.length) {
      const totalCount = calculateTotalQuota(countQuotas, total_target);
      if (totalCount !== total_target) {
        errors.push({
          field: fieldName,
          message: `${displayName} sum (${totalCount}) does not match total target (${total_target})`,
          difference: total_target - totalCount,
        });
      }
    }

    // Validate percentage quotas
    const percentageResult = validatePercentageQuotas(quotas);
    if (!percentageResult.valid) {
      errors.push({
        field: fieldName,
        message: percentageResult.message,
        currentTotal: percentageResult.currentTotal,
      });
    }
  };

  validateQuotaGroup(age_quotas, "age_quotas", "Age quota");
  validateQuotaGroup(gender_quotas, "gender_quotas", "Gender quota");
  validateQuotaGroup(location_quotas, "location_quotas", "Location quota");
  validateQuotaGroup(category_quotas, "category_quotas", "Category quota");

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Process callback URL with placeholders
 */
export function processCallbackUrl(url, respondentData) {
  if (!url) return null;

  return url
    .replace(/{respondent_id}/g, respondentData.vendor_respondent_id || "")
    .replace(/{survey_id}/g, respondentData.surveyId || "")
    .replace(/{status}/g, respondentData.status || "")
    .replace(/{timestamp}/g, new Date().toISOString());
}

/**
 * Call vendor callback URL
 */
export async function callVendorCallback(url, method = "GET") {
  if (!url) return { success: false, error: "No URL provided" };

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    console.error("Vendor callback error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Calculate quota target from count or percentage
 */
export function getQuotaTarget(quota, totalTarget) {
  if (quota.quota_type === "COUNT") {
    return quota.target_count || 0;
  }
  return Math.round((quota.target_percentage / 100) * totalTarget);
}

/**
 * Format quota status response
 */
export function formatQuotaStatus(quota, totalTarget) {
  const target = getQuotaTarget(quota, totalTarget);
  const current = quota.current_count || 0;
  const remaining = Math.max(0, target - current);
  const percentageFilled = target > 0 ? (current / target) * 100 : 0;

  return {
    target,
    current,
    remaining,
    percentage_filled: Math.round(percentageFilled * 100) / 100,
    is_full: current >= target,
  };
}


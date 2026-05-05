// utils/roi.js
function loadRoiRules() {
  const raw = process.env.ROI_RULES;
  if (!raw) {
    console.warn("ROI_RULES is not set in ENV!");
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.error("ROI_RULES parsed value is not an array:", parsed);
      return [];
    }

    const normalized = parsed.map((rule, index) => {
      const min = Number(rule.min);
      const max =
        rule.max === null || rule.max === "null" || rule.max === ""
          ? null
          : Number(rule.max);
      const percent = Number(rule.percent);

      if (
        Number.isNaN(min) ||
        (max !== null && Number.isNaN(max)) ||
        Number.isNaN(percent)
      ) {
        console.error(`Invalid ROI rule at index ${index}:`, rule);
      }

      return {
        plan_id: index + 1,   
        min,
        max,
        percent
      };
    });

    console.log("Normalized ROI rules with plan_id:", normalized);
    return normalized;
  } catch (err) {
    console.error("Invalid ROI_RULES format in .env:", err.message);
    return [];
  }
}

export const roiRules = loadRoiRules();

export function findRoiRule(amount) {
  const amt = Number(amount);
  if (Number.isNaN(amt)) {
    console.error("findRoiRule called with non-numeric amount:", amount);
    return null;
  }

  if (!roiRules.length) {
    console.error("ROI rules are empty. Check ROI_RULES env.");
    return null;
  }

  const rule = roiRules.find((r) => {
    const minOK = amt >= r.min;
    const maxOK = r.max === null || amt <= r.max;
    return minOK && maxOK;
  });

  if (!rule) {
    console.error("No matching ROI rule for amount:", amt, "in rules:", roiRules);
    return null;
  }

  return rule;
}

export function getROI(amount) {
  const rule = findRoiRule(amount);
  if (!rule) return null;

  console.log(`getROI(${amount}) ->`, rule.percent);
  return rule.percent;
}

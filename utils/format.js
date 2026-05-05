export const formatCurrency = (v) => {
  const n = Number(v) || 0;
  return `$${n.toFixed(2)}`;
};

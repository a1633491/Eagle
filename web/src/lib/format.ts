export const numberCompact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 2 : 4,
  }).format(value);

export const currency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);

export const percent = (value: number) => `${value >= 0 ? '+' : ''}${numberCompact(value)}%`;

export const shorten = (value: string, left = 6, right = 4) => {
  if (value.length <= left + right) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
};

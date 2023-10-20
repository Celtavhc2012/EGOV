
export default (amount, precision = 8) => {
  const [whole, fraction] = Number(amount).toFixed(precision).replace(/0+$/, '').split('.')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}

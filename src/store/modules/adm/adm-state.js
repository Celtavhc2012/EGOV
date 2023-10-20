export default () => {
  return {
    address: '',
    areTransactionsLoading: false,
    areRecentLoading: false,
    areOlderLoading: false,
    transactions: {},
    transactionsCount: 0, 
    addressesValidated: false, 
    validatedCryptos: {},
    maxHeight: -1,
    minHeight: Infinity,
    bottomReached: false
  }
}

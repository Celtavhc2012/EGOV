import baseGetters from '../btc-base/btc-base-getters'
import BigNumber from '../../../lib/bignumber'
import { CryptosInfo } from '@/lib/constants'

const MULTIPLIER = 1e8

export default {
  ...baseGetters,

  fee: state => amount => {
    if (!state.utxo || !state.utxo.length || !state.feeRate) return 0

    const target = BigNumber(amount).times(MULTIPLIER).toNumber()

    const calculation = state.utxo.reduce((res, item) => {
      if ((res.fee + target) > res.total) {
        res.total += item.amount
        res.count += 1

        
        res.fee = (res.count * 181 + 78) * state.feeRate
      }
      return res
    }, { total: 0, count: 0, fee: 0 })

    return BigNumber(calculation.fee).div(MULTIPLIER).decimalPlaces(CryptosInfo['BTC'].cryptoTransferDecimals, 6)
  },

  height (state) {
    return state.height
  }
}

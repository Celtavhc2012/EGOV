import BigNumber from '@/lib/bignumber'
import { Cryptos } from '@/lib/constants'


export default (amount, symbol = Cryptos.ADM, isAdmBalance = false) => {
  if (amount !== undefined) {
    const formatted = BigNumber(
      !isAdmBalance && symbol === Cryptos.ADM ? amount / 1e8 : amount
    ).toFixed()
    return formatted
  } else {
    return ''
  }
}

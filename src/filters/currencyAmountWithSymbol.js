import { Cryptos } from '@/lib/constants'
import currencyAmount from './currencyAmount'


export default (amount, symbol = Cryptos.ADM, isAdmBalance = false) => {
  if (amount !== undefined) {
    return `${currencyAmount(amount, symbol, isAdmBalance)} ${symbol}`
  } else {
    return ''
  }
}

import { isErc20, Cryptos } from '../../../lib/constants'

export default {
  
  displayName: state => partner => state.list[partner] && state.list[partner].displayName,

  
  cryptoAddress: state => (partner, crypto) => {
    if (isErc20(crypto)) {
      crypto = Cryptos.ETH
    }
    return state.list[partner] && state.list[partner][crypto]
  }
}

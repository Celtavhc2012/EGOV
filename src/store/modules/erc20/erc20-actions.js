import abiDecoder from 'abi-decoder'

import * as ethUtils from '../../../lib/eth-utils'
import { FetchStatus, INCREASE_FEE_MULTIPLIER } from '@/lib/constants'
import Erc20 from './erc20.abi.json'
import createActions from '../eth-base/eth-base-actions'

let lastStatusUpdate = 0

const STATUS_INTERVAL = 25000


abiDecoder.addABI(Erc20)

const initTransaction = (api, context, ethAddress, amount, increaseFee) => {
  const contract = new api.Contract(Erc20, context.state.contractAddress)

  const transaction = {
    from: context.state.address,
    to: context.state.contractAddress,
    value: '0x0',
    
    data: contract.methods
      .transfer(ethAddress, ethUtils.toWhole(amount, context.state.decimals))
      .encodeABI()
  }

  return api.estimateGas(transaction).then((gasLimit) => {
    gasLimit = increaseFee ? gasLimit * INCREASE_FEE_MULTIPLIER : gasLimit
    transaction.gas = gasLimit
    return transaction
  })
}

const parseTransaction = (context, tx) => {
  let recipientId = null
  let amount = null

  const decoded = abiDecoder.decodeMethod(tx.input)
  if (decoded && decoded.name === 'transfer') {
    decoded.params.forEach((x) => {
      if (x.name === '_to') recipientId = x.value
      if (x.name === '_value') amount = ethUtils.toFraction(x.value, context.state.decimals)
    })
  }

  if (recipientId) {
    return {
     
      hash: tx.hash,
      senderId: tx.from,
      blockNumber: tx.blockNumber,
      amount,
      recipientId,
      gasPrice: +(tx.gasPrice || tx.effectiveGasPrice)
    }
  }

  return null
}

const createSpecificActions = (api, queue) => ({
  updateBalance: {
    root: true,
    async handler({ state, commit }, payload = {}) {
      if (payload.requestedByUser) {
        commit('setBalanceStatus', FetchStatus.Loading)
      }

      try {
        const contract = new api.Contract(Erc20, state.contractAddress)
        const rawBalance = await contract.methods.balanceOf(state.address).call()
        const balance = Number(ethUtils.toFraction(rawBalance, state.decimals))

        commit('balance', balance)
        commit('setBalanceStatus', FetchStatus.Success)
      } catch (err) {
        commit('setBalanceStatus', FetchStatus.Error)
        console.log(err)
      }
    }
  },


  updateStatus(context) {
    if (!context.state.address) return

    const contract = new api.Contract(Erc20, context.state.contractAddress)
    contract.methods
      .balanceOf(context.state.address)
      .call()
      .then(
        (balance) => {
          context.commit(
            'balance',
            Number(ethUtils.toFraction(balance.toString(10), context.state.decimals))
          )
          context.commit('setBalanceStatus', FetchStatus.Success)
        },
        () => {
          context.commit('setBalanceStatus', FetchStatus.Error)
        }
      )
      .then(() => {
        const delay = Math.max(0, STATUS_INTERVAL - Date.now() + lastStatusUpdate)
        setTimeout(() => {
          if (context.state.address) {
            lastStatusUpdate = Date.now()
            context.dispatch('updateStatus')
          }
        }, delay)
      })
  }
})

export default createActions({
  initTransaction,
  parseTransaction,
  createSpecificActions
})

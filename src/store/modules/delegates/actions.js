import * as constants from '../../../lib/constants'
import * as admApi from '../../../lib/adamant-api'

function _getDelegates(
  context,
  limit = constants.Delegates.ACTIVE_DELEGATES,
  offset = 0,
  votes = []
) {
  admApi.getDelegates(limit, offset).then((response) => {
    if (response.success) {
      for (const i in response.delegates) {
        const delegate = response.delegates[i]
        const voted = votes.includes(delegate.address)
        delegate._voted = voted
        delegate.voted = voted
        delegate.upvoted = false
        delegate.downvoted = false
        delegate.showDetails = false
        delegate.forged = 0
        delegate.status = 5
        context.commit('delegate_info', delegate)
      }
    }
  })
}

function checkUnconfirmedTransactions(context) {
  admApi.checkUnconfirmedTransactions().then((response) => {
    if (response.success) {
      if (response.count === 0) {
        context.commit('set_last_transaction_status', true)
      } else {
        checkUnconfirmedTransactions(context)
      }
    }
  })
}

function getRoundDelegates(delegates, height) {
  const currentRound = round(height)
  return delegates.filter((delegate, index) => {
    return currentRound === round(height + index + 1)
  })
}

function round(height) {
  if (isNaN(height)) {
    return 0
  } else {
    return Math.floor(height / 101) + (height % 101 > 0 ? 1 : 0)
  }
}

export default {
  reset: {
    root: true,
    handler(context) {
      context.commit('reset')
    }
  },
  async getDelegates(context, payload) {
    try {
      const votesResponse = await admApi.getDelegatesWithVotes(payload.address)
      const votes = votesResponse.success ? votesResponse.delegates.map((vote) => vote.address) : []

      const delegatesCountResponse = await admApi.getDelegatesCount()
      if (!delegatesCountResponse.success) {
        console.warn(delegatesCountResponse)
        return
      }

      for (
        let i = 0;
        i < delegatesCountResponse.count / constants.Delegates.ACTIVE_DELEGATES;
        i++
      ) {
        _getDelegates(
          context,
          constants.Delegates.ACTIVE_DELEGATES,
          i * constants.Delegates.ACTIVE_DELEGATES,
          votes
        )
      }
    } catch (err) {
      console.warn(err)
    }
  },
  voteForDelegates(context, payload) {
    context.commit('reset')
    
    admApi.voteForDelegates(payload.votes).then((response) => {
      if (response.success) {
        context.commit('set_last_transaction_status', false)
        
        window.setTimeout(() => {
          
          context.dispatch('getDelegates', { address: payload.address })
        }, 15000)
        checkUnconfirmedTransactions(context)
      } else {
        context.commit('send_error', { msg: response.body.error }, { root: true })
        context.dispatch('getDelegates', { address: payload.address })
      }
    })
  },
  getForgingTimeForDelegate(context, delegate) {
    admApi.getNextForgers().then((response) => {
      if (response.success) {
        const nextForgers = response.delegates
        const fIndex = nextForgers.indexOf(delegate.publicKey)
        const forgingTime = fIndex === -1 ? -1 : fIndex * 10
        context.commit('update_delegate', {
          address: delegate.address,
          params: { forgingTime: forgingTime }
        })
        admApi.getBlocks().then((response) => {
          if (response.success) {
            const lastBlock = response.blocks[0]
            const blocks = response.blocks.filter(
              (x) => x.generatorPublicKey === delegate.publicKey
            )
            const time = Date.now()
            const status = { updatedAt: time }
            let isRoundDelegate = false
            if (blocks.length > 0) {
              status.lastBlock = blocks[0]
              status.blockAt = new Date((constants.EPOCH + status.lastBlock.timestamp) * 1000)
              const roundDelegates = getRoundDelegates(nextForgers, lastBlock.height)
              isRoundDelegate = roundDelegates.indexOf(delegate.publicKey) !== -1
              status.networkRound = round(lastBlock.height)
              status.delegateRound = round(status.lastBlock.height)
              status.awaitingSlot = status.networkRound - status.delegateRound
            } else {
              status.lastBlock = null
            }
            if (status.awaitingSlot === 0) {
              
              status.code = 0
            } else if (!isRoundDelegate && status.awaitingSlot === 1) {
              
              status.code = 1
            } else if (!isRoundDelegate && status.awaitingSlot > 1) {
              
              status.code = 2
            } else if (status.awaitingSlot === 1) {
              
              status.code = 3
            } else if (status.awaitingSlot === 2) {
              
              status.code = 4
            } else if (!status.blockAt || !status.updatedAt || status.lastBlock === null) {
              
              status.code = 5
              
            } else if (!status.blockAt && status.updatedAt) {
              if (!isRoundDelegate && delegate.missedblocks === 1) {
                
                status.code = 1
              } else if (delegate.missedblocks > 1) {
                
                status.code = 2
              } else if (delegate.missedblocks === 1) {
                
                status.code = 4
              }
            } else {
              
              status.code = 2
            }
            context.commit('update_delegate', {
              address: delegate.address,
              params: { status: status.code }
            })
          }
        })
      }
    })
  },
  getForgedByAccount(context, delegate) {
    admApi.getForgedByAccount(delegate.publicKey).then((response) => {
      if (response.success) {
        context.commit('update_delegate', {
          address: delegate.address,
          params: { forged: response.forged }
        })
      }
    })
  }
}

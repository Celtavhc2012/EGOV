import * as bip39 from 'bip39'
import crypto from 'crypto'

let cachedSeed = []

export default {
  
  mnemonicToSeedSync (passphrase) {
    const passphraseHash = crypto.createHash('sha256').update(passphrase).digest('hex')
    cachedSeed[passphraseHash] = cachedSeed[passphraseHash] || bip39.mnemonicToSeedSync(passphrase)
    return cachedSeed[passphraseHash]
  },
  resetCachedSeed () {
    cachedSeed = []
  }
}

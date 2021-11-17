import { assert } from 'chai'
import { Wallet } from 'xrpl'

describe('Integration Tests - XRP Logic', function () {
  it('generateWallet - throws on invalid secret', async function () {
    assert.throw(
      () => {
        Wallet.fromSecret('fake_secret')
      },
      Error,
      'Non-base58 character',
    )
  })
})

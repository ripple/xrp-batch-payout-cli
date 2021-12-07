Development Guide for xrp-batch-payout app.

### Git (for development)

1. `git clone https://github.com/ripple/xrp-batch-payout.git`
2. `cd xrp-batch-payout`
3. `npm install`
4. `npm run build`
5. `node bin/index.js` (run command-line tool)

Note:
If you have issues running tests and find `nyc: command not found`, it would be
worth installing `nyc` globally, eg. `npm i -g nyc` and similar approach would
work for other dependencies as well and the ones which error out with
`Error: spawn $lib ENOENT`.

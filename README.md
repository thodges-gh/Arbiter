# Arbiter - A contract for authoritatively controlling logic on the blockchain.

The Arbiter contract shows how essential logic for an agreement can be executed on a smart contract, while details and more complex computation can be delegated to Chainlink.

The basic workflow is:

- Create an initial Chainlink request to retrieve some data
- Based on the value of the returned data, do one of the following
  - Create another Chainlink request, optionally using the value returned from the first as a parameter
  - Nothing
- As many additional Chainlink requests can be created based on returned values as needed
- Store a receipt that some off-chain transaction/computation occurred

### Building

```bash
yarn
```

### Testing

```bash
yarn test
```
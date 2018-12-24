"use strict";

let abi = require('ethereumjs-abi');
let BigNumber = require('bignumber.js');

let Arbiter = artifacts.require("Arbiter.sol");
let Oracle = artifacts.require("Oracle.sol");
let LinkToken = artifacts.require("LinkToken.sol");

contract("Arbiter", (accounts) => {
  let tryCatch = require("../helpers.js").tryCatch;
  let errTypes = require("../helpers.js").errTypes;
  let owner = accounts[0];
  let stranger = accounts[1];
  let node = accounts[2];
  let linkContract, oracleContract, arbiterContract;

  const ETH_USD_PRICE = 50000;

  let encodeUint256 = function encodeUint256(int) {
    let zeros = "0000000000000000000000000000000000000000000000000000000000000000";
    let payload = int.toString(16);
    return (zeros + payload).slice(payload.length);
  }

  let checkPublicABI = function checkPublicABI (contract, expectedPublic) {
    let actualPublic = [];
    for (const method of contract.abi) {
      if (method.type === 'function') actualPublic.push(method.name);
    };

    for (const method of actualPublic) {
      let index = expectedPublic.indexOf(method);
      assert.isAtLeast(index, 0, (`#${method} is NOT expected to be public`));
    }

    for (const method of expectedPublic) {
      let index = actualPublic.indexOf(method);
      assert.isAtLeast(index, 0, (`#${method} is expected to be public`));
    }
  }

  let bigNum = function bigNum(number) {
    return new BigNumber(number);
  }

  let intToHexNoPrefix = function intToHexNoPrefix(number) {
    return bigNum(number).toString(16);
  }

  beforeEach(async () => {
    linkContract = await LinkToken.new();
    oracleContract = await Oracle.new(linkContract.address, {from: owner});
    arbiterContract = await Arbiter.new(
      linkContract.address, 
      oracleContract.address,
      {from: owner}
    );
    await oracleContract.setFulfillmentPermission(
      node, 
      true, 
      {from: owner});
    await linkContract.transfer(arbiterContract.address, web3.utils.toWei('2', 'ether'));
  });

  it('has a limited public interface', () => {
    checkPublicABI(arbiterContract, [
      'amount',
      'receipt',
      'createChainlinkRequest',
      'fulfill',
      'renounceOwnership',
      'storeReceipt',
      'owner',
      'transferOwnership'
    ]);
  });

  describe("createChainlinkRequest", () => {

    it("can only be called by owner", async () => {
      await tryCatch(arbiterContract.createChainlinkRequest({from: stranger}), errTypes.revert);
      let tx = await arbiterContract.createChainlinkRequest({from: owner});
      assert.equal(tx.receipt.rawLogs[3].address, oracleContract.address);
    });
  });

  describe("fulfill", () => {
    let requestId;

    beforeEach(async () => {
      await oracleContract.transferOwnership(node, {from: owner});
      const tx = await arbiterContract.createChainlinkRequest();
      requestId = tx.logs[0].args.id;
    });

    it("can only be called by the oracle contract", async () => {
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      await tryCatch(oracleContract.fulfillData(requestId, response, {from: stranger}), errTypes.revert);
      const tx = await oracleContract.fulfillData(requestId, response, {from: node});
      assert.equal(tx.receipt.rawLogs[0].topics[0], web3.utils.keccak256("ChainlinkFulfilled(bytes32)"));
    });

    it("stores the given value", async () => {
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      await oracleContract.fulfillData(requestId, response, {from: node});
      let currentValue = await arbiterContract.amount();
      let decoded = await abi.rawDecode(["uint256"], new Buffer(intToHexNoPrefix(currentValue), "hex"));
      assert.equal(decoded.toString(), ETH_USD_PRICE.toString());
    });

    context("when the requestId is not recognized", () => {
      it("reverts", async () => {
        let fakeId = 9;
        let response = '0x' + encodeUint256(ETH_USD_PRICE);
        await tryCatch(oracleContract.fulfillData(fakeId, response, {from: node}), errTypes.revert);
      });
    });
  });

  describe("followUpRequest", () => {
    let requestId, responseTx;

    beforeEach(async () => {
      await oracleContract.transferOwnership(node, {from: owner});
      const tx = await arbiterContract.createChainlinkRequest();
      requestId = tx.logs[0].args.id;
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      responseTx = await oracleContract.fulfillData(requestId, response, {from: node});
    });

    it("is called in the fulfill callback", async () => {
      assert.equal(responseTx.receipt.rawLogs[5].topics[0], web3.utils.keccak256("FollowUpRequested(uint256)"));
    });
  });

  describe("storeReceipt", () => {
    let requestId, responseTx, followUpRequestId;

    beforeEach(async () => {
      await oracleContract.transferOwnership(node, {from: owner});
      const tx = await arbiterContract.createChainlinkRequest();
      requestId = tx.logs[0].args.id;
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      responseTx = await oracleContract.fulfillData(requestId, response, {from: node});
      followUpRequestId = responseTx.receipt.rawLogs[1].data;
    });

    it("can only be called by the oracle contract", async () => {
      let response = web3.utils.keccak256("Transaction complete.");
      await tryCatch(oracleContract.fulfillData(followUpRequestId, response, {from: stranger}), errTypes.revert);
      const tx = await oracleContract.fulfillData(followUpRequestId, response, {from: node});
      assert.equal(tx.receipt.rawLogs[0].topics[0], web3.utils.sha3("ChainlinkFulfilled(bytes32)"));  
    });

    it("stores the receipt", async () => {
      let response = web3.utils.keccak256("Transaction complete.");
      await oracleContract.fulfillData(followUpRequestId, response, {from: node});
      let answer = await arbiterContract.receipt();
      assert.equal(response, answer);
    });
  });
});
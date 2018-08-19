"use strict";

let abi = require('ethereumjs-abi');
let BigNumber = require('bignumber.js');

let Arbiter = artifacts.require("Arbiter.sol");
let Oracle = artifacts.require("Oracle.sol");
let LinkToken = artifacts.require("LinkToken.sol");

contract("Arbiter", () => {
  let tryCatch = require("../helpers.js").tryCatch;
  let errTypes = require("../helpers.js").errTypes;
  let owner = web3.eth.accounts[0];
  let stranger = web3.eth.accounts[1];
  let node = web3.eth.accounts[2];
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

  let getEvents = function getEvents(contract) {
    return new Promise((resolve, reject) => {
      contract.allEvents().get((error, events) => {
        if (error) {
          reject(error);
        } else {
          resolve(events);
        };
      });
    });
  }

  let getLatestEvent = async function getLatestEvent(contract) {
    let events = await getEvents(contract);
    return events[events.length - 1];
  }

  beforeEach(async () => {
    linkContract = await LinkToken.new();
    oracleContract = await Oracle.new(linkContract.address);
    arbiterContract = await Arbiter.new(
      linkContract.address, 
      oracleContract.address,
      {from: owner}
    );
    await linkContract.transfer(arbiterContract.address, web3.toWei('2', 'ether'));
  });

  it('has a limited public interface', () => {
    checkPublicABI(arbiterContract, [
      'amount',
      'receipt',
      'createChainlinkRequest',
      'fulfill',
      'storeReceipt',
      'owner',
      'transferOwnership'
    ]);
  });

  describe("createChainlinkRequest", () => {

    it("can only be called by owner", async () => {
      await tryCatch(arbiterContract.createChainlinkRequest({from: stranger}), errTypes.revert);
      let tx = await arbiterContract.createChainlinkRequest({from: owner});
      let log = tx.receipt.logs[2];
      assert.equal(log.address, oracleContract.address);
    });
  });

  describe("fulfill", () => {
    let internalId;

    beforeEach(async () => {
      await oracleContract.transferOwnership(node, {from: owner});
      await arbiterContract.createChainlinkRequest();
      let event = await getLatestEvent(oracleContract);
      internalId = event.args.internalId;
    });

    it("can only be called by the oracle contract", async () => {
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      await tryCatch(oracleContract.fulfillData(internalId, response, {from: stranger}), errTypes.revert);
      await tryCatch(oracleContract.fulfillData(internalId, response, {from: owner}), errTypes.revert);
      await oracleContract.fulfillData(internalId, response, {from: node});
      let event = await getLatestEvent(arbiterContract);
      assert.equal(event.event, "ChainlinkFulfilled");    
    });

    it("stores the given value", async () => {
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      await oracleContract.fulfillData(internalId, response, {from: node});
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
    let internalId;

    beforeEach(async () => {
      await oracleContract.transferOwnership(node, {from: owner});
      await arbiterContract.createChainlinkRequest();
      let event = await getLatestEvent(oracleContract);
      internalId = event.args.internalId;
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      await oracleContract.fulfillData(internalId, response, {from: node});
    });

    it("is called in the fulfill callback", async () => {
      let events = await getEvents(arbiterContract);
      assert.equal(events[1].event, "FollowUpRequested");
    });
  });

  describe("storeReceipt", () => {
    let internalId;

    beforeEach(async () => {
      await oracleContract.transferOwnership(node, {from: owner});
      await arbiterContract.createChainlinkRequest();
      let event = await getLatestEvent(oracleContract);
      internalId = event.args.internalId;
      let response = '0x' + encodeUint256(ETH_USD_PRICE);
      await oracleContract.fulfillData(internalId, response, {from: node});
      event = await getLatestEvent(oracleContract);
      internalId = event.args.internalId;
    });

    it("can only be called by the oracle contract", async () => {
      let response = 'Transaction complete.';
      await tryCatch(oracleContract.fulfillData(internalId, response, {from: stranger}), errTypes.revert);
      await tryCatch(oracleContract.fulfillData(internalId, response, {from: owner}), errTypes.revert);
      await oracleContract.fulfillData(internalId, response, {from: node});
      let event = await getLatestEvent(arbiterContract);
      assert.equal(event.event, "ChainlinkFulfilled");    
    });

    it("stores the receipt", async () => {
      let response = 'Transaction complete.';
      await oracleContract.fulfillData(internalId, response, {from: node});
      let answer = await arbiterContract.receipt();
      assert.equal(response, web3.toUtf8(answer));
    });
  });
});
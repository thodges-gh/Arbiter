var Arbiter = artifacts.require("./Arbiter.sol");
var Oracle = artifacts.require("./Oracle.sol");
var LinkToken = artifacts.require("./LinkToken.sol");

module.exports = function(deployer) {
  deployer.deploy(LinkToken).then( function() {
    deployer.deploy(Oracle, LinkToken.address).then( function() {
      deployer.deploy(Arbiter, LinkToken.address, Oracle.address, {from: web3.eth.accounts[0]});
    })
  })
};
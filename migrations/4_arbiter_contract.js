var Arbiter = artifacts.require("Arbiter");
var Oracle = artifacts.require("Oracle");
var LinkToken = artifacts.require("LinkToken");

module.exports = function(deployer) {
  deployer.deploy(Arbiter, LinkToken.address, Oracle.address, {from: web3.eth.accounts[0]});

};
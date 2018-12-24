var Arbiter = artifacts.require("Arbiter");
var Oracle = artifacts.require("Oracle");
var LinkToken = artifacts.require("LinkToken");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(Arbiter, LinkToken.address, Oracle.address, {from: accounts[0]});
};
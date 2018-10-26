var LinkToken = artifacts.require("LinkToken");
var Oracle = artifacts.require("Oracle");

module.exports = deployer => {
  deployer.deploy(Oracle, LinkToken.address);
};
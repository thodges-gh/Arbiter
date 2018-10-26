var LinkToken = artifacts.require("LinkToken");

module.exports = deployer => {
  deployer.deploy(LinkToken);
};
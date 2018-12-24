pragma solidity 0.4.24;

import "chainlink/solidity/contracts/Chainlinked.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Arbiter is Chainlinked, Ownable {

  event FollowUpRequested(uint256 _amount);

  bytes32 constant FIRST_SPEC_ID = bytes32("abcd");
  bytes32 constant SECOND_SPEC_ID = bytes32("ef01");
  uint256 constant private ORACLE_PAYMENT = 1 * LINK;

  uint256 public amount;
  bytes32 public receipt;

  constructor(address _link, address _oracle) public Ownable() {
    setLinkToken(_link);
    setOracle(_oracle);
  }

  function createChainlinkRequest() public onlyOwner {
    ChainlinkLib.Run memory run = newRun(FIRST_SPEC_ID, this, this.fulfill.selector);
    chainlinkRequest(run, ORACLE_PAYMENT);
  }

  function followUpRequest(uint256 _amount) private {
    ChainlinkLib.Run memory run = newRun(SECOND_SPEC_ID, this, this.storeReceipt.selector);
    run.addUint("amount", _amount);
    chainlinkRequest(run, ORACLE_PAYMENT);
    emit FollowUpRequested(_amount);
  }

  function fulfill(bytes32 _requestId, uint256 _amount)
    public
    checkChainlinkFulfillment(_requestId)
  {
    amount = _amount;
    followUpRequest(_amount);
  }

  function storeReceipt(bytes32 _requestId, bytes32 _result)
    public
    checkChainlinkFulfillment(_requestId)
  {
    receipt = _result;
  }
}
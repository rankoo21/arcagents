// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentJobMarket} from "../contracts/AgentJobMarket.sol";

/// @notice Deploys AgentJobMarket to Arc Testnet, wired to the native USDC.
contract Deploy is Script {
    // USDC on Arc
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        // Accept the key with or without the 0x prefix.
        uint256 pk = vm.parseUint(
            _with0x(vm.envString("DEPLOYER_PRIVATE_KEY"))
        );
        vm.startBroadcast(pk);

        AgentJobMarket market = new AgentJobMarket(USDC);

        vm.stopBroadcast();

        console.log("AgentJobMarket deployed at:", address(market));
        console.log("USDC:", USDC);
    }

    function _with0x(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length >= 2 && b[0] == "0" && (b[1] == "x" || b[1] == "X")) {
            return s;
        }
        return string.concat("0x", s);
    }
}

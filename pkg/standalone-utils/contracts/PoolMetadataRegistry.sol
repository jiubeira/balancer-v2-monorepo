// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@balancer-labs/v2-solidity-utils/contracts/helpers/BalancerErrors.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";

/**
 * @dev This contract emits events with metadata for existing pools,
 * allowing users to post relevant information about them. 
 * The events emitted by the contract can be then read and parsed from an off-chain app
 * for visualization purposes.
 */
contract PoolMetadataRegistry {
    // Index for metadata events, to be used as metadata unique identifiers.
    uint256 private _nextMetadataIndex = 0;
    // Vault reference to validate pool IDs.
    IVault private immutable _vault;

    // Metadata type identifier.
    enum Topic { TOKENOMICS, PERFORMANCE, GENERAL, SUPPORT }

    /**
     * @dev Emitted on addMetadata()
     * @param poolId The ID of the pool where the metadata belongs to.
     * @param topic Metadata type identifier.
     * @param data Relevant information for this metadata piece.
     * @param id Metadata unique identifier set by the contract.
     **/
    event PoolMetadata(
        bytes32 poolId,
        Topic topic,
        string data,
        uint256 id
    );

    constructor(IVault vault) {
        _vault = vault;
    }

    function addMetadata(bytes32 poolId, Topic topic, string calldata data)
        external
    {
        // getPool will revert if the poolId is invalid.
        _vault.getPool(poolId);
        uint256 id = _nextMetadataIndex;
        emit PoolMetadata(poolId, topic, data, id);
        _nextMetadataIndex = _nextMetadataIndex + 1;
    }
}

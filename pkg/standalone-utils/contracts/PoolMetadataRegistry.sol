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

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/Ownable.sol";

import "@balancer-labs/v2-solidity-utils/contracts/helpers/BalancerErrors.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";

/**
 * @dev This contract emits events with metadata for existing pools,
 * allowing users to post relevant information about them. 
 * The events emitted by the contract can be then read and parsed from an off-chain app
 * for visualization purposes.
 *
 * The contract has an admin who can create content for existing pools.
 * It also allows users to comment on pools, while the admin can moderate the comments
 * by flagging them and commenting on them.
 */
contract PoolMetadataRegistry is Ownable {
    // Index for metadata events, to be used as metadata unique identifiers.
    uint256 private _nextMetadataIndex = 0;
    // Vault reference to validate pool IDs.
    IVault private immutable _vault;

    // Metadata topic identifier.
    enum Topic { TOKENOMICS, PERFORMANCE, GENERAL, SUPPORT }

    // Metadata type identifier.
    enum MetadataType { CONTENT, COMMENT }

    // Flags for metadata, set for comments by the admin.
    enum MetadataFlag { SPAM, SPONSORED, ADMIN_REVIEWED, SUPERSEDED, REPLY }

    /**
     * @dev Emitted on _createMetadata()
     * @param poolId The ID of the pool where the metadata belongs to.
     * @param topic Metadata type identifier.
     * @param data Relevant information for this metadata piece.
     * @param id Metadata unique identifier set by the contract.
     **/
    event PoolMetadataCreated(
        bytes32 poolId,
        Topic topic,
        string data,
        uint256 id,
        MetadataType metadataType
    );

    /**
     * @dev Emitted on flagMetadata()
     * @param id Metadata unique identifier to flag.
     * @param flag Flag type for metadata.
     * @param note Extra information or comment for the metadata.
     **/
    event MetadataFlagged(
        uint256 id,
        MetadataFlag flag,
        string note
    );

    constructor(IVault vault) {
        _vault = vault;
    }

    /**
     * @notice Create content of a given topic for an existing pool.
     * @dev Callable only by the owner. Reverts if the pool does not exist.
     */
    function createContent(bytes32 poolId, Topic topic, string calldata data)
        external
        onlyOwner
    {
        _createMetadata(poolId, topic, data, MetadataType.CONTENT);
    }

    /**
     * @notice Marks existing metadata with a flag and leaves a note.
     * @dev Callable only by the owner. Reverts if metadata with the given ID was not created before.
     * The same metadata piece can be flagged any amount of times with different flags.
     * It is up to the app that consumes the event to display the information in a coherent way (e.g. show last flag).
     */
    function flagMetadata(uint256 metadataId, MetadataFlag flag, string calldata note)
        external
        onlyOwner
    {
        _require(metadataId < _nextMetadataIndex, Errors.OUT_OF_BOUNDS);
        emit MetadataFlagged(metadataId, flag, note);
    }

    /**
     * @notice Create a comment of a given topic for an existing pool.
     * @dev Reverts if the pool does not exist.
     */
    function createComment(bytes32 poolId, Topic topic, string calldata data)
        external
    {
        _createMetadata(poolId, topic, data, MetadataType.COMMENT);
    }

    /**
     * @dev Emits event with pool metadata.
     */
    function _createMetadata(bytes32 poolId, Topic topic, string calldata data, MetadataType metadataType)
        private
    {
        // getPool will revert if the poolId is invalid.
        _vault.getPool(poolId);
        uint256 id = _nextMetadataIndex;
        emit PoolMetadataCreated(poolId, topic, data, id, metadataType);
        _nextMetadataIndex = _nextMetadataIndex + 1;
    }
}

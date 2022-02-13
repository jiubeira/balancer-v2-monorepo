import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { deploy } from '@balancer-labs/v2-helpers/src/contract';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PoolMetadataRegistryTopic } from '@balancer-labs/balancer-js';
import * as expectEvent from '@balancer-labs/v2-helpers/src/test/expectEvent';


describe('PoolMetadataRegistry', function () {
  let poolMetadataRegistry: Contract, admin: SignerWithAddress, user: SignerWithAddress;

  before('setup signers', async () => {
    [, admin, user] = await ethers.getSigners();
  });

  sharedBeforeEach('deploy pool metadata registry', async () => {
    poolMetadataRegistry = await deploy('PoolMetadataRegistry', { from: admin });
  });

  describe('addMetadata', () => {
    it('can add metadata to existing pools', async () => {
      // As long as poolId and topic are valid, more than one metadata piece
      // can be added to the same pool, even with matching topics.
      // Metadata id is expected to increment with each call.
      const metadataList = [
        {
          poolId: ethers.utils.formatBytes32String("1"),
          topic: PoolMetadataRegistryTopic.Tokenomics,
          data: 'Super interesting tokenomics',
          id: 0,
        },
        {
          poolId: ethers.utils.formatBytes32String("2"),
          topic: PoolMetadataRegistryTopic.General,
          data: 'General info',
          id: 1,
        },
        {
          poolId: ethers.utils.formatBytes32String("2"),
          topic: PoolMetadataRegistryTopic.Performance,
          data: 'Pool performance',
          id: 2,
        },
        {
          poolId: ethers.utils.formatBytes32String("3"),
          topic: PoolMetadataRegistryTopic.Support,
          data: 'Support page',
          id: 3,
        },
        {
          poolId: ethers.utils.formatBytes32String("1"),
          topic: PoolMetadataRegistryTopic.Tokenomics,
          data: 'More about tokenomics',
          id: 4,
        },
      ];

      for (const metadata of metadataList) {
        const tx = await poolMetadataRegistry.connect(user).addMetadata(
          metadata.poolId,
          metadata.topic,
          metadata.data);
        const receipt = await tx.wait();
        expectEvent.inReceipt(receipt, 'PoolMetadata', metadata);
      }
    });

    it('tries to push invalid matadata and reverts', async () => {
      let tx = poolMetadataRegistry.connect(user).addMetadata(
        ethers.utils.formatBytes32String("0"),
        PoolMetadataRegistryTopic.Tokenomics,
        'Data');
      await expect(tx).to.be.revertedWith('INVALID_POOL_ID');

      // TODO(https://github.com/jiubeira/balancer-v2-monorepo/issues/6):
      // Check if there's a better way of testing invalid enum inputs.
      tx = poolMetadataRegistry.connect(user).addMetadata(
        ethers.utils.formatBytes32String("1"),
        1324,
        'Data');
      await expect(tx).to.be.reverted;
    });
  });
});

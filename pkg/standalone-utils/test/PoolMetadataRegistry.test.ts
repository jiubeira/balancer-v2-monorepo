import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { deploy } from '@balancer-labs/v2-helpers/src/contract';
import { PoolMetadataRegistryTopic } from '@balancer-labs/balancer-js';
import { PoolSpecialization } from '@balancer-labs/balancer-js';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { ZERO_ADDRESS } from '@balancer-labs/v2-helpers/src/constants';

import * as expectEvent from '@balancer-labs/v2-helpers/src/test/expectEvent';


describe('PoolMetadataRegistry', function () {
  let poolMetadataRegistry: Contract, admin: SignerWithAddress, user: SignerWithAddress, vault: Contract;
  let poolIds: Array<String>;

  before('setup signers', async () => {
    [, admin, user] = await ethers.getSigners();
  });

  sharedBeforeEach('deploy and initialize vault and pools', async () => {
    const poolCount = 3;
    vault = await deploy('v2-vault/Vault', { args: [ZERO_ADDRESS, ZERO_ADDRESS, 0, 0] });

    poolIds = [];
    for (let i = 0; i < poolCount; i++) {
      let pool = await deploy('v2-vault/MockPool', { args: [vault.address, PoolSpecialization.GeneralPool] });
      poolIds.push(await pool.getPoolId());
    }
  });

  sharedBeforeEach('deploy pool metadata registry', async () => {
    poolMetadataRegistry = await deploy(
        'PoolMetadataRegistry',
        { from: admin, args: [vault.address] });
  });

  describe('addMetadata', () => {
    it('can add metadata to existing pools', async () => {
      // As long as poolId and topic are valid, more than one metadata piece
      // can be added to the same pool, even with matching topics.
      // Metadata id is expected to increment with each call.
      const metadataList = [
        {
          poolId: poolIds[0],
          topic: PoolMetadataRegistryTopic.Tokenomics,
          data: 'Super interesting tokenomics',
          id: 0,
        },
        {
          poolId: poolIds[1],
          topic: PoolMetadataRegistryTopic.General,
          data: 'General info',
          id: 1,
        },
        {
          poolId: poolIds[1],
          topic: PoolMetadataRegistryTopic.Performance,
          data: 'Pool performance',
          id: 2,
        },
        {
          poolId: poolIds[2],
          topic: PoolMetadataRegistryTopic.Support,
          data: 'Support page',
          id: 3,
        },
        {
          poolId: poolIds[0],
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
        ethers.utils.formatBytes32String("Invalid pool ID"),
        PoolMetadataRegistryTopic.Tokenomics,
        'Data');
      await expect(tx).to.be.revertedWith('INVALID_POOL_ID');

      // TODO(https://github.com/jiubeira/balancer-v2-monorepo/issues/6):
      // Check if there's a better way of testing invalid enum inputs.
      tx = poolMetadataRegistry.connect(user).addMetadata(
        poolIds[0],
        1324,
        'Data');
      await expect(tx).to.be.reverted;
    });
  });
});

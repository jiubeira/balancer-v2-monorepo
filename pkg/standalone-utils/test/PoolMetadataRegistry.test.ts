import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { deploy } from '@balancer-labs/v2-helpers/src/contract';
import { PoolMetadataRegistryMetadataFlag, PoolMetadataRegistryTopic, PoolMetadataRegistryMetadataType } from '@balancer-labs/balancer-js';
import { PoolSpecialization } from '@balancer-labs/balancer-js';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { ZERO_ADDRESS } from '@balancer-labs/v2-helpers/src/constants';

import * as expectEvent from '@balancer-labs/v2-helpers/src/test/expectEvent';


type Metadata = {
  poolId: String;
  topic: Number;
  data: String;
  id: Number;
  metadataType: PoolMetadataRegistryMetadataType;
};

function createMetadataList(poolIds: Array<String>, metadataType: PoolMetadataRegistryMetadataType): Array<Metadata> {
  let index = 0;
  let metadataList = [];

  // As long as poolId and topic are valid, more than one metadata piece
  // can be added to the same pool, even with matching topics.
  // Metadata id is expected to increment with each call.
  for (const poolId of poolIds) {
    for (let topic in PoolMetadataRegistryTopic) {
      let topicNumber = Number(topic);
      if (isNaN(topicNumber)) {
        continue;
      }

      const metadata1 = {
        poolId: poolId,
        topic: topicNumber,
        data: `Data for ${poolId}, topic ${topic} at index ${index}`,
        id: index++,
        metadataType: metadataType,
      }
      const metadata2 = {
        poolId: poolId,
        topic: topicNumber,
        data: `More data for ${poolId}, topic ${topic} at index ${index}`,
        id: index++,
        metadataType: metadataType,
      }
      metadataList.push(metadata1);
      metadataList.push(metadata2);
    }
  }
  return metadataList;
}

describe('PoolMetadataRegistry', function () {
  let poolMetadataRegistry: Contract, admin: SignerWithAddress, user: SignerWithAddress, vault: Contract;
  let poolIds: Array<String>, validPoolId: String, invalidPoolId: String, validTopic: PoolMetadataRegistryTopic;
  let invalidTopic: Number;

  before('setup signers', async () => {
    [, admin, user] = await ethers.getSigners();
  });

  before('deploy and initialize vault and pools', async () => {
    const poolCount = 2;
    vault = await deploy('v2-vault/Vault', { args: [ZERO_ADDRESS, ZERO_ADDRESS, 0, 0] });

    poolIds = [];
    for (let i = 0; i < poolCount; i++) {
      let pool = await deploy('v2-vault/MockPool', { args: [vault.address, PoolSpecialization.GeneralPool] });
      poolIds.push(await pool.getPoolId());
    }
  });

  before('initialize common variables', () => {
    validPoolId = poolIds[0];
    invalidPoolId = ethers.utils.formatBytes32String("Invalid pool ID");
    validTopic = PoolMetadataRegistryTopic.Tokenomics;
    invalidTopic = 123456;
  });

  sharedBeforeEach('deploy pool metadata registry', async () => {
    poolMetadataRegistry = await deploy(
        'PoolMetadataRegistry',
        { from: admin, args: [vault.address] });
  });

  describe('createContent', () => {
    it('can add content to existing pools', async () => {
      let metadataList = createMetadataList(poolIds, PoolMetadataRegistryMetadataType.Content);
      for (const metadata of metadataList) {
        const tx = await poolMetadataRegistry.connect(admin).createContent(
          metadata.poolId,
          metadata.topic,
          metadata.data);
        const receipt = await tx.wait();
        expectEvent.inReceipt(receipt, 'PoolMetadataCreated', metadata);
      }
    });

    it('tries to push invalid matadata and reverts', async () => {
      let tx = poolMetadataRegistry.connect(admin).createContent(
        invalidPoolId,
        validTopic,
        'Data');
      await expect(tx).to.be.revertedWith('INVALID_POOL_ID');

      // TODO(https://github.com/jiubeira/balancer-v2-monorepo/issues/6):
      // Check if there's a better way of testing invalid enum inputs.
      tx = poolMetadataRegistry.connect(admin).createContent(
        validPoolId,
        invalidTopic,
        'Data');
      await expect(tx).to.be.reverted;
    });

    it('tries to create content without admin rights', async () => {
      let tx = poolMetadataRegistry.connect(user).createContent(
        validPoolId,
        validTopic,
        'I do not have admin rights, but let\s try anyways');
      await expect(tx).to.be.revertedWith('CALLER_IS_NOT_OWNER');
    });
  });

  describe('createComment', () => {
    it('can add comments to existing pools', async () => {
      let metadataList = createMetadataList(poolIds, PoolMetadataRegistryMetadataType.Comment);
      for (const metadata of metadataList) {
        const tx = await poolMetadataRegistry.connect(user).createComment(
          metadata.poolId,
          metadata.topic,
          metadata.data);
        const receipt = await tx.wait();
        expectEvent.inReceipt(receipt, 'PoolMetadataCreated', metadata);
      }
    });

    it('tries to push invalid matadata and reverts', async () => {
      let tx = poolMetadataRegistry.connect(admin).createComment(
        invalidPoolId,
        validTopic,
        'Data');
      await expect(tx).to.be.revertedWith('INVALID_POOL_ID');

      // TODO(https://github.com/jiubeira/balancer-v2-monorepo/issues/6):
      // Check if there's a better way of testing invalid enum inputs.
      tx = poolMetadataRegistry.connect(admin).createComment(
        validPoolId,
        invalidTopic,
        'Data');
      await expect(tx).to.be.reverted;
    });
  });

  describe('flagMetadata', () => {
    const validMetadataId = 1;
    const invalidMetadataId = 123456;
    sharedBeforeEach('add some metadata to existing pools', async () => {
      await (await poolMetadataRegistry.connect(admin).createContent(
        validPoolId,
        validTopic,
        'Content by admin')).wait();
      await (await poolMetadataRegistry.connect(user).createComment(
        validPoolId,
        validTopic,
        'Interesting comment by user')).wait();
      await (await poolMetadataRegistry.connect(user).createComment(
        validPoolId,
        validTopic,
        'Spam comment by user')).wait();
    });

    it('flags some user comments', async () => {
      const metadataReviewedFlagEvent = {
        id: 1,
        flag: PoolMetadataRegistryMetadataFlag.AdminReviewed,
        note: 'Thanks for the comment!'
      };
      let tx = await poolMetadataRegistry.connect(admin).flagMetadata(
        metadataReviewedFlagEvent.id,
        metadataReviewedFlagEvent.flag,
        metadataReviewedFlagEvent.note);
      let receipt = await tx.wait();
      expectEvent.inReceipt(receipt, 'MetadataFlagged', metadataReviewedFlagEvent);

      const metadataSpamEvent = {
        id: 2,
        flag: PoolMetadataRegistryMetadataFlag.Spam,
        note: 'Comment marked as inappropriate by admin.'
      };
      tx = await poolMetadataRegistry.connect(admin).flagMetadata(
        metadataSpamEvent.id,
        metadataSpamEvent.flag,
        metadataSpamEvent.note);
      receipt = await tx.wait();
      expectEvent.inReceipt(receipt, 'MetadataFlagged', metadataSpamEvent);
    });

    it('tries to flag metadata incorrectly and reverts', async () => {
      let tx = poolMetadataRegistry.connect(admin).flagMetadata(
        invalidMetadataId,
        PoolMetadataRegistryMetadataFlag.Spam,
        'Marked as spam by admin');
      await expect(tx).to.be.revertedWith('OUT_OF_BOUNDS');

      // TODO(https://github.com/jiubeira/balancer-v2-monorepo/issues/6):
      // Check if there's a better way of testing invalid enum inputs.
      tx = poolMetadataRegistry.connect(admin).flagMetadata(
        1,
        1234,
        'Data');
      await expect(tx).to.be.reverted;
    });

    it('tries to moderate without admin rights', async () => {
      let tx = poolMetadataRegistry.connect(user).flagMetadata(
        validMetadataId,
        PoolMetadataRegistryMetadataFlag.Spam,
        'I do not have admin rights, but let\s try anyways');
      await expect(tx).to.be.revertedWith('CALLER_IS_NOT_OWNER');
    });
  });
});

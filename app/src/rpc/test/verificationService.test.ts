import { hexStringToBytes } from '@hub/bytes';
import { HubError } from '@hub/errors';
import { utils, Wallet } from 'ethers';
import Factories from '~/flatbuffers/factories';
import IdRegistryEventModel from '~/flatbuffers/models/idRegistryEventModel';
import MessageModel from '~/flatbuffers/models/messageModel';
import { KeyPair, SignerAddModel, VerificationAddEthAddressModel } from '~/flatbuffers/models/types';
import SyncEngine from '~/network/sync/syncEngine';
import Client from '~/rpc/client';
import Server from '~/rpc/server';
import { jestRocksDB } from '~/storage/db/jestUtils';
import Engine from '~/storage/engine';
import { MockHub } from '~/test/mocks';
import { generateEd25519KeyPair } from '~/utils/crypto';

const db = jestRocksDB('flatbuffers.rpc.verificationService.test');
const engine = new Engine(db);
const hub = new MockHub(db, engine);

let server: Server;
let client: Client;

beforeAll(async () => {
  server = new Server(hub, engine, new SyncEngine(engine));
  const port = await server.start();
  client = new Client(`127.0.0.1:${port}`);
});

afterAll(async () => {
  client.close();
  await server.stop();
});

const fid = Factories.FID.build();
const wallet = new Wallet(utils.randomBytes(32));
let custodyEvent: IdRegistryEventModel;
let signer: KeyPair;
let signerAdd: SignerAddModel;

let verificationAdd: VerificationAddEthAddressModel;

beforeAll(async () => {
  custodyEvent = new IdRegistryEventModel(
    await Factories.IdRegistryEvent.create(
      { to: Array.from(hexStringToBytes(wallet.address)._unsafeUnwrap()), fid: Array.from(fid) },
      { transient: { wallet } }
    )
  );

  signer = await generateEd25519KeyPair();
  const signerAddData = await Factories.SignerAddData.create({
    body: Factories.SignerBody.build({ signer: Array.from(signer.publicKey) }),
    fid: Array.from(fid),
  });
  signerAdd = new MessageModel(
    await Factories.Message.create({ data: Array.from(signerAddData.bb?.bytes() ?? []) }, { transient: { wallet } })
  ) as SignerAddModel;

  const verificationBody = await Factories.VerificationAddEthAddressBody.create({}, { transient: { fid } });
  const verificationData = await Factories.VerificationAddEthAddressData.create({
    fid: Array.from(fid),
    body: verificationBody.unpack(),
  });
  verificationAdd = new MessageModel(
    await Factories.Message.create({ data: Array.from(verificationData.bb?.bytes() ?? []) }, { transient: { signer } })
  ) as VerificationAddEthAddressModel;
});

describe('getVerification', () => {
  beforeEach(async () => {
    await engine.mergeIdRegistryEvent(custodyEvent);
    await engine.mergeMessage(signerAdd);
  });

  test('succeeds', async () => {
    await engine.mergeMessage(verificationAdd);
    const result = await client.getVerification(fid, verificationAdd.body().addressArray() ?? new Uint8Array());
    expect(result._unsafeUnwrap()).toEqual(verificationAdd);
  });

  test('fails if verification is missing', async () => {
    const result = await client.getVerification(fid, verificationAdd.body().addressArray() ?? new Uint8Array());
    expect(result._unsafeUnwrapErr().errCode).toEqual('not_found');
  });

  test('fails without address', async () => {
    const result = await client.getVerification(fid, new Uint8Array());
    expect(result._unsafeUnwrapErr()).toEqual(new HubError('bad_request.validation_failure', 'address is missing'));
  });

  test('fails without fid', async () => {
    const result = await client.getVerification(
      new Uint8Array(),
      verificationAdd.body().addressArray() ?? new Uint8Array()
    );
    expect(result._unsafeUnwrapErr()).toEqual(new HubError('bad_request.validation_failure', 'fid is missing'));
  });
});

describe('getVerificationsByFid', () => {
  beforeEach(async () => {
    await engine.mergeIdRegistryEvent(custodyEvent);
    await engine.mergeMessage(signerAdd);
  });

  test('succeeds', async () => {
    await engine.mergeMessage(verificationAdd);
    const verifications = await client.getVerificationsByFid(fid);
    expect(verifications._unsafeUnwrap()).toEqual([verificationAdd]);
  });

  test('returns empty array without messages', async () => {
    const verifications = await client.getVerificationsByFid(fid);
    expect(verifications._unsafeUnwrap()).toEqual([]);
  });
});

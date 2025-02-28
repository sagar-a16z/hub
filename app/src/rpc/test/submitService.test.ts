import { hexStringToBytes } from '@hub/bytes';
import { HubError } from '@hub/errors';
import { IdRegistryEventType, NameRegistryEventType } from '@hub/flatbuffers';
import { utils, Wallet } from 'ethers';
import Factories from '~/flatbuffers/factories';
import IdRegistryEventModel from '~/flatbuffers/models/idRegistryEventModel';
import MessageModel from '~/flatbuffers/models/messageModel';
import NameRegistryEventModel from '~/flatbuffers/models/nameRegistryEventModel';
import { CastAddModel, KeyPair, SignerAddModel } from '~/flatbuffers/models/types';
import SyncEngine from '~/network/sync/syncEngine';
import Client from '~/rpc/client';
import Server from '~/rpc/server';
import { jestRocksDB } from '~/storage/db/jestUtils';
import Engine from '~/storage/engine';
import { MockHub } from '~/test/mocks';
import { generateEd25519KeyPair } from '~/utils/crypto';

const db = jestRocksDB('flatbuffers.rpc.submitService.test');
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
let castAdd: CastAddModel;

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

  const castAddData = await Factories.CastAddData.create({
    fid: Array.from(fid),
  });
  castAdd = new MessageModel(
    await Factories.Message.create({ data: Array.from(castAddData.bb?.bytes() ?? []) }, { transient: { signer } })
  ) as CastAddModel;
});

describe('submitMessage', () => {
  describe('with signer', () => {
    beforeEach(async () => {
      await hub.submitIdRegistryEvent(custodyEvent);
      await hub.submitMessage(signerAdd);
    });

    test('succeeds', async () => {
      const result = await client.submitMessage(castAdd);
      expect(result._unsafeUnwrap()).toEqual(castAdd);
      const getCast = await client.getCast(castAdd.fid(), castAdd.tsHash());
      expect(getCast._unsafeUnwrap()).toEqual(castAdd);
    });
  });

  test('fails without signer', async () => {
    const result = await client.submitMessage(castAdd);
    const err = result._unsafeUnwrapErr();
    expect(err.errCode).toEqual('bad_request.validation_failure');
    expect(err.message).toMatch('unknown fid');
  });
});

describe('submitIdRegistryEvent', () => {
  test('succeeds', async () => {
    const result = await client.submitIdRegistryEvent(custodyEvent);
    expect(result._unsafeUnwrap()).toEqual(custodyEvent);
  });

  // TODO: test the gRPC server directly without having to use IdRegistryEventModel, because
  // the constructor will throw an exception with an invalid type
  xtest('fails with invalid event', async () => {
    const invalidEvent = new IdRegistryEventModel(
      await Factories.IdRegistryEvent.create(
        {
          to: Array.from(hexStringToBytes(wallet.address)._unsafeUnwrap()),
          fid: Array.from(fid),
          type: 0 as IdRegistryEventType,
        },
        { transient: { wallet } }
      )
    );
    const result = await client.submitIdRegistryEvent(invalidEvent);
    expect(result._unsafeUnwrapErr()).toEqual(new HubError('bad_request.validation_failure', 'invalid event type'));
  });
});

describe('submitNameRegistryEvent', () => {
  test('succeeds', async () => {
    const nameRegistryEvent = new NameRegistryEventModel(
      await Factories.NameRegistryEvent.create(
        { to: Array.from(hexStringToBytes(wallet.address)._unsafeUnwrap()) },
        { transient: { wallet } }
      )
    );
    const result = await client.submitNameRegistryEvent(nameRegistryEvent);
    expect(result._unsafeUnwrap()).toEqual(nameRegistryEvent);
  });

  // TODO: test the gRPC server directly without having to use NameRegistryEventModel, because
  // the constructor will throw an exception with an invalid type
  xtest('fails with invalid event', async () => {
    const invalidEvent = new NameRegistryEventModel(
      await Factories.NameRegistryEvent.create(
        { to: Array.from(hexStringToBytes(wallet.address)._unsafeUnwrap()), type: 0 as NameRegistryEventType },
        { transient: { wallet } }
      )
    );
    const result = await client.submitNameRegistryEvent(invalidEvent);
    expect(result._unsafeUnwrapErr()).toEqual(new HubError('bad_request.validation_failure', 'invalid event type'));
  });
});

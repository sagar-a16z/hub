import { HubError } from '@hub/errors';
import { IdRegistryEvent, IdRegistryEventType } from '@hub/flatbuffers';
import { ByteBuffer } from 'flatbuffers';
import { RootPrefix } from '~/flatbuffers/models/types';
import RocksDB, { Transaction } from '~/storage/db/rocksdb';

/** IdRegistryEventModel provides helpers to read and write Flatbuffers ContractEvents from RocksDB */
export default class IdRegistryEventModel {
  public readonly event: IdRegistryEvent;

  constructor(event: IdRegistryEvent) {
    if (!Object.values(IdRegistryEventType).includes(event.type())) {
      throw new HubError('bad_request.invalid_param', 'type is invalid');
    }
    this.event = event;
  }

  static from(bytes: Uint8Array) {
    const event = IdRegistryEvent.getRootAsIdRegistryEvent(new ByteBuffer(bytes));
    return new this(event);
  }

  /** <ID Registry root prefix byte, fid> */
  static primaryKey(fid: Uint8Array): Buffer {
    return Buffer.concat([Buffer.from([RootPrefix.IdRegistryEvent]), Buffer.from(fid)]);
  }

  /**
   * Generates a unique key used to store the current custody address of a user -> IdRegistryEvent mapping
   *
   * @param address the custody address of the user
   *
   * @returns RocksDB key of the form <RootPrefix>:<address>
   */
  static byCustodyAddressKey(address: Uint8Array): Buffer {
    return Buffer.concat([Buffer.from([RootPrefix.IdRegistryEventByCustodyAddress]), Buffer.from(address)]);
  }

  static async get<T extends IdRegistryEventModel>(db: RocksDB, fid: Uint8Array): Promise<T> {
    const buffer = await db.get(IdRegistryEventModel.primaryKey(fid));
    return IdRegistryEventModel.from(new Uint8Array(buffer)) as T;
  }

  static async getByCustodyAddress(db: RocksDB, custodyAddress: Uint8Array): Promise<IdRegistryEventModel> {
    const buffer = await db.get(IdRegistryEventModel.byCustodyAddressKey(custodyAddress));
    return IdRegistryEventModel.from(new Uint8Array(buffer));
  }

  static putTransaction(tsx: Transaction, event: IdRegistryEventModel): Transaction {
    tsx = tsx.put(event.primaryKey(), event.toBuffer());

    // This works for both register events and transfer events.
    return tsx.put(IdRegistryEventModel.byCustodyAddressKey(event.to()), event.toBuffer());
  }

  static deleteTransaction(tsx: Transaction, event: IdRegistryEventModel): Transaction {
    tsx = tsx.del(event.primaryKey());

    return tsx.del(IdRegistryEventModel.byCustodyAddressKey(event.to()));
  }

  async put(db: RocksDB): Promise<void> {
    const tsx = this.putTransaction(db.transaction());
    return db.commit(tsx);
  }

  putTransaction(tsx: Transaction): Transaction {
    return IdRegistryEventModel.putTransaction(tsx, this);
  }

  primaryKey(): Buffer {
    return IdRegistryEventModel.primaryKey(this.fid());
  }

  toBuffer(): Buffer {
    return Buffer.from(this.toBytes());
  }

  toBytes(): Uint8Array {
    return this.event.bb?.bytes() || new Uint8Array();
  }

  blockNumber(): number {
    return this.event.blockNumber();
  }

  blockHash(): Uint8Array {
    return this.event.blockHashArray() ?? new Uint8Array();
  }

  transactionHash(): Uint8Array {
    return this.event.transactionHashArray() ?? new Uint8Array();
  }

  logIndex(): number {
    return this.event.logIndex();
  }

  fid(): Uint8Array {
    return this.event.fidArray() ?? new Uint8Array();
  }

  from(): Uint8Array | null {
    return this.event.fromArray();
  }

  to(): Uint8Array {
    return this.event.toArray() ?? new Uint8Array();
  }

  type(): IdRegistryEventType {
    return this.event.type();
  }

  typeName(): string {
    return IdRegistryEventType[this.type()] as string;
  }
}

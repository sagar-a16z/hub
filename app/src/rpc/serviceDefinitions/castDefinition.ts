import { toByteBuffer } from '@hub/bytes';
import * as rpc_generated from '@hub/flatbuffers';
import { Message } from '@hub/flatbuffers';
import { defaultMethod } from '~/rpc/client';

export const castDefinition = () => {
  return {
    getCast: {
      ...defaultMethod,
      path: '/getCast',
      requestDeserialize: (buffer: Buffer): rpc_generated.GetCastRequest => {
        return rpc_generated.GetCastRequest.getRootAsGetCastRequest(toByteBuffer(buffer));
      },
      responseDeserialize: (buffer: Buffer): Message => {
        return Message.getRootAsMessage(toByteBuffer(buffer));
      },
    },

    getCastsByFid: {
      ...defaultMethod,
      path: '/getCastsByFid',
      requestDeserialize: (buffer: Buffer): rpc_generated.GetCastsByFidRequest => {
        return rpc_generated.GetCastsByFidRequest.getRootAsGetCastsByFidRequest(toByteBuffer(buffer));
      },
      responseDeserialize: (buffer: Buffer): rpc_generated.MessagesResponse => {
        return rpc_generated.MessagesResponse.getRootAsMessagesResponse(toByteBuffer(buffer));
      },
    },

    getCastsByParent: {
      ...defaultMethod,
      path: '/getCastsByParent',
      requestDeserialize: (buffer: Buffer): rpc_generated.GetCastsByParentRequest => {
        return rpc_generated.GetCastsByParentRequest.getRootAsGetCastsByParentRequest(toByteBuffer(buffer));
      },
      responseDeserialize: (buffer: Buffer): rpc_generated.MessagesResponse => {
        return rpc_generated.MessagesResponse.getRootAsMessagesResponse(toByteBuffer(buffer));
      },
    },

    getCastsByMention: {
      ...defaultMethod,
      path: '/getCastsByMention',
      requestDeserialize: (buffer: Buffer): rpc_generated.GetCastsByMentionRequest => {
        return rpc_generated.GetCastsByMentionRequest.getRootAsGetCastsByMentionRequest(toByteBuffer(buffer));
      },
      responseDeserialize: (buffer: Buffer): rpc_generated.MessagesResponse => {
        return rpc_generated.MessagesResponse.getRootAsMessagesResponse(toByteBuffer(buffer));
      },
    },
  };
};

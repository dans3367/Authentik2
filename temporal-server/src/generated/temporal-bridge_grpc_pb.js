// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var temporal$bridge_pb = require('./temporal-bridge_pb.js');

function serialize_temporal_bridge_CancelNewsletterRequest(arg) {
  if (!(arg instanceof temporal$bridge_pb.CancelNewsletterRequest)) {
    throw new Error('Expected argument of type temporal.bridge.CancelNewsletterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_CancelNewsletterRequest(buffer_arg) {
  return temporal$bridge_pb.CancelNewsletterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_CancelNewsletterResponse(arg) {
  if (!(arg instanceof temporal$bridge_pb.CancelNewsletterResponse)) {
    throw new Error('Expected argument of type temporal.bridge.CancelNewsletterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_CancelNewsletterResponse(buffer_arg) {
  return temporal$bridge_pb.CancelNewsletterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_NewsletterRequest(arg) {
  if (!(arg instanceof temporal$bridge_pb.NewsletterRequest)) {
    throw new Error('Expected argument of type temporal.bridge.NewsletterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_NewsletterRequest(buffer_arg) {
  return temporal$bridge_pb.NewsletterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_NewsletterResponse(arg) {
  if (!(arg instanceof temporal$bridge_pb.NewsletterResponse)) {
    throw new Error('Expected argument of type temporal.bridge.NewsletterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_NewsletterResponse(buffer_arg) {
  return temporal$bridge_pb.NewsletterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_NewsletterStatusRequest(arg) {
  if (!(arg instanceof temporal$bridge_pb.NewsletterStatusRequest)) {
    throw new Error('Expected argument of type temporal.bridge.NewsletterStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_NewsletterStatusRequest(buffer_arg) {
  return temporal$bridge_pb.NewsletterStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_NewsletterStatusResponse(arg) {
  if (!(arg instanceof temporal$bridge_pb.NewsletterStatusResponse)) {
    throw new Error('Expected argument of type temporal.bridge.NewsletterStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_NewsletterStatusResponse(buffer_arg) {
  return temporal$bridge_pb.NewsletterStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowCancelRequest(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowCancelRequest)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowCancelRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowCancelRequest(buffer_arg) {
  return temporal$bridge_pb.WorkflowCancelRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowCancelResponse(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowCancelResponse)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowCancelResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowCancelResponse(buffer_arg) {
  return temporal$bridge_pb.WorkflowCancelResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowRequest(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowRequest)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowRequest(buffer_arg) {
  return temporal$bridge_pb.WorkflowRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowResponse(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowResponse)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowResponse(buffer_arg) {
  return temporal$bridge_pb.WorkflowResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowResultRequest(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowResultRequest)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowResultRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowResultRequest(buffer_arg) {
  return temporal$bridge_pb.WorkflowResultRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowResultResponse(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowResultResponse)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowResultResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowResultResponse(buffer_arg) {
  return temporal$bridge_pb.WorkflowResultResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowSignalRequest(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowSignalRequest)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowSignalRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowSignalRequest(buffer_arg) {
  return temporal$bridge_pb.WorkflowSignalRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_temporal_bridge_WorkflowSignalResponse(arg) {
  if (!(arg instanceof temporal$bridge_pb.WorkflowSignalResponse)) {
    throw new Error('Expected argument of type temporal.bridge.WorkflowSignalResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_temporal_bridge_WorkflowSignalResponse(buffer_arg) {
  return temporal$bridge_pb.WorkflowSignalResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// Newsletter service for managing newsletter workflows
var NewsletterServiceService = exports.NewsletterServiceService = {
  sendNewsletter: {
    path: '/temporal.bridge.NewsletterService/SendNewsletter',
    requestStream: false,
    responseStream: false,
    requestType: temporal$bridge_pb.NewsletterRequest,
    responseType: temporal$bridge_pb.NewsletterResponse,
    requestSerialize: serialize_temporal_bridge_NewsletterRequest,
    requestDeserialize: deserialize_temporal_bridge_NewsletterRequest,
    responseSerialize: serialize_temporal_bridge_NewsletterResponse,
    responseDeserialize: deserialize_temporal_bridge_NewsletterResponse,
  },
  getNewsletterStatus: {
    path: '/temporal.bridge.NewsletterService/GetNewsletterStatus',
    requestStream: false,
    responseStream: false,
    requestType: temporal$bridge_pb.NewsletterStatusRequest,
    responseType: temporal$bridge_pb.NewsletterStatusResponse,
    requestSerialize: serialize_temporal_bridge_NewsletterStatusRequest,
    requestDeserialize: deserialize_temporal_bridge_NewsletterStatusRequest,
    responseSerialize: serialize_temporal_bridge_NewsletterStatusResponse,
    responseDeserialize: deserialize_temporal_bridge_NewsletterStatusResponse,
  },
  cancelNewsletter: {
    path: '/temporal.bridge.NewsletterService/CancelNewsletter',
    requestStream: false,
    responseStream: false,
    requestType: temporal$bridge_pb.CancelNewsletterRequest,
    responseType: temporal$bridge_pb.CancelNewsletterResponse,
    requestSerialize: serialize_temporal_bridge_CancelNewsletterRequest,
    requestDeserialize: deserialize_temporal_bridge_CancelNewsletterRequest,
    responseSerialize: serialize_temporal_bridge_CancelNewsletterResponse,
    responseDeserialize: deserialize_temporal_bridge_CancelNewsletterResponse,
  },
};

exports.NewsletterServiceClient = grpc.makeGenericClientConstructor(NewsletterServiceService, 'NewsletterService');
// Generic workflow service for other temporal workflows
var WorkflowServiceService = exports.WorkflowServiceService = {
  startWorkflow: {
    path: '/temporal.bridge.WorkflowService/StartWorkflow',
    requestStream: false,
    responseStream: false,
    requestType: temporal$bridge_pb.WorkflowRequest,
    responseType: temporal$bridge_pb.WorkflowResponse,
    requestSerialize: serialize_temporal_bridge_WorkflowRequest,
    requestDeserialize: deserialize_temporal_bridge_WorkflowRequest,
    responseSerialize: serialize_temporal_bridge_WorkflowResponse,
    responseDeserialize: deserialize_temporal_bridge_WorkflowResponse,
  },
  getWorkflowResult: {
    path: '/temporal.bridge.WorkflowService/GetWorkflowResult',
    requestStream: false,
    responseStream: false,
    requestType: temporal$bridge_pb.WorkflowResultRequest,
    responseType: temporal$bridge_pb.WorkflowResultResponse,
    requestSerialize: serialize_temporal_bridge_WorkflowResultRequest,
    requestDeserialize: deserialize_temporal_bridge_WorkflowResultRequest,
    responseSerialize: serialize_temporal_bridge_WorkflowResultResponse,
    responseDeserialize: deserialize_temporal_bridge_WorkflowResultResponse,
  },
  signalWorkflow: {
    path: '/temporal.bridge.WorkflowService/SignalWorkflow',
    requestStream: false,
    responseStream: false,
    requestType: temporal$bridge_pb.WorkflowSignalRequest,
    responseType: temporal$bridge_pb.WorkflowSignalResponse,
    requestSerialize: serialize_temporal_bridge_WorkflowSignalRequest,
    requestDeserialize: deserialize_temporal_bridge_WorkflowSignalRequest,
    responseSerialize: serialize_temporal_bridge_WorkflowSignalResponse,
    responseDeserialize: deserialize_temporal_bridge_WorkflowSignalResponse,
  },
  cancelWorkflow: {
    path: '/temporal.bridge.WorkflowService/CancelWorkflow',
    requestStream: false,
    responseStream: false,
    requestType: temporal$bridge_pb.WorkflowCancelRequest,
    responseType: temporal$bridge_pb.WorkflowCancelResponse,
    requestSerialize: serialize_temporal_bridge_WorkflowCancelRequest,
    requestDeserialize: deserialize_temporal_bridge_WorkflowCancelRequest,
    responseSerialize: serialize_temporal_bridge_WorkflowCancelResponse,
    responseDeserialize: deserialize_temporal_bridge_WorkflowCancelResponse,
  },
};

exports.WorkflowServiceClient = grpc.makeGenericClientConstructor(WorkflowServiceService, 'WorkflowService');

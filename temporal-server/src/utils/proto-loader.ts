import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

export interface ProtoDefinitions {
  NewsletterService: grpc.ServiceClientConstructor;
  WorkflowService: grpc.ServiceClientConstructor;
}

export function loadProtoDefinitions(): ProtoDefinitions {
  const PROTO_PATH = path.join(__dirname, '../../proto/temporal-bridge.proto');

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
  
  return {
    NewsletterService: protoDescriptor.temporal.bridge.NewsletterService,
    WorkflowService: protoDescriptor.temporal.bridge.WorkflowService,
  };
}



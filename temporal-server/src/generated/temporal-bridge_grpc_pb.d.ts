// package: temporal.bridge
// file: temporal-bridge.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as temporal_bridge_pb from "./temporal-bridge_pb";

interface INewsletterServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    sendNewsletter: INewsletterServiceService_ISendNewsletter;
    getNewsletterStatus: INewsletterServiceService_IGetNewsletterStatus;
    cancelNewsletter: INewsletterServiceService_ICancelNewsletter;
}

interface INewsletterServiceService_ISendNewsletter extends grpc.MethodDefinition<temporal_bridge_pb.NewsletterRequest, temporal_bridge_pb.NewsletterResponse> {
    path: "/temporal.bridge.NewsletterService/SendNewsletter";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<temporal_bridge_pb.NewsletterRequest>;
    requestDeserialize: grpc.deserialize<temporal_bridge_pb.NewsletterRequest>;
    responseSerialize: grpc.serialize<temporal_bridge_pb.NewsletterResponse>;
    responseDeserialize: grpc.deserialize<temporal_bridge_pb.NewsletterResponse>;
}
interface INewsletterServiceService_IGetNewsletterStatus extends grpc.MethodDefinition<temporal_bridge_pb.NewsletterStatusRequest, temporal_bridge_pb.NewsletterStatusResponse> {
    path: "/temporal.bridge.NewsletterService/GetNewsletterStatus";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<temporal_bridge_pb.NewsletterStatusRequest>;
    requestDeserialize: grpc.deserialize<temporal_bridge_pb.NewsletterStatusRequest>;
    responseSerialize: grpc.serialize<temporal_bridge_pb.NewsletterStatusResponse>;
    responseDeserialize: grpc.deserialize<temporal_bridge_pb.NewsletterStatusResponse>;
}
interface INewsletterServiceService_ICancelNewsletter extends grpc.MethodDefinition<temporal_bridge_pb.CancelNewsletterRequest, temporal_bridge_pb.CancelNewsletterResponse> {
    path: "/temporal.bridge.NewsletterService/CancelNewsletter";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<temporal_bridge_pb.CancelNewsletterRequest>;
    requestDeserialize: grpc.deserialize<temporal_bridge_pb.CancelNewsletterRequest>;
    responseSerialize: grpc.serialize<temporal_bridge_pb.CancelNewsletterResponse>;
    responseDeserialize: grpc.deserialize<temporal_bridge_pb.CancelNewsletterResponse>;
}

export const NewsletterServiceService: INewsletterServiceService;

export interface INewsletterServiceServer extends grpc.UntypedServiceImplementation {
    sendNewsletter: grpc.handleUnaryCall<temporal_bridge_pb.NewsletterRequest, temporal_bridge_pb.NewsletterResponse>;
    getNewsletterStatus: grpc.handleUnaryCall<temporal_bridge_pb.NewsletterStatusRequest, temporal_bridge_pb.NewsletterStatusResponse>;
    cancelNewsletter: grpc.handleUnaryCall<temporal_bridge_pb.CancelNewsletterRequest, temporal_bridge_pb.CancelNewsletterResponse>;
}

export interface INewsletterServiceClient {
    sendNewsletter(request: temporal_bridge_pb.NewsletterRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterResponse) => void): grpc.ClientUnaryCall;
    sendNewsletter(request: temporal_bridge_pb.NewsletterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterResponse) => void): grpc.ClientUnaryCall;
    sendNewsletter(request: temporal_bridge_pb.NewsletterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterResponse) => void): grpc.ClientUnaryCall;
    getNewsletterStatus(request: temporal_bridge_pb.NewsletterStatusRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterStatusResponse) => void): grpc.ClientUnaryCall;
    getNewsletterStatus(request: temporal_bridge_pb.NewsletterStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterStatusResponse) => void): grpc.ClientUnaryCall;
    getNewsletterStatus(request: temporal_bridge_pb.NewsletterStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterStatusResponse) => void): grpc.ClientUnaryCall;
    cancelNewsletter(request: temporal_bridge_pb.CancelNewsletterRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.CancelNewsletterResponse) => void): grpc.ClientUnaryCall;
    cancelNewsletter(request: temporal_bridge_pb.CancelNewsletterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.CancelNewsletterResponse) => void): grpc.ClientUnaryCall;
    cancelNewsletter(request: temporal_bridge_pb.CancelNewsletterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.CancelNewsletterResponse) => void): grpc.ClientUnaryCall;
}

export class NewsletterServiceClient extends grpc.Client implements INewsletterServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public sendNewsletter(request: temporal_bridge_pb.NewsletterRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterResponse) => void): grpc.ClientUnaryCall;
    public sendNewsletter(request: temporal_bridge_pb.NewsletterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterResponse) => void): grpc.ClientUnaryCall;
    public sendNewsletter(request: temporal_bridge_pb.NewsletterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterResponse) => void): grpc.ClientUnaryCall;
    public getNewsletterStatus(request: temporal_bridge_pb.NewsletterStatusRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterStatusResponse) => void): grpc.ClientUnaryCall;
    public getNewsletterStatus(request: temporal_bridge_pb.NewsletterStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterStatusResponse) => void): grpc.ClientUnaryCall;
    public getNewsletterStatus(request: temporal_bridge_pb.NewsletterStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.NewsletterStatusResponse) => void): grpc.ClientUnaryCall;
    public cancelNewsletter(request: temporal_bridge_pb.CancelNewsletterRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.CancelNewsletterResponse) => void): grpc.ClientUnaryCall;
    public cancelNewsletter(request: temporal_bridge_pb.CancelNewsletterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.CancelNewsletterResponse) => void): grpc.ClientUnaryCall;
    public cancelNewsletter(request: temporal_bridge_pb.CancelNewsletterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.CancelNewsletterResponse) => void): grpc.ClientUnaryCall;
}

interface IWorkflowServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    startWorkflow: IWorkflowServiceService_IStartWorkflow;
    getWorkflowResult: IWorkflowServiceService_IGetWorkflowResult;
    signalWorkflow: IWorkflowServiceService_ISignalWorkflow;
    cancelWorkflow: IWorkflowServiceService_ICancelWorkflow;
}

interface IWorkflowServiceService_IStartWorkflow extends grpc.MethodDefinition<temporal_bridge_pb.WorkflowRequest, temporal_bridge_pb.WorkflowResponse> {
    path: "/temporal.bridge.WorkflowService/StartWorkflow";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<temporal_bridge_pb.WorkflowRequest>;
    requestDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowRequest>;
    responseSerialize: grpc.serialize<temporal_bridge_pb.WorkflowResponse>;
    responseDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowResponse>;
}
interface IWorkflowServiceService_IGetWorkflowResult extends grpc.MethodDefinition<temporal_bridge_pb.WorkflowResultRequest, temporal_bridge_pb.WorkflowResultResponse> {
    path: "/temporal.bridge.WorkflowService/GetWorkflowResult";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<temporal_bridge_pb.WorkflowResultRequest>;
    requestDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowResultRequest>;
    responseSerialize: grpc.serialize<temporal_bridge_pb.WorkflowResultResponse>;
    responseDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowResultResponse>;
}
interface IWorkflowServiceService_ISignalWorkflow extends grpc.MethodDefinition<temporal_bridge_pb.WorkflowSignalRequest, temporal_bridge_pb.WorkflowSignalResponse> {
    path: "/temporal.bridge.WorkflowService/SignalWorkflow";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<temporal_bridge_pb.WorkflowSignalRequest>;
    requestDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowSignalRequest>;
    responseSerialize: grpc.serialize<temporal_bridge_pb.WorkflowSignalResponse>;
    responseDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowSignalResponse>;
}
interface IWorkflowServiceService_ICancelWorkflow extends grpc.MethodDefinition<temporal_bridge_pb.WorkflowCancelRequest, temporal_bridge_pb.WorkflowCancelResponse> {
    path: "/temporal.bridge.WorkflowService/CancelWorkflow";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<temporal_bridge_pb.WorkflowCancelRequest>;
    requestDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowCancelRequest>;
    responseSerialize: grpc.serialize<temporal_bridge_pb.WorkflowCancelResponse>;
    responseDeserialize: grpc.deserialize<temporal_bridge_pb.WorkflowCancelResponse>;
}

export const WorkflowServiceService: IWorkflowServiceService;

export interface IWorkflowServiceServer extends grpc.UntypedServiceImplementation {
    startWorkflow: grpc.handleUnaryCall<temporal_bridge_pb.WorkflowRequest, temporal_bridge_pb.WorkflowResponse>;
    getWorkflowResult: grpc.handleUnaryCall<temporal_bridge_pb.WorkflowResultRequest, temporal_bridge_pb.WorkflowResultResponse>;
    signalWorkflow: grpc.handleUnaryCall<temporal_bridge_pb.WorkflowSignalRequest, temporal_bridge_pb.WorkflowSignalResponse>;
    cancelWorkflow: grpc.handleUnaryCall<temporal_bridge_pb.WorkflowCancelRequest, temporal_bridge_pb.WorkflowCancelResponse>;
}

export interface IWorkflowServiceClient {
    startWorkflow(request: temporal_bridge_pb.WorkflowRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResponse) => void): grpc.ClientUnaryCall;
    startWorkflow(request: temporal_bridge_pb.WorkflowRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResponse) => void): grpc.ClientUnaryCall;
    startWorkflow(request: temporal_bridge_pb.WorkflowRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResponse) => void): grpc.ClientUnaryCall;
    getWorkflowResult(request: temporal_bridge_pb.WorkflowResultRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResultResponse) => void): grpc.ClientUnaryCall;
    getWorkflowResult(request: temporal_bridge_pb.WorkflowResultRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResultResponse) => void): grpc.ClientUnaryCall;
    getWorkflowResult(request: temporal_bridge_pb.WorkflowResultRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResultResponse) => void): grpc.ClientUnaryCall;
    signalWorkflow(request: temporal_bridge_pb.WorkflowSignalRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowSignalResponse) => void): grpc.ClientUnaryCall;
    signalWorkflow(request: temporal_bridge_pb.WorkflowSignalRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowSignalResponse) => void): grpc.ClientUnaryCall;
    signalWorkflow(request: temporal_bridge_pb.WorkflowSignalRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowSignalResponse) => void): grpc.ClientUnaryCall;
    cancelWorkflow(request: temporal_bridge_pb.WorkflowCancelRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowCancelResponse) => void): grpc.ClientUnaryCall;
    cancelWorkflow(request: temporal_bridge_pb.WorkflowCancelRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowCancelResponse) => void): grpc.ClientUnaryCall;
    cancelWorkflow(request: temporal_bridge_pb.WorkflowCancelRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowCancelResponse) => void): grpc.ClientUnaryCall;
}

export class WorkflowServiceClient extends grpc.Client implements IWorkflowServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public startWorkflow(request: temporal_bridge_pb.WorkflowRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResponse) => void): grpc.ClientUnaryCall;
    public startWorkflow(request: temporal_bridge_pb.WorkflowRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResponse) => void): grpc.ClientUnaryCall;
    public startWorkflow(request: temporal_bridge_pb.WorkflowRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResponse) => void): grpc.ClientUnaryCall;
    public getWorkflowResult(request: temporal_bridge_pb.WorkflowResultRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResultResponse) => void): grpc.ClientUnaryCall;
    public getWorkflowResult(request: temporal_bridge_pb.WorkflowResultRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResultResponse) => void): grpc.ClientUnaryCall;
    public getWorkflowResult(request: temporal_bridge_pb.WorkflowResultRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowResultResponse) => void): grpc.ClientUnaryCall;
    public signalWorkflow(request: temporal_bridge_pb.WorkflowSignalRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowSignalResponse) => void): grpc.ClientUnaryCall;
    public signalWorkflow(request: temporal_bridge_pb.WorkflowSignalRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowSignalResponse) => void): grpc.ClientUnaryCall;
    public signalWorkflow(request: temporal_bridge_pb.WorkflowSignalRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowSignalResponse) => void): grpc.ClientUnaryCall;
    public cancelWorkflow(request: temporal_bridge_pb.WorkflowCancelRequest, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowCancelResponse) => void): grpc.ClientUnaryCall;
    public cancelWorkflow(request: temporal_bridge_pb.WorkflowCancelRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowCancelResponse) => void): grpc.ClientUnaryCall;
    public cancelWorkflow(request: temporal_bridge_pb.WorkflowCancelRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: temporal_bridge_pb.WorkflowCancelResponse) => void): grpc.ClientUnaryCall;
}

// package: temporal.bridge
// file: temporal-bridge.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class NewsletterRequest extends jspb.Message { 
    getNewsletterId(): string;
    setNewsletterId(value: string): NewsletterRequest;
    getTenantId(): string;
    setTenantId(value: string): NewsletterRequest;
    getUserId(): string;
    setUserId(value: string): NewsletterRequest;
    getGroupUuid(): string;
    setGroupUuid(value: string): NewsletterRequest;
    getSubject(): string;
    setSubject(value: string): NewsletterRequest;
    getContent(): string;
    setContent(value: string): NewsletterRequest;
    clearRecipientsList(): void;
    getRecipientsList(): Array<NewsletterRecipient>;
    setRecipientsList(value: Array<NewsletterRecipient>): NewsletterRequest;
    addRecipients(value?: NewsletterRecipient, index?: number): NewsletterRecipient;

    hasMetadata(): boolean;
    clearMetadata(): void;
    getMetadata(): NewsletterMetadata | undefined;
    setMetadata(value?: NewsletterMetadata): NewsletterRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): NewsletterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: NewsletterRequest): NewsletterRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: NewsletterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): NewsletterRequest;
    static deserializeBinaryFromReader(message: NewsletterRequest, reader: jspb.BinaryReader): NewsletterRequest;
}

export namespace NewsletterRequest {
    export type AsObject = {
        newsletterId: string,
        tenantId: string,
        userId: string,
        groupUuid: string,
        subject: string,
        content: string,
        recipientsList: Array<NewsletterRecipient.AsObject>,
        metadata?: NewsletterMetadata.AsObject,
    }
}

export class NewsletterRecipient extends jspb.Message { 
    getId(): string;
    setId(value: string): NewsletterRecipient;
    getEmail(): string;
    setEmail(value: string): NewsletterRecipient;
    getFirstName(): string;
    setFirstName(value: string): NewsletterRecipient;
    getLastName(): string;
    setLastName(value: string): NewsletterRecipient;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): NewsletterRecipient.AsObject;
    static toObject(includeInstance: boolean, msg: NewsletterRecipient): NewsletterRecipient.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: NewsletterRecipient, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): NewsletterRecipient;
    static deserializeBinaryFromReader(message: NewsletterRecipient, reader: jspb.BinaryReader): NewsletterRecipient;
}

export namespace NewsletterRecipient {
    export type AsObject = {
        id: string,
        email: string,
        firstName: string,
        lastName: string,
    }
}

export class NewsletterMetadata extends jspb.Message { 
    clearTagsList(): void;
    getTagsList(): Array<string>;
    setTagsList(value: Array<string>): NewsletterMetadata;
    addTags(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): NewsletterMetadata.AsObject;
    static toObject(includeInstance: boolean, msg: NewsletterMetadata): NewsletterMetadata.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: NewsletterMetadata, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): NewsletterMetadata;
    static deserializeBinaryFromReader(message: NewsletterMetadata, reader: jspb.BinaryReader): NewsletterMetadata;
}

export namespace NewsletterMetadata {
    export type AsObject = {
        tagsList: Array<string>,
    }
}

export class NewsletterResponse extends jspb.Message { 
    getSuccess(): boolean;
    setSuccess(value: boolean): NewsletterResponse;
    getWorkflowId(): string;
    setWorkflowId(value: string): NewsletterResponse;
    getRunId(): string;
    setRunId(value: string): NewsletterResponse;
    getNewsletterId(): string;
    setNewsletterId(value: string): NewsletterResponse;
    getGroupUuid(): string;
    setGroupUuid(value: string): NewsletterResponse;
    getError(): string;
    setError(value: string): NewsletterResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): NewsletterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: NewsletterResponse): NewsletterResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: NewsletterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): NewsletterResponse;
    static deserializeBinaryFromReader(message: NewsletterResponse, reader: jspb.BinaryReader): NewsletterResponse;
}

export namespace NewsletterResponse {
    export type AsObject = {
        success: boolean,
        workflowId: string,
        runId: string,
        newsletterId: string,
        groupUuid: string,
        error: string,
    }
}

export class NewsletterStatusRequest extends jspb.Message { 
    getWorkflowId(): string;
    setWorkflowId(value: string): NewsletterStatusRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): NewsletterStatusRequest.AsObject;
    static toObject(includeInstance: boolean, msg: NewsletterStatusRequest): NewsletterStatusRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: NewsletterStatusRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): NewsletterStatusRequest;
    static deserializeBinaryFromReader(message: NewsletterStatusRequest, reader: jspb.BinaryReader): NewsletterStatusRequest;
}

export namespace NewsletterStatusRequest {
    export type AsObject = {
        workflowId: string,
    }
}

export class NewsletterStatusResponse extends jspb.Message { 
    getSuccess(): boolean;
    setSuccess(value: boolean): NewsletterStatusResponse;
    getNewsletterId(): string;
    setNewsletterId(value: string): NewsletterStatusResponse;
    getSuccessful(): number;
    setSuccessful(value: number): NewsletterStatusResponse;
    getFailed(): number;
    setFailed(value: number): NewsletterStatusResponse;
    getTotal(): number;
    setTotal(value: number): NewsletterStatusResponse;
    getGroupUuid(): string;
    setGroupUuid(value: string): NewsletterStatusResponse;
    getCompletedAt(): string;
    setCompletedAt(value: string): NewsletterStatusResponse;
    getStatus(): string;
    setStatus(value: string): NewsletterStatusResponse;
    getError(): string;
    setError(value: string): NewsletterStatusResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): NewsletterStatusResponse.AsObject;
    static toObject(includeInstance: boolean, msg: NewsletterStatusResponse): NewsletterStatusResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: NewsletterStatusResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): NewsletterStatusResponse;
    static deserializeBinaryFromReader(message: NewsletterStatusResponse, reader: jspb.BinaryReader): NewsletterStatusResponse;
}

export namespace NewsletterStatusResponse {
    export type AsObject = {
        success: boolean,
        newsletterId: string,
        successful: number,
        failed: number,
        total: number,
        groupUuid: string,
        completedAt: string,
        status: string,
        error: string,
    }
}

export class CancelNewsletterRequest extends jspb.Message { 
    getWorkflowId(): string;
    setWorkflowId(value: string): CancelNewsletterRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CancelNewsletterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CancelNewsletterRequest): CancelNewsletterRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CancelNewsletterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CancelNewsletterRequest;
    static deserializeBinaryFromReader(message: CancelNewsletterRequest, reader: jspb.BinaryReader): CancelNewsletterRequest;
}

export namespace CancelNewsletterRequest {
    export type AsObject = {
        workflowId: string,
    }
}

export class CancelNewsletterResponse extends jspb.Message { 
    getSuccess(): boolean;
    setSuccess(value: boolean): CancelNewsletterResponse;
    getError(): string;
    setError(value: string): CancelNewsletterResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CancelNewsletterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CancelNewsletterResponse): CancelNewsletterResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CancelNewsletterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CancelNewsletterResponse;
    static deserializeBinaryFromReader(message: CancelNewsletterResponse, reader: jspb.BinaryReader): CancelNewsletterResponse;
}

export namespace CancelNewsletterResponse {
    export type AsObject = {
        success: boolean,
        error: string,
    }
}

export class WorkflowRequest extends jspb.Message { 
    getWorkflowType(): string;
    setWorkflowType(value: string): WorkflowRequest;
    getWorkflowId(): string;
    setWorkflowId(value: string): WorkflowRequest;
    getInput(): string;
    setInput(value: string): WorkflowRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowRequest): WorkflowRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowRequest;
    static deserializeBinaryFromReader(message: WorkflowRequest, reader: jspb.BinaryReader): WorkflowRequest;
}

export namespace WorkflowRequest {
    export type AsObject = {
        workflowType: string,
        workflowId: string,
        input: string,
    }
}

export class WorkflowResponse extends jspb.Message { 
    getSuccess(): boolean;
    setSuccess(value: boolean): WorkflowResponse;
    getWorkflowId(): string;
    setWorkflowId(value: string): WorkflowResponse;
    getRunId(): string;
    setRunId(value: string): WorkflowResponse;
    getError(): string;
    setError(value: string): WorkflowResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowResponse): WorkflowResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowResponse;
    static deserializeBinaryFromReader(message: WorkflowResponse, reader: jspb.BinaryReader): WorkflowResponse;
}

export namespace WorkflowResponse {
    export type AsObject = {
        success: boolean,
        workflowId: string,
        runId: string,
        error: string,
    }
}

export class WorkflowResultRequest extends jspb.Message { 
    getWorkflowId(): string;
    setWorkflowId(value: string): WorkflowResultRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowResultRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowResultRequest): WorkflowResultRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowResultRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowResultRequest;
    static deserializeBinaryFromReader(message: WorkflowResultRequest, reader: jspb.BinaryReader): WorkflowResultRequest;
}

export namespace WorkflowResultRequest {
    export type AsObject = {
        workflowId: string,
    }
}

export class WorkflowResultResponse extends jspb.Message { 
    getSuccess(): boolean;
    setSuccess(value: boolean): WorkflowResultResponse;
    getResult(): string;
    setResult(value: string): WorkflowResultResponse;
    getError(): string;
    setError(value: string): WorkflowResultResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowResultResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowResultResponse): WorkflowResultResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowResultResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowResultResponse;
    static deserializeBinaryFromReader(message: WorkflowResultResponse, reader: jspb.BinaryReader): WorkflowResultResponse;
}

export namespace WorkflowResultResponse {
    export type AsObject = {
        success: boolean,
        result: string,
        error: string,
    }
}

export class WorkflowSignalRequest extends jspb.Message { 
    getWorkflowId(): string;
    setWorkflowId(value: string): WorkflowSignalRequest;
    getSignalName(): string;
    setSignalName(value: string): WorkflowSignalRequest;
    getPayload(): string;
    setPayload(value: string): WorkflowSignalRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowSignalRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowSignalRequest): WorkflowSignalRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowSignalRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowSignalRequest;
    static deserializeBinaryFromReader(message: WorkflowSignalRequest, reader: jspb.BinaryReader): WorkflowSignalRequest;
}

export namespace WorkflowSignalRequest {
    export type AsObject = {
        workflowId: string,
        signalName: string,
        payload: string,
    }
}

export class WorkflowSignalResponse extends jspb.Message { 
    getSuccess(): boolean;
    setSuccess(value: boolean): WorkflowSignalResponse;
    getError(): string;
    setError(value: string): WorkflowSignalResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowSignalResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowSignalResponse): WorkflowSignalResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowSignalResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowSignalResponse;
    static deserializeBinaryFromReader(message: WorkflowSignalResponse, reader: jspb.BinaryReader): WorkflowSignalResponse;
}

export namespace WorkflowSignalResponse {
    export type AsObject = {
        success: boolean,
        error: string,
    }
}

export class WorkflowCancelRequest extends jspb.Message { 
    getWorkflowId(): string;
    setWorkflowId(value: string): WorkflowCancelRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowCancelRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowCancelRequest): WorkflowCancelRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowCancelRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowCancelRequest;
    static deserializeBinaryFromReader(message: WorkflowCancelRequest, reader: jspb.BinaryReader): WorkflowCancelRequest;
}

export namespace WorkflowCancelRequest {
    export type AsObject = {
        workflowId: string,
    }
}

export class WorkflowCancelResponse extends jspb.Message { 
    getSuccess(): boolean;
    setSuccess(value: boolean): WorkflowCancelResponse;
    getError(): string;
    setError(value: string): WorkflowCancelResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkflowCancelResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkflowCancelResponse): WorkflowCancelResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkflowCancelResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkflowCancelResponse;
    static deserializeBinaryFromReader(message: WorkflowCancelResponse, reader: jspb.BinaryReader): WorkflowCancelResponse;
}

export namespace WorkflowCancelResponse {
    export type AsObject = {
        success: boolean,
        error: string,
    }
}

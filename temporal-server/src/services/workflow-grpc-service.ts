import { sendUnaryData, ServerUnaryCall } from '@grpc/grpc-js';
import { TemporalWorkerService } from './temporal-worker';
import { grpcLogger, workflowLogger } from '../logger';

// GRPC message types for generic workflows
export interface WorkflowRequest {
  workflow_type: string;
  workflow_id: string;
  input: string; // JSON serialized input
}

export interface WorkflowResponse {
  success: boolean;
  workflow_id: string;
  run_id: string;
  error?: string;
}

export interface WorkflowResultRequest {
  workflow_id: string;
}

export interface WorkflowResultResponse {
  success: boolean;
  result: string; // JSON serialized result
  error?: string;
}

export interface WorkflowSignalRequest {
  workflow_id: string;
  signal_name: string;
  payload: string; // JSON serialized payload
}

export interface WorkflowSignalResponse {
  success: boolean;
  error?: string;
}

export interface WorkflowCancelRequest {
  workflow_id: string;
}

export interface WorkflowCancelResponse {
  success: boolean;
  error?: string;
}

export class WorkflowGrpcService {
  constructor(private temporalWorker: TemporalWorkerService) {}

  async startWorkflow(
    call: ServerUnaryCall<WorkflowRequest, WorkflowResponse>,
    callback: sendUnaryData<WorkflowResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      workflowLogger.info(`🔄 Starting workflow ${request.workflow_type} with ID ${request.workflow_id}`);

      // Parse input if provided
      let input: any = undefined;
      if (request.input) {
        try {
          input = JSON.parse(request.input);
        } catch (parseError) {
          throw new Error(`Invalid JSON input: ${parseError.message}`);
        }
      }

      // Start the workflow
      const handle = await this.temporalWorker.startWorkflow(
        request.workflow_type,
        request.workflow_id,
        input
      );

      const response: WorkflowResponse = {
        success: true,
        workflow_id: handle.workflowId,
        run_id: handle.firstExecutionRunId,
      };

      workflowLogger.info(`✅ Workflow started: ${request.workflow_id}`);
      callback(null, response);

    } catch (error) {
      workflowLogger.error('❌ Failed to start workflow:', error);
      
      const response: WorkflowResponse = {
        success: false,
        workflow_id: call.request.workflow_id,
        run_id: '',
        error: error.message || 'Unknown error occurred',
      };

      callback(null, response);
    }
  }

  async getWorkflowResult(
    call: ServerUnaryCall<WorkflowResultRequest, WorkflowResultResponse>,
    callback: sendUnaryData<WorkflowResultResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      grpcLogger.info(`📊 Getting workflow result for ${request.workflow_id}`);

      const result = await this.temporalWorker.getWorkflowResult(request.workflow_id);

      const response: WorkflowResultResponse = {
        success: true,
        result: JSON.stringify(result),
      };

      grpcLogger.info(`✅ Workflow result retrieved for ${request.workflow_id}`);
      callback(null, response);

    } catch (error) {
      grpcLogger.error('❌ Failed to get workflow result:', error);

      const response: WorkflowResultResponse = {
        success: false,
        result: '',
        error: error.message || 'Unknown error occurred',
      };

      callback(null, response);
    }
  }

  async signalWorkflow(
    call: ServerUnaryCall<WorkflowSignalRequest, WorkflowSignalResponse>,
    callback: sendUnaryData<WorkflowSignalResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      grpcLogger.info(`📡 Sending signal ${request.signal_name} to workflow ${request.workflow_id}`);

      // Parse payload if provided
      let payload: any = undefined;
      if (request.payload) {
        try {
          payload = JSON.parse(request.payload);
        } catch (parseError) {
          throw new Error(`Invalid JSON payload: ${parseError.message}`);
        }
      }

      await this.temporalWorker.signalWorkflow(
        request.workflow_id,
        request.signal_name,
        payload
      );

      const response: WorkflowSignalResponse = {
        success: true,
      };

      grpcLogger.info(`✅ Signal sent to workflow: ${request.workflow_id}`);
      callback(null, response);

    } catch (error) {
      grpcLogger.error('❌ Failed to signal workflow:', error);

      const response: WorkflowSignalResponse = {
        success: false,
        error: error.message || 'Unknown error occurred',
      };

      callback(null, response);
    }
  }

  async cancelWorkflow(
    call: ServerUnaryCall<WorkflowCancelRequest, WorkflowCancelResponse>,
    callback: sendUnaryData<WorkflowCancelResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      workflowLogger.info(`🛑 Cancelling workflow ${request.workflow_id}`);

      await this.temporalWorker.cancelWorkflow(request.workflow_id);

      const response: WorkflowCancelResponse = {
        success: true,
      };

      workflowLogger.info(`✅ Workflow cancelled: ${request.workflow_id}`);
      callback(null, response);

    } catch (error) {
      workflowLogger.error('❌ Failed to cancel workflow:', error);

      const response: WorkflowCancelResponse = {
        success: false,
        error: error.message || 'Unknown error occurred',
      };

      callback(null, response);
    }
  }
}



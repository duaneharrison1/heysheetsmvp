/**
 * DEBUG RESPONSE BUILDERS
 * ======================
 * Constructs detailed debug responses with timing, tokens, costs, and execution steps.
 * Only used for admin/debug features.
 */

import {
  FunctionResult,
  ChatCompletionResponse,
} from '../_shared/types.ts';
import {
  getModelPricing,
  calculateCost,
} from '../_shared/config.ts';

/** Build debug response for skipResponder mode */
export function buildSkipResponderResponse(
  functionResult: FunctionResult,
  classification: any,
  classifyUsage: { input: number; output: number },
  classifyDuration: number,
  functionDuration: number,
  totalDuration: number,
  model?: string,
  dataLoadDuration?: number,
  dataLoadSource?: 'orchestrator' | 'function' | 'both'
): ChatCompletionResponse {
  const pricing = getModelPricing(model);

  return {
    text: functionResult.message!,
    functionCalled: classification.function_to_call || undefined,
    functionResult,
    debug: {
      intentDuration: classifyDuration,
      functionDuration,
      responseDuration: 0,
      totalDuration,
      dataLoadDuration,
      dataLoadSource,
      toolSelection: {
        function: classification.function_to_call,
        duration: classifyDuration,
      },
      functionCalls: [{
        name: classification.function_to_call || '',
        arguments: classification.extracted_params || {},
        result: {
          success: functionResult.success,
          data: functionResult.data,
          error: functionResult.error,
        },
        duration: functionDuration,
      }],
      tokens: {
        classification: { input: classifyUsage.input, output: classifyUsage.output },
        response: { input: 0, output: 0 },
        total: { input: classifyUsage.input, output: classifyUsage.output, cached: 0 },
      },
      cost: {
        classification: calculateCost(classifyUsage.input, classifyUsage.output, model),
        response: 0,
        total: calculateCost(classifyUsage.input, classifyUsage.output, model),
      },
      steps: [
        {
          name: 'Tool Selection',
          function: 'classifier',
          status: 'success',
          duration: classifyDuration,
          result: {
            function_to_call: classification.function_to_call,
            params: classification.extracted_params,
            tokens: { input: classifyUsage.input, output: classifyUsage.output },
          },
        },
        {
          name: 'Function Execution',
          function: 'tools',
          status: functionResult.success ? 'success' : 'error',
          duration: functionDuration,
          functionCalled: classification.function_to_call,
          result: functionResult.success ? functionResult.data : undefined,
        },
        {
          name: 'Response Generation',
          function: 'skipResponder',
          status: 'success',
          duration: 0,
          result: {
            length: functionResult.message!.length,
            note: 'Deterministic response - LLM bypassed',
          },
        },
      ],
    },
  };
}

/** Build full debug response with responder */
export function buildFullResponse(
  responseText: string,
  suggestions: string[],
  classification: any,
  functionResult: FunctionResult | undefined,
  classifyUsage: { input: number; output: number },
  responseUsage: { input: number; output: number },
  classifyDuration: number,
  functionDuration: number,
  responseDuration: number,
  totalDuration: number,
  reasoningEnabled: boolean,
  model?: string,
  dataLoadDuration?: number,
  dataLoadSource?: 'orchestrator' | 'function' | 'both'
): ChatCompletionResponse {
  const pricing = getModelPricing(model);
  const totalInputTokens = classifyUsage.input + responseUsage.input;
  const totalOutputTokens = classifyUsage.output + responseUsage.output;
  const totalCost = calculateCost(totalInputTokens, totalOutputTokens, model);

  return {
    text: responseText,
    functionCalled: classification.function_to_call || undefined,
    functionResult,
    suggestions,
    debug: {
      endpoint: 'chat-completion',
      reasoningEnabled,
      intentDuration: classifyDuration,
      functionDuration,
      responseDuration,
      totalDuration,
      dataLoadDuration,
      dataLoadSource,
      toolSelection: {
        function: classification.function_to_call,
        duration: classifyDuration,
      },
      functionCalls: functionResult
        ? [{
            name: classification.function_to_call || '',
            arguments: classification.extracted_params || {},
            result: {
              success: functionResult.success,
              data: functionResult.data,
              error: functionResult.error,
            },
            duration: functionDuration,
          }]
        : [],
      tokens: {
        classification: { input: classifyUsage.input, output: classifyUsage.output },
        response: { input: responseUsage.input, output: responseUsage.output },
        total: { input: totalInputTokens, output: totalOutputTokens, cached: 0 },
      },
      cost: {
        classification: calculateCost(classifyUsage.input, classifyUsage.output, model),
        response: calculateCost(responseUsage.input, responseUsage.output, model),
        total: totalCost,
      },
      steps: [
        {
          name: 'Tool Selection',
          function: 'classifier',
          status: 'success',
          duration: classifyDuration,
          result: {
            function_to_call: classification.function_to_call,
            params: classification.extracted_params,
            tokens: { input: classifyUsage.input, output: classifyUsage.output },
          },
        },
        ...(classification.function_to_call && classification.function_to_call !== null
          ? [{
              name: 'Function Execution',
              function: 'tools',
              status: functionResult?.success ? 'success' : 'error',
              duration: functionDuration,
              functionCalled: classification.function_to_call,
              result: functionResult?.success ? functionResult.data : undefined,
              error: !functionResult?.success
                ? {
                    message: functionResult?.error || 'Function execution failed',
                    args: classification.extracted_params,
                  }
                : undefined,
            }]
          : []),
        {
          name: 'Response Generation',
          function: 'responder',
          status: 'success',
          duration: responseDuration,
          result: {
            length: responseText?.length || 0,
            tokens: { input: responseUsage.input, output: responseUsage.output },
          },
        },
      ],
    },
  };
}

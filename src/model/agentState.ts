import {AIMessage, BaseMessage, HumanMessage, MessageContent, SystemMessage} from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import { DatadogLog } from './datadog';
import { QueryCategory, EnvironmentType, EntityType } from './types/general';
import { Version } from './types/entityHistory';
import { OfferPriceResponse } from './types/UPS';
import { Offer as GenieOffer } from './types/genieGraphql';
import { Offer as OfferServiceOffer } from './types/offerService';

export type FeedbackType = 'positive' | 'negative' | 'neutral';

export type AgentMessageFeedback = {
  type: FeedbackType;
  comment?: string;
  timestamp: Date;
  feedbackSource?: string;
};

export type AnalysisResults = {
  datadogLogs?: string;
  datadogWarnings?: string;
  datadogErrors?: string;
  entityHistory?: string;
  upsOfferPrice?: string;
  offerServiceDetails?: string;
  genieOfferDetails?: string;
  [key: `offerComparison_${string}`]: string | undefined;
  offerComparison?: string;
}
export type AgentStateData = {
  messages: BaseMessage[];
  userQuery?: string;
  entityIds: string[];
  entityType: EntityType;
  environment: EnvironmentType;
  timeRange?: string;
  datadogLogs: DatadogLog[];
  entityHistory: Version[];
  analysisResults: AnalysisResults;
  runParallelAnalysis: boolean;
  finalSummary?: MessageContent;
  queryCategory?: QueryCategory;
  offerPriceDetails?: OfferPriceResponse[];
  genieOfferDetails?: GenieOffer[];
  offerServiceDetails?: OfferServiceOffer[];
  messageFeedbacks: Record<string, AgentMessageFeedback>;
  overallRlReward?: number;
  currentEpisodeActions?: {
    nodeName: string;
    actionDescription: string;
    actionParameters?: Record<string, any>;
    timestamp: Date;
    stateEmbedding?: number[];
    associatedMessageId?: string;
  }[];
  rlFeatures?: {
    queryEmbedding?: number[];
    retrievalPerformanceScore?: number;
    hasDatadogWarnings?: boolean;
    hasDatadogErrors?: boolean;
    numEntityHistoryVersions?: number;
    responseLengthOfLastAI?: number;
    sentimentOfLastResponse?: number;
    averageFeedbackScoreOnAIReplies?: number;
    numNegativeFeedbacks?: number;
    numPositiveFeedbacks?: number;
    lastAIResponseFeedbackType?: FeedbackType | null;
    numTurnsInConversation?: number;
  };
  chosenRLAction?: {
    type:
      | 'retrieval_strategy'
      | 'generation_style'
      | 'analysis_depth'
      | 're_query'
      | 'present_summary';
    value: string;
    producedMessageId?: string;
  };
  rlEpisodeId?: string;
  rlTrainingIteration?: number;
  overallFeedbackAttempts?: number;
};

function getMessageIdentifier(msg: BaseMessage): string {
  if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
    const toolCallIds = msg.tool_calls.map(tc => tc.id).sort().join(',');
    return `AI_TOOL_USE:${toolCallIds}`;
  }
  const contentAsAny = msg.content as any;
  if (msg instanceof HumanMessage && Array.isArray(contentAsAny) && contentAsAny.length > 0 && contentAsAny[0]?.type === 'tool_result') {
    return `TOOL_RESULT:${contentAsAny[0].tool_use_id}`;
  }
  if (msg instanceof SystemMessage) {
    return `SYSTEM:${JSON.stringify(msg.content)}`;
  }
  return `${msg.getType}:${msg.name || ''}:${JSON.stringify(msg.content)}`;
}

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[], BaseMessage[]>({
    value: (x: BaseMessage[] | undefined, y: BaseMessage[] | undefined): BaseMessage[] => {
      const existingMessages = x || [];
      const newMessages = y || [];

      const existingIdentifiers = new Set<string>();
      for (const msg of existingMessages) {
        existingIdentifiers.add(getMessageIdentifier(msg));
      }

      const uniqueNewMessages = newMessages.filter(msg => {
        const identifier = getMessageIdentifier(msg);
        const isDuplicate = existingIdentifiers.has(identifier);
        if (!isDuplicate) {
          existingIdentifiers.add(identifier);
        }
        return !isDuplicate;
      });

      return existingMessages.concat(uniqueNewMessages);
    },
    default: () => [],
  }),

  userQuery: Annotation<string | undefined, string | undefined>({
    value: (x: string | undefined, y: string | undefined): string | undefined => y ?? x,
    default: () => undefined,
  }),

  entityIds: Annotation<string[], string[]>({
    value: (x: string[] | undefined, y: string[]): string[] => y,
    default: () => [],
  }),

  entityType: Annotation<EntityType, EntityType>({
    value: (x: EntityType | undefined, y: EntityType): EntityType => y ?? x,
    default: () => 'unknown',
  }),

  environment: Annotation<EnvironmentType, EnvironmentType>({
    value: (x: EnvironmentType | undefined, y: EnvironmentType): EnvironmentType => y ?? x,
    default: () => 'unknown',
  }),

  timeRange: Annotation<string | undefined, string>({
    value: (x: string | undefined, y: string): string => y ?? x,
    default: () => undefined,
  }),

  datadogLogs: Annotation<DatadogLog[], DatadogLog[]>({
    value: (x: DatadogLog[] | undefined, y: DatadogLog[]): DatadogLog[] => y,
    default: () => [],
  }),

  entityHistory: Annotation<Version[], Version[]>({
    value: (x: Version[] | undefined, y: Version[]): Version[] => y,
    default: () => [],
  }),

  analysisResults: Annotation<AgentStateData['analysisResults'], AgentStateData['analysisResults']>(
    {
      value: (
        x: AgentStateData['analysisResults'],
        y: AgentStateData['analysisResults'],
      ): AgentStateData['analysisResults'] => ({ ...(x || {}), ...(y || {}) }),
      default: () => ({}),
    },
  ),

  runParallelAnalysis: Annotation<boolean, boolean>({
    value: (x: boolean | undefined, y: boolean): boolean => y ?? x,
    default: () => false,
  }),

  finalSummary: Annotation<MessageContent | undefined, MessageContent | undefined>({
    value: (
      x: MessageContent | undefined,
      y: MessageContent | undefined,
    ): MessageContent | undefined => y ?? x,
    default: () => undefined,
  }),

  queryCategory: Annotation<QueryCategory, QueryCategory>({
    value: (x: QueryCategory | undefined, y: QueryCategory): QueryCategory => y ?? x,
    default: () => 'UNKNOWN_CATEGORY',
  }),

  offerPriceDetails: Annotation<OfferPriceResponse[] | undefined, OfferPriceResponse[] | undefined>(
    {
      value: (
        x: OfferPriceResponse[] | undefined,
        y: OfferPriceResponse[] | undefined,
      ): OfferPriceResponse[] | undefined => y ?? x,
      default: () => undefined,
    },
  ),

  genieOfferDetails: Annotation<GenieOffer[] | undefined, GenieOffer[] | undefined>({
    value: (x: GenieOffer[] | undefined, y: GenieOffer[] | undefined): GenieOffer[] | undefined =>
      y ?? x,
    default: () => undefined,
  }),

  offerServiceDetails: Annotation<OfferServiceOffer[] | undefined, OfferServiceOffer[] | undefined>({
    value: (x:OfferServiceOffer[] | undefined, y: OfferServiceOffer[] | undefined): OfferServiceOffer[] | undefined =>
        y ?? x,
    default: () => undefined,
  }),

  messageFeedbacks: Annotation<
    Record<string, AgentMessageFeedback>,
    Record<string, AgentMessageFeedback>
  >({
    value: (
      x: Record<string, AgentMessageFeedback>,
      y: Record<string, AgentMessageFeedback>,
    ): Record<string, AgentMessageFeedback> => ({ ...x, ...y }),
    default: () => ({}),
  }),

  overallRlReward: Annotation<number | undefined, number | undefined>({
    value: (x: number | undefined, y: number | undefined): number | undefined => y ?? x,
    default: () => undefined,
  }),

  currentEpisodeActions: Annotation<
    AgentStateData['currentEpisodeActions'],
    AgentStateData['currentEpisodeActions']
  >({
    value: (
      x: AgentStateData['currentEpisodeActions'],
      y: AgentStateData['currentEpisodeActions'],
    ): AgentStateData['currentEpisodeActions'] => (x || []).concat(y || []),
    default: () => [],
  }),

  rlFeatures: Annotation<AgentStateData['rlFeatures'], AgentStateData['rlFeatures']>({
    value: (
      x: AgentStateData['rlFeatures'],
      y: AgentStateData['rlFeatures'],
    ): AgentStateData['rlFeatures'] => {
      if (x === undefined && y === undefined) {
        return undefined;
      }
      return { ...(x || {}), ...(y || {}) };
    },
    default: () => undefined,
  }),

  chosenRLAction: Annotation<AgentStateData['chosenRLAction'], AgentStateData['chosenRLAction']>({
    value: (
      x: AgentStateData['chosenRLAction'],
      y: AgentStateData['chosenRLAction'],
    ): AgentStateData['chosenRLAction'] => y ?? x,
    default: () => undefined,
  }),

  rlEpisodeId: Annotation<string | undefined, string | undefined>({
    value: (x: string | undefined, y: string | undefined): string | undefined => y ?? x,
    default: () => undefined,
  }),

  rlTrainingIteration: Annotation<number | undefined, number | undefined>({
    value: (x: number | undefined, y: number | undefined): number | undefined => y ?? x,
    default: () => undefined,
  }),

  overallFeedbackAttempts: Annotation<number | undefined, number | undefined>({
    value: (x: number | undefined, y: number | undefined): number | undefined => y ?? x,
    default: () => 0,
  }),
});

/**
 * AgentState is the convenience type for nodes and application logic.
 * It is derived from AgentStateAnnotation.State, which correctly unwraps the channels
 * to give you AgentStateData.
 */
export type AgentState = typeof AgentStateAnnotation.State;

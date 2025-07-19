import { BaseMessage, MessageContent } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
// Note: We are no longer importing LastValue or BinaryOperatorAggregate directly here.
// We let Annotation() infer them based on the structure we provide.

// Assuming these are in separate files or defined here
import { DatadogLog } from './datadog';
import { QueryCategory, EnvironmentType, EntityType } from './types/general';
import { Version } from './types/entityHistory';
import { OfferPriceResponse } from './types/UPS';
import { Offer as GenieOffer } from './types/genieGraphql'; // <--- Renamed for clarity
import { Offer as OfferServiceOffer } from './types/offerService';

// --- Feedback Types ---
export type FeedbackType = 'positive' | 'negative' | 'neutral';

export type AgentMessageFeedback = {
  type: FeedbackType;
  comment?: string;
  timestamp: Date;
  feedbackSource?: string;
};

// --- Agent State Data Definition (Your core data type) ---
// This remains the same, as it defines the shape of the data itself.
export type AgentStateData = {
  messages: BaseMessage[];
  userQuery?: string;
  entityIds: string[];
  entityType: EntityType;
  environment: EnvironmentType;
  timeRange: string;
  datadogLogs: DatadogLog[];
  entityHistory: Version[];
  analysisResults: {
    datadogWarnings?: string;
    datadogErrors?: string;
    entityHistory?: string;
    upsOfferPrice?: string;
    offerServiceDetails?: string;
  };
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

// --- AgentStateAnnotation: Define channels directly within Annotation.Root ---
// We let Annotation.Root infer the overall StateDefinition based on the channels provided.
// The key is to correctly type the 'value' and 'default' for EACH Annotation().
export const AgentStateAnnotation = Annotation.Root({
  // For 'messages': This is a concatenating channel.
  messages: Annotation<BaseMessage[], BaseMessage[]>({
    // Explicitly type the Annotation for clarity
    value: (x: BaseMessage[], y: BaseMessage[]): BaseMessage[] => x.concat(y),
    default: () => [],
  }),

  // For 'userQuery': This is a LastValue channel that can be undefined.
  // The 'value' function should return the same type as the channel itself.
  userQuery: Annotation<string | undefined, string | undefined>({
    value: (x: string | undefined, y: string | undefined): string | undefined => y ?? x,
    default: () => undefined,
  }),

  // For 'entityIds': This is a LastValue channel.
  // The initial 'x' can be undefined as it's the first value.
  entityIds: Annotation<string[], string[]>({
    value: (x: string[] | undefined, y: string[]): string[] => y, // Overwrite with new array
    default: () => [],
  }),

  // For 'entityType': LastValue
  entityType: Annotation<EntityType, EntityType>({
    value: (x: EntityType | undefined, y: EntityType): EntityType => y ?? x,
    default: () => 'unknown',
  }),

  // For 'environment': LastValue
  environment: Annotation<EnvironmentType, EnvironmentType>({
    value: (x: EnvironmentType | undefined, y: EnvironmentType): EnvironmentType => y ?? x,
    default: () => 'unknown',
  }),

  // For 'timeRange': LastValue
  timeRange: Annotation<string, string>({
    value: (x: string | undefined, y: string): string => y ?? x,
    default: () => '24h',
  }),

  // For 'datadogLogs': LastValue (assuming you replace the array, not concat)
  datadogLogs: Annotation<DatadogLog[], DatadogLog[]>({
    value: (x: DatadogLog[] | undefined, y: DatadogLog[]): DatadogLog[] => y,
    default: () => [],
  }),

  // For 'entityHistory': LastValue
  entityHistory: Annotation<Version[], Version[]>({
    value: (x: Version[] | undefined, y: Version[]): Version[] => y,
    default: () => [],
  }),

  // For 'analysisResults': Merging object
  analysisResults: Annotation<AgentStateData['analysisResults'], AgentStateData['analysisResults']>(
    {
      value: (
        x: AgentStateData['analysisResults'],
        y: AgentStateData['analysisResults'],
      ): AgentStateData['analysisResults'] => ({ ...(x || {}), ...(y || {}) }),
      default: () => ({}),
    },
  ),

  // For 'runParallelAnalysis': LastValue
  runParallelAnalysis: Annotation<boolean, boolean>({
    value: (x: boolean | undefined, y: boolean): boolean => y ?? x,
    default: () => false,
  }),

  // For 'finalSummary': LastValue (can be undefined)
  finalSummary: Annotation<MessageContent | undefined, MessageContent | undefined>({
    value: (
      x: MessageContent | undefined,
      y: MessageContent | undefined,
    ): MessageContent | undefined => y ?? x,
    default: () => undefined,
  }),

  // For 'queryCategory': LastValue
  queryCategory: Annotation<QueryCategory, QueryCategory>({
    value: (x: QueryCategory | undefined, y: QueryCategory): QueryCategory => y ?? x,
    default: () => 'UNKNOWN_CATEGORY',
  }),

  // For 'offerPriceDetails': LastValue (can be undefined)
  offerPriceDetails: Annotation<OfferPriceResponse[] | undefined, OfferPriceResponse[] | undefined>(
    {
      value: (
        x: OfferPriceResponse[] | undefined,
        y: OfferPriceResponse[] | undefined,
      ): OfferPriceResponse[] | undefined => y ?? x,
      default: () => undefined,
    },
  ),

  // For 'genieOfferDetails': LastValue (can be undefined)
  genieOfferDetails: Annotation<GenieOffer[] | undefined, GenieOffer[] | undefined>({
    value: (x: GenieOffer[] | undefined, y: GenieOffer[] | undefined): GenieOffer[] | undefined =>
      y ?? x,
    default: () => undefined,
  }),

  // --- Custom Reducers for new RL/Feedback fields ---
  // For 'messageFeedbacks': Merging object
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

  // For 'overallRlReward': LastValue (can be undefined)
  overallRlReward: Annotation<number | undefined, number | undefined>({
    value: (x: number | undefined, y: number | undefined): number | undefined => y ?? x,
    default: () => undefined,
  }),

  // For 'currentEpisodeActions': Concatenating array, can start undefined
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

  // For 'rlFeatures': Merging object, can be undefined
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

  // For 'chosenRLAction': LastValue (can be undefined)
  chosenRLAction: Annotation<AgentStateData['chosenRLAction'], AgentStateData['chosenRLAction']>({
    value: (
      x: AgentStateData['chosenRLAction'],
      y: AgentStateData['chosenRLAction'],
    ): AgentStateData['chosenRLAction'] => y ?? x,
    default: () => undefined,
  }),

  // For 'rlEpisodeId': LastValue (can be undefined)
  rlEpisodeId: Annotation<string | undefined, string | undefined>({
    value: (x: string | undefined, y: string | undefined): string | undefined => y ?? x,
    default: () => undefined,
  }),

  // For 'rlTrainingIteration': LastValue (can be undefined)
  rlTrainingIteration: Annotation<number | undefined, number | undefined>({
    value: (x: number | undefined, y: number | undefined): number | undefined => y ?? x,
    default: () => undefined,
  }),

  // For 'overallFeedbackAttempts': LastValue (can be undefined)
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

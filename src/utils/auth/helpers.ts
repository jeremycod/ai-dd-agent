import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { uuidv4 } from 'zod/v4';
export const generateNewAIMessage = (content: string): AIMessage => {
  return new AIMessage({
    content: content,
    additional_kwargs: {
      messageId: uuidv4(),
    },
  });
};

export const generateNewHumanMessage = (content: string): HumanMessage => {
  return new HumanMessage({
    content: content,
    additional_kwargs: {
      messageId: uuidv4(),
    },
  });
};

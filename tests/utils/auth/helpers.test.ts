import { generateNewAIMessage, generateNewHumanMessage } from '../../../src/utils/auth/helpers';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

// Mock uuid
jest.mock('zod/v4', () => ({
  uuidv4: jest.fn(() => 'mock-uuid-123')
}));

describe('auth/helpers', () => {
  describe('generateNewAIMessage', () => {
    it('should create AIMessage with content and messageId', () => {
      const content = 'Test AI message';
      const result = generateNewAIMessage(content);
      
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toBe(content);
      expect(result.additional_kwargs.messageId).toBe('mock-uuid-123');
    });

    it('should handle empty content', () => {
      const result = generateNewAIMessage('');
      
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toBe('');
      expect(result.additional_kwargs.messageId).toBe('mock-uuid-123');
    });
  });

  describe('generateNewHumanMessage', () => {
    it('should create HumanMessage with content and messageId', () => {
      const content = 'Test human message';
      const result = generateNewHumanMessage(content);
      
      expect(result).toBeInstanceOf(HumanMessage);
      expect(result.content).toBe(content);
      expect(result.additional_kwargs.messageId).toBe('mock-uuid-123');
    });

    it('should handle empty content', () => {
      const result = generateNewHumanMessage('');
      
      expect(result).toBeInstanceOf(HumanMessage);
      expect(result.content).toBe('');
      expect(result.additional_kwargs.messageId).toBe('mock-uuid-123');
    });
  });
});
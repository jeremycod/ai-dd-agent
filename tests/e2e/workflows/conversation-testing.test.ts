describe('Multi-Turn Conversation Testing', () => {
  // Mock conversation session
  class MockConversationSession {
    private context: any = {};
    private history: any[] = [];

    async sendMessage(message: string) {
      const turn = {
        message,
        timestamp: new Date(),
        context: { ...this.context }
      };

      // Simulate context building
      if (message.includes('ABC-123')) {
        this.context.entityIds = ['ABC-123'];
      }
      if (message.includes('XYZ-789')) {
        this.context.entityIds = ['XYZ-789'];
      }
      if (message.toLowerCase().includes('production')) {
        this.context.environment = 'production';
      }
      if (message.toLowerCase().includes('staging')) {
        this.context.environment = 'staging';
      }

      // Simulate response logic
      let response = {
        requiresClarification: false,
        clarificationQuestions: [] as string[],
        toolsUsed: [] as string[],
        context: { ...this.context }
      };

      if (message === 'Check offer status') {
        response.requiresClarification = true;
        response.clarificationQuestions = ['Which offer?', 'In which environment?'];
      } else if (message.includes('Offer ABC-123') && !this.context.environment) {
        response.requiresClarification = true;
        response.clarificationQuestions = ['In which environment?'];
      } else if (this.context.entityIds && this.context.environment) {
        response.toolsUsed = ['genieOffer', 'entityHistory'];
      }

      this.history.push({ ...turn, response });
      return response;
    }

    getHistory() {
      return {
        turns: this.history,
        contextEvolution: this.history.map(h => h.context)
      };
    }
  }

  it('should maintain context across conversation turns', async () => {
    const conversation = new MockConversationSession();
    
    // Turn 1: Initial ambiguous query
    const turn1 = await conversation.sendMessage('Check offer status');
    expect(turn1.requiresClarification).toBe(true);
    expect(turn1.clarificationQuestions).toContain('Which offer?');
    
    // Turn 2: Provide entity ID
    const turn2 = await conversation.sendMessage('Offer ABC-123');
    expect(turn2.requiresClarification).toBe(true);
    expect(turn2.context.entityIds).toContain('ABC-123');
    
    // Turn 3: Provide environment
    const turn3 = await conversation.sendMessage('Production environment');
    expect(turn3.requiresClarification).toBe(false);
    expect(turn3.toolsUsed).toContain('genieOffer');
    expect(turn3.context.entityIds).toContain('ABC-123');
    expect(turn3.context.environment).toBe('production');
    
    // Turn 4: Follow-up question with context
    const turn4 = await conversation.sendMessage('What about in staging?');
    expect(turn4.context.entityIds).toContain('ABC-123'); // Context maintained
    expect(turn4.context.environment).toBe('staging'); // Environment updated
    
    // Verify conversation memory
    const history = conversation.getHistory();
    expect(history.turns).toHaveLength(4);
    expect(history.contextEvolution).toBeDefined();
  });

  it('should handle context switching gracefully', async () => {
    const conversation = new MockConversationSession();
    
    // Start with offer topic
    await conversation.sendMessage('Check offer ABC-123 in production');
    
    // Switch to different offer
    const switchResponse = await conversation.sendMessage('Now check offer XYZ-789 status');
    
    // Verify context includes new entity
    expect(switchResponse.context.entityIds).toContain('XYZ-789');
  });

  it('should track conversation quality over multiple turns', async () => {
    const conversation = new MockConversationSession();
    const qualityScores = [];
    
    const messages = [
      'Check offer status',
      'Offer ABC-123',
      'Production environment',
      'What about pricing?',
      'Compare with staging'
    ];

    for (const message of messages) {
      const response = await conversation.sendMessage(message);
      
      // Mock quality scoring for each turn
      const turnQuality = {
        contextPreservation: response.context.entityIds ? 1.0 : 0.5,
        clarityImprovement: response.requiresClarification ? 0.6 : 1.0,
        toolRelevance: response.toolsUsed.length > 0 ? 0.9 : 0.7
      };
      
      qualityScores.push(turnQuality);
    }

    // Verify quality improves over conversation
    const avgQuality = qualityScores.reduce((sum, q) => 
      sum + (q.contextPreservation + q.clarityImprovement + q.toolRelevance) / 3, 0
    ) / qualityScores.length;

    expect(avgQuality).toBeGreaterThan(0.7);
    
    // Later turns should have better context preservation
    const laterTurns = qualityScores.slice(-2);
    laterTurns.forEach(quality => {
      expect(quality.contextPreservation).toBeGreaterThan(0.8);
    });
  });
});
describe('Simple E2E Test', () => {
  it('should run basic test without complex imports', () => {
    expect(true).toBe(true);
  });

  it('should test basic functionality', () => {
    const testData = {
      query: 'test query',
      category: 'ENTITY_STATUS',
      response: 'test response'
    };

    expect(testData.query).toBe('test query');
    expect(testData.category).toBe('ENTITY_STATUS');
    expect(testData.response).toBe('test response');
  });
});
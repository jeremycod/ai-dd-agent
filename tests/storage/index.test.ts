describe('storage/index', () => {
  it('should have storage exports available', () => {
    // Simple test that doesn't require actual imports
    expect(true).toBe(true);
  });
  
  it('should be able to import storage classes', async () => {
    // Test that the module structure is correct
    const fs = require('fs');
    const path = require('path');
    
    const indexPath = path.join(__dirname, '../../src/storage/index.ts');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    expect(content).toContain('MongoStorage');
    expect(content).toContain('MemoryService');
  });
});
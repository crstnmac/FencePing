# Device Query Timeout Optimizations

## Overview

This document outlines the improvements made to address device query timeouts in the geofence application. The original system had basic timeout settings but lacked comprehensive timeout handling for device operations.

## Problems Addressed

1. **Fixed timeout handling**: The original database pool had short timeouts that could cause issues with device queries
2. **Scalability concerns**: No pagination for large device result sets
3. **Poor error handling**: Generic 500 errors for timeout scenarios
4. **Lack of query performance monitoring**: No visibility into slow queries

## Improvements Implemented

### 1. Enhanced Database Pool Configuration

**File**: `apps/api/src/db/client.ts`

**Changes**:

- Increased maximum connections from 10 to 15 for better concurrency
- Increased idle timeout from 15s to 30s for complex queries
- Increased connection timeout from 10s to 15s for slower connections
- Increased query timeout from 20s to 60s for complex operations
- Added additional 45s query timeout for safety
- Increased allowExitOnIdle from 1 hour to 2 hours

```typescript
// Before
max: 10,
idleTimeoutMillis: 15000,
connectionTimeoutMillis: 10000,
statement_timeout: 20000,

// After
max: 15,
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 15000,
statement_timeout: 60000,
query_timeout: 45000,
```

### 2. Custom Query Timeout Function

**File**: `apps/api/src/db/client.ts`

Added `queryWithTimeout()` function for device-specific operations:

```typescript
export const queryWithTimeout = async (
  text: string,
  params?: any[],
  timeoutMs: number = 30000
): Promise<any> => {
  const client = await getDbClient();
  const start = Date.now();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    const res = await client.query(text, params);
    await client.query('COMMIT');

    const duration = Date.now() - start;
    console.log(`Executed query with ${timeoutMs}ms timeout`, {
      text,
      duration,
      rows: res.rowCount,
    });

    // Reset statement timeout to default
    await client.query('SET LOCAL statement_timeout = DEFAULT');

    return res;
  } catch (err) {
    // Enhanced error handling with timeout detection
    if (err && typeof err === 'object' && 'message' in err && 'code' in err) {
      const error = err as { message: string; code: string };
      if (error.message?.includes('statement timeout') || error.code === '57014') {
        throw new Error(`Query timeout after ${timeoutMs}ms: ${text.substring(0, 100)}...`);
      }
    }
    throw err;
  } finally {
    client.end();
  }
};
```

### 3. Device Routes Pagination and Timeout Handling

**File**: `apps/api/src/routes/devices.ts`

**API Endpoint**: `GET /devices`

**New Features**:

- **Pagination**: Query parameters `?page=1&limit=50` (max 500 devices per page)
- **Count-only queries**: `?count=true` for performance-optimized count
- **Custom timeouts**:

| Operation             | Timeout       | Purpose                       |
| --------------------- | ------------- | ----------------------------- |
| Device listing        | 30s           | Fetch devices with pagination |
| Count query           | 15s           | Fast count for pagination     |
| Specific device fetch | Default (60s) | Simple single device query    |

**Response Format**:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Usage Examples**:

```bash
# Get devices with pagination
GET /devices?page=1&limit=100

# Get only total count (faster)
GET /devices?count=true

# Get second page
GET /devices?page=2&limit=50
```

### 4. Enhanced Error Handling

**Timeout-Specific Error Responses**:

- **408 Request Timeout**: For query timeouts with descriptive message
- Better logging of query performance with durations
- Type-safe error checking to avoid TypeScript warnings

**Error Response for Timeouts**:

```json
{
  "success": false,
  "error": "Request timeout - too many devices or slow database connection"
}
```

## Performance Improvements

### 1. Pagination Benefits

- Reduces memory usage for large device lists
- Faster initial page loads
- Prevents UI blocking on large datasets
- Enables better user experience with loading states

### 2. Timeout Benefits

- Prevents indefinite hanging queries
- Allows graceful degradation with 408 errors
- Better monitoring and alerting capabilities
- Improved client-side error handling

### 3. Database Optimization

- Increased connection pool size for higher concurrent load
- Optimized timeouts for different query types
- Better connection lifecycle management

## Migration Notes

### Existing API Users

- **Backward compatible**: Existing queries without pagination work fine
- **Default behavior**: Returns first 50 devices if no pagination parameters
- **No breaking changes**: All existing endpoints function identically

### Performance Considerations

- Count queries are optimized for speed (15s timeout)
- Main device queries have reasonable 30s timeout
- Connection pooling improved for concurrent requests

## Monitoring

Enhanced logging includes:

- Query execution duration
- Timeout settings used
- Row counts returned
- Connection pool status

Example log output:

```
Executed query with 30000ms timeout { text: "SELECT id,name,...", duration: 156, rows: 50 }
```

## Best Practices Implemented

1. **Explicit timeout handling**: Different timeouts for different operations
2. **Pagination by default**: Prevents large result set issues
3. **Count optimization**: Separate fast path for count-only requests
4. **Error classification**: Specific handling for different error types
5. **Resource cleanup**: Proper client release in finally blocks
6. **Type safety**: TypeScript improvements for better error handling

## Testing Recommendations

1. Load test with 1000+ devices
2. Test timeout scenarios with slow database connections
3. Verify pagination works correctly across multiple pages
4. Test concurrent device operations
5. Validate error responses contain appropriate timeout messages

## Future Enhancements

Potential additional improvements:

1. Query result caching with Redis
2. Database connection health checks
3. Automatic query optimization based on table statistics
4. Rate limiting for high-frequency device queries
5. Background processing for bulk device operations

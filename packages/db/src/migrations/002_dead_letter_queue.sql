-- Migration: 002_dead_letter_queue.sql
-- Add dead letter queue table for failed webhook jobs

-- Dead Letter Queue for failed webhook jobs
CREATE TABLE dead_letter_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL DEFAULT 'webhook',
    job_data JSONB NOT NULL,
    error_message TEXT NOT NULL,
    failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(20) NOT NULL DEFAULT 'failed' CHECK (status IN ('failed', 'replayed', 'permanent_failure')),
    replayed_at TIMESTAMP WITH TIME ZONE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_dead_letter_queue_status ON dead_letter_queue(status);
CREATE INDEX idx_dead_letter_queue_failed_at ON dead_letter_queue(failed_at);
CREATE INDEX idx_dead_letter_queue_organization_id ON dead_letter_queue(organization_id);
CREATE INDEX idx_dead_letter_queue_job_type ON dead_letter_queue(job_type);

-- Index for replay operations
CREATE INDEX idx_dead_letter_queue_replay ON dead_letter_queue(status, failed_at) WHERE status = 'failed';

-- Add organization_id to existing tables if not exists (for better data isolation)
DO $$ 
BEGIN
    -- Check if organization_id exists in automation_executions table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'automation_executions' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE automation_executions 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        
        -- Backfill organization_id from automation_rules
        UPDATE automation_executions 
        SET organization_id = ar.organization_id
        FROM automation_rules ar
        WHERE automation_executions.automation_rule_id = ar.id;
        
        -- Add index
        CREATE INDEX idx_automation_executions_organization_id ON automation_executions(organization_id);
    END IF;
END $$;

-- Enhanced automation_executions table with better error tracking
ALTER TABLE automation_executions 
ADD COLUMN IF NOT EXISTS webhook_response_status INTEGER,
ADD COLUMN IF NOT EXISTS webhook_response_headers JSONB,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for retry operations
CREATE INDEX IF NOT EXISTS idx_automation_executions_retry ON automation_executions(status, next_retry_at) 
WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

-- Function to automatically move failed jobs to DLQ after max retries
CREATE OR REPLACE FUNCTION move_to_dlq_on_max_retries() 
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a failed execution that has reached max retries
    IF NEW.status = 'failed' AND NEW.retry_count >= NEW.max_retries AND OLD.status != 'failed' THEN
        -- Insert into dead letter queue
        INSERT INTO dead_letter_queue (
            job_type,
            job_data,
            error_message,
            failed_at,
            retry_count,
            max_retries,
            organization_id
        ) VALUES (
            'webhook',
            jsonb_build_object(
                'execution_id', NEW.id,
                'automation_rule_id', NEW.automation_rule_id,
                'event_id', NEW.event_id,
                'response_data', NEW.response_data
            ),
            COALESCE(NEW.error_message, 'Max retries exceeded'),
            NEW.completed_at,
            NEW.retry_count,
            NEW.max_retries,
            NEW.organization_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic DLQ insertion
DROP TRIGGER IF EXISTS trigger_move_to_dlq ON automation_executions;
CREATE TRIGGER trigger_move_to_dlq
    AFTER UPDATE ON automation_executions
    FOR EACH ROW
    EXECUTE FUNCTION move_to_dlq_on_max_retries();

-- Function to cleanup old DLQ records (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_dlq_records(older_than_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM dead_letter_queue 
    WHERE failed_at < NOW() - (older_than_days || ' days')::INTERVAL
    AND status IN ('replayed', 'permanent_failure');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get DLQ statistics
CREATE OR REPLACE FUNCTION get_dlq_stats(org_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_failed INTEGER,
    total_replayed INTEGER,
    total_permanent_failures INTEGER,
    oldest_failure TIMESTAMP WITH TIME ZONE,
    newest_failure TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as total_failed,
        COUNT(*) FILTER (WHERE status = 'replayed')::INTEGER as total_replayed,
        COUNT(*) FILTER (WHERE status = 'permanent_failure')::INTEGER as total_permanent_failures,
        MIN(failed_at) as oldest_failure,
        MAX(failed_at) as newest_failure
    FROM dead_letter_queue 
    WHERE (org_id IS NULL OR organization_id = org_id);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE dead_letter_queue IS 'Stores failed webhook jobs for manual review and replay';
COMMENT ON COLUMN dead_letter_queue.job_type IS 'Type of job that failed (webhook, notification, etc.)';
COMMENT ON COLUMN dead_letter_queue.job_data IS 'Original job data for replay purposes';
COMMENT ON COLUMN dead_letter_queue.error_message IS 'Error message from the failed execution';
COMMENT ON COLUMN dead_letter_queue.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN dead_letter_queue.status IS 'Current status: failed, replayed, or permanent_failure';

COMMENT ON FUNCTION move_to_dlq_on_max_retries() IS 'Automatically moves failed jobs to DLQ after max retries';
COMMENT ON FUNCTION cleanup_old_dlq_records(INTEGER) IS 'Removes old DLQ records for maintenance';
COMMENT ON FUNCTION get_dlq_stats(UUID) IS 'Returns DLQ statistics for monitoring';
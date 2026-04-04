import { MetricsService } from '../metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  afterEach(async () => {
    service.registry.clear();
  });

  describe('counters', () => {
    it('should increment messagesReceived counter', async () => {
      service.messagesReceived.labels('instance-1', 'text').inc();
      service.messagesReceived.labels('instance-1', 'text').inc();
      service.messagesReceived.labels('instance-1', 'image').inc();

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_messages_received_total');
      expect(metrics).toContain('instance_id="instance-1"');
      expect(metrics).toContain('type="text"');
      expect(metrics).toContain('type="image"');
    });

    it('should increment messagesSent counter with status labels', async () => {
      service.messagesSent.labels('instance-1', 'text', 'success').inc();
      service.messagesSent.labels('instance-1', 'text', 'failed').inc(3);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_messages_sent_total');
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('status="failed"');
    });

    it('should increment messagesFailed counter', async () => {
      service.messagesFailed.labels('instance-1', 'TIMEOUT').inc();

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_messages_failed_total');
      expect(metrics).toContain('error_code="TIMEOUT"');
    });

    it('should increment httpRequestsTotal counter', async () => {
      service.httpRequestsTotal.labels('GET', '/health', '200').inc();
      service.httpRequestsTotal.labels('POST', '/messages', '201').inc();

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('path="/health"');
      expect(metrics).toContain('status="200"');
    });

    it('should increment bufferFlush counter', async () => {
      service.bufferFlush.labels('instance-1', 'timeout').inc();
      service.bufferFlush.labels('instance-1', 'max_size').inc(2);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_buffer_flush_total');
      expect(metrics).toContain('reason="timeout"');
      expect(metrics).toContain('reason="max_size"');
    });
  });

  describe('histograms', () => {
    it('should observe webhookDeliveryDuration', async () => {
      service.webhookDeliveryDuration.labels('webhook-1').observe(150);
      service.webhookDeliveryDuration.labels('webhook-1').observe(300);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_webhook_delivery_duration_ms');
      expect(metrics).toContain('webhook_id="webhook-1"');
      expect(metrics).toContain('_bucket');
      expect(metrics).toContain('_sum');
      expect(metrics).toContain('_count');
    });

    it('should observe mediaProcessingDuration', async () => {
      service.mediaProcessingDuration.labels('image').observe(500);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_media_processing_duration_ms');
      expect(metrics).toContain('type="image"');
    });

    it('should observe sttTranscriptionDuration', async () => {
      service.sttTranscriptionDuration.labels('whisper').observe(2500);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_stt_transcription_duration_ms');
      expect(metrics).toContain('provider="whisper"');
    });

    it('should observe pipelineStageDuration', async () => {
      service.pipelineStageDuration.labels('classification').observe(25);
      service.pipelineStageDuration.labels('enrichment').observe(50);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_pipeline_stage_duration_ms');
      expect(metrics).toContain('stage="classification"');
      expect(metrics).toContain('stage="enrichment"');
    });

    it('should observe httpRequestDuration', async () => {
      service.httpRequestDuration.labels('GET', '/health').observe(12);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_http_request_duration_ms');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('path="/health"');
    });
  });

  describe('gauges', () => {
    it('should set and update numberHealthScore', async () => {
      service.numberHealthScore.labels('instance-1').set(85);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_number_health_score');
      expect(metrics).toContain('instance_id="instance-1"');
      expect(metrics).toContain('85');
    });

    it('should set connectionUptime', async () => {
      service.connectionUptime.labels('instance-1').set(3600);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_connection_uptime_seconds');
      expect(metrics).toContain('3600');
    });

    it('should set activeInstances', async () => {
      service.activeInstances.set(10);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('nexconnect_active_instances');
      expect(metrics).toContain('10');
    });
  });

  describe('getMetrics', () => {
    it('should return string output', async () => {
      const output = await service.getMetrics();
      expect(typeof output).toBe('string');
    });

    it('should return correct content type', () => {
      const contentType = service.getContentType();
      expect(contentType).toContain('text/plain');
    });
  });
});

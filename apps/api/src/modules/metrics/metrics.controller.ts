import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get Prometheus metrics', description: 'Returns application metrics in Prometheus text exposition format' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully (text/plain)' })
  async getMetrics(@Res() reply: FastifyReply): Promise<void> {
    const metrics = await this.metricsService.getMetrics();

    reply
      .header('Content-Type', this.metricsService.getContentType())
      .status(200)
      .send(metrics);
  }
}

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HealthCheckService } from './health-check.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthCheck: HealthCheckService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check', description: 'Returns overall health status including database and Redis connectivity' })
  @ApiResponse({ status: 200, description: 'Service is healthy or degraded' })
  async check() {
    const result = await this.healthCheck.checkAll();

    return {
      ...result,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe', description: 'Indicates whether the service process is alive' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe', description: 'Indicates whether the service is ready to accept traffic (database and Redis reachable)' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service not ready — dependencies unavailable' })
  async readiness() {
    const isReady = await this.healthCheck.isReady();

    if (!isReady) {
      throw new ServiceUnavailableException('Service not ready');
    }

    return { status: 'ready', checks: { database: 'ok', redis: 'ok' } };
  }
}

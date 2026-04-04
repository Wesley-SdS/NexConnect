import { Module } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TenantsController],
  providers: [TenantsService, DataRetentionService],
  exports: [TenantsService],
})
export class TenantsModule {}

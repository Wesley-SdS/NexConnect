import { Global, Module } from '@nestjs/common';
import { InterPodJwtService } from './inter-pod-jwt.service';

@Global()
@Module({
  providers: [InterPodJwtService],
  exports: [InterPodJwtService],
})
export class InterPodJwtModule {}

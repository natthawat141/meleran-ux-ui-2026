import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CertificatesController } from './certificates.controller';
import { CertificateReadService } from './certificate-read.service';

@Module({ imports: [AuthModule], controllers: [CertificatesController], providers: [CertificateReadService] })
export class CertificatesModule {}
